import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { DEFAULT_APPEARANCE, EMOTE_DURATION_MS, type Ack, type ClientEvents, type Command, type CommandEnvelope, type PrivatePlayerState, type RoomSnapshot, type ServerEvents } from '@rene/contracts';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import type { Guest, Persistence } from './persistence.js';

type Running = Awaited<ReturnType<typeof createApp>>;
type Client = Socket<ServerEvents, ClientEvents>;
type Actor = { socket: Client; playerId: string; cookie: string; snapshot?: RoomSnapshot; secret?: PrivatePlayerState };
const origin = 'http://localhost:5173';
const apps: Running[] = []; const clients: Client[] = [];
afterEach(async () => { for (const client of clients.splice(0)) client.disconnect(); for (const running of apps.splice(0)) await running.app.close(); });
async function server(persistence?: Persistence, useListeningOrigin = false) {
  const config = readConfig({ NODE_ENV: 'test', WEB_ORIGIN: origin });
  const running = await createApp({ config, logger: false, timers: false, persistence });
  apps.push(running);
  const url = await running.app.listen({ port: 0, host: '127.0.0.1' });
  // The OS assigns the port. Finalize the canonical origin before making requests.
  if (useListeningOrigin) config.WEB_ORIGIN = url;
  return { running, url };
}
async function actor(running: Running, url: string, previous?: { cookie: string; playerId: string }) {
  const response = previous ? null : await running.app.inject({ method: 'GET', url: '/api/session' });
  const cookieHeader = response?.headers['set-cookie'];
  const cookie = previous?.cookie ?? (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader as string).split(';')[0];
  const playerId = previous?.playerId ?? response!.json().playerId;
  const socket: Client = io(url, { transports: ['websocket'], autoConnect: false, reconnection: false, extraHeaders: { Cookie: cookie, Origin: origin } });
  const current: Actor = { socket, cookie, playerId };
  socket.on('snapshot', value => { current.snapshot = value; }); socket.on('private', value => { current.secret = value; });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
  return current;
}
function send(actor: Actor, command: Command, overrides?: Partial<CommandEnvelope>) {
  const envelope: CommandEnvelope = { id: crypto.randomUUID(), command, socialGeneration: actor.snapshot?.social.generation, ...(actor.snapshot?.game ? { phaseId: actor.snapshot.game.phaseId } : {}), ...overrides };
  return new Promise<Ack>((resolve, reject) => {
    actor.socket.timeout(3000).emit('command', envelope, (error: Error | null, ack: Ack) => error ? reject(error) : resolve(ack));
  });
}
async function opened(count = 4) {
  const { running, url } = await server(); const actors: Actor[] = [];
  for (let i = 0; i < count; i++) actors.push(await actor(running, url));
  const created = await send(actors[0], { type: 'room.create', name: 'René 0', appearance: DEFAULT_APPEARANCE });
  expect(created.ok).toBe(true);
  const code = created.ok ? created.code! : '';
  for (let i = 1; i < count; i++) expect((await send(actors[i], { type: 'room.join', code, name: `René ${i}`, appearance: DEFAULT_APPEARANCE })).ok).toBe(true);
  await expect.poll(() => actors.every(a => a.snapshot?.players.length === count)).toBe(true);
  return { running, url, actors, room: running.rooms.store.get(code)!, code };
}
async function expire(running: Running, room: ReturnType<Running['rooms']['requireRoom']>, actor: Actor) {
  const oldPhaseId = room.game!.phaseId;
  room.game!.deadline = Date.now() - 1;
  running.tick();
  await expect.poll(() => actor.snapshot?.game?.phaseId !== oldPhaseId).toBe(true);
}

describe('real Socket.IO clients', () => {
  it('restores old clues on arrival and reconnect, then includes the waiting guest in the next game', async () => {
    const { running, url, actors, room, code } = await opened();
    const describing = () => room.game?.phase === 'description';
    for (const a of actors) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    expect((await send(actors[0], { type: 'game.start' })).ok).toBe(true);
    await expire(running, room, actors[0]);
    while (describing()) {
      const turn = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
      expect((await send(turn, { type: 'game.describe', text: `Indice public ${room.game!.descriptions.length + 1}` }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    }
    expect((await send(actors[0], { type: 'game.skipDiscussion' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    await expire(running, room, actors[0]); // An empty vote opens a second round.
    const first = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
    expect((await send(first, { type: 'game.describe', text: 'Indice récent' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    const descriptions = structuredClone(room.game!.descriptions);
    const phaseId = room.game!.phaseId;
    const deadline = room.game!.deadline;
    const turnIndex = actors.findIndex(a => a.playerId === room.game!.turnPlayerId);
    const disconnected = actors[turnIndex];
    const originalWord = disconnected.secret!.word;
    disconnected.socket.disconnect();
    const resumed = await actor(running, url, disconnected);
    actors[turnIndex] = resumed;
    expect((await send(resumed, { type: 'room.resume' })).ok).toBe(true);
    await expect.poll(() => resumed.secret?.inGame).toBe(true);
    expect(resumed.secret!.word).toBe(originalWord);
    expect(resumed.snapshot!.players.find(p => p.id === resumed.playerId)).toMatchObject({ connected: true, waiting: false, alive: true });
    expect(resumed.snapshot!.game).toMatchObject({ phaseId, deadline, descriptions });

    const late = await actor(running, url);
    expect((await send(late, { type: 'room.join', code, name: 'Nouveau René', appearance: DEFAULT_APPEARANCE })).ok).toBe(true);
    await expect.poll(() => late.snapshot?.game?.descriptions).toEqual(descriptions);
    expect(late.snapshot!.game).toMatchObject({ phaseId, deadline });
    expect(late.secret).toMatchObject({ inGame: false, word: null, voteTarget: null });
    expect(late.snapshot!.players.find(p => p.id === late.playerId)).toMatchObject({ waiting: true, alive: false });
    expect(late.snapshot!.game).not.toHaveProperty('roles');
    expect(late.snapshot!.game).not.toHaveProperty('words');
    expect((await send(late, { type: 'game.describe', text: 'Je ne dois pas interrompre le tour' })).ok).toBe(false);
    expect(room.game!.descriptions).toEqual(descriptions);
    expect((await send(resumed, { type: 'game.describe', text: 'Indice après reconnexion' }, { phaseId: room.game!.phaseId })).ok).toBe(true);

    while (describing()) {
      const turn = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
      expect((await send(turn, { type: 'game.describe', text: 'Indice de fin de tour' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    }
    expect((await send(actors[0], { type: 'game.skipDiscussion' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    const target = room.game!.alive.find(id => room.game!.roles[id] === 'undercover')!;
    const votePhase = room.game!.phaseId;
    for (const a of actors) {
      expect((await send(a, { type: 'game.vote', targetId: a.playerId === target ? actors.find(other => other.playerId !== target)!.playerId : target }, { phaseId: votePhase })).ok).toBe(true);
    }
    await expire(running, room, actors[0]);
    expect(room.game!.phase).toBe('results');
    expect((await send(actors[0], { type: 'game.next' })).ok).toBe(true);
    await expect.poll(() => late.snapshot?.game).toBeNull();
    expect(late.snapshot!.players.find(p => p.id === late.playerId)).toMatchObject({ waiting: false, alive: true, ready: false });
    for (const a of [...actors, late]) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    expect((await send(actors[0], { type: 'game.start' })).ok).toBe(true);
    await expect.poll(() => late.secret?.inGame).toBe(true);
    expect(room.game!.playerIds).toContain(late.playerId);
    expect(late.snapshot!.game!.order).toContain(late.playerId);
    expect(late.snapshot!.game!.descriptions).toEqual([]);
  });
  it('shares role-independent player marks and keeps them with the same appearance and opening seat after reconnect', async () => {
    const { running, url, actors, room } = await opened(8);
    const appearance = { ...DEFAULT_APPEARANCE, hair: 'bun' as const, body: '#F34531' as const };
    expect((await send(actors[0], { type: 'profile.update', name: 'René distinct', appearance })).ok).toBe(true);
    expect((await send(actors[0], { type: 'settings.update', settings: { ...room.settings, automaticRoles: false, undercoverCount: 1, whiteCount: 3 } })).ok).toBe(true);
    for (const a of actors) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    expect((await send(actors[0], { type: 'game.start' })).ok).toBe(true);
    await expect.poll(() => actors.every(a => !!a.snapshot?.game)).toBe(true);
    const marks = { ...room.game!.playerMarks }; const order = [...room.game!.order];
    expect(new Set(Object.values(marks)).size).toBe(8);
    expect(room.game!.roles[order[0]]).not.toBe('white');
    for (const a of actors) {
      expect(a.snapshot!.game!.playerMarks).toEqual(marks);
      expect(a.snapshot!.players.find(p => p.id === actors[0].playerId)!.appearance).toEqual(appearance);
      expect(a.snapshot!.players.every(p => p.role === undefined)).toBe(true);
      expect(a.snapshot!.game).not.toHaveProperty('roles');
      expect(a.snapshot!.game).not.toHaveProperty('words');
    }
    const old = actors.find(a => a.playerId === order[0])!;
    old.socket.disconnect();
    await expect.poll(() => actors.find(a => a !== old)!.snapshot?.players.find(p => p.id === old.playerId)?.connected).toBe(false);
    await expire(running, room, actors.find(a => a !== old)!);
    expect(room.game!.order).toEqual(order); expect(room.game!.turnPlayerId).toBe(old.playerId);
    const resumed = await actor(running, url, old);
    expect((await send(resumed, { type: 'room.resume' })).ok).toBe(true);
    await expect.poll(() => resumed.snapshot?.game?.playerMarks).toEqual(marks);
    expect(resumed.snapshot!.game!.order).toEqual(order);
    expect((await send(resumed, { type: 'game.describe', text: 'Indice après reconnexion' })).ok).toBe(true);
    await expect.poll(() => actors.find(a => a !== old)!.snapshot?.game?.turnPlayerId).toBe(order[1]);
  });
  it('broadcasts expanded appearances, persists them and normalizes legacy profile commands on reconnect', async () => {
    const { running, url, actors } = await opened();
    const appearance = { ...DEFAULT_APPEARANCE, head: 'peanut' as const, hair: 'curls' as const, eyes: 'worried' as const, mouth: 'tooth' as const, nose: 'hook' as const, accessory: 'monocle' as const, accessoryColor: '#8A5DB3' as const };
    expect((await send(actors[1], { type: 'profile.update', name: 'René nouveau', appearance })).ok).toBe(true);
    await expect.poll(() => actors.map(a => a.snapshot?.players.find(p => p.id === actors[1].playerId)?.appearance)).toEqual(Array(4).fill(appearance));
    const session = await running.app.inject({ method: 'GET', url: '/api/session', headers: { cookie: actors[1].cookie } });
    expect(session.json().appearance).toEqual(appearance);
    const old = actors[1]; old.socket.disconnect(); const resumed = await actor(running, url, old);
    await send(resumed, { type: 'room.resume' });
    await expect.poll(() => resumed.snapshot?.players.find(p => p.id === old.playerId)?.appearance).toEqual(appearance);
    const { accessoryColor: _color, ...legacy } = DEFAULT_APPEARANCE;
    expect((await send(resumed, { type: 'profile.update', name: 'René ancien', appearance: legacy } as unknown as Command)).ok).toBe(true);
    await expect.poll(() => actors[0].snapshot?.players.find(p => p.id === old.playerId)?.appearance).toEqual(DEFAULT_APPEARANCE);
    expect((await send(resumed, { type: 'profile.update', name: 'René invalide', appearance: { ...appearance, head: 'hacked' } } as unknown as Command)).ok).toBe(false);
  });
  it('accepts authenticated polling without Origin or Fetch Metadata on the configured host', async () => {
    const { running, url } = await server(undefined, true);
    const session = await running.app.inject({ method: 'GET', url: '/api/session' });
    const cookie = String(session.headers['set-cookie']).split(';')[0];
    const socket: Client = io(url, { transports: ['polling'], autoConnect: false, reconnection: false, extraHeaders: { Cookie: cookie } });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
    const ack = await send({ socket, cookie, playerId: session.json().playerId }, { type: 'room.create', name: 'René LAN', appearance: DEFAULT_APPEARANCE });
    expect(ack.ok).toBe(true);
    expect(socket.io.engine.transport.name).toBe('polling');
  });

  it('plays, rejects cheating and replays after a complete four-client game', async () => {
    const { running, actors, room } = await opened();
    expect((await send(actors[1], { type: 'game.start' })).ok).toBe(false);
    for (const a of actors) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    const started = await send(actors[0], { type: 'game.start' });
    expect(started, started.ok ? undefined : started.error).toMatchObject({ ok: true });
    await expect.poll(() => actors.every(a => a.secret?.inGame)).toBe(true);
    for (const a of actors) {
      expect(a.secret).not.toHaveProperty('role');
      expect(a.snapshot?.game).not.toHaveProperty('roles');
      expect(JSON.stringify(a.snapshot)).not.toContain(room.game!.words.civilian);
      expect(JSON.stringify(a.snapshot)).not.toContain(room.game!.words.undercover);
    }
    await expire(running, room, actors[0]);
    const stalePhase = room.game!.phaseId;
    while (room.game!.phase === 'description') {
      const turn = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
      expect((await send(turn, { type: 'game.describe', text: 'Quelque chose de familier' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    }
    expect((await send(actors[0], { type: 'game.skipDiscussion' }, { phaseId: stalePhase })).ok).toBe(false);
    expect((await send(actors[0], { type: 'game.skipDiscussion' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    const undercover = room.game!.alive.find(id => room.game!.roles[id] === 'undercover')!;
    const first = actors.find(a => a.playerId !== undercover)!;
    const commandId = crypto.randomUUID();
    const votePhase = room.game!.phaseId;
    expect((await send(first, { type: 'game.vote', targetId: undercover }, { id: commandId, phaseId: votePhase })).ok).toBe(true);
    expect((await send(first, { type: 'game.vote', targetId: undercover }, { id: commandId, phaseId: votePhase })).ok).toBe(true);
    expect(Object.keys(room.game!.ballots)).toHaveLength(1);
    expect((await send(first, { type: 'game.vote', targetId: undercover }, { phaseId: votePhase })).ok).toBe(false);
    for (const a of actors.filter(a => a !== first)) {
      expect((await send(a, { type: 'game.vote', targetId: a.playerId === undercover ? first.playerId : undercover }, { phaseId: votePhase })).ok).toBe(true);
    }
    await expire(running, room, actors[0]);
    await expect.poll(() => actors.every(a => a.snapshot?.game?.result?.winner === 'civilians')).toBe(true);
    expect(actors[0].snapshot!.players.reduce((n, p) => n + p.score, 0)).toBe(6);
    expect((await send(actors[0], { type: 'game.next' })).ok).toBe(true);
    expect(room.game).toBeNull(); expect(room.completedGames).toBe(1);
  });

  it('synchronizes movement and replayable emotes across real clients through voting', async () => {
    const { running, actors, room } = await opened();
    const moving = actors[0];
    const positions: number[] = [];
    actors[1].socket.on('poses', value => { if (value[moving.playerId]) positions.push(value[moving.playerId].z); });
    for (const a of actors) await send(a, { type: 'player.ready', ready: true });
    await send(moving, { type: 'game.start' });
    await expire(running, room, moving);
    const moveOnce = async () => {
      const before = room.players.get(moving.playerId)!.position.z;
      await new Promise(resolve => setTimeout(resolve, 45));
      moving.socket.emit('move', { x: 0, z: .5 });
      await expect.poll(() => room.players.get(moving.playerId)!.position.z).toBeGreaterThan(before);
      await expect.poll(() => positions.at(-1)).toBe(room.players.get(moving.playerId)!.position.z);
    };
    await moveOnce(); // description
    for (const kind of ['wave', 'suspect', 'dance'] as const) {
      room.players.get(moving.playerId)!.lastEmoteAt = -Infinity; // no wall-clock cooldown delay in this transport test
      expect((await send(moving, { type: 'player.emote', kind })).ok).toBe(true);
      await expect.poll(() => actors.every(a => a.snapshot?.players.find(p => p.id === moving.playerId)?.emote?.kind === kind)).toBe(true);
      const deadlines = actors.map(a => a.snapshot!.players.find(p => p.id === moving.playerId)!.emote!.until);
      expect(new Set(deadlines).size).toBe(1);
      expect(deadlines[0]).toBeLessThanOrEqual(Date.now() + EMOTE_DURATION_MS);
    }
    while (room.game!.phase === 'description') {
      const turn = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
      await send(turn, { type: 'game.describe', text: 'Très discret' }, { phaseId: room.game!.phaseId });
    }
    await moveOnce(); // discussion
    await send(moving, { type: 'game.skipDiscussion' }, { phaseId: room.game!.phaseId });
    const seated = { ...room.players.get(moving.playerId)!.position };
    moving.socket.emit('move', { x: 0, z: 1 });
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(room.players.get(moving.playerId)!.position).toEqual(seated);
    await expire(running, room, moving); // no ballots: return to description
    await moveOnce();
    moving.socket.emit('move', { x: NaN, z: 999 });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(Number.isFinite(room.players.get(moving.playerId)!.position.x)).toBe(true);
  });

  it('synchronizes simultaneous reactions, rejects invalid payloads and restores the local choice on reconnect', async () => {
    const { running, url, actors, room } = await opened();
    expect((await send(actors[0], { type: 'chat.send', text: 'René est très louche.' })).ok).toBe(true);
    const id = room.chat[0].id;
    const react = (index: number, reaction: 'up' | 'down' | null) => send(actors[index], { type: 'chat.react', messageId: id, reaction });
    expect((await Promise.all([react(0, 'up'), react(1, 'up'), react(2, 'down')])).every(ack => ack.ok)).toBe(true);
    await expect.poll(() => actors.map(a => a.snapshot?.chat[0].reactions)).toEqual(Array(4).fill({ up: 2, down: 1 }));
    const revision = room.revision;
    await react(1, 'up'); expect(room.revision).toBe(revision);
    await react(1, 'down'); await react(0, null);
    await expect.poll(() => actors.every(a => a.snapshot?.chat[0].reactions.down === 2)).toBe(true);
    const old = actors[1]; old.socket.disconnect();
    actors[1] = await actor(running, url, old); await send(actors[1], { type: 'room.resume' });
    await expect.poll(() => actors[1].secret?.chatReactions[id]).toBe('down');
    expect((await send(actors[0], { type: 'chat.react', messageId: 'absent', reaction: 'up' })).ok).toBe(false);
    expect((await send(actors[0], { type: 'chat.react', messageId: id, reaction: 'invalid' } as unknown as Command)).ok).toBe(false);
    expect(actors.every(a => a.snapshot?.players.every(p => p.score === 0))).toBe(true);
  });

  it('serializes the final readiness confirmations and seats voters exactly once', async () => {
    const { running, actors, room } = await opened();
    for (const a of actors) await send(a, { type: 'player.ready', ready: true });
    await send(actors[0], { type: 'game.start' }); await expire(running, room, actors[0]);
    while (room.game!.phase === 'description') await send(actors.find(a => a.playerId === room.game!.turnPlayerId)!, { type: 'game.describe', text: 'Indice' }, { phaseId: room.game!.phaseId });
    const phaseId = room.game!.phaseId; const revision = room.game!.revision;
    for (const index of [0, 1]) expect((await send(actors[index], { type: 'game.setVoteReady', ready: true }, { phaseId })).ok).toBe(true);
    await expect.poll(() => actors.every(a => a.snapshot?.game?.readyToVotePlayerIds.length === 2)).toBe(true);
    const last = await Promise.all([2, 3].map(index => send(actors[index], { type: 'game.setVoteReady', ready: true }, { phaseId })));
    expect(last.every(ack => ack.ok)).toBe(true);
    await expect.poll(() => actors.every(a => a.snapshot?.game?.phase === 'vote')).toBe(true);
    expect(room.game!.revision).toBe(revision + 1);
    expect((await send(actors[2], { type: 'game.setVoteReady', ready: false }, { phaseId })).ok).toBe(false);
    expect(room.game!.ballots).toEqual({});
    expect(actors.every(a => a.snapshot?.players.every(p => !p.role))).toBe(true);
  });

  it('reveals White to all clients, accepts balais for balai and rejects a second guess', async () => {
    const { running, actors, room } = await opened();
    room.settings = { ...room.settings, automaticRoles: false, undercoverCount: 0, whiteCount: 1 };
    for (const a of actors) await send(a, { type: 'player.ready', ready: true });
    await send(actors[0], { type: 'game.start' });
    room.game!.words.civilian = 'Balai'; // controlled server fixture; no production override/API
    await expire(running, room, actors[0]);
    while (room.game!.phase === 'description') await send(actors.find(a => a.playerId === room.game!.turnPlayerId)!, { type: 'game.describe', text: 'Indice' }, { phaseId: room.game!.phaseId });
    for (const a of actors) await send(a, { type: 'game.setVoteReady', ready: true }, { phaseId: room.game!.phaseId });
    const white = actors.find(a => room.game!.roles[a.playerId] === 'white')!;
    for (const a of actors) await send(a, { type: 'game.vote', targetId: a === white ? actors.find(other => other !== white)!.playerId : white.playerId }, { phaseId: room.game!.phaseId });
    await expect.poll(() => actors.every(a => a.snapshot?.game?.phase === 'whiteGuess')).toBe(true);
    expect(actors.every(a => a.snapshot!.players.find(p => p.id === white.playerId)?.role === 'white')).toBe(true);
    expect(actors.every(a => a.snapshot!.players.filter(p => p.alive).every(p => !p.role))).toBe(true);
    expect(actors.every(a => !JSON.stringify(a.snapshot).includes('Balai'))).toBe(true);
    const phaseId = room.game!.phaseId;
    expect((await send(white, { type: 'game.guess', word: 'balais' }, { phaseId })).ok).toBe(true);
    await expect.poll(() => actors.every(a => a.snapshot?.game?.result?.winner === 'white')).toBe(true);
    expect(actors.every(a => a.snapshot!.players.find(p => p.id === white.playerId)?.score === 6)).toBe(true);
    expect((await send(white, { type: 'game.guess', word: 'balai' }, { phaseId })).ok).toBe(false);
  });

  it('recovers the same place after refresh and replaces a second controlling connection', async () => {
    const { running, url, actors, room } = await opened();
    for (const a of actors) await send(a, { type: 'player.ready', ready: true });
    const started = await send(actors[0], { type: 'game.start' });
    expect(started, started.ok ? undefined : started.error).toMatchObject({ ok: true });
    const old = actors[1];
    await expect.poll(() => old.secret?.inGame).toBe(true);
    const word = old.secret!.word; old.socket.disconnect();
    const replacement = await actor(running, url, old);
    expect((await send(replacement, { type: 'room.resume' })).ok).toBe(true);
    await expect.poll(() => replacement.secret?.word).toBe(word);
    expect(room.players.size).toBe(4);
    const replaced = new Promise<void>(resolve => replacement.socket.once('replaced', resolve));
    const third = await actor(running, url, old); await replaced;
    await send(third, { type: 'room.resume' });
    expect(replacement.socket.connected).toBe(false);
    expect(room.players.get(old.playerId)?.connected).toBe(true);
  });

  it('rejects foreign origins and unauthenticated connections', async () => {
    const { running, url } = await server();
    const session = await running.app.inject({ method: 'GET', url: '/api/session' });
    const cookie = String(session.headers['set-cookie']).split(';')[0];
    const rejectedHeaders: Record<string, string>[] = [{ Origin: 'https://evil.example', Cookie: cookie }, { Origin: origin }];
    for (const headers of rejectedHeaders) {
      const socket = io(url, { transports: ['websocket'], reconnection: false, autoConnect: false, extraHeaders: headers }); clients.push(socket);
      const failed = new Promise<Error>(resolve => socket.once('connect_error', resolve)); socket.connect();
      expect(await failed).toBeInstanceOf(Error); expect(socket.connected).toBe(false);
    }
    const voice = await running.app.inject({ method: 'POST', url: '/api/voice', headers: { cookie, origin: 'https://evil.example' } });
    expect(voice.statusCode).toBe(403);
  });

  it('does not create a ghost room when the connection dies during a profile write', async () => {
    const { createPersistence } = await import('./persistence.js');
    const backing = await createPersistence(); let release!: () => void; let entered!: () => void;
    const saving = new Promise<void>(resolve => { entered = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    let delay = false;
    const persistence: Persistence = { getGuest: token => backing.getGuest(token), recordResult: (...args) => backing.recordResult(...args), close: () => backing.close(), saveGuest: async (value: Guest) => { if (delay) { entered(); await pending; } await backing.saveGuest(value); } };
    const { running, url } = await server(persistence); const a = await actor(running, url); delay = true;
    a.socket.emit('command', { id: crypto.randomUUID(), command: { type: 'room.create', name: 'René', appearance: DEFAULT_APPEARANCE } }, () => undefined);
    await saving; a.socket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 30)); release();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(running.rooms.store.size).toBe(0);
  });

  it('shuts down with an open WebSocket', async () => {
    const { running, url } = await server(); await actor(running, url);
    await running.app.close(); apps.splice(apps.indexOf(running), 1);
  }, 5000);
  it('deduplicates cartoon impacts, preserves clocks/cooldowns on reconnect and rejects stale social generations', async () => {
    const { running, url, actors, room } = await opened();
    const [a, b] = actors; room.players.get(a.playerId)!.position = { x: 4, z: 0, yaw: 0 }; room.players.get(b.playerId)!.position = { x: 4, z: 1.2, yaw: Math.PI };
    const command = { type: 'player.attack', kind: 'punch', targetId: b.playerId } as const;
    let privateMessages = 0; b.socket.on('private', () => { privateMessages++; });
    const duplicate = crypto.randomUUID();
    expect((await send(a, command, { id: duplicate })).ok).toBe(true);
    expect((await send(a, command, { id: duplicate, phaseId: crypto.randomUUID() })).ok).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 200)); running.tick();
    await expect.poll(() => b.snapshot?.social.players[b.playerId].physical?.kind).toBe('hit_reaction');
    expect(room.players.get(b.playerId)!.social.hits).toHaveLength(1);
    expect(privateMessages).toBe(0);
    const attack = a.snapshot!.social.players[a.playerId].animation;
    a.socket.disconnect(); const resumed = await actor(running, url, a); await send(resumed, { type: 'room.resume' });
    await expect.poll(() => resumed.snapshot?.social.players[a.playerId].animation?.instanceId).toBe(attack!.instanceId);
    expect((await send(resumed, { type: 'player.attack', kind: 'slap', targetId: b.playerId })).ok).toBe(false);
    const generation = room.social.generation;
    for (const x of [resumed, ...actors.slice(1)]) await send(x, { type: 'player.ready', ready: true });
    await send(resumed, { type: 'game.start' });
    expect(room.social.generation).toBe(generation + 1);
    expect((await send(resumed, command, { id: duplicate, socialGeneration: generation })).ok).toBe(false);
    for (const x of actors.slice(1)) {
      expect(x.snapshot?.social).not.toHaveProperty('pending');
      expect(x.snapshot?.social.players[b.playerId]).not.toHaveProperty('hits');
      expect(x.snapshot?.game).not.toHaveProperty('roles'); expect(x.snapshot?.game).not.toHaveProperty('words');
    }
    const outsider = await actor(running, url);
    const other = await send(outsider, { type: 'room.create', name: 'Autre salon', appearance: DEFAULT_APPEARANCE }); expect(other.ok).toBe(true);
    await expect.poll(() => !!outsider.snapshot?.social.generation).toBe(true);
    expect((await send(outsider, { type: 'player.attack', kind: 'punch', targetId: b.playerId })).ok).toBe(false);
  });
  it('reserves command capacity for descriptions and votes when emotes are spammed', async () => {
    const { running, actors, room } = await opened();
    for (const a of actors) await send(a, { type: 'player.ready', ready: true });
    await send(actors[0], { type: 'game.start' }); await expire(running, room, actors[0]);
    const first = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
    const phaseId = room.game!.phaseId;
    const spam = Array.from({ length: 40 }, () => send(first, { type: 'player.emote', kind: 'wave' }, { phaseId }));
    const business = send(first, { type: 'game.describe', text: 'Indice fictif prioritaire' }, { phaseId });
    expect((await business).ok).toBe(true);
    expect((await Promise.all(spam)).filter(a => !a.ok).length).toBeGreaterThan(0);
    expect(room.game!.descriptions.at(-1)?.text).toBe('Indice fictif prioritaire');
    while (room.game!.phase === 'description') {
      const turn = actors.find(a => a.playerId === room.game!.turnPlayerId)!;
      expect((await send(turn, { type: 'game.describe', text: 'Indice fictif suivant' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    }
    expect((await send(actors[0], { type: 'game.skipDiscussion' }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    const invalidEmotes = Array.from({ length: 40 }, () => send(first, { type: 'player.emote', kind: 'wave' }));
    expect((await send(first, { type: 'game.vote', targetId: actors.find(a => a !== first)!.playerId }, { phaseId: room.game!.phaseId })).ok).toBe(true);
    await Promise.all(invalidEmotes);
    expect(room.game!.ballots[first.playerId]).toBeTruthy();
  });

  it('retains the global attack delay even through voluntary leave and rejoin', async () => {
    const { actors, code } = await opened(); const a = actors[0];
    expect((await send(a, { type: 'player.attack', kind: 'punch' })).ok).toBe(true);
    expect((await send(a, { type: 'room.leave' })).ok).toBe(true);
    expect((await send(a, { type: 'room.join', code, name: 'Retour fictif', appearance: DEFAULT_APPEARANCE })).ok).toBe(true);
    const ack = await send(a, { type: 'player.attack', kind: 'headbutt' });
    expect(ack.ok).toBe(false); if (!ack.ok) expect(ack.error).toContain('souffle');
  });

});
