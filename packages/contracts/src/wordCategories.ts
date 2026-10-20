import { z } from 'zod';

/** Public labels only. The associated word pairs stay on the server. */
export const WORD_CATEGORY_IDS = ['quotidien', 'nature', 'cuisine', 'culture', 'voyage', 'cinema', 'jeux-video', 'internet', 'musique', 'sport', 'politique', 'television', 'technologie', 'histoire', 'sciences', 'adulte'] as const;
export const WordCategorySchema = z.enum(WORD_CATEGORY_IDS);
export type WordCategory = z.infer<typeof WordCategorySchema>;
export const WORD_CATEGORY_LABELS: Record<WordCategory, string> = {
  quotidien: 'Quotidien', nature: 'Nature', cuisine: 'Cuisine', culture: 'Culture', voyage: 'Voyage',
  cinema: 'Cinéma', 'jeux-video': 'Jeux vidéo', internet: 'Internet', musique: 'Musique', sport: 'Sport',
  politique: 'Politique', television: 'Télévision', technologie: 'Technologie', histoire: 'Histoire & imaginaire',
  sciences: 'Sciences', adulte: '18+ · Politique & humour noir',
};
export const PUBLIC_WORD_CATEGORIES = WORD_CATEGORY_IDS.filter(category => category !== 'adulte');
export interface WordSelection {
  category: WordCategory | 'all';
  /** An empty array retains compatibility with the original single-category setting. */
  categories?: readonly WordCategory[];
  adultContent?: boolean;
}

export function selectedWordCategories(settings: WordSelection): WordCategory[] {
  const categories = settings.categories?.length ? settings.categories
    : settings.category === 'all' ? WORD_CATEGORY_IDS : [settings.category];
  return [...new Set(categories)].filter(category => category !== 'adulte' || settings.adultContent === true);
}

export function wordSelectionLabel(settings: WordSelection): string {
  const categories = selectedWordCategories(settings);
  const classics = categories.filter(category => category !== 'adulte');
  const labels = classics.length === PUBLIC_WORD_CATEGORIES.length
    ? ['Tous les thèmes classiques'] : classics.map(category => WORD_CATEGORY_LABELS[category]);
  if (categories.includes('adulte')) labels.push(WORD_CATEGORY_LABELS.adulte);
  return labels.join(' · ');
}
