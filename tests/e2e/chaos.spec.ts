import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { ANIMATION_IDS, type Ack, type Command, type RoomSnapshot } from '@rene/contracts';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';
import { avatarScene } from './avatarScene';
import { mkdir, writeFile } from 'node:fs/promises';
test.use({ viewport: { width: 1586, height: 992 }, video: { mode: 'on', size: { width: 1280, height: 800 } }, launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });
test.afterEach(async ({ page }, info) => { const video = page.video(); await page.close(); if (video && info.status === 'passed') { await mkdir('output/playwright', { recursive: true }); await video.saveAs('output/playwright/v1.5-' + (info.title.startsWith('ground target') ? 'ground-availability' : info.title.startsWith('prototype') ? 'combat' : info.title.startsWith('postures') ? 'catalogue' : info.title.startsWith('stunned') ? 'gameplay' : info.title.startsWith('mobile touch') ? 'mobile-controls' : info.title.startsWith('8 ') ? 'eight' : 'twelve') + '.webm'); } });
async function state(page: Page): Promise<RoomSnapshot> { return page.evaluate(async () => { const path = '/src/store.ts'; return (await import(path)).useGame.getState().room; }); }
async function ui(page: Page, command: Command) { return page.evaluate(async command => { const path = '/src/store.ts'; return (await import(path)).send(command); }, command); }
type Actor = { id: string; socket: Socket; context: APIRequestContext; snapshot?: RoomSnapshot; impacts: Set<string>; contributions: Map<string, number> };
async function send(a: Actor, command: Command, id = crypto.randomUUID()) {
  return new Promise<Ack>((resolve, reject) => a.socket.timeout(5000).emit('command', { id, command, socialGeneration: a.snapshot?.social.generation, ...(a.snapshot?.game ? { phaseId: a.snapshot.game.phaseId } : {}) }, (error: Error | null, ack: Ack) => error ? reject(error) : resolve(ack)));
}
async function setup(page: Page, request: { newContext: (options: { baseURL: string }) => Promise<APIRequestContext> }, baseURL: string, count: number) {
  await page.addInitScript(appearance => localStorage.setItem('rene-profile', JSON.stringify({ name: 'Camille', appearance })), AVATAR_SPECIMENS[0]);
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Camille'); await page.getByRole('button', { name: /Créer un salon/ }).click();
  await expect(page.locator('.room-code')).toBeVisible();
  const code = new URL(page.url()).searchParams.get('room')!; const actors: Actor[] = [];
  for (let i = 1; i < count; i++) {
    const context = await request.newContext({ baseURL }); const id = (await (await context.get('/api/session')).json()).playerId;
    const cookie = (await context.storageState()).cookies.map(c => c.name + '=' + c.value).join('; ');
    const socket = io(baseURL, { transports: ['websocket'], autoConnect: false, extraHeaders: { Cookie: cookie, Origin: baseURL } });
    const a: Actor = { id, socket, context, impacts: new Set(), contributions: new Map() }; actors.push(a); socket.on('snapshot', value => { a.snapshot = value; const physical = value.social.players[id]?.physical; if (physical) a.impacts.add(physical.instanceId); for (const d of value.game?.descriptions ?? []) { const key = d.playerId + ':' + d.round; if (!a.contributions.has(key)) a.contributions.set(key, value.serverNow); } });
    socket.on('poses', poses => { if (a.snapshot) for (const p of a.snapshot.players) if (poses[p.id]) p.position = poses[p.id]; });
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
    expect((await send(a, { type: 'room.join', code, name: ['Lou', 'Sam', 'Alex'][i - 1] ?? 'René ' + (i + 1), appearance: AVATAR_SPECIMENS[i] })).ok).toBe(true);
    await expect.poll(() => a.snapshot?.players.length).toBe(i + 1);
  }
  await expect(page.locator('.participants li')).toHaveCount(count);
  await expect.poll(async () => (await avatarScene(page))?.calls ?? 0).toBeGreaterThan(0);
  return { actors, close: async () => { for (const a of actors) { a.socket.disconnect(); await a.context.dispose(); } } };
}
async function moveTo(a: Actor, x: number, z: number) {
  // Actual movement commands, speed/obstacles validated by the server. No teleport fixture.
  for (let n = 0; n < 120; n++) {
    const p = a.snapshot!.players.find(p => p.id === a.id)!.position; const dx = x - p.x; const dz = z - p.z; const d = Math.hypot(dx, dz);
    if (d < .13) return;
    a.socket.emit('move', { x: dx / d, z: dz / d });
    await new Promise(resolve => setTimeout(resolve, 67));
  }
  throw new Error('Movement failed to reach the social test area');
}
test('ground target availability advances while the picker stays open and the salon is idle', async ({ page, playwright, baseURL }) => {
  const f = await setup(page, playwright.request, baseURL!, 4);
  try {
    const target = f.actors[0]; await moveTo(target, 4, 1.2);
    await page.getByRole('button', { name: 'Animations et interactions' }).click();
    await page.getByRole('button', { name: 'Interactions', exact: true }).click();
    await page.getByLabel('Cible des interactions').selectOption(target.id);
    const taunt = page.getByRole('button', { name: 'T-bag cartoon', exact: true });
    await expect(taunt).toBeDisabled();
    expect((await send(target, { type: 'player.emote', kind: 'play_dead' })).ok).toBe(true);
    await expect.poll(async () => (await state(page)).social.players[target.id].animation?.kind).toBe('play_dead');
    const before = await state(page);
    // No movement, chat, selection changes or reopening: only time may unlock the button.
    await expect(taunt).toBeEnabled();
    const after = await state(page);
    expect(after.revision).toBe(before.revision);
    expect(after.social).toEqual(before.social);
    await taunt.click();
    await expect.poll(async () => (await state(page)).social.players[before.hostId].animation?.kind).toBe('crouch_taunt');
  } finally { await f.close(); }
});
test('prototype: authoritative punch, fifth impact, fall, recovery and protection with distinct avatars', async ({ page, playwright, baseURL }, info) => {
  test.setTimeout(90000);
  const f = await setup(page, playwright.request, baseURL!, 4);
  try {
    await moveTo(f.actors[0], 4, 1.2);
    const id = (await state(page)).hostId; const target = f.actors[0].id;
    expect(await page.evaluate(async target => {
      const path = '/src/store.ts'; const { send } = await import(path);
      for (const kind of ['punch', 'slap', 'headbutt', 'shove', 'punch']) { if (!await send({ type: 'player.attack', kind, targetId: target })) return false; await new Promise(resolve => setTimeout(resolve, 820)); }
      return true;
    }, target)).toBe(true);
    await expect.poll(() => f.actors[0].impacts.size).toBe(5);
    await expect.poll(async () => (await state(page)).social.players[target].physical?.kind).toBe('stun');
    const social = (await state(page)).social.players[target]; expect(social.physical?.kind).toBe('stun');
    await expect(page.locator('.social-status').filter({ hasText: 'À terre' })).toBeVisible();
    expect((await send(f.actors[0], { type: 'player.attack', kind: 'punch', targetId: id })).ok).toBe(false);
    const bodyRoll = await page.evaluate(async () => {
      const path = '/node_modules/.vite/deps/@react-three_fiber.js'; const { _roots } = await import(path);
      const state = [..._roots.values()][0].store.getState(); let roll = 0;
      state.scene.traverse((object: { name: string; parent?: { parent?: { parent?: { rotation: { z: number } } } } }) => { if (object.name.startsWith('appearance:potato:buns:')) { let parent = object.parent as unknown as { name: string; rotation: { z: number }; parent?: typeof parent }; while (parent && parent.name !== 'avatar-puppet') parent = parent.parent!; roll = parent?.rotation.z ?? 0; } });
      return roll;
    });
    expect(bodyRoll).toBeLessThan(-.9);

    await expect(page.locator('.social-status').filter({ hasText: 'Protégé' })).toBeVisible({ timeout: 5000 });
    expect(await ui(page, { type: 'player.attack', kind: 'punch', targetId: target })).toBe(false);
    await page.screenshot({ path: 'output/playwright/v1.5-prototype-protected.png' });
    await info.attach('prototype', { path: 'output/playwright/v1.5-prototype-protected.png', contentType: 'image/png' });
    await page.waitForTimeout(1200);
  } finally { await f.close(); }
});
test('postures, Macarena synchronization, consent, cancellation and mobile controls', async ({ page, playwright, baseURL }) => {
  test.setTimeout(120000);
  const f = await setup(page, playwright.request, baseURL!, 4);
  try {
    await moveTo(f.actors[0], 4, 1.2);
    for (const kind of ['play_dead', 'straddle', 'kneel', 'arm_back_and_forth', 'head_forward_back'] as const) {
      expect(await ui(page, { type: 'player.emote', kind })).toBe(true);
      for (const a of f.actors.slice(1)) expect((await send(a, { type: 'player.emote', kind })).ok).toBe(true);
      await page.waitForTimeout(1200);
    }
    expect((await send(f.actors[0], { type: 'player.emote', kind: 'play_dead' })).ok).toBe(true); await page.waitForTimeout(550);
    expect(await ui(page, { type: 'player.emote', kind: 'crouch_taunt', targetId: f.actors[0].id })).toBe(true); await page.waitForTimeout(1300);
    await page.getByRole('button', { name: 'Animations et interactions' }).click();
    await page.getByRole('button', { name: 'Macarena', exact: true }).click();
    await page.screenshot({ path: 'output/playwright/v1.5-picker.png' });
    await page.getByRole('button', { name: '1 · Bras droit devant', exact: true }).click();
    await page.waitForTimeout(800);
    await moveTo(f.actors[0], 5.2, 0);
    f.actors[0].socket.emit('move', { x: 0, z: 1 }); await page.waitForTimeout(80);
    for (const kind of ANIMATION_IDS.filter(id => id.startsWith('macarena_') && id !== 'macarena_full')) { expect(await ui(page, { type: 'player.emote', kind })).toBe(true); await page.waitForTimeout(650); }
    expect(await ui(page, { type: 'player.emote', kind: 'macarena_full' })).toBe(true);
    await page.waitForTimeout(1500);
    const host = (await state(page)).hostId;
    expect((await send(f.actors[0], { type: 'player.emote', kind: 'macarena_full', targetId: host })).ok).toBe(true);
    await expect.poll(async () => (await state(page)).social.players[f.actors[0].id].animation?.startedAt).toBe((await state(page)).social.players[host].animation!.startedAt);
    await page.waitForTimeout(10500);
    for (const kind of ['hug', 'carry'] as const) {
      expect(await ui(page, { type: 'player.interaction.invite', kind, targetId: f.actors[0].id })).toBe(true);
      const i = (await state(page)).social.interactions[0];
      expect((await send(f.actors[0], { type: 'player.interaction.respond', interactionId: i.id, accept: true })).ok).toBe(true);
      await page.waitForTimeout(1500);
      expect(await ui(page, { type: 'player.interaction.cancel', interactionId: i.id })).toBe(true);
    }
    for (const [width, height] of [[1024, 768], [390, 844]]) {
      await page.setViewportSize({ width, height });
      const launcher = page.getByRole('button', { name: 'Animations et interactions' });
      await expect(launcher).toBeInViewport({ ratio: 1 }); await launcher.click();
      await page.getByRole('button', { name: 'Postures', exact: true }).click();
      await page.getByRole('button', { name: 'À genoux', exact: true }).click(); await page.waitForTimeout(900);
      await page.screenshot({ path: 'output/playwright/v1.5-' + width + '.png' });
      await page.getByRole('button', { name: 'Arrêter l’animation' }).click();
    }
    await page.keyboard.press('b'); await expect(page.getByRole('dialog', { name: 'Le petit chaos.' })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Animations et interactions' })).toBeFocused();
  } finally { await f.close(); }
});
for (const count of [8, 12]) test(count + ' animated avatars preserve business controls and measure render/network load', async ({ page, playwright, baseURL }, info) => {
  test.setTimeout(120000);
  const f = await setup(page, playwright.request, baseURL!, count);
  try {
    const before = await avatarScene(page); let messages = 0; let bytes = 0; let privateMessages = 0;
    f.actors[0].socket.on('snapshot', snapshot => { messages++; bytes += Buffer.byteLength(JSON.stringify(snapshot)); });
    f.actors[0].socket.on('private', () => { privateMessages++; });
    await page.waitForTimeout(1000); const idle = { messages, bytes, privateMessages }; messages = 0; bytes = 0; privateMessages = 0;
    for (const a of f.actors) expect((await send(a, { type: 'player.emote', kind: 'macarena_full' })).ok).toBe(true);
    expect(await ui(page, { type: 'player.emote', kind: 'macarena_full' })).toBe(true);
    await page.waitForTimeout(3000);
    const active = await avatarScene(page);
    expect(active!.calls).toBeLessThan(650); expect(active!.triangles).toBeLessThan(65000);
    await page.screenshot({ path: 'output/playwright/v1.5-' + count + '-avatars.png' });
    const timing = await page.evaluate(async () => {
      const path = '/src/scene/animation.ts'; const { avatarPose, createPose } = await import(path);
      const out = createPose(); const scratch = createPose(); const input = { time: 1, now: 2000, moving: false, reduced: false, social: { acceptsPhysical: true, nextAttackAt: 0, protectedUntil: 0, animation: { instanceId: 'bench', kind: 'macarena_full', startedAt: 1000, endsAt: 29800, seed: 42 } } };
      for (let i = 0; i < 1000; i++) avatarPose(input, out, scratch);
      const legacy = { time: 1, now: 2000, moving: false, reduced: false, emote: 'dance', until: 3500 };
      const legacyStart = performance.now(); for (let i = 0; i < 12000; i++) { legacy.now = 1000 + i % 2400; avatarPose(legacy, out, scratch); } const legacyDanceMs = performance.now() - legacyStart;
      const start = performance.now(); for (let i = 0; i < 12000; i++) { input.now = 1000 + i % 9600; avatarPose(input, out, scratch); }
      return { calls: 12000, legacyDanceMs, elapsedMs: performance.now() - start, userAgent: navigator.userAgent, dpr: devicePixelRatio };
    });
    await mkdir('output/playwright', { recursive: true }); const report = { before, active, idleOneSecond: idle, startupAndThreeSeconds: { messages, bytes, privateMessages }, timing };
    await writeFile('output/playwright/v1.5-metrics-' + count + '.json', JSON.stringify(report, null, 2)); await info.attach('metrics', { body: JSON.stringify(report), contentType: 'application/json' });
    if (count === 8) {
      const extras = ['facepalm', 'sarcastic_clap', 'laugh', 'point', 'bow', 'dab', 'moonwalk', 'failed_breakdance', 'faint', 'sleep', 'slip'] as const;
      for (let group = 0; group < 2; group++) {
        for (const [i, kind] of extras.slice(group * 7, group * 7 + 7).entries()) expect((await send(f.actors[i], { type: 'player.emote', kind })).ok).toBe(true);
        await page.waitForTimeout(2600);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Animations et interactions' }).click(); await page.getByRole('button', { name: 'Gestes', exact: true }).click(); await page.getByRole('button', { name: 'Mais enfin…', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(1);
    for (const a of f.actors) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click(); await page.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(page.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.current-round li')).toHaveCount(count);
    await page.getByRole('button', { name: /^Indices/ }).click();
    await expect(page.getByRole('button', { name: 'Gestes du salon', exact: true })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Gestes du salon', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Le petit chaos.' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Gestes du salon', exact: true })).toBeFocused();
  } finally { await f.close(); }
});

test('stunned clue author keeps drafts and voice, then voting cancels every social action', async ({ page, playwright, baseURL }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const Original = window.RTCPeerConnection; const peers: RTCPeerConnection[] = []; Object.assign(window, { __socialPeers: peers });
    window.RTCPeerConnection = class extends Original { constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) { super(...args); peers.push(this); } };
  });
  const f = await setup(page, playwright.request, baseURL!, 4);
  try {
    await moveTo(f.actors[0], 4, 1.2);
    const host = (await state(page)).hostId;
    if (process.env.RENE_VOICE_E2E === '1') { await page.getByRole('button', { name: /Rejoindre le vocal/ }).click(); await expect(page.locator('.voice-panel')).toContainText('Dans la conversation', { timeout: 20000 }); }
    const peers = () => page.evaluate(() => (window as unknown as { __socialPeers: RTCPeerConnection[] }).__socialPeers.length);
    let initialPeers = await peers();
    for (const a of f.actors) expect((await send(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    await page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click(); await page.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(page.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    while ((await state(page)).game!.turnPlayerId !== host) {
      const current = (await state(page)).game!;
      expect((await send(f.actors.find(a => a.id === current.turnPlayerId)!, { type: 'game.describe', text: 'Un indice fictif pour la recette' })).ok).toBe(true);
      await expect.poll(async () => (await state(page)).game!.turnPlayerId).not.toBe(current.turnPlayerId);
    }
    initialPeers = await peers();
    await page.getByLabel('Message au salon').fill('Brouillon conservé pendant les cabrioles');
    await page.getByLabel('Votre indice', { exact: true }).fill('Un brouillon fictif');
    const previous = (await state(page)).social.players[host].animation;
    await page.keyboard.press('f'); await page.keyboard.press('b');
    expect((await state(page)).social.players[host].animation).toEqual(previous);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const business = (await state(page)).game!;
    for (let i = 0; i < 5; i++) {
      expect((await send(f.actors[0], { type: 'player.attack', kind: 'punch', targetId: host })).ok).toBe(true);
      if (i < 4) await page.waitForTimeout(820);
    }
    await expect(page.locator('.social-controls')).toContainText('À terre');
    const during = (await state(page)).game!;
    expect(during).toEqual(business); expect(await peers()).toBe(initialPeers);
    const stunEndsAt = (await state(page)).social.players[host].physical!.stunEndsAt;
    await page.getByLabel('Votre indice', { exact: true }).fill('Indice fictif depuis le tapis');
    await page.getByRole('button', { name: /Valider mon indice/ }).click();
    await expect(page.locator('.latest-clue')).toContainText('Indice fictif depuis le tapis');
    await expect.poll(() => f.actors[0].contributions.get(host + ':' + business.round)).toBeDefined();
    expect(f.actors[0].contributions.get(host + ':' + business.round)).toBeLessThan(stunEndsAt);
    await page.screenshot({ path: 'output/playwright/v1.5-clue-while-stunned.png' });
    await expect(page.getByLabel('Message au salon')).toHaveValue('Brouillon conservé pendant les cabrioles');
    while ((await state(page)).game!.phase === 'description') {
      const current = (await state(page)).game!;
      expect((await send(f.actors.find(a => a.id === current.turnPlayerId)!, { type: 'game.describe', text: 'Un autre indice fictif' })).ok).toBe(true);
      await expect.poll(async () => (await state(page)).game!.phaseId).not.toBe(current.phaseId);
    }
    const generation = (await state(page)).social.generation;
    // Start just before a business transition: impact must never enter the vote.
    await page.waitForTimeout(3000);
    expect(await ui(page, { type: 'player.emote', kind: 'macarena_full' })).toBe(true);
    expect((await send(f.actors[1], { type: 'player.emote', kind: 'play_dead' })).ok).toBe(true);
    await page.getByRole('button', { name: /Passer au vote/ }).click();
    await expect(page.locator('.phase-vote')).toBeVisible();
    const vote = await state(page); expect(vote.social.generation).toBeGreaterThan(generation);
    expect(Object.values(vote.social.players).every(p => !p.animation && !p.physical && !p.protectedUntil)).toBe(true);
    await expect(page.getByRole('button', { name: 'Animations et interactions' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Frapper/ })).toBeDisabled();
    expect((await new Promise<Ack>(resolve => f.actors[0].socket.emit('command', { id: crypto.randomUUID(), command: { type: 'player.emote', kind: 'wave' }, socialGeneration: generation }, resolve))).ok).toBe(false);
    await page.getByRole('button', { name: 'Voter pour Lou', exact: true }).click();
    await expect(page.locator('.phase-vote')).toContainText('Votre vote est enregistré');
    expect(await peers()).toBe(initialPeers);
    if (process.env.RENE_VOICE_E2E === '1') await expect(page.locator('.voice-panel')).toContainText('Dans la conversation');
    await page.waitForTimeout(1200);
  } finally { await f.close(); }
});

test.describe('mobile social controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('mobile touch releases a cancelled attack and keeps the drawer launcher accessible', async ({ page, playwright, baseURL }) => {
    test.setTimeout(60000);
    const f = await setup(page, playwright.request, baseURL!, 4);
    try {
      await moveTo(f.actors[0], 4, 1.2);
      await page.getByRole('button', { name: 'Animations et interactions' }).tap();
      await page.getByRole('button', { name: 'Postures', exact: true }).tap();
      await page.getByRole('button', { name: 'À califourchon', exact: true }).tap();
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Arrêter l’animation', exact: true }).tap();
      await page.getByRole('button', { name: /^Indices/ }).tap();
      await page.getByRole('button', { name: 'Gestes du salon', exact: true }).tap();
      await page.getByRole('button', { name: 'Postures', exact: true }).tap();
      await page.getByRole('button', { name: 'À genoux', exact: true }).tap();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Gestes du salon', exact: true }).tap();
      await page.getByRole('button', { name: 'Arrêter l’animation', exact: true }).tap();
      await page.getByRole('button', { name: /^Indices/ }).tap();
      const attack = page.getByRole('button', { name: /^Frapper/ });
      const bounds = (await attack.boundingBox())!;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
      await page.waitForTimeout(900);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      expect(f.actors[0].impacts.size).toBe(0);
      await attack.tap(); await expect.poll(() => f.actors[0].impacts.size).toBe(1);
      await page.waitForTimeout(1200); expect(f.actors[0].impacts.size).toBe(1);
      await expect(page.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.voice-panel')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: 'output/playwright/v1.5-mobile-touch.png' });
    } finally { await f.close(); }
  });
});
