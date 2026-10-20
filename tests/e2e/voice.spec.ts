import { test, expect, type Browser, type Page } from '@playwright/test';
import { setMicrophoneMode, showPanel, submitDescription, voiceSettings } from './helpers';
import { livingUI } from './livingRoomFixture';

test.skip(process.env.RENE_VOICE_E2E !== '1', 'Requires the local LiveKit service (RENE_VOICE_E2E=1).');
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', ...(process.env.RENE_VOICE_SAMPLE ? ['--use-file-for-fake-audio-capture=' + process.env.RENE_VOICE_SAMPLE] : [])] } });

async function pair(browser: Browser, baseURL: string) {
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ baseURL, permissions: ['microphone'] })));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  for (const page of pages) await page.addInitScript(() => {
    const Original = window.RTCPeerConnection;
    const peers: RTCPeerConnection[] = [];
    Object.assign(window, { __voicePeers: peers });
    window.RTCPeerConnection = class extends Original { constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) { super(...args); peers.push(this); } };
  });
  await pages[0].goto('/'); await pages[0].getByLabel('Pseudonyme').fill('Micro René');
  await pages[0].getByRole('button', { name: /Créer un salon/ }).click();
  await expect(pages[0]).toHaveURL(/room=/);
  await pages[1].goto(pages[0].url()); await pages[1].getByLabel('Pseudonyme').fill('Oreilles René');
  await pages[1].getByRole('button', { name: 'Rejoindre →', exact: true }).click();
  for (const page of pages) { await page.getByRole('button', { name: /Rejoindre le vocal/ }).click(); await expect(page.locator('.voice-panel')).toContainText('Dans la conversation', { timeout: 20000 }); }
  return { contexts, pages };
}

async function received(page: Page) {
  return page.evaluate(async () => {
    const peers = (window as unknown as { __voicePeers: RTCPeerConnection[] }).__voicePeers;
    let bytes = 0;
    for (const peer of peers) if (peer.connectionState !== 'closed') (await peer.getStats()).forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') bytes += report.bytesReceived ?? 0;
    });
    return bytes;
  });
}

test('muting the microphone keeps a subscribed, playing remote audio track', async ({ browser, baseURL }) => {
  const { contexts, pages } = await pair(browser, baseURL!);
  try {
    for (const page of pages) { await setMicrophoneMode(page, 'open'); await page.getByRole('button', { name: 'Ouvrir mon microphone', exact: true }).click(); }
    await expect.poll(() => received(pages[0])).toBeGreaterThan(0);
    await pages[0].getByRole('button', { name: 'Couper mon microphone', exact: true }).click();
    await expect(pages[0].locator('.microphone-state')).toContainText('Microphone : coupé');
    const before = await received(pages[0]);
    await expect.poll(() => received(pages[0])).toBeGreaterThan(before + 1000);
    expect(await pages[0].locator('.voice-panel audio').evaluateAll(nodes => nodes.some(node => {
      const audio = node as HTMLAudioElement; return !audio.muted && !audio.paused && !!audio.srcObject;
    }))).toBe(true);
    await pages[0].getByRole('button', { name: 'Écoute : activée', exact: true }).click();
    expect(await pages[0].locator('.voice-panel audio').evaluateAll(nodes => nodes.every(node => (node as HTMLAudioElement).muted))).toBe(true);
    await expect(pages[0].locator('.microphone-state')).toContainText('coupé');
    await pages[0].getByRole('button', { name: 'Écoute : désactivée', exact: true }).click();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('remote speech animates the mouth throughout an articulated emote', async ({ browser, baseURL }) => {
  test.skip(!process.env.RENE_VOICE_SAMPLE, 'Requires an original speech WAV via RENE_VOICE_SAMPLE for LiveKit voice activity detection.');
  const { contexts, pages } = await pair(browser, baseURL!);
  try {
    const sender = pages[1]; const observer = pages[0];
    const senderId = await sender.evaluate(async () => { const path = '/src/store.ts'; return (await import(path)).useGame.getState().session.playerId; });
    await setMicrophoneMode(sender, 'open');
    await sender.getByRole('button', { name: 'Ouvrir mon microphone', exact: true }).click();
    await expect.poll(() => received(observer)).toBeGreaterThan(1000);
    const face = () => observer.evaluate(async id => {
      const path = '/src/store.ts'; const store = (await import(path)).useGame.getState();
      const scenePath = '/node_modules/.vite/deps/@react-three_fiber.js'; const { _roots } = await import(scenePath);
      const root = [..._roots.values()].find(r => r.store.getState().gl.domElement.closest('.hub-canvas'));
      return { speaking: store.speaking.includes(id), kind: store.room.social.players[id]?.animation?.kind,
        scale: root?.store.getState().scene.getObjectByName('player:' + id)?.getObjectByName('avatar-mouth')?.scale.y ?? 0 };
    }, senderId);
    await expect.poll(async () => (await face()).speaking).toBe(true);
    expect(await livingUI(sender, { type: 'player.emote', kind: 'macarena_full' })).toBe(true);
    await expect.poll(async () => { const f = await face(); return f.speaking && f.kind === 'macarena_full' && f.scale > 1.1; }).toBe(true);
    await sender.getByRole('button', { name: 'Couper mon microphone', exact: true }).click();
    await expect.poll(async () => (await face()).speaking).toBe(false);
    await expect.poll(async () => (await face()).scale).toBe(1);
    await expect(observer.locator('.voice-panel')).toContainText('Dans la conversation');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('a stale voice generation is retried instead of leaving the listener disconnected', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Décalage René');
  await page.getByRole('button', { name: /Créer un salon/ }).click();
  let requests = 0;
  await page.route('**/api/voice', async route => {
    const response = await route.fetch(); const json = await response.json();
    if (++requests === 1) json.generation++;
    await route.fulfill({ response, json });
  });
  await page.getByRole('button', { name: /Rejoindre le vocal/ }).click();
  await expect(page.locator('.voice-panel')).toContainText('Dans la conversation', { timeout: 6000 });
  expect(requests).toBeGreaterThan(1);
});

test('expanding, folding and resizing keeps LiveKit, listening and the draft alive', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const { contexts, pages } = await pair(browser, baseURL!); const page = pages[0];
  try {
    await setMicrophoneMode(pages[1], 'open');
    await pages[1].getByRole('button', { name: 'Ouvrir mon microphone', exact: true }).click();
    await expect.poll(() => received(page)).toBeGreaterThan(1000);
    await page.getByLabel('Message au salon').fill('Un brouillon à voix basse.');
    const peers = () => page.evaluate(() => (window as unknown as { __voicePeers: RTCPeerConnection[] }).__voicePeers.length);
    const connections = await peers(); const bytes = await received(page);
    await page.getByRole('button', { name: 'Agrandir la discussion' }).click();
    await page.screenshot({ path: 'output/playwright/v1.3-voice-expanded.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Agrandir la discussion' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.layout-mobile')).toBeVisible();
    await expect(page.locator('.communication-zone.expanded')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Message au salon')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Panneaux du salon' }).getByRole('button', { name: /^Discussion/ })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Écoute : activée', exact: true })).toBeVisible();
    await showPanel(page, 'Discussion');
    await page.getByRole('button', { name: 'Agrandir la discussion' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Message au salon')).toHaveValue('Un brouillon à voix basse.');
    await page.getByRole('navigation', { name: 'Panneaux du salon' }).getByRole('button', { name: /^Discussion/ }).click();
    await page.setViewportSize({ width: 1366, height: 768 });
    expect(await peers()).toBe(connections);
    await expect.poll(() => received(page)).toBeGreaterThan(bytes + 1000);
    await expect(page.locator('.microphone-state')).toContainText('coupé');
    await page.getByLabel('Message au salon').blur();
    await page.keyboard.down('v'); await expect(page.locator('.microphone-state')).toContainText('transmission');
    await page.keyboard.up('v'); await expect(page.locator('.microphone-state')).toContainText('coupé');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});


test('push-to-talk releases on keyup, blur, typing, mode changes and reconnect', async ({ browser, baseURL }) => {
  const { contexts, pages } = await pair(browser, baseURL!);
  const page = pages[0];
  try {
    const state = page.locator('.microphone-state');
    await expect(state).toContainText('coupé');
    await page.keyboard.down('v'); await expect(state).toContainText('transmission');
    await page.keyboard.up('v'); await expect(state).toContainText('coupé');
    await page.keyboard.down('v'); await expect(state).toContainText('transmission');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(state).toContainText('coupé'); await page.keyboard.up('v');
    const input = page.getByRole('textbox', { name: /message/i });
    await input.focus(); await page.keyboard.down('v'); await expect(state).toContainText('coupé'); await page.keyboard.up('v');
    await input.blur();
    await setMicrophoneMode(page, 'open');
    await page.getByRole('button', { name: 'Ouvrir mon microphone', exact: true }).click(); await expect(state).toContainText('transmission');
    await page.getByRole('button', { name: 'Écoute : activée', exact: true }).click(); await expect(state).toContainText('transmission');
    await page.keyboard.press('v'); await expect(state).toContainText('transmission');
    await setMicrophoneMode(page, 'ptt'); await expect(state).toContainText('coupé');
    await voiceSettings(page); await page.getByRole('button', { name: 'Quitter le vocal', exact: true }).click();
    await page.getByRole('button', { name: /Rejoindre le vocal/ }).click();
    await expect(page.locator('.voice-panel')).toContainText('Dans la conversation');
    await expect(state).toContainText('coupé');
    const talk = page.getByRole('button', { name: 'Maintenir pour parler · V', exact: true });
    await talk.dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
    await expect(state).toContainText('transmission');
    await talk.dispatchEvent('pointercancel', { pointerId: 1 }); await expect(state).toContainText('coupé');
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('denied microphone permission keeps listening and allows recovery', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Sans micro');
  await page.getByRole('button', { name: /Créer un salon/ }).click();
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await page.getByRole('button', { name: /Rejoindre le vocal/ }).click();
  await expect(page.locator('.voice-panel')).toContainText('Dans la conversation');
  await page.keyboard.down('v');
  await expect(page.locator('.voice-panel')).toContainText('Microphone refusé');
  await page.keyboard.up('v'); await expect(page.locator('.microphone-state')).toContainText('coupé');
  await expect(page.getByRole('button', { name: 'Écoute : activée', exact: true })).toBeEnabled();
});


test('touch push-to-talk stops on touch release on a mobile viewport', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['microphone'] });
  try {
    const page = await context.newPage(); await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Pouce René');
    await page.getByRole('button', { name: /Créer un salon/ }).click();
    await page.getByRole('button', { name: /Rejoindre le vocal/ }).click();
    const talk = page.getByRole('button', { name: 'Maintenir pour parler · V', exact: true });
    await expect(talk).toBeEnabled(); await talk.scrollIntoViewIfNeeded();
    const rect = (await talk.boundingBox())!; const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
    await expect(page.locator('.microphone-state')).toContainText('transmission');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.microphone-state')).toContainText('coupé');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'output/playwright/voice-mobile.png' });
  } finally { await context.close(); }
});

test('eliminated players keep receiving audio after the server rotates voice permissions', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const { contexts, pages } = await pair(browser, baseURL!);
  const names = ['Micro René', 'Oreilles René', 'Indice René', 'Soupçon René', 'Encore René'];
  try {
    for (let i = 2; i < 5; i++) {
      const context = await browser.newContext({ baseURL, permissions: ['microphone'] }); contexts.push(context);
      const page = await context.newPage(); pages.push(page);
      await page.goto(pages[0].url()); await page.getByLabel('Pseudonyme').fill(names[i]);
      await page.getByRole('button', { name: 'Rejoindre →', exact: true }).click();
    }
    await Promise.all(pages.map(page => page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click()));
    await pages[0].getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(pages[0].locator('.phase-description')).toBeVisible({ timeout: 15000 });
    for (let n = 0; n < 5; n++) {
      let speaker = -1;
      await expect.poll(async () => {
        const visible = await Promise.all(pages.map(page => page.getByLabel('Votre indice', { exact: true }).isVisible()));
        return speaker = visible.findIndex(Boolean);
      }).not.toBe(-1);
      await submitDescription(pages[speaker], `Indice discret ${n}`, pages);
    }
    await pages[0].getByRole('button', { name: /Passer au vote/ }).click();
    // Independent clients can prepare/vote together, as in a real salon. Keep
    // browser round trips from consuming the existing 90 s scenario budget.
    await Promise.all(pages.map((page, index) => page.getByRole('button', { name: `Voter pour ${names[index === 1 ? 0 : 1]}`, exact: true }).click()));
    await expect(pages[1].locator('.microphone-state')).toContainText('Écoute seule');
    await expect(pages[1].getByRole('button', { name: 'Maintenir pour parler · V', exact: true })).toBeDisabled();
    await expect(pages[1].locator('.voice-panel')).toContainText('À l’écoute des vivants', { timeout: 15000 });
    await setMicrophoneMode(pages[0], 'open');
    await expect(pages[0].getByRole('button', { name: 'Ouvrir mon microphone', exact: true })).toBeEnabled();
    await pages[0].getByRole('button', { name: 'Ouvrir mon microphone', exact: true }).click();
    await expect.poll(() => received(pages[1])).toBeGreaterThan(0);
    await voiceSettings(pages[1]); await pages[1].getByRole('button', { name: 'Quitter le vocal', exact: true }).click();
    await pages[1].getByRole('button', { name: /Rejoindre le vocal/ }).click();
    await expect(pages[1].locator('.voice-panel')).toContainText('À l’écoute des vivants');
    await expect(pages[1].getByRole('button', { name: 'Maintenir pour parler · V', exact: true })).toBeDisabled();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
