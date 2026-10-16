// Generates tests/fixtures/*.wav with the same Piper voice and core code as the app, so the
// STT round-trip test (T09) has realistic Spanish speech. Run: npm run gen-fixtures
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-node';
import {
  createPhonemizer,
  encodeWav,
  synthesize,
  type CreatePhonemizeModule,
  type PiperVoiceConfig,
} from '../src/tts/piperCore.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = join(ROOT, 'public', 'models', 'piper');
const OUT = join(ROOT, 'tests', 'fixtures');

export const FIXTURES: Record<string, string> = {
  'buenos-dias': 'Buenos días, ¿en qué puedo ayudarle?',
  entiendo: 'Entiendo que esté molesto, tiene usted razón.',
  ticket: '¿Tiene el ticket de compra?',
  'lo-siento': 'Lo siento mucho, vamos a buscar una solución.',
  devolver: 'Podemos cambiársela por otra o devolverle el dinero.',
};

const require = createRequire(import.meta.url);
const createModule =
  require('@diffusionstudio/piper-wasm/build/piper_phonemize.js') as CreatePhonemizeModule;

const config = JSON.parse(
  await readFile(join(MODELS, 'es_ES-davefx-medium.onnx.json'), 'utf8'),
) as PiperVoiceConfig;
const wasm = await WebAssembly.compile(await readFile(join(MODELS, 'piper_phonemize.wasm')));
const data = (await readFile(join(MODELS, 'piper_phonemize.data'))).buffer as ArrayBuffer;
const phonemize = createPhonemizer(createModule, wasm, data);
const session = await ort.InferenceSession.create(join(MODELS, 'es_ES-davefx-medium.onnx'));

await mkdir(OUT, { recursive: true });
const manifest: Record<string, { text: string; seconds: number }> = {};
for (const [name, text] of Object.entries(FIXTURES)) {
  const started = performance.now();
  const pcm = await synthesize(text, { ort, session, config, phonemize });
  const seconds = pcm.length / config.audio.sample_rate;
  await writeFile(join(OUT, `${name}.wav`), encodeWav(pcm, config.audio.sample_rate));
  manifest[name] = { text, seconds: Number(seconds.toFixed(2)) };
  console.log(
    `${name}.wav  ${seconds.toFixed(2)} s  (${Math.round(performance.now() - started)} ms)`,
  );
}
await writeFile(join(OUT, 'fixtures.json'), `${JSON.stringify(manifest, null, 2)}\n`);
