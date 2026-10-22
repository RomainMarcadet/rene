import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@rene/contracts';
import { WORD_PAIRS, NEW_WORD_PAIRS, LEGACY_WORD_PAIRS, WORD_HISTORY_LIMIT, auditWordLibrary, chooseWordPair, libraryStatistics, normalizeWordKey, pairKey, recordWordSelection, type WordPair } from './words.js';
import { createGame, privateGame, publicGame } from './game.js';
import { isAcceptableWhiteGuess } from './whiteGuess.js';
import review from './editorial-review.json';

const originalNew = NEW_WORD_PAIRS.filter(pair => pair.id.startsWith('v14-'));
// The only category reclassification does not change the original editorial balance.
const originalCategories = originalNew.map(pair => pair.category === 'adulte' ? { ...pair, category: 'politique' as const } : pair);
const categories = [...new Set(originalCategories.map(pair => pair.category))];
const fake = (count: number): WordPair[] => Array.from({ length: count }, (_, i) => ({ id: `fixture-${i}`, a: `Objet fictif A ${i}`, b: `Objet fictif B ${i}`, category: 'nature', difficulty: 'easy' }));
function seeded(seed = 314159) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; }; }

describe('word catalogue, spoiler-free diagnostics', () => {
  it('adds 1500 curated pairs and preserves the original 120 verbatim', () => {
    expect(originalNew.length).toBe(1500); expect(NEW_WORD_PAIRS.length).toBe(1547); expect(WORD_PAIRS.length).toBe(1667);
    expect(createHash('sha256').update(JSON.stringify(originalNew.map(p => [p.id, p.a, p.b]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))).digest('hex')).toBe('043ef686e067af704b652dea3158c779e5c4a4162dc101d7808f76f573a20fae');
    expect(LEGACY_WORD_PAIRS.length).toBe(120);
    expect(createHash('sha256').update(JSON.stringify(LEGACY_WORD_PAIRS)).digest('hex')).toBe('edf64519fad81446e223af9515f95496c5148aedf392bdd8fb4d1fa11ae71a20');
    expect(auditWordLibrary(WORD_PAIRS)).toEqual([]);
    expect(new Set(WORD_PAIRS.map(pairKey)).size).toBe(WORD_PAIRS.length);
    expect(new Set(WORD_PAIRS.map(p => p.id)).size).toBe(WORD_PAIRS.length);
  });
  it('keeps the 35/45/20 mix in every new category and bounds reference reuse', () => {
    expect(libraryStatistics(originalNew).difficulties).toEqual({ easy: 525, medium: 675, hard: 300 });
    expect(categories.length).toBe(15);
    for (const category of categories) {
      const stats = libraryStatistics(originalCategories.filter(p => p.category === category));
      expect(stats.total, category).toBe(100);
      expect(stats.difficulties, category).toEqual({ easy: 35, medium: 45, hard: 20 });
    }
    const mentions = new Map<string, number>();
    for (const pair of originalNew) for (const word of [pair.a, pair.b]) { const key = normalizeWordKey(word); mentions.set(key, (mentions.get(key) ?? 0) + 1); }
    expect(Math.max(...mentions.values())).toBeLessThanOrEqual(3);
  });
  it('detects inversions, accents, punctuation, empty/identical answers and missing metadata without echoing text', () => {
    const base: WordPair = { id: 'fixture', a: 'Café', b: 'Thé', category: 'cuisine', difficulty: 'easy' };
    const samples = [base, { ...base, id: 'fixture-2', a: 'THÉ', b: 'Cafe' }, { ...base, id: 'fixture-3', a: 'Ca-fé', b: 'CAFÉ' }, { ...base, id: 'fixture-4', a: '' }, { ...base, id: 'fixture-5', difficulty: 'invalid' } as unknown as WordPair, { ...base, id: 'fixture-6', a: 'Le Café', b: 'Le Thé' }];
    const issues = auditWordLibrary(samples);
    expect(issues.some(i => i.code === 'duplicate')).toBe(true);
    expect(issues.some(i => i.code === 'identical')).toBe(true);
    expect(issues.some(i => i.code === 'text')).toBe(true);
    expect(issues.some(i => i.code === 'metadata')).toBe(true);
    expect(issues.some(i => i.code === 'alias-duplicate')).toBe(true);
    expect(issues.every(i => Object.keys(i).every(key => ['id', 'code', 'relatedId'].includes(key)))).toBe(true);
  });
  it('requires editorial evidence and rejects an answer embedded in the other', () => {
    const item = { ...fake(1)[0], id: 'v14-fixture', a: 'Objet fictif', b: 'Objet fictif caché' };
    const issues = auditWordLibrary([item]);
    expect(issues.map(i => i.code)).toContain('editorial-evidence');
    expect(issues.map(i => i.code)).toContain('contained-answer');
  });
  it('records an editorial review and primary-source checks without publishing associations', () => {
    expect(review.reviewedEntries).toBe(originalNew.length);
    expect(review.blindHumanPlaytest).toBe(false);
    const ids = new Set(originalNew.map(p => p.id));
    expect(review.revisedEntryIds.every(id => ids.has(id))).toBe(true);
    expect(new Set(review.revisedEntryIds).size).toBe(34);
    expect(review.sources.every(source => source.url.startsWith('https://') && source.entryIds.every(id => ids.has(id)))).toBe(true);
  });
  it('supports every category/difficulty without exposing pair metadata through game projections', () => {
    const random = seeded();
    for (const category of categories) for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const pair = chooseWordPair({ category, difficulty }, [], random);
      expect(pair.category === category && pair.difficulty === difficulty).toBe(true);
    }
    let failures = 0;
    for (const pair of WORD_PAIRS) {
      const game = createGame({ id: 'fixture', playerIds: ['a', 'b', 'c', 'd'], pair, now: 0, random, settings: { ...DEFAULT_SETTINGS, automaticRoles: false, undercoverCount: 1, whiteCount: 1 } });
      const projection = publicGame(game);
      if (['words', 'a', 'b', 'clueAxes', 'category', 'difficulty', 'pair', 'pairId'].some(key => Object.hasOwn(projection, key))) failures++;
      for (const id of game.playerIds) {
        const secret = privateGame(game, id);
        const expected = game.roles[id] === 'white' ? null : game.roles[id] === 'civilian' ? game.words.civilian : game.words.undercover;
        if (secret.word !== expected || Object.keys(secret).some(key => !['playerId', 'inGame', 'word', 'voteTarget'].includes(key))) failures++;
      }
      if (!isAcceptableWhiteGuess(`  ${game.words.civilian.toLocaleUpperCase('fr')}  `, game.words.civilian)) failures++;
      if (isAcceptableWhiteGuess(pair.a, pair.b) || isAcceptableWhiteGuess(pair.b, pair.a)) failures++;
      if (normalizeWordKey(pair.a) === normalizeWordKey(pair.b)) failures++;
    }
    expect(failures).toBe(0);
  });
});

describe('uniform selection with bounded recent history', () => {
  const filters = { category: 'all', difficulty: 'all' } as const;
  it('maps equally spaced random values to every candidate exactly once', () => {
    const pool = fake(80); const draws = pool.map((_, i) => chooseWordPair(filters, [], () => (i + .5) / pool.length, pool).id);
    expect(new Set(draws).size).toBe(pool.length);
  });
  it('exhausts each cycle without an immediate repeat and eventually reuses old choices', () => {
    const pool = fake(20); const random = seeded(); const history: string[] = []; let reused = false; const ever = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const selected = chooseWordPair(filters, history, random, pool);
      expect(history.at(-1)).not.toBe(selected.id);
      expect(history.slice(i - i % pool.length).includes(selected.id)).toBe(false);
      reused ||= ever.has(selected.id); ever.add(selected.id); recordWordSelection(history, selected.id);
    }
    expect(ever.size).toBe(pool.length); expect(reused).toBe(true); expect(history.length).toBe(Math.min(2000, WORD_HISTORY_LIMIT));
  });
  it('is statistically balanced under a deterministic random stream', () => {
    const pool = fake(20); const random = seeded(2026); const history: string[] = []; const counts = Array<number>(20).fill(0);
    for (let i = 0; i < 20000; i++) { const selected = chooseWordPair(filters, history, random, pool); counts[Number(selected.id.slice(8))]++; recordWordSelection(history, selected.id); }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThan(180);
  });
  it('handles switches, unknown history, exhaustion and a singleton without permanent exclusions', () => {
    const pool = fake(4); pool[0] = { ...pool[0], category: 'cuisine' };
    expect(chooseWordPair({ category: 'cuisine', difficulty: 'easy' }, pool.map(p => p.id), () => 0, pool).id).toBe(pool[0].id);
    expect(chooseWordPair(filters, ['unknown'], () => 0, pool).id).toBe(pool[0].id);
    expect(chooseWordPair(filters, pool.map(p => p.id), () => 0, pool).id).toBe(pool[0].id);
    expect(() => chooseWordPair(filters, [], () => 0, [])).toThrow('Aucune paire');
    for (const value of [-1, 1, NaN, Infinity]) expect(() => chooseWordPair(filters, [], () => value, pool)).toThrow('aléatoire');
  });
});
