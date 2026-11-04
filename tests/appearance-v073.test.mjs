import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('appearance preferences offer validated presets and save to local storage', () => {
  const s = read('src/renderer/src/stores/preferences.ts')
  for (const name of ['violet', 'pink', 'blue', 'green', 'orange', 'midnight', 'charcoal', 'ocean']) assert.match(s, new RegExp(name + ':'))
  for (const key of ['koel:appearance:accent', 'koel:appearance:surface', 'koel:appearance:corners', 'koel:appearance:font', 'koel:appearance:motion']) assert.ok(s.includes(key))
  assert.match(s, /Object\.prototype\.hasOwnProperty\.call/)
  assert.match(s, /resetAppearance/)
  assert.match(s, /\{ immediate: true \}/)
})

test('settings allow live previews and restore defaults', () => {
  const s = read('src/renderer/src/views/SettingsView.vue')
  assert.match(s, /appearance-swatches/)
  assert.match(s, /appearance-themes/)
  assert.match(s, /preferences\.accent = key/)
  assert.match(s, /preferences\.surface = key/)
  assert.match(s, /preferences\.resetAppearance\(\)/)
})

test('appearance variables flow to library, mini-player and controls', () => {
  const s = read('src/renderer/src/styles.css')
  for (const key of ['--user-accent','--user-base','--user-panel','--user-sidebar']) assert.ok(s.includes(key))
  assert.match(s, /\.shell\.mini-shell-mode \.player-bar/)
  assert.match(s, /\.nav-link\.router-link-active/)
})

test('no long em-dash appears in interface or version metadata', () => {
  const components = [
    'src/renderer/src/App.vue',
    'src/renderer/src/components/PlayerBar.vue',
    'src/renderer/src/views/SettingsView.vue',
    'src/shared/version.ts'
  ]
  for (const path of components) assert.doesNotMatch(read(path), /—/, path)
  assert.equal(JSON.parse(read('package.json')).version, read('src/shared/version.ts').match(/APP_VERSION = '([^']+)'/)[1])
})
