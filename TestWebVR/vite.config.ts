import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * onnxruntime-web references its own .wasm via `new URL(..., import.meta.url)`, so Vite emits
 * a 27 MB copy into assets/. We always point ORT at public/models/ort instead (shared by the
 * STT and TTS workers), so that copy is never requested: drop it from the build.
 */
function dropBundledOrtWasm(): Plugin {
  return {
    name: 'drop-bundled-ort-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [file, output] of Object.entries(bundle)) {
        if (output.type === 'asset' && /ort-wasm[^/]*\.wasm$/.test(file)) delete bundle[file];
      }
    },
  };
}

/**
 * Stamps public/sw.js in the build output with a build id (hash of the emitted file names, so
 * every deploy gets a fresh app cache) and a models id (hash of the models manifest, so the
 * 230 MB of models are only downloaded again when they actually change).
 */
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  let buildId = 'dev';
  const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      buildId = hash(Object.keys(bundle).sort().join('|'));
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      if (!existsSync(sw)) return;
      const manifest = join('public', 'models', 'MANIFEST.json');
      const modelsId = existsSync(manifest) ? hash(readFileSync(manifest, 'utf8')) : 'none';
      const stamped = readFileSync(sw, 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('__MODELS_ID__', modelsId);
      writeFileSync(sw, stamped);
    },
  };
}

// Required for SharedArrayBuffer (multi-threaded WASM). GitHub Pages cannot set these,
// so production relies on our service worker (public/sw.js) instead.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the app under /<repo>/; CI sets BASE_PATH accordingly.
  // `--mode pages` reproduces Pages locally: /TestWebVR/ sub-path and no custom headers.
  base: process.env.BASE_PATH ?? (mode === 'pages' ? '/TestWebVR/' : '/'),
  // `--mode lan` serves over HTTPS on the local network so the Quest can open it by IP.
  // Plain localhost (also via `adb reverse`) is already a secure context and needs no HTTPS.
  plugins: [dropBundledOrtWasm(), stampServiceWorker(), ...(mode === 'lan' ? [basicSsl()] : [])],
  server: {
    host: mode === 'lan',
    port: 5173,
    strictPort: true,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    port: 4173,
    strictPort: true,
    // Pages cannot send headers; in that mode isolation must come from coi-serviceworker.
    headers: mode === 'pages' ? {} : crossOriginIsolationHeaders,
  },
  build: {
    target: 'es2022',
    // three.js alone is ~540 kB minified; that is expected for this app.
    chunkSizeWarningLimit: 1024,
  },
  resolve: {
    // @iwer/devui depends on its own three.js; share ours to avoid duplicate instances.
    dedupe: ['three'],
  },
  optimizeDeps: {
    // Dynamic imports (dev emulator, worker-only deps): pre-bundle them so the first load
    // does not hit a 504 "Outdated Optimize Dep" while Vite re-optimizes. The piper glue is
    // CommonJS and must be converted to ESM for the module worker.
    include: [
      'iwer',
      '@iwer/devui',
      '@diffusionstudio/piper-wasm/build/piper_phonemize.js',
      'onnxruntime-web/webgpu',
    ],
    // onnxruntime-web loads its .mjs/.wasm from the URLs we give it; do not rewrite them.
    exclude: [],
  },
  worker: {
    // Module workers with dynamic imports (code splitting) need the ES format.
    format: 'es',
    plugins: () => [dropBundledOrtWasm()],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Slow tests (real models) only run with `npm run test:slow` (vitest --mode slow).
    exclude: mode === 'slow' ? [] : ['tests/slow/**'],
    environment: 'node',
  },
}));
