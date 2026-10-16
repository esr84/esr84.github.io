export interface PlaybackHandle {
  readonly ended: Promise<void>;
  stop(): void;
}

/**
 * Plays synthesized speech through an AnalyserNode, so the avatar can move with the voice
 * level (T12), and lets the conversation interrupt it (barge-in).
 */
export class AudioPlayer {
  readonly analyser: AnalyserNode;
  private readonly samples: Float32Array<ArrayBuffer>;
  private current: { source: AudioBufferSourceNode; finish: () => void } | null = null;

  constructor(private readonly context: AudioContext) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.connect(context.destination);
    this.samples = new Float32Array(this.analyser.fftSize);
  }

  get playing(): boolean {
    return this.current !== null;
  }

  play(pcm: Float32Array, sampleRate: number): PlaybackHandle {
    this.stop();
    const buffer = this.context.createBuffer(1, pcm.length, sampleRate);
    buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);

    let finish!: () => void;
    const ended = new Promise<void>((resolve) => (finish = resolve));
    const entry = { source, finish };
    source.onended = () => {
      if (this.current === entry) this.current = null;
      finish();
    };
    this.current = entry;
    source.start();
    return {
      ended,
      stop: () => {
        if (this.current === entry) this.stop();
      },
    };
  }

  stop(): void {
    const current = this.current;
    if (!current) return;
    this.current = null;
    current.source.onended = null;
    try {
      current.source.stop();
    } catch {
      // Already stopped.
    }
    current.source.disconnect();
    current.finish();
  }

  /** RMS of the audio currently playing, 0..1. Cheap enough to call every frame. */
  level(): number {
    if (!this.current) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const v = this.samples[i] ?? 0;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 3);
  }
}
