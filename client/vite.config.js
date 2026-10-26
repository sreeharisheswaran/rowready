import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  // Avoid Windows mapped-drive probing; this repository does not use symlinks.
  resolve: { preserveSymlinks: true },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.PORT || 3000}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
