import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { deviceProfile } from './deviceProfile';
import { FpsMeter } from './fps';

export type FrameCallback = (dtSeconds: number, timeMs: number, frame?: XRFrame) => void;

/** Renderer, scene and frame loop shared by every subsystem. */
export interface XRContext {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly fps: FpsMeter;
  /** Smoothed CPU time (ms) spent in the frame loop: update callbacks + render submission. */
  readonly cpuFrameMs: () => number;
  onFrame(callback: FrameCallback): () => void;
}

export function createXRContext(container: HTMLElement): XRContext {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  const profile = deviceProfile(navigator.userAgent);
  renderer.xr.setFoveation(profile.foveation);
  renderer.xr.setFramebufferScaleFactor(profile.framebufferScale);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x9fb4c7);

  // Standing eye height; in XR the headset pose overrides it.
  const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.set(0, 1.6, 0);
  scene.add(camera);

  // Cheap lighting for Quest: hemisphere + one directional light, no shadows.
  scene.add(new HemisphereLight(0xffffff, 0xb8ab98, 2.2));
  const sun = new DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(1.5, 3, 2);
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const fps = new FpsMeter();
  const callbacks = new Set<FrameCallback>();
  let lastMs: number | null = null;

  renderer.xr.addEventListener('sessionstart', () => fps.reset());
  let cpuMs = 0;
  renderer.setAnimationLoop((timeMs, frame) => {
    const started = performance.now();
    const dt = lastMs === null ? 0 : Math.min((timeMs - lastMs) / 1000, 0.1);
    lastMs = timeMs;
    fps.tick(timeMs);
    for (const cb of callbacks) cb(dt, timeMs, frame);
    renderer.render(scene, camera);
    cpuMs += (performance.now() - started - cpuMs) * 0.05;
  });

  return {
    renderer,
    scene,
    camera,
    fps,
    cpuFrameMs: () => cpuMs,
    onFrame(callback) {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
  };
}
