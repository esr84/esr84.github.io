import type { AvatarTurn, Emotion, Responder } from '../app/conversation';
import { matchKeywords } from './matcher';
import type { Scenario, ScenarioIntent, ScenarioState, TurnHistory } from './types';
import { validateScenario } from './validate';

export const MAX_ANGER = 10;
/** An intent only lowers the anger the first N times: repeating the same thing stops working. */
export const MAX_CALMING_USES = 2;

/** Facial emotion derived from the anger level (0 calm … 10 furious). */
export function emotionForAnger(anger: number): Emotion {
  if (anger >= 8) return 'angry';
  if (anger >= 5) return 'annoyed';
  if (anger >= 3) return 'neutral';
  return 'calm';
}

/** Picks variants without repeating until all have been used. */
class VariantPicker {
  private readonly used = new Map<string, Set<number>>();

  constructor(private readonly random: () => number) {}

  pick(key: string, options: readonly string[]): string {
    if (options.length === 0) return '';
    let used = this.used.get(key);
    if (!used || used.size >= options.length) {
      used = new Set();
      this.used.set(key, used);
    }
    const free = options.map((_, i) => i).filter((i) => !used.has(i));
    const index = free[Math.floor(this.random() * free.length)] ?? 0;
    used.add(index);
    return options[index] ?? options[0] ?? '';
  }
}

export interface ScenarioEngineOptions {
  /** Injectable RNG for deterministic tests. */
  readonly random?: () => number;
}

/**
 * Keyword-driven conversation script (docs/PLAN.md §4). Pure TypeScript: no DOM or Three.
 * Node intents take priority over global ones; global intents only change the anger unless
 * they have their own reaction; after `hintAfter` misses in a row the customer gives a hint.
 */
export class ScenarioEngine implements Responder {
  private nodeId: string;
  private anger: number;
  private ended = false;
  private outcome: 'calmed' | 'escalated' | null = null;
  private misses = 0;
  private readonly turns: TurnHistory[] = [];
  private readonly uses = new Map<string, number>();
  private readonly variants: VariantPicker;

  constructor(
    readonly scenario: Scenario,
    options: ScenarioEngineOptions = {},
  ) {
    const errors = validateScenario(scenario);
    if (errors.length > 0) {
      throw new Error(`Escenario "${scenario.id}" no válido:\n- ${errors.join('\n- ')}`);
    }
    this.nodeId = scenario.start;
    this.anger = scenario.initialAnger;
    this.variants = new VariantPicker(options.random ?? Math.random);
  }

  get state(): ScenarioState {
    return {
      nodeId: this.nodeId,
      anger: this.anger,
      ended: this.ended,
      outcome: this.outcome,
      turns: this.turns,
    };
  }

  start(): AvatarTurn {
    const node = this.node(this.nodeId);
    return this.turn(this.variants.pick(`node:${this.nodeId}`, node.say), node.gesture, null);
  }

  respond(userText: string): AvatarTurn {
    if (this.ended) {
      return { text: '', emotion: emotionForAnger(this.anger), final: true };
    }
    const fromId = this.nodeId;
    const node = this.node(fromId);
    const nodeMatch = this.bestIntent(userText, node.intents ?? []);
    const globals = (this.scenario.globalIntents ?? []).filter(
      (intent) => matchKeywords(userText, intent.keywords).score > 0,
    );

    for (const intent of globals) this.applyIntent(intent);
    let text: string;
    let gesture = node.gesture;
    let intentId: string | null = null;

    if (nodeMatch) {
      intentId = nodeMatch.id;
      this.misses = 0;
      this.applyIntent(nodeMatch);
      if (nodeMatch.next) this.nodeId = nodeMatch.next;
      const target = this.node(this.nodeId);
      gesture = nodeMatch.gesture ?? target.gesture;
      text = nodeMatch.say
        ? this.variants.pick(`intent:${fromId}:${nodeMatch.id}`, nodeMatch.say)
        : this.variants.pick(`node:${this.nodeId}`, target.say);
    } else if (globals.some((g) => g.say || g.next)) {
      const reacting = globals.find((g) => g.say || g.next) as ScenarioIntent;
      intentId = reacting.id;
      this.misses = 0;
      if (reacting.next) this.nodeId = reacting.next;
      gesture = reacting.gesture ?? gesture;
      text = reacting.say
        ? this.variants.pick(`global:${reacting.id}`, reacting.say)
        : this.variants.pick(`node:${this.nodeId}`, this.node(this.nodeId).say);
    } else if (globals.length > 0) {
      // Recognised (e.g. an apology) but without its own reaction: no "not understood"
      // penalty, the customer just insists with the node's reprompt line.
      this.misses = 0;
      text = this.variants.pick(`fallback:${this.nodeId}`, node.fallback?.say ?? node.say);
    } else {
      this.misses++;
      this.addAnger(node.fallback?.anger ?? 0);
      const hintAfter = this.scenario.hintAfter ?? 2;
      if (node.hint && this.misses >= hintAfter) {
        this.misses = 0;
        text = this.variants.pick(`hint:${this.nodeId}`, node.hint);
      } else {
        text = this.variants.pick(`fallback:${this.nodeId}`, node.fallback?.say ?? node.say);
      }
    }

    const kinds = [...globals, ...(nodeMatch ? [nodeMatch] : [])].map((i) => i.kind ?? 'neutral');
    this.turns.push({
      userText,
      node: this.nodeId,
      intent: intentId,
      globals: globals.map((g) => g.id),
      kinds,
      anger: this.anger,
    });

    // Endings by anger threshold override whatever the node would say.
    const { endings } = this.scenario;
    if (this.anger <= endings.calmedAt) {
      return this.finish(endings.calmedNode, 'calmed', intentId);
    }
    if (this.anger >= endings.escalatedAt) {
      return this.finish(endings.escalatedNode, 'escalated', intentId);
    }
    const current = this.node(this.nodeId);
    if (current.outcome) return this.finish(this.nodeId, current.outcome, intentId, text);
    return this.turn(text, gesture, intentId);
  }

  private bestIntent(text: string, intents: readonly ScenarioIntent[]): ScenarioIntent | null {
    let best: ScenarioIntent | null = null;
    let bestScore = 0;
    for (const intent of intents) {
      const { score } = matchKeywords(text, intent.keywords);
      if (score > bestScore) {
        best = intent;
        bestScore = score;
      }
    }
    return best;
  }

  private finish(
    nodeId: string,
    outcome: 'calmed' | 'escalated',
    intent: string | null,
    text?: string,
  ): AvatarTurn {
    this.nodeId = nodeId;
    this.ended = true;
    this.outcome = outcome;
    const node = this.node(nodeId);
    const line = text ?? this.variants.pick(`node:${nodeId}`, node.say);
    return {
      text: line,
      emotion: node.emotion ?? (outcome === 'calmed' ? 'grateful' : 'angry'),
      gesture: node.gesture,
      final: true,
      extra: this.extra(intent),
    };
  }

  private turn(text: string, gesture: AvatarTurn['gesture'], intent: string | null): AvatarTurn {
    const node = this.node(this.nodeId);
    return {
      text,
      emotion: node.emotion ?? emotionForAnger(this.anger),
      gesture,
      extra: this.extra(intent),
    };
  }

  private extra(intent: string | null): Record<string, unknown> {
    const last = this.turns.at(-1);
    return { node: this.nodeId, intent, anger: this.anger, globals: last?.globals ?? [] };
  }

  /** Applies an intent's anger change, with diminishing returns for calming intents. */
  private applyIntent(intent: ScenarioIntent): void {
    const delta = intent.anger ?? 0;
    const used = this.uses.get(intent.id) ?? 0;
    this.uses.set(intent.id, used + 1);
    if (delta < 0 && used >= MAX_CALMING_USES) return;
    this.addAnger(delta);
  }

  private addAnger(delta: number): void {
    this.anger = Math.max(0, Math.min(MAX_ANGER, this.anger + delta));
  }

  private node(id: string) {
    const node = this.scenario.nodes[id];
    if (!node) throw new Error(`Nodo "${id}" no existe`);
    return node;
  }
}
