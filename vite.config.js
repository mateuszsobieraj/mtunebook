import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineBuild } from './scripts/offline-build.mjs';

export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [react(), offlineBuild()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.{test,spec}.{js,jsx}', 'scripts/**/*.test.js']
  }
});
