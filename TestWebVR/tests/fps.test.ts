import { describe, expect, it } from 'vitest';
import { FpsMeter } from '../src/xr/fps';

describe('FpsMeter', () => {
  it('reports 0 before two frames', () => {
    const meter = new FpsMeter();
    expect(meter.fps).toBe(0);
    meter.tick(0);
    expect(meter.fps).toBe(0);
  });

  it('converges to the frame rate', () => {
    const meter = new FpsMeter(0.2);
    for (let i = 0; i <= 200; i++) meter.tick(i * (1000 / 72));
    expect(meter.fps).toBeCloseTo(72, 1);
  });

  it('ignores long pauses', () => {
    const meter = new FpsMeter(1);
    meter.tick(0);
    meter.tick(11.1);
    meter.tick(5000);
    expect(meter.fps).toBeCloseTo(1000 / 11.1, 1);
  });

  it('resets', () => {
    const meter = new FpsMeter();
    meter.tick(0);
    meter.tick(16);
    meter.reset();
    expect(meter.fps).toBe(0);
  });
});
