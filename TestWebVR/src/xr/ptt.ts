import type { XRContext } from './context';
import type { Controllers } from './controllers';
import { PttStateMachine, type PttEvent, type PttOptions } from './pttMachine';

type PttEventType = PttEvent['type'];
type Listener<T extends PttEventType> = (event: Extract<PttEvent, { type: T }>) => void;

interface HapticActuatorLike {
  pulse?(value: number, duration: number): Promise<boolean>;
}

/**
 * Push-to-talk input: hold the right controller trigger (or Space on desktop) to talk.
 * Emits `start` on press, then `end` on release, or `cancel` for accidental short presses
 * and interruptions. Gives a short haptic pulse on start and end.
 */
export class PushToTalk {
  private readonly machine: PttStateMachine;
  private readonly listeners = new Map<PttEventType, Set<(event: PttEvent) => void>>();
  /** Input source that started the current press, used for the haptic pulse on release. */
  private activeSource: XRInputSource | null = null;

  constructor(ctx: XRContext, controllers: Controllers, options?: PttOptions) {
    this.machine = new PttStateMachine(options);

    for (const handle of controllers.all) {
      handle.ray.addEventListener('selectstart', (event) => {
        const source = event.data ?? handle.inputSource;
        if (source?.handedness !== 'right' || !this.enabled) return;
        this.activeSource = source;
        this.dispatch(this.machine.press(performance.now()));
      });
      handle.ray.addEventListener('selectend', (event) => {
        const source = event.data ?? handle.inputSource;
        if (source?.handedness !== 'right') return;
        this.dispatch(this.machine.release(performance.now()));
      });
    }

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target) || !this.enabled) return;
      event.preventDefault();
      this.dispatch(this.machine.press(performance.now()));
    });
    window.addEventListener('keyup', (event) => {
      if (event.code !== 'Space' || isTyping(event.target)) return;
      this.dispatch(this.machine.release(performance.now()));
    });
    // Never leave the microphone "stuck open".
    window.addEventListener('blur', () => this.dispatch(this.machine.interrupt(performance.now())));
    ctx.renderer.xr.addEventListener('sessionend', () =>
      this.dispatch(this.machine.interrupt(performance.now())),
    );
  }

  /** When false, the trigger does not talk (e.g. it is pressing buttons on the final panel). */
  enabled = true;

  get pressed(): boolean {
    return this.machine.pressed;
  }

  /** Two short pulses: "I can't listen right now" (the avatar is still thinking). */
  buzzBusy(): void {
    this.pulse(0.6, 30);
    setTimeout(() => this.pulse(0.6, 30), 90);
  }

  on<T extends PttEventType>(type: T, listener: Listener<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    const wrapped = listener as (event: PttEvent) => void;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  private dispatch(event: PttEvent | null): void {
    if (!event) return;
    this.pulse(event.type === 'start' ? 0.35 : 0.2, event.type === 'start' ? 40 : 25);
    if (event.type !== 'start') this.activeSource = null;
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }

  private pulse(intensity: number, durationMs: number): void {
    const actuators = this.activeSource?.gamepad?.hapticActuators as
      readonly HapticActuatorLike[] | undefined;
    actuators?.[0]?.pulse?.(intensity, durationMs).catch(() => undefined);
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
