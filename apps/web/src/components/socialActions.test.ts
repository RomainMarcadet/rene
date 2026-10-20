import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS, type PublicPlayer, type RoomSnapshot } from '@rene/contracts';
import { socialShortcut } from '../keyboard';
import { animationUnavailable, nearbyPlayers, type PositionReader } from './socialActions';

function fixture() {
  const players: PublicPlayer[] = ['alice', 'bob', 'camille'].map((id, i) => ({ id, name: id, appearance: DEFAULT_APPEARANCE, connected: true, ready: false, position: { x: 4, z: i, yaw: 0 }, alive: true, waiting: false, score: 0 }));
  const room: RoomSnapshot = { code: 'ABCDEF', revision: 1, hostId: 'alice', players, settings: DEFAULT_SETTINGS, game: null, chat: [], completedGames: 0, voiceGeneration: 0, serverNow: 1000, resultsPending: false, social: { generation: 1, players: Object.fromEntries(players.map(p => [p.id, { acceptsPhysical: true, nextAttackAt: 0, protectedUntil: 0 }])), interactions: [] } };
  return { room, actor: players[0], target: players[1] };
}

describe('direct social controls', () => {
  it('uses current motion for nearest selection, range and facing instead of an old room snapshot', () => {
    const { room, actor, target } = fixture();
    target.position = { x: -5, z: -5, yaw: 0 };
    expect(nearbyPlayers(room, actor)[0].id).toBe('camille');
    expect(animationUnavailable(room, actor, 'hug', target, 1000)).toMatch(/Rapprochez/);
    const live: PositionReader = (id, fallback) => id === target.id ? { x: 4, z: 1, yaw: 0 } : fallback;
    expect(nearbyPlayers(room, actor, live)[0].id).toBe('bob');
    expect(animationUnavailable(room, actor, 'hug', target, 1000, live)).toBeNull();
    expect(animationUnavailable(room, actor, 'punch', target, 1000, live)).toBeNull();
    actor.position.yaw = Math.PI;
    expect(animationUnavailable(room, actor, 'punch', target, 1000, live)).toMatch(/face/);
  });
  it('preserves opt-out, both participants consent availability, protection and cooldowns', () => {
    const { room, actor, target } = fixture();
    room.social.players[target.id].acceptsPhysical = false;
    expect(animationUnavailable(room, actor, 'hug', target, 1000)).toMatch(/désactivé/);
    room.social.players[target.id].acceptsPhysical = true;
    room.social.players[target.id].protectedUntil = 2000;
    expect(animationUnavailable(room, actor, 'punch', target, 1999)).toMatch(/protégé/);
    expect(animationUnavailable(room, actor, 'punch', target, 2000)).toBeNull();
    room.social.players[actor.id].nextAttackAt = 2100;
    expect(animationUnavailable(room, actor, 'punch', undefined, 2000)).toMatch(/souffle/);
    room.social.interactions.push({ id: 'other-invite', kind: 'hug', fromId: target.id, toId: 'camille', state: 'invited', expiresAt: 9000, startedAt: null });
    expect(animationUnavailable(room, actor, 'hug', target, 2000)).toMatch(/en cours/);
  });
  it('updates ground targeting on time alone and keeps individual gestures independent of a target', () => {
    const { room, actor, target } = fixture();
    room.social.players[target.id].animation = { kind: 'play_dead', instanceId: 'ground', startedAt: 1000, endsAt: 8000, seed: 0 };
    expect(animationUnavailable(room, actor, 'crouch_taunt', target, 1499)).toMatch(/au sol/);
    expect(animationUnavailable(room, actor, 'crouch_taunt', target, 1500)).toBeNull();
    expect(animationUnavailable(room, actor, 'crouch_taunt', target, 7500)).toMatch(/au sol/);
    room.social.players[actor.id].acceptsPhysical = false;
    expect(animationUnavailable(room, actor, 'wave', undefined, 1500)).toBeNull();
    expect(animationUnavailable(room, actor, 'punch', undefined, 1500)).toMatch(/Activez/);
    actor.waiting = true;
    room.game = { id: 'game', phase: 'description' } as RoomSnapshot['game'];
    expect(animationUnavailable(room, actor, 'wave', undefined, 1500)).toMatch(/spectateur/);
  });
  it('never selects disconnected players or a neighbor through the table', () => {
    const { room, actor, target } = fixture();
    room.players[2].connected = false;
    actor.position = { x: 0, z: -1.2, yaw: 0 }; target.position = { x: 0, z: 1.2, yaw: 0 };
    expect(nearbyPlayers(room, actor)).toHaveLength(0);
    expect(animationUnavailable(room, actor, 'hug', target, 1000)).toMatch(/Rapprochez/);
  });
  it('maps one-shot gestures without borrowing movement or voice keys', () => {
    expect(socialShortcut({ code: 'KeyH' })).toBe('wave');
    expect(socialShortcut({ code: 'KeyJ' })).toBe('dance');
    expect(socialShortcut({ code: 'KeyK' })).toBe('suspect');
    expect(socialShortcut({ code: 'KeyE' })).toBe('nearby');
    expect(socialShortcut({ code: 'KeyX' })).toBe('stop');
    for (const code of ['KeyV', 'KeyZ', 'KeyQ', 'KeyS', 'KeyD', 'KeyW', 'KeyA', 'ArrowUp', 'Space']) expect(socialShortcut({ code })).toBeUndefined();
  });
});
