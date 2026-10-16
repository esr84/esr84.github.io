/**
 * Frame-rate meter based on an exponential moving average of frame times.
 * Pure: the caller passes timestamps, so it is testable and allocation-free per frame.
 */
export class FpsMeter {
  private lastMs: number | null = null;
  private avgFrameMs = 0;

  constructor(private readonly smoothing = 0.05) {}

  tick(nowMs: number): void {
    if (this.lastMs !== null) {
      const dt = nowMs - this.lastMs;
      // Ignore pauses (tab hidden, session start) so they do not drag the average down.
      if (dt > 0 && dt < 1000) {
        this.avgFrameMs =
          this.avgFrameMs === 0 ? dt : this.avgFrameMs + (dt - this.avgFrameMs) * this.smoothing;
      }
    }
    this.lastMs = nowMs;
  }

  get fps(): number {
    return this.avgFrameMs > 0 ? 1000 / this.avgFrameMs : 0;
  }

  reset(): void {
    this.lastMs = null;
    this.avgFrameMs = 0;
  }
}
