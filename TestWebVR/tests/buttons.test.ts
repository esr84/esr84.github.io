import { describe, expect, it } from 'vitest';
import { ButtonEdgeDetector } from '../src/xr/buttons';

describe('ButtonEdgeDetector', () => {
  it('reports edges only on changes', () => {
    const d = new ButtonEdgeDetector();
    expect([false, true, true, false, false, true].map((p) => d.update(p))).toEqual([
      null,
      'down',
      null,
      'up',
      null,
      'down',
    ]);
  });

  it('resets to released', () => {
    const d = new ButtonEdgeDetector();
    d.update(true);
    d.reset();
    expect(d.update(true)).toBe('down');
  });
});
