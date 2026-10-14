import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001', '/socket.io': { target: 'http://localhost:3001', ws: true } } },
  build: { chunkSizeWarningLimit: 1200, rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'], voice: ['livekit-client'] } } } },
});
