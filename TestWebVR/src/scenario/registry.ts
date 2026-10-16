import devolucionSinTicket from '../../scenarios/devolucion-sin-ticket.json';
import type { Scenario } from './types';

/** Scenarios bundled with the app, by id (`?scenario=<id>`). */
export const SCENARIOS: Readonly<Record<string, Scenario>> = {
  [devolucionSinTicket.id]: devolucionSinTicket as Scenario,
};

export const DEFAULT_SCENARIO = 'devolucion-sin-ticket';

/** The requested scenario, or the default one if the id is unknown. */
export function getScenario(id: string | null): Scenario {
  return (id && SCENARIOS[id]) || (SCENARIOS[DEFAULT_SCENARIO] as Scenario);
}

/** Text gauge for the debug HUD (only characters the 3D font supports). */
export function angerGauge(anger: number, max = 10): string {
  const filled = Math.max(0, Math.min(max, Math.round(anger)));
  return `${'='.repeat(filled)}${'·'.repeat(max - filled)} ${Math.round(anger * 10) / 10}`;
}
