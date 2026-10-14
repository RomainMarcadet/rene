import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
      '/socket.io': { target: 'http://127.0.0.1:3001', changeOrigin: false, ws: true },
    },
  },
  build: { chunkSizeWarningLimit: 1200, rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'], voice: ['livekit-client'] } } } },
});
