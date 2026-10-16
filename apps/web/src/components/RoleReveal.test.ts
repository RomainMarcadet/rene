import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, type PublicPlayer, type Role } from '@rene/contracts';
import { RoleReveal } from './RoleReveal';

const participant: PublicPlayer = { id: 'rene', name: 'René', appearance: DEFAULT_APPEARANCE, alive: false, waiting: false, connected: true, score: 0, ready: false, position: { x: 4, z: 0, yaw: 0 } };
const render = (player?: PublicPlayer) => renderToStaticMarkup(createElement(RoleReveal, { player }));
describe('eliminated role announcement', () => {
  it.each<[Role, string]>([['civilian', 'C’ÉTAIT UN CIVIL !'], ['undercover', 'C’ÉTAIT UN UNDERCOVER !'], ['white', 'C’ÉTAIT MR. WHITE !']])('announces %s with the eliminated portrait without changing the profile', (role, text) => {
    const player = { ...participant, role }; const before = structuredClone(player);
    const html = render(player);
    expect(html).toContain('René A ÉTÉ ÉLIMINÉ.'); expect(html).toContain(text);
    expect(html).toContain('Portrait éliminé · yeux rouges'); expect(html).toContain('role="status"');
    expect(player).toEqual(before);
  });
  it('never announces a living, waiting or missing participant even if given a role', () => {
    expect(render({ ...participant, alive: true, role: 'undercover' })).toBe('');
    expect(render({ ...participant, waiting: true, role: 'white' })).toBe('');
    expect(render(participant)).toBe(''); expect(render()).toBe('');
  });
});
