import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { livingCamera as camera, livingRoom, livingState } from './livingRoomFixture';
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, video: { mode: 'on', size: { width: 390, height: 844 } } });
test.afterEach(async ({ page }, info) => { const video = page.video(); await page.close(); if (video && info.status === 'passed') { await mkdir('output/playwright', { recursive: true }); await video.saveAs('output/playwright/v1.4-touch.webm'); } });
test('two fingers move and orbit together; drawer cancels movement; personality persists', async ({ page, playwright, baseURL }) => {
  test.setTimeout(60000);
  const f = await livingRoom(page, playwright, baseURL!, 4);
  try {
    await expect(page.locator('.joystick')).toBeVisible(); const before = await camera(page); const box = (await page.locator('.joystick').boundingBox())!;
    const cdp = await page.context().newCDPSession(page); const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.joystick'), { x, y })).toBe(true);
    const area = before.area; const cx = area.left + area.width * .6; const cy = area.top + area.height * .4;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }, { x: cx, y: cy, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 30, y, id: 1 }, { x: cx + 60, y: cy + 10, id: 2 }] });
    try { await expect.poll(async () => { const p = (await camera(page)).local; return Math.hypot(p.x - before.local.x, p.z - before.local.z); }).toBeGreaterThan(.3); }
    finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    const after = await camera(page); expect(after).toMatchObject({ blocked: false }); expect(Math.abs(after.orbitYaw - before.orbitYaw)).toBeGreaterThan(.2); expect(Math.hypot(after.local.x - before.local.x, after.local.z - before.local.z)).toBeGreaterThan(.3);
    await page.waitForTimeout(150); const stopped = (await camera(page)).local; await page.waitForTimeout(200); expect((await camera(page)).local).toEqual(stopped);
    await page.screenshot({ path: 'output/playwright/v1.4-touch.png' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 20, y, id: 1 }] });
    await page.getByRole('navigation', { name: 'Panneaux du salon' }).getByRole('button', { name: /^Suspects/ }).evaluate(button => (button as HTMLButtonElement).click());
    await expect(page.locator('.joystick')).toHaveCount(0); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150); const paused = (await livingState(page)).players.find(p => p.name === 'Camille')!.position;
    await page.waitForTimeout(200); expect((await livingState(page)).players.find(p => p.name === 'Camille')!.position).toEqual(paused);
    await page.getByRole('button', { name: /Changer de tête/ }).click();
    await page.getByLabel('L’allure', { exact: true }).selectOption('nervous'); await page.screenshot({ path: 'output/playwright/v1.4-personality-mobile.png' }); await page.getByRole('button', { name: /Voilà ma nouvelle tête/ }).click();
    await expect.poll(() => f.actors[0].room?.players.find(p => p.name === 'Camille')?.appearance.personality).toBe('nervous');
    await page.getByRole('navigation', { name: 'Panneaux du salon' }).getByRole('button', { name: /^Suspects/ }).click();
    await expect(page.locator('.joystick')).toBeVisible(); const resumed = (await camera(page)).local; const pad = (await page.locator('.joystick').boundingBox())!;
    const px = pad.x + pad.width / 2; const py = pad.y + pad.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: px - 25, y: py, id: 1 }] });
    try { await expect.poll(async () => { const p = (await camera(page)).local; return Math.hypot(p.x - resumed.x, p.z - resumed.z); }).toBeGreaterThan(.15); }
    finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    await page.reload(); await expect(page.locator('.participants li')).toHaveCount(4);
    expect((await livingState(page)).players.find(p => p.name === 'Camille')!.appearance.personality).toBe('nervous');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rene-profile')!).appearance.personality)).toBe('nervous');
  } finally { await f.close(); }
});
