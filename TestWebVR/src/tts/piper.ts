import { getParam } from '../util/params';
import { asset } from '../util/paths';
import { onnxThreads } from '../xr/deviceProfile';
import type { PiperRequest, PiperResponse, PiperUrls } from './piper.worker';
import type { ProgressCallback, SynthesisResult, TTSProvider } from './types';

export const DEFAULT_VOICE = 'es_ES-davefx-medium';

function absolute(path: string): string {
  return new URL(asset(path), location.href).href;
}

/** Threads for one ONNX worker (see onnxThreads; `?threads=N` to experiment). */
export function workerThreads(): number {
  return onnxThreads(
    globalThis.crossOriginIsolated === true,
    navigator.hardwareConcurrency,
    getParam('threads'),
  );
}

/** Piper voice running in a Web Worker, so synthesis never blocks the render loop. */
export class PiperTTSProvider implements TTSProvider {
  readonly name = 'Piper';
  private readonly worker = new Worker(new URL('./piper.worker.ts', import.meta.url), {
    type: 'module',
  });
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (r: SynthesisResult) => void; reject: (e: Error) => void }
  >();
  private loading: Promise<void> | null = null;

  constructor(private readonly voice = DEFAULT_VOICE) {}

  load(onProgress?: ProgressCallback): Promise<void> {
    this.loading ??= new Promise<void>((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<PiperResponse>) => {
        const message = event.data;
        switch (message.type) {
          case 'progress':
            onProgress?.(message.fraction);
            break;
          case 'ready':
            resolve();
            break;
          case 'audio':
            this.pending.get(message.id)?.resolve({
              pcm: message.pcm,
              sampleRate: message.sampleRate,
              ms: message.ms,
            });
            this.pending.delete(message.id);
            break;
          case 'error': {
            const error = new Error(message.message);
            if (message.id === undefined) {
              reject(error);
            } else {
              this.pending.get(message.id)?.reject(error);
              this.pending.delete(message.id);
            }
            break;
          }
        }
      };
      this.worker.onerror = (event) => reject(new Error(event.message || 'Piper worker failed'));
      const urls: PiperUrls = {
        model: absolute(`models/piper/${this.voice}.onnx`),
        config: absolute(`models/piper/${this.voice}.onnx.json`),
        phonemizeWasm: absolute('models/piper/piper_phonemize.wasm'),
        phonemizeData: absolute('models/piper/piper_phonemize.data'),
        ortMjs: absolute('models/ort/ort-wasm-simd-threaded.asyncify.mjs'),
        ortWasm: absolute('models/ort/ort-wasm-simd-threaded.asyncify.wasm'),
      };
      this.post({ type: 'init', urls, threads: workerThreads() });
    });
    return this.loading;
  }

  async synthesize(text: string): Promise<SynthesisResult> {
    await this.load();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ type: 'synth', id, text });
    });
  }

  /** Debug: URLs fetched by the worker (models, runtime...). */
  resources(): Promise<readonly string[]> {
    return new Promise((resolve) => {
      const listener = (event: MessageEvent<PiperResponse>) => {
        if (event.data.type !== 'resources') return;
        this.worker.removeEventListener('message', listener);
        resolve(event.data.urls);
      };
      this.worker.addEventListener('message', listener);
      this.post({ type: 'resources' });
    });
  }

  private post(request: PiperRequest): void {
    this.worker.postMessage(request);
  }
}
