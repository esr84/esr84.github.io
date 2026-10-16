/** Indices of the xr-standard gamepad mapping used by Quest Touch controllers. */
export const XR_BUTTON = {
  trigger: 0,
  squeeze: 1,
  thumbstick: 3,
  /** A on the right controller, X on the left one. */
  primary: 4,
  /** B on the right controller, Y on the left one. */
  secondary: 5,
} as const;

export type ButtonEdge = 'down' | 'up' | null;

/** Turns a polled pressed/not-pressed value into press and release edges. */
export class ButtonEdgeDetector {
  private pressed = false;

  update(pressedNow: boolean): ButtonEdge {
    if (pressedNow === this.pressed) return null;
    this.pressed = pressedNow;
    return pressedNow ? 'down' : 'up';
  }

  reset(): void {
    this.pressed = false;
  }
}
