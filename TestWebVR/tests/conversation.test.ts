import { describe, expect, it, vi } from 'vitest';
import type { Recording } from '../src/audio/capture';
import {
  ConversationController,
  EchoResponder,
  NOT_HEARD,
  NOT_UNDERSTOOD,
  STT_TIMEOUT,
  type ConversationView,
  type Recorder,
} from '../src/app/conversation';
import type { ConversationStatus } from '../src/app/status';
import { SessionLog } from '../src/debug/sessionLog';
import type { STTProvider } from '../src/stt/types';
import type { Speaker, SpeechHandle } from '../src/tts/types';

const recording = (seconds = 1): Recording => ({
  pcm: new Float32Array(16000 * seconds),
  sampleRate: 16000,
  durationMs: seconds * 1000,
  inputPeak: 0.5,
  truncated: false,
});

class FakeView implements ConversationView {
  statuses: ConversationStatus[] = [];
  user = '';
  avatar = '';
  setStatus(s: ConversationStatus) {
    this.statuses.push(s);
  }
  setUser(t: string) {
    this.user = t;
  }
  setAvatar(t: string) {
    this.avatar = t;
  }
}

/** Speaker whose speech only ends when the test says so. */
class FakeSpeaker implements Speaker {
  readonly name = 'fake';
  said: string[] = [];
  stopped = 0;
  private finish: (() => void) | null = null;
  say(text: string): Promise<SpeechHandle> {
    this.said.push(text);
    let finish!: () => void;
    const ended = new Promise<void>((r) => (finish = r));
    this.finish = finish;
    return Promise.resolve({
      latencyMs: 100,
      ended,
      stop: () => {
        this.stopped++;
        finish();
      },
    });
  }
  endSpeech() {
    this.finish?.();
  }
  level() {
    return 0;
  }
  stop() {}
}

class FakeRecorder implements Recorder {
  started = 0;
  discarded = 0;
  next: Recording | null = recording();
  start() {
    this.started++;
  }
  stop() {
    return Promise.resolve(this.next);
  }
  discard() {
    this.discarded++;
  }
}

function setup(sttText = 'hola') {
  const view = new FakeView();
  const speaker = new FakeSpeaker();
  const recorder = new FakeRecorder();
  const stt: STTProvider = {
    name: 'fake',
    model: 'whisper-base',
    device: 'wasm',
    load: async () => undefined,
    transcribe: vi.fn(async () => ({ text: sttText, ms: 500 })),
  };
  const log = new SessionLog({
    startedAt: '',
    userAgent: '',
    sttModel: null,
    sttDevice: null,
    voice: null,
    capabilities: {},
  });
  const onBusy = vi.fn();
  const controller = new ConversationController({
    responder: new EchoResponder(),
    view,
    speaker,
    stt,
    recorder,
    log,
    onBusy,
  });
  return { view, speaker, recorder, stt, log, onBusy, controller };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ConversationController', () => {
  it('says the intro and goes idle when it ends', async () => {
    const { controller, speaker } = setup();
    await controller.start();
    expect(controller.status).toBe('speaking');
    speaker.endSpeech();
    await flush();
    expect(controller.status).toBe('idle');
  });

  it('runs a full voice turn: listen → transcribe → think → speak → idle', async () => {
    const { controller, speaker, view, log } = setup('qué tal');
    await controller.start();
    speaker.endSpeech();
    await flush();

    controller.pttStart();
    expect(controller.status).toBe('listening');
    await controller.pttEnd();
    expect(view.user).toBe('qué tal');
    expect(speaker.said.at(-1)).toBe('Has dicho: qué tal');
    expect(controller.status).toBe('speaking');
    speaker.endSpeech();
    await flush();
    expect(controller.status).toBe('idle');
    expect(view.statuses).toEqual(
      expect.arrayContaining(['listening', 'transcribing', 'thinking', 'speaking', 'idle']),
    );
    expect(log.length).toBe(1);
    expect(log.last).toMatchObject({ userText: 'qué tal', sttMs: 500, ttsMs: 100 });
  });

  it('interrupts the avatar when push-to-talk is pressed while it speaks', async () => {
    const { controller, speaker, recorder } = setup();
    await controller.start();
    controller.pttStart();
    expect(speaker.stopped).toBe(1);
    expect(recorder.started).toBe(1);
    expect(controller.status).toBe('listening');
    // The interrupted intro finishing late must not change the state.
    await flush();
    expect(controller.status).toBe('listening');
  });

  it('rejects push-to-talk while transcribing and buzzes', async () => {
    const { controller, speaker, onBusy, stt } = setup();
    await controller.start();
    speaker.endSpeech();
    await flush();
    let release!: (v: { text: string; ms: number }) => void;
    vi.mocked(stt.transcribe).mockImplementationOnce(() => new Promise((r) => (release = r)));
    controller.pttStart();
    const pending = controller.pttEnd();
    await flush();
    expect(controller.status).toBe('transcribing');
    controller.pttStart();
    expect(onBusy).toHaveBeenCalled();
    release({ text: 'vale', ms: 1 });
    await pending;
    expect(speaker.said.at(-1)).toBe('Has dicho: vale');
  });

  it('tells the user when nothing was understood', async () => {
    const { controller, speaker, view } = setup('');
    await controller.start();
    speaker.endSpeech();
    await flush();
    controller.pttStart();
    await controller.pttEnd();
    expect(view.user).toBe(NOT_UNDERSTOOD);
    expect(controller.status).toBe('idle');
  });

  it('goes back to idle on cancel or a too-short recording', async () => {
    const { controller, speaker, recorder } = setup();
    await controller.start();
    speaker.endSpeech();
    await flush();
    controller.pttStart();
    controller.pttCancel();
    expect(recorder.discarded).toBe(1);
    expect(controller.status).toBe('idle');
    recorder.next = null;
    controller.pttStart();
    await controller.pttEnd();
    expect(controller.status).toBe('idle');
  });

  it('accepts typed text in text mode', async () => {
    const { controller, speaker, log } = setup();
    await controller.start();
    speaker.endSpeech();
    await flush();
    await controller.submitText('  buenas  ');
    expect(speaker.said.at(-1)).toBe('Has dicho: buenas');
    expect(log.last).toMatchObject({ userText: 'buenas', sttMs: null });
  });

  it('marks the previous turn as interrupted', async () => {
    const { controller, speaker, log } = setup();
    await controller.start();
    speaker.endSpeech();
    await flush();
    await controller.submitText('uno');
    controller.pttStart();
    expect(log.last?.interrupted).toBe(true);
  });
});

describe('ConversationController robustness', () => {
  it('skips the STT for silent recordings', async () => {
    const { controller, speaker, recorder, stt, view } = setup('hola');
    await controller.start();
    speaker.endSpeech();
    await flush();
    recorder.next = { ...recording(), inputPeak: 0.001 };
    controller.pttStart();
    await controller.pttEnd();
    expect(stt.transcribe).not.toHaveBeenCalled();
    expect(view.user).toBe(NOT_HEARD);
    expect(controller.status).toBe('idle');
  });

  it('gives up on a stuck transcription', async () => {
    const view = new FakeView();
    const speaker = new FakeSpeaker();
    const stt: STTProvider = {
      name: 'stuck',
      model: 'whisper-base',
      device: 'wasm',
      load: async () => undefined,
      transcribe: () => new Promise(() => undefined),
    };
    const log = new SessionLog({
      startedAt: '',
      userAgent: '',
      sttModel: null,
      sttDevice: null,
      voice: null,
      capabilities: {},
    });
    const controller = new ConversationController({
      responder: new EchoResponder(),
      view,
      speaker,
      stt,
      recorder: new FakeRecorder(),
      log,
      sttTimeoutMs: 20,
    });
    await controller.start();
    speaker.endSpeech();
    await flush();
    controller.pttStart();
    await controller.pttEnd();
    expect(view.user).toBe(STT_TIMEOUT);
    expect(controller.status).toBe('idle');
  });

  it('treats Whisper hallucinations as not understood', async () => {
    const { controller, speaker, view } = setup(
      'Subtítulos realizados por la comunidad de Amara.org',
    );
    await controller.start();
    speaker.endSpeech();
    await flush();
    controller.pttStart();
    await controller.pttEnd();
    expect(view.user).toBe(NOT_UNDERSTOOD);
  });
});
