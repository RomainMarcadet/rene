import { describe, expect, it } from 'vitest';
import { Vector3, Euler } from 'three';
import { avatarPose } from './animation';
const pose = (values: Partial<Parameters<typeof avatarPose>[0]> = {}) => avatarPose({ time: 1, now: 2000, moving: false, reduced: false, ...values });

describe('procedural avatar poses', () => {
  it('lifts the waving hand above the shoulder and outside the head silhouette', () => {
    const wave = pose({ emote: 'wave', until: 3500 });
    const hand = new Vector3(.1, -.65 * wave.rightScale, 0).applyEuler(new Euler(wave.rightX, 0, wave.rightZ)).add(new Vector3(.38, 1 + wave.rightLift, 0));
    expect(wave.state).toBe('waving'); expect(hand.y).toBeGreaterThan(2); expect(hand.x).toBeGreaterThan(1);
  });
  it('makes suspicion distinct through head turn, tilt and recoil', () => {
    const suspect = pose({ emote: 'suspect', until: 3500 });
    expect(suspect.state).toBe('suspect'); expect(Math.abs(suspect.headY)).toBeGreaterThan(.35);
    expect(suspect.headZ).toBeGreaterThan(.2); expect(suspect.z).toBeLessThan(-.15);
  });
  it('expires at the server-adjusted deadline and resets every affected axis', () => {
    expect(pose({ emote: 'suspect', until: 2000 })).toEqual(pose());
    expect(pose({ emote: 'wave', until: 1999, moving: true })).toEqual(pose({ moving: true }));
  });
  it('prioritizes elimination, preserves dance and keeps walking feet during a wave', () => {
    expect(pose({ dead: true, winner: true, emote: 'wave' }).state).toBe('eliminated');
    expect(pose({ emote: 'dance' }).rightZ).toBe(-.9);
    expect(pose({ moving: true, emote: 'wave' }).leftFoot).not.toBe(0);
    expect(pose({ winner: true }).state).toBe('celebrating');
  });
  it('uses recognizable static poses for reduced motion and returns to neutral', () => {
    const wave = pose({ emote: 'wave', reduced: true });
    expect(wave.rightZ).toBeGreaterThan(2); expect(wave.y).toBe(0); expect(wave.leftFoot).toBe(0);
    expect(pose({ emote: 'suspect', reduced: true }).headY).toBe(-.65);
    expect(pose({ reduced: true, emote: 'wave', until: 2000 }).rightZ).toBe(-.08);
  });
});
