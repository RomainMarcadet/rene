import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react(), {
    name: 'server-only-word-boundary',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let path = request.url ?? '';
        try { path = decodeURIComponent(path); } catch { /* Vite handles malformed URLs. */ }
        if (/\/(?:packages\/engine|apps\/server)\//u.test(path.replaceAll('\\', '/'))) {
          response.statusCode = 403; response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end('Module serveur inaccessible.'); return;
        }
        next();
      });
    },
    load(id) {
      if (/\/(?:packages\/engine|apps\/server)\//u.test(id.replaceAll('\\', '/'))) this.error('Un module serveur ne peut pas être importé par le client.');
    },
  }],
  server: {
    port: 5173,
    strictPort: true,
    // The workspace contains server-only secrets, including the word catalogue.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/packages/engine/**', '**/apps/server/**'] },
    proxy: {
      '/api': { target: process.env.RENE_API_PROXY ?? 'http://127.0.0.1:3001', changeOrigin: false },
      '/socket.io': { target: process.env.RENE_API_PROXY ?? 'http://127.0.0.1:3001', changeOrigin: false, ws: true },
    },
  },
  build: { chunkSizeWarningLimit: 1200, rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'], voice: ['livekit-client'] } } } },
});
