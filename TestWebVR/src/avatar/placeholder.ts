import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { Emotion, Gesture } from '../app/conversation';
import type { ConversationStatus } from '../app/status';
import type { AvatarController } from './types';

const STATUS_COLOR: Partial<Record<ConversationStatus, number>> = {
  listening: 0xff6b6b,
  transcribing: 0xffc04d,
  thinking: 0xffc04d,
  speaking: 0x4fd18b,
};

/**
 * Fallback avatar (used if the robot model cannot load): a capsule with a head that tints with the state and
 * bobs with the voice level, so the conversation loop can be tested in VR.
 */
export class PlaceholderAvatar implements AvatarController {
  readonly group = new Group();
  private readonly head: Mesh<SphereGeometry, MeshStandardMaterial>;
  private status: ConversationStatus = 'intro';

  constructor(private readonly level: () => number) {
    this.group.name = 'placeholder-avatar';
    const body = new Mesh(
      new CapsuleGeometry(0.22, 0.9, 8, 16),
      new MeshStandardMaterial({ color: 0x8090a8, roughness: 0.8 }),
    );
    body.position.y = 0.72;
    this.head = new Mesh(
      new SphereGeometry(0.14, 24, 16),
      new MeshStandardMaterial({ color: 0xd9b99b, roughness: 0.7 }),
    );
    this.head.position.y = 1.55;
    this.group.add(body, this.head);
  }

  setStatus(status: ConversationStatus): void {
    this.status = status;
    this.head.material.emissive.setHex(STATUS_COLOR[status] ?? 0x000000);
    this.head.material.emissiveIntensity = STATUS_COLOR[status] ? 0.35 : 0;
  }

  setEmotion(_emotion: Emotion): void {}

  playGesture(_gesture: Gesture): void {}

  update(_dt: number, timeMs: number): void {
    const talking = this.status === 'speaking' ? this.level() : 0;
    this.head.position.y = 1.55 + talking * 0.03;
    this.head.rotation.x = Math.sin(timeMs / 180) * talking * 0.15;
  }
}
