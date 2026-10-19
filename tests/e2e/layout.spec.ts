import { test, expect, type Page } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { DEFAULT_APPEARANCE, type Ack, type Command, type RoomSnapshot } from '@rene/contracts';
import { showPanel } from './helpers';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';
import { avatarScene } from './avatarScene';

async function inViewport(page: Page, selector: string) {
  const rect = (await page.locator(selector).boundingBox())!; const size = page.viewportSize()!;
  expect(rect.x).toBeGreaterThanOrEqual(-1); expect(rect.y).toBeGreaterThanOrEqual(-1);
  expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 1);
  return rect;
}

test('twelve real participants, bounded HUD at five sizes, persistent draft and Canvas', async ({ page, playwright, baseURL }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(appearance => localStorage.setItem('rene-profile', JSON.stringify({ name: 'Renée du salon', appearance })), AVATAR_SPECIMENS[0]);
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Renée du salon');
  await page.getByRole('button', { name: /Créer un salon/ }).click();
  await expect(page.locator('.room-code')).toBeVisible();
  const code = new URL(page.url()).searchParams.get('room')!;
  const clients: Socket[] = [];
  const identities: string[] = [];
  const contexts: Awaited<ReturnType<typeof playwright.request.newContext>>[] = [];
  const send = (client: Socket, command: Command, phaseId?: string) => new Promise<Ack>((resolve, reject) => client.timeout(5000).emit('command', { id: crypto.randomUUID(), command, ...(phaseId ? { phaseId } : {}) }, (error: Error | null, ack: Ack) => error ? reject(error) : resolve(ack)));
  const snapshot = () => page.evaluate(async () => {
    const path = '/src/store.ts'; const { useGame } = await import(path);
    return useGame.getState().room as RoomSnapshot;
  });
  try {
    for (let i = 1; i < 12; i++) {
      const context = await playwright.request.newContext({ baseURL }); contexts.push(context);
      identities.push((await (await context.get('/api/session')).json()).playerId);
      const cookie = (await context.storageState()).cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const client = io(baseURL!, { transports: ['websocket'], autoConnect: false, extraHeaders: { Cookie: cookie, Origin: baseURL! } }); clients.push(client);
      await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); client.connect(); });
      expect((await send(client, { type: 'room.join', code, name: `Suspect bavard numéro ${i}`, appearance: AVATAR_SPECIMENS[i] })).ok).toBe(true);
      expect((await send(client, { type: 'player.ready', ready: true })).ok).toBe(true);
    }
    await expect(page.locator('.participants li')).toHaveCount(12);
    await expect(page.locator('.lobby-capacity')).toHaveText('12/12');
    await expect.poll(async () => (await avatarScene(page))?.names.length).toBe(12);
    const metrics = (await avatarScene(page))!;
    expect(metrics.calls).toBeLessThan(650);
    console.log('Twelve-avatar scene metrics:', JSON.stringify(metrics));
    await page.screenshot({ path: 'output/playwright/avatar-twelve-desktop.png' });
    for (let i = 0; i < 6; i++) expect((await send(clients[i], { type: 'chat.send', text: `${i} · ${'Une conversation qui prend ses aises. '.repeat(10)}` })).ok).toBe(true);
    await expect(page.locator('.chat-message')).toHaveCount(6);
    expect(await page.locator('.chat-messages').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    expect(await page.locator('.suspects-zone').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await page.getByLabel('Message au salon').fill('Mon brouillon reste ici.');
    await page.locator('.hub-canvas canvas').evaluate(node => Object.assign(window, { __reneCanvas: node }));
    await page.getByLabel('Message au salon').evaluate(node => Object.assign(window, { __reneInput: node }));
    for (const [width, height, layout] of [[1586, 992, 'desktop'], [1366, 768, 'desktop'], [1024, 768, 'intermediate'], [390, 844, 'mobile'], [844, 390, 'mobile']] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.locator(`.layout-${layout}`)).toBeVisible();
      const selected = page.locator('.drawer-tabs button[aria-expanded=true]');
      if (await selected.isVisible()) await selected.click();
      const canvas = await inViewport(page, '.hub-canvas canvas');
      expect(canvas.width).toBe(width); expect(canvas.height).toBe(height);
      const gameplay = await inViewport(page, '.gameplay-zone');
      const actions = await inViewport(page, '.lobby-actions');
      expect(actions.y + actions.height).toBeLessThanOrEqual(gameplay.y + gameplay.height);
      const voice = await inViewport(page, '.voice-panel');
      expect(gameplay.y + gameplay.height).toBeLessThanOrEqual(voice.y + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.tagName)).toBe('CANVAS');
      await page.screenshot({ path: `output/playwright/v1.3-${width}x${height}.png` });
      if (layout !== 'desktop') {
        await showPanel(page, 'Suspects'); await inViewport(page, '.suspects-zone');
        await expect(page.locator('.participants li')).toHaveCount(12);
        if (width === 390) await page.screenshot({ path: 'output/playwright/v1.3-mobile-drawer.png' });
        if (layout === 'mobile') { await showPanel(page, 'Discussion'); await inViewport(page, '.chat-panel'); }
      }
      await expect(page.getByLabel('Message au salon')).toHaveValue('Mon brouillon reste ici.');
      expect(await page.locator('.hub-canvas canvas').evaluate(node => node === (window as unknown as { __reneCanvas: Node }).__reneCanvas)).toBe(true);
      expect(await page.getByLabel('Message au salon').evaluate(node => node === (window as unknown as { __reneInput: Node }).__reneInput)).toBe(true);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    const smallChat = (await page.locator('.communication-zone').boundingBox())!;
    await page.getByRole('button', { name: 'Agrandir la discussion' }).click();
    const largeChat = await inViewport(page, '.communication-zone.expanded');
    expect(largeChat.width).toBeGreaterThan(smallChat.width + 200);
    expect(largeChat.height).toBeGreaterThan(smallChat.height + 150);
    await expect(page.getByRole('button', { name: 'Réduire la discussion' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Agrandir la discussion' })).toBeFocused();
    await expect(page.getByLabel('Message au salon')).toHaveValue('Mon brouillon reste ici.');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
    await expect.poll(() => page.locator('.room-page').evaluate(node => Math.abs(node.getBoundingClientRect().width - visualViewport!.width))).toBeLessThan(1);
    await expect.poll(() => page.locator('.room-page').evaluate(node => Math.abs(node.getBoundingClientRect().height - visualViewport!.height))).toBeLessThan(1);
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    // A departed author's recorded name survives with a neutral portrait.
    clients[0].disconnect();
    await expect(page.getByRole('button', { name: 'Retirer Suspect bavard numéro 1 du salon' })).toBeVisible();
    await page.getByRole('button', { name: 'Retirer Suspect bavard numéro 1 du salon' }).click();
    await expect(page.locator('.neutral-portrait')).toHaveCount(1);
    await expect(page.locator('.chat-message').first()).toContainText('Suspect bavard numéro 1');
    await page.reload();
    await expect(page.locator('.participants li')).toHaveCount(11);
    await new Promise<void>((resolve, reject) => { clients[0].once('connect', resolve); clients[0].once('connect_error', reject); clients[0].connect(); });
    expect((await send(clients[0], { type: 'room.join', code, name: 'Suspect bavard numéro 1', appearance: DEFAULT_APPEARANCE })).ok).toBe(true);
    await expect(page.locator('.participants li')).toHaveCount(12);
    for (const client of clients) expect((await send(client, { type: 'player.ready', ready: true })).ok).toBe(true);
    await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await page.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(page.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 12; i++) {
      const game = (await snapshot()).game!;
      const actor = identities.indexOf(game.turnPlayerId!);
      const text = `${i + 1} · Un indice assez long pour tester le retour à la ligne sur cette petite carte.`;
      if (actor === -1) {
        await page.getByLabel('Votre indice', { exact: true }).fill(text);
        await page.getByRole('button', { name: /Valider mon indice/ }).click();
      } else expect((await send(clients[actor], { type: 'game.describe', text }, game.phaseId)).ok).toBe(true);
      await expect.poll(async () => (await snapshot()).game!.descriptions.length).toBe(i + 1);
    }
    await expect(page.locator('.history-rounds li')).toHaveCount(12);
    await page.screenshot({ path: 'output/playwright/v1.3-twelve-clues.png' });
    await page.getByRole('button', { name: /Passer au vote/ }).click();
    await expect(page.locator('.vote-grid button')).toHaveCount(11);
    await page.locator('.vote-grid button').last().click();
    await expect(page.locator('.game-panel')).toContainText('Votre vote est enregistré');
    await page.screenshot({ path: 'output/playwright/v1.3-twelve-vote.png' });
  } finally { clients.forEach(c => c.disconnect()); await Promise.all(contexts.map(c => c.dispose())); }
});

test('the room remains playable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Sans WebGL');
  await page.getByRole('button', { name: /Créer un salon/ }).click();
  await expect(page.locator('.scene-fallback')).toBeVisible();
  await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
  await expect(page.getByRole('button', { name: '✓ Je suis prêt', exact: true })).toBeVisible();
  await page.getByLabel('Message au salon').fill('Toujours dans le salon.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.locator('.chat-message')).toContainText('Toujours dans le salon.');
});
