import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/scripts/check-compatibility-qa.test.mjs'],
  },
})
