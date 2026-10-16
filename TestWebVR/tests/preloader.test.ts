import { describe, expect, it } from 'vitest';
import { Preloader, type PreloadProgress, type PreloadTask } from '../src/app/preloader';

function task(label: string, weight: number, steps: number[]): PreloadTask {
  return {
    label,
    weight,
    async run(onProgress) {
      for (const s of steps) onProgress(s);
    },
  };
}

describe('Preloader', () => {
  it('weights progress across tasks and ends at 1', async () => {
    const seen: PreloadProgress[] = [];
    await new Preloader()
      .add(task('a', 1, [0.5]))
      .add(task('b', 3, [0.5]))
      .run((p) => seen.push(p));

    const totals = seen.map((p) => Number(p.total.toFixed(3)));
    expect(totals).toContain(0.125); // half of a (1/4 of the weight)
    expect(totals).toContain(0.625); // a done + half of b
    expect(seen.at(-1)).toEqual({ total: 1, label: 'Listo' });
  });

  it('never goes backwards and clamps out-of-range fractions', async () => {
    const totals: number[] = [];
    await new Preloader()
      .add(task('a', 1, [-1, 0.3, 2]))
      .add(task('b', 1, [0.2]))
      .run((p) => totals.push(p.total));
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1] ?? 0);
    }
    expect(Math.max(...totals)).toBe(1);
  });

  it('completes with no tasks', async () => {
    const seen: PreloadProgress[] = [];
    await new Preloader().run((p) => seen.push(p));
    expect(seen).toEqual([{ total: 1, label: 'Listo' }]);
  });
});
