// Emscripten glue of piper-phonemize (CommonJS factory, no typings shipped).
declare module '@diffusionstudio/piper-wasm/build/piper_phonemize.js' {
  import type { CreatePhonemizeModule } from '../tts/piperCore';

  const createPiperPhonemize: CreatePhonemizeModule;
  export default createPiperPhonemize;
}
