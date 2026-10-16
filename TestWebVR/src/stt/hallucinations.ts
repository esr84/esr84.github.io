import { normalizeText } from '../text/normalize';

/**
 * Phrases Whisper "hears" in silence or noise: it was trained on subtitled videos, so it
 * fills gaps with credits, thanks and sound tags. A transcript made only of these is
 * treated as "nothing was said". Bare "gracias" is kept on purpose: the user may really say
 * it, and silent recordings never reach the STT (they are dropped by input level first).
 */
const HALLUCINATIONS = [
  'subtitulos realizados por la comunidad de amara org',
  'subtitulos por la comunidad de amara org',
  'subtitulado por la comunidad de amara org',
  'subtitulos en espanol',
  'subtitulos creados por',
  'gracias por ver el video',
  'gracias por ver',
  'suscribete',
  'suscribete al canal',
  'no olvides suscribirte',
  'musica',
  'aplausos',
  'risas',
  'silencio',
  'ruido',
];

const SOUND_TAG = /\[[^\]]*\]|\([^)]*\)|[♪♫]+/g;

/** Removes Whisper artefacts; returns '' when nothing real was said. */
export function cleanTranscript(text: string): string {
  const withoutTags = text.replace(SOUND_TAG, ' ').replace(/\s+/g, ' ').trim();
  const normalized = normalizeText(withoutTags);
  if (!normalized) return '';
  if (HALLUCINATIONS.includes(normalized)) return '';
  if (HALLUCINATIONS.some((h) => h.length > 15 && normalized.includes(h))) return '';
  // A single word repeated over and over ("sí, sí, sí, sí…") is a decoding loop, not speech.
  const words = normalized.split(' ');
  if (words.length >= 4 && new Set(words).size === 1) return '';
  return withoutTags;
}
