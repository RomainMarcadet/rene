import { describe, expect, it, vi } from 'vitest';
import { CommandSchema, DEFAULT_APPEARANCE, DEFAULT_SETTINGS, EMOTE_DURATION_MS, emoteDuration, voteSeat, type Phase } from '@rene/contracts';
import { createPersistence, type Guest } from './persistence.js';
import { MemoryRoomStore, Rooms, type Room } from './rooms.js';
import { SerialQueue } from './queue.js';

const initialTime = 100_000;
const guest = (id: string): Guest => ({ id, tokenHash: `token-${id}`, name: `René ${id}`, appearance: { ...DEFAULT_APPEARANCE }, createdAt: new Date(initialTime) });
async function fixture(count = 4) {
  const persistence = await createPersistence();
  const rooms = new Rooms(new MemoryRoomStore(), persistence, 100, () => 0.42);
  const room = rooms.create(guest('p0'), initialTime);
  for (let n = 1; n < count; n++) rooms.join(room, guest(`p${n}`), initialTime + n);
  return { rooms, room, persistence };
}
async function start(rooms: Rooms, room: Room) {
  for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, initialTime + 10);
  await rooms.command(room, room.hostId, { type: 'game.start' }, initialTime + 11);
}
async function votePhase(rooms: Rooms, room: Room) {
  let now = room.game!.deadline!;
  await rooms.tick(room, now);
  while (room.game!.phase === 'description') {
    await rooms.command(room, room.game!.turnPlayerId!, { type: 'game.describe', text: 'Un indice discret' }, ++now);
  }
  await rooms.command(room, room.hostId, { type: 'game.skipDiscussion' }, ++now);
  return now;
}
async function eliminate(rooms: Rooms, room: Room, target: string, now: number) {
  const living = [...room.game!.alive];
  for (const id of living) await rooms.command(room, id, { type: 'game.vote', targetId: id === target ? living.find(p => p !== target)! : target }, ++now);
}

describe('authoritative room lifecycle', () => {
  it('requires a connected, ready roster and host authorization', async () => {
    const { rooms, room } = await fixture();
    await expect(rooms.command(room, 'p1', { type: 'game.start' }, initialTime)).rejects.toThrow('hôte');
    await expect(rooms.command(room, 'p0', { type: 'game.start' }, initialTime)).rejects.toThrow('prêt');
    await start(rooms, room);
    expect(room.game?.phase).toBe('reveal');
  });
  it('isolates rooms, privately distributes words, and hides roles and ballots', async () => {
    const { rooms, room } = await fixture();
    await start(rooms, room);
    const other = rooms.create(guest('outsider'), initialTime);
    const snapshot = rooms.snapshot(room, initialTime);
    expect(snapshot.players).toHaveLength(4);
    expect(snapshot.players.every(p => p.role === undefined)).toBe(true);
    expect(snapshot.game).not.toHaveProperty('roles');
    expect(snapshot.game).not.toHaveProperty('words');
    expect(snapshot.game).not.toHaveProperty('ballots');
    expect(rooms.privateSnapshot(room, 'outsider')).toMatchObject({ inGame: false, word: null });
    expect(rooms.snapshot(other, initialTime).players).toHaveLength(1);
    expect(rooms.privateSnapshot(room, 'p0').word).toBeTruthy();
  });
  it('keeps disconnected seats and hands host over after 30 seconds', async () => {
    const { rooms, room } = await fixture();
    await start(rooms, room);
    const originalWord = rooms.privateSnapshot(room, 'p0').word;
    rooms.disconnected(room, 'p0', initialTime + 100);
    expect(rooms.transferHost(room, initialTime + 29_999)).toBe(false);
    expect(rooms.transferHost(room, initialTime + 30_100)).toBe(true);
    expect(room.hostId).toBe('p1');
    expect(room.game!.alive).toContain('p0');
    rooms.connected(room, 'p0', initialTime + 31_000);
    expect(room.hostId).toBe('p1');
    expect(rooms.privateSnapshot(room, 'p0').word).toBe(originalWord);
  });
  it('does not let late arrivals describe, vote, chat or see a secret', async () => {
    const { rooms, room } = await fixture();
    await start(rooms, room);
    rooms.join(room, guest('late'), initialTime + 50);
    expect(rooms.snapshot(room, initialTime).players.find(p => p.id === 'late')).toMatchObject({ waiting: true, alive: false });
    expect(rooms.privateSnapshot(room, 'late')).toMatchObject({ inGame: false, word: null });
    await expect(rooms.command(room, 'late', { type: 'chat.send', text: 'Mon ami est Undercover' }, initialTime + 60)).rejects.toThrow();
    const now = await votePhase(rooms, room);
    await expect(rooms.command(room, 'late', { type: 'game.vote', targetId: 'p0' }, now + 1)).rejects.toThrow();
  });
  it('cancels a pending White guess on voluntary leave and reveals departed identity', async () => {
    const { rooms, room } = await fixture();
    room.settings = { ...DEFAULT_SETTINGS, automaticRoles: false, undercoverCount: 0, whiteCount: 1 };
    await start(rooms, room);
    const white = Object.keys(room.game!.roles).find(id => room.game!.roles[id] === 'white')!;
    const now = await votePhase(rooms, room);
    await eliminate(rooms, room, white, now);
    expect(room.game!.phase).toBe('whiteGuess');
    await rooms.leave(room, white, now + 10);
    expect(room.game!.phase).toBe('elimination');
    expect(room.game!.departed).toContain(white);
    expect(rooms.snapshot(room, now).players.find(p => p.id === white)).toMatchObject({ name: `René ${white}`, connected: false, role: 'white' });
    rooms.join(room, guest(white), now + 12);
    expect(rooms.privateSnapshot(room, white).inGame).toBe(false);
    await expect(rooms.command(room, white, { type: 'game.guess', word: room.game!.words.civilian }, now + 13)).rejects.toThrow();
  });
  it('scores once, replays in the same room and retains scores after rejoining', async () => {
    const { rooms, room, persistence } = await fixture();
    const saved = vi.spyOn(persistence, 'recordResult');
    await start(rooms, room);
    const target = Object.keys(room.game!.roles).find(id => room.game!.roles[id] === 'undercover')!;
    await eliminate(rooms, room, target, await votePhase(rooms, room));
    await rooms.tick(room, room.game!.deadline!);
    expect(room.game!.result?.winner).toBe('civilians');
    await rooms.persistResult(room); await rooms.persistResult(room);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(room.completedGames).toBe(1);
    const civil = Object.keys(room.game!.roles).find(id => room.game!.roles[id] === 'civilian')!;
    expect(room.players.get(civil)?.score).toBe(2);
    await rooms.leave(room, civil, initialTime + 60_000);
    rooms.join(room, guest(civil), initialTime + 60_001);
    expect(room.players.get(civil)?.score).toBe(2);
    await rooms.command(room, room.hostId, { type: 'game.next' }, initialTime + 60_002);
    expect(room.game).toBeNull();
    expect(room.formerPlayers.size).toBe(0);
    await start(rooms, room);
    expect(room.usedWords).toHaveLength(2);
    expect(new Set(room.usedWords).size).toBe(2);
  });
  it('keeps results visible and chat usable during DB outage, then retries once', async () => {
    const { rooms, room, persistence } = await fixture();
    let fail = true;
    const saved = vi.spyOn(persistence, 'recordResult').mockImplementation(async () => { if (fail) throw new Error('database down'); });
    await start(rooms, room);
    const target = Object.keys(room.game!.roles).find(id => room.game!.roles[id] === 'undercover')!;
    await eliminate(rooms, room, target, await votePhase(rooms, room));
    const end = room.game!.deadline!;
    await rooms.tick(room, end);
    expect(rooms.snapshot(room, end)).toMatchObject({ resultsPending: true, game: { phase: 'results' } });
    await rooms.command(room, room.hostId, { type: 'chat.send', text: 'Bien joué !' }, end + 1);
    await expect(rooms.command(room, room.hostId, { type: 'game.next' }, end + 1)).rejects.toThrow('sauvegarde');
    await rooms.tick(room, end + 1_000); expect(saved).toHaveBeenCalledTimes(1);
    fail = false;
    await rooms.tick(room, end + 5_000);
    await rooms.tick(room, end + 10_000);
    expect(saved).toHaveBeenCalledTimes(2);
    expect(room.completedGames).toBe(1); expect(room.persistencePending).toBe(false);
    expect([...room.players.values()].reduce((n, p) => n + p.score, 0)).toBe(6);
  });
  it('rejects multiple votes and eliminates social input from dead players', async () => {
    const { rooms, room } = await fixture(5);
    await start(rooms, room);
    const now = await votePhase(rooms, room);
    await rooms.command(room, 'p0', { type: 'game.vote', targetId: 'p1' }, now + 1);
    await expect(rooms.command(room, 'p0', { type: 'game.vote', targetId: 'p2' }, now + 2)).rejects.toThrow('déjà');
    await expect(rooms.command(room, 'p2', { type: 'game.vote', targetId: 'p2' }, now + 2)).rejects.toThrow('vous-même');
    for (const id of room.game!.alive.filter(id => id !== 'p0')) await rooms.command(room, id, { type: 'game.vote', targetId: id === 'p1' ? 'p0' : 'p1' }, now + 3);
    await expect(rooms.command(room, 'p1', { type: 'chat.send', text: 'Je sais tout' }, now + 4)).rejects.toThrow();
    await expect(rooms.command(room, 'p1', { type: 'player.emote', kind: 'suspect' }, now + 4)).rejects.toThrow();
  });
  it('bounds movement and prevents speedup by flooding inputs or crossing the table', async () => {
    const { rooms, room } = await fixture();
    const player = room.players.get('p0')!;
    player.position = { x: 0, z: 1.2, yaw: 0 };
    expect(rooms.move(room, 'p0', { x: 0, z: -1 }, initialTime + 100)).toBe(false);
    player.position = { x: 6.99, z: 4, yaw: 0 };
    expect(rooms.move(room, 'p0', { x: 1, z: 0 }, initialTime + 200)).toBe(true);
    expect(player.position.x).toBe(7);
    expect(rooms.move(room, 'p0', { x: -1, z: 0 }, initialTime + 201)).toBe(false);
    await start(rooms, room);
    expect(rooms.move(room, 'p0', { x: -1, z: 0 }, initialTime + 500)).toBe(true);
    expect(rooms.move(room, 'p0', { x: NaN, z: 0 }, initialTime + 600)).toBe(false);
    expect(rooms.move(room, 'p0', { x: 2, z: 0 }, initialTime + 700)).toBe(false);
  });
  it('allows all phases except vote and tiebreak without weakening server movement validation', async () => {
    const { rooms, room } = await fixture(); await start(rooms, room);
    const phases: Phase[] = ['reveal', 'description', 'discussion', 'vote', 'tiebreak', 'elimination', 'whiteGuess', 'results'];
    for (const [i, phase] of phases.entries()) {
      room.game!.phase = phase;
      expect(rooms.move(room, 'p0', { x: 0, z: 1 }, initialTime + 100 + i * 100)).toBe(phase !== 'vote' && phase !== 'tiebreak');
    }
    rooms.disconnected(room, 'p0', initialTime + 1000);
    expect(rooms.move(room, 'p0', { x: 0, z: 1 }, initialTime + 1100)).toBe(false);
  });
  it('seats only living participants authoritatively and retains positions when voting ends', async () => {
    const { rooms, room } = await fixture(); await start(rooms, room);
    rooms.join(room, guest('late'), initialTime + 20);
    const spectator = { ...room.players.get('late')!.position };
    const now = await votePhase(rooms, room);
    room.game!.alive.forEach((id, index, living) => expect(room.players.get(id)!.position).toEqual(voteSeat(index, living.length)));
    expect(room.players.get('late')!.position).toEqual(spectator);
    const before = { ...room.players.get('p0')!.position };
    expect(rooms.move(room, 'p0', { x: 0, z: 1 }, now + 100)).toBe(false);
    await rooms.tick(room, room.game!.deadline!); // no votes: next description round
    expect(room.players.get('p0')!.position).toEqual(before);
    expect(rooms.move(room, 'p0', { x: 0, z: 1 }, room.game!.deadline! + 100)).toBe(true);
  });
  it('publishes replayable emotes with bounded server deadlines and expires the projection', async () => {
    const { rooms, room } = await fixture();
    for (const [i, kind] of (['wave', 'suspect', 'dance'] as const).entries()) {
      const now = initialTime + i * (EMOTE_DURATION_MS + 1);
      await rooms.command(room, 'p0', { type: 'player.emote', kind }, now);
      expect(rooms.snapshot(room, now).players[0].emote).toEqual({ kind, until: now + emoteDuration(kind) });
      await expect(rooms.command(room, 'p0', { type: 'player.emote', kind }, now + 1)).rejects.toThrow('souffle');
      expect(rooms.snapshot(room, now + EMOTE_DURATION_MS).players[0].emote).toBeUndefined();
    }
  });
  it('expires empty rooms after 30 minutes and drops their membership mappings', async () => {
    const { rooms, room } = await fixture();
    for (const id of room.players.keys()) rooms.disconnected(room, id, initialTime);
    await rooms.tick(room, initialTime + 30 * 60_000 + 1);
    expect(rooms.store.size).toBe(0); expect(rooms.roomFor('p0')).toBeUndefined();
  });
  it('allows the host to remove absent lobby guests without abandoning active seats', async () => {
    const { rooms, room } = await fixture(5);
    await expect(rooms.command(room, 'p0', { type: 'player.remove', targetId: 'p4' }, initialTime)).rejects.toThrow('absent');
    rooms.disconnected(room, 'p4', initialTime);
    await expect(rooms.command(room, 'p1', { type: 'player.remove', targetId: 'p4' }, initialTime)).rejects.toThrow('hôte');
    await rooms.command(room, 'p0', { type: 'player.remove', targetId: 'p4' }, initialTime);
    expect(room.players.size).toBe(4); expect(rooms.roomFor('p4')).toBeUndefined();
    await start(rooms, room); rooms.disconnected(room, 'p3', initialTime);
    await expect(rooms.command(room, 'p0', { type: 'player.remove', targetId: 'p3' }, initialTime)).rejects.toThrow('fin');
    expect(room.game!.alive).toContain('p3');
  });
  it('retains an unsaved result when the last guest leaves, then cleans up after retry', async () => {
    const { rooms, room, persistence } = await fixture();
    let fail = true;
    vi.spyOn(persistence, 'recordResult').mockImplementation(async () => { if (fail) throw new Error('offline'); });
    await start(rooms, room);
    const target = Object.keys(room.game!.roles).find(id => room.game!.roles[id] === 'undercover')!;
    await eliminate(rooms, room, target, await votePhase(rooms, room));
    const end = room.game!.deadline!; await rooms.tick(room, end);
    for (const id of [...room.players.keys()]) await rooms.leave(room, id, end + 1);
    expect(rooms.store.get(room.code)).toBe(room);
    fail = false; await rooms.tick(room, end + 5000);
    expect(room.scoredGames.size).toBe(1); expect(rooms.store.get(room.code)).toBeUndefined();
  });
});

it('serializes mutations within a room but allows independent rooms and recovers after errors', async () => {
  const queue = new SerialQueue(); const calls: string[] = [];
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const first = queue.run('a', async () => { calls.push('a1'); await wait; throw new Error('expected'); }).catch(() => undefined);
  const second = queue.run('a', () => { calls.push('a2'); });
  await queue.run('b', () => { calls.push('b'); });
  expect(calls).toEqual(['a1', 'b']); release(); await first; await second; await queue.drain();
  expect(calls).toEqual(['a1', 'b', 'a2']);
});


describe('chat reactions', () => {
  it('validates reaction commands without accepting an injected identity', () => {
    for (const reaction of ['up', 'down', null]) expect(CommandSchema.safeParse({ type: 'chat.react', messageId: 'message', reaction }).success).toBe(true);
    for (const payload of [{ reaction: 'sideways' }, { reaction: 'up', playerId: 'other' }, { reaction: 'up', messageId: '' }]) {
      expect(CommandSchema.safeParse({ type: 'chat.react', messageId: 'message', ...payload }).success).toBe(false);
    }
  });
  it('counts once per identity, replaces and cancels atomically, and keeps the local choice private', async () => {
    const { rooms, room } = await fixture();
    await rooms.command(room, 'p0', { type: 'chat.send', text: 'Je soupçonne René.' }, initialTime);
    const id = room.chat[0].id;
    const react = (playerId: string, reaction: 'up' | 'down' | null) => rooms.command(room, playerId, { type: 'chat.react', messageId: id, reaction }, initialTime + 1);
    await Promise.all([react('p0', 'up'), react('p1', 'up'), react('p2', 'down')]);
    const revision = room.revision;
    await Promise.all(Array.from({ length: 10 }, () => react('p1', 'up')));
    expect(room.revision).toBe(revision);
    expect(rooms.snapshot(room, initialTime).chat[0].reactions).toEqual({ up: 2, down: 1 });
    expect(rooms.privateSnapshot(room, 'p1').chatReactions).toEqual({ [id]: 'up' });
    expect(rooms.privateSnapshot(room, 'p3').chatReactions).toEqual({});
    expect(JSON.stringify(rooms.snapshot(room, initialTime).chat)).not.toContain('p1');
    await react('p1', 'down'); await react('p2', null);
    expect(rooms.snapshot(room, initialTime).chat[0].reactions).toEqual({ up: 1, down: 1 });
    const projection = rooms.snapshot(room, initialTime); projection.chat[0].reactions.up = 99;
    expect(rooms.snapshot(room, initialTime).chat[0].reactions.up).toBe(1);
    expect([...room.players.values()].every(p => p.score === 0)).toBe(true);
  });
  it('enforces communication permissions, membership and message existence', async () => {
    const { rooms, room } = await fixture(); await start(rooms, room);
    await rooms.command(room, 'p0', { type: 'chat.send', text: 'Très suspect.' }, initialTime + 15);
    const id = room.chat[0].id;
    const react = (playerId: string, messageId = id) => rooms.command(room, playerId, { type: 'chat.react', messageId, reaction: 'up' }, initialTime + 20);
    rooms.join(room, guest('late'), initialTime + 16);
    await expect(react('late')).rejects.toThrow('écoutent');
    await expect(react('stranger')).rejects.toThrow('partie de ce salon');
    await expect(react('p0', 'missing')).rejects.toThrow('message');
    room.game!.alive = room.game!.alive.filter(id => id !== 'p1');
    await expect(react('p1')).rejects.toThrow('écoutent');
    room.settings.deadCanSpeak = true;
    await react('p1'); await react('late');
    expect(rooms.snapshot(room, initialTime).chat[0].reactions.up).toBe(2);
    rooms.disconnected(room, 'p1', initialTime + 25);
    await expect(react('p1')).rejects.toThrow('Rejoins');
  });
  it('removes reactions with expired messages and with a new game', async () => {
    const { rooms, room } = await fixture();
    await rooms.command(room, 'p0', { type: 'chat.send', text: 'Ancien' }, initialTime);
    const id = room.chat[0].id;
    await rooms.command(room, 'p1', { type: 'chat.react', messageId: id, reaction: 'up' }, initialTime);
    for (let i = 1; i <= 100; i++) await rooms.command(room, 'p0', { type: 'chat.send', text: `Message ${i}` }, initialTime + i * 701);
    expect(room.chat).toHaveLength(100); expect(room.chatReactions.has(id)).toBe(false);
    expect(rooms.privateSnapshot(room, 'p1').chatReactions).toEqual({});
    await expect(rooms.command(room, 'p1', { type: 'chat.react', messageId: id, reaction: null }, initialTime + 80000)).rejects.toThrow('message');
    await rooms.command(room, 'p1', { type: 'chat.react', messageId: room.chat[0].id, reaction: 'down' }, initialTime + 80001);
    await start(rooms, room);
    expect(room.chat).toHaveLength(0); expect(room.chatReactions.size).toBe(0);
  });
});
