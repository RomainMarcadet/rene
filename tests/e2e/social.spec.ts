import { test, expect, type Page } from '@playwright/test';
import { joinFour, showPanel, submitDescription } from './helpers';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';

async function state(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/store.ts'; const { useGame } = await import(path);
    const { room, secret } = useGame.getState();
    return { room, secret };
  });
}
async function describe(pages: Page[]) {
  await expect(pages[0].locator('.phase-description')).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < pages.length; i++) {
    let speaker = -1;
    await expect.poll(async () => {
      for (const [index, page] of pages.entries()) if (await page.getByLabel('Votre indice', { exact: true }).isVisible()) return speaker = index;
      return -1;
    }).not.toBe(-1);
    await submitDescription(pages[speaker], `Indice ${i}`, pages);
  }
}

test('description turns stay synchronized with delayed commands and expanded avatars', async ({ browser, baseURL }) => {
  let intercepted = 0; let delayed = 0;
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const { contexts, pages } = await joinFour(browser, baseURL!, 3, async (context, index) => {
    await context.addInitScript(appearance => localStorage.setItem('rene-profile', JSON.stringify({ name: 'Spécimen', appearance })), AVATAR_SPECIMENS[index]);
    await context.routeWebSocket(url => url.pathname === '/socket.io/', socket => {
      intercepted++;
      const server = socket.connectToServer();
      socket.onMessage(message => {
        const packet = typeof message === 'string' ? message.match(/^42\d*(\[.*)$/s) : null;
        const [event, envelope] = packet ? JSON.parse(packet[1]) : [];
        if (event === 'command' && envelope?.command?.type === 'game.describe') {
          delayed++;
          // Real server, ordered messages: expose the window between click and confirmation.
          const timer = setTimeout(() => { pending.delete(timer); server.send(message); }, 400);
          pending.add(timer);
        } else server.send(message);
      });
    });
  });
  try {
    await expect.poll(() => intercepted).toBe(4);
    for (const [index, page] of pages.entries()) {
      const room = (await state(page)).room;
      expect(room.players[index].appearance).toEqual(AVATAR_SPECIMENS[index]);
      await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    }
    await pages[0].getByRole('button', { name: /Lancer la partie/ }).click();
    await describe(pages);
    expect(delayed).toBe(4);
    for (const page of pages) {
      await expect(page.locator('.phase-discussion')).toBeVisible();
      const game = (await state(page)).room.game;
      expect(game.descriptions.map((d: { text: string }) => d.text)).toEqual(['Indice 0', 'Indice 1', 'Indice 2', 'Indice 3']);
      expect(game.descriptions.map((d: { playerId: string }) => d.playerId)).toEqual(game.order);
      expect(game.descriptions.every((d: { timedOut: boolean }) => !d.timedOut)).toBe(true);
    }
  } finally { pending.forEach(clearTimeout); await Promise.all(contexts.map(context => context.close())); }
});

test('four clients react, unanimously start voting and reveal White before a tolerant guess and replay', async ({ browser, baseURL }) => {
  test.setTimeout(180000);
  const { contexts, pages, names } = await joinFour(browser, baseURL!, 3);
  try {
    const host = pages[0];
    await host.getByRole('button', { name: 'Paramètres ⚙', exact: true }).click();
    await host.getByLabel('Répartition automatique des rôles').uncheck();
    await host.getByLabel('Undercovers', { exact: true }).fill('0');
    await host.getByLabel('Mr. Whites', { exact: true }).fill('1');
    await host.getByLabel('Mr. White (secondes)', { exact: true }).fill('120');
    await host.getByRole('button', { name: 'Enregistrer les règles' }).click();
    for (const page of pages) await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await host.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect.poll(async () => (await Promise.all(pages.map(state))).every(s => s.secret?.inGame)).toBe(true);
    const initial = await Promise.all(pages.map(state));
    const white = initial.findIndex(s => s.secret.word === null);
    const word = initial.find(s => s.secret.word !== null)!.secret.word as string;
    expect(white).toBeGreaterThanOrEqual(0);
    await describe(pages);
    await showPanel(pages[3], 'Discussion');
    await host.getByLabel('Message au salon').fill('Je soupçonne tout le monde, surtout Lou.');
    await host.getByRole('button', { name: 'Envoyer le message' }).click();
    const up = (page: Page) => page.getByRole('button', { name: 'Soutenir le message de Camille', exact: true });
    const down = (page: Page) => page.getByRole('button', { name: 'Désapprouver le message de Camille', exact: true });
    await up(host).click(); await expect(up(host)).toHaveAttribute('aria-pressed', 'true');
    await up(host).click(); await expect(up(host)).toHaveAttribute('aria-pressed', 'false');
    await Promise.all([up(pages[1]).click(), up(pages[2]).click(), down(pages[3]).click()]);
    await Promise.all(pages.map(async page => {
      await expect(up(page)).toHaveText('▲ 2'); await expect(down(page)).toHaveText('▼ 1');
    }));
    await down(pages[1]).click(); await expect(down(pages[1])).toHaveAttribute('aria-pressed', 'true');
    await up(pages[1]).click();
    await pages[2].reload(); await expect(up(pages[2])).toHaveAttribute('aria-pressed', 'true');
    await expect(down(pages[2])).toHaveText('▼ 1');
    for (const page of pages.slice(0, 3)) await page.getByRole('button', { name: 'Je suis prêt à voter ✓', exact: true }).click();
    await expect(host.locator('.vote-readiness')).toContainText('3 / 4 JOUEURS PRÊTS');
    await pages[1].getByRole('button', { name: 'Annuler ma confirmation ↶' }).click();
    await expect(host.locator('.vote-readiness')).toContainText('2 / 4 JOUEURS PRÊTS');
    await pages[1].getByRole('button', { name: 'Je suis prêt à voter ✓', exact: true }).click();
    await contexts[3].setOffline(true);
    await expect(host.locator('.participants .absent')).toHaveCount(1);
    await expect(host.locator('.phase-discussion')).toBeVisible();
    await expect(host.locator('.vote-readiness')).toContainText('3 / 4 JOUEURS PRÊTS');
    await contexts[3].setOffline(false);
    const last = pages[3].getByRole('button', { name: 'Je suis prêt à voter ✓', exact: true });
    await expect(last).toBeEnabled({ timeout: 15000 });
    await pages[3].screenshot({ path: 'output/playwright/v1.2-readiness-mobile.png', fullPage: true });
    await last.click();
    await Promise.all(pages.map(page => expect(page.locator('.phase-vote')).toBeVisible()));
    const vote = (await state(host)).room;
    expect(vote.game.votedPlayerIds).toEqual([]); // Chat reactions never become official ballots.
    expect(vote.chat[0].reactions).toEqual({ up: 2, down: 1 });
    for (const [index, player] of vote.players.entries()) {
      const angle = index / 4 * Math.PI * 2;
      expect(player.position.x).toBeCloseTo(Math.cos(angle) * 2.75);
      expect(player.position.z).toBeCloseTo(Math.sin(angle) * 2.75);
    }
    for (const [index, page] of pages.entries()) await page.getByRole('button', { name: `Voter pour ${names[index === white ? (white + 1) % 4 : white]}`, exact: true }).click();
    await Promise.all(pages.map(async page => {
      await expect(page.locator('.role-reveal')).toContainText('C’ÉTAIT MR. WHITE !');
      const card = page.locator('.participants .eliminated');
      await expect(card).toContainText(names[white]); await expect(card).toContainText('ÉLIMINÉ'); await expect(card).toContainText('MR. WHITE');
      await expect(card).toHaveCSS('background-color', 'rgb(243, 69, 49)');
      await expect(page.locator('.participants li:not(.eliminated) .revealed-role')).toHaveCount(0);
    }));
    await expect(up(pages[white])).toBeDisabled();
    await expect(pages[white].getByLabel('Le mot des Civils', { exact: true })).toBeVisible();
    await pages[white].screenshot({ path: 'output/playwright/v1.2-white-reveal.png', fullPage: true });
    await pages[white].getByLabel('Le mot des Civils', { exact: true }).fill(` « ${word.toLocaleUpperCase('fr')} ! » `);
    await pages[white].getByRole('button', { name: 'Valider mon mot →', exact: true }).click();
    await Promise.all(pages.map(async page => {
      await expect(page.locator('.winner-banner')).toContainText('Mr. White a le dernier mot.');
      const row = page.getByRole('row').filter({ hasText: names[white] }); await expect(row).toContainText('+6');
    }));
    await host.getByRole('button', { name: /Retour au salon/ }).click();
    await Promise.all(pages.map(async page => {
      await expect(page.locator('.participants .revealed-role')).toHaveCount(0);
      await expect(page.locator('.participants .eliminated')).toHaveCount(0);
      await expect(page.locator('.chat-reactions')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }));
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
