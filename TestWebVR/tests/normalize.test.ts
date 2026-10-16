import { describe, expect, it } from 'vitest';
import { levenshtein, normalizeText, similarity } from '../src/text/normalize';

describe('normalizeText', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeText('¡Buenos DÍAS! ¿En qué puedo ayudarle?')).toBe(
      'buenos dias en que puedo ayudarle',
    );
  });

  it('keeps ñ and ü becomes u', () => {
    expect(normalizeText('Año, pingüino')).toBe('año pinguino');
  });

  it('collapses whitespace', () => {
    expect(normalizeText('  hola \n  qué   tal ')).toBe('hola que tal');
  });
});

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['ticket', 'ticket', 0],
    ['ticket', 'tiket', 1],
    ['factura', 'fractura', 1],
    ['', 'abc', 3],
  ])('%s → %s = %i', (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d);
  });
});

describe('similarity', () => {
  it('is 1 for texts that only differ in accents and punctuation', () => {
    expect(similarity('¿Tiene el tíquet?', 'tiene el tiquet')).toBe(1);
  });

  it('is high for small STT errors and low for different text', () => {
    expect(similarity('tiene el ticket de compra', 'tiene el tiket de compra')).toBeGreaterThan(
      0.9,
    );
    expect(similarity('tiene el ticket de compra', 'buenos dias')).toBeLessThan(0.4);
  });
});
