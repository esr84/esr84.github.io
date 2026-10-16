/**
 * Text normalisation shared by the scenario matcher and the STT tests: lowercase, no accents
 * (ñ is kept, it changes meaning: "año" / "ano"), no punctuation, single spaces.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .split('ñ')
    .map((part) => part.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .join('ñ')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein edit distance (insert, delete, substitute = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** 0..1 similarity of two texts after normalisation (1 = identical). */
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  const longest = Math.max(na.length, nb.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(na, nb) / longest;
}
