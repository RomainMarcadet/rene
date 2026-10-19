import { test, expect, type Page } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { DEFAULT_APPEARANCE, type Ack, type Command, type RoomSnapshot } from '@rene/contracts';
import { showPanel, submitDescription } from './helpers';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/store.ts'; const { useGame } = await import(path);
    return useGame.getState().room as RoomSnapshot;
  });
}

for (const count of [4, 8, 12]) test(`all current clues remain readable with ${count} connected players`, async ({ page, playwright, baseURL }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const Original = window.RTCPeerConnection;
    const peers: RTCPeerConnection[] = []; Object.assign(window, { __uxVoicePeers: peers });
    window.RTCPeerConnection = class extends Original { constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) { super(...args); peers.push(this); } };
  });
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Renée');
  await page.getByRole('button', { name: /Créer un salon/ }).click();
  await expect(page.locator('.room-code')).toBeVisible();
  const code = new URL(page.url()).searchParams.get('room')!;
  const clients = new Map<string, Socket>();
  const contexts: Awaited<ReturnType<typeof playwright.request.newContext>>[] = [];
  const send = (client: Socket, command: Command, phaseId?: string) => new Promise<Ack>((resolve, reject) => client.timeout(5000).emit('command', { id: crypto.randomUUID(), command, ...(phaseId ? { phaseId } : {}) }, (error: Error | null, ack: Ack) => error ? reject(error) : resolve(ack)));
  try {
    for (let i = 1; i < count; i++) {
      const context = await playwright.request.newContext({ baseURL }); contexts.push(context);
      const id = (await (await context.get('/api/session')).json()).playerId;
      const cookie = (await context.storageState()).cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const client = io(baseURL!, { transports: ['websocket'], autoConnect: false, extraHeaders: { Cookie: cookie, Origin: baseURL! } }); clients.set(id, client);
      await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); client.connect(); });
      expect((await send(client, { type: 'room.join', code, name: `Suspect ${i + 1}`, appearance: DEFAULT_APPEARANCE })).ok).toBe(true);
    }
    await expect(page.locator('.participants li')).toHaveCount(count);
    for (const client of clients.values()) expect((await send(client, { type: 'player.ready', ready: true })).ok).toBe(true);
    await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await page.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(page.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    const initialOrder = await page.locator('.current-round li').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-player-id')));
    const slots = () => page.locator('.current-round li').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y }; }));
    const initialSlots = await slots();
    for (let i = 0; i < count; i++) {
      const game = (await snapshot(page)).game!;
      // Public, invented contributions only: never show a private word in captures.
      const text = `${i + 1} · Un petit détail, une idée qui rassemble et assez de mystère pour faire hésiter tout le salon.`;
      const client = clients.get(game.turnPlayerId!);
      if (client) expect((await send(client, { type: 'game.describe', text }, game.phaseId)).ok).toBe(true);
      else {
        await page.setViewportSize({ width: 390, height: 844 });
        await showPanel(page, 'Indices');
        await expect(page.getByLabel('Votre indice', { exact: true })).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: /Valider mon indice/ })).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.current-round [aria-current="step"]')).toBeInViewport({ ratio: 1 });
        await page.setViewportSize({ width: 1586, height: 992 });
        await expect(page.locator('.layout-desktop')).toBeVisible();
        await submitDescription(page, text);
      }
      await expect.poll(async () => (await snapshot(page)).game!.descriptions.length).toBe(i + 1);
      expect(await page.locator('.current-round li').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-player-id')))).toEqual(initialOrder);
      expect(await slots()).toEqual(initialSlots);
    }
    const firstClient = clients.entries().next().value!;
    expect((await send(firstClient[1], { type: 'chat.send', text: 'Une couleur, le même suspect partout.' })).ok).toBe(true);
    for (const selector of ['.participant-info', '.avatar-name', '.current-round', '.chat-message']) {
      await expect(page.locator(`${selector} .player-identity[data-player-mark="1"]`)).toHaveCount(1);
      expect(await page.locator(`${selector} .player-identity[data-player-mark="1"]`).evaluate(node => getComputedStyle(node).getPropertyValue('--player-color'))).toBe('#F34531');
    }
    const voice = process.env.RENE_VOICE_E2E === '1';
    if (voice) {
      await page.getByRole('button', { name: /Rejoindre le vocal/ }).click();
      await expect(page.locator('.voice-panel')).toContainText('Dans la conversation', { timeout: 20000 });
    }
    const peers = () => page.evaluate(() => (window as unknown as { __uxVoicePeers: RTCPeerConnection[] }).__uxVoicePeers.length);
    const connectedPeers = await peers();
    if (voice) expect(connectedPeers).toBeGreaterThan(0);
    for (const [width, height] of [[1586, 992], [1366, 768], [1024, 768], [390, 844], [844, 390]] as const) {
      await page.setViewportSize({ width, height });
      await showPanel(page, 'Indices');
      await page.screenshot({ path: `output/playwright/v1.3.1-after-${count}-${width}x${height}.png` });
      await expect(page.locator('.current-round li')).toHaveCount(count);
      const panel = (await page.locator('.clues-zone').boundingBox())!;
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(height);
      for (const selector of ['.clues-zone', '.history-rounds', '.current-round', '.current-round ol', '.current-round li']) {
        expect(await page.locator(selector).evaluateAll(nodes => nodes.map(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, height: node.clientHeight, scrollHeight: node.scrollHeight })).filter(node => node.scrollWidth > node.width + 1 || node.scrollHeight > node.height + 1)), `${selector} at ${width}×${height}, ${count} players`).toEqual([]);
      }
      for (const selector of ['.gameplay-zone', '.voice-panel', '.chat-panel', '.drawer-tabs']) {
        if (!await page.locator(selector).isVisible()) continue;
        const other = (await page.locator(selector).boundingBox())!;
        expect(other.y + other.height, `${selector} outside the window at ${width}×${height}`).toBeLessThanOrEqual(height + 1);
        expect(panel.x + panel.width <= other.x + 1 || other.x + other.width <= panel.x + 1 || panel.y + panel.height <= other.y + 1 || other.y + other.height <= panel.y + 1, `${selector} overlaps clues at ${width}×${height}: ${JSON.stringify({ panel, other })}`).toBe(true);
      }
      if (voice) {
        await expect(page.locator('.voice-panel')).toContainText('Dans la conversation');
        await expect(page.getByRole('button', { name: 'Écoute : activée', exact: true })).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: 'Maintenir pour parler · V', exact: true })).toBeInViewport({ ratio: 1 });
        expect(await peers()).toBe(connectedPeers);
      }
      for (const card of await page.locator('.current-round li').all()) await expect(card).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1586, height: 992 });
    await page.getByRole('button', { name: /Passer au vote/ }).click();
    await expect(page.locator('.vote-grid .player-identity')).toHaveCount(count - 1);
    const marks = (await snapshot(page)).game!.playerMarks;
    await page.reload();
    await expect(page.locator('.phase-vote')).toBeVisible();
    expect((await snapshot(page)).game!.playerMarks).toEqual(marks);
  } finally { clients.forEach(client => client.disconnect()); await Promise.all(contexts.map(context => context.dispose())); }
});
