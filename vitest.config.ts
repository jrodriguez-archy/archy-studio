import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests (tests/*.test.ts) run in Node; the engine tests (tests/engine/*) drive Chromium through
// Playwright. Server-only and Next request modules are stubbed: tests call the code below them.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
      'next/navigation': path.resolve(__dirname, 'tests/stubs/next.ts'),
      'next/headers': path.resolve(__dirname, 'tests/stubs/next.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
