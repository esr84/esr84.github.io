import { describe, expect, it } from 'vitest';
import { cleanTranscript } from '../src/stt/hallucinations';

describe('cleanTranscript', () => {
  it.each([
    'Subtítulos realizados por la comunidad de Amara.org',
    '¡Gracias por ver el video!',
    '[Música]',
    '(risas)',
    '♪ ♪',
    'Suscríbete',
    '   ',
    'sí, sí, sí, sí, sí',
  ])('drops "%s"', (text) => {
    expect(cleanTranscript(text)).toBe('');
  });

  it('keeps a bare "gracias": the user may say it to close the conversation', () => {
    expect(cleanTranscript('Gracias.')).toBe('Gracias.');
  });

  it('keeps real sentences, even with "gracias" inside', () => {
    expect(cleanTranscript('Muchas gracias por su paciencia, vamos a mirarlo.')).toBe(
      'Muchas gracias por su paciencia, vamos a mirarlo.',
    );
    expect(cleanTranscript('¿Tiene el ticket de compra?')).toBe('¿Tiene el ticket de compra?');
  });

  it('removes sound tags around real speech', () => {
    expect(cleanTranscript('[Música] Buenos días, ¿qué tal?')).toBe('Buenos días, ¿qué tal?');
  });

  it('drops credits appended to speech', () => {
    expect(cleanTranscript('vale subtitulos realizados por la comunidad de amara org')).toBe('');
  });

  it('keeps short repeated answers that are real', () => {
    expect(cleanTranscript('sí, sí')).toBe('sí, sí');
  });
});
