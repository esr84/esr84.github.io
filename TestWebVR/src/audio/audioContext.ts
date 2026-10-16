let context: AudioContext | null = null;

/** Shared AudioContext. Call `resumeAudio()` from a user gesture before playing anything. */
export function getAudioContext(): AudioContext {
  context ??= new AudioContext({ latencyHint: 'interactive' });
  return context;
}

export async function resumeAudio(): Promise<AudioContext> {
  const ctx = getAudioContext();
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
}
