import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { watch: { ignored: ['**/art-direction/**', '**/artifacts/**'] } },
  build: { chunkSizeWarningLimit: 1500 },
});
