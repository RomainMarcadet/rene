import { describe, expect, it } from 'vitest';
import { CommandSchema, DEFAULT_SETTINGS, SettingsSchema, selectedWordCategories, wordSelectionLabel } from './index.js';

describe('word theme settings', () => {
  it('restores old room settings with an explicit default adult exclusion', () => {
    const oldSettings = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).filter(([key]) => key !== 'categories' && key !== 'adultContent'));
    const restored = SettingsSchema.parse({ ...oldSettings, category: 'nature' });
    expect(restored.categories).toEqual([]);
    expect(restored.adultContent).toBe(false);
    expect(selectedWordCategories(restored)).toEqual(['nature']);
    expect(selectedWordCategories(DEFAULT_SETTINGS)).toEqual([...DEFAULT_SETTINGS.categories]);
  });

  it('prioritizes the selected themes over the old single category', () => {
    expect(selectedWordCategories({ category: 'nature', categories: ['sport', 'cinema'], adultContent: false })).toEqual(['sport', 'cinema']);
    expect(wordSelectionLabel({ category: 'nature', categories: ['sport', 'cinema'] })).toBe('Sport · Cinéma');
  });

  it('requires adult opt-in even when a crafted selection includes that theme', () => {
    expect(selectedWordCategories({ category: 'adulte', adultContent: false })).toEqual([]);
    expect(selectedWordCategories({ category: 'all', categories: ['nature', 'adulte'] })).toEqual(['nature']);
    expect(selectedWordCategories({ category: 'all', categories: ['adulte'], adultContent: true })).toEqual(['adulte']);
    expect(selectedWordCategories({ category: 'all', categories: ['nature'], adultContent: true })).toEqual(['nature']);
    expect(wordSelectionLabel({ category: 'all', adultContent: true })).toContain('18+');
  });

  it('validates a real multi-theme command and rejects malformed themes and flags', () => {
    const command = (settings: object) => ({ type: 'settings.update', settings: { ...DEFAULT_SETTINGS, ...settings } });
    expect(CommandSchema.safeParse(command({ categories: ['nature', 'cinema'] })).success).toBe(true);
    expect(CommandSchema.safeParse(command({ categories: ['nature', 'nature'] })).success).toBe(false);
    expect(CommandSchema.safeParse(command({ categories: ['unknown'] })).success).toBe(false);
    expect(CommandSchema.safeParse(command({ adultContent: 'true' })).success).toBe(false);
    expect(CommandSchema.safeParse(command({ categories: ['nature'], catalogue: [] })).success).toBe(false);
  });
});
