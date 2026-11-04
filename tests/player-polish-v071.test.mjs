import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('version single source drives app about page and package version', () => {
  const version = read('src/shared/version.ts').match(/APP_VERSION = '([^']+)'/)?.[1]
  assert.match(version ?? '', /^\d+\.\d+\.\d+$/)
  assert.equal(JSON.parse(read('package.json')).version, version)
  assert.match(read('src/renderer/src/views/SettingsView.vue'), /\{\{ APP_VERSION \}\}/)
  assert.match(read('src/renderer/src/App.vue'), /ref<string>\(APP_VERSION\)/)
  assert.match(read('scripts/sync-version.mjs'), /pkg\.version = found\[1\]/)
})

test('play and next/previous controls use consistent SVG playback icons', () => {
  const bar = read('src/renderer/src/components/PlayerBar.vue')
  const icons = read('src/renderer/src/components/PlaybackIcon.vue')
  for (const name of ['play','pause','previous','next','shuffle','repeat']) assert.match(icons, new RegExp(name))
  assert.match(bar, /<PlaybackIcon v-else/)
  assert.match(bar, /<PlaybackIcon name="previous"/)
  assert.match(bar, /<PlaybackIcon name="next"/)
  assert.doesNotMatch(bar, /player\.playing \? 'Ⅱ' : '▶'/)
})

test('playlist confirmation messages expire after three seconds with cleanup', () => {
  for (const name of ['components/PlaylistMenu.vue','views/CatalogView.vue','views/CollectionView.vue']) {
    const source=read('src/renderer/src/' + name)
    assert.match(source, /setTimeout\(\(\) => \{[^}]+\}, 3000\)/, name)
    assert.match(source, /clearTimeout\(/, name)
    assert.match(source, /onUnmounted\(/, name)
  }
})

test('mini player drag region covers artwork, song labels and background without buttons', () => {
  const css=read('src/renderer/src/styles.css')
  assert.match(css,/\.mini-shell-mode \.mini-widget\{-webkit-app-region:drag/)
  assert.match(css,/\.mini-widget-track \.artwork/)
  assert.match(css,/\.mini-widget button[^\n]*-webkit-app-region:no-drag/)
  assert.match(css,/\.mini-widget input[^\n]*-webkit-app-region:no-drag/)
})
