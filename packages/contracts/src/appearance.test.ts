import { describe, expect, it } from 'vitest';
import { AppearanceSchema, AVATAR_CATALOG, COLORS, DEFAULT_APPEARANCE, HEADWEAR, randomAppearance, variantIds } from './appearance.js';
import { CommandSchema } from './index.js';

describe('additive avatar appearance contract', () => {
  it('preserves every legacy field and defaults only the new accessory colour', () => {
    const { accessoryColor: _color, ...legacy } = DEFAULT_APPEARANCE;
    expect(AppearanceSchema.parse(legacy)).toEqual(DEFAULT_APPEARANCE);
    expect(AppearanceSchema.parse({ ...legacy, accessory: 'hat' }).accessoryColor).toBe('#65B847');
    expect(AppearanceSchema.parse({ ...legacy, accessory: 'hat', accessoryColor: '#EE89BA' }).accessoryColor).toBe('#EE89BA');
    expect(CommandSchema.parse({ type: 'profile.update', name: 'René', appearance: legacy })).toMatchObject({ appearance: DEFAULT_APPEARANCE });
  });
  it('validates every new option and colour, rejecting unknown fields and untrusted values', () => {
    expect(Object.values(AVATAR_CATALOG).map(c => Object.keys(c).length)).toEqual([9, 12, 9, 9, 6, 14]);
    for (const [key, catalog] of Object.entries(AVATAR_CATALOG)) for (const id of Object.keys(catalog)) expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, [key]: id }).success).toBe(true);
    for (const key of ['skin', 'body', 'hairColor', 'accessoryColor']) {
      for (const color of COLORS) expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, [key]: color }).success).toBe(true);
      expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, [key]: 'url(evil)' }).success).toBe(false);
    }
    expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, hair: 'unknown' }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, role: 'civilian' }).success).toBe(false);
  });
  it('generates coherent serializable appearances and reaches every variant', () => {
    let seed = 42; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const seen = Object.fromEntries(Object.keys(AVATAR_CATALOG).map(key => [key, new Set<string>()]));
    for (let i = 0; i < 2000; i++) {
      const a = randomAppearance(random);
      expect(AppearanceSchema.parse(JSON.parse(JSON.stringify(a)))).toEqual(a);
      expect(a.skin).not.toBe(a.body);
      if ((HEADWEAR as readonly string[]).includes(a.accessory)) expect(a.hair).toBe('none');
      for (const key of Object.keys(AVATAR_CATALOG) as (keyof typeof AVATAR_CATALOG)[]) seen[key].add(a[key]);
    }
    for (const key of Object.keys(AVATAR_CATALOG) as (keyof typeof AVATAR_CATALOG)[]) expect(seen[key].size).toBe(variantIds(AVATAR_CATALOG[key]).length);
    expect(randomAppearance(() => 0)).toEqual(randomAppearance(() => 0));
    for (const value of [-1, 1, NaN]) expect(() => randomAppearance(() => value)).toThrow('aléatoire');
  });
});
