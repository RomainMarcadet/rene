import { expect, test } from '@playwright/test';
import { joinFour } from './helpers';

test('chooses multiple themes for the room with an explicit, persistent 18+ option', async ({ browser, baseURL }) => {
  const { contexts, pages } = await joinFour(browser, baseURL!);
  const host = pages[0];
  try {
    for (const page of pages) {
      await expect(page.getByRole('region', { name: 'Thèmes des mots' })).toContainText('Cinéma · Jeux vidéo · Internet · Musique · Télévision · Culture · Sport · Technologie');
      await expect(page.locator('.theme-adult-badge')).toHaveCount(0);
    }
    await expect(pages[1].getByRole('button', { name: 'Choisir les thèmes' })).toHaveCount(0);
    await host.getByRole('button', { name: 'Choisir les thèmes' }).click();
    const adultOption = host.getByRole('checkbox', { name: /Activer le pack 18/ });
    await expect(adultOption).not.toBeChecked();
    await host.getByRole('button', { name: 'Tout décocher' }).click();
    await expect(host.getByRole('button', { name: 'Enregistrer les règles' })).toBeDisabled();
    await host.getByRole('checkbox', { name: 'Cinéma', exact: true }).check();
    await host.getByRole('checkbox', { name: 'Musique', exact: true }).check();
    await adultOption.check();
    await host.setViewportSize({ width: 390, height: 844 });
    await expect(host.getByRole('dialog')).toBeInViewport({ ratio: 1 });
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host.screenshot({ path: 'output/playwright/themes-mobile.png' });
    await host.getByRole('button', { name: 'Enregistrer les règles' }).click();
    await expect(host.getByRole('dialog')).toHaveCount(0);
    for (const page of pages) {
      const summary = page.getByRole('region', { name: 'Thèmes des mots' });
      await expect(summary).toContainText('Cinéma · Musique');
      await expect(summary.locator('.theme-adult-badge')).toHaveText('18+ activé');
    }
    await expect(host.getByRole('region', { name: 'Thèmes des mots' })).toBeInViewport({ ratio: 1 });
    await expect(host.getByRole('button', { name: 'Choisir les thèmes' })).toBeInViewport({ ratio: 1 });
    await host.screenshot({ path: 'output/playwright/themes-lobby-mobile.png' });
    await host.setViewportSize({ width: 1280, height: 720 });
    await expect(host.getByRole('region', { name: 'Thèmes des mots' })).toBeInViewport({ ratio: 1 });
    await expect(host.getByRole('button', { name: 'Choisir les thèmes' })).toBeInViewport({ ratio: 1 });
    await host.screenshot({ path: 'output/playwright/themes-lobby-desktop.png' });
    await host.getByRole('button', { name: 'Choisir les thèmes' }).click();
    await expect(host.getByRole('checkbox', { name: 'Cinéma', exact: true })).toBeChecked();
    await expect(host.getByRole('checkbox', { name: 'Musique', exact: true })).toBeChecked();
    await adultOption.uncheck();
    await host.getByRole('button', { name: 'Enregistrer les règles' }).click();
    await expect(host.getByRole('dialog')).toHaveCount(0);
    await pages[1].reload();
    const restored = pages[1].getByRole('region', { name: 'Thèmes des mots' });
    await expect(restored).toContainText('Cinéma · Musique');
    await expect(restored.locator('.theme-adult-badge')).toHaveCount(0);
    for (const page of pages) await expect(page.locator('.theme-adult-badge')).toHaveCount(0);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
