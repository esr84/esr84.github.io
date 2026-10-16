// Pure avatar behaviour helpers (no Three.js), unit tested.
import type { Emotion, Gesture } from '../app/conversation';
import type { ConversationStatus } from '../app/status';

const DEG = Math.PI / 180;
export const MAX_YAW = 60 * DEG;
export const MAX_PITCH = 30 * DEG;

/**
 * Head angles to look at a point given in the avatar's local space (the avatar faces +Z).
 * Positive yaw turns towards +X, positive pitch looks up. Clamped to a natural range.
 */
export function lookAngles(dx: number, dy: number, dz: number): { yaw: number; pitch: number } {
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return {
    yaw: Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw)),
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)),
  };
}

/** Frame-rate independent exponential smoothing towards a target. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Morph target weights (Angry/Sad/Surprised) for each emotion. */
export function emotionWeights(emotion: Emotion): Record<'Angry' | 'Sad' | 'Surprised', number> {
  switch (emotion) {
    case 'angry':
      return { Angry: 1, Sad: 0, Surprised: 0 };
    case 'annoyed':
      return { Angry: 0.5, Sad: 0.15, Surprised: 0 };
    case 'calm':
      return { Angry: 0, Sad: 0, Surprised: 0 };
    case 'grateful':
      return { Angry: 0, Sad: 0, Surprised: 0.35 };
    case 'neutral':
    default:
      return { Angry: 0, Sad: 0, Surprised: 0 };
  }
}

/** Animation clip of the robot model used for each conversational gesture. */
export const GESTURE_CLIPS: Record<Gesture, string> = {
  yes: 'Yes',
  no: 'No',
  wave: 'Wave',
  point: 'ThumbsUp',
  shrug: 'No',
};

export interface GazePlan {
  /** 0..1 how much the head follows the user. */
  readonly follow: number;
  /** Extra yaw/pitch/roll (radians) added on top of following the user. */
  readonly yawOffset: number;
  readonly pitchOffset: number;
  readonly roll: number;
}

/** Where the avatar looks depending on the conversation state. */
export function gazeFor(status: ConversationStatus, timeMs: number): GazePlan {
  switch (status) {
    case 'listening':
      // Attentive: looks straight at the user with a slight head tilt.
      return { follow: 1, yawOffset: 0, pitchOffset: 0, roll: 8 * DEG };
    case 'transcribing':
    case 'thinking':
      // Looks away and up a little, as if thinking.
      return { follow: 0.4, yawOffset: 20 * DEG, pitchOffset: 10 * DEG, roll: -5 * DEG };
    case 'speaking':
      return { follow: 0.9, yawOffset: 0, pitchOffset: 0, roll: 0 };
    default: {
      // Idle: mostly at the user, with slow small drifts so it does not look frozen.
      const drift = Math.sin(timeMs / 2300) * 6 * DEG;
      return { follow: 0.8, yawOffset: drift, pitchOffset: 0, roll: 0 };
    }
  }
}
