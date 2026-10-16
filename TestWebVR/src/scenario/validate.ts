import type { Scenario, ScenarioIntent } from './types';

/**
 * Checks a scenario JSON for authoring mistakes and returns readable Spanish errors
 * (the scenario files are meant to be edited by the team).
 */
export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = [];
  const nodes = scenario.nodes ?? {};
  const has = (id: string | undefined) => id !== undefined && id in nodes;

  if (!scenario.id) errors.push('Falta "id".');
  if (!scenario.persona?.name) errors.push('Falta "persona.name".');
  if (!has(scenario.start)) errors.push(`El nodo inicial "${scenario.start}" no existe.`);
  if (!(scenario.initialAnger >= 0 && scenario.initialAnger <= 10)) {
    errors.push('"initialAnger" debe estar entre 0 y 10.');
  }
  const e = scenario.endings;
  if (!e) {
    errors.push('Falta "endings".');
  } else {
    if (!has(e.calmedNode)) errors.push(`El nodo final "${e.calmedNode}" no existe.`);
    if (!has(e.escalatedNode)) errors.push(`El nodo final "${e.escalatedNode}" no existe.`);
    if (!(e.calmedAt < scenario.initialAnger && scenario.initialAnger < e.escalatedAt)) {
      errors.push('Debe cumplirse calmedAt < initialAnger < escalatedAt.');
    }
  }

  const checkIntent = (intent: ScenarioIntent, where: string) => {
    if (!intent.id) errors.push(`${where}: una intención no tiene "id".`);
    if (!intent.keywords || intent.keywords.length === 0) {
      errors.push(`${where}: la intención "${intent.id}" no tiene palabras clave.`);
    } else if (intent.keywords.some((k) => !k.trim())) {
      errors.push(`${where}: la intención "${intent.id}" tiene una palabra clave vacía.`);
    }
    if (intent.next !== undefined && !has(intent.next)) {
      errors.push(`${where}: la intención "${intent.id}" lleva a "${intent.next}", que no existe.`);
    }
    if (intent.say !== undefined && intent.say.length === 0) {
      errors.push(`${where}: la intención "${intent.id}" tiene "say" vacío.`);
    }
  };

  for (const intent of scenario.globalIntents ?? []) checkIntent(intent, 'globalIntents');
  for (const [id, node] of Object.entries(nodes)) {
    if (!node.say || node.say.length === 0) errors.push(`Nodo "${id}": no tiene frases ("say").`);
    if (!node.outcome) {
      if (!node.intents || node.intents.length === 0) {
        errors.push(`Nodo "${id}": no tiene intenciones y no es final.`);
      }
      if (!node.fallback || node.fallback.say.length === 0) {
        errors.push(`Nodo "${id}": no tiene "fallback".`);
      }
    }
    const seen = new Set<string>();
    for (const intent of node.intents ?? []) {
      if (seen.has(intent.id))
        errors.push(`Nodo "${id}": la intención "${intent.id}" está repetida.`);
      seen.add(intent.id);
      checkIntent(intent, `Nodo "${id}"`);
    }
  }
  return errors;
}
