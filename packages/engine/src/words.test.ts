import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PUBLIC_WORD_CATEGORIES, WORD_CATEGORY_IDS } from '@rene/contracts';
import { LEGACY_WORD_PAIRS, WORD_HISTORY_LIMIT, WORD_PAIRS, auditWordLibrary, chooseWordPair, matchingWordPairs, recordWordSelection, type WordPair } from './words.js';

const fixture: readonly WordPair[] = [
  { id: 'fixture-nature-one', a: 'Alpha', b: 'Bêta', category: 'nature', difficulty: 'easy' },
  { id: 'fixture-nature-two', a: 'Gamma', b: 'Delta', category: 'nature', difficulty: 'hard' },
  { id: 'fixture-cinema', a: 'Epsilon', b: 'Zêta', category: 'cinema', difficulty: 'easy' },
  { id: 'fixture-sport', a: 'Eta', b: 'Thêta', category: 'sport', difficulty: 'easy' },
  { id: 'fixture-adult', a: 'Iota', b: 'Kappa', category: 'adulte', difficulty: 'easy' },
];

describe('server-only word themes', () => {
  it('audits the complete library without exposing editorial text in diagnostics', () => {
    expect(LEGACY_WORD_PAIRS).toHaveLength(120);
    expect(WORD_PAIRS).toHaveLength(1659);
    expect(WORD_PAIRS.filter(pair => pair.category === 'adulte')).toHaveLength(40);
    expect(auditWordLibrary(WORD_PAIRS)).toEqual([]);
    for (const pair of LEGACY_WORD_PAIRS) expect(WORD_PAIRS.find(item => item.id === pair.id)).toEqual(pair);
  });

  it('provides every theme at every difficulty with adult inclusion always explicit', () => {
    for (const category of WORD_CATEGORY_IDS) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pair = chooseWordPair({ category: 'all', categories: [category], adultContent: category === 'adulte', difficulty }, [], () => 0);
        expect(pair.category).toBe(category);
        expect(pair.difficulty).toBe(difficulty);
      }
    }
  });

  it('excludes every adult association from defaults and from all classic-only filters', () => {
    const defaults = matchingWordPairs(DEFAULT_SETTINGS);
    expect(defaults).toHaveLength(1619);
    expect(defaults.every(pair => pair.category !== 'adulte')).toBe(true);
    for (const category of PUBLIC_WORD_CATEGORIES) {
      expect(matchingWordPairs({ ...DEFAULT_SETTINGS, category }).every(pair => pair.category === category)).toBe(true);
    }
    expect(matchingWordPairs({ ...DEFAULT_SETTINGS, categories: ['adulte'] })).toEqual([]);
    expect(() => chooseWordPair({ ...DEFAULT_SETTINGS, categories: ['adulte'] }, [])).toThrow('Aucune paire');
  });

  it('draws only from the union of chosen themes intersected with difficulty', () => {
    const settings = { ...DEFAULT_SETTINGS, category: 'sport' as const, categories: ['nature', 'cinema'] as const, difficulty: 'easy' as const };
    expect(matchingWordPairs(settings, fixture).map(pair => pair.id)).toEqual(['fixture-nature-one', 'fixture-cinema']);
    expect(chooseWordPair(settings, [], () => 0, fixture).id).toBe('fixture-nature-one');
    expect(chooseWordPair(settings, [], () => .99, fixture).id).toBe('fixture-cinema');
    expect(matchingWordPairs({ ...settings, categories: ['adulte'], adultContent: true }, fixture).map(pair => pair.id)).toEqual(['fixture-adult']);
    expect(matchingWordPairs({ ...settings, adultContent: true }, fixture).some(pair => pair.category === 'adulte')).toBe(false);
  });

  it('keeps all no-repeat cycles and handles filters changing and a one-pair pool', () => {
    const settings = { ...DEFAULT_SETTINGS, categories: ['nature', 'cinema'] as const };
    const pool = matchingWordPairs(settings, fixture);
    const history: string[] = ['fixture-adult', 'unrelated'];
    for (let cycle = 0; cycle < 3; cycle++) {
      const selection = [];
      for (let index = 0; index < pool.length; index++) {
        const pair = chooseWordPair(settings, history, () => .7, fixture);
        selection.push(pair.id); history.push(pair.id);
      }
      expect(new Set(selection).size).toBe(pool.length);
    }
    expect(chooseWordPair({ ...DEFAULT_SETTINGS, categories: ['sport'] }, history, () => .5, fixture).id).toBe('fixture-sport');
    expect(chooseWordPair({ ...DEFAULT_SETTINGS, categories: ['sport'] }, ['fixture-sport'], () => .5, fixture).id).toBe('fixture-sport');
    expect(() => chooseWordPair(settings, [], () => 1, fixture)).toThrow('générateur aléatoire');
  });

  it('retains more than an expanded catalogue cycle while bounding chronological history', () => {
    expect(WORD_HISTORY_LIMIT).toBeGreaterThan(WORD_PAIRS.length);
    const history: string[] = [];
    for (let index = 0; index < WORD_HISTORY_LIMIT + 20; index++) recordWordSelection(history, `fixture-${index}`);
    expect(history).toHaveLength(WORD_HISTORY_LIMIT);
    expect(history[0]).toBe('fixture-20');
    expect(history.at(-1)).toBe(`fixture-${WORD_HISTORY_LIMIT + 19}`);
  });
});
