import { workerThreads } from '../tts/piper';
import { asset } from '../util/paths';
import type {
  ProgressCallback,
  STTProvider,
  SttDevice,
  SttModel,
  TranscriptionResult,
} from './types';
import type { WhisperRequest, WhisperResponse } from './whisper.worker';

function absolute(path: string): string {
  return new URL(asset(path), location.href).href;
}

/** Whisper running in a Web Worker via transformers.js. */
export class WhisperSTTProvider implements STTProvider {
  readonly name = 'Whisper';
  private readonly worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
    type: 'module',
  });
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (r: TranscriptionResult) => void; reject: (e: Error) => void }
  >();
  private loading: Promise<void> | null = null;

  constructor(
    readonly model: SttModel,
    readonly device: SttDevice,
  ) {}

  load(onProgress?: ProgressCallback): Promise<void> {
    this.loading ??= new Promise<void>((resolve, reject) => {
      this.worker.addEventListener('message', (event: MessageEvent<WhisperResponse>) => {
        const message = event.data;
        switch (message.type) {
          case 'progress':
            onProgress?.(message.fraction);
            break;
          case 'ready':
            resolve();
            break;
          case 'text':
            this.pending.get(message.id)?.resolve({ text: message.text, ms: message.ms });
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
      });
      this.worker.onerror = (event) => reject(new Error(event.message || 'Whisper worker failed'));
      this.post({
        type: 'init',
        model: this.model,
        device: this.device,
        threads: workerThreads(),
        // Path-absolute, not a full URL: transformers.js 4.3 skips its "does this local file
        // exist?" check for http(s) URLs, then wrongly assumes there is no tokenizer/processor.
        modelsBase: asset('models/'),
        ortMjs: absolute('models/ort/ort-wasm-simd-threaded.asyncify.mjs'),
        ortWasm: absolute('models/ort/ort-wasm-simd-threaded.asyncify.wasm'),
      });
    });
    return this.loading;
  }

  async transcribe(pcm16k: Float32Array): Promise<TranscriptionResult> {
    await this.load();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      // Copy, so the caller can keep (and replay) its recording.
      const pcm = pcm16k.slice();
      this.worker.postMessage({ type: 'transcribe', id, pcm } satisfies WhisperRequest, [
        pcm.buffer,
      ]);
    });
  }

  /** Debug: URLs fetched by the worker. */
  resources(): Promise<readonly string[]> {
    return new Promise((resolve) => {
      const listener = (event: MessageEvent<WhisperResponse>) => {
        if (event.data.type !== 'resources') return;
        this.worker.removeEventListener('message', listener);
        resolve(event.data.urls);
      };
      this.worker.addEventListener('message', listener);
      this.post({ type: 'resources' });
    });
  }

  private post(request: WhisperRequest): void {
    this.worker.postMessage(request);
  }
}
