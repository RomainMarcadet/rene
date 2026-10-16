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
  it('accepts every catalogue word exactly and never confuses two different catalogue words', () => {
    const words = [...new Set(WORD_PAIRS.flatMap(pair => [pair.a, pair.b]))];
    for (const expected of words) {
      expect(isAcceptableWhiteGuess(expected, expected)).toBe(true);
      for (const other of words.filter(word => normalizeGuess(word) !== normalizeGuess(expected))) {
        expect(isAcceptableWhiteGuess(other, expected), `${other} != ${expected}`).toBe(false);
      }
    }
  });
});
