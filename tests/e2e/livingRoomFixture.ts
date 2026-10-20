import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { type RoomSnapshot, type Command, type Ack } from '@rene/contracts';
import { AVATAR_SPECIMENS } from '../../apps/web/src/avatar/specimens';
import { avatarScene } from './avatarScene';
const personalities = ['nervous', 'relaxed', 'proud', 'impassive'] as const;
export async function livingState(page: Page): Promise<RoomSnapshot> { return page.evaluate(async () => { const path = '/src/store.ts'; return (await import(path)).useGame.getState().room; }); }
export async function livingUI(page: Page, command: Command) { return page.evaluate(async command => { const path = '/src/store.ts'; return (await import(path)).send(command); }, command); }
export type LivingActor = { id: string; socket: Socket; context: APIRequestContext; room?: RoomSnapshot };
export function livingSend(a: LivingActor, command: Command) {
  return new Promise<Ack>((resolve, reject) => a.socket.timeout(5000).emit('command', { id: crypto.randomUUID(), command, phaseId: a.room?.game?.phaseId, socialGeneration: a.room?.social.generation }, (error: Error | null, ack: Ack) => error ? reject(error) : resolve(ack)));
}
export async function livingRoom(page: Page, playwright: { request: { newContext: (options: { baseURL: string }) => Promise<APIRequestContext> } }, baseURL: string, count: number) {
  await page.addInitScript(appearance => localStorage.setItem('rene-profile', JSON.stringify({ name: 'Camille', appearance })), { ...AVATAR_SPECIMENS[0], personality: 'proud' });
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
  await expect.poll(async () => (await avatarScene(page))?.names.length).toBe(count);
  return { actors, close: async () => { for (const a of actors) { a.socket.disconnect(); await a.context.dispose(); } } };
}
