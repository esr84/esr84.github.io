/**
 * Characters covered by the bundled Roboto "latin" subset (Spanish included) plus newlines.
 * troika downloads fallback fonts from a CDN for any glyph missing in the given font, which
 * the project forbids, so every string shown in 3D goes through `sanitizeForFont`.
 */
const UNSUPPORTED =
  /[^\n\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u2010-\u2027\u2030-\u205E\u20AC\u2122]/gu;

export function sanitizeForFont(text: string): string {
  return text
    .replace(/\r\n?|\t/g, (m) => (m === '\t' ? ' ' : '\n'))
    .replace(UNSUPPORTED, '')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}
