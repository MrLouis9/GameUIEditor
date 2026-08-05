import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@game-ui/atlas': path.resolve(__dirname, '../../packages/atlas/src/index.ts'),
      '@game-ui/document': path.resolve(__dirname, '../../packages/document/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
