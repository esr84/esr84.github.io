import { describe, expect, it } from 'vitest';
import { sanitizeForFont } from '../src/ui/textSanitize';

describe('sanitizeForFont', () => {
  it('keeps Spanish characters and punctuation', () => {
    const text = '¡Señor! ¿Qué tal? Pingüino, acción… — 10 €';
    expect(sanitizeForFont(text)).toBe(text);
  });

  it('removes glyphs that would trigger a CDN font fallback', () => {
    expect(sanitizeForFont('Hola 😀 你好 ✓')).toBe('Hola');
  });

  it('keeps inner newlines but trims and normalises whitespace', () => {
    expect(sanitizeForFont('\n  Línea 1\r\nLínea\t2  ')).toBe('Línea 1\nLínea 2');
  });
});
