import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PLAYER_MARKS, playerMark, type RoomSettings } from '@rene/contracts';
import { createGame, applyGameAction, publicGame, type GameState } from './game.js';

function game(count = 8, seed = 1, settings: Partial<RoomSettings> = {}) {
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return createGame({ id: 'identity', playerIds: Array.from({ length: count }, (_, i) => `p${i}`), settings: { ...DEFAULT_SETTINGS, ...settings }, pair: { id: 'fixture', a: 'Mot Alpha', b: 'Mot Bêta', category: 'culture', difficulty: 'easy' }, now: 0, random });
}
const expire = (state: GameState) => applyGameAction(state, { type: 'timeout' }, state.deadline!);

describe('public player marks', () => {
  it('assigns unique palette slots up to twelve without depending on role or turn randomisation', () => {
    expect(PLAYER_MARKS).toHaveLength(12);
    expect(new Set(PLAYER_MARKS.map(mark => mark.color)).size).toBe(12);
    for (let count = 4; count <= 12; count++) {
      const first = game(count, 1); const second = game(count, 987);
      expect(Object.values(first.playerMarks)).toEqual(Array.from({ length: count }, (_, i) => i));
      expect(second.playerMarks).toEqual(first.playerMarks);
      expect(first.roles).not.toEqual(second.roles);
      const projected = publicGame(first);
      expect(JSON.parse(JSON.stringify(projected)).playerMarks).toEqual(first.playerMarks);
      projected.playerMarks.p0 = 99;
      expect(first.playerMarks.p0).toBe(0);
      expect(publicGame(first)).not.toHaveProperty('roles');
      expect(publicGame(first)).not.toHaveProperty('words');
    }
    for (const invalid of [-1, 12, NaN, 0.5, undefined]) expect(playerMark(invalid)).toBeUndefined();
  });

  it('keeps readable name and numbered badge colours on the salon background', () => {
    function luminance(hex: string) {
      const rgb = hex.slice(1).match(/../g)!.map(channel => {
        const value = parseInt(channel, 16) / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    }
    function contrast(a: string, b: string) { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); }
    for (const mark of PLAYER_MARKS) {
      expect(contrast(mark.ink, '#F5F2EA'), `name ${mark.color}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mark.color, mark.foreground), `badge ${mark.color}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the first clue excludes White only in the first round', () => {
  it('selects any eligible participant, including Undercover, with one or several Whites', () => {
    const opened = new Set<string>(); const roles = new Set<string>();
    for (let count = 4; count <= 12; count++) for (let seed = 1; seed <= 100; seed++) {
      const state = expire(game(count, seed, { automaticRoles: false, undercoverCount: 1, whiteCount: Math.min(3, count - 3) }));
      expect(state.roles[state.turnPlayerId!]).not.toBe('white');
      expect(new Set(state.order).size).toBe(count);
      expect(state.order[0]).toBe(state.turnPlayerId);
      opened.add(state.turnPlayerId!); roles.add(state.roles[state.turnPlayerId!]);
      const next = applyGameAction(state, { type: 'describe', playerId: state.turnPlayerId!, text: 'Indice fictif' }, state.deadline! - 1);
      expect(next.turnPlayerId).toBe(state.order[1]);
      expect(next.order).toEqual(state.order);
    }
    expect(opened.size).toBe(12);
    expect(roles).toEqual(new Set(['civilian', 'undercover']));
  });

  it.each(['reveal', 'description'] as const)('handles a permanent departure before the first contribution during %s', phase => {
    let state = game(8, 32, { automaticRoles: false, undercoverCount: 1, whiteCount: 2 });
    const first = state.order[0]; const white = state.order.find(id => state.roles[id] === 'white')!;
    state.order = [first, white, ...state.order.filter(id => id !== first && id !== white)];
    if (phase === 'description') state = expire(state);
    const marks = { ...state.playerMarks };
    state = applyGameAction(state, { type: 'leave', playerId: first }, state.deadline! - 1);
    if (phase === 'reveal') state = expire(state);
    expect(state.phase).toBe('description');
    expect(state.turnPlayerId).not.toBe(first);
    expect(state.roles[state.turnPlayerId!]).not.toBe('white');
    expect(state.playerMarks).toEqual(marks);
    expect(new Set(state.order).size).toBe(8);
  });

  it('retains the normal rotation and lets White open round two', () => {
    let state = game(8, 4, { automaticRoles: false, undercoverCount: 1, whiteCount: 2 });
    const white = state.order.find(id => state.roles[id] === 'white')!;
    state.order = [state.order[0], white, ...state.order.slice(1).filter(id => id !== white)];
    state = expire(state); const order = [...state.order]; const marks = { ...state.playerMarks };
    while (state.phase === 'description') state = applyGameAction(state, { type: 'describe', playerId: state.turnPlayerId!, text: 'Indice fictif' }, state.deadline! - 1);
    expect(state.descriptions.map(d => d.playerId)).toEqual(order);
    state = expire(expire(state)); // Discussion, then an abstention round.
    expect(state.round).toBe(2); expect(state.turnPlayerId).toBe(white);
    expect(state.playerMarks).toEqual(marks);
  });

  it('falls back to the existing circle if an inconsistent state has no eligible survivor', () => {
    const state = game();
    state.roles = Object.fromEntries(state.playerIds.map(id => [id, 'white']));
    const next = expire(state);
    expect(next.phase).toBe('description');
    expect(next.turnPlayerId).toBe(state.order[0]);
    expect(next.order).toEqual(state.order);
  });
});
