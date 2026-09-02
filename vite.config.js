import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { abcjs: ['abcjs'] }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.{test,spec}.{js,jsx}']
  }
});
