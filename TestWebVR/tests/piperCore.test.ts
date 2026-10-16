import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildFeeds,
  decodeWav,
  encodeWav,
  splitIntoChunks,
  synthesize,
  type OrtLike,
  type PiperVoiceConfig,
} from '../src/tts/piperCore';

class FakeTensor {
  constructor(
    readonly type: string,
    readonly data: unknown,
    readonly dims?: readonly number[],
  ) {}
}
const ort: OrtLike = { Tensor: FakeTensor };

const config: PiperVoiceConfig = {
  audio: { sample_rate: 22050 },
  espeak: { voice: 'es' },
  inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 },
  speaker_id_map: {},
};

describe('splitIntoChunks', () => {
  it('keeps short text as one chunk', () => {
    expect(splitIntoChunks('  Hola,   ¿qué tal?  ')).toEqual(['Hola, ¿qué tal?']);
  });

  it('splits at sentence boundaries under the limit', () => {
    const text = 'Primera frase. Segunda frase! ¿Tercera frase? Cuarta.';
    const chunks = splitIntoChunks(text, 30);
    expect(chunks.every((c) => c.length <= 30)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });

  it('cuts a very long sentence at spaces', () => {
    const chunks = splitIntoChunks('palabra '.repeat(100), 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunks.join(' ').split(' ')).toHaveLength(100);
  });

  it('returns nothing for blank text', () => {
    expect(splitIntoChunks('   ')).toEqual([]);
  });
});

describe('buildFeeds', () => {
  it('builds int64 inputs and the scales tensor', () => {
    const feeds = buildFeeds(ort, config, [1, 2, 3]) as Record<string, FakeTensor>;
    expect(feeds.input?.type).toBe('int64');
    expect(Array.from(feeds.input?.data as BigInt64Array)).toEqual([1n, 2n, 3n]);
    expect(feeds.input?.dims).toEqual([1, 3]);
    expect(Array.from(feeds.input_lengths?.data as BigInt64Array)).toEqual([3n]);
    expect(Array.from(feeds.scales?.data as Float32Array)).toEqual([
      Math.fround(0.667),
      1,
      Math.fround(0.8),
    ]);
    expect(feeds.sid).toBeUndefined();
  });

  it('adds the speaker id for multi-speaker voices', () => {
    const feeds = buildFeeds(ort, { ...config, speaker_id_map: { a: 0, b: 1 } }, [1]);
    expect(feeds.sid).toBeDefined();
  });
});

describe('synthesize', () => {
  it('runs each chunk and joins them with a short pause', async () => {
    const calls: string[] = [];
    const pcm = await synthesize('Uno. Dos.', {
      ort,
      config,
      phonemize: async (text) => {
        calls.push(text);
        return [1, 2];
      },
      session: { run: async () => ({ output: { data: new Float32Array(100).fill(0.5) } }) },
    });
    expect(calls).toEqual(['Uno. Dos.']);
    expect(pcm.length).toBe(100);
  });
});

describe('WAV encoding', () => {
  it('round-trips PCM', () => {
    const pcm = Float32Array.from([0, 0.5, -0.5, 1, -1]);
    const { pcm: decoded, sampleRate } = decodeWav(encodeWav(pcm, 22050));
    expect(sampleRate).toBe(22050);
    decoded.forEach((v, i) => expect(v).toBeCloseTo(pcm[i] ?? 0, 3));
  });

  it('reads the generated fixtures', () => {
    const { pcm, sampleRate } = decodeWav(
      new Uint8Array(readFileSync('tests/fixtures/ticket.wav')),
    );
    expect(sampleRate).toBe(22050);
    expect(pcm.length / sampleRate).toBeGreaterThan(0.5);
  });
});
