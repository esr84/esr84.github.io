import { describe, expect, it } from 'vitest';
import { detectHeadset, deviceProfile, onnxThreads } from '../src/xr/deviceProfile';

const UA = (model: string) =>
  `Mozilla/5.0 (X11; Linux x86_64; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.0 Chrome/138 VR Safari/537.36`;

describe('detectHeadset', () => {
  it.each([
    ['Quest 2', 'quest2'],
    ['Quest 3', 'quest3'],
    ['Quest 3S', 'quest3'],
    ['Quest Pro', 'questpro'],
  ])('%s → %s', (model, headset) => {
    expect(detectHeadset(UA(model))).toBe(headset);
  });

  it('falls back to other', () => {
    expect(detectHeadset('Mozilla/5.0 (Windows NT 10.0)')).toBe('other');
  });
});

describe('deviceProfile', () => {
  it('lowers the resolution a little on Quest 2 only', () => {
    expect(deviceProfile(UA('Quest 2')).framebufferScale).toBeLessThan(1);
    expect(deviceProfile(UA('Quest 3')).framebufferScale).toBe(1);
  });
});

describe('onnxThreads', () => {
  it('is single-threaded without cross-origin isolation', () => {
    expect(onnxThreads(false, 8, '4')).toBe(1);
  });

  it('leaves two cores free, between 1 and 4 threads', () => {
    expect(onnxThreads(true, 12, null)).toBe(4);
    expect(onnxThreads(true, 6, null)).toBe(4);
    expect(onnxThreads(true, 4, null)).toBe(2);
    expect(onnxThreads(true, 2, null)).toBe(1);
    expect(onnxThreads(true, undefined, null)).toBe(1);
  });

  it('honours ?threads=N within limits', () => {
    expect(onnxThreads(true, 4, '3')).toBe(3);
    expect(onnxThreads(true, 4, '99')).toBe(8);
    expect(onnxThreads(true, 4, 'abc')).toBe(2);
    expect(onnxThreads(true, 4, '0')).toBe(2);
  });
});
