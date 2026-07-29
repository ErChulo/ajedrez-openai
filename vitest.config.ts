import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      './e2e/**',
      './playwright-report/**',
      './test-results/**',
    ],
  },
})
