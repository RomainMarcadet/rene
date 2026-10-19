import { DEFAULT_APPEARANCE, type AvatarAppearance } from '@rene/contracts';

/** Illustrative models for the existing art workshop and the twelve-client visual recipe. */
export const AVATAR_SPECIMENS: readonly AvatarAppearance[] = [
  { ...DEFAULT_APPEARANCE, head: 'egg', hair: 'bowl', eyes: 'uneven', mouth: 'grin', nose: 'round', accessory: 'earrings', skin: '#F5E742', hairColor: '#6A4637', accessoryColor: '#8A5DB3' },
  { ...DEFAULT_APPEARANCE, head: 'potato', hair: 'buns', eyes: 'wink', mouth: 'tongue', nose: 'snout', accessory: 'flower', skin: '#EE89BA', body: '#65B847', hairColor: '#455FC1', accessoryColor: '#F34531' },
  { ...DEFAULT_APPEARANCE, head: 'tall', hair: 'mohawk', eyes: 'angry', mouth: 'crooked', nose: 'hook', accessory: 'monocle', skin: '#65B847', body: '#F34531', hairColor: '#F28C28', accessoryColor: '#191719' },
  { ...DEFAULT_APPEARANCE, head: 'mushroom', hair: 'fringe', eyes: 'dreamy', mouth: 'pout', nose: 'small', accessory: 'bowtie', skin: '#53B9AF', body: '#8A5DB3', hairColor: '#191719', accessoryColor: '#F5E742' },
  { ...DEFAULT_APPEARANCE, head: 'peanut', hair: 'sidepart', eyes: 'worried', mouth: 'tooth', nose: 'long', accessory: 'glasses', skin: '#F28C28', body: '#087BA0', hairColor: '#6A4637', accessoryColor: '#F5F2EA' },
  { ...DEFAULT_APPEARANCE, head: 'wedge', hair: 'curls', eyes: 'sideways', mouth: 'frown', nose: 'none', accessory: 'moustache', skin: '#8A5DB3', body: '#F5E742', hairColor: '#191719', accessoryColor: '#F5F2EA' },
  { ...DEFAULT_APPEARANCE, head: 'square', hair: 'bob', eyes: 'wide', mouth: 'grin', nose: 'snout', accessory: 'sunglasses', skin: '#F34531', body: '#53B9AF', hairColor: '#F5E742', accessoryColor: '#191719' },
  { ...DEFAULT_APPEARANCE, head: 'bean', hair: 'bun', eyes: 'sleepy', mouth: 'smile', nose: 'hook', accessory: 'eyepatch', skin: '#F5F2EA', body: '#9D422F', hairColor: '#8A5DB3', accessoryColor: '#087BA0' },
  { ...DEFAULT_APPEARANCE, head: 'pear', hair: 'none', eyes: 'tiny', mouth: 'surprised', nose: 'round', accessory: 'crown', skin: '#EE89BA', body: '#455FC1', accessoryColor: '#F5E742' },
  { ...DEFAULT_APPEARANCE, head: 'tall', hair: 'none', eyes: 'worried', mouth: 'tooth', nose: 'small', accessory: 'beret', skin: '#F5E742', body: '#65B847', accessoryColor: '#F34531' },
  { ...DEFAULT_APPEARANCE, head: 'potato', hair: 'none', eyes: 'uneven', mouth: 'flat', nose: 'long', accessory: 'cap', skin: '#53B9AF', body: '#F28C28', accessoryColor: '#455FC1' },
  { ...DEFAULT_APPEARANCE, head: 'egg', hair: 'none', eyes: 'dreamy', mouth: 'pout', nose: 'snout', accessory: 'beanie', skin: '#8A5DB3', body: '#EE89BA', accessoryColor: '#F5E742' },
];
