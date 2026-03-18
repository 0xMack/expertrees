import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@skilltree/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
  },
})
