import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export async function joinFour(browser: Browser, baseURL: string, mobileIndex = -1) {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({ baseURL, ...(i === mobileIndex ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}) }); contexts.push(context);
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
    await expect(pages[i].locator('.room-code')).toBeVisible();
    await expect(pages[i].locator('.participants > li')).toHaveCount(i + 1);
  }
  return { contexts, pages, names };
}

export async function showPanel(page: Page, panel: 'Suspects' | 'Indices' | 'Discussion') {
  await expect(page.locator('.room-code')).toBeVisible();
  const button = page.getByRole('navigation', { name: 'Panneaux du salon' }).getByRole('button', { name: new RegExp(`^${panel}`) });
  if (await button.isVisible() && await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

export async function voiceSettings(page: Page) {
  const details = page.locator('.voice-settings');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
}

export async function setMicrophoneMode(page: Page, mode: 'open' | 'ptt') {
  await voiceSettings(page);
  await page.getByLabel('Mode du microphone').selectOption(mode);
  await page.locator('.voice-settings summary').click();
}

