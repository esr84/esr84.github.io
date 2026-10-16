export type Headset = 'quest2' | 'quest3' | 'questpro' | 'other';

export interface DeviceProfile {
  readonly headset: Headset;
  /** WebXR framebuffer scale (1 = the browser's recommended resolution). */
  readonly framebufferScale: number;
  /** Fixed foveated rendering, 0..1 (1 = strongest, cheapest). */
  readonly foveation: number;
}

/** Detects the Meta Quest model from the Meta Quest Browser user agent. */
export function detectHeadset(userAgent: string): Headset {
  if (/Quest 2/i.test(userAgent)) return 'quest2';
  if (/Quest 3/i.test(userAgent)) return 'quest3';
  if (/Quest Pro/i.test(userAgent)) return 'questpro';
  return 'other';
}

/**
 * Rendering settings per headset. Quest 2 renders slightly below the recommended
 * resolution to leave GPU headroom (its CPU is also busy with speech recognition).
 */
export function deviceProfile(userAgent: string): DeviceProfile {
  const headset = detectHeadset(userAgent);
  return {
    headset,
    framebufferScale: headset === 'quest2' ? 0.85 : 1,
    foveation: 1,
  };
}

/** Threads for one ONNX worker; `?threads=N` overrides it to experiment on the headset. */
export function onnxThreads(
  isolated: boolean,
  cores: number | undefined,
  override: string | null,
): number {
  if (!isolated) return 1;
  const forced = override ? Number.parseInt(override, 10) : Number.NaN;
  if (Number.isFinite(forced) && forced >= 1) return Math.min(forced, 8);
  // Leave cores for rendering and for the other (TTS/STT) worker.
  return Math.max(1, Math.min(4, (cores || 2) - 2));
}
