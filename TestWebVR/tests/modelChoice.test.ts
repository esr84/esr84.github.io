import { describe, expect, it } from 'vitest';
import { chooseSttDevice, chooseSttModel } from '../src/stt/modelChoice';

describe('chooseSttModel', () => {
  it('defaults to base and honours ?stt=tiny', () => {
    expect(chooseSttModel(null)).toBe('whisper-base');
    expect(chooseSttModel('base')).toBe('whisper-base');
    expect(chooseSttModel('tiny')).toBe('whisper-tiny');
    expect(chooseSttModel('other')).toBe('whisper-base');
  });
});

describe('chooseSttDevice', () => {
  it('defaults to wasm and only uses webgpu when asked and available', () => {
    expect(chooseSttDevice(null, true)).toBe('wasm');
    expect(chooseSttDevice('webgpu', true)).toBe('webgpu');
    expect(chooseSttDevice('webgpu', false)).toBe('wasm');
  });
});
