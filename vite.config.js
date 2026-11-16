import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), embed: resolve(import.meta.dirname, 'embed/index.html'), player: resolve(import.meta.dirname, 'player/index.html') },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@videojs') || id.includes('node_modules/hls.js') || id.includes('node_modules/mux')) return 'videojs';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
