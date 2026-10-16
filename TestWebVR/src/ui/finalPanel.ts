import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Raycaster,
} from 'three';
import type { ConversationSummary } from '../app/summary';
import { createText, setText } from './font';

const WIDTH = 1.1;
const HEIGHT = 0.8;
const PAD = 0.04;
const SPARK = { w: 0.42, h: 0.12 };

export interface PanelButton {
  readonly id: string;
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly action: () => void;
}

export interface FinalPanelOptions {
  readonly onRestart: () => void;
  /** Only in debug mode. */
  readonly onDownloadLog?: () => void;
}

/**
 * End-of-conversation panel: outcome, number of turns, anger curve, good practices and
 * mistakes detected, tips, and buttons to repeat (and to download the log in debug).
 */
export class FinalPanel {
  readonly group = new Group();
  readonly buttons: PanelButton[] = [];
  private readonly buttonMeshes: Mesh[] = [];
  private readonly title;
  private readonly stats;
  private readonly good;
  private readonly bad;
  private readonly tips;
  private readonly spark: Line<BufferGeometry, LineBasicMaterial>;
  private hovered: PanelButton | null = null;

  constructor(options: FinalPanelOptions) {
    this.group.name = 'final-panel';
    this.group.visible = false;
    const background = new Mesh(
      new PlaneGeometry(WIDTH, HEIGHT),
      new MeshBasicMaterial({
        color: 0x14161b,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    );
    background.renderOrder = 20;
    this.group.add(background);

    const left = -WIDTH / 2 + PAD;
    const top = HEIGHT / 2 - PAD;
    const column = (WIDTH - PAD * 3) / 2;
    const add = <T extends Mesh>(item: T, x: number, y: number): T => {
      item.position.set(x, y, 0.001);
      item.renderOrder = 21;
      this.group.add(item);
      return item;
    };

    this.title = add(
      createText('', { fontSize: 0.045, bold: true, maxWidth: WIDTH - PAD * 2 }),
      left,
      top,
    );
    this.stats = add(createText('', { fontSize: 0.026, color: 0xb9c3d0 }), left, top - 0.075);

    // Anger sparkline (0 at the bottom, 10 at the top) with a faint frame.
    const frame = new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 0),
        new Vector3(SPARK.w, 0, 0),
        new Vector3(SPARK.w, SPARK.h, 0),
        new Vector3(0, SPARK.h, 0),
        new Vector3(0, 0, 0),
      ]),
      new LineBasicMaterial({ color: 0x3a3f49 }),
    );
    this.spark = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xff7a59 }));
    const sparkGroup = new Group();
    sparkGroup.position.set(WIDTH / 2 - PAD - SPARK.w, top - 0.14, 0.001);
    sparkGroup.add(frame, this.spark);
    this.group.add(sparkGroup);
    add(
      createText('Enfado', { fontSize: 0.02, color: 0x8892a0 }),
      WIDTH / 2 - PAD - SPARK.w,
      top - 0.005,
    );

    this.good = add(
      createText('', { fontSize: 0.024, color: 0x7ee2a8, maxWidth: column }),
      left,
      top - 0.18,
    );
    this.bad = add(
      createText('', { fontSize: 0.024, color: 0xffb27a, maxWidth: column }),
      left + column + PAD,
      top - 0.18,
    );
    this.tips = add(
      createText('', { fontSize: 0.022, color: 0xdde3ea, maxWidth: WIDTH - PAD * 2 }),
      left,
      -0.12,
    );

    const buttons: Array<[string, string, () => void]> = [
      ['restart', 'Repetir', options.onRestart],
    ];
    if (options.onDownloadLog) buttons.push(['log', 'Descargar log', options.onDownloadLog]);
    const bw = 0.26;
    const gap = 0.04;
    const total = buttons.length * bw + (buttons.length - 1) * gap;
    buttons.forEach(([id, label, action], i) => {
      const mesh = new Mesh(
        new PlaneGeometry(bw, 0.075),
        // Transparent so it is sorted (renderOrder) after the translucent background.
        new MeshBasicMaterial({ color: 0x2f6fed, transparent: true, depthWrite: false }),
      );
      mesh.name = `button-${id}`;
      mesh.renderOrder = 21;
      mesh.position.set(-total / 2 + bw / 2 + i * (bw + gap), -HEIGHT / 2 + PAD + 0.04, 0.002);
      const text = createText(label, {
        fontSize: 0.03,
        bold: true,
        anchorX: 'center',
        anchorY: 'middle',
        textAlign: 'center',
      });
      text.position.z = 0.001;
      text.renderOrder = 22;
      mesh.add(text);
      this.group.add(mesh);
      this.buttons.push({ id, mesh, action });
      this.buttonMeshes.push(mesh);
    });
  }

  get visible(): boolean {
    return this.group.visible;
  }

  show(summary: ConversationSummary): void {
    setText(this.title, summary.headline);
    const first = summary.angerCurve[0] ?? 0;
    const last = summary.angerCurve.at(-1) ?? first;
    setText(this.stats, `Turnos: ${summary.turns}   ·   Enfado: de ${first} a ${last} (máximo 10)`);
    const list = (items: readonly string[], empty: string) =>
      items.length > 0 ? items.map((item) => `· ${item}`).join('\n') : empty;
    setText(this.good, `Lo que ha funcionado:\n${list(summary.positives, '· (nada destacable)')}`);
    setText(this.bad, `A mejorar:\n${list(summary.negatives, '· ¡Ningún error claro!')}`);
    setText(this.tips, summary.tips.length > 0 ? `Consejos:\n${list(summary.tips, '')}` : '');

    const n = summary.angerCurve.length;
    const points = summary.angerCurve.map(
      (anger, i) =>
        new Vector3(n > 1 ? (i / (n - 1)) * SPARK.w : 0, (Math.min(10, anger) / 10) * SPARK.h, 0),
    );
    this.spark.geometry.setFromPoints(
      points.length > 1 ? points : [points[0] ?? new Vector3(), points[0] ?? new Vector3()],
    );
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
    this.setHovered(null);
  }

  /** The button under the ray, if any. */
  pick(raycaster: Raycaster): PanelButton | null {
    if (!this.group.visible) return null;
    const hits = raycaster.intersectObjects(this.buttonMeshes, false);
    const hit = hits[0]?.object;
    return this.buttons.find((b) => b.mesh === hit) ?? null;
  }

  setHovered(button: PanelButton | null): void {
    if (button === this.hovered) return;
    this.hovered?.mesh.material.color.setHex(0x2f6fed);
    button?.mesh.material.color.setHex(0x5b8ff5);
    this.hovered = button;
  }
}
