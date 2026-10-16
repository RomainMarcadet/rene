/** Server-only, conservative editorial vocabulary. See docs/v1.2.md before extending. */
export function normalizeGuess(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’‘ʼ]/gu, "'")
    .replace(/\s*[-‐‑‒–—−]\s*/gu, ' ').replace(/\s*'\s*/gu, "'")
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').replace(/\s+/gu, ' ').trim();
}

// Only these reviewed nouns receive a regular plural. Never stem an arbitrary input.
const regularNouns = `
chaise|tabouret|canapé|fauteuil|douche|baignoire|balai|aspirateur|savon|shampooing|fourchette|cuillère
chemise|t-shirt|botte|montre|horloge|téléphone|tablette|clé|oreiller|coussin|vase|pot|parfum|déodorant
cahier|carnet|clavier|piano|crayon|stylo|ascenseur|escalator|médecin|infirmier|prison|école|réunion|entretien|facture
chat|chien|mer|océan|lac|étang|rivière|fleuve|lion|tigre|lapin|lièvre|poule|canard|abeille|guêpe|papillon|libellule
montagne|colline|pluie|neige|soleil|lune|forêt|jungle|désert|savane|requin|dauphin|grenouille|crapaud|chouette|pie
rose|tulipe|chêne|érable|lave|magma|brume|brouillard|galet|gravier|mousse|lichen
café|thé|pizza|burger|pain|brioche|croissant|pomme|poire|orange|clémentine|pêche|abricot|confiture|miel
crêpe|gaufre|glace|sorbet|soupe|purée|beurre|margarine|lait|crème|yaourt|sushi|maki|quiche|tarte
raclette|fondue|ketchup|moutarde|courgette|concombre|persil|coriandre|cannelle|muscade|macaron|meringue|praline|nougat
cinéma|théâtre|roman|guitare|violon|batterie|tambour|chant|danse|football|rugby|badminton|puzzle|magicien|clown
chevalier|pirate|cow-boy|musée|galerie|concert|peinture|dessin|photographie|portrait|magazine|radio|podcast|opéra
satire|parodie|fable|conte|mythe|légende|sculpture|statue
avion|hélicoptère|train|métro|tramway|vélo|trottinette|sous-marin|voiture|moto|taxi|ambulance|valise|hôtel|camping
plage|piscine|tente|caravane|passeport|carte|boussole|phare|tour|pont|tunnel|port|gare|île|presqu’île
safari|randonnée|parc|jardin|auberge|gîte|croisière|traversée|escale|correspondance|visa|billet
`.trim().split(/[|\n]/u).map(word => word.trim());

const irregularGroups = [
  ['ticket de caisse', 'tickets de caisse'], ['pain au chocolat', 'pains au chocolat'],
  ['fromage blanc', 'fromages blancs'], ['bande dessinée', 'bandes dessinées'],
  ['comédie musicale', 'comédies musicales'], ['sac à dos', 'sacs à dos'], ["carte d’identité", "cartes d’identité"],
  ['bateau', 'bateaux'], ['château', 'châteaux'], ['corbeau', 'corbeaux'], ['rideau', 'rideaux'],
  ['journal', 'journaux'], ['hibou', 'hiboux'], ['cheval', 'chevaux'], ['œil', 'yeux'],
  ['bijou', 'bijoux'], ['chou', 'choux'], ['festival', 'festivals'], ['super-héros', 'super-héros'],
];
const groups = [...regularNouns.map(word => [word, `${word}s`]), ...irregularGroups].map(group => group.map(normalizeGuess));
const forms = new Map<string, readonly string[]>();
for (const group of groups) for (const form of group) forms.set(form, group);

// Finite, reviewed spelling errors. No edit-distance threshold and no claim that
// an unknown spelling is absent from French. Unknown/ambiguous proposals stay false.
const spellingVariants: Readonly<Record<string, readonly string[]>> = {
  balai: ['balaai', 'blaai'],
  aspirateur: ['aspiratuer', 'aspirater', 'aspiratwur'],
  helicoptere: ['helicoptre', 'helicptere', 'helicpotere', 'helicopterr'],
  trottinette: ['trotinette', 'trottinnette'],
  fourchette: ['fourchete'], brouillard: ['brouilard'],
  correspondance: ['correspondnace', 'correspondace'],
  concombre: ['conconbre'], serpent: ['serpemt'], coquillage: ['coquilage'],
};

function valid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[\p{Cf}\p{Cs}]/u.test(value) && !Array.from(value).some(char => { const code = char.codePointAt(0)!; return code <= 8 || (code >= 14 && code <= 31) || (code >= 127 && code <= 159); });
}

export function isAcceptableWhiteGuess(proposal: unknown, expectedWord: unknown): boolean {
  if (!valid(proposal) || !valid(expectedWord)) return false;
  const guess = normalizeGuess(proposal); const expected = normalizeGuess(expectedWord);
  if (!guess || !expected) return false;
  if (guess === expected) return true;
  const equivalents = forms.get(expected) ?? [expected];
  if (equivalents.includes(guess)) return true;
  return equivalents.some(form => spellingVariants[form]?.includes(guess) === true);
}
