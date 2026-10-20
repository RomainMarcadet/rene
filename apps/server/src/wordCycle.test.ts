import { describe, expect, it } from 'vitest';
import { drawWordPair, wordPoolKey } from './wordCycle.js';
import type { WordPair } from '@rene/engine';
const pool: WordPair[] = [
  { id: 'first', a: 'Alpha', b: 'Beta', category: 'culture', difficulty: 'easy' },
  { id: 'second', a: 'Gamma', b: 'Delta', category: 'culture', difficulty: 'easy' },
  { id: 'third', a: 'Epsilon', b: 'Zeta', category: 'culture', difficulty: 'easy' },
];
describe('durable word pool primitives', () => {
  it('has an order independent stable key and rejects empty selection', () => {
    expect(wordPoolKey(pool)).toBe(wordPoolKey([...pool].reverse()));
    expect(() => wordPoolKey([])).toThrow();
  });
  it('draws without replacement and prevents immediate rollover repetition', () => {
    const used = new Set<string>(); let previous: string | null = null;
    for (let i = 0; i < pool.length; i++) {
      const { pair, exhausted } = drawWordPair(pool, used, previous, () => 0);
      expect(exhausted).toBe(false);
      expect(used.has(pair.id)).toBe(false);
      used.add(pair.id); previous = pair.id;
    }
    const rollover = drawWordPair(pool, used, previous, () => 0);
    expect(rollover.exhausted).toBe(true);
    expect(rollover.pair.id).not.toBe(previous);
  });
  it('allows a single eligible pair and refuses invalid random numbers', () => {
    expect(drawWordPair(pool.slice(0, 1), new Set(['first']), 'first', () => 0).pair.id).toBe('first');
    expect(() => drawWordPair(pool, new Set(), null, () => 1)).toThrow();
  });
});
