import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Role, type RoomSettings } from '@rene/contracts';
import { applyGameAction, createGame, normalizeGuess, privateGame, publicGame, type GameAction, type GameState } from './game.js';
import { chooseWordPair, WORD_PAIRS, type WordPair } from './words.js';

const pair: WordPair = { id: 'fixture', a: 'Étoile de mer', b: 'Coquillage', category: 'nature', difficulty: 'medium' };
const random = () => 0;
function fixture(count = 4, settings: Partial<RoomSettings> = {}) {
  return createGame({ id: 'game-1', playerIds: Array.from({ length: count }, (_, i) => `p${i}`), settings: { ...DEFAULT_SETTINGS, ...settings }, pair, now: 0, random });
}
function act(game: GameState, action: GameAction) { return applyGameAction(game, action, game.deadline! - 1, random); }
function expire(game: GameState) { return applyGameAction(game, { type: 'timeout' }, game.deadline!, random); }
function players(game: GameState, role: Role) { return game.playerIds.filter(id => game.roles[id] === role); }
function toVote(initial: GameState): GameState {
  let game = initial;
  if (game.phase === 'reveal' || game.phase === 'elimination') game = expire(game);
  while (game.phase === 'description') game = act(game, { type: 'describe', playerId: game.turnPlayerId!, text: 'Un indice' });
  expect(game.phase).toBe('discussion');
  return act(game, { type: 'skipDiscussion' });
}
function votedOut(initial: GameState, targetId: string): GameState {
  let game = toVote(initial);
  const ids = [...game.alive];
  for (const playerId of ids) game = act(game, { type: 'vote', playerId, targetId: playerId === targetId ? ids.find(id => id !== targetId)! : targetId });
  expect(game.eliminatedPlayerId).toBe(targetId);
  return game;
}

describe('distribution et confidentialité', () => {
  it('attribue les compositions automatiques sans victoire immédiate de 4 à 12 joueurs', () => {
    for (let count = 4; count <= 12; count++) {
      const game = fixture(count);
      expect(players(game, 'undercover')).toHaveLength(count <= 7 ? 1 : count <= 10 ? 2 : 3);
      expect(players(game, 'white')).toHaveLength(count >= 5 ? 1 : 0);
      expect(game.result).toBeNull();
      expect(game.phase).toBe('reveal');
      expect(new Set(game.order).size).toBe(count);
    }
  });
  it('rejette les compositions invalides et les identités dupliquées', () => {
    expect(() => fixture(3)).toThrow();
    expect(() => fixture(13)).toThrow();
    expect(() => fixture(4, { automaticRoles: false, undercoverCount: 2, whiteCount: 1 })).toThrow(/Composition/);
    expect(() => fixture(4, { automaticRoles: false, undercoverCount: 0, whiteCount: 0 })).toThrow(/Composition/);
    expect(() => createGame({ id: 'x', playerIds: ['p', 'p', 'q', 'r'], settings: DEFAULT_SETTINGS, pair, now: 0, random })).toThrow(/distincts/);
  });
  it('ne projette aucun rôle vivant, aucun autre mot, ni la banque dans les données publiques', () => {
    const game = fixture(5);
    const snapshot = publicGame(game);
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain(pair.a);
    expect(json).not.toContain(pair.b);
    expect(snapshot).not.toHaveProperty('roles');
    expect(snapshot).not.toHaveProperty('words');
    expect(snapshot).not.toHaveProperty('ballots');
    for (const id of game.playerIds) {
      const privateState = privateGame(game, id);
      expect(privateState).not.toHaveProperty('role');
      expect(privateState.word).toBe(game.roles[id] === 'white' ? null : game.words[game.roles[id] as 'civilian' | 'undercover']);
    }
    expect(privateGame(game, 'spectator')).toEqual({ playerId: 'spectator', inGame: false, word: null, voteTarget: null });
  });
  it('permet les deux orientations de la paire', () => {
    const game = createGame({ id: 'reverse', playerIds: ['a', 'b', 'c', 'd'], settings: DEFAULT_SETTINGS, pair, now: 0, random: () => 0.99 });
    expect(game.words).toEqual({ civilian: pair.b, undercover: pair.a });
  });
  it('renvoie des copies indépendantes de l’état interne', () => {
    const game = fixture();
    const snapshot = publicGame(game);
    snapshot.order.reverse();
    expect(game.order).not.toEqual(snapshot.order);
    const before = structuredClone(game);
    expire(game);
    expect(game).toEqual(before);
  });
});

describe('descriptions et échéances', () => {
  it('garde les rôles et mots secrets fixes et fait décrire chaque joueur dans l’ordre', () => {
    let game = expire(fixture(5));
    const original = structuredClone(game);
    expect(game.turnPlayerId).toBe(game.order[0]);
    while (game.phase === 'description') {
      const previousPhaseId = game.phaseId;
      const id = game.turnPlayerId!;
      game = act(game, { type: 'describe', playerId: id, text: '  Une   courte phrase  ' });
      expect(game.phaseId).not.toBe(previousPhaseId);
    }
    expect(game.phase).toBe('discussion');
    expect(game.descriptions.map(item => item.playerId)).toEqual(original.order);
    expect(game.descriptions.every(item => item.text === 'Une courte phrase')).toBe(true);
    expect(game.roles).toEqual(original.roles);
    expect(game.words).toEqual(original.words);
  });
  it('rejette les descriptions hors tour, vides et trop longues sans muter le jeu', () => {
    const game = expire(fixture());
    const before = structuredClone(game);
    expect(() => act(game, { type: 'describe', playerId: game.order[1], text: 'Triche' })).toThrow(/tour/);
    for (const text of [' ', 'x'.repeat(101), '\u0001']) expect(() => act(game, { type: 'describe', playerId: game.turnPlayerId!, text })).toThrow();
    expect(game).toEqual(before);
  });
  it('refuse les échéances anticipées et les actions arrivées après le délai', () => {
    const game = fixture();
    expect(() => applyGameAction(game, { type: 'timeout' }, 7_999)).toThrow(/chronomètre/);
    const describing = expire(game);
    expect(() => applyGameAction(describing, { type: 'describe', playerId: describing.turnPlayerId!, text: 'Tard' }, describing.deadline!)).toThrow(/délai/);
  });
  it('fait expirer les tours absents et ouvre le vote automatiquement', () => {
    let game = expire(fixture());
    for (let i = 0; i < 4; i++) game = expire(game);
    expect(game.phase).toBe('discussion');
    expect(game.descriptions.every(item => item.timedOut)).toBe(true);
    game = expire(game);
    expect(game.phase).toBe('vote');
  });
  it('respecte le paramètre de discussion non écourtable', () => {
    let game = expire(fixture(4, { hostCanSkipDiscussion: false }));
    for (let i = 0; i < 4; i++) game = expire(game);
    expect(() => act(game, { type: 'skipDiscussion' })).toThrow(/écourtée/);
    expect(expire(game).phase).toBe('vote');
  });
});

describe('scrutin autoritaire', () => {
  it('rejette un vote multiple, contre soi, une cible absente et un votant absent', () => {
    let game = toVote(fixture());
    const [a, b] = game.alive;
    expect(() => act(game, { type: 'vote', playerId: a, targetId: a })).toThrow(/vous-même/);
    expect(() => act(game, { type: 'vote', playerId: a, targetId: 'absent' })).toThrow(/cible/);
    expect(() => act(game, { type: 'vote', playerId: 'absent', targetId: a })).toThrow(/vivants/);
    const phaseId = game.phaseId;
    game = act(game, { type: 'vote', playerId: a, targetId: b });
    expect(game.phaseId).toBe(phaseId);
    expect(() => act(game, { type: 'vote', playerId: a, targetId: b })).toThrow(/déjà/);
    expect(publicGame(game).voteCounts).toBeNull();
    expect(publicGame(game)).not.toHaveProperty('ballots');
    expect(privateGame(game, a).voteTarget).toBe(b);
    expect(privateGame(game, b).voteTarget).toBeNull();
  });
  it('organise un second vote entre ex æquo puis tire au sort seulement parmi les nouveaux premiers', () => {
    let game = toVote(fixture());
    const [a, b, c, d] = game.alive;
    for (const [playerId, targetId] of [[a, b], [b, a], [c, a], [d, b]]) game = act(game, { type: 'vote', playerId, targetId });
    expect(game.phase).toBe('tiebreak');
    expect(game.voteCandidates.sort()).toEqual([a, b].sort());
    expect(game.votedPlayerIds).toEqual([]);
    expect(() => act(game, { type: 'vote', playerId: a, targetId: c })).toThrow(/cible/);
    for (const [playerId, targetId] of [[a, b], [b, a], [c, a], [d, b]]) game = act(game, { type: 'vote', playerId, targetId });
    expect(game.phase).toBe('elimination');
    expect([a, b]).toContain(game.eliminatedPlayerId);
    expect(game.voteCounts).toEqual({ [a]: 2, [b]: 2 });
  });
  it('reprend un cycle sans élimination si personne ne vote et fait tourner le premier joueur', () => {
    const game = toVote(fixture());
    const next = expire(game);
    expect(next.phase).toBe('description');
    expect(next.round).toBe(2);
    expect(next.alive).toEqual(game.alive);
    expect(next.turnPlayerId).toBe(game.order[1]);
    expect(next.words).toEqual(game.words);
    expect(next.roles).toEqual(game.roles);
    expect(next.descriptions).toHaveLength(4);
  });
  it('comptabilise les suffrages exprimés même si les autres s’abstiennent', () => {
    let game = toVote(fixture());
    const [a, b] = game.alive;
    game = act(game, { type: 'vote', playerId: a, targetId: b });
    game = expire(game);
    expect(game.eliminatedPlayerId).toBe(b);
    expect(game.voteCounts?.[b]).toBe(1);
  });
  it('exclut les morts de la description, du vote et des cibles', () => {
    let game = fixture();
    const dead = players(game, 'civilian')[0];
    game = toVote(votedOut(game, dead));
    expect(game.order).not.toContain(dead);
    expect(game.voteCandidates).not.toContain(dead);
    expect(() => act(game, { type: 'vote', playerId: dead, targetId: game.alive[0] })).toThrow(/vivants/);
    expect(() => act(game, { type: 'vote', playerId: game.alive[0], targetId: dead })).toThrow(/cible/);
  });
});

describe('victoires et points', () => {
  it('termine des parties complètes à tous les effectifs en conservant les invariants de rôle', () => {
    let seed = 42;
    const seeded = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let count = 4; count <= 12; count++) {
      let game = createGame({ id: `seed-${count}`, playerIds: Array.from({ length: count }, (_, i) => `p${i}`), settings: DEFAULT_SETTINGS, pair, now: 0, random: seeded });
      const originalRoles = { ...game.roles };
      let transitions = 0;
      while (game.phase !== 'results' && transitions++ < 300) {
        let action: GameAction;
        if (game.phase === 'description') action = { type: 'describe', playerId: game.turnPlayerId!, text: 'Indice' };
        else if (game.phase === 'vote' || game.phase === 'tiebreak') {
          const playerId = game.alive.find(id => !game.votedPlayerIds.includes(id) && game.voteCandidates.some(target => target !== id));
          if (!playerId) action = { type: 'timeout' };
          else {
            const candidates = game.voteCandidates.filter(id => id !== playerId);
            action = { type: 'vote', playerId, targetId: candidates[Math.floor(seeded() * candidates.length)] };
          }
        } else if (game.phase === 'whiteGuess') action = { type: 'guess', playerId: game.whitePlayerId!, word: 'Faux' };
        else action = { type: 'timeout' };
        game = applyGameAction(game, action, game.deadline! - (action.type === 'timeout' ? 0 : 1), seeded);
        expect(game.roles).toEqual(originalRoles);
        expect(new Set(game.alive).size).toBe(game.alive.length);
        if (game.phase === 'description') expect(game.alive).toContain(game.turnPlayerId);
      }
      expect(game.phase).toBe('results');
      expect(game.result?.winnerIds.length).toBeGreaterThan(0);
    }
  });
  it('termine une partie civile et accorde deux points aux Civils, y compris éliminés', () => {
    let game = fixture();
    const deadCivilian = players(game, 'civilian')[0];
    game = votedOut(game, deadCivilian);
    game = votedOut(game, players(game, 'undercover')[0]);
    expect(game.phase).toBe('elimination');
    game = expire(game);
    expect(game.result?.winner).toBe('civilians');
    for (const id of players(game, 'civilian')) expect(game.result?.points[id]).toBe(2);
    expect(game.result?.points[players(game, 'undercover')[0]]).toBe(0);
    expect(game.result?.roles).toEqual(game.roles);
    expect(game.result?.civilWord).toBe(pair.a);
    expect(game.deadline).toBeNull();
    expect(() => act(game, { type: 'timeout' })).toThrow(/terminée/);
  });
  it('accorde dix points aux Undercovers et six aux Mr. Whites du camp gagnant même éliminés', () => {
    let game = fixture(5);
    const white = players(game, 'white')[0];
    game = votedOut(game, white);
    game = act(game, { type: 'guess', playerId: white, word: 'Fausse réponse' });
    game = votedOut(game, players(game, 'civilian')[0]);
    game = votedOut(game, players(game, 'civilian')[1]);
    game = expire(game);
    expect(game.result?.winner).toBe('infiltrators');
    expect(game.result?.points[white]).toBe(6);
    expect(game.result?.points[players(game, 'undercover')[0]]).toBe(10);
    expect(game.result?.winnerIds).toContain(white);
    for (const id of players(game, 'civilian')) expect(game.result?.points[id]).toBe(0);
  });
  it('donne priorité à la tentative du dernier Mr. White et récompense uniquement celui-ci', () => {
    let game = fixture(4, { automaticRoles: false, undercoverCount: 0, whiteCount: 1 });
    const white = players(game, 'white')[0];
    game = votedOut(game, white);
    expect(game.phase).toBe('whiteGuess');
    expect(game.result).toBeNull();
    game = act(game, { type: 'guess', playerId: white, word: '  ETOILE   DE  MER  ' });
    expect(game.result?.winner).toBe('white');
    expect(game.result?.winnerIds).toEqual([white]);
    expect(Object.values(game.result!.points).reduce((a, b) => a + b)).toBe(6);
  });
  it('normalise accents, casse et espaces sans accepter des synonymes', () => {
    expect(normalizeGuess('  Étoile\n  de MÈR ')).toBe('etoile de mer');
    let game = fixture(4, { automaticRoles: false, undercoverCount: 0, whiteCount: 1 });
    const white = players(game, 'white')[0];
    game = votedOut(game, white);
    expect(() => act(game, { type: 'guess', playerId: game.alive[0], word: pair.a })).toThrow(/deviner/);
    game = act(game, { type: 'guess', playerId: white, word: 'Astérie' });
    expect(() => act(game, { type: 'guess', playerId: white, word: pair.a })).toThrow(/deviner/);
    game = expire(game);
    expect(game.result?.winner).toBe('civilians');
  });
  it('fait expirer la tentative de Mr. White puis applique la victoire civile', () => {
    let game = fixture(4, { automaticRoles: false, undercoverCount: 0, whiteCount: 1 });
    game = votedOut(game, players(game, 'white')[0]);
    game = expire(game);
    expect(game.phase).toBe('elimination');
    game = expire(game);
    expect(game.result?.winner).toBe('civilians');
  });
});

describe('abandons', () => {
  it('fait passer un tour abandonné sans donner de tentative à un Mr. White sortant', () => {
    let game = expire(fixture(5));
    const current = game.turnPlayerId!;
    game = act(game, { type: 'leave', playerId: current });
    expect(game.alive).not.toContain(current);
    expect(game.turnPlayerId).not.toBe(current);
    expect(game.phase).not.toBe('whiteGuess');
    expect(privateGame(game, current).inGame).toBe(false);
  });
  it('annule les votes visant un joueur qui abandonne et permet de revoter', () => {
    let game = toVote(fixture(5));
    const target = players(game, 'civilian')[0];
    const voter = game.alive.find(id => id !== target)!;
    game = act(game, { type: 'vote', playerId: voter, targetId: target });
    game = act(game, { type: 'leave', playerId: target });
    expect(game.ballots[voter]).toBeUndefined();
    expect(game.votedPlayerIds).not.toContain(voter);
    expect(game.voteCandidates).not.toContain(target);
    game = act(game, { type: 'vote', playerId: voter, targetId: game.alive.find(id => id !== voter)! });
    expect(game.votedPlayerIds).toContain(voter);
  });
  it('termine correctement quand le dernier infiltré abandonne', () => {
    let game = fixture();
    game = act(game, { type: 'leave', playerId: players(game, 'undercover')[0] });
    expect(game.result?.winner).toBe('civilians');
  });
  it('préserve une tentative déjà ouverte si un autre joueur quitte', () => {
    let game = fixture(4, { automaticRoles: false, undercoverCount: 0, whiteCount: 1 });
    const white = players(game, 'white')[0];
    game = votedOut(game, white);
    game = act(game, { type: 'leave', playerId: game.alive[0] });
    expect(game.phase).toBe('whiteGuess');
    game = act(game, { type: 'guess', playerId: white, word: pair.a });
    expect(game.result?.winner).toBe('white');
  });
  it('abandonner pendant sa propre tentative y met fin', () => {
    let game = fixture(4, { automaticRoles: false, undercoverCount: 0, whiteCount: 1 });
    const white = players(game, 'white')[0];
    game = votedOut(game, white);
    game = act(game, { type: 'leave', playerId: white });
    expect(game.phase).toBe('elimination');
    expect(expire(game).result?.winner).toBe('civilians');
  });
});

describe('banque française', () => {
  it('contient au moins 100 paires distinctes avec tous les filtres utilisables', () => {
    expect(WORD_PAIRS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(WORD_PAIRS.map(item => item.id)).size).toBe(WORD_PAIRS.length);
    expect(new Set(WORD_PAIRS.map(item => [normalizeGuess(item.a), normalizeGuess(item.b)].sort().join('|'))).size).toBe(WORD_PAIRS.length);
    for (const category of ['quotidien', 'nature', 'cuisine', 'culture', 'voyage'] as const) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const selected = chooseWordPair({ category, difficulty }, [], random);
        expect(selected.category).toBe(category);
        expect(selected.difficulty).toBe(difficulty);
      }
    }
  });
  it('ne répète aucune paire avant épuisement, y compris dans les cycles suivants', () => {
    const settings = { category: 'nature', difficulty: 'hard' } as const;
    const count = WORD_PAIRS.filter(pair => pair.category === 'nature' && pair.difficulty === 'hard').length;
    const history: string[] = [];
    for (let i = 0; i < count * 3; i++) history.push(chooseWordPair(settings, history, random).id);
    for (let i = 0; i < 3; i++) expect(new Set(history.slice(i * count, (i + 1) * count)).size).toBe(count);
    expect(history[count]).not.toBe(history[count - 1]);
  });
});
