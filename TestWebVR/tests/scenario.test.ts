import { describe, expect, it } from 'vitest';
import { emotionForAnger, ScenarioEngine } from '../src/scenario/engine';
import { matchKeywords } from '../src/scenario/matcher';
import type { Scenario } from '../src/scenario/types';
import { validateScenario } from '../src/scenario/validate';

/** Small scenario covering every engine feature. */
const scenario: Scenario = {
  id: 'test',
  title: 'Test',
  description: 'Test',
  persona: { name: 'Javier' },
  initialAnger: 6,
  start: 'inicio',
  hintAfter: 2,
  endings: { calmedAt: 2, calmedNode: 'fin_bien', escalatedAt: 10, escalatedNode: 'fin_mal' },
  globalIntents: [
    { id: 'disculpa', keywords: ['lo siento', 'disculpe'], anger: -1, kind: 'positive' },
    {
      id: 'insulto',
      keywords: ['tonto', 'pesado'],
      anger: 3,
      say: ['¿Encima me insulta?'],
      kind: 'negative',
    },
    { id: 'calmese', keywords: ['calmese', 'tranquilicese'], anger: 2, kind: 'negative' },
  ],
  nodes: {
    inicio: {
      say: ['¡Mi tostadora no funciona!'],
      intents: [
        {
          id: 'empatia',
          keywords: ['entiendo', 'tiene razon'],
          anger: -2,
          next: 'ticket',
          kind: 'positive',
        },
        { id: 'ticket', keywords: ['ticket', 'tiquet', 'factura'], anger: 1, next: 'sin_ticket' },
      ],
      fallback: { say: ['¿Me escucha?', '¡Oiga!'], anger: 1 },
      hint: ['¿Me va a ayudar o no?'],
    },
    ticket: {
      say: ['Gracias. ¿Qué necesita?', 'Vale, ¿qué hago?'],
      intents: [
        { id: 'cambio', keywords: ['cambiar', 'cambio', 'otra'], anger: -3, next: 'fin_bien' },
      ],
      fallback: { say: ['¿Y bien?'] },
    },
    sin_ticket: {
      say: ['¡No tengo ticket!'],
      intents: [
        { id: 'alternativa', keywords: ['tarjeta', 'extracto'], anger: -2, next: 'ticket' },
      ],
      fallback: { say: ['¿Entonces qué?'], anger: 1 },
    },
    fin_bien: { say: ['Muchas gracias.'], outcome: 'calmed', gesture: 'yes' },
    fin_mal: { say: ['¡Me voy!'], outcome: 'escalated', gesture: 'no' },
  },
};

const engine = () => new ScenarioEngine(scenario, { random: () => 0 });

describe('matchKeywords', () => {
  it('ignores case, accents and punctuation', () => {
    expect(matchKeywords('¡TIENE RAZÓN!', ['tiene razon']).score).toBeGreaterThan(0);
  });

  it('tolerates STT typos on long words', () => {
    expect(matchKeywords('quiere la fractura', ['factura']).score).toBeGreaterThan(0);
    expect(matchKeywords('lo comprendemos', ['comprendo']).score).toBe(0);
  });

  it('does not use fuzzy matching on short words', () => {
    expect(matchKeywords('es otro', ['otra']).score).toBe(0);
  });

  it('requires multi-word phrases to be consecutive', () => {
    expect(matchKeywords('lo siento mucho', ['lo siento']).score).toBe(2);
    expect(matchKeywords('lo que siento', ['lo siento']).score).toBe(0);
  });

  it('skips matches preceded by a negation', () => {
    expect(matchKeywords('no entiendo nada', ['entiendo']).score).toBe(0);
    expect(matchKeywords('yo nunca le entiendo', ['entiendo']).score).toBe(0);
    expect(matchKeywords('le entiendo', ['entiendo']).score).toBeGreaterThan(0);
  });

  it('keeps phrases that contain the negation themselves', () => {
    expect(matchKeywords('no se preocupe', ['no se preocupe']).score).toBeGreaterThan(0);
  });

  it('prefers the longer (more specific) keyword', () => {
    expect(matchKeywords('tiene usted razon', ['razon', 'usted razon']).keyword).toBe(
      'usted razon',
    );
  });
});

describe('validateScenario', () => {
  it('accepts a valid scenario', () => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it('reports readable errors', () => {
    const broken = {
      ...scenario,
      start: 'nope',
      nodes: {
        ...scenario.nodes,
        inicio: {
          say: [],
          intents: [
            { id: 'a', keywords: [], next: 'missing' },
            { id: 'a', keywords: [' '] },
          ],
        },
      },
    } as Scenario;
    const errors = validateScenario(broken);
    expect(errors).toEqual(
      expect.arrayContaining([
        'El nodo inicial "nope" no existe.',
        'Nodo "inicio": no tiene frases ("say").',
        'Nodo "inicio": no tiene "fallback".',
        'Nodo "inicio": la intención "a" no tiene palabras clave.',
        'Nodo "inicio": la intención "a" lleva a "missing", que no existe.',
        'Nodo "inicio": la intención "a" está repetida.',
        'Nodo "inicio": la intención "a" tiene una palabra clave vacía.',
      ]),
    );
  });

  it('checks the anger thresholds', () => {
    const bad = { ...scenario, initialAnger: 1 };
    expect(validateScenario(bad)).toContain(
      'Debe cumplirse calmedAt < initialAnger < escalatedAt.',
    );
  });

  it('makes the engine refuse invalid scenarios', () => {
    expect(() => new ScenarioEngine({ ...scenario, start: 'nope' })).toThrow(/no válido/);
  });
});

describe('ScenarioEngine', () => {
  it('starts with the start node line', () => {
    const e = engine();
    expect(e.start().text).toBe('¡Mi tostadora no funciona!');
    expect(e.state).toMatchObject({ nodeId: 'inicio', anger: 6, ended: false });
  });

  it('moves on a node intent and changes the anger', () => {
    const e = engine();
    e.start();
    const turn = e.respond('Le entiendo perfectamente');
    expect(turn.text).toBe('Gracias. ¿Qué necesita?');
    expect(e.state).toMatchObject({ nodeId: 'ticket', anger: 4 });
    expect(turn.extra).toMatchObject({ intent: 'empatia', anger: 4, node: 'ticket' });
  });

  it('applies global intents together with node intents', () => {
    const e = engine();
    e.start();
    e.respond('Lo siento, le entiendo');
    expect(e.state.anger).toBe(3); // 6 - 1 (disculpa) - 2 (empatía)
    expect(e.state.turns[0]?.globals).toEqual(['disculpa']);
  });

  it('reacts to a global intent with its own line without changing node', () => {
    const e = engine();
    e.start();
    const turn = e.respond('es usted un pesado');
    expect(turn.text).toBe('¿Encima me insulta?');
    expect(e.state).toMatchObject({ nodeId: 'inicio', anger: 9 });
  });

  it('"cálmese" raises the anger', () => {
    const e = engine();
    e.start();
    e.respond('Cálmese, señor');
    expect(e.state.anger).toBe(8); // +2, and no extra "not understood" penalty
  });

  it('does not punish a recognised global intent as "not understood"', () => {
    const e = engine();
    e.start();
    const turn = e.respond('lo siento');
    expect(e.state.anger).toBe(5);
    expect(turn.text).toBe('¿Me escucha?');
  });

  it('uses fallbacks without repeating, then a hint after N misses', () => {
    const e = engine();
    e.start();
    const first = e.respond('bla bla').text;
    const second = e.respond('ble ble').text;
    expect(first).toBe('¿Me escucha?');
    // hintAfter = 2 → the second miss gives the hint instead of a fallback.
    expect(second).toBe('¿Me va a ayudar o no?');
    const third = e.respond('bli bli').text;
    expect(third).toBe('¡Oiga!');
  });

  it('tolerates STT errors when matching', () => {
    const e = engine();
    e.start();
    e.respond('¿tiene el tiquet de compra?');
    expect(e.state.nodeId).toBe('sin_ticket');
  });

  it('ends well when the anger drops to the threshold', () => {
    const e = engine();
    e.start();
    e.respond('le entiendo'); // 4
    const turn = e.respond('se la podemos cambiar por otra'); // 1 → calmed
    expect(turn).toMatchObject({ text: 'Muchas gracias.', final: true, emotion: 'grateful' });
    expect(e.state).toMatchObject({ ended: true, outcome: 'calmed', nodeId: 'fin_bien' });
  });

  it('ends badly when the anger reaches the maximum', () => {
    const e = engine();
    e.start();
    e.respond('qué pesado'); // 9
    const turn = e.respond('tonto'); // 12 → clamp 10 → escalated
    expect(turn).toMatchObject({ text: '¡Me voy!', final: true, emotion: 'angry', gesture: 'no' });
    expect(e.state).toMatchObject({ outcome: 'escalated', anger: 10 });
  });

  it('clamps the anger between 0 and 10', () => {
    const e = new ScenarioEngine(
      { ...scenario, initialAnger: 1, endings: { ...scenario.endings, calmedAt: -1 } },
      { random: () => 0 },
    );
    e.start();
    e.respond('lo siento');
    e.respond('lo siento');
    expect(e.state.anger).toBe(0);
  });

  it('stops rewarding the same calming intent after two uses', () => {
    const e = engine();
    e.start();
    for (let i = 0; i < 5; i++) e.respond('lo siento');
    expect(e.state.anger).toBe(4); // 6 - 1 - 1, then no effect
  });

  it('always applies anger increases', () => {
    const e = engine();
    e.start();
    e.respond('cálmese'); // 8
    e.respond('cálmese'); // 10 → escalated
    expect(e.state.outcome).toBe('escalated');
  });

  it('records the history for the final summary', () => {
    const e = engine();
    e.start();
    e.respond('lo siento, le entiendo');
    expect(e.state.turns[0]).toMatchObject({
      intent: 'empatia',
      kinds: ['positive', 'positive'],
      anger: 3,
    });
  });

  it('returns an empty final turn after the end', () => {
    const e = engine();
    e.start();
    e.respond('pesado');
    e.respond('tonto');
    expect(e.respond('hola')).toMatchObject({ text: '', final: true });
  });
});

describe('emotionForAnger', () => {
  it.each([
    [10, 'angry'],
    [8, 'angry'],
    [6, 'annoyed'],
    [3, 'neutral'],
    [1, 'calm'],
  ] as const)('%i → %s', (anger, emotion) => {
    expect(emotionForAnger(anger)).toBe(emotion);
  });
});
