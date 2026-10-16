import { describe, expect, it } from 'vitest';
import scenarioJson from '../scenarios/devolucion-sin-ticket.json';
import { ScenarioEngine } from '../src/scenario/engine';
import type { Scenario } from '../src/scenario/types';
import { validateScenario } from '../src/scenario/validate';

const scenario = scenarioJson as Scenario;

/** Plays a conversation and returns what the customer said, turn by turn. */
function play(lines: string[]) {
  const engine = new ScenarioEngine(scenario, { random: () => 0 });
  const replies = [engine.start().text];
  for (const line of lines) {
    if (engine.state.ended) break;
    replies.push(engine.respond(line).text);
  }
  return { engine, replies, state: engine.state };
}

describe('scenario "Devolución sin ticket"', () => {
  it('is valid', () => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it('every node is reachable from the start', () => {
    const reachable = new Set<string>([scenario.start]);
    const queue = [scenario.start];
    const targets = (id: string) => [
      ...(scenario.nodes[id]?.intents ?? []).map((i) => i.next),
      ...(scenario.globalIntents ?? []).map((i) => i.next),
    ];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      for (const next of targets(id)) {
        if (next && !reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    reachable.add(scenario.endings.calmedNode);
    reachable.add(scenario.endings.escalatedNode);
    expect([...reachable].sort()).toEqual(Object.keys(scenario.nodes).sort());
  });

  it('good practice calms the customer down (empathy, listening, alternatives)', () => {
    const { state, replies } = play([
      'Buenos días, ¿en qué puedo ayudarle?',
      'Entiendo que esté molesto, tiene usted razón.',
      'No se preocupe. ¿Pagó con tarjeta? Podemos buscar la compra en el sistema.',
      'Perfecto, podemos cambiársela por otra nueva ahora mismo.',
      'No hace falta, ya está. Que tenga un buen día.',
    ]);
    expect(state.outcome).toBe('calmed');
    expect(state.turns.length).toBeLessThanOrEqual(5);
    expect(replies.at(-1)).toMatch(/gracias/i);
    expect(state.turns.flatMap((t) => t.kinds)).not.toContain('negative');
  });

  it('rigid, dismissive answers make the customer leave', () => {
    const { state, replies } = play([
      '¿Tiene el ticket?',
      'Sin ticket no puedo hacer nada, son las normas.',
      'Cálmese, por favor.',
    ]);
    expect(state.outcome).toBe('escalated');
    expect(replies.at(-1)).toMatch(/me voy|se acabó/i);
    expect(state.turns.flatMap((t) => t.kinds)).toContain('negative');
  });

  it('still works with typical speech-recognition errors', () => {
    // Real Whisper outputs seen in the round-trip test (no accents, odd splits, "tiquete").
    const { state } = play([
      'Bueno, si, ¿que puedo ayudarle?',
      'Entiendo que estoy molesto tiene que estar razon',
      'pago con tarjeta podemos buscarla en el sistema',
      'Podemos cambiarse la por otra',
      'gracias que tenga buen dia',
    ]);
    expect(state.outcome).toBe('calmed');
  });

  it('understands "tiquete" as asking for the ticket', () => {
    const { state } = play(['¿Tiene el tiquete compra?']);
    expect(state.nodeId).toBe('sin_ticket');
  });

  it('blaming the customer makes things worse', () => {
    const { state, replies } = play(['Eso es que la habrá usado mal']);
    expect(state.anger).toBeGreaterThan(scenario.initialAnger);
    expect(replies.at(-1)).toMatch(/mentiroso|culpa/i);
  });

  it('gives a hint after two misunderstandings', () => {
    const { replies } = play(['eh', 'mmm']);
    expect(replies.at(-1)).toMatch(/preguntar qué le pasa/i);
  });

  it('has tips for both endings', () => {
    expect(scenario.tips?.calmed.length).toBeGreaterThanOrEqual(2);
    expect(scenario.tips?.escalated.length).toBeGreaterThanOrEqual(2);
  });
});
