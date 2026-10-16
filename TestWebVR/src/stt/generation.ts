import { STT_SAMPLE_RATE } from '../audio/dsp';

/**
 * Whisper decoding options shared by the worker and the tests. Spoken Spanish is roughly
 * 3 words (≈ 5 tokens) per second, so tokens are capped by duration: this stops the classic
 * Whisper failure of looping on a word ("sí, sí, sí…") until the 448-token limit.
 */
export function generationOptions(samples: number) {
  const seconds = samples / STT_SAMPLE_RATE;
  return {
    language: 'spanish',
    task: 'transcribe',
    max_new_tokens: Math.min(128, Math.ceil(seconds * 8) + 8),
    no_repeat_ngram_size: 3,
    repetition_penalty: 1.1,
  } as const;
}
