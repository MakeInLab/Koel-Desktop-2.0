import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

test('last normal window bounds and maximized state persist separately', () => {
  const main = read('src/main/index.ts')
  assert.match(main, /window-bounds\.json/)
  assert.match(main, /window-state\.json/)
  assert.match(main, /shouldStartMaximized\(\)/)
  assert.match(main, /if \(launchMaximized\) mainWindow\.maximize\(\)/)
  assert.match(main, /mainWindow\.on\('maximize'/)
  assert.match(main, /mainWindow\.on\('unmaximize'/)
  assert.match(main, /miniMode \|\| isTransitioningMini/)
})
test('miniplayer restores original maximized state without losing normal bounds', () => {
  const main = read('src/main/index.ts')
  assert.match(main, /normalWasMaximized = win\.isMaximized\(\)/)
  assert.match(main, /win\.getNormalBounds\(\)/)
  assert.match(main, /if \(normalWasMaximized\) win\.maximize\(\)/)
  assert.match(main, /isTransitioningMini = true/)
})
test('frameless maximized mode and dark scrollbars wired to renderer', () => {
  const app = read('src/renderer/src/App.vue')
  const css = read('src/renderer/src/styles.css')
  const preload = read('src/preload/index.ts')
  assert.match(app, /window-maximized/)
  assert.match(preload, /desktop:maximized-changed/)
  assert.match(css, /\.window-maximized/)
  assert.match(css, /::-webkit-scrollbar-thumb/)
  assert.match(css, /scrollbar-color:/)
})
