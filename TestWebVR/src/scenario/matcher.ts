import { levenshtein, normalizeText } from '../text/normalize';

/** Words that flip the meaning of what follows ("no entiendo", "nunca le he dicho..."). */
const NEGATIONS = new Set(['no', 'nunca', 'ni', 'tampoco', 'jamas']);
/** How many words before a match are checked for a negation. */
const NEGATION_WINDOW = 2;

export interface MatchResult {
  /** Higher is a more specific/confident match. 0 = no match. */
  readonly score: number;
  readonly keyword: string | null;
}

/** Edit distance allowed for a word, depending on its length (STT typos). */
function tolerance(word: string): number {
  if (word.length >= 9) return 2;
  if (word.length >= 5) return 1;
  return 0;
}

function wordsMatch(expected: string, heard: string): 'exact' | 'fuzzy' | null {
  if (expected === heard) return 'exact';
  const tol = tolerance(expected);
  if (tol === 0) return null;
  // Cheap reject before computing the distance. Bigger rewrites by the STT ("tiquete" for
  // "ticket") are not typos: list them as extra keywords in the scenario instead.
  if (Math.abs(expected.length - heard.length) > tol) return null;
  return levenshtein(expected, heard) <= tol ? 'fuzzy' : null;
}

/**
 * Finds `phrase` (already normalised, one or more words) in `words` as consecutive words.
 * Returns the match quality, or null. Skips matches preceded by a negation unless the phrase
 * itself contains one ("no se preocupe" is a phrase on its own).
 */
function findPhrase(words: readonly string[], phrase: readonly string[]): number | null {
  const phraseHasNegation = phrase.some((w) => NEGATIONS.has(w));
  let best: number | null = null;
  for (let start = 0; start + phrase.length <= words.length; start++) {
    let quality = 0;
    let ok = true;
    for (let k = 0; k < phrase.length; k++) {
      const m = wordsMatch(phrase[k] ?? '', words[start + k] ?? '');
      if (!m) {
        ok = false;
        break;
      }
      quality += m === 'exact' ? 1 : 0.8;
    }
    if (!ok) continue;
    if (!phraseHasNegation) {
      const before = words.slice(Math.max(0, start - NEGATION_WINDOW), start);
      if (before.some((w) => NEGATIONS.has(w))) continue;
    }
    best = Math.max(best ?? 0, quality);
  }
  return best;
}

/**
 * Scores how well `text` expresses one of `keywords`. Longer phrases are more specific, so
 * the score is the summed quality of the matched words of the best keyword.
 */
export function matchKeywords(text: string, keywords: readonly string[]): MatchResult {
  const words = normalizeText(text).split(' ').filter(Boolean);
  let best: MatchResult = { score: 0, keyword: null };
  for (const keyword of keywords) {
    const phrase = normalizeText(keyword).split(' ').filter(Boolean);
    if (phrase.length === 0) continue;
    const quality = findPhrase(words, phrase);
    if (quality !== null && quality > best.score) best = { score: quality, keyword };
  }
  return best;
}
