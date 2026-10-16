import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  type XRGripSpace,
  type XRTargetRaySpace,
} from 'three';
import type { XRContext } from './context';

export interface ControllerHandle {
  /** Target ray space: where the controller points (used for the ray and selection). */
  readonly ray: XRTargetRaySpace;
  /** Grip space: where the hand holds the controller (used for the visual model). */
  readonly grip: XRGripSpace;
  handedness: XRHandedness | null;
  inputSource: XRInputSource | null;
}

export interface Controllers {
  readonly left: ControllerHandle | null;
  readonly right: ControllerHandle | null;
  readonly all: readonly ControllerHandle[];
}

/**
 * Simple procedural controller model. Three's XRControllerModelFactory downloads the
 * models from a CDN at runtime, which the project constraints forbid.
 */
function createControllerModel(): Group {
  const model = new Group();
  const body = new Mesh(
    new CylinderGeometry(0.018, 0.022, 0.11, 16),
    new MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6 }),
  );
  body.rotation.x = Math.PI / 2 - 0.5;
  body.position.set(0, -0.01, 0.03);
  const trigger = new Mesh(
    new BoxGeometry(0.012, 0.02, 0.02),
    new MeshStandardMaterial({ color: 0x4f8cff, roughness: 0.4 }),
  );
  trigger.name = 'trigger';
  trigger.position.set(0, -0.02, -0.02);
  model.add(body, trigger);
  return model;
}

function createRay(): Line {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
  const ray = new Line(
    geometry,
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
  );
  ray.name = 'ray';
  ray.scale.z = 2;
  ray.visible = false;
  return ray;
}

export function setupControllers(ctx: XRContext): Controllers {
  const handles: ControllerHandle[] = [];

  for (let i = 0; i < 2; i++) {
    const ray = ctx.renderer.xr.getController(i);
    const grip = ctx.renderer.xr.getControllerGrip(i);
    grip.add(createControllerModel());
    const pointer = createRay();
    ray.add(pointer);
    ctx.scene.add(ray, grip);

    const handle: ControllerHandle = { ray, grip, handedness: null, inputSource: null };
    ray.addEventListener('connected', (event) => {
      const source = event.data;
      handle.inputSource = source;
      handle.handedness = source.handedness;
      // Only the right controller points: it is the one used for push-to-talk and menus.
      pointer.visible = source.handedness === 'right';
    });
    ray.addEventListener('disconnected', () => {
      handle.inputSource = null;
      handle.handedness = null;
      pointer.visible = false;
    });
    handles.push(handle);
  }

  return {
    get left() {
      return handles.find((h) => h.handedness === 'left') ?? null;
    },
    get right() {
      return handles.find((h) => h.handedness === 'right') ?? null;
    },
    all: handles,
  };
}
