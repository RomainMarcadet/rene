import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPoses, getPose, resetPoses, usePoses } from './poses';

afterEach(() => resetPoses());

describe('transient movement', () => {
  it('updates only moving identities without mutating the authoritative snapshot', () => {
    const first = { id: 'first', position: { x: 0, z: 4, yaw: 0 } };
    const second = { id: 'second', position: { x: 4, z: 0, yaw: 1 } };
    resetPoses([first, second]);
    const firstPosition = getPose('first', first.position);
    const secondPosition = getPose('second', second.position);
    applyPoses({ first: { x: 1, z: 4, yaw: 0.5 } });
    expect(getPose('first', first.position)).toEqual({ x: 1, z: 4, yaw: 0.5 });
    expect(getPose('second', second.position)).toBe(secondPosition);
    expect(first.position).toBe(firstPosition);
    expect(first.position).toEqual({ x: 0, z: 4, yaw: 0 });
  });

  it('ignores duplicate, absent and stale room packets without notifying subscribers', () => {
    const player = { id: 'active', position: { x: 0, z: 4, yaw: 0 } };
    resetPoses([player]);
    const listener = vi.fn(); const unsubscribe = usePoses.subscribe(listener);
    applyPoses({ active: { ...player.position }, departed: { x: 1, z: 1, yaw: 1 } });
    resetPoses([{ ...player, position: { ...player.position } }]);
    expect(listener).not.toHaveBeenCalled();
    expect(Object.keys(usePoses.getState().positions)).toEqual(['active']);
    unsubscribe();
  });

  it('resets to server placement on phase change and discards positions on leaving', () => {
    const player = { id: 'active', position: { x: 0, z: 4, yaw: 0 } };
    resetPoses([player]);
    applyPoses({ active: { x: 6, z: 4, yaw: 1 } });
    const seat = { x: -2, z: -2, yaw: 2 };
    resetPoses([{ id: player.id, position: seat }]);
    expect(getPose(player.id, player.position)).toBe(seat);
    resetPoses();
    applyPoses({ active: { x: 6, z: 4, yaw: 1 } });
    expect(usePoses.getState().positions).toEqual({});
    expect(getPose(player.id, player.position)).toBe(player.position);
  });
});
