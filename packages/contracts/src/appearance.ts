import { z } from 'zod';

export const COLORS = ['#EE89BA', '#F34531', '#F5E742', '#65B847', '#087BA0', '#191719', '#F5F2EA', '#F28C28', '#8A5DB3', '#53B9AF', '#455FC1', '#9D422F', '#6A4637'] as const;
export const COLOR_NAMES = ['Rose', 'Tomate', 'Citron', 'Vert', 'Pétrole', 'Encre', 'Crème', 'Mandarine', 'Violet', 'Menthe', 'Indigo', 'Brique', 'Cacao'] as const;
export const AVATAR_CATALOG = {
  head: { pear: 'Poire', square: 'Pavé', bean: 'Haricot', egg: 'Œuf', potato: 'Patate', peanut: 'Cacahuète', wedge: 'Quartier', mushroom: 'Champignon', tall: 'Tour' },
  hair: { none: 'Aucun', tuft: 'Mèche', flat: 'Casque', spikes: 'Piques', bowl: 'Coupe bol', fringe: 'Rideau', sidepart: 'Raie de travers', bun: 'Chignon', buns: 'Deux chignons', mohawk: 'Crête', curls: 'Bouclettes', bob: 'Carré court' },
  eyes: { wide: 'Ébahi', sleepy: 'Blasé', tiny: 'Malin', uneven: 'Pas réveillé', wink: 'Clin d’œil', worried: 'Inquiet', angry: 'Froncé', dreamy: 'Dans la lune', sideways: 'En coin' },
  mouth: { flat: 'Impassible', smile: 'Sourire', surprised: 'Surprise', frown: 'Boudeur', grin: 'Toutes les dents', pout: 'Bec pincé', crooked: 'De travers', tooth: 'Une seule dent', tongue: 'Langue tirée' },
  nose: { none: 'Aucun', long: 'Immense', round: 'Patate', small: 'Discret', hook: 'Crochu', snout: 'Museau' },
  accessory: { none: 'Aucun', glasses: 'Lunettes', hat: 'Chapeau', moustache: 'Moustache', monocle: 'Monocle', sunglasses: 'Lunettes de soleil', beret: 'Béret', cap: 'Casquette', crown: 'Couronne', beanie: 'Bonnet', earrings: 'Boucles', bowtie: 'Nœud papillon', eyepatch: 'Cache-œil', flower: 'Fleur' },
} as const;
export type AvatarCategory = keyof typeof AVATAR_CATALOG;
export function variantIds<T extends Record<string, string>>(catalogue: T) { return Object.keys(catalogue) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]]; }
export const HEADWEAR = ['hat', 'beret', 'cap', 'crown', 'beanie'] as const;
export const AppearanceSchema = z.object({
  head: z.enum(variantIds(AVATAR_CATALOG.head)), skin: z.enum(COLORS), body: z.enum(COLORS),
  hair: z.enum(variantIds(AVATAR_CATALOG.hair)), hairColor: z.enum(COLORS),
  eyes: z.enum(variantIds(AVATAR_CATALOG.eyes)), nose: z.enum(variantIds(AVATAR_CATALOG.nose)),
  mouth: z.enum(variantIds(AVATAR_CATALOG.mouth)), accessory: z.enum(variantIds(AVATAR_CATALOG.accessory)),
  accessoryColor: z.enum(COLORS).optional(),
}).strict().transform(a => ({ ...a, accessoryColor: a.accessoryColor ?? (a.accessory === 'hat' ? '#65B847' : '#191719') }));
export type AvatarAppearance = z.infer<typeof AppearanceSchema>;
export const DEFAULT_APPEARANCE: AvatarAppearance = { head: 'pear', skin: '#EE89BA', body: '#087BA0', hair: 'tuft', hairColor: '#191719', eyes: 'wide', nose: 'long', mouth: 'flat', accessory: 'glasses', accessoryColor: '#191719' };

/** Shared by the editor and tests; each complete appearance is validated at the boundary. */
export function randomAppearance(random: () => number = Math.random): AvatarAppearance {
  const pick = <T,>(values: readonly T[]): T => {
    const value = random();
    if (!(value >= 0 && value < 1)) throw new Error('Générateur aléatoire invalide.');
    return values[Math.floor(value * values.length)];
  };
  const skin = pick(COLORS); const accessory = pick(variantIds(AVATAR_CATALOG.accessory));
  return AppearanceSchema.parse({
    head: pick(variantIds(AVATAR_CATALOG.head)), skin, body: pick(COLORS.filter(color => color !== skin)),
    hair: (HEADWEAR as readonly string[]).includes(accessory) ? 'none' : pick(variantIds(AVATAR_CATALOG.hair)),
    hairColor: pick(COLORS), eyes: pick(variantIds(AVATAR_CATALOG.eyes)), nose: pick(variantIds(AVATAR_CATALOG.nose)),
    mouth: pick(variantIds(AVATAR_CATALOG.mouth)), accessory, accessoryColor: pick(COLORS),
  });
}
