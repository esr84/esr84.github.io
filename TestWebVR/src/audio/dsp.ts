/** Sample rate expected by Whisper. */
export const STT_SAMPLE_RATE = 16000;

/**
 * Resamples mono PCM. When downsampling, each output sample is the average of the input
 * samples it covers (a box low-pass filter) to limit aliasing; when upsampling it falls back
 * to linear interpolation. Good enough for speech recognition, and allocation-light.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input.slice();
  const outLength = Math.round((input.length * toRate) / fromRate);
  const output = new Float32Array(outLength);
  const ratio = fromRate / toRate;

  if (ratio > 1) {
    for (let i = 0; i < outLength; i++) {
      const start = i * ratio;
      const end = Math.min(start + ratio, input.length);
      let sum = 0;
      let weight = 0;
      for (let pos = start; pos < end;) {
        const index = Math.floor(pos);
        const next = Math.min(index + 1, end);
        const w = next - pos;
        sum += (input[index] ?? 0) * w;
        weight += w;
        pos = next;
      }
      output[i] = weight > 0 ? sum / weight : 0;
    }
  } else {
    for (let i = 0; i < outLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      const a = input[index] ?? 0;
      const b = input[index + 1] ?? a;
      output[i] = a + (b - a) * frac;
    }
  }
  return output;
}

export function peak(samples: Float32Array): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > max) max = v;
  }
  return max;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Gentle peak normalisation: brings quiet speech up towards `target` without amplifying
 * near-silence into loud noise (gain is capped) and never attenuates.
 */
export function normalizePeak(samples: Float32Array, target = 0.9, maxGain = 4): Float32Array {
  const p = peak(samples);
  if (p < 1e-4) return samples.slice();
  const gain = Math.min(Math.max(target / p, 1), maxGain);
  const output = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) output[i] = (samples[i] ?? 0) * gain;
  return output;
}

export function concatChunks(chunks: readonly Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const output = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
