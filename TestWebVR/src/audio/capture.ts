import workletUrl from './recorder.worklet.ts?worker&url';
import { concatChunks, normalizePeak, peak, resample, STT_SAMPLE_RATE } from './dsp';

export interface Recording {
  /** Mono PCM at 16 kHz, peak-normalised, ready for the STT. */
  readonly pcm: Float32Array;
  readonly sampleRate: typeof STT_SAMPLE_RATE;
  readonly durationMs: number;
  /** Peak level before normalisation (0..1), useful to detect a muted microphone. */
  readonly inputPeak: number;
  /** True when the recording was cut at `maxDurationMs`. */
  readonly truncated: boolean;
}

export interface CaptureOptions {
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
}

export const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = { minDurationMs: 300, maxDurationMs: 15000 };

type Message = { type: 'chunk'; chunk: Float32Array } | { type: 'stopped'; sampleRate: number };

/**
 * Microphone recorder for push-to-talk. Audio is only accumulated between `start()` and
 * `stop()`. Recordings longer than `maxDurationMs` are cut and delivered through
 * `onLimitReached`; a later `stop()` then returns null.
 */
export class AudioCapture {
  private chunks: Float32Array[] = [];
  private collected = 0;
  private recording = false;
  private stopWaiter: ((sampleRate: number) => void) | null = null;
  private limitListener: ((recording: Recording | null) => void) | null = null;

  private constructor(
    private readonly context: AudioContext,
    private readonly node: AudioWorkletNode,
    private readonly options: CaptureOptions,
  ) {
    node.port.onmessage = (event: MessageEvent<Message>) => this.onMessage(event.data);
  }

  static async create(
    context: AudioContext,
    stream: MediaStream,
    options: CaptureOptions = DEFAULT_CAPTURE_OPTIONS,
  ): Promise<AudioCapture> {
    await context.audioWorklet.addModule(workletUrl);
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'recorder', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
    });
    // Keep the node pulled by the graph without making the microphone audible.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(context.destination);
    return new AudioCapture(context, node, options);
  }

  get isRecording(): boolean {
    return this.recording;
  }

  onLimitReached(listener: (recording: Recording | null) => void): void {
    this.limitListener = listener;
  }

  start(): void {
    if (this.recording) return;
    this.chunks = [];
    this.collected = 0;
    this.recording = true;
    this.node.port.postMessage({ cmd: 'start' });
  }

  /** Stops and returns the recording, or null if too short or not recording. */
  async stop(): Promise<Recording | null> {
    if (!this.recording) return null;
    return this.finish(false);
  }

  /** Stops and throws the audio away (cancelled push-to-talk). */
  discard(): void {
    if (!this.recording) return;
    this.recording = false;
    this.node.port.postMessage({ cmd: 'stop' });
    this.chunks = [];
    this.collected = 0;
  }

  private async finish(truncated: boolean): Promise<Recording | null> {
    this.recording = false;
    const stopped = new Promise<number>((resolve) => (this.stopWaiter = resolve));
    this.node.port.postMessage({ cmd: 'stop' });
    const rate = await stopped;
    const raw = concatChunks(this.chunks);
    this.chunks = [];
    this.collected = 0;
    const durationMs = (raw.length / rate) * 1000;
    if (durationMs < this.options.minDurationMs) return null;
    const maxSamples = Math.floor((this.options.maxDurationMs / 1000) * rate);
    const clipped = raw.length > maxSamples ? raw.subarray(0, maxSamples) : raw;
    const inputPeak = peak(clipped);
    const pcm = normalizePeak(resample(clipped, rate, STT_SAMPLE_RATE));
    return {
      pcm,
      sampleRate: STT_SAMPLE_RATE,
      durationMs: (clipped.length / rate) * 1000,
      inputPeak,
      truncated,
    };
  }

  private onMessage(message: Message): void {
    if (message.type === 'stopped') {
      this.stopWaiter?.(message.sampleRate);
      this.stopWaiter = null;
      return;
    }
    if (!this.recording) {
      // Late chunk flushed while stopping: keep it only if a stop is pending.
      if (this.stopWaiter) this.chunks.push(message.chunk);
      return;
    }
    this.chunks.push(message.chunk);
    this.collected += message.chunk.length;
    if (this.collected / this.context.sampleRate >= this.options.maxDurationMs / 1000) {
      void this.finish(true).then((recording) => this.limitListener?.(recording));
    }
  }
}

/** Plays a 16 kHz recording (debug: hear what the STT will receive). */
export function playRecording(context: AudioContext, recording: Recording): AudioBufferSourceNode {
  const buffer = context.createBuffer(1, recording.pcm.length, recording.sampleRate);
  buffer.copyToChannel(recording.pcm as Float32Array<ArrayBuffer>, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return source;
}
