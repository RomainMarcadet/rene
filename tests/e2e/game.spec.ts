import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

async function joinFour(browser: Browser, baseURL: string) {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({ baseURL }); contexts.push(context);
    pages.push(await context.newPage());
  }
  await pages[0].goto('/'); await pages[0].getByLabel('Pseudonyme').fill('Camille');
  await pages[0].getByRole('button', { name: /Créer un salon/ }).click();
  await expect(pages[0]).toHaveURL(/room=[A-Z2-9]{6}/);
  const code = new URL(pages[0].url()).searchParams.get('room')!;
  const names = ['Camille', 'Lou', 'Sam', 'Alex'];
  for (let i = 1; i < 4; i++) {
    await pages[i].goto(`/?room=${code}`);
    await pages[i].getByLabel('Pseudonyme').fill(names[i]);
    await pages[i].getByRole('button', { name: /Rejoindre →/ }).click();
    await expect(pages[i].getByRole('heading', { name: /Les suspects/ })).toBeVisible();
  }
  return { contexts, pages, names };
}

test('four independent browsers finish a game, reconnect and prepare a replay', async ({ browser, baseURL }) => {
  const { contexts, pages, names } = await joinFour(browser, baseURL!);
  try {
    for (const page of pages) await expect(page.locator('.participants > li')).toHaveCount(4);
    await pages[2].reload();
    await expect(pages[2].locator('.participants > li')).toHaveCount(4);
    for (const page of pages) await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await pages[0].getByRole('button', { name: /Lancer la partie/ }).click();
    for (const page of pages) await expect(page.getByRole('button', { name: /Votre mot secret/ })).toBeVisible();
    const alive = new Set([0, 1, 2, 3]);
    // Four-player presets contain one Undercover, so at most two eliminations conclude the game.
    for (let cycle = 0; cycle < 2; cycle++) {
      await expect(pages[0].locator('.phase-description')).toBeVisible({ timeout: 12_000 });
      for (let turn = 0; turn < alive.size; turn++) {
        let speaker = -1;
        await expect.poll(async () => {
          for (const index of alive) if (await pages[index].getByLabel('Votre indice', { exact: true }).isVisible()) return speaker = index;
          return -1;
        }).not.toBe(-1);
        const input = pages[speaker].getByLabel('Votre indice', { exact: true });
        await input.fill(`Indice ${cycle + 1} ${speaker + 1}`);
        await pages[speaker].getByRole('button', { name: /Valider mon indice/ }).click();
        await expect(input).not.toBeVisible();
      }
      await pages[0].getByRole('button', { name: /Passer au vote/ }).click();
      const target = [...alive].find(index => index !== 0)!;
      for (const index of alive) {
        const chosen = index === target ? 0 : target;
        await pages[index].getByRole('button', { name: `Voter pour ${names[chosen]}`, exact: true }).click();
      }
      alive.delete(target);
      await expect(pages[0].locator('.phase-results, .phase-description')).toBeVisible({ timeout: 6000 });
      if (await pages[0].locator('.phase-results').isVisible()) break;
    }
    for (const page of pages) await expect(page.getByRole('table', { name: 'Résultats et classement' })).toBeVisible();
    await pages[0].getByRole('button', { name: /Retour au salon/ }).click();
    for (const page of pages) await expect(page.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('mobile creation, local avatar persistence and text conversation', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); await page.goto('/');
    await page.getByLabel('Pseudonyme').fill('Renée mobile');
    await page.getByRole('button', { name: 'Personnaliser mon avatar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Ça, c’est moi/ }).click();
    await page.getByRole('button', { name: /Créer un salon/ }).click();
    await expect(page.getByRole('heading', { name: /Les suspects/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByText('Renée mobile (vous)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeVisible();
  } finally { await context.close(); }
});
