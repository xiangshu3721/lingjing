import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 子路径 /lingjing/；如需部署到根目录：VITE_BASE=/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE || '/lingjing/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as never);
