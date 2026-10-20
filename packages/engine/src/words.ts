import type { RoomSettings } from '@rene/contracts';
import type { WordPair } from './wordTypes.js';
import { LEGACY_WORD_PAIRS } from './legacyWords.js';
import { auditWordLibrary } from './wordAudit.js';
import pack0 from './word-data/quotidien.json';
import pack1 from './word-data/nature.json';
import pack2 from './word-data/cuisine.json';
import pack3 from './word-data/culture.json';
import pack4 from './word-data/voyage.json';
import pack5 from './word-data/cinema.json';
import pack6 from './word-data/jeux-video.json';
import pack7 from './word-data/internet.json';
import pack8 from './word-data/musique.json';
import pack9 from './word-data/sport.json';
import pack10 from './word-data/politique.json';
import pack11 from './word-data/television.json';
import pack12 from './word-data/technologie.json';
import pack13 from './word-data/histoire.json';
import pack14 from './word-data/sciences.json';
export type { WordPair } from './wordTypes.js';
export { LEGACY_WORD_PAIRS } from './legacyWords.js';
export { auditWordLibrary, libraryStatistics, normalizeWordKey, pairKey } from './wordAudit.js';

const packs = [pack0, pack1, pack2, pack3, pack4, pack5, pack6, pack7, pack8, pack9, pack10, pack11, pack12, pack13, pack14];
export const NEW_WORD_PAIRS: readonly WordPair[] = Object.freeze(packs.flatMap(pack =>
  pack.pairs.map(pair => Object.freeze({ ...pair, category: pack.category as WordPair['category'], difficulty: pair.difficulty as WordPair['difficulty'], clueAxes: Object.freeze([...pair.clueAxes]) })),
));
export const WORD_PAIRS: readonly WordPair[] = Object.freeze([
  ...LEGACY_WORD_PAIRS.map(pair => Object.freeze(pair)), ...NEW_WORD_PAIRS,
]);
const issues = auditWordLibrary(WORD_PAIRS);
if (issues.length) throw new Error('Catalogue invalide : ' + issues.map(issue => issue.id + ':' + issue.code).join(', '));

/** A bounded chronological room history; no permanent exclusions or per-client state. */
export const WORD_HISTORY_LIMIT = 512;
export function recordWordSelection(history: string[], id: string): void {
  history.push(id);
  if (history.length > WORD_HISTORY_LIMIT) history.splice(0, history.length - WORD_HISTORY_LIMIT);
}

/** Uniform draw among eligible pairs outside a finite recent-history window. */
export function chooseWordPair(
  settings: Pick<RoomSettings, 'category' | 'difficulty'>,
  usedIds: Iterable<string>,
  random: () => number = Math.random,
  catalogue: readonly WordPair[] = WORD_PAIRS,
): WordPair {
  const pool = catalogue.filter(pair => (settings.category === 'all' || pair.category === settings.category) && (settings.difficulty === 'all' || pair.difficulty === settings.difficulty));
  if (!pool.length) throw new Error('Aucune paire ne correspond à ces filtres.');
  const eligible = new Set(pool.map(pair => pair.id));
  const windowSize = Math.min(WORD_HISTORY_LIMIT, Math.max(1, Math.floor(pool.length / 2)), pool.length - 1);
  const recent = [...usedIds].filter(id => eligible.has(id)).slice(-Math.max(1, windowSize));
  const excluded = new Set(windowSize ? recent : []);
  const available = pool.filter(pair => !excluded.has(pair.id));
  const value = random();
  if (!(value >= 0 && value < 1)) throw new Error('Le générateur aléatoire est invalide.');
  return { ...available[Math.floor(value * available.length)] };
}
