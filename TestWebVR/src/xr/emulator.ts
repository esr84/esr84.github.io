import { hasFlag } from '../util/params';

/** Minimal surface of the IWER device that the app and dev tooling use. */
export interface EmulatedDevice {
  readonly name: string;
}

/**
 * Installs the IWER WebXR emulator in development when there is no usable immersive-vr
 * support (desktop browsers expose navigator.xr but cannot start a VR session) or when
 * `?emulate=1` is present. In production builds this whole branch is removed, so iwer is
 * never shipped.
 */
export async function maybeInstallEmulator(): Promise<EmulatedDevice | null> {
  if (import.meta.env.DEV) {
    const forced = hasFlag('emulate');
    const nativeVR = navigator.xr
      ? await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)
      : false;
    if (!forced && nativeVR) return null;

    const { XRDevice, metaQuest3 } = await import('iwer');
    const device = new XRDevice(metaQuest3);
    device.installRuntime({ forceInstall: true });
    try {
      const { DevUI } = await import('@iwer/devui');
      device.installDevUI(DevUI);
    } catch (err) {
      console.warn('[TestWebVR] IWER DevUI unavailable', err);
    }
    // Handle for manual debugging and automated checks (e.g. pressing the trigger).
    (window as unknown as { __xrDevice?: unknown }).__xrDevice = device;
    console.info('[TestWebVR] WebXR emulator installed (Meta Quest 3)');
    return { name: 'Meta Quest 3 (IWER)' };
  }
  return null;
}
