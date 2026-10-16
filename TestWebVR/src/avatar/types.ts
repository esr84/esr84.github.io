import type { Object3D } from 'three';
import type { Emotion, Gesture } from '../app/conversation';
import type { ConversationStatus } from '../app/status';

/**
 * What the conversation needs from an avatar, independent of the 3D model. The robot
 * placeholder and a future human avatar both implement it.
 */
export interface AvatarController {
  readonly group: Object3D;
  setStatus(status: ConversationStatus): void;
  setEmotion(emotion: Emotion): void;
  playGesture(gesture: Gesture): void;
  /** Called every frame. */
  update(dtSeconds: number, timeMs: number): void;
}
