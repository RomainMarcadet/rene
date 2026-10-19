import { test, expect, type Page } from '@playwright/test';
import { joinFour, showPanel, submitDescription } from './helpers';

async function pose(page: Page, name: string) {
  return page.evaluate(async name => {
    const modulePath = '/src/store.ts'; const { useGame } = await import(modulePath);
    return useGame.getState().room.players.find((p: { name: string }) => p.name === name).position as { x: number; z: number; yaw: number };
  }, name);
}
async function walk(page: Page, observer: Page, name: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  const before = await pose(page, name);
  await page.keyboard.down('s');
  try { await expect.poll(async () => (await pose(observer, name)).z).toBeGreaterThan(before.z + .15); }
  finally { await page.keyboard.up('s'); }
}

test('four independent browsers finish a game, reconnect and prepare a replay', async ({ browser, baseURL }) => {
  test.setTimeout(180000);
  const { contexts, pages, names } = await joinFour(browser, baseURL!);
  try {
    for (const page of pages) await expect(page.locator('.participants > li')).toHaveCount(4);
    await pages[2].reload();
    await expect(pages[2].locator('.participants > li')).toHaveCount(4);
    for (const page of pages) await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await pages[0].getByRole('button', { name: /Lancer la partie/ }).click();
    for (const page of pages) await expect(page.getByRole('button', { name: /Votre mot secret/ })).toBeVisible();
    const alive = new Set([0, 1, 2, 3]);
    const seenTurns: string[] = [];
    // Four-player presets contain one Undercover, so at most two eliminations conclude the game.
    for (let cycle = 0; cycle < 2; cycle++) {
      await expect(pages[0].locator('.phase-description')).toBeVisible({ timeout: 12_000 });
      for (let turn = 0; turn < alive.size; turn++) {
        let speaker = -1;
        await expect.poll(async () => {
          for (const index of alive) if (await pages[index].getByLabel('Votre indice', { exact: true }).isVisible()) return speaker = index;
          return -1;
        }).not.toBe(-1);
        if (cycle === 0 && turn === 0) {
          const walker = (speaker + 1) % 4; await walk(pages[walker], pages[speaker], names[walker]);
          await pages[speaker].getByLabel('Votre indice', { exact: true }).focus();
          const before = await pose(pages[speaker], names[speaker]);
          await pages[speaker].keyboard.type('zqsd');
          expect(await pose(pages[speaker], names[speaker])).toEqual(before);
        }
        seenTurns.push(names[speaker]);
        await Promise.all(pages.map(async (page, index) => {
          await expect(page.locator('.turn-notice')).toContainText(names[speaker]);
          await expect(page.locator('.turn-notice svg')).toBeVisible();
          await expect(page.locator('.participants .active-turn')).toContainText(names[speaker]);
          if (index === speaker) await expect(page.locator('.your-turn')).toContainText('À VOUS DE DONNER UN INDICE.');
          else await expect(page.getByLabel('Votre indice', { exact: true })).toHaveCount(0);
        }));
        if (cycle === 0 && turn === 0) await pages[speaker].screenshot({ path: 'output/playwright/active-turn.png', fullPage: true });
        await submitDescription(pages[speaker], `Indice ${cycle + 1} ${speaker + 1}`, pages);
      }
      for (const page of pages) {
        await expect(page.locator('.latest-clue')).toContainText(`Indice ${cycle + 1}`);
        await expect(page.locator('.history-rounds section').first()).toHaveAttribute('aria-label', `Indices du tour ${cycle + 1}`);
        expect(await page.locator('.current-round .player-name').allTextContents()).toEqual(seenTurns.slice(-alive.size));
        if (cycle > 0) {
          await showPanel(page, 'Indices');
          await page.getByRole('button', { name: /Tours passés/ }).click();
          const history = page.getByRole('dialog', { name: 'Les tours précédents' });
          await expect(history.getByRole('region', { name: 'Indices du tour 1' })).toBeVisible();
          expect(await history.locator('.player-name').allTextContents()).toEqual(seenTurns.slice(0, 4));
          await page.keyboard.press('Escape'); await expect(history).toHaveCount(0);
        }
      }
      if (cycle === 0) await walk(pages[0], pages[1], names[0]);
      await pages[0].getByRole('button', { name: /Passer au vote/ }).click();
      const seat = await pose(pages[0], names[0]);
      await pages[0].keyboard.down('s');
      await pages[0].getByRole('heading', { name: 'Qui vous paraît louche ?', exact: true }).click();
      await pages[0].keyboard.up('s');
      expect(await pose(pages[0], names[0])).toEqual(seat);
      const target = [...alive].find(index => index !== 0)!;
      for (const index of alive) {
        const chosen = index === target ? 0 : target;
        await pages[index].getByRole('button', { name: `Voter pour ${names[chosen]}`, exact: true }).click();
      }
      alive.delete(target);
      for (const page of pages) {
        const card = page.locator('.participants li.eliminated').filter({ hasText: names[target] });
        await expect(card).toContainText('ÉLIMINÉ');
        await expect(card.locator('.elimination-tag')).toHaveCSS('background-color', 'rgb(243, 69, 49)');
        await expect(card.getByRole('img', { name: 'Portrait éliminé · yeux rouges' })).toBeVisible();
      }
      await expect(pages[0].locator('.phase-results, .phase-description')).toBeVisible({ timeout: 6000 });
      if (await pages[0].locator('.phase-results').isVisible()) break;
    }
    for (const page of pages) await expect(page.getByRole('table', { name: 'Résultats et classement' })).toBeVisible();
    await pages[0].getByRole('button', { name: /Retour au salon/ }).click();
    for (const page of pages) {
      await expect(page.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeVisible();
      await expect(page.locator('.participants .eliminated')).toHaveCount(0);
      await expect(page.locator('.participants .portrait-eliminated')).toHaveCount(0);
    }
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('mobile creation, local avatar persistence and text conversation', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); await page.goto('/');
    await page.getByRole('button', { name: 'COMMENT JOUER ?', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Au départ, vous ne le savez pas');
    await page.screenshot({ path: 'output/playwright/tutorial-mobile.png' });
    for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'La suite →', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('CHIEN ou CHAT');
    await page.getByRole('button', { name: 'Prêt à soupçonner ✓' }).click();
    await page.getByLabel('Pseudonyme').fill('Renée mobile');
    await page.getByRole('button', { name: 'Personnaliser mon avatar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Ça, c’est moi/ }).click();
    await page.getByRole('button', { name: /Créer un salon/ }).click();
    await showPanel(page, 'Suspects');
    await expect(page.getByRole('heading', { name: /Les suspects/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: /^Menu/ }).click();
    await page.getByRole('button', { name: 'Comment jouer ?', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.reload();
    await showPanel(page, 'Suspects');
    await expect(page.getByText('Renée mobile (vous)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeVisible();
  } finally { await context.close(); }
});


test('wave and suspect are rendered on other clients, expire and replay without freezing walking', async ({ browser, baseURL }) => {
  test.setTimeout(60000);
  const { contexts, pages, names } = await joinFour(browser, baseURL!);
  try {
    for (const kind of ['wave', 'suspect', 'dance'] as const) {
      const label = { wave: 'Salut', suspect: 'Soupçon', dance: 'Danse' }[kind];
      await pages[0].getByRole('button', { name: `Emote ${label}`, exact: true }).click();
      await expect.poll(() => pages[1].evaluate(async name => {
        const modulePath = '/src/store.ts'; const { useGame } = await import(modulePath);
        return useGame.getState().room.players.find((p: { name: string }) => p.name === name).emote?.kind;
      }, names[0])).toBe(kind);
      await pages[1].locator('.scene-panel').screenshot({ path: `output/playwright/emote-${kind}-remote.png` });
      await expect.poll(() => pages[1].evaluate(async name => {
        const modulePath = '/src/store.ts'; const { useGame } = await import(modulePath); const state = useGame.getState();
        const emote = state.room.players.find((p: { name: string }) => p.name === name).emote;
        return !emote || emote.until <= Date.now() + state.offset;
      }, names[0]), { timeout: 5000 }).toBe(true);
    }
    await pages[0].getByRole('button', { name: 'Emote Salut', exact: true }).click();
    await walk(pages[0], pages[1], names[0]);
    await pages[0].emulateMedia({ reducedMotion: 'reduce' });
    await pages[0].locator('.scene-panel').screenshot({ path: 'output/playwright/emote-wave-reduced.png' });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
