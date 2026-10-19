import { describe, expect, it } from 'vitest';
import { ANIMATION_IDS, ANIMATIONS, DEFAULT_APPEARANCE, physicalStage, type Command } from '@rene/contracts';
import { createPersistence, type Guest } from './persistence.js';
import { MemoryRoomStore, Rooms } from './rooms.js';
import { resetSocial } from './social.js';
const T = 100_000;
async function fixture(count = 4) {
  const rooms = new Rooms(new MemoryRoomStore(), await createPersistence(), 100, () => .42);
  const guest = (id: string): Guest => ({ id, tokenHash: id, name: id, appearance: { ...DEFAULT_APPEARANCE }, createdAt: new Date(T) });
  const room = rooms.create(guest('p0'), T);
  for (let i = 1; i < count; i++) rooms.join(room, guest('p' + i), T);
  room.players.get('p0')!.position = { x: 4, z: 0, yaw: 0 };
  room.players.get('p1')!.position = { x: 4, z: 1.2, yaw: Math.PI };
  const act = (id: string, command: Command, now = T, generation = room.social.generation) => rooms.command(room, id, command, now, generation);
  const start = async () => { for (const id of room.players.keys()) await act(id, { type: 'player.ready', ready: true }); await act('p0', { type: 'game.start' }); };
  return { room, rooms, act, start, a: room.players.get('p0')!, b: room.players.get('p1')! };
}
describe('ephemeral authoritative social engine', () => {
  it.each([undefined, 'reveal', 'description', 'discussion', 'vote', 'tiebreak', 'whiteGuess', 'elimination', 'results'] as const)('enforces phase %s on the server', async phase => {
    const f = await fixture(); if (phase) { await f.start(); f.room.game!.phase = phase; }
    if (phase === 'vote' || phase === 'tiebreak') {
      const before = JSON.stringify(f.a.social);
      await expect(f.act('p0', { type: 'player.emote', kind: 'kneel' })).rejects.toThrow();
      await expect(f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' })).rejects.toThrow();
      expect(JSON.stringify(f.a.social)).toBe(before);
    } else { await f.act('p0', { type: 'player.emote', kind: 'kneel' }); await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }); expect(f.room.social.pending.size).toBe(1); }
  });
  it('uses one cooldown for every offensive variant and produces one impact only', async () => {
    const { act, rooms, room, a, b } = await fixture();
    await act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' });
    await expect(act('p0', { type: 'player.attack', kind: 'slap' }, T + 799)).rejects.toThrow('souffle');
    await rooms.tick(room, T + 179); expect(b.social.hits).toEqual([]);
    await rooms.tick(room, T + 180); expect(b.social.hits).toEqual([T + 180]);
    await rooms.tick(room, T + 181); expect(b.social.hits).toHaveLength(1);
    expect(a.social.nextAttackAt).toBe(T + 800);
    await act('p0', { type: 'player.attack', kind: 'headbutt' }, T + 800);
  });
  it('misses when the target leaves range, faces away, or the table intervenes', async () => {
    const f = await fixture();
    f.a.position.yaw = Math.PI;
    await expect(f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' })).rejects.toThrow();
    f.a.position = { x: 0, z: -1.16, yaw: 0 }; f.b.position = { x: 0, z: 1.16, yaw: 0 };
    await expect(f.act('p0', { type: 'player.interaction.invite', kind: 'hug', targetId: 'p1' })).rejects.toThrow();
    f.a.position = { x: 4, z: 0, yaw: 0 }; f.b.position = { x: 4, z: 1.2, yaw: 0 };
    await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' });
    f.b.position.z = 4; await f.rooms.tick(f.room, T + 180);
    expect(f.b.social.hits).toEqual([]); expect(f.b.social.physical).toBeUndefined();
    expect(f.a.social.animation?.kind).toBe('punch');
  });
  it('accumulates five hits, recovers at the exact boundary and protects without prolongation', async () => {
    const f = await fixture();
    for (let n = 0; n < 5; n++) {
      await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, T + n * 800);
      await f.rooms.tick(f.room, T + n * 800 + 180);
      if (n < 4) expect(f.b.social.physical?.kind).toBe('hit_reaction');
    }
    const impact = T + 3380; const physical = structuredClone(f.b.social.physical);
    expect(f.b.social.hits).toEqual([]); expect(physicalStage(physical, impact)).toBe('stun_fall');
    expect(physicalStage(physical, impact + 350)).toBe('stunned_loop');
    await expect(f.act('p1', { type: 'player.attack', kind: 'punch' }, impact + 100)).rejects.toThrow();
    expect(f.rooms.move(f.room, 'p1', { x: 1, z: 0 }, impact + 100)).toBe(false);
    await f.act('p1', { type: 'player.interaction.preferences', acceptsPhysical: false }, impact + 100);
    await f.act('p1', { type: 'player.interaction.preferences', acceptsPhysical: true }, impact + 101);
    expect(f.b.social.physical).toEqual(physical);
    f.rooms.disconnected(f.room, 'p1', impact + 200); f.rooms.connected(f.room, 'p1', impact + 201);
    expect(f.b.social.physical).toEqual(physical);
    await f.rooms.tick(f.room, impact + 2500); expect(physicalStage(f.b.social.physical, impact + 2500)).toBe('get_up');
    await f.rooms.tick(f.room, impact + 3000); expect(f.b.social.physical).toBeUndefined();
    await expect(f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, impact + 5999)).rejects.toThrow();
    await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, impact + 6000);
  });
  it('expires hits exactly at eight seconds and shares the counter across attackers', async () => {
    const f = await fixture(); const c = f.room.players.get('p2')!; c.position = { x: 4.3, z: .1, yaw: 0 };
    await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }); await f.rooms.tick(f.room, T + 180);
    await f.rooms.tick(f.room, T + 8180); expect(f.b.social.hits).toEqual([]);
    for (let i = 0; i < 3; i++) {
      await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, T + 9000 + i * 800);
      await f.act('p2', { type: 'player.attack', kind: 'slap', targetId: 'p1' }, T + 9000 + i * 800);
      await f.rooms.tick(f.room, T + 9180 + i * 800);
    }
    expect(f.b.social.physical?.kind).toBe('stun'); expect(f.b.social.physical?.startedAt).toBe(T + 10780);
  });
  it('atomically interrupts on real vote entry, rejects stale contexts, and never resumes', async () => {
    const f = await fixture(); await f.start(); await f.rooms.tick(f.room, f.room.game!.deadline!);
    let now = f.room.game!.deadline! - 1000;
    while (f.room.game!.phase === 'description') await f.act(f.room.game!.turnPlayerId!, { type: 'game.describe', text: 'Une idée fictive' }, now++);
    const generation = f.room.social.generation; const voice = f.room.voiceGeneration;
    await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, now);
    await f.act('p0', { type: 'game.skipDiscussion' }, now + 179);
    expect(f.room.game!.phase).toBe('vote'); expect(f.room.social.generation).toBe(generation + 1);
    expect(f.room.voiceGeneration).toBe(voice); expect(f.room.social.pending.size).toBe(0);
    await f.rooms.tick(f.room, now + 180); expect(f.b.social.physical).toBeUndefined();
    expect([...f.room.players.values()].every(p => !p.social.animation && !p.social.physical && !p.social.hits.length)).toBe(true);
    await expect(f.act('p0', { type: 'player.emote', kind: 'wave' }, now + 181, generation)).rejects.toThrow('contexte');
    // A second vote is a separate invalidation, even though movement stays locked.
    f.room.game!.phase = 'discussion'; await f.act('p0', { type: 'game.skipDiscussion' }, now + 182);
    expect(f.room.social.generation).toBe(generation + 2);
    f.room.game!.phase = 'description';
    await expect(f.act('p0', { type: 'player.emote', kind: 'wave' }, now + 183, generation)).rejects.toThrow('contexte');
    expect(f.a.social.animation).toBeUndefined();
  });
  it('lets a stunned player describe and preserves every business and voice field', async () => {
    const f = await fixture(); await f.start(); await f.rooms.tick(f.room, f.room.game!.deadline!);
    const game = f.room.game!; const id = game.turnPlayerId!; const target = f.room.players.get(id)!;
    const before = structuredClone(game); const voice = f.room.voiceGeneration;
    target.social.physical = { instanceId: 'test', kind: 'stun', startedAt: T, stunEndsAt: T + 2500, endsAt: T + 3000, sourceYaw: 0 };
    const now = game.deadline! - 1000;
    // Keep the temporary state active at the current phase's clock.
    target.social.physical.startedAt = now; target.social.physical.stunEndsAt = now + 2500; target.social.physical.endsAt = now + 3000;
    await f.act(id, { type: 'player.interaction.preferences', acceptsPhysical: false }, now);
    expect(game).toEqual(before); expect(f.room.voiceGeneration).toBe(voice);
    await f.act(id, { type: 'game.describe', text: 'Indice inventé pendant la chute' }, now + 1);
    expect(f.room.game!.descriptions.at(-1)?.text).toBe('Indice inventé pendant la chute');
  });
  it('excludes dead/spectators during play but allows them at results without changing identity', async () => {
    const f = await fixture(); await f.start(); f.room.game!.alive = f.room.game!.alive.filter(id => id !== 'p1');
    await expect(f.act('p1', { type: 'player.emote', kind: 'wave' })).rejects.toThrow();
    await expect(f.act('p1', { type: 'player.attack', kind: 'punch' })).rejects.toThrow();
    f.room.game!.phase = 'results'; const before = structuredClone(f.room.game);
    await f.act('p1', { type: 'player.emote', kind: 'play_dead' }); expect(f.room.game).toEqual(before);
  });
  it('keeps preference/cooldown over reconnect, validates nearest target deterministically and limits projection', async () => {
    const f = await fixture(); f.room.players.get('p2')!.position = { x: 4, z: 1.2, yaw: 0 };
    await f.act('p0', { type: 'player.attack', kind: 'punch' }); expect(f.a.social.animation?.targetId).toBe('p1');
    f.rooms.disconnected(f.room, 'p0', T + 1); f.rooms.connected(f.room, 'p0', T + 2);
    await expect(f.act('p0', { type: 'player.attack', kind: 'slap' }, T + 3)).rejects.toThrow('souffle');
    await f.act('p1', { type: 'player.interaction.preferences', acceptsPhysical: false });
    await expect(f.act('p1', { type: 'player.attack', kind: 'punch' })).rejects.toThrow();
    await expect(f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, T + 800)).rejects.toThrow();
    const publicState = f.rooms.snapshot(f.room, T).social;
    expect(publicState.players.p0).not.toHaveProperty('hits'); expect(publicState).not.toHaveProperty('pending');
    expect(Object.keys(publicState.players.p0).sort()).toEqual(['acceptsPhysical', 'animation', 'nextAttackAt', 'protectedUntil']);
  });
  it('requires consent, starts both halves together, and cancels for either partner, distance, impact or departure', async () => {
    const f = await fixture();
    await f.act('p0', { type: 'player.interaction.invite', kind: 'carry', targetId: 'p1' });
    const i = [...f.room.social.interactions.values()][0]; expect(f.a.social.animation).toBeUndefined();
    await expect(f.act('p1', { type: 'player.interaction.invite', kind: 'hug', targetId: 'p0' })).rejects.toThrow();
    await expect(f.act('p2', { type: 'player.interaction.respond', interactionId: i.id, accept: true })).rejects.toThrow();
    await f.act('p1', { type: 'player.interaction.respond', interactionId: i.id, accept: true }, T + 300);
    expect(f.a.social.animation?.startedAt).toBe(T + 300); expect(f.b.social.animation?.startedAt).toBe(T + 300);
    expect(f.a.social.animation?.sharedInteractionId).toBe(f.b.social.animation?.sharedInteractionId);
    expect(f.rooms.move(f.room, 'p0', { x: 1, z: 0 }, T + 500)).toBe(false);
    await f.act('p1', { type: 'player.interaction.cancel', interactionId: i.id }, T + 400);
    expect(f.a.social.animation).toBeUndefined(); expect(f.b.social.animation).toBeUndefined();
    await f.act('p0', { type: 'player.interaction.invite', kind: 'hug', targetId: 'p1' }, T + 500);
    f.b.position.z = 4; await f.rooms.tick(f.room, T + 501); expect(f.room.social.interactions.size).toBe(0);
  });
  it('stops a contextual taunt when its consenting ground target recovers or opts out', async () => {
    const f = await fixture();
    await expect(f.act('p0', { type: 'player.emote', kind: 'crouch_taunt', targetId: 'p1' })).rejects.toThrow();
    await f.act('p1', { type: 'player.emote', kind: 'play_dead' });
    await f.act('p0', { type: 'player.emote', kind: 'crouch_taunt', targetId: 'p1' }, T + 500);
    await f.act('p1', { type: 'player.interaction.preferences', acceptsPhysical: false }, T + 600);
    expect(f.a.social.animation).toBeUndefined(); expect(f.b.social.animation?.kind).toBe('play_dead');
    expect(f.b.alive).toBe(true);
  });
  it('preserves active server-time dance across reconnect and rejects a late stop against a replacement', async () => {
    const f = await fixture();
    await f.act('p0', { type: 'player.emote', kind: 'macarena_full' });
    const dance = structuredClone(f.a.social.animation!);
    f.rooms.disconnected(f.room, 'p0', T + 100); f.rooms.connected(f.room, 'p0', T + 1000);
    expect(f.a.social.animation).toEqual(dance);
    await f.act('p1', { type: 'player.emote', kind: 'macarena_full', targetId: 'p0' }, T + 1300);
    expect(f.b.social.animation?.startedAt).toBe(dance.startedAt);
    await f.act('p0', { type: 'player.emote', kind: 'kneel' }, T + 1400);
    await expect(f.act('p0', { type: 'player.emote.stop', instanceId: dance.instanceId }, T + 1401)).rejects.toThrow();
    expect(f.a.social.animation?.kind).toBe('kneel');
    resetSocial(f.room); expect(f.room.social.pending.size).toBe(0);
  });
  it('has bounded explicit metadata for every delivered animation', () => {
    expect(new Set(ANIMATION_IDS).size).toBe(ANIMATION_IDS.length);
    for (const id of ANIMATION_IDS) {
      expect(ANIMATIONS[id].durationMs).toBeGreaterThan(0); expect(ANIMATIONS[id].durationMs).toBeLessThanOrEqual(30000);
      expect(ANIMATIONS[id].interrupts).toContain('vote'); expect(ANIMATIONS[id].label).toBeTruthy();
    }
  });
  it('clears the social context again on a genuine tiebreak transition', async () => {
    const f = await fixture(); await f.start(); await f.rooms.tick(f.room, f.room.game!.deadline!);
    let now = f.room.game!.deadline! - 1000;
    while (f.room.game!.phase === 'description') await f.act(f.room.game!.turnPlayerId!, { type: 'game.describe', text: 'Indice inventé' }, now++);
    await f.act('p0', { type: 'game.skipDiscussion' }, now++);
    const generation = f.room.social.generation; const alive = [...f.room.game!.alive];
    // Every player votes for the next seat: four equal tallies.
    for (let i = 0; i < alive.length; i++) await f.act(alive[i], { type: 'game.vote', targetId: alive[(i + 1) % alive.length] }, now++);
    expect(f.room.game!.phase).toBe('tiebreak'); expect(f.room.social.generation).toBe(generation + 1);
    await expect(f.act('p0', { type: 'player.emote', kind: 'kneel' }, now)).rejects.toThrow();
    expect(f.room.social.pending.size).toBe(0);
  });
  it('lets the eliminated Mr. White answer while physically stunned', async () => {
    const f = await fixture(); f.room.settings = { ...f.room.settings, automaticRoles: false, undercoverCount: 0, whiteCount: 1 }; await f.start();
    const white = Object.keys(f.room.game!.roles).find(id => f.room.game!.roles[id] === 'white')!;
    await f.rooms.tick(f.room, f.room.game!.deadline!); let now = f.room.game!.deadline! - 1000;
    while (f.room.game!.phase === 'description') await f.act(f.room.game!.turnPlayerId!, { type: 'game.describe', text: 'Indice inventé' }, now++);
    await f.act('p0', { type: 'game.skipDiscussion' }, now++);
    const other = f.room.game!.alive.find(id => id !== white)!;
    for (const id of [...f.room.game!.alive]) await f.act(id, { type: 'game.vote', targetId: id === white ? other : white }, now++);
    expect(f.room.game!.phase).toBe('whiteGuess');
    const p = f.room.players.get(white)!;
    p.social.physical = { instanceId: 'test', kind: 'stun', startedAt: now, stunEndsAt: now + 2500, endsAt: now + 3000, sourceYaw: 0 };
    await f.act(white, { type: 'game.guess', word: 'Une réponse entièrement fictive' }, now + 1);
    expect(f.room.game!.phase).toBe('elimination');
  });
  it('cancels accepted interactions on an interrupting impact and expires unanswered invitations', async () => {
    const f = await fixture();
    await f.act('p0', { type: 'player.interaction.invite', kind: 'hug', targetId: 'p1' });
    await f.rooms.tick(f.room, T + 8000); expect(f.room.social.interactions.size).toBe(0);
    await f.act('p0', { type: 'player.interaction.invite', kind: 'hug', targetId: 'p1' }, T + 8001);
    const i = [...f.room.social.interactions.values()][0];
    await f.act('p1', { type: 'player.interaction.respond', interactionId: i.id, accept: true }, T + 8002);
    f.room.players.get('p2')!.position = { x: 4.5, z: 2.2, yaw: Math.PI };
    await f.act('p2', { type: 'player.attack', kind: 'punch', targetId: 'p1' }, T + 8003);
    await f.rooms.tick(f.room, T + 8183);
    expect(f.room.social.interactions.size).toBe(0); expect(f.a.social.animation).toBeUndefined();
    expect(f.b.social.physical?.kind).toBe('hit_reaction');
  });
  it('does not replay a delayed impact after its attack animation has expired', async () => {
    const f = await fixture();
    await f.act('p0', { type: 'player.attack', kind: 'punch', targetId: 'p1' });
    await f.rooms.tick(f.room, T + 501);
    expect(f.b.social.hits).toEqual([]); expect(f.b.social.physical).toBeUndefined(); expect(f.room.social.pending.size).toBe(0);
  });

  it('uses different social generations across salons and ignores ordinary room revisions', async () => {
    const f = await fixture(); const g = await fixture();
    const generation = f.room.social.generation;
    expect(g.room.social.generation).not.toBe(generation);
    await f.act('p0', { type: 'chat.send', text: 'Message fictif' });
    expect(f.room.social.generation).toBe(generation);
    await expect(g.act('p0', { type: 'player.emote', kind: 'wave' }, T, generation)).rejects.toThrow('contexte');
    expect(g.a.social.animation).toBeUndefined();
  });
  it('refuses a proposal without starting poses and never resumes a pair after disconnect', async () => {
    const f = await fixture();
    await f.act('p0', { type: 'player.interaction.invite', kind: 'hug', targetId: 'p1' });
    let i = [...f.room.social.interactions.values()][0];
    await f.act('p1', { type: 'player.interaction.respond', interactionId: i.id, accept: false });
    expect(f.room.social.interactions.size).toBe(0); expect(f.a.social.animation).toBeUndefined();
    await f.act('p0', { type: 'player.interaction.invite', kind: 'carry', targetId: 'p1' });
    i = [...f.room.social.interactions.values()][0];
    await f.act('p1', { type: 'player.interaction.respond', interactionId: i.id, accept: true });
    f.rooms.disconnected(f.room, 'p1', T + 500);
    expect(f.room.social.interactions.size).toBe(0); expect(f.a.social.animation).toBeUndefined(); expect(f.b.social.animation).toBeUndefined();
    f.rooms.connected(f.room, 'p1', T + 600); expect(f.b.social.animation).toBeUndefined();
  });

});
