import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('blocks server-only source, catalogue and raw imports over the development HTTP server', async () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const cacheDir = await mkdtemp(resolve(tmpdir(), 'rene-vite-audit-'));
  const server = await createServer({ root, cacheDir, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('Adresse de test invalide.');
    const origin = `http://127.0.0.1:${address.port}`;
    for (const source of ['packages/engine/src/words.ts', 'packages/engine/src/word-data/cinema.json', 'apps/server/src/rooms.ts']) {
      for (const suffix of ['', '?raw', '?import', '?url&inline']) {
        const response = await fetch(`${origin}/@fs/${resolve(root, '../..', source)}${suffix}`);
        expect(response.status, `${source}${suffix}`).toBe(403);
      }
    }
    await expect(server.transformRequest(`/@fs/${resolve(root, '../../packages/engine/src/words.ts')}`)).rejects.toThrow('Un module serveur');
  } finally { await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
});
