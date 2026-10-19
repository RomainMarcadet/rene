import { test, expect } from '@playwright/test';
import { AppearanceSchema } from '@rene/contracts';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';
import { joinFour, showPanel } from './helpers';
import { avatarScene } from './avatarScene';

test('editing a new avatar updates the same preview, all clients and the restored profile', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const { contexts, pages, names } = await joinFour(browser, baseURL!);
  try {
    await pages[0].setViewportSize({ width: 1586, height: 992 });
    await pages[0].getByRole('button', { name: 'Changer de tête ↗', exact: true }).click();
    const dialog = pages[0].getByRole('dialog');
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.locator('canvas').evaluate(node => Object.assign(window, { __avatarPreview: node }));
    await pages[0].getByLabel('La silhouette', { exact: true }).selectOption('mushroom');
    await pages[0].getByLabel('La coiffure', { exact: true }).selectOption('buns');
    await pages[0].getByLabel('Le regard', { exact: true }).selectOption('uneven');
    await pages[0].getByLabel('L’expression', { exact: true }).selectOption('tongue');
    await pages[0].getByLabel('Le nez', { exact: true }).selectOption('snout');
    await pages[0].getByLabel('Le petit truc', { exact: true }).selectOption('flower');
    await pages[0].getByRole('button', { name: 'Accessoire Violet', exact: true }).click();
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await expect(dialog.locator('.portrait')).toHaveAttribute('data-appearance', 'mushroom:buns:uneven:tongue:snout:flower');
    expect(await dialog.locator('canvas').evaluate(node => node === (window as unknown as { __avatarPreview: Node }).__avatarPreview)).toBe(true);
    await pages[0].screenshot({ path: 'output/playwright/avatar-editor-desktop.png' });
    await pages[0].getByRole('button', { name: /Voilà ma nouvelle tête/ }).click();
    for (const page of pages) await expect(page.locator('.participants li').filter({ hasText: names[0] }).locator('svg')).toHaveAttribute('data-appearance', 'mushroom:buns:uneven:tongue:snout:flower');
    await expect.poll(async () => (await avatarScene(pages[1]))?.names.includes('appearance:mushroom:buns:uneven:tongue:snout:flower')).toBe(true);
    await pages[0].reload();
    await expect(pages[0].locator('.participants li').filter({ hasText: names[0] }).locator('svg')).toHaveAttribute('data-appearance', 'mushroom:buns:uneven:tongue:snout:flower');
    const session = await (await pages[0].request.get('/api/session')).json();
    expect(session.appearance).toMatchObject({ head: 'mushroom', hair: 'buns', accessory: 'flower', accessoryColor: '#8A5DB3' });
    expect(AppearanceSchema.safeParse(session.appearance).success).toBe(true);
    expect(await pages[0].evaluate(() => JSON.parse(localStorage.getItem('rene-profile')!).appearance)).toEqual(session.appearance);
    await pages[0].getByRole('button', { name: 'Changer de tête ↗', exact: true }).click();
    await pages[0].getByRole('button', { name: /Surprends-moi/ }).click();
    await expect(pages[0].getByRole('status').filter({ hasText: 'Une nouvelle tête' })).toBeVisible();
    await pages[0].getByRole('button', { name: /Voilà ma nouvelle tête/ }).click();
    expect(AppearanceSchema.safeParse((await (await pages[0].request.get('/api/session')).json()).appearance).success).toBe(true);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('mobile editor supports all categories, no accessory, colours and legacy local profiles', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const { accessoryColor: _color, ...legacy } = AVATAR_SPECIMENS[0];
    await page.addInitScript(appearance => { if (!localStorage.getItem('rene-profile')) localStorage.setItem('rene-profile', JSON.stringify({ name: 'Renée mobile', appearance })); }, legacy);
    await page.goto('/'); await page.getByRole('button', { name: 'Personnaliser mon avatar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('canvas')).toBeVisible();
    await page.getByLabel('La silhouette', { exact: true }).selectOption('tall');
    await page.getByLabel('La coiffure', { exact: true }).selectOption('bob');
    await page.getByLabel('Le regard', { exact: true }).selectOption('worried');
    await page.getByLabel('L’expression', { exact: true }).selectOption('tooth');
    await page.getByLabel('Le nez', { exact: true }).selectOption('none');
    await page.getByLabel('La coiffure', { exact: true }).selectOption('none');
    await page.getByLabel('Le petit truc', { exact: true }).selectOption('hat');
    await expect.poll(() => page.evaluate(async () => {
      const fiberPath = '/node_modules/.vite/deps/@react-three_fiber.js'; const threePath = '/node_modules/.vite/deps/three.js';
      const { _roots } = await import(fiberPath); const { Box3, Vector3 } = await import(threePath);
      for (const [canvas, root] of _roots) {
        if (!canvas.closest('.editor-3d')) continue;
        const state = root.store.getState(); const head = state.scene.getObjectByName('appearance:tall:none:worried:tooth:none:hat');
        if (!head) return 2;
        const bounds = new Box3().setFromObject(head); let maximum = 0;
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new Vector3(x, y, z).project(state.camera); maximum = Math.max(maximum, Math.abs(p.x), Math.abs(p.y));
        }
        return maximum;
      }
      return 2;
    })).toBeLessThan(.98);
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: 'output/playwright/avatar-mobile-tall-hat.png' });
    await page.getByLabel('La coiffure', { exact: true }).selectOption('bob');
    await page.getByLabel('Le petit truc', { exact: true }).selectOption('none');
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: 'output/playwright/avatar-editor-mobile.png' });
    await page.getByRole('button', { name: 'Visage Menthe', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Visage Menthe', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.getByRole('button', { name: /Ça, c’est moi/ }).click();
    await page.getByRole('button', { name: /Créer un salon/ }).click();
    await page.reload(); await showPanel(page, 'Suspects');
    await expect(page.locator('.participants li svg')).toHaveAttribute('data-appearance', 'tall:bob:worried:tooth:none:none');
    await page.screenshot({ path: 'output/playwright/avatar-hub-mobile.png' });
  } finally { await context.close(); }
});

test('the workshop shows four new trios in 3D with matching SVG portraits', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1586, height: 1100 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?art=1');
  for (let collection = 1; collection <= 4; collection++) {
    await page.getByRole('button', { name: 'Suivants →', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(`Collection ${collection + 1} / 5`);
    await expect(page.locator('.art-portraits .portrait')).toHaveCount(3);
    const models = AVATAR_SPECIMENS.slice((collection - 1) * 3, collection * 3);
    for (const [index, a] of models.entries()) await expect(page.locator('.art-portraits .portrait').nth(index)).toHaveAttribute('data-appearance', [a.head, a.hair, a.eyes, a.mouth, a.nose, a.accessory].join(':'));
    await expect.poll(async () => (await avatarScene(page))?.names).toEqual(models.map(a => `appearance:${a.head}:${a.hair}:${a.eyes}:${a.mouth}:${a.nose}:${a.accessory}`));
    await page.screenshot({ path: `output/playwright/avatar-collection-${collection}.png`, fullPage: true });
  }
});
