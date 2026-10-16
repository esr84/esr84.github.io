#!/usr/bin/env node
// Downloads (and copies from node_modules) every model/runtime file the app serves locally
// into public/models/. Idempotent: files already present with the right size (and hash, for
// large files) are skipped. Revisions are pinned so CI and local builds get identical files.
//
//   npm run fetch-models            # everything
//   npm run fetch-models -- --only=whisper-tiny,piper   # subsets (whisper-tiny, whisper-base, piper, ort)
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs';
import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models');
const HF = 'https://huggingface.co';

const WHISPER_TINY_REV = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7';
const WHISPER_BASE_REV = '1846881b6b3a3024392c1eea3ad983695bc23925';
const PIPER_VOICES_REV = 'c10ece1aade47bb51c153c893d14e5bf8e5b7117';

/** @typedef {{ group: string, dest: string, size: number, sha256?: string, url?: string, from?: string, license: string }} Entry */

/** Whisper files needed by the transformers.js ASR pipeline with dtype q8 ("quantized"). */
function whisper(name, rev, sizes) {
  const base = `${HF}/onnx-community/${name}/resolve/${rev}`;
  const license = 'MIT (OpenAI Whisper)';
  /** @type {Entry[]} */
  const files = [
    ['config.json', 2243],
    ['generation_config.json', sizes.generation],
    ['preprocessor_config.json', 339],
    ['tokenizer.json', 2480466],
    ['tokenizer_config.json', sizes.tokenizerConfig],
  ].map(([file, size]) => ({
    group: name,
    dest: `${name}/${file}`,
    size,
    url: `${base}/${file}`,
    license,
  }));
  files.push(
    {
      group: name,
      dest: `${name}/onnx/encoder_model_quantized.onnx`,
      size: sizes.encoder[0],
      sha256: sizes.encoder[1],
      url: `${base}/onnx/encoder_model_quantized.onnx`,
      license,
    },
    {
      group: name,
      dest: `${name}/onnx/decoder_model_merged_quantized.onnx`,
      size: sizes.decoder[0],
      sha256: sizes.decoder[1],
      url: `${base}/onnx/decoder_model_merged_quantized.onnx`,
      license,
    },
  );
  return files;
}

/** @type {Entry[]} */
const ENTRIES = [
  ...whisper('whisper-tiny', WHISPER_TINY_REV, {
    generation: 3772,
    tokenizerConfig: 282683,
    encoder: [10124990, '2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19'],
    decoder: [30719241, '25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3'],
  }),
  ...whisper('whisper-base', WHISPER_BASE_REV, {
    generation: 3832,
    tokenizerConfig: 282682,
    encoder: [23201314, '5862993336bf33acd23736071aae2b32261d3b1b2f37780194460d4ef974dd46'],
    decoder: [53693315, 'fa3ef9902734ce5ae6f9ef2bdb2ba9a6c4b5785b09f4f420ce036573dc9d090b'],
  }),
  {
    group: 'piper',
    dest: 'piper/es_ES-davefx-medium.onnx',
    size: 63201294,
    sha256: '6658b03b1a6c316ee4c265a9896abc1393353c2d9e1bca7d66c2c442e222a917',
    url: `${HF}/rhasspy/piper-voices/resolve/${PIPER_VOICES_REV}/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx`,
    license: 'Piper voice (MIT); dataset davefx CC0; fine-tuned from lessac',
  },
  {
    group: 'piper',
    dest: 'piper/es_ES-davefx-medium.onnx.json',
    size: 4817,
    url: `${HF}/rhasspy/piper-voices/resolve/${PIPER_VOICES_REV}/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json`,
    license: 'MIT',
  },
  {
    group: 'piper',
    dest: 'piper/MODEL_CARD.md',
    size: 276,
    url: `${HF}/rhasspy/piper-voices/resolve/${PIPER_VOICES_REV}/es/es_ES/davefx/medium/MODEL_CARD`,
    license: 'MIT',
  },
  // Phonemizer (piper-phonemize + espeak-ng data) compiled to WASM, from the npm package.
  {
    group: 'piper',
    dest: 'piper/piper_phonemize.wasm',
    size: 635212,
    from: 'node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm',
    license: 'piper-phonemize MIT; espeak-ng GPL-3.0',
  },
  {
    group: 'piper',
    dest: 'piper/piper_phonemize.data',
    size: 18077249,
    from: 'node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data',
    license: 'espeak-ng data GPL-3.0',
  },
  // onnxruntime-web runtime used by transformers.js (STT) and the Piper worker (TTS). The
  // asyncify build supports both the wasm and webgpu execution providers.
  {
    group: 'ort',
    dest: 'ort/ort-wasm-simd-threaded.asyncify.mjs',
    size: 0,
    from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
    license: 'MIT (onnxruntime)',
  },
  {
    group: 'ort',
    dest: 'ort/ort-wasm-simd-threaded.asyncify.wasm',
    size: 0,
    from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
    license: 'MIT (onnxruntime)',
  },
];

const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice('--only='.length)
  .split(',');

function mb(bytes) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

async function sha256Of(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/** Size 0 means "copied from node_modules, whatever size the installed version has". */
function expectedSize(entry) {
  if (entry.size > 0) return entry.size;
  return statSync(join(ROOT, entry.from)).size;
}

async function isUpToDate(entry, target) {
  if (!existsSync(target)) return false;
  if (statSync(target).size !== expectedSize(entry)) return false;
  // Large downloads are hash-checked once here; a corrupt file gets re-downloaded.
  if (entry.sha256 && (await sha256Of(target)) !== entry.sha256) return false;
  return true;
}

async function download(entry, target) {
  const response = await fetch(entry.url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} for ${entry.url}`);
  }
  const total = Number(response.headers.get('content-length')) || entry.size;
  let loaded = 0;
  let lastLog = 0;
  const body = Readable.fromWeb(response.body);
  body.on('data', (chunk) => {
    loaded += chunk.length;
    const now = Date.now();
    if (process.stdout.isTTY && now - lastLog > 500) {
      lastLog = now;
      process.stdout.write(`\r  ${entry.dest}: ${mb(loaded)} / ${mb(total)}   `);
    }
  });
  const partial = `${target}.part`;
  await pipeline(body, createWriteStream(partial));
  if (process.stdout.isTTY) process.stdout.write('\r');
  await rename(partial, target);
}

async function main() {
  const entries = ENTRIES.filter((e) => !only || only.includes(e.group));
  let downloaded = 0;
  let skipped = 0;
  for (const entry of entries) {
    const target = join(OUT, entry.dest);
    await mkdir(dirname(target), { recursive: true });
    if (await isUpToDate(entry, target)) {
      skipped++;
      continue;
    }
    if (entry.from) {
      await copyFile(join(ROOT, entry.from), target);
      console.log(`  copied     ${entry.dest} (${mb(expectedSize(entry))})`);
    } else {
      await download(entry, target);
      console.log(`  downloaded ${entry.dest} (${mb(entry.size)})`);
    }
    if (!(await isUpToDate(entry, target))) {
      await rm(target, { force: true });
      throw new Error(`Size or hash mismatch for ${entry.dest}`);
    }
    downloaded++;
  }

  const manifest = ENTRIES.filter((e) => existsSync(join(OUT, e.dest))).map((e) => ({
    file: e.dest,
    bytes: statSync(join(OUT, e.dest)).size,
    source: e.url ?? e.from,
    sha256: e.sha256 ?? null,
    license: e.license,
  }));
  const totalBytes = manifest.reduce((sum, m) => sum + m.bytes, 0);
  await writeFile(
    join(OUT, 'MANIFEST.json'),
    `${JSON.stringify({ totalBytes, files: manifest }, null, 2)}\n`,
  );
  console.log(
    `fetch-models: ${downloaded} updated, ${skipped} already present, total ${mb(totalBytes)} in ${relative(ROOT, OUT)}`,
  );
}

main().catch((err) => {
  console.error(`fetch-models failed: ${err.message}`);
  process.exit(1);
});
