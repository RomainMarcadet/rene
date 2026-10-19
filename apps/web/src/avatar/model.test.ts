import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOG, DEFAULT_APPEARANCE, variantIds, type AvatarCategory } from '@rene/contracts';
import { avatarTone, buildAvatarModel, headSurface } from './model';
import { HEAD_VISUALS } from './catalog';
import { AvatarPortrait } from '../components/AvatarPortrait';

describe('shared portrait/hub geometry recipes', () => {
  it('gives every option a distinct visual recipe rather than just a different identifier', () => {
    for (const key of Object.keys(AVATAR_CATALOG) as AvatarCategory[]) {
      const recipes = variantIds(AVATAR_CATALOG[key]).map(id => {
        const model = buildAvatarModel({ ...DEFAULT_APPEARANCE, accessory: 'none', [key]: id });
        return JSON.stringify(key === 'head' ? model.head : model[key === 'hair' ? 'hair' : key === 'eyes' ? 'eyes' : key === 'mouth' ? 'mouth' : key === 'nose' ? 'nose' : 'accessory']);
      });
      expect(new Set(recipes).size, key).toBe(recipes.length);
    }
  });
  it('fits all head/hair/accessory combinations with finite, bounded geometry', () => {
    let maxParts = 0;
    for (const head of variantIds(AVATAR_CATALOG.head)) for (const hair of variantIds(AVATAR_CATALOG.hair)) for (const accessory of variantIds(AVATAR_CATALOG.accessory)) {
      const model = buildAvatarModel({ ...DEFAULT_APPEARANCE, head, hair, accessory });
      maxParts = Math.max(maxParts, model.parts.length);
      expect(model.top).toBeLessThan(2.1);
      for (const part of model.parts) {
        expect([...part.at, ...part.scale].every(Number.isFinite)).toBe(true);
        expect(part.scale.every(n => n > 0)).toBe(true);
      }
      for (const eye of model.eyes.filter(p => p.tone === 'eye')) expect(eye.at[2]).toBeCloseTo(headSurface(HEAD_VISUALS[head], eye.at[0], eye.at[1]));
    }
    expect(maxParts).toBeLessThanOrEqual(35);
  });
  it('keeps each selected feature and colour in the SVG portrait, including red eliminated eyes', () => {
    for (const eyes of variantIds(AVATAR_CATALOG.eyes)) for (const accessory of ['none', 'glasses', 'sunglasses', 'eyepatch'] as const) {
      const a = { ...DEFAULT_APPEARANCE, eyes, accessory, accessoryColor: '#8A5DB3' as const };
      const before = structuredClone(a); const model = buildAvatarModel(a, true);
      expect(model.eyes.some(p => avatarTone(p.tone, a, true) === '#F34531')).toBe(true);
      const svg = renderToStaticMarkup(createElement(AvatarPortrait, { appearance: a, eliminated: true }));
      expect(svg).toContain(`data-appearance="${[a.head, a.hair, eyes, a.mouth, a.nose, accessory].join(':')}"`);
      expect(svg).toContain('Portrait éliminé · yeux rouges'); expect(svg).toContain('#F34531');
      if (accessory !== 'none') expect(svg).toContain('#8A5DB3');
      expect(a).toEqual(before);
    }
  });
});
