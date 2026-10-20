import { createHash } from 'node:crypto';
import type { WordPair } from '@rene/engine';

/** The key describes the exact eligible pool, without disclosing its words. */
export function wordPoolKey(pool: readonly WordPair[]): string {
  if (!pool.length) throw new Error('Aucune paire disponible pour ces thèmes.');
  return createHash('sha256').update(pool.map(pair => pair.id).sort().join('\n')).digest('hex');
}

export function drawWordPair(
  pool: readonly WordPair[],
  usedIds: ReadonlySet<string>,
  previousId: string | null,
  random: () => number,
): { pair: WordPair; exhausted: boolean } {
  if (!pool.length) throw new Error('Aucune paire disponible pour ces thèmes.');
  const exhausted = pool.every(pair => usedIds.has(pair.id));
  let available = exhausted ? [...pool] : pool.filter(pair => !usedIds.has(pair.id));
  if (exhausted && available.length > 1) available = available.filter(pair => pair.id !== previousId);
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Le générateur aléatoire est invalide.');
  return { pair: available[Math.floor(value * available.length)], exhausted };
}
