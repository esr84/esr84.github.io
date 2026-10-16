import type { WebGLRenderer } from 'three';
import { describeCapabilities, type Capabilities } from '../app/capabilities';
import type { Preloader } from '../app/preloader';
import { resumeAudio } from '../audio/audioContext';
import { MicrophoneError, requestMicrophone } from '../audio/microphone';
import { createEnterVRButton } from '../xr/enterVR';

export interface StartScreenOptions {
  readonly renderer: WebGLRenderer;
  readonly preloader: Preloader;
  readonly capabilities: Capabilities;
  /** `?text=1`: typing replaces the microphone, so no permission is requested. */
  readonly textMode: boolean;
  readonly title: string;
  readonly description: string;
}

export interface StartResult {
  /** Null in text mode or when the user chose to continue without a microphone. */
  readonly microphone: MediaStream | null;
  readonly textMode: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 2D overlay shown before VR: explains the scenario, asks for the microphone inside the
 * "Empezar" gesture, preloads models with a progress bar and then offers "Entrar en VR".
 * Resolves `ready` once loading finished; the overlay hides while a session is active.
 */
export function createStartScreen(container: HTMLElement, options: StartScreenOptions) {
  const root = el('div', 'start-screen');
  const card = el('div', 'start-card');
  const title = el('h1', 'start-title', options.title);
  const description = el('p', 'start-description', options.description);
  const hint = el('p', 'start-hint', 'Mantén pulsado el gatillo derecho para hablar.');
  const message = el('p', 'start-message');
  const warning = el('p', 'start-message');
  const retryButton = el('button', 'start-secondary', 'Reintentar (recargar)');
  retryButton.hidden = true;
  retryButton.addEventListener('click', () => location.reload());
  const progress = el('div', 'start-progress');
  const bar = el('div', 'start-progress-bar');
  const progressLabel = el('p', 'start-progress-label');
  const startButton = el('button', 'start-button', 'Empezar');
  const textModeButton = el('button', 'start-secondary', 'Continuar en modo texto');
  const enterButton = createEnterVRButton(options.renderer);
  const caps = el('p', 'start-caps', describeCapabilities(options.capabilities));

  progress.append(bar);
  progress.hidden = true;
  progressLabel.hidden = true;
  textModeButton.hidden = true;
  enterButton.hidden = true;
  const showTextModeHint = () =>
    (hint.textContent = 'Modo texto: escribe tus respuestas en lugar de hablar.');
  if (options.textMode) showTextModeHint();
  if (!options.capabilities.immersiveVR) {
    message.textContent = 'Este navegador no puede abrir una sesión de realidad virtual.';
  }

  card.append(
    title,
    description,
    hint,
    message,
    warning,
    retryButton,
    progress,
    progressLabel,
    startButton,
    textModeButton,
    enterButton,
    caps,
  );
  root.append(card);
  container.append(root);

  options.renderer.xr.addEventListener('sessionstart', () => (root.hidden = true));
  options.renderer.xr.addEventListener('sessionend', () => (root.hidden = false));

  let resolveReady!: (result: StartResult) => void;
  const ready = new Promise<StartResult>((resolve) => (resolveReady = resolve));

  const load = async (microphone: MediaStream | null, textMode: boolean) => {
    startButton.hidden = true;
    textModeButton.hidden = true;
    if (textMode) showTextModeHint();
    progress.hidden = false;
    progressLabel.hidden = false;
    await options.preloader.run(({ total, label }) => {
      bar.style.width = `${Math.round(total * 100)}%`;
      progressLabel.textContent = `${label} · ${Math.round(total * 100)} %`;
    });
    progress.hidden = true;
    progressLabel.hidden = true;
    enterButton.hidden = false;
    resolveReady({ microphone, textMode });
  };

  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    message.textContent = '';
    // AudioContext must be created/resumed inside the gesture (autoplay policy).
    await resumeAudio().catch((err: unknown) => console.warn('[TestWebVR] Audio resume', err));
    if (options.textMode) {
      await load(null, true);
      return;
    }
    try {
      const microphone = await requestMicrophone();
      await load(microphone, false);
    } catch (err) {
      const reason = err instanceof MicrophoneError ? err.message : 'Error con el micrófono.';
      console.warn('[TestWebVR] Microphone unavailable', err);
      message.textContent = `${reason} Puedes reintentarlo o seguir escribiendo en lugar de hablar.`;
      startButton.disabled = false;
      startButton.textContent = 'Reintentar';
      textModeButton.hidden = false;
    }
  });

  textModeButton.addEventListener('click', () => {
    message.textContent = '';
    void load(null, true);
  });

  /** Shows a problem found while loading; the app stays usable (`retry` offers a reload). */
  const warn = (text: string, retry = false) => {
    warning.textContent = warning.textContent ? `${warning.textContent} ${text}` : text;
    if (retry) retryButton.hidden = false;
  };

  return { root, ready, warn };
}
