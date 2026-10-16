import { Text } from 'troika-three-text';
import { asset } from '../util/paths';
import { sanitizeForFont } from './textSanitize';

export const FONT_REGULAR = asset('fonts/roboto-latin-400-normal.woff');
export const FONT_BOLD = asset('fonts/roboto-latin-700-normal.woff');

export interface TextOptions {
  readonly fontSize: number;
  readonly color?: number | string;
  readonly maxWidth?: number;
  readonly bold?: boolean;
  readonly anchorX?: Text['anchorX'];
  readonly anchorY?: Text['anchorY'];
  readonly textAlign?: Text['textAlign'];
}

export function createText(content: string, options: TextOptions): Text {
  const text = new Text();
  text.font = options.bold ? FONT_BOLD : FONT_REGULAR;
  text.fontSize = options.fontSize;
  text.color = options.color ?? 0xffffff;
  text.maxWidth = options.maxWidth ?? Infinity;
  text.anchorX = options.anchorX ?? 'left';
  text.anchorY = options.anchorY ?? 'top';
  text.textAlign = options.textAlign ?? 'left';
  text.lineHeight = 1.25;
  setText(text, content);
  return text;
}

/** Sets sanitized text and re-layouts only when it actually changed. */
export function setText(text: Text, content: string): void {
  const clean = sanitizeForFont(content);
  if (text.text === clean) return;
  text.text = clean;
  text.sync();
}
