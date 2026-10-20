import type { WordPair } from "./wordTypes.js";

type Entry = readonly [string, string, WordPair['difficulty']];
const groups = {
  quotidien: [
    ['Chaise', 'Tabouret', 'easy'], ['Canapé', 'Fauteuil', 'easy'], ['Douche', 'Baignoire', 'easy'],
    ['Balai', 'Aspirateur', 'easy'], ['Savon', 'Shampooing', 'easy'], ['Fourchette', 'Cuillère', 'easy'],
    ['Chemise', 'T-shirt', 'easy'], ['Bottes', 'Baskets', 'easy'], ['Lunettes', 'Lentilles', 'easy'],
    ['Montre', 'Horloge', 'easy'], ['Téléphone', 'Tablette', 'easy'], ['Clé', 'Cadenas', 'easy'],
    ['Oreiller', 'Coussin', 'medium'], ['Rideau', 'Store', 'medium'], ['Vase', 'Pot', 'medium'],
    ['Parfum', 'Déodorant', 'medium'], ['Cahier', 'Carnet', 'medium'], ['Clavier', 'Piano', 'medium'],
    ['Crayon', 'Stylo', 'medium'], ['Ascenseur', 'Escalator', 'medium'], ['Médecin', 'Infirmier', 'medium'],
    ['Prison', 'École', 'hard'], ['Réunion', 'Entretien', 'hard'], ['Facture', 'Ticket de caisse', 'hard'],
  ],
  nature: [
    ['Chat', 'Chien', 'easy'], ['Mer', 'Océan', 'easy'], ['Lac', 'Étang', 'easy'],
    ['Rivière', 'Fleuve', 'easy'], ['Lion', 'Tigre', 'easy'], ['Lapin', 'Lièvre', 'easy'],
    ['Poule', 'Canard', 'easy'], ['Abeille', 'Guêpe', 'easy'], ['Papillon', 'Libellule', 'easy'],
    ['Montagne', 'Colline', 'easy'], ['Pluie', 'Neige', 'easy'], ['Soleil', 'Lune', 'easy'],
    ['Forêt', 'Jungle', 'medium'], ['Désert', 'Savane', 'medium'], ['Requin', 'Dauphin', 'medium'],
    ['Grenouille', 'Crapaud', 'medium'], ['Hibou', 'Chouette', 'medium'], ['Corbeau', 'Pie', 'medium'],
    ['Rose', 'Tulipe', 'medium'], ['Chêne', 'Érable', 'medium'], ['Lave', 'Magma', 'hard'],
    ['Brume', 'Brouillard', 'hard'], ['Galets', 'Graviers', 'hard'], ['Mousse', 'Lichen', 'hard'],
  ],
  cuisine: [
    ['Café', 'Thé', 'easy'], ['Pizza', 'Burger', 'easy'], ['Pain', 'Brioche', 'easy'],
    ['Croissant', 'Pain au chocolat', 'easy'], ['Pomme', 'Poire', 'easy'], ['Orange', 'Clémentine', 'easy'],
    ['Pêche', 'Abricot', 'easy'], ['Confiture', 'Miel', 'easy'], ['Crêpe', 'Gaufre', 'easy'],
    ['Glace', 'Sorbet', 'easy'], ['Soupe', 'Purée', 'easy'], ['Riz', 'Pâtes', 'easy'],
    ['Beurre', 'Margarine', 'medium'], ['Lait', 'Crème', 'medium'], ['Yaourt', 'Fromage blanc', 'medium'],
    ['Sushi', 'Maki', 'medium'], ['Quiche', 'Tarte', 'medium'], ['Raclette', 'Fondue', 'medium'],
    ['Ketchup', 'Moutarde', 'medium'], ['Courgette', 'Concombre', 'medium'], ['Persil', 'Coriandre', 'hard'],
    ['Cannelle', 'Muscade', 'hard'], ['Macaron', 'Meringue', 'hard'], ['Praline', 'Nougat', 'hard'],
  ],
  culture: [
    ['Cinéma', 'Théâtre', 'easy'], ['Roman', 'Bande dessinée', 'easy'], ['Guitare', 'Violon', 'easy'],
    ['Batterie', 'Tambour', 'easy'], ['Chant', 'Danse', 'easy'], ['Football', 'Rugby', 'easy'],
    ['Tennis', 'Badminton', 'easy'], ['Échecs', 'Dames', 'easy'], ['Puzzle', 'Lego', 'easy'],
    ['Magicien', 'Clown', 'easy'], ['Super-héros', 'Chevalier', 'easy'], ['Pirate', 'Cow-boy', 'easy'],
    ['Netflix', 'YouTube', 'medium'], ['Musée', 'Galerie', 'medium'], ['Concert', 'Festival', 'medium'],
    ['Peinture', 'Dessin', 'medium'], ['Photographie', 'Portrait', 'medium'], ['Journal', 'Magazine', 'medium'],
    ['Radio', 'Podcast', 'medium'], ['Opéra', 'Comédie musicale', 'medium'], ['Satire', 'Parodie', 'hard'],
    ['Fable', 'Conte', 'hard'], ['Mythe', 'Légende', 'hard'], ['Sculpture', 'Statue', 'hard'],
  ],
  voyage: [
    ['Avion', 'Hélicoptère', 'easy'], ['Train', 'Métro', 'easy'], ['Bus', 'Tramway', 'easy'],
    ['Vélo', 'Trottinette', 'easy'], ['Bateau', 'Sous-marin', 'easy'], ['Voiture', 'Moto', 'easy'],
    ['Taxi', 'Ambulance', 'easy'], ['Valise', 'Sac à dos', 'easy'], ['Hôtel', 'Camping', 'easy'],
    ['Plage', 'Piscine', 'easy'], ['Tente', 'Caravane', 'easy'], ['Château', 'Palais', 'easy'],
    ['Passeport', 'Carte d’identité', 'medium'], ['Carte', 'Boussole', 'medium'], ['Phare', 'Tour', 'medium'],
    ['Pont', 'Tunnel', 'medium'], ['Port', 'Gare', 'medium'], ['Île', 'Presqu’île', 'medium'],
    ['Safari', 'Randonnée', 'medium'], ['Parc', 'Jardin', 'medium'], ['Auberge', 'Gîte', 'hard'],
    ['Croisière', 'Traversée', 'hard'], ['Escale', 'Correspondance', 'hard'], ['Visa', 'Billet', 'hard'],
  ],
} satisfies Partial<Record<WordPair['category'], readonly Entry[]>>;

/** These 120 original editorial pairs are bundled exclusively into the server. */
export const LEGACY_WORD_PAIRS: readonly WordPair[] = Object.entries(groups).flatMap(([category, entries]) =>
  entries.map(([a, b, difficulty], index) => ({ id: `${category}-${String(index + 1).padStart(2, '0')}`, a, b, category: category as WordPair['category'], difficulty })),
);
