import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { Server, type Socket } from 'socket.io';
import { DEFAULT_APPEARANCE, EnvelopeSchema, MoveSchema, type Ack, type ClientEvents, type ServerEvents } from '@rene/contracts';
import { createPersistence, type Persistence, type Guest } from './persistence.js';
import { readConfig, type Config } from './config.js';
import { Rooms, MemoryRoomStore, type Room } from './rooms.js';
import { SerialQueue, TokenBucket } from './queue.js';
import { VoiceService } from './voice.js';
import { allowsRealtimeRequest } from './origin.js';

const COOKIE = 'rene_guest';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { guest: Guest }>;
export interface AppOptions { config?: Config; persistence?: Persistence; timers?: boolean; logger?: boolean; webRoot?: string }

export async function createApp(options: AppOptions = {}) {
  const config = options.config ?? readConfig();
  const persistence = options.persistence ?? await createPersistence(config.DATABASE_URL);
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 8192, trustProxy: config.TRUST_PROXY ?? false });
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  const rooms = new Rooms(new MemoryRoomStore(), persistence, config.MAX_ROOMS, undefined, error => app.log.error({ err: error }, 'Sauvegarde des résultats, nouvelle tentative dans 5 secondes'));
  const queue = new SerialQueue();
  const players = new Map<string, GameSocket>();
  const recent = new Map<string, Map<string, { fingerprint: string; ack: Ack }>>();
  const recentAt = new Map<string, number>();
  const voice = new VoiceService(config, error => app.log.warn({ err: error }, 'Vocal : nettoyage différé'));

  const authenticate = async (header: string | undefined) => {
    const token = app.parseCookie(header ?? '')[COOKIE];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return persistence.getGuest(hash(token));
  };
  const sameOrigin = (origin: string | undefined) => origin === config.WEB_ORIGIN;
  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, 'Requête échouée');
    const statusCode = error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : undefined;
    const status = statusCode && statusCode >= 400 && statusCode < 500 ? statusCode : 503;
    return reply.code(status).send({ error: status === 429 ? 'Trop de requêtes. Réessaie dans un instant.' : 'Service momentanément indisponible.' });
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(self)');
    reply.header('X-Frame-Options', 'DENY');
  });
  app.get('/health', () => ({ status: 'ok' }));
  app.get('/api/session', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    let guest = await authenticate(request.headers.cookie);
    if (!guest) {
      const token = randomBytes(32).toString('hex');
      guest = { id: randomUUID(), tokenHash: hash(token), name: 'René', appearance: { ...DEFAULT_APPEARANCE }, createdAt: new Date() };
      await persistence.saveGuest(guest);
      reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, secure: config.secureCookies, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 });
    }
    return { playerId: guest.id, name: guest.name, appearance: guest.appearance, roomCode: rooms.roomFor(guest.id)?.code ?? null, voiceEnabled: config.voiceEnabled };
  });
  app.post('/api/voice', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!sameOrigin(request.headers.origin)) return reply.code(403).send({ error: 'Origine non autorisée.' });
    const guest = await authenticate(request.headers.cookie);
    if (!guest) return reply.code(401).send({ error: 'Rejoins le salon pour continuer.' });
    if (!config.voiceEnabled) return reply.code(503).send({ error: 'Le vocal n’est pas configuré. Le chat reste disponible.' });
    try {
      return await queue.run(`player:${guest.id}`, () => {
        const room = rooms.requireRoom(guest.id);
        return queue.run(`room:${room.code}`, () => voice.credentials(room, guest.id));
      });
    } catch (error) { return reply.code(403).send({ error: error instanceof Error ? error.message : 'Vocal indisponible.' }); }
  });

  const io = new Server<ClientEvents, ServerEvents>(app.server, {
    maxHttpBufferSize: 8192, cors: { origin: config.WEB_ORIGIN, credentials: true },
    allowRequest: (request, callback) => {
      const allowed = allowsRealtimeRequest(request.headers, config.WEB_ORIGIN);
      if (!allowed) app.log.warn({ origin: request.headers.origin ?? null, host: request.headers.host, expectedOrigin: config.WEB_ORIGIN }, 'Connexion temps réel refusée : vérifier WEB_ORIGIN et le Host transmis par le proxy');
      callback(allowed ? null : 'Origine non autorisée.', allowed);
    },
    // Recovery uses authenticated snapshots, never stale socket room memberships.
  });
  io.use(async (socket, next) => {
    try {
      const guest = await authenticate(socket.handshake.headers.cookie);
      if (!guest) return next(new Error('Session expirée. Recharge la page.'));
      socket.data.guest = guest; next();
    } catch { next(new Error('Connexion momentanément indisponible.')); }
  });
  const broadcast = (room: Room) => {
    if (rooms.store.get(room.code) !== room) return;
    voice.synchronize(room);
    io.to(room.code).emit('snapshot', rooms.snapshot(room, Date.now()));
    for (const id of room.players.keys()) players.get(id)?.emit('private', rooms.privateSnapshot(room, id));
  };
  const active = (socket: GameSocket) => players.get(socket.data.guest.id)?.id === socket.id;

  io.on('connection', rawSocket => {
    const socket = rawSocket as GameSocket;
    const guest = socket.data.guest;
    const previous = players.get(guest.id);
    // Replace first so the old disconnect handler cannot mark the new connection offline.
    players.set(guest.id, socket);
    if (previous && previous.id !== socket.id) { previous.emit('replaced'); previous.disconnect(true); }
    const commands = new TokenBucket(30, 8);
    const moves = new TokenBucket(30, 20);
    let pending = 0;

    socket.on('command', (input, callback) => {
      const ack = typeof callback === 'function' ? callback : () => undefined;
      if (!active(socket)) return ack({ ok: false, error: 'Cette place est ouverte dans un autre onglet.' });
      if (!commands.take() || pending >= 12) return ack({ ok: false, error: 'Trop d’actions. Réessaie dans un instant.' });
      const parsed = EnvelopeSchema.safeParse(input);
      if (!parsed.success) return ack({ ok: false, error: 'Action invalide.' });
      const envelope = parsed.data;
      pending++;
      // Lock a player's membership first, then lock its room (also shared with timers).
      void queue.run(`player:${guest.id}`, async () => {
        if (!active(socket)) throw new Error('Cette place est ouverte dans un autre onglet.');
        const saved = recent.get(guest.id)?.get(envelope.id);
        const fingerprint = JSON.stringify({ command: envelope.command, phaseId: envelope.phaseId });
        if (saved) {
          if (saved.fingerprint !== fingerprint) throw new Error('Identifiant d’action déjà utilisé.');
          const room = rooms.roomFor(guest.id); if (room) broadcast(room);
          recentAt.set(guest.id, Date.now()); ack(saved.ack); return;
        }
        const command = envelope.command;
        const code = command.type === 'room.join' ? command.code : rooms.roomFor(guest.id)?.code;
        const result: Ack = await queue.run(code ? `room:${code}` : 'create', async (): Promise<Ack> => {
          if (!active(socket)) throw new Error('Cette place est ouverte dans un autre onglet.');
          let room = rooms.roomFor(guest.id);
          const now = Date.now();
          if (room) { await rooms.tick(room, now); broadcast(room); }
          if (command.type.startsWith('game.') && command.type !== 'game.start' && command.type !== 'game.next') {
            if (!room?.game || envelope.phaseId !== room.game.phaseId) throw new Error('Cette phase est terminée. La partie a été actualisée.');
          }
          switch (command.type) {
            case 'room.create': {
              guest.name = command.name; guest.appearance = command.appearance;
              await persistence.saveGuest(guest).catch(error => { app.log.error({ err: error }, 'Profil'); throw new Error('Impossible de sauvegarder ton profil pour le moment.'); });
              if (!active(socket)) throw new Error('Connexion interrompue. Rejoins à nouveau le salon.');
              room = rooms.create(guest, now); await socket.join(room.code); break;
            }
            case 'room.join': {
              const target = rooms.store.get(command.code);
              if (!target) throw new Error('Salon introuvable. Vérifie le code à six lettres.');
              if (room && room.code !== target.code) throw new Error('Quitte d’abord ton salon actuel.');
              guest.name = command.name; guest.appearance = command.appearance;
              await persistence.saveGuest(guest).catch(error => { app.log.error({ err: error }, 'Profil'); throw new Error('Impossible de sauvegarder ton profil pour le moment.'); });
              if (!active(socket)) throw new Error('Connexion interrompue. Rejoins à nouveau le salon.');
              rooms.join(target, guest, now); room = target; await socket.join(room.code); break;
            }
            case 'room.resume':
              if (!room) return { ok: true };
              rooms.connected(room, guest.id, now); await socket.join(room.code); break;
            case 'room.leave':
              if (!room) return { ok: true };
              await rooms.leave(room, guest.id, now); await socket.leave(room.code);
              if (!rooms.store.get(room.code)) void voice.closeRoom(room.code);
              break;
            case 'profile.update':
              rooms.updateProfile(room, guest.id, command.name, command.appearance);
              guest.name = command.name; guest.appearance = command.appearance;
              await persistence.saveGuest(guest).catch(error => { app.log.error({ err: error }, 'Profil'); throw new Error('Impossible de sauvegarder ton profil pour le moment.'); }); break;
            default:
              if (!room) throw new Error('Rejoins une salle pour continuer.');
              await rooms.command(room, guest.id, command, now);
          }
          if (room) broadcast(room);
          return { ok: true, ...(room ? { code: room.code } : {}) };
        });
        const history = recent.get(guest.id) ?? new Map<string, { fingerprint: string; ack: Ack }>();
        history.set(envelope.id, { fingerprint, ack: result });
        if (history.size > 128) history.delete(history.keys().next().value!);
        recent.set(guest.id, history); recentAt.set(guest.id, Date.now()); ack(result);
      }).catch(error => {
        const room = rooms.roomFor(guest.id); if (room) broadcast(room);
        if (!(error instanceof Error)) app.log.error({ err: error }, 'Action échouée');
        ack({ ok: false, error: error instanceof Error ? error.message : 'Action momentanément indisponible.' });
      }).finally(() => { pending--; });
    });
    socket.on('move', input => {
      if (!active(socket) || !moves.take()) return;
      const parsed = MoveSchema.safeParse(input); const room = rooms.roomFor(guest.id);
      if (!room || !parsed.success) return;
      if (rooms.move(room, guest.id, parsed.data, Date.now())) io.to(room.code).emit('poses', { [guest.id]: room.players.get(guest.id)!.position });
    });
    socket.on('disconnect', () => {
      if (!active(socket)) return;
      players.delete(guest.id);
      const room = rooms.roomFor(guest.id);
      if (room) void queue.run(`room:${room.code}`, () => {
        if (players.has(guest.id)) return;
        rooms.disconnected(room, guest.id, Date.now()); broadcast(room);
      }).catch(error => app.log.error({ err: error }, 'Déconnexion'));
    });
  });

  const ticking = new Set<string>();
  let lastCacheCleanup = Date.now();
  const tick = () => {
    const now = Date.now();
    if (now - lastCacheCleanup > 60_000) {
      lastCacheCleanup = now;
      for (const [id, at] of recentAt) if (!players.has(id) && now - at > 60 * 60_000) { recent.delete(id); recentAt.delete(id); }
    }
    for (const room of rooms.store.values()) {
      if (ticking.has(room.code)) continue;
      ticking.add(room.code);
      void queue.run(`room:${room.code}`, async () => {
        if (await rooms.tick(room, Date.now())) broadcast(room);
        if (!rooms.store.get(room.code)) {
          for (const id of room.players.keys()) { recent.delete(id); recentAt.delete(id); }
          await voice.closeRoom(room.code);
        }
      }).catch(error => app.log.error({ err: error }, 'Synchronisation du salon')).finally(() => ticking.delete(room.code));
    }
  };
  const timer = options.timers === false ? null : setInterval(tick, 200);
  timer?.unref();

  const webRoot = options.webRoot ?? resolve(process.cwd(), process.cwd().endsWith('apps/server') ? '../web/dist' : 'apps/web/dist');
  if (existsSync(webRoot)) {
    await app.register(staticFiles, { root: webRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/') && !request.url.startsWith('/socket.io/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'Page introuvable.' });
    });
  }
  app.addHook('preClose', async () => {
    if (timer) clearInterval(timer);
    io.disconnectSockets(true); await queue.drain();
  });
  app.addHook('onClose', async () => {
    await new Promise<void>(resolveClose => io.close(() => resolveClose()));
    await voice.close(); await persistence.close();
  });
  return { app, io, rooms, persistence, config, tick, broadcast };
}
