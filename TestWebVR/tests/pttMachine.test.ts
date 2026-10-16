import { describe, expect, it } from 'vitest';
import { PttStateMachine } from '../src/xr/pttMachine';

describe('PttStateMachine', () => {
  it('emits start and end for a normal press', () => {
    const m = new PttStateMachine();
    expect(m.press(1000)).toEqual({ type: 'start', timeMs: 1000 });
    expect(m.pressed).toBe(true);
    expect(m.release(2500)).toEqual({ type: 'end', timeMs: 2500, durationMs: 1500 });
    expect(m.pressed).toBe(false);
  });

  it('cancels presses shorter than the minimum duration', () => {
    const m = new PttStateMachine();
    m.press(0);
    expect(m.release(299)).toMatchObject({ type: 'cancel', reason: 'too-short', durationMs: 299 });
  });

  it('accepts a press exactly at the minimum duration', () => {
    const m = new PttStateMachine();
    m.press(0);
    expect(m.release(300)?.type).toBe('end');
  });

  it('ignores a second press while pressed (double press)', () => {
    const m = new PttStateMachine();
    m.press(0);
    expect(m.press(50)).toBeNull();
    expect(m.release(1000)?.type).toBe('end');
  });

  it('ignores release without press', () => {
    const m = new PttStateMachine();
    expect(m.release(10)).toBeNull();
  });

  it('debounces a press right after a release', () => {
    const m = new PttStateMachine({ minDurationMs: 300, debounceMs: 120 });
    m.press(0);
    m.release(1000);
    expect(m.press(1050)).toBeNull();
    expect(m.release(1100)).toBeNull();
    expect(m.press(1200)?.type).toBe('start');
  });

  it('interrupts an ongoing press', () => {
    const m = new PttStateMachine();
    m.press(0);
    expect(m.interrupt(5000)).toMatchObject({ type: 'cancel', reason: 'interrupted' });
    expect(m.interrupt(6000)).toBeNull();
    expect(m.pressed).toBe(false);
  });
});
