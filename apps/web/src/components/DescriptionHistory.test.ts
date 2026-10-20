import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, type PublicGame, type PublicPlayer } from '@rene/contracts';
import { DescriptionHistory } from './DescriptionHistory';
import { PlayerName } from './PlayerName';
import { AVATAR_SPECIMENS } from '../avatar/specimens';

const players: PublicPlayer[] = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `Suspect ${i}`, appearance: DEFAULT_APPEARANCE, connected: true, ready: false, alive: true, waiting: false, score: 0, position: { x: 0, z: 4, yaw: 0 } }));
const game: PublicGame = { id: 'fixture', phase: 'description', phaseId: 'fixture:4', round: 2, deadline: 10000, turnPlayerId: 'p2', playerMarks: { p0: 0, p1: 1, p2: 2, p3: 3 }, order: ['p1', 'p2', 'p3', 'p0'], descriptions: [{ playerId: 'p0', round: 1, text: 'Indice ancien', timedOut: false }, { playerId: 'p1', round: 2, text: 'Indice public', timedOut: false }], voteCandidates: [], voteCounts: null, readyToVotePlayerIds: [], votedPlayerIds: [], eliminatedPlayerId: null, whitePlayerId: null, result: null };
const render = (state: PublicGame | null) => renderToStaticMarkup(createElement(DescriptionHistory, { game: state, players, visible: true }));

describe('current clues and public identities', () => {
  it('keeps slots in turn order, marks the active player and keeps older rounds after the current one', () => {
    const html = render(game); const before = structuredClone(game);
    expect([...html.matchAll(/data-player-id="([^"]+)"/g)].map(match => match[1])).toEqual(['p1', 'p2', 'p3', 'p0']);
    expect(html).toContain('data-player-id="p2" aria-current="step"');
    expect(html).toContain('Indices du tour 2'); expect(html).toContain('Tours passés · 1');
    expect(html).not.toContain('Indice ancien');
    expect(html).toContain('Indice public'); expect(html).toContain('Indice attendu');
    expect(html).toContain('À son tour…'); expect(html).toContain('data-player-mark="2"');
    render({ ...game, descriptions: [...game.descriptions, { playerId: 'p2', round: 2, text: 'Autre indice', timedOut: false }] });
    expect(game).toEqual(before);
  });
  it('shows expirations without inventing contributions and leaves the lobby empty', () => {
    const html = render({ ...game, turnPlayerId: 'p3', descriptions: [...game.descriptions, { playerId: 'p2', round: 2, text: 'Temps écoulé', timedOut: true }] });
    expect(html).toContain('clue-expired'); expect(html).toContain('… temps écoulé');
    expect(render(null)).not.toContain('data-player-id');
    expect(render(null)).toContain('Les premiers indices arriveront avec la partie.');
  });
  it('identifies players by name and colour without assigning visible numbers', () => {
    const html = renderToStaticMarkup(createElement(PlayerName, { name: 'René & amis', mark: 11 }));
    expect(html).not.toContain('Repère'); expect(html).not.toContain('player-token'); expect(html).toContain('--player-color:#B53070');
    expect(html).toContain('René &amp; amis');
    const lobby = renderToStaticMarkup(createElement(PlayerName, { name: 'René' }));
    expect(lobby).not.toContain('player-token'); expect(lobby).not.toContain('data-player-mark');
  });
  it('keeps customized portraits and the public colour on submitted, active and waiting cards', () => {
    const customized = players.map((p, i) => ({ ...p, appearance: AVATAR_SPECIMENS[i] }));
    const html = renderToStaticMarkup(createElement(DescriptionHistory, { game, players: customized, visible: true }));
    for (const p of customized) {
      const card = html.split(`data-player-id="${p.id}"`)[1].split('</li>')[0];
      expect(card).toContain(`data-appearance="${[p.appearance.head, p.appearance.hair, p.appearance.eyes, p.appearance.mouth, p.appearance.nose, p.appearance.accessory].join(':')}"`);
      expect(card).toContain('clue-portrait');
      expect(card).toContain('--player-color:');
      expect(card.indexOf('clue-author')).toBeLessThan(card.indexOf('clue-text'));
    }
    expect(html).toContain('aria-label="À son tour"');
    expect(html).not.toContain('Parle');
  });
});
