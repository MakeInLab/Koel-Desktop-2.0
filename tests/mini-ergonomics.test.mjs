import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
test('mini-player has a dedicated compact UI with controls and volume', () => {
 const view = read('../src/renderer/src/components/PlayerBar.vue')
 assert.match(view, /v-if="props.miniMode" class="mini-widget"/)
 assert.match(view, /mini-widget-track/)
 assert.match(view, /mini-widget-controls/)
 assert.match(view, /mini-widget-timeline/)
 assert.match(view, /aria-label="Volume"/)
 assert.match(view, /closeMini\(\)/)
})
test('real window is compact and main rendering path is kept', () => {
 const main = read('../src/main/index.ts')
 const view = read('../src/renderer/src/components/PlayerBar.vue')
 assert.match(main, /const width = 488, height = 208/)
 assert.match(view, /<footer v-else class="player-bar">/)
 assert.match(main, /win\.setBounds\(\{ x, y, width, height \}, false\)/)
})
