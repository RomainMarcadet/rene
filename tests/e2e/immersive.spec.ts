import { test, expect, type Page } from '@playwright/test';
import { joinFour } from './helpers';
import { mkdir, writeFile } from 'node:fs/promises';
import { livingRoom, livingState, livingUI, livingSend } from './livingRoomFixture';
import { walkable } from '@rene/contracts';
test.use({ viewport: { width: 1586, height: 992 }, video: { mode: 'on', size: { width: 1280, height: 800 } } });
test.afterEach(async ({ page }, info) => {
  const video = page.video(); await page.close();
  if (video && info.status === 'passed' && !info.title.startsWith('TPS prototype')) {
    await mkdir('output/playwright', { recursive: true }); await video.saveAs('output/playwright/v1.4-' + (info.title.startsWith('TPS phase') ? 'cinematic' : info.title.startsWith('two fingers') ? 'touch' : 'navigation') + '.webm');
  }
});
async function camera(page: Page) {
  return page.evaluate(async () => {
    const path = '/node_modules/.vite/deps/@react-three_fiber.js'; const { _roots } = await import(path);
    const root = [..._roots.values()].find(r => r.store.getState().gl.domElement.closest('.hub-canvas')); if (!root) throw new Error('Canvas not mounted');
    const state = root.store.getState();
    const storePath = '/src/store.ts'; const store = (await import(storePath)).useGame.getState();
    const controlPath = '/src/scene/camera/useHubControls.ts'; const blocked = (await import(controlPath)).controlsBlocked(document.activeElement);
    const local = store.room.players.find((p: { id: string }) => p.id === store.session.playerId);
    const projected = state.camera.position.clone().set(local.position.x, 1.35, local.position.z).project(state.camera);
    const gl = state.gl.getContext(); const debug = gl.getExtension('WEBGL_debug_renderer_info'); const renderer = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    return { renderer, renderDpr: state.gl.getPixelRatio(), blocked, focus: document.activeElement?.tagName, focusClass: document.activeElement?.className, joystick: document.querySelector('.joystick span')?.getAttribute('style'), perspective: state.camera.isPerspectiveCamera, position: state.camera.position.toArray(), orbitYaw: state.camera.userData.orbitYaw, shot: state.camera.userData.shot, area: state.camera.userData.clearArea, screen: { x: (projected.x + 1) * state.size.width / 2, y: (1 - projected.y) * state.size.height / 2 }, local: local.position, calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles };
  });
}
test('TPS prototype: free orbit, camera relative movement, HUD framing and same Canvas', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const f = await joinFour(browser, baseURL!); const page = f.pages[0]; await page.bringToFront();
  try {
    await page.setViewportSize({ width: 1586, height: 992 });
    await expect.poll(async () => (await camera(page)).perspective).toBe(true);
    await page.locator('.hub-canvas canvas').evaluate(c => Object.assign(window, { __livingCanvas: c }));
    const before = await camera(page);
    await expect.poll(async () => { const c = await camera(page); return Math.abs(c.screen.x - c.area.left - c.area.width / 2); }).toBeLessThan(3);
    await mkdir('output/playwright', { recursive: true });
    await page.screenshot({ path: 'output/playwright/v1.4-blockout.png' });
    const area = before.area; const x = area.left + area.width / 2; const y = area.top + area.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 260, y, { steps: 12 }); await page.mouse.up();
    const turned = await camera(page); expect(turned.position[0]).not.toBeCloseTo(before.position[0], 1); expect(turned.local).toEqual(before.local);
    expect(turned).toMatchObject({ blocked: false });
    await page.keyboard.down('w');
    try { await expect.poll(async () => { const p = (await camera(page)).local; return Math.hypot(p.x - before.local.x, p.z - before.local.z); }).toBeGreaterThan(.4); }
    finally { await page.keyboard.up('w'); }
    await page.getByLabel('Message au salon').focus(); const typing = (await camera(page)).local;
    await page.keyboard.type('zqsdwasd'); await page.waitForTimeout(150); expect((await camera(page)).local).toEqual(typing);
    await page.getByRole('button', { name: 'Recentrer la caméra' }).click();
    await page.screenshot({ path: 'output/playwright/v1.4-tps.png' });
    expect(await page.locator('.hub-canvas canvas').evaluate(c => c === (window as unknown as { __livingCanvas: Node }).__livingCanvas)).toBe(true);
    await writeFile('output/playwright/v1.4-prototype-metrics.json', JSON.stringify(await camera(page), null, 2));
  } finally { await Promise.all(f.contexts.map(c => c.close())); }
});

test('Chez René: twelve simultaneous movers, face view, no network camera, responsive framing and measured rendering', async ({ page, playwright, baseURL }) => {
  test.setTimeout(90000);
  const f = await livingRoom(page, playwright, baseURL!, 12);
  try {
    await expect.poll(async () => (await camera(page)).calls).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Vue collective' }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'output/playwright/v1.4-twelve.png' });
    const before = await livingState(page); await page.keyboard.down('a');
    for (let i = 0; i < 10; i++) {
      for (const a of f.actors) { const p = a.room!.players.find(p => p.id === a.id)!.position; const length = Math.hypot(p.x, p.z); a.socket.emit('move', { x: -p.z / length, z: p.x / length }); }
      await page.waitForTimeout(67);
    }
    await page.keyboard.up('a');
    await expect.poll(() => f.actors.filter(a => { const old = before.players.find(p => p.id === a.id)!.position; const p = a.room!.players.find(p => p.id === a.id)!.position; return Math.hypot(old.x - p.x, old.z - p.z) > .3; }).length).toBe(11);
    expect(Math.hypot((await camera(page)).local.x - before.players.find(p => p.id === before.hostId)!.position.x, (await camera(page)).local.z)).toBeGreaterThan(.3);
    for (const p of (await livingState(page)).players) expect(walkable(p.position)).toBe(true);
    for (const a of f.actors) expect((await livingSend(a, { type: 'player.emote', kind: 'macarena_full' })).ok).toBe(true);
    expect(await livingUI(page, { type: 'player.emote', kind: 'macarena_full' })).toBe(true);
    // Allow the two three-second resolution samples to settle before measuring steady rendering.
    await page.waitForTimeout(6500);
    const metrics = await page.evaluate(async () => {
      const frames: number[] = []; let last = performance.now(); const end = last + 3000;
      await new Promise<void>(resolve => { function frame(now: number) { frames.push(now - last); last = now; if (now < end) requestAnimationFrame(frame); else resolve(); } requestAnimationFrame(frame); });
      frames.sort((a, b) => a - b); return { samples: frames.length, medianFrameMs: frames[Math.floor(frames.length / 2)], p95FrameMs: frames[Math.floor(frames.length * .95)], browser: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio };
    });
    await writeFile('output/playwright/v1.4-twelve-metrics.json', JSON.stringify({ ...metrics, render: await camera(page) }, null, 2));
    await page.getByRole('button', { name: 'Vue collective' }).click(); await page.waitForTimeout(600);
    // Give the local avatar breathing room before the front-view capture; no teleport fixture.
    await page.keyboard.down('a');
    try { await expect.poll(async () => (await camera(page)).local.x).toBeGreaterThan(5.6); }
    finally { await page.keyboard.up('a'); }
    await page.waitForTimeout(150);
    const idle = await livingState(page); const area = (await camera(page)).area;
    const x = area.left + area.width / 2; const y = area.top + area.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 262, y, { steps: 20 }); await page.mouse.up(); await page.waitForTimeout(400);
    const after = await livingState(page); expect(after.players.map(p => p.position)).toEqual(idle.players.map(p => p.position)); expect(after.voiceGeneration).toBe(idle.voiceGeneration);
    await page.screenshot({ path: 'output/playwright/v1.4-face.png' });
    for (const [width, height, name] of [[1024, 768, 'tablet'], [390, 844, 'mobile'], [844, 390, 'landscape']] as const) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(400);
      const c = await camera(page); expect(Number.isFinite(c.position[0])).toBe(true);
      expect(c.screen.x).toBeGreaterThanOrEqual(c.area.left - 5); expect(c.screen.x).toBeLessThanOrEqual(c.area.left + c.area.width + 5);
      await page.screenshot({ path: `output/playwright/v1.4-${name}.png` });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const p = (await camera(page)).local; await page.reload(); await expect(page.locator('.participants li')).toHaveCount(12); await expect(page.locator('.hub-canvas canvas')).toBeVisible(); expect((await livingState(page)).players.find(p => p.id === before.hostId)!.position).toEqual(p);
  } finally { await f.close(); }
});

test.describe('immersive mobile input', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
    } finally { await f.close(); }
  });
});

test('TPS phase direction: real clues, collective vote, elimination, results and return to lobby', async ({ page, playwright, baseURL }) => {
  test.setTimeout(90000);
  const f = await livingRoom(page, playwright, baseURL!, 4);
  try {
    await livingUI(page, { type: 'player.ready', ready: true }); for (const a of f.actors) expect((await livingSend(a, { type: 'player.ready', ready: true })).ok).toBe(true);
    await page.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(page.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    let cycle = 0;
    while ((await livingState(page)).game!.phase !== 'results' && cycle++ < 4) {
      while ((await livingState(page)).game!.phase === 'description') {
        const r = await livingState(page); const a = f.actors.find(a => a.id === r.game!.turnPlayerId); const text = 'Contribution fictive ' + r.game!.descriptions.length;
        if (a) expect((await livingSend(a, { type: 'game.describe', text })).ok).toBe(true);
        else { await page.getByLabel('Votre indice', { exact: true }).fill(text); await page.getByRole('button', { name: /Valider mon indice/ }).click(); }
        await expect.poll(async () => (await livingState(page)).game!.descriptions.length).toBe(r.game!.descriptions.length + 1);
      }
      await page.getByRole('button', { name: /Passer au vote/ }).click(); await expect.poll(async () => (await camera(page)).shot).toBe('group');
      await page.waitForTimeout(500); if (cycle === 1) await page.screenshot({ path: 'output/playwright/v1.4-vote.png' });
      const r = await livingState(page); const living = r.players.filter(p => p.alive && !p.waiting); const target = living.find(p => p.id !== r.hostId)!;
      for (const p of living) {
        const targetId = p.id === target.id ? r.hostId : target.id; const a = f.actors.find(a => a.id === p.id);
        if (a) expect((await livingSend(a, { type: 'game.vote', targetId })).ok).toBe(true);
        else { const name = r.players.find(p => p.id === targetId)!.name; await page.locator('.vote-grid').getByRole('button').filter({ hasText: name }).click(); }
      }
      await expect.poll(async () => (await livingState(page)).game!.phase).toBe('elimination');
      if (cycle === 1) await page.screenshot({ path: 'output/playwright/v1.4-elimination.png' });
      await expect.poll(async () => (await livingState(page)).game!.phase, { timeout: 6000 }).not.toBe('elimination');
    }
    expect((await livingState(page)).game!.phase).toBe('results');
    await expect.poll(async () => (await camera(page)).shot).toBe('group'); await page.screenshot({ path: 'output/playwright/v1.4-results.png' });
    expect(await livingUI(page, { type: 'game.next' })).toBe(true); await expect.poll(async () => (await camera(page)).shot).toBe('local');
  } finally { await f.close(); }
});
