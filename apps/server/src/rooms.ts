import { randomInt, randomUUID } from 'node:crypto';
import {
  DEFAULT_SETTINGS, validComposition, type AvatarAppearance, type ChatMessage,
  type Command, type PublicPlayer, type RoomSettings, type RoomSnapshot, type PrivatePlayerState,
} from '@rene/contracts';
import { createGame, applyGameAction, chooseWordPair, publicGame, privateGame, type GameState } from '@rene/engine';
import type { Guest, Persistence } from './persistence.js';

export interface Player extends PublicPlayer { joinedAt: number; disconnectedAt: number | null; lastMoveAt: number; lastChatAt: number; lastEmoteAt: number }
export interface Room {
  code: string; sessionId: string; revision: number; hostId: string; settings: RoomSettings;
  players: Map<string, Player>; game: GameState | null; chat: ChatMessage[]; usedWords: string[];
  completedGames: number; voiceGeneration: number; scoredGames: Set<string>; lastOccupiedAt: number;
  persistencePending: boolean; resultRetryAt: number; scores: Map<string, number>; formerPlayers: Map<string, Player>;
}
export interface RoomStore { get(code: string): Room | undefined; set(code: string, room: Room): void; delete(code: string): void; values(): IterableIterator<Room>; readonly size: number }
export class MemoryRoomStore extends Map<string, Room> implements RoomStore {}
const secureRandom = () => randomInt(0, 2 ** 48) / 2 ** 48;
const editable = (room: Room) => !room.game || room.game.phase === 'results';

/** Every transport mutation is queued by player/room before entering this service. */
export class Rooms {
  readonly playerRooms = new Map<string, string>();
  constructor(readonly store: RoomStore, private persistence: Persistence, private maxRooms = 100, private random = secureRandom, private onPersistenceError: (error: unknown) => void = () => undefined) {}

  roomFor(playerId: string) { const code = this.playerRooms.get(playerId); return code ? this.store.get(code) : undefined; }
  requireRoom(playerId: string) { const room = this.roomFor(playerId); if (!room) throw new Error('Rejoins une salle pour continuer.'); return room; }
  private requireHost(room: Room, id: string) { if (room.hostId !== id) throw new Error('Cette action est réservée à l’hôte.'); }
  private requireLobby(room: Room) { if (!editable(room)) throw new Error('Attends la fin de la partie.'); }

  create(guest: Guest, now: number) {
    if (this.roomFor(guest.id)) throw new Error('Quitte ta salle actuelle avant d’en créer une autre.');
    if (this.store.size >= this.maxRooms) throw new Error('Les salons sont pleins. Réessaie dans un instant.');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (this.store.get(code));
    const room: Room = { code, sessionId: randomUUID(), revision: 0, hostId: guest.id, settings: { ...DEFAULT_SETTINGS }, players: new Map(), game: null, chat: [], usedWords: [], completedGames: 0, voiceGeneration: 0, scoredGames: new Set(), lastOccupiedAt: now, persistencePending: false, resultRetryAt: 0, scores: new Map(), formerPlayers: new Map() };
    this.store.set(code, room);
    this.join(room, guest, now);
    return room;
  }

  join(room: Room, guest: Guest, now: number) {
    const existing = this.roomFor(guest.id);
    if (existing && existing !== room) throw new Error('Quitte ta salle actuelle avant d’en rejoindre une autre.');
    if (room.players.has(guest.id)) { this.connected(room, guest.id, now); return; }
    if (room.players.size >= 12) throw new Error('Ce salon accueille déjà 12 personnes.');
    const index = room.players.size;
    const angle = index * Math.PI * 2 / 12;
    const waiting = !editable(room);
    room.formerPlayers.delete(guest.id);
    room.players.set(guest.id, { id: guest.id, name: guest.name, appearance: guest.appearance, connected: true, ready: false, position: { x: Math.cos(angle) * 4, z: Math.sin(angle) * 4, yaw: 0 }, alive: !waiting, waiting, score: room.scores.get(guest.id) ?? 0, joinedAt: now, disconnectedAt: null, lastMoveAt: now, lastChatAt: -Infinity, lastEmoteAt: -Infinity });
    this.playerRooms.set(guest.id, room.code);
    room.lastOccupiedAt = now;
    // Any roster change cancels readiness; waiting arrivals cannot change an active game.
    if (editable(room)) for (const player of room.players.values()) player.ready = false;
    room.revision++;
  }

  connected(room: Room, playerId: string, now: number) {
    const player = room.players.get(playerId);
    if (!player) return;
    player.connected = true; player.disconnectedAt = null; player.lastMoveAt = now;
    room.lastOccupiedAt = now; room.revision++;
    if (!room.players.get(room.hostId)?.connected) this.transferHost(room, now);
  }

  disconnected(room: Room, playerId: string, now: number) {
    const player = room.players.get(playerId);
    if (!player) return;
    player.connected = false; player.ready = false; player.disconnectedAt = now;
    room.lastOccupiedAt = now; room.revision++;
  }

  transferHost(room: Room, now: number, immediate = false) {
    const host = room.players.get(room.hostId);
    if (host?.connected) return false;
    if (!immediate && host?.disconnectedAt && now - host.disconnectedAt < 30_000) return false;
    const next = [...room.players.values()].filter(p => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!next || next.id === room.hostId) return false;
    room.hostId = next.id; room.revision++; return true;
  }

  async command(room: Room, id: string, command: Command, now: number) {
    const player = room.players.get(id);
    if (!player) throw new Error('Tu ne fais plus partie de ce salon.');
    switch (command.type) {
      case 'player.ready': this.requireLobby(room); player.ready = command.ready; break;
      case 'player.remove': {
        this.requireHost(room, id); this.requireLobby(room);
        const target = room.players.get(command.targetId);
        if (!target || target.connected || target.id === id) throw new Error('Seul un joueur absent peut être retiré du salon.');
        await this.leave(room, target.id, now); break;
      }
      case 'profile.update':
        this.requireLobby(room); player.name = command.name; player.appearance = command.appearance; break;
      case 'settings.update':
        this.requireHost(room, id); this.requireLobby(room);
        if (!command.settings.automaticRoles && room.players.size >= 4 && !validComposition(room.players.size, command.settings)) throw new Error('Prévois au moins deux Civils et un Infiltré.');
        // Validate that the word filters have content before accepting them.
        chooseWordPair(command.settings, [], this.random);
        room.settings = { ...command.settings };
        for (const p of room.players.values()) p.ready = false;
        break;
      case 'game.start': {
        this.requireHost(room, id);
        if (room.game) throw new Error('Retourne d’abord au salon pour préparer la prochaine partie.');
        const players = [...room.players.values()];
        if (!validComposition(players.length, room.settings)) throw new Error('Il faut de 4 à 12 joueurs et une répartition valide.');
        if (!players.every(p => p.connected && p.ready)) throw new Error('Tout le monde doit être connecté et prêt.');
        const pair = chooseWordPair(room.settings, room.usedWords, this.random);
        room.game = createGame({ id: randomUUID(), playerIds: players.map(p => p.id), settings: room.settings, pair, now, random: this.random });
        room.usedWords.push(pair.id);
        // Keep a bounded history; choosing the pair handles exhaustion of the selected catalogue.
        if (room.usedWords.length > 1000) room.usedWords.splice(0, 500);
        room.chat = [];
        for (const p of players) { p.waiting = false; p.alive = true; p.ready = false; }
        room.voiceGeneration++;
        break;
      }
      case 'game.next':
        this.requireHost(room, id);
        if (room.game?.phase !== 'results') throw new Error('La partie n’est pas terminée.');
        if (room.persistencePending) throw new Error('Les résultats sont en cours de sauvegarde. Réessaie dans un instant.');
        room.game = null; room.chat = []; room.formerPlayers.clear(); room.voiceGeneration++;
        if (room.completedGames >= room.settings.roundsPerSession) {
          room.sessionId = randomUUID(); room.completedGames = 0; room.scoredGames.clear(); room.scores.clear();
          for (const p of room.players.values()) p.score = 0;
        }
        for (const p of room.players.values()) { p.alive = true; p.waiting = false; p.ready = false; delete p.role; }
        break;
      case 'game.describe': await this.gameAction(room, { type: 'describe', playerId: id, text: command.text }, now); break;
      case 'game.vote': await this.gameAction(room, { type: 'vote', playerId: id, targetId: command.targetId }, now); break;
      case 'game.guess': await this.gameAction(room, { type: 'guess', playerId: id, word: command.word }, now); break;
      case 'game.skipDiscussion':
        this.requireHost(room, id);
        if (!room.settings.hostCanSkipDiscussion) throw new Error('La discussion se termine au chronomètre.');
        await this.gameAction(room, { type: 'skipDiscussion' }, now); break;
      case 'chat.send':
        if (!editable(room) && (!room.game?.alive.includes(id) || player.waiting) && !room.settings.deadCanSpeak) throw new Error('Les spectateurs et les éliminés écoutent jusqu’à la fin de la partie.');
        if (now - player.lastChatAt < 700) throw new Error('Un message à la fois !');
        player.lastChatAt = now;
        room.chat.push({ id: randomUUID(), playerId: id, name: player.name, text: command.text, at: now });
        room.chat = room.chat.slice(-100); break;
      case 'player.emote':
        if (!editable(room) && !room.game?.alive.includes(id)) throw new Error('Les éliminés restent discrets pendant la partie.');
        if (now - player.lastEmoteAt < 2000) throw new Error('Laisse ton avatar reprendre son souffle.');
        player.lastEmoteAt = now; player.emote = { kind: command.kind, until: now + 2500 }; break;
      default: throw new Error('Action indisponible.');
    }
    room.revision++;
  }

  async gameAction(room: Room, action: Parameters<typeof applyGameAction>[1], now: number) {
    if (!room.game || room.game.phase === 'results') throw new Error('Aucune partie en cours.');
    const oldAlive = room.game.alive.length;
    room.game = applyGameAction(room.game, action, now, this.random);
    if (room.game.alive.length < oldAlive || room.game.phase === 'results') room.voiceGeneration++;
    room.revision++;
    await this.persistResult(room, now);
  }

  async persistResult(room: Room, now = Date.now()) {
    const game = room.game;
    if (!game?.result || room.scoredGames.has(game.id) || now < room.resultRetryAt) return false;
    room.persistencePending = true;
    try { await this.persistence.recordResult(game.id, room.sessionId, game.result); }
    catch (error) { room.resultRetryAt = now + 5000; this.onPersistenceError(error); return false; }
    for (const [id, points] of Object.entries(game.result.points)) {
      const score = (room.scores.get(id) ?? 0) + points; room.scores.set(id, score);
      const player = room.players.get(id) ?? room.formerPlayers.get(id); if (player) player.score = score;
    }
    room.completedGames++;
    room.scoredGames.add(game.id); room.persistencePending = false; room.resultRetryAt = 0; room.revision++;
    return true;
  }

  async leave(room: Room, playerId: string, now: number) {
    if (room.game && room.game.phase !== 'results' && room.game.playerIds.includes(playerId)) await this.gameAction(room, { type: 'leave', playerId }, now);
    const player = room.players.get(playerId);
    if (room.game?.playerIds.includes(playerId) && player) room.formerPlayers.set(playerId, { ...player, alive: false, connected: false, ready: false });
    room.players.delete(playerId); this.playerRooms.delete(playerId); room.voiceGeneration++; room.revision++;
    this.transferHost(room, now, true);
    if (room.players.size === 0 && !room.persistencePending) this.store.delete(room.code);
    if (editable(room)) for (const player of room.players.values()) player.ready = false;
  }

  async tick(room: Room, now: number) {
    let changed = this.transferHost(room, now);
    if (room.game?.deadline && room.game.deadline <= now && room.game.phase !== 'results') {
      await this.gameAction(room, { type: 'timeout' }, now); changed = true;
    }
    if (room.persistencePending) changed = await this.persistResult(room, now) || changed;
    if ([...room.players.values()].some(p => p.connected)) room.lastOccupiedAt = now;
    else if (!room.persistencePending && (room.players.size === 0 || now - room.lastOccupiedAt > 30 * 60_000)) {
      for (const id of room.players.keys()) this.playerRooms.delete(id);
      this.store.delete(room.code);
    }
    return changed;
  }

  move(room: Room, id: string, direction: { x: number; z: number }, now: number) {
    const player = room.players.get(id);
    if (!player || !player.connected || (room.game && room.game.phase !== 'results')) return false;
    const dt = Math.min(0.12, Math.max(0, (now - player.lastMoveAt) / 1000));
    if (dt < 0.035) return false;
    player.lastMoveAt = now;
    const magnitude = Math.max(1, Math.hypot(direction.x, direction.z));
    const x = Math.max(-7, Math.min(7, player.position.x + direction.x / magnitude * dt * 3.2));
    const z = Math.max(-5, Math.min(5, player.position.z + direction.z / magnitude * dt * 3.2));
    // Shared scene table has a 2.6 x 1.6 footprint; keep avatars outside it.
    if (Math.abs(x) < 1.65 && Math.abs(z) < 1.15) return false;
    player.position = { x, z, yaw: direction.x || direction.z ? Math.atan2(direction.x, direction.z) : player.position.yaw };
    return true;
  }

  snapshot(room: Room, now: number): RoomSnapshot {
    return {
      code: room.code, revision: room.revision, hostId: room.hostId, settings: { ...room.settings },
      players: [...room.players.values(), ...room.formerPlayers.values()].map(p => {
        const alive = room.game && !p.waiting ? room.game.alive.includes(p.id) : p.alive;
        const role = room.game && (!alive || room.game.phase === 'results') && !p.waiting ? room.game.roles[p.id] : undefined;
        return { id: p.id, name: p.name, appearance: p.appearance, connected: p.connected, ready: p.ready, position: p.position, alive, waiting: p.waiting, score: p.score, ...(role ? { role } : {}), ...(p.emote && p.emote.until > now ? { emote: p.emote } : {}) };
      }),
      game: room.game ? publicGame(room.game) : null, chat: room.chat, completedGames: room.completedGames,
      voiceGeneration: room.voiceGeneration, serverNow: now, resultsPending: room.persistencePending,
    };
  }
  privateSnapshot(room: Room, playerId: string): PrivatePlayerState { return room.game ? privateGame(room.game, playerId) : { playerId, inGame: false, word: null, voteTarget: null }; }
  updateProfile(room: Room | undefined, id: string, name: string, appearance: AvatarAppearance) {
    if (!room) return;
    this.requireLobby(room);
    const player = room.players.get(id); if (player) { player.name = name; player.appearance = appearance; room.revision++; }
  }
}
