import type { AudioPlayer } from '../audio/player';
import type { SpeechHandle, Speaker, TTSProvider } from './types';

/** Speaker backed by a TTSProvider (Piper) and the shared audio player. */
export class ProviderSpeaker implements Speaker {
  readonly name: string;

  constructor(
    private readonly provider: TTSProvider,
    private readonly player: AudioPlayer,
  ) {
    this.name = provider.name;
  }

  async say(text: string): Promise<SpeechHandle> {
    const started = performance.now();
    const result = await this.provider.synthesize(text);
    const playback = this.player.play(result.pcm, result.sampleRate);
    return { latencyMs: performance.now() - started, ended: playback.ended, stop: playback.stop };
  }

  level(): number {
    return this.player.level();
  }

  stop(): void {
    this.player.stop();
  }
}

/** Picks the best Spanish voice installed in the browser, preferring Spain. */
export function pickSpanishVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  // Local voices first: remote ones send the text to a server.
  const local = spanish.filter((v) => v.localService);
  const pool = local.length > 0 ? local : [];
  return pool.find((v) => v.lang.toLowerCase() === 'es-es') ?? pool[0] ?? null;
}

/**
 * Fallback when Piper cannot load: the browser's own speech synthesis. Only on-device
 * voices are used, so no text leaves the headset.
 */
export class WebSpeechSpeaker implements Speaker {
  readonly name = 'speechSynthesis';
  private speaking = false;

  static async create(): Promise<WebSpeechSpeaker | null> {
    if (!('speechSynthesis' in globalThis)) return null;
    const voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const list = speechSynthesis.getVoices();
      if (list.length > 0) return resolve(list);
      const timer = setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
      speechSynthesis.addEventListener(
        'voiceschanged',
        () => {
          clearTimeout(timer);
          resolve(speechSynthesis.getVoices());
        },
        { once: true },
      );
    });
    const voice = pickSpanishVoice(voices);
    return voice ? new WebSpeechSpeaker(voice) : null;
  }

  private constructor(private readonly voice: SpeechSynthesisVoice) {}

  say(text: string): Promise<SpeechHandle> {
    const started = performance.now();
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    utterance.lang = this.voice.lang;
    return new Promise((resolve) => {
      const ended = new Promise<void>((done) => {
        utterance.onend = () => {
          this.speaking = false;
          done();
        };
        utterance.onerror = () => {
          this.speaking = false;
          done();
        };
      });
      utterance.onstart = () => {
        this.speaking = true;
        resolve({ latencyMs: performance.now() - started, ended, stop: () => this.stop() });
      };
      speechSynthesis.speak(utterance);
    });
  }

  level(): number {
    // No access to the audio signal: a constant level still animates the avatar while talking.
    return this.speaking ? 0.35 : 0;
  }

  stop(): void {
    speechSynthesis.cancel();
    this.speaking = false;
  }
}
