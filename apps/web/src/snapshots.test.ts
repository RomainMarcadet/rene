import { describe, it, expect } from 'vitest';
import { DEFAULT_APPEARANCE, type PublicPlayer } from '@rene/contracts';
import { reuseAppearances } from './snapshots';
const player = (): PublicPlayer => ({ id: 'test-player', name: 'Fiction', appearance: { ...DEFAULT_APPEARANCE }, position: { x: 4, z: 0, yaw: 0 }, alive: true, waiting: false, connected: true, ready: false, score: 0 });
describe('appearance identity in snapshots', () => {
  it('reuses unchanged appearances while applying elimination, scores and presence', () => {
    const old = player(); const incoming = { ...player(), alive: false, connected: false, score: 6 };
    const result = reuseAppearances([incoming], [old])[0];
    expect(result.appearance).toBe(old.appearance); expect(result.alive).toBe(false); expect(result.connected).toBe(false); expect(result.score).toBe(6);
  });
  it('accepts every genuine personalization change', () => {
    const old = player(); const incoming = player(); incoming.appearance.hair = old.appearance.hair === 'buns' ? 'none' : 'buns';
    expect(reuseAppearances([incoming], [old])[0].appearance).toBe(incoming.appearance);
  });
  it('never carries a different player’s appearance into a new arrival', () => {
    const old = player(); const incoming = { ...player(), id: 'new-player' };
    expect(reuseAppearances([incoming], [old])[0]).toBe(incoming);
  });
});
