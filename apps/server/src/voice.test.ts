import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { DEFAULT_APPEARANCE } from '@rene/contracts';
import { VoiceService } from './voice.js';
import { readConfig } from './config.js';
import { MemoryRoomStore, Rooms } from './rooms.js';
import { createPersistence } from './persistence.js';

const key = 'test-key'; const secret = 'voice-test-secret-at-least-24-characters';
const config = readConfig({ NODE_ENV: 'test', LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_API_URL: 'http://localhost:7880', LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret });
afterEach(() => vi.restoreAllMocks());

describe('server audio permissions', () => {
  it('preserves subscription for eliminated and waiting players, across generations and reconnects', async () => {
    vi.spyOn(RoomServiceClient.prototype, 'deleteRoom').mockResolvedValue();
    const persistence = await createPersistence();
    const rooms = new Rooms(new MemoryRoomStore(), persistence, 10, () => .42);
    const guest = (id: string) => ({ id, tokenHash: id, name: id, appearance: DEFAULT_APPEARANCE, createdAt: new Date() });
    const room = rooms.create(guest('p0'), 1000);
    for (let n = 1; n < 4; n++) rooms.join(room, guest(`p${n}`), 1000);
    const voice = new VoiceService(config, () => undefined);
    const verifier = new TokenVerifier(key, secret);
    const before = await voice.credentials(room, 'p0');
    for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, 1001);
    await rooms.command(room, 'p0', { type: 'game.start' }, 1002);
    room.game!.alive = room.game!.alive.filter(id => id !== 'p0'); room.voiceGeneration++;
    rooms.join(room, guest('late'), 1003);
    for (const id of ['p0', 'late']) {
      const credentials = await voice.credentials(room, id);
      expect(credentials.canPublish).toBe(false);
      const claims = await verifier.verify(credentials.token);
      expect(claims.video).toMatchObject({ canPublish: false, canSubscribe: true, canPublishData: false, canPublishSources: ['microphone'] });
      expect(claims.video?.room).not.toBe((await verifier.verify(before.token)).video?.room);
    }
    rooms.disconnected(room, 'p0', 1004);
    await expect(voice.credentials(room, 'p0')).rejects.toThrow('Rejoins');
    rooms.connected(room, 'p0', 1005);
    expect((await voice.credentials(room, 'p0')).canPublish).toBe(false);
    room.settings.deadCanSpeak = true;
    expect((await voice.credentials(room, 'p0')).canPublish).toBe(true);
    room.settings.deadCanSpeak = false; room.game!.phase = 'results';
    expect((await voice.credentials(room, 'p0')).canPublish).toBe(true);
    await persistence.close();
  });
});
