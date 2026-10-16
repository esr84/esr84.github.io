import './ui/styles.css';
import { detectCapabilities } from './app/capabilities';
import { ConversationController } from './app/conversation';
import { delayTask, Preloader } from './app/preloader';
import { buildSummary } from './app/summary';
import { getAudioContext } from './audio/audioContext';
import { registerServiceWorker } from './pwa/register';
import { AudioCapture, playRecording, type Recording } from './audio/capture';
import { AudioPlayer } from './audio/player';
import { PlaceholderAvatar } from './avatar/placeholder';
import { RobotAvatar } from './avatar/robotAvatar';
import type { AvatarController } from './avatar/types';
import { downloadSessionLog, SessionLog } from './debug/sessionLog';
import { ScenarioEngine } from './scenario/engine';
import { angerGauge, getScenario } from './scenario/registry';
import { createShop, SHOP_LAYOUT } from './scene/shop';
import { chooseSttDevice, chooseSttModel, STT_MODEL_MB } from './stt/modelChoice';
import { WhisperSTTProvider } from './stt/whisper';
import { PiperTTSProvider } from './tts/piper';
import { ProviderSpeaker, WebSpeechSpeaker } from './tts/speakers';
import type { Speaker } from './tts/types';
import { DebugHud } from './ui/debugHud';
import { FinalPanel } from './ui/finalPanel';
import { attachPanelPointer } from './ui/panelPointer';
import { createStartScreen } from './ui/startScreen';
import { SubtitlePanel } from './ui/subtitles';
import { createTextInput } from './ui/textInput';
import { getParam, hasFlag } from './util/params';
import { setupControllers } from './xr/controllers';
import { createXRContext } from './xr/context';
import { maybeInstallEmulator } from './xr/emulator';
import { PushToTalk } from './xr/ptt';

async function main(): Promise<void> {
  // Production: offline cache + COOP/COEP headers. The first visit reloads once.
  if (await registerServiceWorker()) return;
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app element');

  // The emulator must be installed before anything queries navigator.xr.
  await maybeInstallEmulator();
  const capabilities = await detectCapabilities();
  console.info('[TestWebVR] Capabilities', capabilities);
  const scenario = getScenario(getParam('scenario'));

  const ctx = createXRContext(app);
  createShop(ctx.scene);
  const controllers = setupControllers(ctx);
  const hud = hasFlag('debug') ? new DebugHud(ctx, controllers) : null;
  hud?.set('WebGPU', capabilities.webgpu);
  hud?.set('Multihilo', capabilities.crossOriginIsolated);

  const player = new AudioPlayer(getAudioContext());
  // Assigned by the preloader; `as` keeps TS from narrowing it to null at the use sites.
  let speaker = null as Speaker | null;
  const voiceLevel = () => speaker?.level() ?? 0;

  // The capsule shows up at once; the robot replaces it when its model has loaded.
  let avatar: AvatarController = new PlaceholderAvatar(voiceLevel);
  const placeAvatar = (next: AvatarController, frontExtent = 0.25) => {
    ctx.scene.remove(avatar.group);
    avatar = next;
    // Behind the counter, facing the user (+Z).
    avatar.group.position.set(0, 0, SHOP_LAYOUT.avatarFrontZ - frontExtent);
    ctx.scene.add(avatar.group);
  };
  placeAvatar(avatar);
  ctx.onFrame((dt, timeMs) => avatar.update(dt, timeMs));

  const subtitles = new SubtitlePanel();
  subtitles.group.position.set(0, SHOP_LAYOUT.subtitles.y, SHOP_LAYOUT.subtitles.z);
  subtitles.group.rotation.x = -0.12;
  ctx.scene.add(subtitles.group);

  const textMode = hasFlag('text');
  const piper = new PiperTTSProvider();
  const stt = textMode
    ? null
    : new WhisperSTTProvider(
        chooseSttModel(getParam('stt')),
        chooseSttDevice(getParam('sttdevice'), capabilities.webgpu),
      );
  hud?.set('Modelo', stt?.model ?? 'texto');
  hud?.set('Backend', stt?.device ?? '-');

  let sttError = null as Error | null;
  const preloader = new Preloader().add(delayTask('Preparando la escena', 300, 1));
  preloader.add({
    label: 'Cliente',
    weight: 1,
    async run() {
      try {
        const robot = await RobotAvatar.load(ctx.renderer, ctx.camera, voiceLevel);
        placeAvatar(robot, robot.frontExtent);
      } catch (err) {
        console.error('[TestWebVR] Avatar model failed to load, keeping the placeholder', err);
      }
    },
  });
  preloader.add({
    label: 'Voz del cliente',
    weight: 82,
    async run(onProgress) {
      try {
        await piper.load(onProgress);
        speaker = new ProviderSpeaker(piper, player);
      } catch (err) {
        console.error('[TestWebVR] Piper failed to load, trying speechSynthesis', err);
        speaker = await WebSpeechSpeaker.create();
      }
      hud?.set('Voz', speaker?.name ?? 'ninguna');
      if (!speaker) {
        start.warn('No hay voz disponible: el cliente hablará solo con subtítulos.', true);
      }
    },
  });
  if (stt) {
    preloader.add({
      label: 'Reconocimiento de voz',
      weight: STT_MODEL_MB[stt.model],
      async run(onProgress) {
        try {
          await stt.load(onProgress);
        } catch (err) {
          // Never block the start screen; the error is shown in the HUD (UX in T19).
          sttError = err instanceof Error ? err : new Error(String(err));
          console.error('[TestWebVR] STT failed to load', err);
          hud?.set('STT', 'error al cargar');
          start.warn(
            'No se ha podido cargar el reconocimiento de voz: el cliente no te oirá. ' +
              'Puedes reintentarlo o seguir en modo texto (?text=1).',
            true,
          );
        }
      },
    });
  }

  const start = createStartScreen(app, {
    renderer: ctx.renderer,
    preloader,
    capabilities,
    textMode,
    title: scenario.title,
    description: scenario.description,
  });

  const session = await start.ready;
  // A microphone that disappears (unplugged, revoked) would just record silence: say so.
  for (const track of session.microphone?.getAudioTracks() ?? []) {
    track.addEventListener('ended', () => {
      subtitles.setUser('(Se ha perdido el micrófono: sal de VR y vuelve a empezar)');
      hud?.set('Micro', 'perdido');
    });
  }
  const capture = session.microphone
    ? await AudioCapture.create(getAudioContext(), session.microphone)
    : null;
  let lastRecording: Recording | null = null;

  const ptt = new PushToTalk(ctx, controllers);
  const recorder = capture && {
    start: () => capture.start(),
    stop: async () => {
      const recording = await capture.stop();
      if (recording) lastRecording = recording;
      return recording;
    },
    discard: () => capture.discard(),
  };

  // End-of-conversation panel, in front of the customer, above the counter.
  const panel = new FinalPanel({
    onRestart: () => restart(),
    onDownloadLog: hud ? () => downloadSessionLog(run.log) : undefined,
  });
  panel.group.position.set(0, 1.42, SHOP_LAYOUT.subtitles.z - 0.15);
  ctx.scene.add(panel.group);
  attachPanelPointer(ctx, controllers, panel);

  /** One play-through: a fresh script state, log and conversation controller. */
  const createRun = () => {
    const engine = new ScenarioEngine(scenario);
    const log = new SessionLog({
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      sttModel: stt?.model ?? null,
      sttDevice: stt?.device ?? null,
      voice: speaker?.name ?? null,
      capabilities: { ...capabilities },
    });
    const conversation = new ConversationController({
      responder: engine,
      view: {
        setStatus: (status) => {
          subtitles.setStatus(status);
          avatar.setStatus(status);
          if (status === 'ended') showSummary(engine);
        },
        setUser: (text) => subtitles.setUser(text),
        setAvatar: (text) => subtitles.setAvatar(scenario.persona.name, text),
        onTurn: (turn) => {
          avatar.setEmotion(turn.emotion);
          if (turn.gesture) avatar.playGesture(turn.gesture);
          hud?.set('Enfado', angerGauge(engine.state.anger));
          hud?.set('Nodo', engine.state.nodeId);
        },
        setMetric: (key, value) => hud?.set(key, value),
      },
      speaker,
      stt: sttError ? null : stt,
      recorder,
      log,
      onBusy: () => ptt.buzzBusy(),
    });
    return { engine, log, conversation };
  };
  let run = createRun();

  const showSummary = (engine: ScenarioEngine) => {
    // The trigger now presses the panel buttons instead of talking.
    ptt.enabled = false;
    subtitles.group.visible = false;
    panel.show(buildSummary(scenario, engine.state));
  };

  const restart = () => {
    speaker?.stop();
    capture?.discard();
    panel.hide();
    subtitles.clear();
    subtitles.group.visible = true;
    avatar.setEmotion('neutral');
    run = createRun();
    ptt.enabled = true;
    void run.conversation.start();
  };

  ptt.on('start', () => run.conversation.pttStart());
  ptt.on('end', () => void run.conversation.pttEnd());
  ptt.on('cancel', () => run.conversation.pttCancel());
  capture?.onLimitReached((recording) => {
    if (recording) lastRecording = recording;
    void run.conversation.recordingLimitReached(recording);
  });
  if (session.textMode) createTextInput(app, (text) => void run.conversation.submitText(text));

  // The avatar greets the user once they are in VR (or right away on desktop text mode).
  let started = false;
  const startConversation = () => {
    if (started) return;
    started = true;
    void run.conversation.start();
  };
  ctx.renderer.xr.addEventListener('sessionstart', startConversation);
  // Leaving VR (Meta button, headset removed) must not leave the avatar talking or recording.
  ctx.renderer.xr.addEventListener('sessionend', () => {
    speaker?.stop();
    run.conversation.pttCancel();
  });
  if (session.textMode && !capabilities.immersiveVR) startConversation();

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    // R repeats the conversation from the final panel (desktop shortcut for the button).
    if (event.code === 'KeyR' && panel.visible) restart();
    if (!hud) return;
    // Debug: P replays the last recording exactly as the STT received it (16 kHz).
    if (event.code === 'KeyP' && lastRecording) playRecording(getAudioContext(), lastRecording);
    // Debug: L downloads the session log (latencies per turn) for the device checks.
    if (event.code === 'KeyL') downloadSessionLog(run.log);
  });

  if (hud) {
    // On the headset there is no keyboard: after leaving VR the start screen offers the log.
    const logButton = document.createElement('button');
    logButton.type = 'button';
    logButton.className = 'start-secondary';
    logButton.textContent = 'Descargar log de sesión';
    logButton.hidden = true;
    logButton.addEventListener('click', () => downloadSessionLog(run.log));
    start.root.querySelector('.start-card')?.append(logButton);
    ctx.renderer.xr.addEventListener('sessionend', () => (logButton.hidden = false));
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __app?: unknown }).__app = {
      ctx,
      controllers,
      capabilities,
      session,
      subtitles,
      hud,
      ptt,
      capture,
      player,
      piper,
      stt,
      scenario,
      panel,
      restart,
      startScreen: start,
      get log() {
        return run.log;
      },
      get conversation() {
        return run.conversation;
      },
      get engine() {
        return run.engine;
      },
      getAvatar: () => avatar,
      getSpeaker: () => speaker,
      getLastRecording: () => lastRecording,
    };
  }
}

main().catch((err: unknown) => {
  console.error('[TestWebVR] Startup failed', err);
});
