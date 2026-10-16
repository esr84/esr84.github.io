import type { WebGLRenderer } from 'three';

export async function isImmersiveVRSupported(): Promise<boolean> {
  if (!navigator.xr) return false;
  return navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
}

/** Starts an immersive-vr session on the renderer. Must run inside a user gesture. */
export async function enterVR(renderer: WebGLRenderer): Promise<XRSession> {
  if (!navigator.xr) throw new Error('WebXR no está disponible en este navegador');
  const session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
  });
  await renderer.xr.setSession(session);
  return session;
}

/** "Entrar en VR" button that toggles the session. Reused by the 2D start screen (T03). */
export function createEnterVRButton(renderer: WebGLRenderer): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'enter-vr';
  button.textContent = 'Entrar en VR';
  button.disabled = true;

  void isImmersiveVRSupported().then((supported) => {
    button.disabled = !supported;
    if (!supported) button.textContent = 'VR no disponible';
  });

  button.addEventListener('click', async () => {
    const current = renderer.xr.getSession();
    if (current) {
      await current.end();
      return;
    }
    button.disabled = true;
    try {
      const session = await enterVR(renderer);
      button.textContent = 'Salir de VR';
      session.addEventListener('end', () => {
        button.textContent = 'Entrar en VR';
      });
    } catch (err) {
      console.error('[TestWebVR] Could not start the VR session', err);
      button.textContent = 'No se pudo entrar en VR';
    } finally {
      button.disabled = false;
    }
  });

  return button;
}
