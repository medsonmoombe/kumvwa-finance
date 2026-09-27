import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    alias: {
      '@kumvwa/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
});
