import { describe, expect, it } from 'vitest';
import { ANIMATIONS, ANIMATION_IDS, MACARENA_BEAT_MS as BEAT, MACARENA_MEASURE_MS as MEASURE, type AnimationId, type SocialPlayerState } from '@rene/contracts';
import { avatarPose, createPose } from './animation';
import { legLayout, createLegLayout } from './poses/legs';
import { MACARENA_STEPS } from './poses/macarena';
const state = (kind: AnimationId): SocialPlayerState => ({ acceptsPhysical: true, protectedUntil: 0, nextAttackAt: 0, animation: { kind, instanceId: 'visible-test', startedAt: 1000, endsAt: 1000 + ANIMATIONS[kind].durationMs, seed: 42 } });
const pose = (kind: AnimationId, t: number, reduced = false) => avatarPose({ time: 0, now: 1000 + t, moving: false, reduced, social: state(kind) });
describe('social choreography', () => {
  it.each(ANIMATION_IDS)('%s has finite poses on three morphologies and resets on interruption', kind => {
    const output = createPose(); const scratch = createPose();
    for (const reduced of [true, false]) for (const morphology of [{ width: .51, depth: .42, crown: .57 }, { width: .84, depth: .5, crown: .96 }, { width: .65, depth: .45, crown: .7 }]) {
      for (const t of [0, 180, ANIMATIONS[kind].durationMs / 2, ANIMATIONS[kind].durationMs - 1]) {
        avatarPose({ time: 1, now: 1000 + t, moving: false, reduced, social: state(kind), morphology }, output, scratch);
        expect(Object.values(output).filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
      }
      const cleared = avatarPose({ time: 1, now: 2000, moving: false, reduced, social: state(kind), phase: 'vote' }, output, scratch);
      expect(cleared.ik).toBe(false); expect(cleared.stars).toBe(false); expect(cleared.headForward).toBe(0);
    }
    expect(pose(kind, ANIMATIONS[kind].durationMs).state).toBe('idle');
  });
  it('translates the head and articulates knees instead of only sinking the body', () => {
    expect(pose('head_forward_back', 300).headForward).toBeGreaterThan(.4);
    const kneel = pose('kneel', 1000); expect(kneel.leftKnee).toBeGreaterThan(1.9); expect(kneel.leftHip).toBeLessThan(-1);
    expect(pose('arm_back_and_forth', 0).rz).not.toBe(pose('arm_back_and_forth', 200).rz);
  });
  it('retains elimination eyes but permits a results gesture ahead of automatic celebration/elimination', () => {
    const p = avatarPose({ time: 1, now: 1800, moving: false, reduced: false, dead: true, winner: true, phase: 'results', social: state('kneel') });
    expect(p.state).toBe('kneel'); expect(p.ik).toBe(true);
  });
  it('prioritizes physical reaction over voluntary poses and returns after the exact deadline', () => {
    const social = state('macarena_full');
    social.physical = { instanceId: 'physical', kind: 'stun', startedAt: 1000, stunEndsAt: 3500, endsAt: 4000, sourceYaw: 0 };
    expect(avatarPose({ time: 1, now: 1400, moving: true, reduced: false, social }).state).toBe('stunned_loop');
    expect(avatarPose({ time: 1, now: 3500, moving: true, reduced: false, social }).state).toBe('get_up');
    expect(avatarPose({ time: 1, now: 4000, moving: false, reduced: false, social }).state).toBe('macarena_full');
  });
  it('has fourteen independent Macarena primitives including visible palm flips', () => {
    expect(MACARENA_STEPS).toHaveLength(14);
    expect(pose('macarena_right_down', 700).rightPalm).toBe(Math.PI / 2);
    expect(pose('macarena_right_up', 700).rightPalm).toBe(-Math.PI / 2);
    const behind = pose('macarena_right_head', 700); expect(behind.rx).toBeGreaterThan(.8); expect(behind.rz).toBeLessThan(-.6);
    expect(pose('macarena_jump', 500).yaw).toBeLessThan(-.5);
  });
  it('keeps full-sequence arm transitions continuous at every beat and cycle', () => {
    for (let n = 1; n < 48; n++) {
      const before = pose('macarena_full', n * BEAT - .001); const after = pose('macarena_full', n * BEAT);
      for (const field of ['lx', 'ly', 'lz', 'rx', 'ry', 'rz', 'leftPalm', 'rightPalm', 'yaw', 'y', 'pelvisX', 'pelvisZ'] as const) expect(Math.abs(before[field] - after[field]), field + ' beat ' + n).toBeLessThan(.001);
    }
    expect(pose('macarena_full', MEASURE + 600).yaw).toBe(-Math.PI / 2);
  });
  it('uses the same reference time for a late joining dancer, with no local-clock dependency', () => {
    const a = state('macarena_full'); const b = structuredClone(a); b.animation!.instanceId = 'joined';
    const input = { now: 9700, time: 5, moving: false, reduced: false };
    expect(avatarPose({ ...input, social: a })).toEqual(avatarPose({ ...input, time: 800, social: b }));
    expect(pose('moonwalk', 400, true)).toEqual(pose('moonwalk', 900, true));
  });
});

describe('leg constraints and legacy clock', () => {
  it.each(['wave', 'dance', 'suspect'] as const)('synchronizes the preserved %s gesture with server time', kind => {
    const input = { now: 1900, moving: false, reduced: false, social: state(kind) };
    expect(avatarPose({ ...input, time: 1 })).toEqual(avatarPose({ ...input, time: 800 }));
  });
  it('reaches the impact pose at the authoritative impact delay', () => {
    expect(pose('punch', 180).rz).toBeGreaterThan(1.59); expect(pose('headbutt', 180).headForward).toBeGreaterThan(.6);
  });
  it('keeps kneeling knees low, feet behind them and upright soles above the floor', () => {
    const interrupted = legLayout(createPose(), 1, createLegLayout(), -.28);
    expect(-.28 + interrupted.hipY - .3).toBeCloseTo(.15, 8);
    const p = pose('kneel', 1000); const l = legLayout(p, 1, createLegLayout());
    expect(l.kneeY).toBeLessThan(.14); expect(l.kneeY).toBeGreaterThan(.08);
    const hip = p.rightHip; const knee = p.rightKnee;
    const y = l.bootY * Math.cos(knee) - l.bootZ * Math.sin(knee) - .18;
    const z = l.bootY * Math.sin(knee) + l.bootZ * Math.cos(knee);
    expect(y * Math.sin(hip) + z * Math.cos(hip)).toBeLessThan(l.kneeZ - .1);
    for (const kind of ['kneel', 'straddle', 'crouch_taunt', 'moonwalk', 'slip'] as const) for (const t of [100, 400, 700, 1000, 1800]) for (const side of [-1, 1]) {
      const p = pose(kind, t); const l = legLayout(p, side, createLegLayout()); const h = side > 0 ? p.rightHip : p.leftHip; const k = side > 0 ? p.rightKnee : p.leftKnee;
      const y = l.bootY * Math.cos(k) - l.bootZ * Math.sin(k) - .18; const z = l.bootY * Math.sin(k) + l.bootZ * Math.cos(k);
      expect(p.y + l.hipY + y * Math.cos(p.legSpread) * Math.cos(h) - z * Math.sin(h) - l.footHeight).toBeCloseTo(0, 8);
    }
  });
});
