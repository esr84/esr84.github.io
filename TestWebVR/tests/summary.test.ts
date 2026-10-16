import { describe, expect, it } from 'vitest';
import scenarioJson from '../scenarios/devolucion-sin-ticket.json';
import { buildSummary } from '../src/app/summary';
import { ScenarioEngine } from '../src/scenario/engine';
import type { Scenario } from '../src/scenario/types';

const scenario = scenarioJson as Scenario;

function play(lines: string[]) {
  const engine = new ScenarioEngine(scenario, { random: () => 0 });
  engine.start();
  for (const line of lines) if (!engine.state.ended) engine.respond(line);
  return buildSummary(scenario, engine.state);
}

describe('buildSummary', () => {
  it('summarises a successful conversation', () => {
    const summary = play([
      'Buenos días, ¿en qué puedo ayudarle?',
      'Entiendo que esté molesto, tiene usted razón.',
      'No se preocupe. ¿Pagó con tarjeta? Podemos buscar la compra en el sistema.',
      'Podemos cambiársela por otra nueva.',
    ]);
    expect(summary.outcome).toBe('calmed');
    expect(summary.headline).toMatch(/Conseguido/);
    expect(summary.turns).toBe(4);
    expect(summary.angerCurve[0]).toBe(7);
    expect(summary.angerCurve.at(-1)).toBe(0);
    expect(summary.positives).toEqual(
      expect.arrayContaining(['Preguntar qué ha pasado', 'Validar su enfado', 'Ofrecer un cambio']),
    );
    expect(summary.negatives).toEqual([]);
    expect(summary.tips.length).toBeGreaterThan(0);
  });

  it('lists each mistake once', () => {
    const summary = play(['Eso es que la habrá usado mal', 'Seguro que la habrá usado mal']);
    expect(summary.outcome).toBe('escalated');
    expect(summary.headline).toMatch(/se ha ido/);
    expect(summary.negatives).toEqual(['Culpar al cliente']);
    expect(summary.angerCurve).toEqual([7, 9, 10]);
  });

  it('lists different mistakes in order', () => {
    const summary = play(['¿Tiene el ticket?', 'Cálmese, por favor']);
    expect(summary.negatives).toEqual(['Pedir el ticket lo primero', 'Decirle que se calme']);
    expect(summary.outcome).toBe('escalated');
  });

  it('handles an unfinished conversation', () => {
    const summary = play(['hola']);
    expect(summary.outcome).toBeNull();
    expect(summary.tips).toEqual([]);
  });
});
