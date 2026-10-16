// TestWebVR service worker (production only). It does two jobs, because a scope can only
// have one service worker:
//  1. Adds COOP/COEP headers so the page is crossOriginIsolated (multi-threaded WASM) on
//     static hosts that cannot send headers, like GitHub Pages.
//  2. Caches the app and the models so the prototype works offline after the first load.
// The build replaces the two placeholders below (see vite.config.ts → stampServiceWorker).
const BUILD_ID = '__BUILD_ID__';
const MODELS_ID = '__MODELS_ID__';

const APP_CACHE = `app-${BUILD_ID}`;
// Models live in their own cache keyed by the models manifest, so a new deploy of the app
// does not download 230 MB again.
const MODELS_CACHE = `models-${MODELS_ID}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([APP_CACHE, MODELS_CACHE]);
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/** Copy of the response with the cross-origin isolation headers. */
function isolate(response) {
  if (response.status === 0) return response; // opaque: cannot be modified
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isModel(url) {
  return url.pathname.includes('/models/');
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  const respond = async () => {
    // HTML: always try the network first so a new deploy is picked up; offline → cache.
    if (request.mode === 'navigate') return isolate(await networkFirst(request));
    // Hashed bundles, workers, fonts, the avatar and the models never change for a given
    // URL in a build: cache first.
    return isolate(await cacheFirst(request, isModel(url) ? MODELS_CACHE : APP_CACHE));
  };
  event.respondWith(respond());
});
