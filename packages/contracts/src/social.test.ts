import { describe, expect, it } from 'vitest';
import { CommandSchema, EnvelopeSchema, ANIMATIONS, ANIMATION_IDS, clearSocialPath, withinSocialReach, socialParticipantAllowed } from './index.js';
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
