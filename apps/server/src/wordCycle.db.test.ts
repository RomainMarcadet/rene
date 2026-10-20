import { describe, expect, it } from 'vitest';
import { createPersistence } from './persistence.js';
import type { WordPair } from '@rene/engine';
const fixtures: WordPair[] = [
  { id: 'db-first', a: 'Alpha', b: 'Beta', category: 'culture', difficulty: 'easy' },
  { id: 'db-second', a: 'Gamma', b: 'Delta', category: 'culture', difficulty: 'easy' },
  { id: 'db-third', a: 'Epsilon', b: 'Zeta', category: 'culture', difficulty: 'easy' },
];
describe('persistent word cycles', () => {
  it('does not repeat before complete exhaustion and preserves history after reconnection', async () => {
    const prefix = 'words-db-test-' + crypto.randomUUID();
    // Unique, spoiler-free IDs isolate cycles between separate test runs.
    const pool = fixtures.map(pair => ({ ...pair, id: prefix + '-' + pair.id }));
    const store = await createPersistence(process.env.DATABASE_URL);
    try {
      const ids = await Promise.all(pool.map((_, i) => store.reserveWordPair(prefix + '-' + i, pool, () => 0)));
      expect(new Set(ids.map(pair => pair.id)).size).toBe(pool.length);
      const progress = await store.wordPoolProgress(pool);
      expect(progress.used).toBe(pool.length);
      const same = await store.reserveWordPair(prefix, pool, () => 0);
      expect(same.id).toBe(ids[0].id);
      const reopened = await createPersistence(process.env.DATABASE_URL);
      try {
        const next = await reopened.reserveWordPair(prefix + '-new', pool, () => 0);
        expect(next.id).not.toBe(ids.at(-1)?.id);
        const after = await reopened.wordPoolProgress(pool);
        expect(after.cycle).toBeGreaterThanOrEqual(progress.cycle);
      } finally { await reopened.close(); }
    } finally { await store.close(); }
  });
});
