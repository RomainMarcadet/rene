import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '@rene/contracts';
import { createApp } from './app.js';
import { readConfig } from './config.js';

const indexHtml = '<!doctype html><html lang="fr"><body>Le salon de René</body></html>';
const asset = 'console.log("rene-http-fixture");\n';
type Running = Awaited<ReturnType<typeof createApp>>;

describe('HTTP files and guest sessions with real Fastify plugins', () => {
  let fixture: string | undefined;
  let running: Running | undefined;
  let outsideContent: string;

  beforeEach(async () => {
    fixture = await mkdtemp(join(tmpdir(), 'rene-http-'));
    const webRoot = join(fixture, 'public');
    outsideContent = `PRIVATE-FILE-${randomUUID()}`;
    await mkdir(join(webRoot, 'assets'), { recursive: true });
    await Promise.all([
      writeFile(join(webRoot, 'index.html'), indexHtml),
      writeFile(join(webRoot, 'assets', 'app.js'), asset),
      writeFile(join(fixture, 'outside.txt'), outsideContent),
    ]);
    running = await createApp({
      config: readConfig({ NODE_ENV: 'test', WEB_ORIGIN: 'http://rene.test' }),
      timers: false,
      logger: false,
      webRoot,
    });
  });

  afterEach(async () => {
    try { await running?.app.close(); }
    finally {
      if (fixture) await rm(fixture, { recursive: true, force: true });
      running = undefined;
      fixture = undefined;
    }
  });

  it('never serves the server catalogue or source through production static routes', async () => {
    for (const url of ['/packages/engine/src/words.ts', '/packages/engine/src/word-data/cinema.json', '/apps/server/dist/index.js.map', '/@fs/packages/engine/src/words.ts']) {
      const response = await running!.app.inject({ method: 'GET', url });
      expect(response.body === indexHtml || response.statusCode === 404).toBe(true);
      expect(response.body.includes('v14-') || response.body.includes('clueAxes')).toBe(false);
    }
  });

  it.each(['/', '/index.html', '/salon/ABCDEF?invitation=1'])(
    'serves the application at %s without listening on a network port', async url => {
      const response = await running!.app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(indexHtml);
      expect(response.headers['content-type']).toMatch(/^text\/html/);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(running!.app.server.listening).toBe(false);
    },
  );

  it('serves the real asset rather than the SPA document', async () => {
    const response = await running!.app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(asset);
    expect(response.headers['content-type']).toMatch(/javascript/);
  });

  it('returns a JSON 404 for an unknown API route', async () => {
    const response = await running!.app.inject({ method: 'GET', url: '/api/unknown' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ error: 'Page introuvable.' });
  });

  it.each([
    '/../outside.txt',
    '/%2e%2e/outside.txt',
    '/%2e%2e%2foutside.txt',
    '/assets/%2e%2e/%2e%2e/outside.txt',
    '/%252e%252e%252foutside.txt',
    '/%2e%2e%5coutside.txt',
  ])('never exposes a file outside webRoot through %s', async url => {
    const response = await running!.app.inject({ method: 'GET', url });
    expect(response.body).not.toContain(outsideContent);
    expect([200, 400, 403, 404]).toContain(response.statusCode);
    // A normalized path may legitimately reach the SPA fallback, never the parent file.
    if (response.statusCode === 200) expect(response.body).toBe(indexHtml);
  });

  it('restores the same guest from its HTTP-only cookie and keeps separate guests isolated', async () => {
    const first = await running!.app.inject({ method: 'GET', url: '/api/session' });
    const cookieHeader = String(first.headers['set-cookie']);
    const cookie = cookieHeader.split(';')[0];
    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(cookie).toMatch(/^rene_guest=[a-f0-9]{64}$/);
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    expect(cookieHeader).toContain('Path=/');
    const identity = first.json<{ playerId: string }>();
    expect(first.json()).toEqual({
      playerId: expect.any(String), name: 'René', appearance: DEFAULT_APPEARANCE,
      roomCode: null, voiceEnabled: false,
    });

    const returning = await running!.app.inject({ method: 'GET', url: '/api/session', headers: { cookie } });
    expect(returning.statusCode).toBe(200);
    expect(returning.json()).toEqual(first.json());
    expect(returning.headers['set-cookie']).toBeUndefined();
    expect(returning.headers['cache-control']).toBe('no-store');

    const newcomer = await running!.app.inject({ method: 'GET', url: '/api/session' });
    expect(newcomer.statusCode).toBe(200);
    expect(newcomer.json<{ playerId: string }>().playerId).not.toBe(identity.playerId);
  });
});
