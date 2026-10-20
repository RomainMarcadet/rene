import { describe, expect, it } from 'vitest';
import { AppearanceSchema, DEFAULT_APPEARANCE, PERSONALITIES, type Personality } from '@rene/contracts';
import { avatarPose } from '../animation';
import { characterSeed, personalityPose } from './personality';
function sample(personality: Personality, reduced = false, state?: string) {
  const p = avatarPose({ time: 1, now: 1000, moving: !state, reduced }); if (state) p.state = state;
  const face = { blink: 1, talk: 0, look: 0 }; personalityPose(p, 1, personality, 2, reduced, true, .8, face); return { p, face };
}
describe('public cosmetic personality layer', () => {
  it('defaults historical profiles and serializes each personality without changing visual choices', () => {
    const { personality: _old, ...legacy } = DEFAULT_APPEARANCE;
    expect(AppearanceSchema.parse(legacy)).toEqual(DEFAULT_APPEARANCE);
    for (const personality of Object.keys(PERSONALITIES)) {
      const a = { ...DEFAULT_APPEARANCE, personality }; expect(AppearanceSchema.parse(JSON.parse(JSON.stringify(a)))).toEqual(a);
    }
    expect(AppearanceSchema.safeParse({ ...legacy, personality: 'undercover' }).success).toBe(false);
  });
  it('gives four visually different walks and deterministic independent timing', () => {
    const poses = Object.keys(PERSONALITIES).map(p => JSON.stringify(sample(p as Personality).p)); expect(new Set(poses).size).toBe(4);
    expect(characterSeed('a')).toBe(characterSeed('a')); expect(characterSeed('a')).not.toBe(characterSeed('b'));
  });
  it('never overrides physical, ground or voluntary poses; never invents voice activity', () => {
    for (const state of ['stunned_loop', 'get_up', 'play_dead', 'punch', 'kneel', 'macarena_full', 'eliminated']) {
      const p = avatarPose({ time: 1, now: 1000, moving: false, reduced: false }); p.state = state; const before = { ...p }; const f = { blink: 1, talk: 0, look: 0 };
      personalityPose(p, 1, 'nervous', 2, false, true, 1, f); expect(p).toEqual(before);
      expect(f).toMatchObject({ blink: 1, look: 0 }); expect(f.talk).toBeGreaterThan(0);
      personalityPose(p, 1, 'nervous', 2, false, false, 1, f); expect(p).toEqual(before); expect(f.talk).toBe(0);
    }
    const p = sample('nervous', true); expect(p.face).toEqual({ blink: 1, talk: .25, look: 0 });
  });
  it('keeps all sampled transforms finite and eyes recognizable across twelve avatars', () => {
    for (const personality of Object.keys(PERSONALITIES) as Personality[]) for (let i = 0; i < 120; i++) {
      const p = avatarPose({ time: i / 10, now: 1000, moving: true, reduced: false }); const face = { blink: 1, talk: 0, look: 0 };
      personalityPose(p, i / 10, personality, i % 12, false, false, 0, face);
      for (const v of Object.values(p)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      expect(face.blink).toBeGreaterThanOrEqual(.09); expect(face.talk).toBe(0);
    }
  });
  it('preserves the voluntary suspicion head turn while a neighbouring speaker attracts attention', () => {
    const p = avatarPose({ time: 1, now: 2000, moving: false, reduced: false, emote: 'suspect', until: 3500 });
    const turn = p.headY; const face = { blink: 1, talk: 0, look: 0 };
    personalityPose(p, 1, 'nervous', 2, false, true, .45, face);
    expect(p.headY).toBe(turn); expect(face.talk).toBeGreaterThan(0);
  });
});
