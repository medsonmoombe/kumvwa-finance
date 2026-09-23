import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // 5173 must also appear in the API's CORS_ORIGINS.
  server: { port: 5173 },
});
