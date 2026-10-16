import type { SttDevice, SttModel } from './types';

/** Approximate download size of each model (q8), to weight the loading bar. */
export const STT_MODEL_MB: Record<SttModel, number> = {
  'whisper-tiny': 41,
  'whisper-base': 77,
};

/**
 * Picks the Whisper model. `base` everywhere by default: in the round-trip test `tiny` got
 * key words wrong ("ticket" → "DQ") in 3 of 5 Spanish sentences, while `base` passed all 5.
 * `?stt=tiny` stays available to compare latency on a Quest 2 (check D1).
 */
export function chooseSttModel(param: string | null): SttModel {
  return param === 'tiny' ? 'whisper-tiny' : 'whisper-base';
}

/** WASM by default (fastest for small quantised models on mobile CPUs); `?sttdevice=webgpu` to compare. */
export function chooseSttDevice(param: string | null, webgpuAvailable: boolean): SttDevice {
  return param === 'webgpu' && webgpuAvailable ? 'webgpu' : 'wasm';
}
