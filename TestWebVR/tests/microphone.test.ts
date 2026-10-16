import { describe, expect, it } from 'vitest';
import { classifyMicrophoneError } from '../src/audio/microphone';

function named(name: string): Error {
  const err = new Error('x');
  err.name = name;
  return err;
}

describe('classifyMicrophoneError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['TypeError', 'unsupported'],
    ['AbortError', 'unknown'],
  ])('%s → %s', (name, kind) => {
    expect(classifyMicrophoneError(named(name)).kind).toBe(kind);
  });

  it('handles non-errors', () => {
    expect(classifyMicrophoneError('boom').kind).toBe('unknown');
  });
});
