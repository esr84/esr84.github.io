import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import type { XRContext } from '../xr/context';
import type { Controllers } from '../xr/controllers';
import { ButtonEdgeDetector, XR_BUTTON } from '../xr/buttons';
import { createText, setText } from './font';

const REFRESH_MS = 250;
const WIDTH = 0.2;
const HEIGHT = 0.15;

/**
 * Debug HUD (`?debug=1`) attached to the left controller: state, FPS, latencies, backend...
 * Values are set from anywhere with `hud.set(key, value)`; the text is rebuilt at 4 Hz at most
 * so the layout work does not run every frame. B/Y (or the H key on desktop) toggles it.
 */
export class DebugHud {
  readonly group = new Group();
  /** Billboarded child: always faces the eyes so it is readable however the hand is held. */
  private readonly panel = new Group();
  private readonly eye = new Vector3();
  private readonly values = new Map<string, string>();
  private readonly text;
  private readonly toggleDetectors = [new ButtonEdgeDetector(), new ButtonEdgeDetector()];
  private lastRefresh = 0;

  constructor(
    private readonly ctx: XRContext,
    private readonly controllers: Controllers,
  ) {
    this.group.name = 'debug-hud';
    const background = new Mesh(
      new PlaneGeometry(WIDTH, HEIGHT),
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    background.position.z = -0.001;
    // Transparent objects are sorted by distance; force text over its background.
    background.renderOrder = 10;
    this.text = createText('', { fontSize: 0.011, color: 0x7dff9b, maxWidth: WIDTH - 0.01 });
    this.text.position.set(-WIDTH / 2 + 0.005, HEIGHT / 2 - 0.005, 0);
    this.text.renderOrder = 11;
    this.panel.add(background, this.text);
    this.group.add(this.panel);
    // Floating just above the left controller.
    this.group.position.set(0, 0.13, 0);

    ctx.onFrame((_dt, timeMs) => this.update(timeMs));
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyH' && !(event.target instanceof HTMLInputElement)) this.toggle();
    });
  }

  set(key: string, value: string | number | boolean | null): void {
    const formatted =
      value === null
        ? '-'
        : typeof value === 'number'
          ? String(Math.round(value))
          : typeof value === 'boolean'
            ? value
              ? 'sí'
              : 'no'
            : value;
    this.values.set(key, formatted);
  }

  toggle(): void {
    this.group.visible = !this.group.visible;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  private update(timeMs: number): void {
    this.attachToLeftController();
    this.pollToggle();
    if (this.group.visible) this.faceEyes();
    if (!this.group.visible || timeMs - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = timeMs;
    this.set('FPS', this.ctx.fps.fps);
    this.set('CPU ms/frame', this.ctx.cpuFrameMs().toFixed(1));
    // In stereo every object is drawn once per eye; report per eye to compare with the budget.
    const { renderer } = this.ctx;
    const calls = renderer.info.render.calls;
    this.set('Draw calls/ojo', renderer.xr.isPresenting ? calls / 2 : calls);
    const lines: string[] = [];
    for (const [key, value] of this.values) lines.push(`${key}: ${value}`);
    setText(this.text, lines.join('\n'));
  }

  private faceEyes(): void {
    const { renderer, camera } = this.ctx;
    const eyes = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    eyes.getWorldPosition(this.eye);
    this.panel.lookAt(this.eye);
  }

  private attachToLeftController(): void {
    const parent = this.controllers.left?.grip ?? null;
    if (parent && this.group.parent !== parent) parent.add(this.group);
  }

  private pollToggle(): void {
    this.controllers.all.forEach((handle, i) => {
      const button = handle.inputSource?.gamepad?.buttons[XR_BUTTON.secondary];
      const edge = this.toggleDetectors[i]?.update(button?.pressed ?? false);
      if (edge === 'down') this.toggle();
    });
  }
}
