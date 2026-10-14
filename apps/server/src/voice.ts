import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { VoiceCredentials } from '@rene/contracts';
import type { Config } from './config.js';
import type { Room } from './rooms.js';

/** Room generations prevent cached self-hosted LiveKit tokens regaining revoked rights. */
export class VoiceService {
  private client: RoomServiceClient | null;
  private active = new Map<string, string>();
  constructor(private config: Config, private onError: (error: unknown) => void) {
    this.client = config.voiceEnabled ? new RoomServiceClient(config.LIVEKIT_API_URL!, config.LIVEKIT_API_KEY!, config.LIVEKIT_API_SECRET!) : null;
  }
  synchronize(room: Room) {
    if (!this.client) return;
    const name = `rene_${room.sessionId}_${room.voiceGeneration}`;
    const previous = this.active.get(room.code);
    this.active.set(room.code, name);
    // Enforce rotation from the authority, even if an eliminated client ignores snapshots.
    if (previous && previous !== name) void this.client.deleteRoom(previous).catch(this.onError);
  }
  async credentials(room: Room, playerId: string): Promise<VoiceCredentials> {
    if (!this.client) throw new Error('Le vocal n’est pas configuré sur ce serveur.');
    const player = room.players.get(playerId);
    if (!player?.connected) throw new Error('Rejoins le salon avant d’activer le micro.');
    const name = `rene_${room.sessionId}_${room.voiceGeneration}`;
    this.synchronize(room);
    const activeGame = room.game && room.game.phase !== 'results';
    const canPublish = !activeGame || (!player.waiting && room.game!.alive.includes(playerId)) || room.settings.deadCanSpeak;
    const token = new AccessToken(this.config.LIVEKIT_API_KEY!, this.config.LIVEKIT_API_SECRET!, { identity: playerId, ttl: '2m' });
    token.addGrant({ roomJoin: true, room: name, canSubscribe: true, canPublish, canPublishData: false, canPublishSources: [TrackSource.MICROPHONE], canUpdateOwnMetadata: false });
    return { url: this.config.LIVEKIT_URL!, token: await token.toJwt(), generation: room.voiceGeneration, canPublish };
  }
  async closeRoom(code: string) {
    const name = this.active.get(code); this.active.delete(code);
    if (name && this.client) await this.client.deleteRoom(name).catch(this.onError);
  }
  async close() { await Promise.all([...this.active.keys()].map(code => this.closeRoom(code))); }
}
