import { test, expect, type Page } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { type Ack, type Command, type RoomSnapshot } from '@rene/contracts';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';
import { showPanel, submitDescription } from './helpers';

test.use({ launchOptions: { executablePath: process.env.RENE_CHROMIUM_EXECUTABLE_PATH, args: ['--autoplay-policy=no-user-gesture-required'] } });
const viewports = [[1586, 992], [1366, 768], [1024, 768], [768, 1024], [390, 844], [844, 390]] as const;

async function relativeSlots(page: Page) {
  return page.locator('.current-round li').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect(); const panel = node.closest('.clues-zone')!.getBoundingClientRect();
    const scroll = node.closest('.history-rounds')!;
    return { x: box.x - panel.x + scroll.scrollLeft, y: box.y - panel.y + scroll.scrollTop };
  }));
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/store.ts'; const { useGame } = await import(path);
    return useGame.getState().room as RoomSnapshot;
  });
}

async function expectCardIdentities(page: Page) {
  const players = (await snapshot(page)).players;
  const cards = await page.locator('.current-round li').evaluateAll(nodes => nodes.map(node => {
    const portrait = node.querySelector('.clue-portrait')!;
    const text = getComputedStyle(node.querySelector('.clue-text')!);
    const name = getComputedStyle(node.querySelector('.player-name')!);
    const surface = getComputedStyle(node);
    const normalize = (value: string) => { const element = document.createElement('span'); element.style.color = value; return element.style.color; };
    return {
      id: node.getAttribute('data-player-id'), appearance: portrait.querySelector('svg')?.getAttribute('data-appearance'),
      colour: surface.backgroundColor === normalize(surface.getPropertyValue('--player-color')),
      contrast: text.color === normalize(surface.getPropertyValue('--player-foreground')) && name.color === text.color,
      hierarchy: parseFloat(name.fontSize) > parseFloat(text.fontSize) && node.querySelector('.clue-author')!.getBoundingClientRect().bottom <= node.querySelector('.clue-text')!.getBoundingClientRect().top + 1,
      numbered: node.querySelector('.player-token') !== null,
      portraitVisible: getComputedStyle(portrait).display !== 'none' && portrait.getBoundingClientRect().width >= 32 && portrait.getBoundingClientRect().height >= 37,
    };
  }));
  for (const card of cards) {
    const a = players.find(p => p.id === card.id)!.appearance;
    expect(card.appearance).toBe([a.head, a.hair, a.eyes, a.mouth, a.nose, a.accessory].join(':'));
    expect(card.colour, `identity colour for ${card.id}`).toBe(true);
    expect(card.contrast, `foreground contrast for ${card.id}`).toBe(true);
    expect(card.hierarchy, `name above the clue for ${card.id}`).toBe(true);
    expect(card.numbered, `no assigned number for ${card.id}`).toBe(false);
    expect(card.portraitVisible, `recognizable portrait for ${card.id}`).toBe(true);
  }
}

for (const count of [4, 6, 8, 12]) test(`all current clues remain readable with ${count} connected players`, async ({ page, playwright, baseURL }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(appearance => {
    if (!localStorage.getItem('rene-profile')) localStorage.setItem('rene-profile', JSON.stringify({ name: 'Renée', appearance }));
  }, AVATAR_SPECIMENS[0]);
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
      expect((await send(client, { type: 'room.join', code, name: i === count - 1 ? 'Alexandrine du Grandpré' : `Suspect ${i + 1}`, appearance: AVATAR_SPECIMENS[i] })).ok).toBe(true);
    }
    await expect(page.locator('.participants li')).toHaveCount(count);
    for (const client of clients.values()) expect((await send(client, { type: 'player.ready', ready: true })).ok).toBe(true);
    await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click();
    await page.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(page.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    await expectCardIdentities(page);
    await expect(page.locator('.current-round [aria-current="step"]')).toContainText('À son tour');
    await expect(page.locator('.current-round .clue-turn')).toHaveCount(1);
    const waitingSlots = new Map<string, Awaited<ReturnType<typeof relativeSlots>>>();
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await showPanel(page, 'Indices');
      await expect(page.locator('.clues-zone')).toBeVisible();
      waitingSlots.set(`${width}x${height}`, await relativeSlots(page));
    }
    await page.setViewportSize({ width: 1586, height: 992 });
    await expect(page.locator('.layout-desktop')).toBeVisible();
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
        await page.locator('.current-round [aria-current="step"]').scrollIntoViewIfNeeded();
        // Native scrolling can round the last card edge by a fraction of a pixel.
        await expect(page.locator('.current-round [aria-current="step"]')).toBeInViewport({ ratio: 0.99 });
        await page.setViewportSize({ width: 1586, height: 992 });
        await expect(page.locator('.layout-desktop')).toBeVisible();
        await submitDescription(page, text);
      }
      await expect.poll(async () => (await snapshot(page)).game!.descriptions.length).toBe(i + 1);
      expect(await page.locator('.current-round li').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-player-id')))).toEqual(initialOrder);
      expect(await slots()).toEqual(initialSlots);
      if (count === 12 && i === Math.floor(count / 2)) {
        await page.screenshot({ path: 'output/playwright/v1.3.2-active-desktop.png' });
        await page.setViewportSize({ width: 390, height: 844 });
        await showPanel(page, 'Indices');
        await expectCardIdentities(page);
        await page.screenshot({ path: 'output/playwright/v1.3.2-active-mobile.png' });
        await page.setViewportSize({ width: 1586, height: 992 });
        await expect(page.locator('.layout-desktop')).toBeVisible();
      }
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
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await showPanel(page, 'Indices');
      await page.locator('.history-rounds').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: `output/playwright/v1.3.2-${process.env.RENE_CLUE_CAPTURE ?? 'after'}-${count}-${width}x${height}.png` });
      await expectCardIdentities(page);
      expect(await relativeSlots(page), `stable slots at ${width}×${height}`).toEqual(waitingSlots.get(`${width}x${height}`));
      await expect(page.locator('.current-round li')).toHaveCount(count);
      const panel = (await page.locator('.clues-zone').boundingBox())!;
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(height);
      const compact = await page.locator('.layout-mobile').isVisible();
      for (const selector of ['.clues-zone', '.history-rounds', '.current-round', '.current-round ol', '.current-round li']) {
        const allowVerticalScroll = compact && selector === '.history-rounds';
        expect(await page.locator(selector).evaluateAll((nodes, allowScroll) => nodes.map(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, height: node.clientHeight, scrollHeight: node.scrollHeight })).filter(node => node.scrollWidth > node.width + 1 || (!allowScroll && node.scrollHeight > node.height + 1)), allowVerticalScroll), `${selector} at ${width}×${height}, ${count} players`).toEqual([]);
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
      // Small screens preserve complete, readable cards in one native scroll region.
      // Every card must be reachable without moving the gameplay or voice controls.
      for (const card of await page.locator('.current-round li').all()) {
        if (compact) await card.scrollIntoViewIfNeeded();
        await expect(card).toBeInViewport({ ratio: 0.99 });
      }
      if (compact && count === 12 && width === 390) {
        const region = page.getByRole('region', { name: 'Indices publics', exact: true });
        await region.evaluate(node => { node.scrollTop = 0; });
        await region.focus();
        const pose = () => page.evaluate(async () => {
          const storePath = '/src/store.ts'; const posesPath = '/src/poses.ts';
          const [{ useGame }, { getPose }] = await Promise.all([import(storePath), import(posesPath)]);
          const state = useGame.getState(); const player = state.room!.players.find((p: { id: string }) => p.id === state.session!.playerId)!;
          return getPose(player.id, player.position);
        });
        const before = await pose();
        await page.keyboard.press('PageDown');
        await expect.poll(() => region.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
        expect(await pose()).toEqual(before);
        await expect(page.locator('.voice-panel')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.drawer-tabs')).toBeInViewport({ ratio: 1 });
      }
      await page.locator('.history-rounds').evaluate(node => { node.scrollTop = 0; });
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
