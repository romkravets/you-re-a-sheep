import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      // Pilot: only the app entry. teacher/about/privacy entries arrive with Task 16.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // Dev-only feed harness for e2e; never part of the production build.
        ...(mode === 'test' ? { 'feed-harness': resolve(import.meta.dirname, 'tests/e2e/feed-harness.html') } : {}),
        ...(mode === 'test' ? { 'verdict-harness': resolve(import.meta.dirname, 'tests/e2e/verdict-harness.html') } : {}),
        ...(mode === 'test' ? { 'crack-harness': resolve(import.meta.dirname, 'tests/e2e/crack-harness.html') } : {}),
        ...(mode === 'test' ? { 'quiz-harness': resolve(import.meta.dirname, 'tests/e2e/quiz-harness.html') } : {}),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
}));
