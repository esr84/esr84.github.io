// Round trip: Piper-generated Spanish speech (tests/fixtures) → Whisper → text close to the
// original sentence. Needs the models (npm run fetch-models). Run with: npm run test:slow
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { beforeAll, describe, expect, it } from 'vitest';
import { resample, STT_SAMPLE_RATE } from '../../src/audio/dsp';
import { generationOptions } from '../../src/stt/generation';
import { similarity } from '../../src/text/normalize';
import { decodeWav } from '../../src/tts/piperCore';

const FIXTURES = join(process.cwd(), 'tests', 'fixtures');
const sentences = JSON.parse(readFileSync(join(FIXTURES, 'fixtures.json'), 'utf8')) as Record<
  string,
  { text: string }
>;

const MODEL = (process.env.STT_MODEL ?? 'whisper-base') as 'whisper-tiny' | 'whisper-base';
let transcriber: AutomaticSpeechRecognitionPipeline;

beforeAll(async () => {
  env.allowRemoteModels = false;
  env.localModelPath = join(process.cwd(), 'public', 'models') + '/';
  transcriber = await pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8' });
}, 120_000);

describe(`STT round trip (${MODEL})`, () => {
  it.each(Object.entries(sentences))(
    '%s',
    async (name, { text }) => {
      const { pcm, sampleRate } = decodeWav(
        new Uint8Array(readFileSync(join(FIXTURES, `${name}.wav`))),
      );
      const audio = resample(pcm, sampleRate, STT_SAMPLE_RATE);
      const started = performance.now();
      const output = (await transcriber(audio, generationOptions(audio.length))) as {
        text: string;
      };
      const score = similarity(output.text, text);
      console.info(
        `${name}: "${output.text.trim()}" (similarity ${score.toFixed(2)}, ${Math.round(performance.now() - started)} ms)`,
      );
      expect(score).toBeGreaterThanOrEqual(0.8);
    },
    60_000,
  );
});
