export interface Capabilities {
  readonly webxr: boolean;
  readonly immersiveVR: boolean;
  /** A WebGPU adapter was obtained (not just `navigator.gpu` present). */
  readonly webgpu: boolean;
  readonly crossOriginIsolated: boolean;
  readonly cores: number | null;
  /** Approximate device memory in GB (Chromium only). */
  readonly memoryGB: number | null;
  readonly userAgent: string;
}

interface NavigatorExtras {
  gpu?: { requestAdapter(): Promise<unknown> };
  deviceMemory?: number;
}

export async function detectCapabilities(): Promise<Capabilities> {
  const nav = navigator as Navigator & NavigatorExtras;
  const immersiveVR = nav.xr
    ? await nav.xr.isSessionSupported('immersive-vr').catch(() => false)
    : false;
  let webgpu = false;
  if (nav.gpu) {
    try {
      webgpu = (await nav.gpu.requestAdapter()) !== null;
    } catch {
      webgpu = false;
    }
  }
  return {
    webxr: !!nav.xr,
    immersiveVR,
    webgpu,
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    cores: nav.hardwareConcurrency || null,
    memoryGB: nav.deviceMemory ?? null,
    userAgent: nav.userAgent,
  };
}

export function describeCapabilities(c: Capabilities): string {
  const yes = (v: boolean) => (v ? 'sí' : 'no');
  return [
    `VR: ${yes(c.immersiveVR)}`,
    `WebGPU: ${yes(c.webgpu)}`,
    `Multihilo: ${yes(c.crossOriginIsolated)}`,
    `Núcleos: ${c.cores ?? '?'}`,
    `Memoria: ${c.memoryGB !== null ? `${c.memoryGB} GB` : '?'}`,
  ].join(' · ');
}
