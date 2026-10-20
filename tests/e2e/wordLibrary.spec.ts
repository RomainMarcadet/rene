import { test, expect } from '@playwright/test';
import { joinFour } from './helpers';

test('new category filters distribute only fictional private words in browser validation', async ({ browser, baseURL }) => {
  test.setTimeout(60000);
  const { contexts, pages } = await joinFour(browser, baseURL!);
  try {
    await pages[0].getByRole('button', { name: 'Paramètres ⚙', exact: true }).click();
    await expect(pages[0].getByLabel(/^Catégorie/u).locator('option')).toHaveCount(16);
    await pages[0].getByLabel(/^Catégorie/u).selectOption('cinema');
    await pages[0].getByLabel(/^Difficulté/u).selectOption('hard');
    await pages[0].getByRole('button', { name: 'Enregistrer les règles', exact: true }).click();
    for (const page of pages) await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await pages[0].getByRole('button', { name: /Lancer la partie/ }).click();
    await Promise.all(pages.map(async page => {
      const card = page.getByRole('button', { name: /Votre mot secret/ });
      await expect(card).toBeVisible(); await card.click();
      await expect(page.locator('.secret-card strong')).toHaveText(/^Objet fictif [AB] \d+$/u);
      expect(await page.locator('.secret-card').evaluate(node => /clueAxes|v14-/u.test(node.textContent ?? ''))).toBe(false);
    }));
    for (const suffix of ['', '?raw', '?url&inline']) {
      const response = await pages[0].request.get(`/@fs/${process.cwd()}/packages/engine/src/word-data/cinema.json${suffix}`);
      expect(response.status()).toBe(403);
    }
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
