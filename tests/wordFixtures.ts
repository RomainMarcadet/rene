import { SettingsSchema } from '@rene/contracts';
import type { WordPair } from '@rene/engine';

/** Deliberately fictional: browser screenshots and failure traces cannot spoil the catalogue. */
export const TEST_WORD_PAIRS: readonly WordPair[] = SettingsSchema.shape.category.options.filter(category => category !== 'all').flatMap((category, index) =>
  (['easy', 'medium', 'hard'] as const).map((difficulty, level) => ({ id: `fixture-${category}-${difficulty}`, a: `Objet fictif A ${index * 3 + level}`, b: `Objet fictif B ${index * 3 + level}`, category, difficulty })),
);
