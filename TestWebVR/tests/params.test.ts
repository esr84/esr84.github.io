import { describe, expect, it } from 'vitest';
import { getParam, hasFlag } from '../src/util/params';

describe('URL params', () => {
  it('reads values', () => {
    expect(getParam('stt', '?stt=tiny&debug=1')).toBe('tiny');
    expect(getParam('missing', '?stt=tiny')).toBeNull();
  });

  it('treats present flags as enabled unless 0/false', () => {
    expect(hasFlag('debug', '?debug=1')).toBe(true);
    expect(hasFlag('debug', '?debug')).toBe(true);
    expect(hasFlag('debug', '?debug=0')).toBe(false);
    expect(hasFlag('debug', '?debug=false')).toBe(false);
    expect(hasFlag('debug', '')).toBe(false);
  });
});
