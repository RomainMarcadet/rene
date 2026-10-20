import { describe, expect, it } from 'vitest';
import { cameraDistance, cameraRelative, phaseShot, shotKey } from './math';
import type { RoomSnapshot } from '@rene/contracts';
import { nextResolution } from './ResolutionBudget';
describe('TPS and camera direction', () => {
  it('maps all controls through the same horizontal orbit without diagonal speedup', () => {
    expect(cameraRelative(0, -1, 0)).toEqual({ x: 0, z: -1 });
    const front = cameraRelative(0, -1, Math.PI / 2); expect(front.x).toBeCloseTo(-1); expect(front.z).toBeCloseTo(0);
    expect(Math.hypot(...Object.values(cameraRelative(1, 1, 1)))).toBeCloseTo(1);
    expect(Math.hypot(...Object.values(cameraRelative(.3, 0, 0)))).toBeCloseTo(.3);
  });
  it('retracts at furniture and restores open distance without mutating the ground anchor', () => {
    const origin = { x: 0, y: .5, z: 3 }; const before = { ...origin };
    expect(cameraDistance(origin, { x: 0, y: 0, z: -1 }, 5)).toBeLessThan(2);
    expect(cameraDistance({ x: 4, y: 2, z: 0 }, { x: 0, y: .3, z: .95 }, 4)).toBe(4);
    expect(origin).toEqual(before);
  });
  it('uses a temporary cutaway when furniture would force a close-up and keeps the list reusable', () => {
    const hidden: string[] = [];
    expect(cameraDistance({ x: 0, y: .5, z: 3 }, { x: 0, y: 0, z: -1 }, 5, hidden)).toBe(5);
    expect(hidden).toEqual(['table']); hidden.length = 0;
    expect(cameraDistance({ x: 4, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }, 4, hidden)).toBe(4); expect(hidden).toEqual([]);
  });
  it('reduces only slow rendering within a fixed floor and leaves fast frames unchanged', () => {
    expect(nextResolution(1, 1 / 60)).toBe(1); expect(nextResolution(1, 1 / 20)).toBe(.85);
    expect(nextResolution(.85, 1 / 20)).toBe(.7); expect(nextResolution(.7, 1 / 10)).toBe(.7);
  });
  it('preserves collective voting and makes short shots interruptible', () => {
    for (const p of ['vote', 'tiebreak'] as const) expect(phaseShot(p, 0, true, true)).toBe('group');
    expect(phaseShot('results', 0, true, false)).toBe('local'); expect(phaseShot('results', 0, false, true)).toBe('group');
    expect(phaseShot('description', 0, false, false)).toBe('speaker');
    expect(phaseShot('description', 1400, false, false)).toBe('local');
    expect(phaseShot('elimination', 0, true, false)).toBe('local');
    expect(phaseShot('description', 0, false, true)).toBe('local');
    expect(phaseShot('whiteGuess', 0, false, false)).toBe('local');
  });
  it('ignores snapshots but observes phase and speaker changes', () => {
    const game = { id: 'game', phaseId: 'phase', turnPlayerId: 'a' } as RoomSnapshot['game'];
    expect(shotKey(game)).toBe(shotKey({ ...game!, descriptions: [] }));
    expect(shotKey(game)).not.toBe(shotKey({ ...game!, turnPlayerId: 'b' }));
  });
});
