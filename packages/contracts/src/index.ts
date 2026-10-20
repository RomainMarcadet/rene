import { z } from 'zod';
import { AppearanceSchema, type AvatarAppearance } from './appearance.js';
export * from './appearance.js';
export * from './playerMarks.js';
export * from './social.js';
export * from './world.js';
import { AnimationIdSchema, AttackKindSchema, type SocialSnapshot } from './social.js';
export const SettingsSchema = z.object({
  automaticRoles: z.boolean(), undercoverCount: z.number().int().min(0).max(10), whiteCount: z.number().int().min(0).max(10),
  descriptionSeconds: z.number().int().min(10).max(180), discussionSeconds: z.number().int().min(15).max(600),
  voteSeconds: z.number().int().min(10).max(120), guessSeconds: z.number().int().min(10).max(120),
  roundsPerSession: z.number().int().min(1).max(20), hostCanSkipDiscussion: z.boolean(), deadCanSpeak: z.boolean(),
  category: z.enum(['all', 'quotidien', 'nature', 'cuisine', 'culture', 'voyage', 'cinema', 'jeux-video', 'internet', 'musique', 'sport', 'politique', 'television', 'technologie', 'histoire', 'sciences']), difficulty: z.enum(['all', 'easy', 'medium', 'hard']),
}).strict();
export type RoomSettings = z.infer<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: RoomSettings = { automaticRoles: true, undercoverCount: 1, whiteCount: 1, descriptionSeconds: 45, discussionSeconds: 120, voteSeconds: 30, guessSeconds: 30, roundsPerSession: 5, hostCanSkipDiscussion: true, deadCanSpeak: false, category: 'all', difficulty: 'all' };
export type Role = 'civilian' | 'undercover' | 'white';
export type Phase = 'reveal' | 'description' | 'discussion' | 'vote' | 'tiebreak' | 'elimination' | 'whiteGuess' | 'results';
export type Winner = 'civilians' | 'infiltrators' | 'white';
export type Emote = 'wave' | 'dance' | 'suspect';
export const EMOTE_DURATION_MS = 3500;
export const EMOTE_COOLDOWN_MS = 2000;
export const emoteDuration = (kind: Emote) => kind === 'dance' ? 2500 : EMOTE_DURATION_MS;
/** Server and client use the same phase policy; spectators are also still during votes. */
export function canMoveInPhase(phase?: Phase) { return phase !== 'vote' && phase !== 'tiebreak'; }
export function voteSeat(index: number, count: number): Position {
  const angle = index / Math.max(1, count) * Math.PI * 2;
  const x = Math.cos(angle) * 2.75; const z = Math.sin(angle) * 2.75;
  return { x, z, yaw: Math.atan2(-x, -z) };
}
export interface Position { x: number; z: number; yaw: number }
export interface PublicPlayer { id: string; name: string; appearance: AvatarAppearance; connected: boolean; ready: boolean; position: Position; alive: boolean; waiting: boolean; role?: Role; score: number; emote?: { kind: Emote; until: number } }
export interface Description { playerId: string; text: string; round: number; timedOut: boolean }
export interface GameResult { winner: Winner; winnerIds: string[]; civilWord: string; undercoverWord: string; roles: Record<string, Role>; points: Record<string, number> }
export interface PublicGame {
  id: string; phase: Phase; phaseId: string; round: number; deadline: number | null; turnPlayerId: string | null;
  playerMarks: Record<string, number>;
  order: string[]; descriptions: Description[]; voteCandidates: string[]; voteCounts: Record<string, number> | null;
  readyToVotePlayerIds: string[]; votedPlayerIds: string[]; eliminatedPlayerId: string | null; whitePlayerId: string | null; result: GameResult | null;
}
export type ChatReaction = 'up' | 'down';
export interface ChatMessage { id: string; playerId: string; name: string; text: string; at: number; reactions: { up: number; down: number } }
export interface RoomSnapshot { social: SocialSnapshot; code: string; revision: number; hostId: string; players: PublicPlayer[]; settings: RoomSettings; game: PublicGame | null; chat: ChatMessage[]; completedGames: number; voiceGeneration: number; serverNow: number; resultsPending: boolean }
export interface PrivateGameState { playerId: string; inGame: boolean; word: string | null; voteTarget: string | null }
export interface PrivatePlayerState extends PrivateGameState { chatReactions: Record<string, ChatReaction> }
export interface VoiceCredentials { url: string; token: string; generation: number; canPublish: boolean }
const name = z.string().trim().min(1).max(24);
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room.create'), name, appearance: AppearanceSchema }),
  z.object({ type: z.literal('room.join'), code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/), name, appearance: AppearanceSchema }),
  z.object({ type: z.literal('room.resume') }), z.object({ type: z.literal('room.leave') }),
  z.object({ type: z.literal('profile.update'), name, appearance: AppearanceSchema }),
  z.object({ type: z.literal('player.ready'), ready: z.boolean() }),
  z.object({ type: z.literal('player.remove'), targetId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('settings.update'), settings: SettingsSchema }),
  z.object({ type: z.literal('game.start') }), z.object({ type: z.literal('game.next') }),
  z.object({ type: z.literal('game.describe'), text: z.string().trim().min(1).max(100) }),
  z.object({ type: z.literal('game.vote'), targetId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('game.guess'), word: z.string().trim().min(1).max(100) }),
  z.object({ type: z.literal('game.skipDiscussion') }),
  z.object({ type: z.literal('game.setVoteReady'), ready: z.boolean() }).strict(),
  z.object({ type: z.literal('chat.react'), messageId: z.string().min(1).max(100), reaction: z.enum(['up', 'down']).nullable() }).strict(),
  z.object({ type: z.literal('chat.send'), text: z.string().trim().min(1).max(400) }),
  z.object({ type: z.literal('player.emote'), kind: AnimationIdSchema, targetId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ type: z.literal('player.emote.stop'), instanceId: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.literal('player.attack'), kind: AttackKindSchema, targetId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ type: z.literal('player.interaction.preferences'), acceptsPhysical: z.boolean() }).strict(),
  z.object({ type: z.literal('player.interaction.invite'), kind: z.enum(['hug', 'carry']), targetId: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.literal('player.interaction.respond'), interactionId: z.string().min(1).max(100), accept: z.boolean() }).strict(),
  z.object({ type: z.literal('player.interaction.cancel'), interactionId: z.string().min(1).max(100) }).strict(),
]);
export type Command = z.infer<typeof CommandSchema>;
export const EnvelopeSchema = z.object({ id: z.string().min(8).max(100), command: CommandSchema, phaseId: z.string().max(100).optional(), socialGeneration: z.number().int().nonnegative().optional() }).strict();
export type CommandEnvelope = z.infer<typeof EnvelopeSchema>;
export type Ack = { ok: true; code?: string } | { ok: false; error: string };
export const MoveSchema = z.object({ x: z.number().finite().min(-1).max(1), z: z.number().finite().min(-1).max(1) }).strict();
export interface ClientEvents { command: (envelope: CommandEnvelope, ack: (result: Ack) => void) => void; move: (direction: z.infer<typeof MoveSchema>) => void }
export interface ServerEvents { snapshot: (state: RoomSnapshot) => void; private: (state: PrivatePlayerState) => void; poses: (positions: Record<string, Position>) => void; replaced: () => void; notice: (message: string) => void }
export function recommendedRoles(count: number) { const undercover = count <= 7 ? 1 : count <= 10 ? 2 : 3; const white = count >= 5 ? 1 : 0; return { civilian: count - undercover - white, undercover, white }; }
export function roleCounts(count: number, settings: RoomSettings) { return settings.automaticRoles ? recommendedRoles(count) : { civilian: count - settings.undercoverCount - settings.whiteCount, undercover: settings.undercoverCount, white: settings.whiteCount }; }
export function validComposition(count: number, settings: RoomSettings) { const roles = roleCounts(count, settings); return count >= 4 && count <= 12 && roles.civilian >= 2 && roles.undercover + roles.white >= 1; }
