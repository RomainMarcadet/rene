import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { DEFAULT_APPEARANCE, type Ack, type ClientEvents, type Command, type CommandEnvelope, type PrivatePlayerState, type RoomSnapshot, type ServerEvents } from '@rene/contracts';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import type { Guest, Persistence } from './persistence.js';

type Running = Awaited<ReturnType<typeof createApp>>;
type Client = Socket<ServerEvents, ClientEvents>;
type Actor = { socket: Client; playerId: string; cookie: string; snapshot?: RoomSnapshot; secret?: PrivatePlayerState };
const origin = 'http://localhost:5173';
const apps: Running[] = []; const clients: Client[] = [];
afterEach(async () => { for (const client of clients.splice(0)) client.disconnect(); for (const running of apps.splice(0)) await running.app.close(); });
async function server(persistence?: Persistence) {
  const running = await createApp({ config: readConfig({ NODE_ENV: 'test', WEB_ORIGIN: origin }), logger: false, timers: false, persistence });
  apps.push(running);
  const url = await running.app.listen({ port: 0, host: '127.0.0.1' });
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
  const envelope: CommandEnvelope = { id: crypto.randomUUID(), command, ...(actor.snapshot?.game ? { phaseId: actor.snapshot.game.phaseId } : {}), ...overrides };
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
  it('plays, rejects cheating and replays after a complete four-client game', async () => {
    const { running, actors, room } = await opened();
    expect((await send(actors[1], { type: 'game.start' })).ok).toBe(false);
    for (const a of actors) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    expect((await send(actors[0], { type: 'game.start' })).ok).toBe(true);
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

  it('recovers the same place after refresh and replaces a second controlling connection', async () => {
    const { running, url, actors, room } = await opened();
    for (const a of actors) await send(a, { type: 'player.ready', ready: true });
    await send(actors[0], { type: 'game.start' });
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
});
