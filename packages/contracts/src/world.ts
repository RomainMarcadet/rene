import type { Position } from './index.js';

/** Chez René: metres in the ground plane; render, server navigation and social LOS share these. */
export const SALON_BOUNDS = { x: 7, z: 5 } as const;
export const TABLE_BLOCKER = { x: 1.65, z: 1.15 } as const;
export const PLAYER_RADIUS = .35;
export interface WorldBox { id: string; x: number; z: number; halfX: number; halfZ: number; height: number }
export const WORLD_FURNITURE: readonly WorldBox[] = [
  { id: 'table', x: 0, z: 0, halfX: 1.3, halfZ: .8, height: .96 },
  { id: 'sofa', x: -4.8, z: -3.8, halfX: 1.7, halfZ: .7, height: 1.65 },
  { id: 'plant', x: -6.1, z: 3.7, halfX: .5, halfZ: .5, height: 2.6 },
  { id: 'lamp', x: 6.2, z: -3.9, halfX: .55, halfZ: .55, height: 3.2 },
];
export const WORLD_WALLS: readonly WorldBox[] = [
  { id: 'back', x: 0, z: -5.65, halfX: 7.7, halfZ: .12, height: 4.3 },
  { id: 'front', x: 0, z: 5.65, halfX: 7.7, halfZ: .12, height: 4.3 },
  { id: 'left', x: -7.65, z: 0, halfX: .12, halfZ: 5.65, height: 4.3 },
  { id: 'right', x: 7.65, z: 0, halfX: .12, halfZ: 5.65, height: 4.3 },
];
export const STAGE_ANCHOR = { x: 4.8, z: -2.5 } as const;
export function walkable(p: { x: number; z: number }) {
  return Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= SALON_BOUNDS.x && Math.abs(p.z) <= SALON_BOUNDS.z
    && !WORLD_FURNITURE.some(b => Math.abs(p.x - b.x) < b.halfX + PLAYER_RADIUS && Math.abs(p.z - b.z) < b.halfZ + PLAYER_RADIUS);
}
/** Slab intersection, including a grazing boundary. Used for swept movement and social line of sight. */
export function segmentIntersectsBox(a: { x: number; z: number }, b: { x: number; z: number }, box: WorldBox, padding = PLAYER_RADIUS) {
  let low = 0; let high = 1;
  for (const axis of ['x', 'z'] as const) {
    const start = a[axis] - box[axis]; const d = b[axis] - a[axis]; const extent = (axis === 'x' ? box.halfX : box.halfZ) + padding;
    if (Math.abs(d) < 1e-8) { if (Math.abs(start) > extent) return false; }
    else { const t1 = (-extent - start) / d; const t2 = (extent - start) / d; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); }
  }
  return high >= low && high >= 0 && low <= 1;
}
export function clearWorldPath(a: { x: number; z: number }, b: { x: number; z: number }) { return !WORLD_FURNITURE.some(box => segmentIntersectsBox(a, b, box)); }
/** Keep the twelve original radial spawn slots: all are clear in the new plan. */
export function spawnPoint(index: number): Position {
  const angle = index / 12 * Math.PI * 2;
  return { x: Math.cos(angle) * 4, z: Math.sin(angle) * 4, yaw: 0 };
}
