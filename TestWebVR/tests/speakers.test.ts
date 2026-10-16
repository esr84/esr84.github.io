import { describe, expect, it } from 'vitest';
import { pickSpanishVoice } from '../src/tts/speakers';

const voice = (lang: string, localService: boolean, name = lang) =>
  ({ lang, localService, name }) as SpeechSynthesisVoice;

describe('pickSpanishVoice', () => {
  it('prefers a local es-ES voice', () => {
    const picked = pickSpanishVoice([
      voice('en-US', true),
      voice('es-MX', true),
      voice('es-ES', true, 'spain'),
    ]);
    expect(picked?.name).toBe('spain');
  });

  it('falls back to any local Spanish voice', () => {
    expect(pickSpanishVoice([voice('es-MX', true, 'mx')])?.name).toBe('mx');
  });

  it('never picks a remote voice (it would send text off the device)', () => {
    expect(pickSpanishVoice([voice('es-ES', false)])).toBeNull();
  });
});
