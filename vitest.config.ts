import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Override environment per file via comment: /* @vitest-environment node */
    // Default jsdom para componentes React; integration tests usam node.
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/setup.dom.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    // Integration tests podem ser lentos (conexão DB)
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
