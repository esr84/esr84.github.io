import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type ColorRepresentation,
} from 'three';
import { STATUS_COLORS, STATUS_LABELS, type ConversationStatus } from '../app/status';
import { createText, setText } from './font';

const WIDTH = 1.0;
const HEIGHT = 0.34;
const PADDING = 0.035;

/**
 * Floating panel under the avatar: conversation status plus the last line said by the user
 * ("Tú: …", grey) and by the avatar ("Javier: …", white). It lets testers see whether a
 * failure comes from the speech recognition or from the scenario.
 */
export class SubtitlePanel {
  readonly group = new Group();
  private readonly statusDot: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly statusText;
  private readonly userText;
  private readonly avatarText;

  constructor() {
    this.group.name = 'subtitles';
    const background = new Mesh(
      new PlaneGeometry(WIDTH, HEIGHT),
      new MeshBasicMaterial({
        color: 0x14161b,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );
    // Transparent objects are sorted by distance; force the texts over their background.
    background.renderOrder = 10;
    this.group.add(background);

    const left = -WIDTH / 2 + PADDING;
    const top = HEIGHT / 2 - PADDING;
    const textWidth = WIDTH - PADDING * 2;

    this.statusDot = new Mesh(new CircleGeometry(0.012, 16), new MeshBasicMaterial());
    this.statusDot.position.set(left + 0.012, top - 0.014, 0.001);
    this.statusText = createText('', { fontSize: 0.026, color: 0xb9c3d0 });
    this.statusText.position.set(left + 0.035, top, 0.001);

    this.userText = createText('', { fontSize: 0.032, color: 0x9aa4b2, maxWidth: textWidth });
    this.userText.position.set(left, top - 0.055, 0.001);

    this.avatarText = createText('', { fontSize: 0.036, color: 0xffffff, maxWidth: textWidth });
    this.avatarText.position.set(left, top - 0.15, 0.001);

    for (const item of [this.statusDot, this.statusText, this.userText, this.avatarText]) {
      item.renderOrder = 11;
    }
    this.group.add(this.statusDot, this.statusText, this.userText, this.avatarText);
    this.setStatus('intro');
  }

  setStatus(status: ConversationStatus): void {
    this.statusDot.material.color.setHex(STATUS_COLORS[status]);
    setText(this.statusText, STATUS_LABELS[status]);
  }

  setUser(text: string): void {
    setText(this.userText, text ? `Tú: ${text}` : '');
  }

  setAvatar(name: string, text: string): void {
    setText(this.avatarText, text ? `${name}: ${text}` : '');
  }

  setAvatarColor(color: ColorRepresentation): void {
    this.avatarText.color = color;
  }

  clear(): void {
    this.setUser('');
    this.setAvatar('', '');
  }
}
