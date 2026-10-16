import { describe, expect, it } from 'vitest';
import { SessionLog } from '../src/debug/sessionLog';

const info = {
  startedAt: '2026-10-16T10:00:00.000Z',
  userAgent: 'test',
  sttModel: 'whisper-base',
  sttDevice: 'wasm',
  voice: 'Piper',
  capabilities: { webgpu: false },
};

const turn = (sttMs: number | null, totalMs: number | null) => ({
  userText: 'hola',
  avatarText: 'Has dicho: hola',
  sttMs,
  ttsMs: 200,
  totalMs,
  audioSeconds: 1,
  interrupted: false,
});

describe('SessionLog', () => {
  it('timestamps turns relative to the session start', () => {
    let now = 1000;
    const log = new SessionLog(info, () => now);
    now = 3500;
    expect(log.add(turn(500, 900)).t).toBe(2.5);
  });

  it('averages latencies ignoring missing values', () => {
    const log = new SessionLog(info, () => 0);
    log.add(turn(400, 1000));
    log.add(turn(null, null));
    log.add(turn(600, 2000));
    expect(log.average('sttMs')).toBe(500);
    expect(log.average('totalMs')).toBe(1500);
    expect(log.average('ttsMs')).toBe(200);
  });

  it('serialises session info, turns and averages', () => {
    const log = new SessionLog(info, () => 0);
    log.add(turn(500, 900));
    log.markLastInterrupted();
    const json = JSON.parse(JSON.stringify(log));
    expect(json.sttModel).toBe('whisper-base');
    expect(json.turns).toHaveLength(1);
    expect(json.turns[0].interrupted).toBe(true);
    expect(json.averages.sttMs).toBe(500);
  });
});
