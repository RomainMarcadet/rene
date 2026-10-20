import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { type RoomSnapshot, type Command, type Ack } from '@rene/contracts';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';
import { avatarScene } from './avatarScene';
const personalities = ['nervous', 'relaxed', 'proud', 'impassive'] as const;
export async function livingState(page: Page): Promise<RoomSnapshot> { return page.evaluate(async () => { const path = '/src/store.ts'; const posePath = '/src/poses.ts'; const room = (await import(path)).useGame.getState().room; const { getPose } = await import(posePath); return { ...room, players: room.players.map((p: RoomSnapshot['players'][number]) => ({ ...p, position: getPose(p.id, p.position) })) }; }); }
export async function livingUI(page: Page, command: Command) { return page.evaluate(async command => { const path = '/src/store.ts'; return (await import(path)).send(command); }, command); }
export type LivingActor = { id: string; socket: Socket; context: APIRequestContext; room?: RoomSnapshot };
export function livingSend(a: LivingActor, command: Command) {
  return new Promise<Ack>((resolve, reject) => a.socket.timeout(5000).emit('command', { id: crypto.randomUUID(), command, phaseId: a.room?.game?.phaseId, socialGeneration: a.room?.social.generation }, (error: Error | null, ack: Ack) => error ? reject(error) : resolve(ack)));
}
export async function livingRoom(page: Page, playwright: { request: { newContext: (options: { baseURL: string }) => Promise<APIRequestContext> } }, baseURL: string, count: number) {
  await page.addInitScript(appearance => { if (!localStorage.getItem('rene-profile')) localStorage.setItem('rene-profile', JSON.stringify({ name: 'Camille', appearance })); }, { ...AVATAR_SPECIMENS[0], personality: 'proud' });
  await page.goto('/'); await page.getByLabel('Pseudonyme').fill('Camille'); await page.getByRole('button', { name: /Créer un salon/ }).click(); await expect(page.locator('.room-code')).toBeVisible();
  // Private cards and the public results pair stay hidden in all captured demo media.
  await page.addStyleTag({ content: '.secret-card, .word-results { visibility: hidden !important; }' });
  const code = new URL(page.url()).searchParams.get('room')!; const actors: LivingActor[] = [];
  for (let i = 1; i < count; i++) {
    const context = await playwright.request.newContext({ baseURL }); const id = (await (await context.get('/api/session')).json()).playerId;
    const cookie = (await context.storageState()).cookies.map(c => c.name + '=' + c.value).join('; ');
    const socket = io(baseURL, { transports: ['websocket'], autoConnect: false, extraHeaders: { Cookie: cookie, Origin: baseURL } }); const a: LivingActor = { id, socket, context }; actors.push(a);
    socket.on('snapshot', r => { a.room = r; }); socket.on('poses', poses => { if (a.room) for (const p of a.room.players) if (poses[p.id]) p.position = poses[p.id]; });
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
    expect((await livingSend(a, { type: 'room.join', code, name: ['Lou', 'Sam', 'Alex'][i - 1] ?? 'René ' + (i + 1), appearance: { ...AVATAR_SPECIMENS[i], personality: personalities[i % personalities.length] } })).ok).toBe(true);
  }
  await expect(page.locator('.participants li')).toHaveCount(count);
  await expect.poll(async () => { const scene = await avatarScene(page); return scene && scene.calls > 0 ? scene.names.length : 0; }).toBe(count);
  return { actors, close: async () => { for (const a of actors) { a.socket.disconnect(); await a.context.dispose(); } } };
}

export async function livingCamera(page: Page) {
  return page.evaluate(async () => {
    const path = '/node_modules/.vite/deps/@react-three_fiber.js'; const { _roots } = await import(path);
    const root = [..._roots.values()].find(r => r.store.getState().gl.domElement.closest('.hub-canvas')); if (!root) throw new Error('Canvas not mounted');
    const state = root.store.getState();
    const storePath = '/src/store.ts'; const store = (await import(storePath)).useGame.getState();
    const controlPath = '/src/scene/camera/useHubControls.ts'; const blocked = (await import(controlPath)).controlsBlocked(document.activeElement);
    const local = store.room.players.find((p: { id: string }) => p.id === store.session.playerId);
    const posePath = '/src/poses.ts'; const position = (await import(posePath)).getPose(local.id, local.position);
    const projected = state.camera.position.clone().set(position.x, 1.35, position.z).project(state.camera);
    const gl = state.gl.getContext(); const debug = gl.getExtension('WEBGL_debug_renderer_info'); const renderer = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    return { renderer, renderDpr: state.gl.getPixelRatio(), blocked, focus: document.activeElement?.tagName, focusClass: document.activeElement?.className, joystick: document.querySelector('.joystick span')?.getAttribute('style'), perspective: state.camera.isPerspectiveCamera, position: state.camera.position.toArray(), orbitYaw: state.camera.userData.orbitYaw, shot: state.camera.userData.shot, area: state.camera.userData.clearArea, screen: { x: (projected.x + 1) * state.size.width / 2, y: (1 - projected.y) * state.size.height / 2 }, local: position, calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles };
  });
}
