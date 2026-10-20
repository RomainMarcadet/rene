import { describe, expect, it } from 'vitest';
import { isAcceptableWhiteGuess, normalizeGuess } from './whiteGuess.js';
import { WORD_PAIRS } from './words.js';

describe('conservative White spelling validation', () => {
  it.each([
    ['balai', 'balai'], ['BALAIS', 'balai'], ['balai', 'balais'], ['velo', 'vélo'],
    ['  « VÉLO ! »  ', 'vélo'], ['ve\u0301lo', 'vélo'], ['ＶＥＬＯ', 'vélo'],
    ['balaai', 'balai'], ['blaai', 'balai'], ['aspirater', 'aspirateur'],
    ['helicoptre', 'hélicoptère'], ['helicpotere', 'hélicoptère'], ['serpemt', 'serpent'],
    ['chevaux', 'cheval'], ['cheval', 'chevaux'], ['hiboux', 'hibou'], ['journaux', 'journal'], ['bateaux', 'bateau'],
    ['yeux', 'œil'], ['oeil', 'œil'], ['coeur', 'cœur'],
    ['pains au chocolat', 'pain au chocolat'], ['bandes dessinées', 'bande dessinée'],
    ['sacs à dos', 'sac à dos'], ['sous marin', 'sous-marin'], ['SOUS‑MARINS', 'sous-marin'],
    ["cartes   d'identité", 'carte d’identité'], ['fromages blancs', 'fromage blanc'],
    ['comédies musicales', 'comédie musicale'], ['  pomme\t \n', 'pomme'],
  ])('accepts %s for %s', (proposal, expected) => expect(isAcceptableWhiteGuess(proposal, expected)).toBe(true));

  it.each([
    ['chat', 'char'], ['char', 'chat'], ['serpent', 'lézard'], ['poisson', 'poison'], ['gâteau', 'bateau'],
    ['foule', 'poule'], ['page', 'plage'], ['tante', 'tente'], ['chien', 'chat'], ['livre', 'libre'],
    ['oreiller', 'coussin'], ['œils', 'œil'], ['chevals', 'cheval'], ['chateaus', 'château'],
    ['pain au chocolats', 'pain au chocolat'], ['bande dessinées', 'bande dessinée'],
    ['pomme de terre', 'pomme'], ['lunette', 'lunettes'], ['échec', 'échecs'], ['journl', 'journal'],
    ['n’importe quoi', 'balai'], ['', 'balai'], ['  !!!  ', 'balai'], ['balai', ''],
  ])('rejects uncertain or distinct %s for %s', (proposal, expected) => expect(isAcceptableWhiteGuess(proposal, expected)).toBe(false));

  it('rejects invalid, invisible, malformed Unicode and overlong values deterministically', () => {
    for (const proposal of [null, undefined, {}, 42, [], 'a'.repeat(101), 'balai\u0000', 'ba\u200blai', '\ud800']) {
      expect(isAcceptableWhiteGuess(proposal, 'balai')).toBe(false);
      expect(isAcceptableWhiteGuess('balai', proposal)).toBe(false);
    }
    expect(normalizeGuess(' «   Carte d’IDENTITÉ ! » ')).toBe("carte d'identite");
    for (let i = 0; i < 10; i++) expect(isAcceptableWhiteGuess('balais', 'balai')).toBe(true);
  });
  const references = new Map<string, string>();
  for (const pair of WORD_PAIRS) for (const side of ['a', 'b'] as const) {
    if (!references.has(pair[side])) references.set(pair[side], `${pair.id}:${side}`);
  }
  const words = [...references.keys()];
  const normalized = words.map(normalizeGuess);
  // Evaluate the same exhaustive, directed cross-product through the real validator.
  // Normalize only once for the exclusion filter, avoid millions of assertion objects,
  // and keep each batch within the normal test timeout. Diagnostics contain IDs only.
  it.each(Array.from({ length: Math.ceil(words.length / 100) }, (_, index) => index))('accepts exact catalogue words and rejects every distinct word, batch %i', batch => {
    let failures = 0;
    const examples: { expected: string; proposal: string; kind: 'exact' | 'collision' }[] = [];
    const record = (expected: number, proposal: number, kind: 'exact' | 'collision') => {
      failures++;
      if (examples.length < 20) examples.push({ expected: references.get(words[expected])!, proposal: references.get(words[proposal])!, kind });
    };
    for (let i = batch * 100; i < Math.min(words.length, (batch + 1) * 100); i++) {
      if (!isAcceptableWhiteGuess(words[i], words[i])) record(i, i, 'exact');
      for (let j = 0; j < words.length; j++) {
        if (normalized[i] !== normalized[j] && isAcceptableWhiteGuess(words[j], words[i])) record(i, j, 'collision');
      }
    }
    expect({ failures, examples }).toEqual({ failures: 0, examples: [] });
  });
});
