import { z } from 'zod';
import type { Phase, Position } from './index.js';

export const SOCIAL_COMBAT_CONFIG = {
  attackCooldownMs: 800, attackDurationMs: 500, impactDelayMs: 180, hitReactionMs: 220,
  hitWindowMs: 8000, hitsToStun: 5, stunnedMs: 2500, recoveryMs: 500,
  postRecoveryProtectionMs: 3000, range: 1.85, facingCosine: .5, fallMs: 350,
  invitationMs: 8000, interactionRange: 2.1, consentRange: 1.45,
} as const;
export const MACARENA_BEAT_MS = 600;
export const MACARENA_MEASURE_MS = MACARENA_BEAT_MS * 16;
export const ANIMATION_IDS = [
  'wave', 'dance', 'suspect', 'play_dead', 'straddle', 'kneel', 'arm_back_and_forth', 'head_forward_back', 'crouch_taunt',
  'punch', 'slap', 'headbutt', 'shove', 'hit_reaction', 'stun_fall', 'stunned_loop', 'get_up',
  'facepalm', 'sarcastic_clap', 'laugh', 'point', 'bow', 'dab', 'moonwalk', 'failed_breakdance', 'faint', 'sleep', 'slip',
  'macarena_right_down', 'macarena_left_down', 'macarena_right_up', 'macarena_left_up',
  'macarena_right_shoulder', 'macarena_left_shoulder', 'macarena_right_head', 'macarena_left_head',
  'macarena_right_cross_hip', 'macarena_left_cross_hip', 'macarena_right_back_hip', 'macarena_left_back_hip',
  'macarena_hips', 'macarena_jump', 'macarena_full', 'hug', 'carry',
] as const;
export type AnimationId = typeof ANIMATION_IDS[number];
export const AnimationIdSchema = z.enum(ANIMATION_IDS);
export const AttackKindSchema = z.enum(['punch', 'slap', 'headbutt', 'shove']);
export type AttackKind = z.infer<typeof AttackKindSchema>;
export type AnimationCategory = 'Gestes' | 'Postures' | 'Danses' | 'Macarena' | 'Interactions';
export interface AnimationDefinition {
  label: string; category: AnimationCategory; durationMs: number; loop: boolean;
  bodyParts: readonly ('head' | 'arms' | 'hands' | 'pelvis' | 'legs')[];
  moving: boolean; trigger: 'individual' | 'attack' | 'groundTarget' | 'consent' | 'system';
  interrupts: readonly ('vote' | 'context' | 'impact' | 'stop' | 'movement' | 'departure')[];
  reducedMotion: 'static-pose' | 'gentle-transition';
}
const definition = (label: string, category: AnimationCategory, durationMs: number, loop = false, moving = false, trigger: AnimationDefinition['trigger'] = 'individual', bodyParts: AnimationDefinition['bodyParts'] = ['head', 'arms', 'hands', 'pelvis', 'legs']): AnimationDefinition => ({ label, category, durationMs, loop, moving, trigger, bodyParts, interrupts: ['vote', 'context', 'impact', 'stop', 'departure', ...(!moving && trigger !== 'consent' ? ['movement' as const] : [])], reducedMotion: loop ? 'static-pose' : 'gentle-transition' });
export const ANIMATIONS: Record<AnimationId, AnimationDefinition> = {
  wave: definition('Salut', 'Gestes', 3500, false, true), dance: definition('Danse', 'Danses', 2500, false, true), suspect: definition('Soupçon', 'Gestes', 3500, false, true),
  play_dead: definition('Faire le mort', 'Postures', 7000), straddle: definition('À califourchon', 'Postures', 10000, true), kneel: definition('À genoux', 'Postures', 6000),
  arm_back_and_forth: definition('Va-et-vient du bras', 'Gestes', 8000, true, false, 'individual', ['arms', 'hands']),
  head_forward_back: definition('Tête avant-arrière', 'Gestes', 8000, true, false, 'individual', ['head']),
  crouch_taunt: definition('T-bag cartoon', 'Interactions', 3500, true, false, 'groundTarget'),
  punch: definition('Coup de poing', 'Interactions', SOCIAL_COMBAT_CONFIG.attackDurationMs, false, false, 'attack'), slap: definition('Gifle théâtrale', 'Interactions', SOCIAL_COMBAT_CONFIG.attackDurationMs, false, false, 'attack'),
  headbutt: definition('Coup de tête', 'Interactions', SOCIAL_COMBAT_CONFIG.attackDurationMs, false, false, 'attack'), shove: definition('Poussette', 'Interactions', SOCIAL_COMBAT_CONFIG.attackDurationMs, false, false, 'attack'),
  hit_reaction: definition('Ouille !', 'Interactions', SOCIAL_COMBAT_CONFIG.hitReactionMs, false, true, 'system'), stun_fall: definition('Perd l’équilibre', 'Interactions', SOCIAL_COMBAT_CONFIG.fallMs, false, false, 'system'),
  stunned_loop: definition('À terre', 'Interactions', SOCIAL_COMBAT_CONFIG.stunnedMs - SOCIAL_COMBAT_CONFIG.fallMs, true, false, 'system'), get_up: definition('Reprend ses esprits', 'Interactions', SOCIAL_COMBAT_CONFIG.recoveryMs, false, false, 'system'),
  facepalm: definition('Mais enfin…', 'Gestes', 2500), sarcastic_clap: definition('Bravo, vraiment', 'Gestes', 4000, true), laugh: definition('Plié de rire', 'Gestes', 3500, true),
  point: definition('C’est lui !', 'Gestes', 2500), bow: definition('Révérence', 'Gestes', 3000), dab: definition('Dab', 'Danses', 2500),
  moonwalk: definition('Moonwalk sur place', 'Danses', 7000, true), failed_breakdance: definition('Breakdance raté', 'Danses', 6500),
  faint: definition('Malaise dramatique', 'Postures', 5500), sleep: definition('Dodo debout', 'Postures', 6500), slip: definition('Glissade assise', 'Postures', 4500),
  macarena_right_down: definition('1 · Bras droit devant', 'Macarena', 2000), macarena_left_down: definition('2 · Bras gauche devant', 'Macarena', 2000),
  macarena_right_up: definition('3 · Paume droite vers le haut', 'Macarena', 2000), macarena_left_up: definition('4 · Paume gauche vers le haut', 'Macarena', 2000),
  macarena_right_shoulder: definition('5 · Main droite, épaule gauche', 'Macarena', 2000), macarena_left_shoulder: definition('6 · Main gauche, épaule droite', 'Macarena', 2000),
  macarena_right_head: definition('7 · Main droite derrière la tête', 'Macarena', 2000), macarena_left_head: definition('8 · Main gauche derrière la tête', 'Macarena', 2000),
  macarena_right_cross_hip: definition('9 · Main droite, hanche gauche', 'Macarena', 2000), macarena_left_cross_hip: definition('10 · Main gauche, hanche droite', 'Macarena', 2000),
  macarena_right_back_hip: definition('11 · Main droite derrière le bassin', 'Macarena', 2000), macarena_left_back_hip: definition('12 · Main gauche derrière le bassin', 'Macarena', 2000),
  macarena_hips: definition('13–15 · Tour de bassin', 'Macarena', 3000, true), macarena_jump: definition('16 · Saut, quart de tour', 'Macarena', 1600),
  macarena_full: definition('Macarena complète · 100 BPM', 'Macarena', MACARENA_MEASURE_MS * 3, true),
  hug: definition('Proposer un câlin', 'Interactions', 3500, false, false, 'consent'), carry: definition('Proposer un porté ridicule', 'Interactions', 4500, false, false, 'consent'),
};
export interface AnimationInstance { instanceId: string; kind: AnimationId; startedAt: number; endsAt: number; targetId?: string; sharedInteractionId?: string; seed: number }
export interface PhysicalInstance { instanceId: string; kind: 'hit_reaction' | 'stun'; startedAt: number; endsAt: number; stunEndsAt: number; sourceYaw: number }
export interface SocialPlayerState { acceptsPhysical: boolean; animation?: AnimationInstance; physical?: PhysicalInstance; protectedUntil: number; nextAttackAt: number }
export interface SharedInteraction { id: string; kind: 'hug' | 'carry'; fromId: string; toId: string; state: 'invited' | 'active'; expiresAt: number; startedAt: number | null }
export interface SocialSnapshot { generation: number; players: Record<string, SocialPlayerState>; interactions: SharedInteraction[] }
export function socialPhaseAllowed(phase?: Phase) { return phase !== 'vote' && phase !== 'tiebreak'; }
export function socialParticipantAllowed(player: { connected: boolean; alive: boolean; waiting: boolean }, phase?: Phase) { return player.connected && socialPhaseAllowed(phase) && (!phase || phase === 'results' || (player.alive && !player.waiting)); }
export function physicalStage(physical: PhysicalInstance | undefined, now: number): 'normal' | 'hit_reaction' | 'stun_fall' | 'stunned_loop' | 'get_up' {
  if (!physical || now >= physical.endsAt) return 'normal';
  if (physical.kind === 'hit_reaction') return 'hit_reaction';
  return now < physical.startedAt + SOCIAL_COMBAT_CONFIG.fallMs ? 'stun_fall' : now < physical.stunEndsAt ? 'stunned_loop' : 'get_up';
}
export function socialMovementAllowed(state: SocialPlayerState | undefined, now: number) { return !state?.physical || state.physical.kind !== 'stun' || now >= state.physical.endsAt; }
export const isSocialCommand = (type: string) => type === 'player.emote' || type === 'player.emote.stop' || type === 'player.attack' || type.startsWith('player.interaction.');

export const SALON_BOUNDS = { x: 7, z: 5 } as const;
export const TABLE_BLOCKER = { x: 1.65, z: 1.15 } as const;
/** Segment / inflated table intersection, using the same footprint as movement. */
export function clearSocialPath(a: Position, b: Position) {
  let low = 0; let high = 1;
  for (const axis of ['x', 'z'] as const) {
    const d = b[axis] - a[axis]; const extent = TABLE_BLOCKER[axis];
    if (Math.abs(d) < 1e-8) { if (Math.abs(a[axis]) > extent) return true; }
    else { const t1 = (-extent - a[axis]) / d; const t2 = (extent - a[axis]) / d; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); }
  }
  return high < low || high < 0 || low > 1;
}
export function withinSocialReach(a: Position, b: Position, range: number = SOCIAL_COMBAT_CONFIG.range, facing = true) {
  const dx = b.x - a.x; const dz = b.z - a.z; const distance = Math.hypot(dx, dz);
  return distance <= range && clearSocialPath(a, b) && (!facing || distance < .01 || (dx * Math.sin(a.yaw) + dz * Math.cos(a.yaw)) / distance >= SOCIAL_COMBAT_CONFIG.facingCosine);
}
