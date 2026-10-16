import { describe, expect, it } from 'vitest';
import { concatChunks, normalizePeak, peak, resample, rms } from '../src/audio/dsp';

function sine(freq: number, rate: number, seconds: number, amp = 0.5): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

/** Estimates the frequency from positive-going zero crossings. */
function estimateFrequency(samples: Float32Array, rate: number): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] ?? 0) < 0 && (samples[i] ?? 0) >= 0) crossings++;
  }
  return crossings / (samples.length / rate);
}

describe('resample', () => {
  it.each([48000, 44100, 22050, 8000])('produces the right length from %i Hz', (rate) => {
    const input = new Float32Array(rate); // 1 s
    expect(resample(input, rate, 16000).length).toBe(16000);
  });

  it.each([48000, 44100, 8000])('keeps a 440 Hz tone within 2 %% from %i Hz', (rate) => {
    const output = resample(sine(440, rate, 1), rate, 16000);
    expect(Math.abs(estimateFrequency(output, 16000) - 440) / 440).toBeLessThan(0.02);
  });

  it('keeps the amplitude of a low tone when downsampling', () => {
    const output = resample(sine(200, 48000, 1, 0.5), 48000, 16000);
    expect(peak(output)).toBeGreaterThan(0.45);
  });

  it('returns a copy when rates match', () => {
    const input = sine(440, 16000, 0.1);
    const output = resample(input, 16000, 16000);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
  });
});

describe('normalizePeak', () => {
  it('brings quiet audio up to the target', () => {
    expect(peak(normalizePeak(sine(300, 16000, 0.1, 0.3)))).toBeCloseTo(0.9, 2);
  });

  it('caps the gain for near-silence', () => {
    expect(peak(normalizePeak(sine(300, 16000, 0.1, 0.01)))).toBeCloseTo(0.04, 3);
  });

  it('never attenuates loud audio', () => {
    expect(peak(normalizePeak(sine(300, 16000, 0.1, 0.95)))).toBeCloseTo(0.95, 3);
  });

  it('leaves digital silence untouched', () => {
    expect(peak(normalizePeak(new Float32Array(100)))).toBe(0);
  });
});

describe('helpers', () => {
  it('concatenates chunks', () => {
    const out = concatChunks([new Float32Array([1, 2]), new Float32Array([3])]);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it('computes rms', () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1);
    expect(rms(new Float32Array())).toBe(0);
  });
});
