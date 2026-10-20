import { WORLD_FURNITURE, type Phase, type RoomSnapshot } from '@rene/contracts';
export const TPS = { distance: 5.4, pitch: .35, minPitch: .12, maxPitch: .8, fov: 56, damping: 7, radius: .22 } as const;
export interface OrbitState { yaw: number; viewYaw: number; pitch: number; interrupted: string; overview: boolean }
export function cameraRelative(x: number, z: number, yaw: number) {
  const length = Math.max(1, Math.hypot(x, z)); const c = Math.cos(yaw); const s = Math.sin(yaw);
  return { x: (x * c + z * s) / length, z: (-x * s + z * c) / length };
}
export function shotKey(game: RoomSnapshot['game']) { return game ? `${game.id}:${game.phaseId}:${game.turnPlayerId ?? game.eliminatedPlayerId ?? game.whitePlayerId ?? ''}` : 'lobby'; }
export function phaseShot(phase: Phase | undefined, elapsed: number, interrupted: boolean, reduced: boolean): 'local' | 'speaker' | 'elimination' | 'group' {
  if (phase === 'vote' || phase === 'tiebreak') return 'group';
  if (interrupted) return 'local';
  if (phase === 'results') return 'group';
  if (reduced) return 'local';
  if (phase === 'description' && elapsed < 1400) return 'speaker';
  if (phase === 'elimination' && elapsed < 2200) return 'elimination';
  return 'local';
}
export interface Point3 { x: number; y: number; z: number }
/** Sphere approximation against expanded furniture. Walls use a camera-side cutaway,
 * avoiding a forced close-up when the avatar walks along the room boundary. */
export function cameraDistance(origin: Point3, direction: Point3, desired: number, hiddenFurniture?: string[]) {
  let distance = desired;
  for (const b of WORLD_FURNITURE) {
    let low = 0; let high = desired;
    for (const axis of ['x', 'y', 'z'] as const) {
      const center = axis === 'y' ? b.height / 2 : b[axis];
      const extent = (axis === 'x' ? b.halfX : axis === 'z' ? b.halfZ : b.height / 2) + TPS.radius;
      const start = origin[axis] - center; const d = direction[axis];
      if (Math.abs(d) < 1e-8) { if (Math.abs(start) > extent) { high = -1; break; } }
      else { const a = (-extent - start) / d; const c = (extent - start) / d; low = Math.max(low, Math.min(a, c)); high = Math.min(high, Math.max(a, c)); }
    }
    if (high >= low && low >= 0) {
      if (hiddenFurniture && low < 2.8) hiddenFurniture.push(b.id);
      else distance = Math.min(distance, Math.max(.45, low - .06));
    }
  }
  return distance;
}
