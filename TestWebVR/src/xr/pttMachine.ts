export type PttEvent =
  | { readonly type: 'start'; readonly timeMs: number }
  | { readonly type: 'end'; readonly timeMs: number; readonly durationMs: number }
  | {
      readonly type: 'cancel';
      readonly timeMs: number;
      readonly durationMs: number;
      readonly reason: 'too-short' | 'interrupted';
    };

export interface PttOptions {
  /** Shorter presses are treated as accidental and cancelled. */
  readonly minDurationMs: number;
  /** Presses this soon after a release are ignored (contact bounce, double taps). */
  readonly debounceMs: number;
}

export const DEFAULT_PTT_OPTIONS: PttOptions = { minDurationMs: 300, debounceMs: 120 };

/**
 * Push-to-talk state machine: idle → pressed → idle. Pure (timestamps are passed in) so it
 * can be unit tested; the input bindings live in `ptt.ts`.
 */
export class PttStateMachine {
  private pressedAt: number | null = null;
  private releasedAt = -Infinity;

  constructor(private readonly options: PttOptions = DEFAULT_PTT_OPTIONS) {}

  get pressed(): boolean {
    return this.pressedAt !== null;
  }

  press(timeMs: number): PttEvent | null {
    if (this.pressedAt !== null) return null;
    if (timeMs - this.releasedAt < this.options.debounceMs) return null;
    this.pressedAt = timeMs;
    return { type: 'start', timeMs };
  }

  release(timeMs: number): PttEvent | null {
    if (this.pressedAt === null) return null;
    const durationMs = timeMs - this.pressedAt;
    this.pressedAt = null;
    this.releasedAt = timeMs;
    if (durationMs < this.options.minDurationMs) {
      return { type: 'cancel', timeMs, durationMs, reason: 'too-short' };
    }
    return { type: 'end', timeMs, durationMs };
  }

  /** Aborts an ongoing press (window blur, XR session ended...). */
  interrupt(timeMs: number): PttEvent | null {
    if (this.pressedAt === null) return null;
    const durationMs = timeMs - this.pressedAt;
    this.pressedAt = null;
    this.releasedAt = timeMs;
    return { type: 'cancel', timeMs, durationMs, reason: 'interrupted' };
  }
}
