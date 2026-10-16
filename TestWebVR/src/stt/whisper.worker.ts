// Whisper speech recognition worker (transformers.js). Models and the ONNX runtime are
// served by the app (public/models); remote model downloads are disabled.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { generationOptions } from './generation';
import type { SttDevice, SttModel } from './types';

export interface WhisperInit {
  readonly type: 'init';
  readonly model: SttModel;
  readonly device: SttDevice;
  readonly threads: number;
  /** Path of public/models/ relative to the origin, e.g. "/TestWebVR/models/". */
  readonly modelsBase: string;
  readonly ortMjs: string;
  readonly ortWasm: string;
}

export type WhisperRequest =
  | WhisperInit
  | { readonly type: 'transcribe'; readonly id: number; readonly pcm: Float32Array }
  | { readonly type: 'resources' };

export type WhisperResponse =
  | { readonly type: 'progress'; readonly fraction: number }
  | { readonly type: 'ready' }
  | { readonly type: 'text'; readonly id: number; readonly text: string; readonly ms: number }
  | { readonly type: 'error'; readonly id?: number; readonly message: string }
  | { readonly type: 'resources'; readonly urls: readonly string[] };

const post = (message: WhisperResponse) => (self as unknown as Worker).postMessage(message);

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

/** Files of a Whisper q8 model (see scripts/fetch-models.mjs). */
const MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

/**
 * Downloads the model files once, with real byte progress. With a progress callback,
 * transformers.js would GET every file a first time only to learn its size, doubling the
 * download (77 MB more on the headset); instead it reads them from this in-memory cache.
 */
async function prefetchModel(base: string, model: string): Promise<Map<string, Uint8Array>> {
  const urls = MODEL_FILES.map((file) => `${base}${model}/${file}`);
  const responses = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    }),
  );
  const total = responses.reduce((sum, r) => sum + Number(r.headers.get('content-length') ?? 0), 0);
  let loaded = 0;
  const files = new Map<string, Uint8Array>();
  await Promise.all(
    responses.map(async (response, i) => {
      const reader = response.body!.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        size += value.length;
        loaded += value.length;
        if (total > 0) post({ type: 'progress', fraction: Math.min((loaded / total) * 0.9, 0.9) });
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      files.set(urls[i] ?? '', bytes);
    }),
  );
  return files;
}

async function init(request: WhisperInit): Promise<void> {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = request.modelsBase;
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = { mjs: request.ortMjs, wasm: request.ortWasm };
    wasm.numThreads = request.threads;
  }

  const files = await prefetchModel(request.modelsBase, request.model);
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = {
    match: async (key: string | Request) => {
      const bytes = files.get(typeof key === 'string' ? key : new URL(key.url).pathname);
      if (!bytes) return undefined;
      const type = (typeof key === 'string' ? key : key.url).endsWith('.json')
        ? 'application/json'
        : 'application/octet-stream';
      return new Response(bytes as Uint8Array<ArrayBuffer>, {
        headers: { 'content-length': String(bytes.length), 'content-type': type },
      });
    },
    put: async () => undefined,
  };

  transcriber = await pipeline('automatic-speech-recognition', request.model, {
    device: request.device,
    dtype: 'q8',
  });
  // The ONNX sessions hold their own copy: free the downloaded bytes.
  files.clear();
  post({ type: 'progress', fraction: 0.95 });
  // Warm-up: the first inference initialises kernels and is much slower than the rest.
  await transcriber(new Float32Array(16000), generationOptions(16000));
  post({ type: 'progress', fraction: 1 });
  post({ type: 'ready' });
}

function extractText(output: unknown): string {
  const first = Array.isArray(output) ? output[0] : output;
  const text = (first as { text?: unknown } | undefined)?.text;
  return typeof text === 'string' ? text.trim() : '';
}

self.onmessage = async (event: MessageEvent<WhisperRequest>) => {
  const request = event.data;
  try {
    switch (request.type) {
      case 'init':
        await init(request);
        return;
      case 'resources':
        post({
          type: 'resources',
          urls: performance.getEntriesByType('resource').map((entry) => entry.name),
        });
        return;
      case 'transcribe': {
        if (!transcriber) throw new Error('Whisper is not initialised');
        const started = performance.now();
        const output = await transcriber(request.pcm, generationOptions(request.pcm.length));
        post({
          type: 'text',
          id: request.id,
          text: extractText(output),
          ms: performance.now() - started,
        });
        return;
      }
    }
  } catch (err) {
    post({
      type: 'error',
      id: request.type === 'transcribe' ? request.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
