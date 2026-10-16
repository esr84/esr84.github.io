const RELOAD_FLAG = 'testwebvr-sw-reload';

/**
 * Registers the service worker in production builds. On the first visit the page is not yet
 * crossOriginIsolated (the worker that adds the headers is not controlling it), so it reloads
 * once; a session flag prevents reload loops if isolation is impossible.
 * Returns true when the page is about to reload (the caller should stop starting the app).
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.register(
      new URL('sw.js', document.baseURI).href,
      { scope: './' },
    );
    if (globalThis.crossOriginIsolated) {
      sessionStorage.removeItem(RELOAD_FLAG);
      return false;
    }
    if (sessionStorage.getItem(RELOAD_FLAG)) {
      console.warn(
        '[TestWebVR] Still not crossOriginIsolated after reload; WASM runs single-threaded',
      );
      return false;
    }
    await navigator.serviceWorker.ready;
    if (!registration.active) return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
    location.reload();
    return true;
  } catch (err) {
    console.warn('[TestWebVR] Service worker registration failed', err);
    return false;
  }
}
