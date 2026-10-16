import type { Scenario, ScenarioIntent, ScenarioState } from '../scenario/types';

export interface ConversationSummary {
  readonly outcome: 'calmed' | 'escalated' | null;
  readonly headline: string;
  readonly turns: number;
  /** Anger at the start and after each turn, for the sparkline. */
  readonly angerCurve: readonly number[];
  /** Distinct good practices / mistakes detected, in the order they happened. */
  readonly positives: readonly string[];
  readonly negatives: readonly string[];
  readonly tips: readonly string[];
}

function intentIndex(scenario: Scenario): Map<string, ScenarioIntent> {
  const index = new Map<string, ScenarioIntent>();
  for (const intent of scenario.globalIntents ?? []) index.set(intent.id, intent);
  for (const node of Object.values(scenario.nodes)) {
    for (const intent of node.intents ?? [])
      if (!index.has(intent.id)) index.set(intent.id, intent);
  }
  return index;
}

/** Builds the final screen content from the scenario history (pure, unit tested). */
export function buildSummary(scenario: Scenario, state: ScenarioState): ConversationSummary {
  const index = intentIndex(scenario);
  const positives: string[] = [];
  const negatives: string[] = [];
  for (const turn of state.turns) {
    const ids = [...turn.globals, ...(turn.intent ? [turn.intent] : [])];
    for (const id of ids) {
      const intent = index.get(id);
      if (!intent) continue;
      const label = intent.label ?? intent.id;
      if (intent.kind === 'positive' && !positives.includes(label)) positives.push(label);
      if (intent.kind === 'negative' && !negatives.includes(label)) negatives.push(label);
    }
  }
  const name = scenario.persona.name;
  const headline =
    state.outcome === 'calmed'
      ? `¡Conseguido! ${name} se va satisfecho`
      : state.outcome === 'escalated'
        ? `${name} se ha ido enfadado`
        : 'Conversación sin terminar';
  const tips =
    state.outcome === 'calmed'
      ? (scenario.tips?.calmed ?? [])
      : state.outcome === 'escalated'
        ? (scenario.tips?.escalated ?? [])
        : [];
  return {
    outcome: state.outcome,
    headline,
    turns: state.turns.length,
    angerCurve: [scenario.initialAnger, ...state.turns.map((t) => t.anger)],
    positives,
    negatives,
    tips: tips.slice(0, 3),
  };
}
