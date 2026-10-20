import { describe, expect, it } from 'vitest';
import { CommandSchema, EnvelopeSchema, ANIMATIONS, ANIMATION_IDS, clearSocialPath, withinSocialReach, socialParticipantAllowed, isGrounded, type SocialPlayerState } from './index.js';
describe('social wire contracts', () => {
  it('rejects client-declared identities, impacts, hit counts, durations and positions', () => {
    const attack = { type: 'player.attack', kind: 'punch', targetId: 'neighbor' };
    expect(CommandSchema.safeParse(attack).success).toBe(true);
    for (const field of ['playerId', 'actorId', 'hit', 'hits', 'duration', 'stunnedMs', 'position', 'seed']) expect(CommandSchema.safeParse({ ...attack, [field]: 10 }).success).toBe(false);
    expect(EnvelopeSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', command: attack, socialGeneration: -1 }).success).toBe(false);
    expect(EnvelopeSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', command: attack, socialGeneration: 3 }).success).toBe(true);
    expect(CommandSchema.safeParse({ type: 'player.emote.stop' }).success).toBe(false);
  });
  it('has unique IDs, five categories, bounded loops and explicit interruption/reduced-motion policies', () => {
    expect(new Set(ANIMATION_IDS).size).toBe(ANIMATION_IDS.length);
    expect(new Set(Object.values(ANIMATIONS).map(a => a.category)).size).toBe(5);
    for (const a of Object.values(ANIMATIONS)) { expect(a.bodyParts.length).toBeGreaterThan(0); expect(a.durationMs).toBeLessThanOrEqual(30000); expect(a.interrupts).toContain('context'); expect(a.reducedMotion).toBeTruthy(); }
  });
  it('uses the salon collision footprint, inclusive range and a forward cone', () => {
    const a = { x: 4, z: 0, yaw: 0 };
    expect(withinSocialReach(a, { ...a, z: 1.85 })).toBe(true);
    expect(withinSocialReach(a, { ...a, z: 1.85001 })).toBe(false);
    expect(withinSocialReach(a, { ...a, z: -1 })).toBe(false);
    expect(withinSocialReach({ x: 1.7, z: 1, yaw: -Math.PI / 4 }, { x: 1.5, z: 1.2, yaw: 0 })).toBe(false);
    expect(clearSocialPath({ x: -1.7, z: 0, yaw: 0 }, { x: 1.7, z: 0, yaw: 0 })).toBe(false);
    expect(clearSocialPath({ x: 4, z: 0, yaw: 0 }, { x: 4, z: 1, yaw: 0 })).toBe(true);
  });
  it('separates phase permissions from presence and business elimination', () => {
    const alive = { connected: true, alive: true, waiting: false };
    expect(socialParticipantAllowed(alive, 'whiteGuess')).toBe(true);
    expect(socialParticipantAllowed(alive, 'tiebreak')).toBe(false);
    expect(socialParticipantAllowed({ ...alive, alive: false }, 'description')).toBe(false);
    expect(socialParticipantAllowed({ ...alive, alive: false }, 'results')).toBe(true);
    expect(socialParticipantAllowed({ ...alive, waiting: true }, 'results')).toBe(true);
    expect(socialParticipantAllowed({ ...alive, connected: false })).toBe(false);
  });
});

describe('visible ground-target posture', () => {
  const alive = { alive: true, waiting: false };
  const eliminated = { alive: false, waiting: false };
  const state = (): SocialPlayerState => ({ acceptsPhysical: true, protectedUntil: 0, nextAttackAt: 0 });
  it('limits play-dead eligibility to its stable hold, including for an eliminated participant', () => {
    const social = state(); social.animation = { instanceId: 'floor', kind: 'play_dead', startedAt: 1000, endsAt: 8000, seed: 0 };
    for (const player of [alive, eliminated]) {
      for (const [now, grounded] of [[1000, false], [1499, false], [1500, true], [7499, true], [7500, false], [7999, false]] as const) {
        expect(isGrounded(player, social, now, 'results')).toBe(grounded);
      }
    }
    expect(isGrounded(alive, social, 8000, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 8000, 'results')).toBe(true);
  });
  it.each(['dance', 'wave', 'kneel', 'macarena_full', 'hug', 'carry'] as const)('%s overrides the eliminated resting pose only while active', kind => {
    const social = state(); social.animation = { instanceId: 'upright', kind, startedAt: 1000, endsAt: 3500, seed: 0 };
    expect(isGrounded(eliminated, social, 999, 'results')).toBe(true);
    expect(isGrounded(eliminated, social, 1000, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 3499, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 3500, 'results')).toBe(true);
  });
  it('prioritizes physical reactions and recovery over a ground posture without changing identity', () => {
    const social = state(); social.animation = { instanceId: 'floor', kind: 'play_dead', startedAt: 0, endsAt: 7000, seed: 0 };
    social.physical = { instanceId: 'stun', kind: 'stun', startedAt: 1000, stunEndsAt: 3500, endsAt: 4000, sourceYaw: 0 };
    expect(isGrounded(eliminated, social, 1000, 'results')).toBe(true);
    expect(isGrounded(eliminated, social, 3499, 'results')).toBe(true);
    expect(isGrounded(eliminated, social, 3500, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 3999, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 4000, 'results')).toBe(true);
    social.physical = { ...social.physical, kind: 'hit_reaction', endsAt: 1220 };
    expect(isGrounded(eliminated, social, 999, 'results')).toBe(true);
    expect(isGrounded(eliminated, social, 1000, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 1219, 'results')).toBe(false);
    expect(isGrounded(eliminated, social, 1220, 'results')).toBe(true);
  });
  it('keeps lobby and spectators distinct and ignores interrupted social poses during voting', () => {
    const social = state();
    expect(isGrounded(eliminated, social, 2000)).toBe(false);
    expect(isGrounded({ alive: false, waiting: true }, social, 2000, 'results')).toBe(false);
    social.animation = { instanceId: 'dance', kind: 'dance', startedAt: 1000, endsAt: 3500, seed: 0 };
    for (const phase of ['vote', 'tiebreak'] as const) expect(isGrounded(eliminated, social, 2000, phase)).toBe(true);
  });
});
