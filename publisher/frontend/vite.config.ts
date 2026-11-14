import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// The panel is built into ../public, which the backend serves (see backend/src/api/server.ts).
export default defineConfig({
  base: './', // relative asset addresses: the app can live under any BASE_PATH
  plugins: [react(), tailwindcss()],
  build: { outDir: resolve(__dirname, '..', 'public'), emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3100', '/files': 'http://localhost:3100' } },
});
