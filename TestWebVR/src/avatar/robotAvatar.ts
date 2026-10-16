import {
  AnimationMixer,
  Box3,
  LoopOnce,
  Quaternion,
  Vector3,
  type AnimationAction,
  type Bone,
  type Camera,
  type Group,
  type Mesh,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Emotion, Gesture } from '../app/conversation';
import type { ConversationStatus } from '../app/status';
import { asset } from '../util/paths';
import { damp, emotionWeights, GESTURE_CLIPS, gazeFor, lookAngles } from './behaviour';
import type { AvatarController } from './types';

/**
 * Height of the Head bone (the neck pivot). The cartoon head sits above it, which puts the
 * eyes at ~1.5 m: a bit below the user's eyes, like a customer at a counter.
 */
const HEAD_HEIGHT = 1.2;
const MORPHS = ['Angry', 'Sad', 'Surprised'] as const;

/**
 * Placeholder avatar based on the CC0 "RobotExpressive" model: idle loop, gestures, facial
 * expression morphs, gaze that follows the user and a head bob driven by the voice level.
 */
export class RobotAvatar implements AvatarController {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly idle: AnimationAction;
  private current: AnimationAction;
  private readonly head: Bone | null;
  private readonly face: Mesh | null;
  private status: ConversationStatus = 'intro';
  private morphTarget = emotionWeights('neutral');
  private yaw = 0;
  private pitch = 0;
  private roll = 0;
  /** Head pose before the gaze offsets, restored each frame so offsets never accumulate. */
  private readonly headBase = new Quaternion();
  /** How far (m) the model reaches in front of its origin, to keep it behind the counter. */
  readonly frontExtent: number;

  // Reused every frame (no allocations in the render loop).
  private readonly eye = new Vector3();
  private readonly headPos = new Vector3();
  private readonly dir = new Vector3();
  private readonly axis = new Vector3();
  private readonly qInv = new Quaternion();
  private readonly qTmp = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly right = new Vector3(1, 0, 0);
  private readonly forward = new Vector3(0, 0, 1);

  static async load(
    renderer: WebGLRenderer,
    camera: Camera,
    level: () => number,
  ): Promise<RobotAvatar> {
    const gltf = await new GLTFLoader().loadAsync(asset('assets/RobotExpressive.glb'));
    return new RobotAvatar(gltf.scene, gltf.animations, renderer, camera, level);
  }

  private constructor(
    readonly group: Group,
    clips: import('three').AnimationClip[],
    private readonly renderer: WebGLRenderer,
    private readonly camera: Camera,
    private readonly level: () => number,
  ) {
    group.name = 'robot-avatar';
    this.mixer = new AnimationMixer(group);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    const idle = this.actions.get('Idle');
    if (!idle) throw new Error('RobotExpressive has no Idle animation');
    this.idle = idle;
    this.idle.play();
    this.current = this.idle;
    this.mixer.addEventListener('finished', () => this.fadeTo(this.idle, 0.35));

    this.head = (group.getObjectByName('Head') as Bone | undefined) ?? null;

    // Scale from the posed head height (the bind-pose bounding box of this cartoon robot is
    // misleading), then measure how far the posed model reaches in front of its origin.
    this.mixer.update(0);
    group.updateMatrixWorld(true);
    const headY = this.head?.getWorldPosition(new Vector3()).y ?? 0;
    if (headY > 0) group.scale.setScalar(HEAD_HEIGHT / headY);
    group.updateMatrixWorld(true);
    this.frontExtent = Math.max(0, new Box3().setFromObject(group, true).max.z);
    if (this.head) this.headBase.copy(this.head.quaternion);
    let face: Mesh | null = null;
    group.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && 'Angry' in mesh.morphTargetDictionary) {
        face = mesh;
      }
    });
    this.face = face;
  }

  setStatus(status: ConversationStatus): void {
    this.status = status;
  }

  setEmotion(emotion: Emotion): void {
    this.morphTarget = emotionWeights(emotion);
  }

  playGesture(gesture: Gesture): void {
    const action = this.actions.get(GESTURE_CLIPS[gesture]);
    if (!action) return;
    action.reset();
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = false;
    this.fadeTo(action, 0.25);
  }

  update(dt: number, timeMs: number): void {
    // Undo last frame's gaze offsets (the mixer only overwrites bones it animates).
    this.head?.quaternion.copy(this.headBase);
    this.mixer.update(dt);
    if (this.head) this.headBase.copy(this.head.quaternion);
    this.updateFace(dt);
    // Gaze and voice motion are layered on top of the animated head pose.
    this.group.updateMatrixWorld(true);
    this.updateHead(dt, timeMs);
  }

  private fadeTo(next: AnimationAction, seconds: number): void {
    if (next === this.current) return;
    next.enabled = true;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(seconds).play();
    this.current.fadeOut(seconds);
    this.current = next;
  }

  private updateFace(dt: number): void {
    const face = this.face;
    if (!face?.morphTargetDictionary || !face.morphTargetInfluences) return;
    for (const name of MORPHS) {
      const index = face.morphTargetDictionary[name];
      if (index === undefined) continue;
      const value = face.morphTargetInfluences[index] ?? 0;
      face.morphTargetInfluences[index] = damp(value, this.morphTarget[name], 4, dt);
    }
  }

  private updateHead(dt: number, timeMs: number): void {
    const head = this.head;
    const parent = head?.parent;
    if (!head || !parent) return;

    // Target angles in the avatar's own frame (the model faces +Z).
    const eyes = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
    eyes.getWorldPosition(this.eye);
    head.getWorldPosition(this.headPos);
    this.dir.subVectors(this.eye, this.headPos);
    this.group.getWorldQuaternion(this.qInv).invert();
    this.dir.applyQuaternion(this.qInv);
    const look = lookAngles(this.dir.x, this.dir.y, this.dir.z);
    const gaze = gazeFor(this.status, timeMs);
    const talking = this.status === 'speaking' ? this.level() : 0;
    const nod = talking * 0.12 * Math.sin(timeMs / 140);

    this.yaw = damp(this.yaw, look.yaw * gaze.follow + gaze.yawOffset, 5, dt);
    this.pitch = damp(this.pitch, look.pitch * gaze.follow + gaze.pitchOffset + nod, 6, dt);
    this.roll = damp(this.roll, gaze.roll, 3, dt);

    // Rotate the bone about the avatar's up/right/forward axes, expressed in parent space.
    parent.getWorldQuaternion(this.qInv).invert();
    const groupQ = this.group.getWorldQuaternion(this.qTmp);
    this.rotateBone(head, this.up, groupQ, this.yaw);
    this.rotateBone(head, this.right, groupQ, -this.pitch);
    this.rotateBone(head, this.forward, groupQ, this.roll);
  }

  /** Pre-multiplies the bone rotation by `angle` around an avatar-space axis. */
  private rotateBone(bone: Bone, avatarAxis: Vector3, groupQ: Quaternion, angle: number): void {
    if (Math.abs(angle) < 1e-4) return;
    this.axis.copy(avatarAxis).applyQuaternion(groupQ).applyQuaternion(this.qInv).normalize();
    bone.quaternion.premultiply(ROTATION.setFromAxisAngle(this.axis, angle));
  }
}

const ROTATION = new Quaternion();
