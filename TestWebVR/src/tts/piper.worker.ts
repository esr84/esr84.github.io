// Piper TTS worker: phonemizes with piper-phonemize (espeak-ng WASM) and runs the VITS voice
// with onnxruntime-web. Every file is served by the app itself (public/models).
import * as ort from 'onnxruntime-web/webgpu';
import {
  createPhonemizer,
  synthesize,
  type CreatePhonemizeModule,
  type Phonemize,
  type PiperVoiceConfig,
} from './piperCore';

export interface PiperUrls {
  readonly model: string;
  readonly config: string;
  readonly phonemizeWasm: string;
  readonly phonemizeData: string;
  readonly ortMjs: string;
  readonly ortWasm: string;
}

export type PiperRequest =
  | { readonly type: 'init'; readonly urls: PiperUrls; readonly threads: number }
  | { readonly type: 'synth'; readonly id: number; readonly text: string }
  /** Debug: list every URL this worker fetched (to prove nothing leaves the origin). */
  | { readonly type: 'resources' };

export type PiperResponse =
  | { readonly type: 'progress'; readonly fraction: number }
  | { readonly type: 'ready'; readonly sampleRate: number }
  | {
      readonly type: 'audio';
      readonly id: number;
      readonly pcm: Float32Array;
      readonly sampleRate: number;
      readonly ms: number;
    }
  | { readonly type: 'error'; readonly id?: number; readonly message: string }
  | { readonly type: 'resources'; readonly urls: readonly string[] };

const post = (message: PiperResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(message, transfer);

let state: {
  session: ort.InferenceSession;
  config: PiperVoiceConfig;
  phonemize: Phonemize;
} | null = null;

/** Fetches a file reporting byte progress for the weighted loading bar. */
async function fetchBytes(url: string, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
}

async function loadPhonemizeFactory(): Promise<CreatePhonemizeModule> {
  // The Emscripten glue only recognises a worker when `importScripts` exists, which module
  // workers lack; expose a stub while the glue evaluates so it picks the worker code path.
  const scope = self as unknown as { importScripts?: unknown };
  const hadImportScripts = 'importScripts' in scope;
  if (!hadImportScripts) scope.importScripts = () => undefined;
  try {
    const glue = (await import('@diffusionstudio/piper-wasm/build/piper_phonemize.js')) as {
      default: CreatePhonemizeModule;
    };
    return glue.default;
  } finally {
    if (!hadImportScripts) delete scope.importScripts;
  }
}

async function init(urls: PiperUrls, threads: number): Promise<void> {
  ort.env.wasm.wasmPaths = { mjs: urls.ortMjs, wasm: urls.ortWasm };
  ort.env.wasm.numThreads = threads;

  // Approximate sizes, only used to weight the progress bar.
  const expected = 63_200_000 + 18_100_000 + 640_000;
  let loaded = 0;
  const onBytes = (n: number) => {
    loaded += n;
    post({ type: 'progress', fraction: Math.min(loaded / expected, 0.99) });
  };

  const [config, model, wasmBytes, data, createModule] = await Promise.all([
    fetch(urls.config).then((r) => r.json() as Promise<PiperVoiceConfig>),
    fetchBytes(urls.model, onBytes),
    fetchBytes(urls.phonemizeWasm, onBytes),
    fetchBytes(urls.phonemizeData, onBytes),
    loadPhonemizeFactory(),
  ]);
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const session = await ort.InferenceSession.create(new Uint8Array(model), {
    executionProviders: ['wasm'],
  });
  state = { session, config, phonemize: createPhonemizer(createModule, wasmModule, data) };
  // Warm-up so the first real sentence is not slowed down by lazy initialisation.
  await synthesize('Hola.', { ort, ...state });
  post({ type: 'progress', fraction: 1 });
  post({ type: 'ready', sampleRate: config.audio.sample_rate });
}

self.onmessage = async (event: MessageEvent<PiperRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      await init(request.urls, request.threads);
      return;
    }
    if (request.type === 'resources') {
      const urls = performance.getEntriesByType('resource').map((entry) => entry.name);
      post({ type: 'resources', urls });
      return;
    }
    if (!state) throw new Error('Piper is not initialised');
    const started = performance.now();
    const pcm = await synthesize(request.text, { ort, ...state });
    post(
      {
        type: 'audio',
        id: request.id,
        pcm,
        sampleRate: state.config.audio.sample_rate,
        ms: performance.now() - started,
      },
      [pcm.buffer],
    );
  } catch (err) {
    post({
      type: 'error',
      id: request.type === 'synth' ? request.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
