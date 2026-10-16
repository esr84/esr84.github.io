import type { Emotion, Gesture } from '../app/conversation';

/** Something the user may say, recognised by key phrases. */
export interface ScenarioIntent {
  readonly id: string;
  /** Human-readable name for the final summary ("Mostrar empatía"). Defaults to the id. */
  readonly label?: string;
  /** Key phrases; matching is accent/punctuation-insensitive and tolerant to STT typos. */
  readonly keywords: readonly string[];
  /** Change in the customer's anger (0–10) when this intent is detected. */
  readonly anger?: number;
  /** Node to move to. Without it the conversation stays in the current node. */
  readonly next?: string;
  /** Reaction line(s). If absent, the avatar says the line(s) of the next node. */
  readonly say?: readonly string[];
  readonly gesture?: Gesture;
  /** Positive/negative for the final summary (good practice vs. mistake). */
  readonly kind?: 'positive' | 'negative' | 'neutral';
}

export interface ScenarioNode {
  readonly say: readonly string[];
  readonly gesture?: Gesture;
  readonly intents?: readonly ScenarioIntent[];
  /** When nothing matches. */
  readonly fallback?: { readonly say: readonly string[]; readonly anger?: number };
  /** Said instead of the fallback after `hintAfter` misses in a row. */
  readonly hint?: readonly string[];
  /** Ending node: the conversation is over after saying it. */
  readonly outcome?: 'calmed' | 'escalated';
  /** Forces an emotion for this node instead of deriving it from the anger level. */
  readonly emotion?: Emotion;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly persona: { readonly name: string };
  readonly initialAnger: number;
  readonly start: string;
  readonly endings: {
    /** Anger at or below this ends the conversation well. */
    readonly calmedAt: number;
    readonly calmedNode: string;
    /** Anger at or above this makes the customer leave. */
    readonly escalatedAt: number;
    readonly escalatedNode: string;
  };
  /** Misses in a row before the customer gives a hint. Default 2. */
  readonly hintAfter?: number;
  /** Recognised in every node: they change the anger but not the node (unless `next`). */
  readonly globalIntents?: readonly ScenarioIntent[];
  readonly nodes: Readonly<Record<string, ScenarioNode>>;
  /** Fixed tips for the final screen, by outcome. */
  readonly tips?: { readonly calmed: readonly string[]; readonly escalated: readonly string[] };
}

export interface TurnHistory {
  readonly userText: string;
  readonly node: string;
  readonly intent: string | null;
  readonly globals: readonly string[];
  readonly kinds: readonly ('positive' | 'negative' | 'neutral')[];
  readonly anger: number;
}

export interface ScenarioState {
  readonly nodeId: string;
  readonly anger: number;
  readonly ended: boolean;
  readonly outcome: 'calmed' | 'escalated' | null;
  readonly turns: readonly TurnHistory[];
}
