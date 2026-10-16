/** Conversation states shown to the user (see the state machine in docs/PLAN.md §2). */
export type ConversationStatus =
  'intro' | 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'ended';

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  intro: 'Preparando…',
  idle: 'Mantén el gatillo para hablar',
  listening: 'Escuchando…',
  transcribing: 'Transcribiendo…',
  thinking: 'Pensando…',
  speaking: 'Hablando…',
  ended: 'Conversación terminada',
};

export const STATUS_COLORS: Record<ConversationStatus, number> = {
  intro: 0x9aa4b2,
  idle: 0x9aa4b2,
  listening: 0xff5a5a,
  transcribing: 0xffc04d,
  thinking: 0xffc04d,
  speaking: 0x4fd18b,
  ended: 0x9aa4b2,
};
