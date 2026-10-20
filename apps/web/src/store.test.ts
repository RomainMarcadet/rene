import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS, type PrivatePlayerState, type RoomSnapshot } from '@rene/contracts';

const transport = vi.hoisted(() => ({
  handlers: new Map<string, (value: unknown) => void>(),
  connected: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('socket.io-client', () => ({
  io: () => {
    transport.disconnect.mockImplementation(() => { transport.connected = false; transport.handlers.get('disconnect')?.(undefined); });
    return {
      get connected() { return transport.connected; }, connect: transport.connect, disconnect: transport.disconnect,
      on: (event: string, listener: (value: unknown) => void) => transport.handlers.set(event, listener),
    };
  },
}));
afterEach(() => { transport.handlers.clear(); transport.connected = true; transport.connect.mockClear(); transport.disconnect.mockClear(); vi.unstubAllGlobals(); });

it('applies a movement burst without rendering the gameplay store or losing public clues and the private word', async () => {
  vi.resetModules();
  vi.stubGlobal('location', { href: 'http://localhost/?room=ABCDEF' });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ playerId: 'first', name: 'René', appearance: DEFAULT_APPEARANCE, roomCode: 'ABCDEF', voiceEnabled: false }) }));
  const { initialize, useGame } = await import('./store');
  const { getPose } = await import('./poses');
  await initialize();
  const room: RoomSnapshot = {
    code: 'ABCDEF', revision: 10, hostId: 'first', settings: DEFAULT_SETTINGS, completedGames: 0, voiceGeneration: 1, serverNow: Date.now(), resultsPending: false,
    social: { generation: 0, players: {}, interactions: [] }, chat: [],
    players: ['first', 'second'].map(id => ({ id, name: id, appearance: DEFAULT_APPEARANCE, position: { x: 0, z: 4, yaw: 0 }, alive: true, waiting: false, connected: true, ready: false, score: 0 })),
    game: { id: 'game', phase: 'description', phaseId: 'game:4', round: 1, deadline: Date.now() + 60_000, playerMarks: { first: 0, second: 1 }, turnPlayerId: 'second', order: ['first', 'second'], descriptions: [{ playerId: 'first', text: 'Indice public', round: 1, timedOut: false }], readyToVotePlayerIds: [], votedPlayerIds: [], voteCandidates: [], voteCounts: null, eliminatedPlayerId: null, whitePlayerId: null, result: null },
  };
  const secret: PrivatePlayerState = { playerId: 'first', inGame: true, word: 'Mot de test', voteTarget: null, chatReactions: {} };
  transport.handlers.get('snapshot')!(room);
  transport.handlers.get('private')!(secret);
  const stableRoom = useGame.getState().room;
  const listener = vi.fn(); const unsubscribe = useGame.subscribe(listener);
  for (let i = 1; i <= 180; i++) transport.handlers.get('poses')!({ second: { x: i / 100, z: 4, yaw: .5 } });
  expect(listener).not.toHaveBeenCalled();
  expect(useGame.getState().room).toBe(stableRoom);
  expect(useGame.getState().room!.game!.descriptions).toEqual(room.game!.descriptions);
  expect(useGame.getState().secret).toBe(secret);
  expect(getPose('second', room.players[1].position)).toEqual({ x: 1.8, z: 4, yaw: .5 });
  expect(room.players[1].position).toEqual({ x: 0, z: 4, yaw: 0 });
  unsubscribe();
});

it('clears the old room, private state and motion when another tab has moved the session to a different room', async () => {
  vi.resetModules();
  vi.stubGlobal('location', { href: 'http://localhost/?room=ABCDEF' });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  const session = { playerId: 'first', name: 'René', appearance: DEFAULT_APPEARANCE, roomCode: 'ABCDEF', voiceEnabled: false };
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => session })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...session, roomCode: 'GHJKLM' }) }));
  const { initialize, retryConnection, useGame } = await import('./store');
  const { usePoses } = await import('./poses');
  await initialize();
  const room: RoomSnapshot = {
    code: 'ABCDEF', revision: 1, hostId: 'first', settings: DEFAULT_SETTINGS, completedGames: 0, voiceGeneration: 1, serverNow: Date.now(), resultsPending: false,
    social: { generation: 0, players: {}, interactions: [] }, chat: [],
    players: ['first', 'old-neighbor'].map(id => ({ id, name: id, appearance: DEFAULT_APPEARANCE, position: { x: 0, z: 4, yaw: 0 }, alive: true, waiting: false, connected: true, ready: false, score: 0 })),
    game: null,
  };
  transport.handlers.get('snapshot')!(room);
  transport.handlers.get('private')!({ playerId: 'first', inGame: false, word: null, voteTarget: null, chatReactions: { previous: 'up' } });
  transport.handlers.get('poses')!({ 'old-neighbor': { x: 2, z: 4, yaw: 1 } });
  transport.handlers.get('replaced')!(undefined);
  expect(transport.connected).toBe(false);

  await retryConnection();
  expect(useGame.getState()).toMatchObject({ room: null, secret: null, session: { playerId: 'first', roomCode: 'GHJKLM' } });
  expect(useGame.getState().error).toContain('autre salon');
  expect(useGame.getState().error).not.toContain('fermé');
  expect(usePoses.getState().positions).toEqual({});
  expect(transport.connect).toHaveBeenCalledTimes(2);

  const nextRoom = { ...room, code: 'GHJKLM', players: [room.players[0], { ...room.players[1], id: 'new-neighbor', name: 'Nouveau voisin' }] };
  transport.handlers.get('snapshot')!(nextRoom);
  transport.handlers.get('poses')!({ 'old-neighbor': { x: 3, z: 4, yaw: 1 } });
  expect(useGame.getState().room!.code).toBe('GHJKLM');
  expect(useGame.getState().room!.players.map(player => player.id)).toEqual(['first', 'new-neighbor']);
  expect(Object.keys(usePoses.getState().positions)).toEqual(['first', 'new-neighbor']);
  expect(useGame.getState().secret).toBeNull();
});
