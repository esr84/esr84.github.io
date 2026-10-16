import { describe, expect, it } from 'vitest';
import { angerGauge, DEFAULT_SCENARIO, getScenario, SCENARIOS } from '../src/scenario/registry';
import { sanitizeForFont } from '../src/ui/textSanitize';

describe('scenario registry', () => {
  it('returns the requested scenario or the default one', () => {
    expect(getScenario('devolucion-sin-ticket').id).toBe('devolucion-sin-ticket');
    expect(getScenario(null).id).toBe(DEFAULT_SCENARIO);
    expect(getScenario('does-not-exist').id).toBe(DEFAULT_SCENARIO);
    expect(Object.keys(SCENARIOS)).toContain(DEFAULT_SCENARIO);
  });
});

describe('angerGauge', () => {
  it('draws a 10-step bar with the value', () => {
    expect(angerGauge(7)).toBe('=======··· 7');
    expect(angerGauge(0)).toBe('·········· 0');
    expect(angerGauge(12)).toBe('========== 12');
  });

  it('only uses characters the 3D font can render', () => {
    const gauge = angerGauge(4);
    expect(sanitizeForFont(gauge)).toBe(gauge);
  });
});
