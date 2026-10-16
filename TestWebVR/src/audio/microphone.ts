export type MicrophoneErrorKind = 'denied' | 'not-found' | 'unsupported' | 'unknown';

export class MicrophoneError extends Error {
  constructor(
    readonly kind: MicrophoneErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'MicrophoneError';
  }
}

/** Maps getUserMedia failures to a few cases the UI can explain in Spanish. */
export function classifyMicrophoneError(err: unknown): MicrophoneError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new MicrophoneError('denied', 'Se ha denegado el permiso del micrófono.');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new MicrophoneError('not-found', 'No se ha encontrado ningún micrófono.');
    case 'TypeError':
      return new MicrophoneError('unsupported', 'Este navegador no permite usar el micrófono.');
    default:
      return new MicrophoneError('unknown', 'No se ha podido acceder al micrófono.');
  }
}

/**
 * Requests the microphone. Must be called from a user gesture, before entering VR:
 * permission prompts inside an immersive session are not reliable on Quest.
 */
export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError('unsupported', 'Este navegador no permite usar el micrófono.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    throw classifyMicrophoneError(err);
  }
}
