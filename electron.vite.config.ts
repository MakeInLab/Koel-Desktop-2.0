import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

// electron-vite v6: auto externalization replaces the deprecated plugin.
// The sandboxed preload is built as a single bundle.
export default defineConfig({
  main: {},
  preload: { build: { externalizeDeps: false } },
  renderer: {
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [vue()],
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } }
  }
})
