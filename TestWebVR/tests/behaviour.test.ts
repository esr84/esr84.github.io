import { describe, expect, it } from 'vitest';
import {
  damp,
  emotionWeights,
  GESTURE_CLIPS,
  gazeFor,
  lookAngles,
  MAX_PITCH,
  MAX_YAW,
} from '../src/avatar/behaviour';

const DEG = Math.PI / 180;

describe('lookAngles', () => {
  it('is zero for a target straight ahead', () => {
    const { yaw, pitch } = lookAngles(0, 0, 2);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });

  it('turns towards +X and looks up for a higher target', () => {
    const { yaw, pitch } = lookAngles(1, 1, 1);
    expect(yaw).toBeCloseTo(45 * DEG);
    expect(pitch).toBeGreaterThan(0);
  });

  it('clamps to a natural range when the user walks behind', () => {
    expect(lookAngles(-1, 0, -1).yaw).toBe(-MAX_YAW);
    expect(lookAngles(0, 5, 0.1).pitch).toBe(MAX_PITCH);
    expect(lookAngles(0, -5, 0.1).pitch).toBe(-MAX_PITCH);
  });
});

describe('damp', () => {
  it('moves towards the target without overshooting', () => {
    const v = damp(0, 1, 5, 0.1);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 2; i++) a = damp(a, 1, 5, 0.05);
    expect(a).toBeCloseTo(damp(0, 1, 5, 0.1), 10);
  });
});

describe('emotion and gestures', () => {
  it('maps anger to the Angry morph', () => {
    expect(emotionWeights('angry').Angry).toBe(1);
    expect(emotionWeights('annoyed').Angry).toBeGreaterThan(0);
    expect(emotionWeights('calm').Angry).toBe(0);
  });

  it('has a clip for every gesture', () => {
    for (const clip of Object.values(GESTURE_CLIPS)) {
      expect(['Yes', 'No', 'Wave', 'ThumbsUp']).toContain(clip);
    }
  });
});

describe('gazeFor', () => {
  it('looks straight at the user while listening and away while thinking', () => {
    expect(gazeFor('listening', 0).follow).toBe(1);
    expect(gazeFor('thinking', 0).follow).toBeLessThan(0.5);
    expect(Math.abs(gazeFor('thinking', 0).yawOffset)).toBeGreaterThan(0);
  });
});
