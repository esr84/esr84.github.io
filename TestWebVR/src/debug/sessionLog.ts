export interface TurnRecord {
  /** Seconds since the session started. */
  readonly t: number;
  readonly userText: string;
  readonly avatarText: string;
  /** null in text mode (no speech recognition). */
  readonly sttMs: number | null;
  readonly ttsMs: number | null;
  /** From push-to-talk release (or text submit) until the avatar starts talking. */
  readonly totalMs: number | null;
  readonly audioSeconds: number | null;
  /** The user cut the avatar off while it was saying this line. */
  interrupted: boolean;
  /** Free-form extras: scenario node, intent, anger... (T16). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface SessionInfo {
  readonly startedAt: string;
  readonly userAgent: string;
  readonly sttModel: string | null;
  readonly sttDevice: string | null;
  readonly voice: string | null;
  readonly capabilities: Readonly<Record<string, unknown>>;
}

/** In-memory log of a session, exported as JSON from the debug HUD for the device checks. */
export class SessionLog {
  private readonly turns: TurnRecord[] = [];
  private readonly started: number;

  constructor(
    private readonly info: SessionInfo,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.started = now();
  }

  add(turn: Omit<TurnRecord, 't'>): TurnRecord {
    const record = { t: Math.round((this.now() - this.started) / 100) / 10, ...turn };
    this.turns.push(record);
    return record;
  }

  markLastInterrupted(): void {
    const last = this.turns.at(-1);
    if (last) last.interrupted = true;
  }

  get length(): number {
    return this.turns.length;
  }

  get last(): TurnRecord | undefined {
    return this.turns.at(-1);
  }

  /** Average of a latency field over the turns that have it. */
  average(field: 'sttMs' | 'ttsMs' | 'totalMs'): number | null {
    const values = this.turns.map((t) => t[field]).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  toJSON() {
    return {
      ...this.info,
      turns: this.turns,
      averages: {
        sttMs: this.average('sttMs'),
        ttsMs: this.average('ttsMs'),
        totalMs: this.average('totalMs'),
      },
    };
  }
}

/** Saves the log as a JSON file (debug HUD / keyboard shortcut). */
export function downloadSessionLog(log: SessionLog): void {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `testwebvr-sesion-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
