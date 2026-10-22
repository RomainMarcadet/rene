import { selectedWordCategories, type RoomSettings, type WordSelection } from '@rene/contracts';
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
import adultPack from './word-data/adulte.json';
import specialPack from './word-data/special.json';
export type { WordPair } from './wordTypes.js';
export { LEGACY_WORD_PAIRS } from './legacyWords.js';
export { auditWordLibrary, libraryStatistics, normalizeWordKey, pairKey } from './wordAudit.js';

const packs = [pack0, pack1, pack2, pack3, pack4, pack5, pack6, pack7, pack8, pack9, pack10, pack11, pack12, pack13, pack14, adultPack, specialPack];
export const NEW_WORD_PAIRS: readonly WordPair[] = Object.freeze(packs.flatMap(pack =>
  pack.pairs.map(pair => Object.freeze({ ...pair, category: pack.category as WordPair['category'], difficulty: pair.difficulty as WordPair['difficulty'], clueAxes: Object.freeze([...pair.clueAxes]) })),
));
export const WORD_PAIRS: readonly WordPair[] = Object.freeze([
  ...LEGACY_WORD_PAIRS.map(pair => Object.freeze(pair)), ...NEW_WORD_PAIRS,
]);
const issues = auditWordLibrary(WORD_PAIRS);
if (issues.length) throw new Error('Catalogue invalide : ' + issues.map(issue => issue.id + ':' + issue.code).join(', '));

/** Keep more than one full catalogue cycle without an unbounded room history. */
export const WORD_HISTORY_LIMIT = WORD_PAIRS.length * 2;
export function recordWordSelection(history: string[], id: string): void {
  history.push(id);
  if (history.length > WORD_HISTORY_LIMIT) history.splice(0, history.length - WORD_HISTORY_LIMIT);
}

/** The public theme metadata never contains a word or an editorial association. */
export function matchingWordPairs(settings: WordSelection & Pick<RoomSettings, 'difficulty'>, catalogue: readonly WordPair[] = WORD_PAIRS): WordPair[] {
  const categories = new Set(selectedWordCategories(settings));
  return catalogue.filter(pair => categories.has(pair.category) && (settings.difficulty === 'all' || pair.difficulty === settings.difficulty));
}

/** Uniform selection from the chosen themes, retaining the existing no-repeat cycles. */
export function chooseWordPair(
  settings: WordSelection & Pick<RoomSettings, 'difficulty'>,
  usedIds: Iterable<string>,
  random: () => number = Math.random,
  catalogue: readonly WordPair[] = WORD_PAIRS,
): WordPair {
  const pool = matchingWordPairs(settings, catalogue);
  if (!pool.length) throw new Error('Aucune paire ne correspond à ces filtres.');
  const eligible = new Set(pool.map(pair => pair.id));
  const used = new Set<string>();
  let lastId: string | undefined;
  for (const id of usedIds) {
    if (!eligible.has(id)) continue;
    used.add(id);
    lastId = id;
    if (used.size === pool.length) used.clear();
  }
  let available = pool.filter(pair => !used.has(pair.id));
  if (!used.size && available.length > 1) available = available.filter(pair => pair.id !== lastId);
  const value = random();
  if (!(value >= 0 && value < 1)) throw new Error('Le générateur aléatoire est invalide.');
  return { ...available[Math.floor(value * available.length)] };
}
