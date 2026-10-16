// Piper TTS core shared by the browser worker and the Node fixture generator.
// No imports and only erasable TypeScript, so Node can run it directly with type stripping.

/** Subset of a Piper voice `.onnx.json` used for inference. */
export interface PiperVoiceConfig {
  readonly audio: { readonly sample_rate: number };
  readonly espeak: { readonly voice: string };
  readonly inference: {
    readonly noise_scale: number;
    readonly length_scale: number;
    readonly noise_w: number;
  };
  readonly speaker_id_map?: Record<string, number>;
}

/** Minimal onnxruntime surface (works with onnxruntime-web and onnxruntime-node). */
export interface OrtLike {
  Tensor: new (type: string, data: unknown, dims?: readonly number[]) => unknown;
}

export interface OrtSessionLike {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown }>>;
}

export type Phonemize = (text: string, espeakVoice: string) => Promise<number[]>;

/** Options accepted by the Emscripten factory of piper_phonemize.js. */
export interface PhonemizeModuleOptions {
  print: (line: string) => void;
  printErr: (line: string) => void;
  instantiateWasm: (
    imports: WebAssembly.Imports,
    receive: (instance: WebAssembly.Instance) => void,
  ) => object;
  getPreloadedPackage: (name: string, size: number) => ArrayBuffer;
  locateFile: (path: string) => string;
}

export type CreatePhonemizeModule = (options: PhonemizeModuleOptions) => Promise<{
  callMain(args: string[]): void;
}>;

/**
 * Wraps piper-phonemize (espeak-ng compiled to WASM). The program runs once per call (its
 * `main` cannot be re-entered), but the WASM is compiled only once and the 18 MB espeak-ng
 * data package is passed from memory, so nothing is fetched again.
 */
export function createPhonemizer(
  createModule: CreatePhonemizeModule,
  wasmModule: WebAssembly.Module,
  dataPackage: ArrayBuffer,
): Phonemize {
  return (text, espeakVoice) =>
    new Promise<number[]>((resolve, reject) => {
      let done = false;
      createModule({
        print: (line) => {
          if (done) return;
          try {
            const parsed = JSON.parse(line) as { phoneme_ids?: number[] };
            if (!parsed.phoneme_ids) return;
            done = true;
            resolve(parsed.phoneme_ids);
          } catch {
            // Not the JSON result line; ignore.
          }
        },
        printErr: (line) => {
          if (!done && /error/i.test(line)) {
            done = true;
            reject(new Error(`piper-phonemize: ${line}`));
          }
        },
        instantiateWasm: (imports, receive) => {
          WebAssembly.instantiate(wasmModule, imports).then(receive, reject);
          return {};
        },
        // The package is consumed (copied into the in-memory FS), so hand out a copy each time.
        getPreloadedPackage: () => dataPackage.slice(0),
        locateFile: (path) => path,
      })
        .then((module) => {
          module.callMain([
            '-l',
            espeakVoice,
            '--input',
            JSON.stringify([{ text }]),
            '--espeak_data',
            '/espeak-ng-data',
          ]);
          if (!done) {
            done = true;
            reject(new Error('piper-phonemize produced no phonemes'));
          }
        })
        .catch((err: unknown) => {
          if (!done) {
            done = true;
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
    });
}

/**
 * Splits long text into chunks of at most `maxLength` characters, preferring sentence
 * boundaries. Piper handles a sentence or two at a time much better than a long paragraph.
 */
export function splitIntoChunks(text: string, maxLength = 300): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];
  const sentences = clean.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= maxLength) {
      current = (current + ' ' + sentence).trim();
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= maxLength) {
      current = sentence;
      continue;
    }
    // A single very long sentence: cut at the last space before the limit.
    let rest = sentence;
    while (rest.length > maxLength) {
      const cut = rest.lastIndexOf(' ', maxLength);
      const at = cut > 0 ? cut : maxLength;
      chunks.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    current = rest;
  }
  if (current) chunks.push(current);
  return chunks;
}

export interface SynthesizeDeps {
  readonly ort: OrtLike;
  readonly session: OrtSessionLike;
  readonly config: PiperVoiceConfig;
  readonly phonemize: Phonemize;
  /** >1 speaks slower, <1 faster. Defaults to the voice config value. */
  readonly lengthScale?: number;
}

/** Builds the ONNX feeds for one chunk of phoneme ids. */
export function buildFeeds(
  ort: OrtLike,
  config: PiperVoiceConfig,
  phonemeIds: readonly number[],
  lengthScale = config.inference.length_scale,
): Record<string, unknown> {
  const ids = BigInt64Array.from(phonemeIds, (id) => BigInt(id));
  const feeds: Record<string, unknown> = {
    input: new ort.Tensor('int64', ids, [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor(
      'float32',
      Float32Array.from([config.inference.noise_scale, lengthScale, config.inference.noise_w]),
      [3],
    ),
  };
  if (config.speaker_id_map && Object.keys(config.speaker_id_map).length > 0) {
    feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
  }
  return feeds;
}

/** Synthesizes text to mono float PCM at `config.audio.sample_rate`. */
export async function synthesize(text: string, deps: SynthesizeDeps): Promise<Float32Array> {
  const pieces: Float32Array[] = [];
  const pauseSamples = Math.round(deps.config.audio.sample_rate * 0.12);
  for (const chunk of splitIntoChunks(text)) {
    const ids = await deps.phonemize(chunk, deps.config.espeak.voice);
    const outputs = await deps.session.run(
      buildFeeds(deps.ort, deps.config, ids, deps.lengthScale),
    );
    const output = outputs.output ?? Object.values(outputs)[0];
    if (!output) throw new Error('Piper model returned no output');
    if (pieces.length > 0) pieces.push(new Float32Array(pauseSamples));
    pieces.push(Float32Array.from(output.data as ArrayLike<number>));
  }
  const total = pieces.reduce((sum, p) => sum + p.length, 0);
  const pcm = new Float32Array(total);
  let offset = 0;
  for (const piece of pieces) {
    pcm.set(piece, offset);
    offset += piece.length;
  }
  return pcm;
}

/** Encodes mono float PCM as a 16-bit PCM WAV file. */
export function encodeWav(pcm: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

/** Decodes a 16-bit PCM mono WAV produced by `encodeWav`. */
export function decodeWav(bytes: Uint8Array): { pcm: Float32Array; sampleRate: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const dataBytes = view.getUint32(40, true);
  const pcm = new Float32Array(dataBytes / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(44 + i * 2, true) / 0x8000;
  return { pcm, sampleRate };
}
