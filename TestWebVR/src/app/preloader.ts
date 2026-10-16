export type ProgressCallback = (fraction: number) => void;

export interface PreloadTask {
  /** Visible label, e.g. "Voz del cliente". */
  readonly label: string;
  /** Relative cost used to weight the global progress (e.g. MB to download). */
  readonly weight: number;
  run(onProgress: ProgressCallback): Promise<void>;
}

export interface PreloadProgress {
  /** 0..1 across all tasks, weighted. */
  readonly total: number;
  readonly label: string;
}

/** Runs the loading tasks one after another and reports weighted global progress. */
export class Preloader {
  private readonly tasks: PreloadTask[] = [];

  add(task: PreloadTask): this {
    this.tasks.push(task);
    return this;
  }

  get size(): number {
    return this.tasks.length;
  }

  async run(onProgress: (progress: PreloadProgress) => void): Promise<void> {
    const totalWeight = this.tasks.reduce((sum, t) => sum + Math.max(t.weight, 0), 0) || 1;
    let done = 0;
    for (const task of this.tasks) {
      const weight = Math.max(task.weight, 0);
      const report = (fraction: number) => {
        const clamped = Math.min(Math.max(fraction, 0), 1);
        onProgress({ total: (done + weight * clamped) / totalWeight, label: task.label });
      };
      report(0);
      await task.run(report);
      report(1);
      done += weight;
    }
    onProgress({ total: 1, label: 'Listo' });
  }
}

/** Placeholder task until the real STT/TTS loaders exist (T08/T09). */
export function delayTask(label: string, ms: number, weight = 1): PreloadTask {
  return {
    label,
    weight,
    run(onProgress) {
      return new Promise((resolve) => {
        const start = performance.now();
        const step = () => {
          const fraction = (performance.now() - start) / ms;
          onProgress(fraction);
          if (fraction >= 1) resolve();
          else setTimeout(step, 50);
        };
        step();
      });
    },
  };
}
