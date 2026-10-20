import { describe, expect, it } from 'vitest';
import { clearWorldPath, spawnPoint, walkable, WORLD_FURNITURE, voteSeat } from './index';
describe('Chez René authoritative layout', () => {
  it('keeps twelve spawn slots and all vote compositions accessible', () => {
    for (let i = 0; i < 12; i++) expect(walkable(spawnPoint(i))).toBe(true);
    for (let n = 4; n <= 12; n++) for (let i = 0; i < n; i++) expect(walkable(voteSeat(i, n))).toBe(true);
  });
  it('blocks each footprint and swept paths through it', () => {
    for (const b of WORLD_FURNITURE) {
      expect(walkable(b)).toBe(false);
      expect(clearWorldPath({ x: b.x - b.halfX - 1, z: b.z }, { x: b.x + b.halfX + 1, z: b.z })).toBe(false);
    }
    expect(walkable({ x: 7.01, z: 0 })).toBe(false); expect(walkable({ x: NaN, z: 0 })).toBe(false);
    expect(clearWorldPath({ x: 4, z: 0 }, { x: 4, z: 2 })).toBe(true);
  });
  it('retains connected routes throughout the walkable floor', () => {
    const seen = new Set<string>(); const queue = [[4, 0]];
    while (queue.length) {
      const [x, z] = queue.shift()!; const key = x + ':' + z;
      if (seen.has(key) || !walkable({ x, z })) continue; seen.add(key);
      for (const [dx, dz] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) if (clearWorldPath({ x, z }, { x: x + dx, z: z + dz })) queue.push([x + dx, z + dz]);
    }
    for (let x = -7; x <= 7; x += .5) for (let z = -5; z <= 5; z += .5) if (walkable({ x, z })) expect(seen.has(x + ':' + z)).toBe(true);
  });
});
