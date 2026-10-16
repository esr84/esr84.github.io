// AudioWorklet processor: while recording, forwards channel 0 to the main thread in ~85 ms
// batches (4096 samples at 48 kHz) to keep postMessage overhead low.

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const BATCH = 4096;

class RecorderProcessor extends AudioWorkletProcessor {
  private recording = false;
  private buffer = new Float32Array(BATCH);
  private filled = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<{ cmd: 'start' | 'stop' }>) => {
      if (event.data.cmd === 'start') {
        this.filled = 0;
        this.recording = true;
      } else {
        this.flush();
        this.recording = false;
        this.port.postMessage({ type: 'stopped', sampleRate });
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!this.recording || !channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, BATCH - this.filled);
      this.buffer.set(channel.subarray(offset, offset + count), this.filled);
      this.filled += count;
      offset += count;
      if (this.filled === BATCH) this.flush();
    }
    return true;
  }

  private flush(): void {
    if (this.filled === 0) return;
    const chunk = this.buffer.slice(0, this.filled);
    this.port.postMessage({ type: 'chunk', chunk }, [chunk.buffer]);
    this.filled = 0;
  }
}

registerProcessor('recorder', RecorderProcessor);
