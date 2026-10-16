export type ProgressCallback = (fraction: number) => void;

export interface SynthesisResult {
  /** Mono float PCM. */
  readonly pcm: Float32Array;
  readonly sampleRate: number;
  /** Synthesis time in milliseconds (text in → audio ready). */
  readonly ms: number;
}

/** Text-to-speech engine that produces audio buffers (e.g. Piper). */
export interface TTSProvider {
  readonly name: string;
  load(onProgress?: ProgressCallback): Promise<void>;
  synthesize(text: string): Promise<SynthesisResult>;
}

export interface SpeechHandle {
  /** Time from `say()` until audio starts, in milliseconds. */
  readonly latencyMs: number;
  /** Resolves when the speech finishes or is stopped. */
  readonly ended: Promise<void>;
  stop(): void;
}

/**
 * Something that can say text out loud: Piper + audio player, or the browser's
 * speechSynthesis as a fallback. The conversation controller only talks to this.
 */
export interface Speaker {
  readonly name: string;
  say(text: string): Promise<SpeechHandle>;
  /** Current output level 0..1 (for the avatar's "talking" motion); 0 if unknown. */
  level(): number;
  stop(): void;
}
