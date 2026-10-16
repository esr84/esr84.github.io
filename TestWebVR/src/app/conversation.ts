import type { Recording } from '../audio/capture';
import type { SessionLog } from '../debug/sessionLog';
import { cleanTranscript } from '../stt/hallucinations';
import type { STTProvider } from '../stt/types';
import type { Speaker, SpeechHandle } from '../tts/types';
import type { ConversationStatus } from './status';

export type Emotion = 'neutral' | 'annoyed' | 'angry' | 'calm' | 'grateful';
export type Gesture = 'yes' | 'no' | 'wave' | 'shrug' | 'point';

/** What the avatar says and how (see docs/PLAN.md §2). */
export interface AvatarTurn {
  readonly text: string;
  readonly emotion: Emotion;
  readonly gesture?: Gesture;
  /** Ends the conversation after this line. */
  readonly final?: boolean;
  /** Extra data for the session log (scenario node, intent, anger...). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/** Produces the avatar replies: the echo responder now, the scenario engine in T16. */
export interface Responder {
  start(): AvatarTurn;
  respond(userText: string): AvatarTurn;
}

/** The parts of the UI the controller drives (subtitles, debug HUD, avatar...). */
export interface ConversationView {
  setStatus(status: ConversationStatus): void;
  setUser(text: string): void;
  setAvatar(text: string): void;
  onTurn?(turn: AvatarTurn): void;
  setMetric?(key: string, value: string | number | null): void;
}

export interface Recorder {
  start(): void;
  stop(): Promise<Recording | null>;
  discard(): void;
}

export interface ConversationDeps {
  readonly responder: Responder;
  readonly view: ConversationView;
  readonly speaker: Speaker | null;
  readonly stt: STTProvider | null;
  readonly recorder: Recorder | null;
  readonly log: SessionLog;
  /** Feedback when push-to-talk is pressed while the avatar cannot listen (haptic buzz). */
  readonly onBusy?: () => void;
  readonly now?: () => number;
  /** Give up on a transcription after this long (the worker may be stuck). Default 10 s. */
  readonly sttTimeoutMs?: number;
  /** Recordings quieter than this peak are treated as silence and skip the STT. */
  readonly minInputPeak?: number;
}

export const NOT_UNDERSTOOD = 'No te he entendido. ¿Puedes repetirlo?';
export const NOT_HEARD = 'No te he oído bien. ¿Puedes repetirlo más alto?';
export const STT_TIMEOUT = 'Se me ha ido el santo al cielo. ¿Puedes repetirlo?';

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Conversation state machine (docs/PLAN.md §2):
 * INTRO → IDLE ⇄ LISTENING → TRANSCRIBING → THINKING → SPEAKING → IDLE … → ENDED.
 * Pressing push-to-talk while the avatar speaks interrupts it (barge-in).
 * It has no DOM/Three dependencies so it can be tested with fakes.
 */
export class ConversationController {
  private state: ConversationStatus = 'intro';
  private speech: SpeechHandle | null = null;
  /** Incremented on every new turn/interruption so stale async work is ignored. */
  private generation = 0;
  private readonly now: () => number;
  private speechStartedAt = 0;

  constructor(private readonly deps: ConversationDeps) {
    this.now = deps.now ?? (() => performance.now());
  }

  get status(): ConversationStatus {
    return this.state;
  }

  /** Avatar opening line. */
  async start(): Promise<void> {
    const turn = this.deps.responder.start();
    await this.speak(turn, ++this.generation, null);
  }

  pttStart(): void {
    if (this.state === 'speaking') {
      this.interrupt();
    } else if (this.state !== 'idle') {
      this.deps.onBusy?.();
      return;
    }
    if (!this.deps.recorder) {
      this.deps.onBusy?.();
      return;
    }
    this.generation++;
    this.deps.recorder.start();
    this.setStatus('listening');
  }

  pttCancel(): void {
    if (this.state !== 'listening') return;
    this.deps.recorder?.discard();
    this.setStatus('idle');
  }

  async pttEnd(): Promise<void> {
    if (this.state !== 'listening' || !this.deps.recorder) return;
    const generation = this.generation;
    const releasedAt = this.now();
    this.setStatus('transcribing');
    const recording = await this.deps.recorder.stop();
    if (generation !== this.generation) return;
    await this.handleRecording(recording, generation, releasedAt);
  }

  /** The recorder hit its maximum length while the trigger was still held. */
  async recordingLimitReached(recording: Recording | null): Promise<void> {
    if (this.state !== 'listening') return;
    const generation = this.generation;
    this.setStatus('transcribing');
    await this.handleRecording(recording, generation, this.now());
  }

  /** Text mode (`?text=1`): typed input replaces speech recognition. */
  async submitText(text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    if (this.state === 'speaking') this.interrupt();
    else if (this.state !== 'idle') {
      this.deps.onBusy?.();
      return;
    }
    const generation = ++this.generation;
    await this.reply(clean, generation, this.now(), null, null);
  }

  private async handleRecording(
    recording: Recording | null,
    generation: number,
    releasedAt: number,
  ): Promise<void> {
    if (!recording || !this.deps.stt) {
      this.setStatus('idle');
      return;
    }
    // Silence (muted or far microphone): do not spend seconds of CPU on it.
    if (recording.inputPeak < (this.deps.minInputPeak ?? 0.02)) {
      this.deps.view.setUser(NOT_HEARD);
      this.setStatus('idle');
      return;
    }
    let text = '';
    let sttMs: number | null = null;
    let timedOut = false;
    try {
      const result = await withTimeout(
        this.deps.stt.transcribe(recording.pcm),
        this.deps.sttTimeoutMs ?? 10_000,
      );
      text = cleanTranscript(result.text);
      sttMs = result.ms;
      this.deps.view.setMetric?.('STT', `${Math.round(result.ms)} ms`);
    } catch (err) {
      timedOut = err instanceof TimeoutError;
      console.error('[TestWebVR] Transcription failed', err);
    }
    if (generation !== this.generation) return;
    if (!text) {
      this.deps.view.setUser(timedOut ? STT_TIMEOUT : NOT_UNDERSTOOD);
      this.setStatus('idle');
      return;
    }
    await this.reply(text, generation, releasedAt, sttMs, recording.durationMs / 1000);
  }

  private async reply(
    userText: string,
    generation: number,
    startedAt: number,
    sttMs: number | null,
    audioSeconds: number | null,
  ): Promise<void> {
    this.deps.view.setUser(userText);
    this.setStatus('thinking');
    const turn = this.deps.responder.respond(userText);
    const speech = await this.speak(turn, generation, startedAt);
    this.deps.log.add({
      userText,
      avatarText: turn.text,
      sttMs: sttMs === null ? null : Math.round(sttMs),
      ttsMs: speech ? Math.round(speech.latencyMs) : null,
      totalMs: speech ? Math.round(this.speechStartedAt - startedAt) : null,
      audioSeconds: audioSeconds === null ? null : Math.round(audioSeconds * 10) / 10,
      interrupted: false,
      extra: turn.extra,
    });
    this.deps.view.setMetric?.('Turnos', this.deps.log.length);
  }

  /** Says a line; returns the speech handle once audio has started (null if no voice). */
  private async speak(
    turn: AvatarTurn,
    generation: number,
    startedAt: number | null,
  ): Promise<SpeechHandle | null> {
    this.deps.view.setAvatar(turn.text);
    this.deps.view.onTurn?.(turn);
    if (!this.deps.speaker) {
      this.afterSpeech(turn, generation);
      return null;
    }
    let handle: SpeechHandle;
    try {
      handle = await this.deps.speaker.say(turn.text);
    } catch (err) {
      console.error('[TestWebVR] Speech failed', err);
      this.afterSpeech(turn, generation);
      return null;
    }
    if (generation !== this.generation) {
      handle.stop();
      return handle;
    }
    this.speechStartedAt = this.now();
    this.speech = handle;
    this.setStatus('speaking');
    this.deps.view.setMetric?.('TTS', `${Math.round(handle.latencyMs)} ms`);
    if (startedAt !== null) {
      this.deps.view.setMetric?.('Turno', `${Math.round(this.speechStartedAt - startedAt)} ms`);
    }
    void handle.ended.then(() => {
      if (this.speech === handle) this.speech = null;
      if (generation === this.generation && this.state === 'speaking') {
        this.afterSpeech(turn, generation);
      }
    });
    return handle;
  }

  private afterSpeech(turn: AvatarTurn, generation: number): void {
    if (generation !== this.generation) return;
    this.setStatus(turn.final ? 'ended' : 'idle');
  }

  private interrupt(): void {
    this.generation++;
    this.speech?.stop();
    this.speech = null;
    this.deps.log.markLastInterrupted();
    this.setStatus('idle');
  }

  private setStatus(status: ConversationStatus): void {
    if (this.state === 'ended') return;
    this.state = status;
    this.deps.view.setStatus(status);
    this.deps.view.setMetric?.('Estado', status);
  }
}

/** T10 placeholder responder: repeats what it heard. Replaced by the scenario engine (T16). */
export class EchoResponder implements Responder {
  start(): AvatarTurn {
    return { text: 'Hola. Dime algo y te lo repetiré.', emotion: 'neutral', gesture: 'wave' };
  }

  respond(userText: string): AvatarTurn {
    return { text: `Has dicho: ${userText}`, emotion: 'neutral' };
  }
}
