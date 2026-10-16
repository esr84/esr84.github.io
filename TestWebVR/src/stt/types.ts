export type ProgressCallback = (fraction: number) => void;

export type SttModel = 'whisper-tiny' | 'whisper-base';
export type SttDevice = 'wasm' | 'webgpu';

export interface TranscriptionResult {
  readonly text: string;
  /** Inference time in milliseconds (audio in → text out). */
  readonly ms: number;
}

/** Speech-to-text engine (Whisper today; Vosk or a server could implement it later). */
export interface STTProvider {
  readonly name: string;
  readonly model: SttModel;
  readonly device: SttDevice;
  load(onProgress?: ProgressCallback): Promise<void>;
  /** Mono PCM at 16 kHz. */
  transcribe(pcm16k: Float32Array): Promise<TranscriptionResult>;
}
