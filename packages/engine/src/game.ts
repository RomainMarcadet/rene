import { SettingsSchema, roleCounts, validComposition, type GameResult, type Phase, type PrivateGameState, type PublicGame, type Role, type RoomSettings, type Winner } from '@rene/contracts';
import type { WordPair } from './words.js';
import { normalizeGuess, isAcceptableWhiteGuess } from './whiteGuess.js';
export { normalizeGuess, isAcceptableWhiteGuess } from './whiteGuess.js';

/** Server-only state. Always project through publicGame/privateGame before sending. */
export interface GameState extends PublicGame {
  playerIds: string[];
  roles: Record<string, Role>;
  alive: string[];
  departed: string[];
  words: { civilian: string; undercover: string };
  settings: RoomSettings;
  ballots: Record<string, string>;
  revision: number;
}

export type GameAction =
  | { type: 'describe'; playerId: string; text: string }
  | { type: 'vote'; playerId: string; targetId: string }
  | { type: 'guess'; playerId: string; word: string }
  | { type: 'skipDiscussion' }
  | { type: 'setVoteReady'; playerId: string; ready: boolean }
  | { type: 'leave'; playerId: string }
  | { type: 'timeout' };

type Random = () => number;

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function randomIndex(length: number, random: Random) {
  const value = random();
  requireRule(value >= 0 && value < 1, 'Le générateur aléatoire est invalide.');
  return Math.floor(value * length);
}

function shuffled<T>(values: readonly T[], random: Random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, random);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(input: {
  id: string; playerIds: string[]; settings: RoomSettings; pair: WordPair; now: number; random?: Random;
}): GameState {
  const { id, playerIds, pair, now, random = Math.random } = input;
  const settings = SettingsSchema.parse(input.settings);
  requireRule(Number.isFinite(now), 'Horloge invalide.');
  requireRule(id.length > 0 && playerIds.every(id => id.length > 0) && new Set(playerIds).size === playerIds.length, 'Les joueurs doivent être distincts.');
  requireRule(validComposition(playerIds.length, settings), 'Composition invalide : 4 à 12 joueurs, au moins deux Civils et un Infiltré.');
  requireRule(pair.a.trim() && pair.b.trim() && normalizeGuess(pair.a) !== normalizeGuess(pair.b), 'La paire de mots doit contenir deux mots distincts.');
  const counts = roleCounts(playerIds.length, settings);
  const assignedRoles: Role[] = [
    ...Array<Role>(counts.civilian).fill('civilian'),
    ...Array<Role>(counts.undercover).fill('undercover'),
    ...Array<Role>(counts.white).fill('white'),
  ];
  const assignedPlayers = shuffled(playerIds, random);
  const roles = Object.fromEntries(assignedPlayers.map((playerId, i) => [playerId, assignedRoles[i]]));
  const invert = randomIndex(2, random) === 1;
  return {
    id, playerIds: [...playerIds], roles, alive: [...playerIds], departed: [],
    words: { civilian: invert ? pair.b : pair.a, undercover: invert ? pair.a : pair.b }, settings,
    phase: 'reveal', phaseId: `${id}:0`, revision: 0, round: 1, deadline: now + 8_000,
    turnPlayerId: null, order: shuffled(playerIds, random), descriptions: [],
    readyToVotePlayerIds: [], ballots: {}, voteCandidates: [], voteCounts: null, votedPlayerIds: [],
    eliminatedPlayerId: null, whitePlayerId: null, result: null,
  };
}

function enter(game: GameState, phase: Phase, now: number, seconds: number | null) {
  game.phase = phase;
  game.readyToVotePlayerIds = [];
  game.revision += 1;
  game.phaseId = `${game.id}:${game.revision}`;
  game.deadline = seconds === null ? null : now + seconds * 1_000;
  game.turnPlayerId = null;
}

function finish(game: GameState, winner: Winner, now: number, whiteId?: string) {
  const winnerIds = game.playerIds.filter(id => winner === 'white' ? id === whiteId : winner === 'civilians' ? game.roles[id] === 'civilian' : game.roles[id] !== 'civilian');
  const points = Object.fromEntries(game.playerIds.map(id => [id, winnerIds.includes(id) ? game.roles[id] === 'civilian' ? 2 : game.roles[id] === 'undercover' ? 10 : 6 : 0]));
  game.result = { winner, winnerIds, civilWord: game.words.civilian, undercoverWord: game.words.undercover, roles: { ...game.roles }, points };
  game.whitePlayerId = null;
  enter(game, 'results', now, null);
}

/** Civilians have priority when both populations are exhausted by departures. */
function finishIfWon(game: GameState, now: number): boolean {
  if (!game.alive.some(id => game.roles[id] !== 'civilian')) {
    finish(game, 'civilians', now);
    return true;
  }
  if (game.alive.filter(id => game.roles[id] === 'civilian').length <= 1) {
    finish(game, 'infiltrators', now);
    return true;
  }
  return false;
}

function nextDescription(game: GameState, now: number) {
  const spoken = new Set(game.descriptions.filter(item => item.round === game.round).map(item => item.playerId));
  const next = game.order.find(id => game.alive.includes(id) && !spoken.has(id));
  if (next) {
    enter(game, 'description', now, game.settings.descriptionSeconds);
    game.turnPlayerId = next;
  } else {
    enter(game, 'discussion', now, game.settings.discussionSeconds);
  }
}

function newRound(game: GameState, now: number) {
  game.round += 1;
  game.order = game.order.filter(id => game.alive.includes(id));
  if (game.order.length > 1) game.order.push(game.order.shift()!);
  game.ballots = {};
  game.votedPlayerIds = [];
  game.voteCandidates = [];
  game.voteCounts = null;
  game.eliminatedPlayerId = null;
  game.whitePlayerId = null;
  nextDescription(game, now);
}

function everyoneReadyToVote(game: GameState) {
  return game.alive.length > 0 && game.alive.every(id => game.readyToVotePlayerIds.includes(id));
}

function startVote(game: GameState, now: number, candidates = game.alive, tiebreak = false) {
  game.ballots = {};
  game.votedPlayerIds = [];
  game.voteCandidates = [...candidates];
  game.voteCounts = null;
  enter(game, tiebreak ? 'tiebreak' : 'vote', now, game.settings.voteSeconds);
}

function eliminate(game: GameState, playerId: string, now: number) {
  game.alive = game.alive.filter(id => id !== playerId);
  game.eliminatedPlayerId = playerId;
  if (game.roles[playerId] === 'white') {
    game.whitePlayerId = playerId;
    enter(game, 'whiteGuess', now, game.settings.guessSeconds);
  } else {
    enter(game, 'elimination', now, 3);
  }
}

function resolveVote(game: GameState, now: number, random: Random) {
  const counts = Object.fromEntries(game.voteCandidates.map(id => [id, 0]));
  for (const target of Object.values(game.ballots)) if (Object.hasOwn(counts, target)) counts[target]++;
  game.voteCounts = counts;
  const highest = Math.max(0, ...Object.values(counts));
  if (highest === 0) { newRound(game, now); return; }
  const tied = game.voteCandidates.filter(id => counts[id] === highest);
  if (tied.length > 1 && game.phase === 'vote') { startVote(game, now, tied, true); return; }
  eliminate(game, tied[randomIndex(tied.length, random)], now);
}

function everyoneVoted(game: GameState) {
  return game.alive.filter(id => game.voteCandidates.some(candidate => candidate !== id)).every(id => Object.hasOwn(game.ballots, id));
}

function timeout(game: GameState, now: number, random: Random) {
  requireRule(game.deadline !== null && now >= game.deadline, 'Le chronomètre de cette phase n’est pas terminé.');
  switch (game.phase) {
    case 'reveal': nextDescription(game, now); break;
    case 'description':
      game.descriptions.push({ playerId: game.turnPlayerId!, text: 'Temps écoulé', round: game.round, timedOut: true });
      nextDescription(game, now);
      break;
    case 'discussion': startVote(game, now); break;
    case 'vote': case 'tiebreak': resolveVote(game, now, random); break;
    case 'whiteGuess':
      game.whitePlayerId = null;
      enter(game, 'elimination', now, 3);
      break;
    case 'elimination': if (!finishIfWon(game, now)) newRound(game, now); break;
    case 'results': throw new Error('La partie est terminée.');
  }
}

function leave(game: GameState, playerId: string, now: number, random: Random) {
  requireRule(game.playerIds.includes(playerId), 'Ce joueur ne participe pas à la partie.');
  if (game.departed.includes(playerId)) return;
  game.departed.push(playerId);
  game.readyToVotePlayerIds = game.readyToVotePlayerIds.filter(id => id !== playerId);
  const wasAlive = game.alive.includes(playerId);
  game.alive = game.alive.filter(id => id !== playerId);
  if (game.phase === 'whiteGuess') {
    // A pending White always keeps their one guess, even when another player leaves.
    if (game.whitePlayerId === playerId) {
      game.whitePlayerId = null;
      enter(game, 'elimination', now, 3);
    }
    return;
  }
  if (!wasAlive || finishIfWon(game, now)) return;
  if (game.phase === 'discussion' && everyoneReadyToVote(game)) startVote(game, now);
  if (game.phase === 'description' && game.turnPlayerId === playerId) nextDescription(game, now);
  if (game.phase === 'vote' || game.phase === 'tiebreak') {
    game.voteCandidates = game.voteCandidates.filter(id => id !== playerId);
    game.ballots = Object.fromEntries(Object.entries(game.ballots).filter(([voter, target]) => voter !== playerId && target !== playerId));
    game.votedPlayerIds = Object.keys(game.ballots);
    if (!game.voteCandidates.length) newRound(game, now);
    else if (everyoneVoted(game)) resolveVote(game, now, random);
  }
}

function validatedText(text: string) {
  requireRule(typeof text === 'string', 'Texte invalide.');
  const normalized = text.trim().replace(/\s+/gu, ' ');
  requireRule(normalized.length > 0 && normalized.length <= 100 && !Array.from(normalized).some(char => char.charCodeAt(0) < 32), 'Saisissez entre 1 et 100 caractères.');
  return normalized;
}

/** Pure transition: rejected actions never mutate the prior state. */
export function applyGameAction(previous: GameState, action: GameAction, now: number, random: Random = Math.random): GameState {
  requireRule(Number.isFinite(now), 'Horloge invalide.');
  requireRule(previous.phase !== 'results', 'La partie est terminée.');
  if (action.type !== 'timeout' && action.type !== 'leave') {
    requireRule(previous.deadline === null || now < previous.deadline, 'Le délai est écoulé, attendez la prochaine phase.');
  }
  const game = structuredClone(previous);
  switch (action.type) {
    case 'timeout': timeout(game, now, random); break;
    case 'leave': leave(game, action.playerId, now, random); break;
    case 'describe':
      requireRule(game.phase === 'description' && game.turnPlayerId === action.playerId && game.alive.includes(action.playerId), 'Ce n’est pas votre tour de décrire.');
      game.descriptions.push({ playerId: action.playerId, text: validatedText(action.text), round: game.round, timedOut: false });
      nextDescription(game, now);
      break;
    case 'setVoteReady':
      requireRule(game.phase === 'discussion', 'La discussion est terminée ou n’a pas commencé.');
      requireRule(game.alive.includes(action.playerId) && !game.departed.includes(action.playerId), 'Seuls les joueurs vivants peuvent se déclarer prêts.');
      requireRule(typeof action.ready === 'boolean', 'Confirmation invalide.');
      game.readyToVotePlayerIds = game.playerIds.filter(id => game.alive.includes(id) && (id === action.playerId ? action.ready : game.readyToVotePlayerIds.includes(id)));
      if (everyoneReadyToVote(game)) startVote(game, now);
      break;
    case 'skipDiscussion':
      requireRule(game.phase === 'discussion' && game.settings.hostCanSkipDiscussion, 'La discussion ne peut pas être écourtée.');
      startVote(game, now);
      break;
    case 'vote':
      requireRule(game.phase === 'vote' || game.phase === 'tiebreak', 'Le vote n’est pas ouvert.');
      requireRule(game.alive.includes(action.playerId), 'Seuls les joueurs vivants peuvent voter.');
      requireRule(game.voteCandidates.includes(action.targetId) && game.alive.includes(action.targetId), 'Cette cible ne peut pas recevoir de vote.');
      requireRule(action.playerId !== action.targetId, 'Vous ne pouvez pas voter contre vous-même.');
      requireRule(!Object.hasOwn(game.ballots, action.playerId), 'Vous avez déjà voté.');
      game.ballots = { ...game.ballots, [action.playerId]: action.targetId };
      game.votedPlayerIds = Object.keys(game.ballots);
      if (everyoneVoted(game)) resolveVote(game, now, random);
      break;
    case 'guess':
      requireRule(game.phase === 'whiteGuess' && game.whitePlayerId === action.playerId && !game.departed.includes(action.playerId), 'Vous ne pouvez pas deviner maintenant.');
      if (isAcceptableWhiteGuess(validatedText(action.word), game.words.civilian)) finish(game, 'white', now, action.playerId);
      else { game.whitePlayerId = null; enter(game, 'elimination', now, 3); }
      break;
  }
  return game;
}

function publicResult(result: GameResult | null): GameResult | null {
  return result ? { ...result, winnerIds: [...result.winnerIds], roles: { ...result.roles }, points: { ...result.points } } : null;
}

/** Explicit allowlist: never spread the internal state into network payloads. */
export function publicGame(game: GameState): PublicGame {
  return {
    id: game.id, phase: game.phase, phaseId: game.phaseId, round: game.round, deadline: game.deadline,
    turnPlayerId: game.turnPlayerId, order: [...game.order], descriptions: game.descriptions.map(description => ({ ...description })),
    voteCandidates: [...game.voteCandidates], voteCounts: game.voteCounts ? { ...game.voteCounts } : null,
    readyToVotePlayerIds: [...game.readyToVotePlayerIds], votedPlayerIds: [...game.votedPlayerIds], eliminatedPlayerId: game.eliminatedPlayerId,
    whitePlayerId: game.whitePlayerId, result: publicResult(game.result),
  };
}

/** Ordinary players only learn their word, never whether it belongs to the majority. */
export function privateGame(game: GameState, playerId: string): PrivateGameState {
  const inGame = game.playerIds.includes(playerId) && !game.departed.includes(playerId);
  const role = inGame ? game.roles[playerId] : undefined;
  return { playerId, inGame, word: role === 'civilian' ? game.words.civilian : role === 'undercover' ? game.words.undercover : null, voteTarget: inGame && Object.hasOwn(game.ballots, playerId) ? game.ballots[playerId] : null };
}
