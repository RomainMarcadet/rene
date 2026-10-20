import { SettingsSchema } from '@rene/contracts';
import type { WordPair } from './wordTypes.js';

export function normalizeWordKey(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]/gu, '');
}
export function pairKey(pair: Pick<WordPair, 'a' | 'b'>): string {
  return [normalizeWordKey(pair.a), normalizeWordKey(pair.b)].sort().join('|');
}
function referenceKey(value: string): string {
  return normalizeWordKey(value.trim().replace(/^(?:(?:le|la|les|un|une|des|the|a|an)\s+|l['’])/iu, ''));
}
export interface WordIssue { id: string; code: string; relatedId?: string }

/** Diagnostics never contain words, including when a check fails. */
export function auditWordLibrary(pairs: readonly WordPair[]): WordIssue[] {
  const issues: WordIssue[] = []; const ids = new Set<string>(); const keys = new Map<string, string>(); const references = new Map<string, string>();
  for (const pair of pairs) {
    const id = typeof pair.id === 'string' && /^[a-z0-9-]+$/.test(pair.id) ? pair.id : 'invalid-id';
    const issue = (code: string, relatedId?: string) => issues.push({ id, code, ...(relatedId ? { relatedId } : {}) });
    if (id === 'invalid-id' || ids.has(id)) issue('id');
    ids.add(id);
    if (!SettingsSchema.shape.category.exclude(['all']).safeParse(pair.category).success || !SettingsSchema.shape.difficulty.exclude(['all']).safeParse(pair.difficulty).success) issue('metadata');
    if ([pair.a, pair.b].some(word => typeof word !== 'string' || !word.trim() || word !== word.trim() || word.length > 100 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(word))) { issue('text'); continue; }
    const a = normalizeWordKey(pair.a); const b = normalizeWordKey(pair.b);
    if (!a || !b || a === b) issue('identical');
    const key = pairKey(pair); const previous = keys.get(key);
    if (previous) issue('duplicate', previous); else keys.set(key, id);
    const canonical = [referenceKey(pair.a), referenceKey(pair.b)].sort().join('|');
    const alias = references.get(canonical);
    if (alias && !previous) issue('alias-duplicate', alias); else references.set(canonical, id);
    if (referenceKey(pair.a) === referenceKey(pair.b) && a !== b) issue('identical-reference');
    if (id.startsWith('v14-') || id.startsWith('v16-')) {
      if (!pair.clueAxes || pair.clueAxes.length !== 2 || pair.clueAxes.some(axis => typeof axis !== 'string' || axis.trim().length < 2) || pair.clueAxes[0] === pair.clueAxes[1]) issue('editorial-evidence');
      if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) issue('contained-answer');
    }
  }
  return issues;
}

export function libraryStatistics(pairs: readonly WordPair[]) {
  const categories: Record<string, number> = {}; const difficulties: Record<string, number> = {};
  for (const pair of pairs) { categories[pair.category] = (categories[pair.category] ?? 0) + 1; difficulties[pair.difficulty] = (difficulties[pair.difficulty] ?? 0) + 1; }
  return { total: pairs.length, categories, difficulties };
}
