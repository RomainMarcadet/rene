import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'], format: ['esm'], platform: 'node', target: 'node24',
  noExternal: ['@rene/contracts', '@rene/engine'], outDir: 'dist', clean: true, sourcemap: true, splitting: false,
});
