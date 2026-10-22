import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS } from '@rene/contracts';
import { matchingWordPairs } from '@rene/engine';
import { createPersistence, type Guest } from './persistence.js';
import { MemoryRoomStore, Rooms } from './rooms.js';

async function fixture() {
  const rooms = new Rooms(new MemoryRoomStore(), await createPersistence(), 100, () => .42);
  const guest = (id: string): Guest => ({ id, tokenHash: `theme-${id}`, name: id, appearance: { ...DEFAULT_APPEARANCE }, createdAt: new Date(0) });
  const room = rooms.create(guest('host'), 0);
  for (const id of ['guest-1', 'guest-2', 'guest-3']) rooms.join(room, guest(id), 1);
  return { rooms, room };
}

describe('room theme enforcement', () => {
  it('allows the host to select themes, resets readiness and draws only from that selection', async () => {
    const { rooms, room } = await fixture();
    const settings = { ...DEFAULT_SETTINGS, categories: ['cinema', 'musique'] as ('cinema' | 'musique')[] };
    await expect(rooms.command(room, 'guest-1', { type: 'settings.update', settings }, 2)).rejects.toThrow('hôte');
    for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, 3);
    await rooms.command(room, 'host', { type: 'settings.update', settings }, 4);
    expect([...room.players.values()].every(player => !player.ready)).toBe(true);
    expect(rooms.snapshot(room, 5).settings.categories).toEqual(['cinema', 'musique']);
    for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, 6);
    await rooms.command(room, 'host', { type: 'game.start' }, 7);
    const eligible = new Set(matchingWordPairs(settings).map(pair => pair.id));
    expect(room.usedWords.every(id => eligible.has(id))).toBe(true);
    await expect(rooms.command(room, 'host', { type: 'settings.update', settings }, 8)).rejects.toThrow();
  });

  it('rejects an adult-only filter without opt-in and accepts an explicit adult-only game', async () => {
    const { rooms, room } = await fixture();
    const settings = { ...DEFAULT_SETTINGS, categories: ['adulte'] as 'adulte'[] };
    await expect(rooms.command(room, 'host', { type: 'settings.update', settings }, 2)).rejects.toThrow('Aucune paire');
    expect(room.settings.adultContent).toBe(false);
    await rooms.command(room, 'host', { type: 'settings.update', settings: { ...settings, adultContent: true } }, 3);
    for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, 4);
    await rooms.command(room, 'host', { type: 'game.start' }, 5);
    const adultIds = new Set(matchingWordPairs({ ...settings, adultContent: true }).map(pair => pair.id));
    expect(adultIds.has(room.usedWords.at(-1)!)).toBe(true);
    expect(rooms.snapshot(room, 6).settings.adultContent).toBe(true);
  });

  it('uses the database reservation rather than trusting mutable room history', async () => {
    const { rooms, room } = await fixture();
    const eligible = matchingWordPairs({ ...DEFAULT_SETTINGS, categories: [] }).map(pair => pair.id);
    expect(eligible.length).toBeGreaterThan(1000);
    // Represents previous selections in this room, beyond the former 1,000-ID limit.
    room.usedWords = eligible.slice(0, -1);
    for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, 2);
    await rooms.command(room, 'host', { type: 'game.start' }, 3);
    expect(eligible).toContain(room.usedWords.at(-1));
    expect(room.usedWords).toHaveLength(eligible.length);
  });

  it('synchronizes a special-only selection and starts a game without publishing the pair', async () => {
    const { rooms, room } = await fixture();
    const settings = { ...DEFAULT_SETTINGS, categories: ['special'] as 'special'[] };
    await rooms.command(room, 'host', { type: 'settings.update', settings }, 2);
    expect(rooms.snapshot(room, 3).settings.categories).toEqual(['special']);
    for (const id of room.players.keys()) await rooms.command(room, id, { type: 'player.ready', ready: true }, 4);
    await rooms.command(room, 'host', { type: 'game.start' }, 5);
    const pool = matchingWordPairs(settings);
    expect(pool.some(pair => pair.id === room.usedWords.at(-1))).toBe(true);
    const snapshot = JSON.stringify(rooms.snapshot(room, 6));
    expect(pool.some(pair => snapshot.includes(pair.a) || snapshot.includes(pair.b) || snapshot.includes(pair.id))).toBe(false);
    expect(snapshot.includes('clueAxes')).toBe(false);
  });
});
