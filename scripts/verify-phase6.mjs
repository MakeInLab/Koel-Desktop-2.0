import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))

test('Phase 6 uses Electron 45 and current build toolchain', () => {
  assert.equal(pkg.version, '0.7.0')
  assert.equal(pkg.devDependencies.electron, '45.2.1')
  assert.equal(pkg.devDependencies['electron-vite'], '6.0.0')
  assert.equal(pkg.devDependencies.vite, '8.3.5')
})
test('No deprecated electron-vite externalization plugin', () => {
  const config = read('electron.vite.config.ts')
  assert.doesNotMatch(config, /externalizeDepsPlugin\s*\(/)
  assert.match(config, /externalizeDeps:\s*false/)
})
test('Koel legacy audio and Discord Listening remain wired', () => {
  assert.match(read('src/main/services/koel.ts'), /legacyPlayUrl/)
  assert.match(read('src/main/services/koel.ts'), /audioToken/)
  assert.match(read('src/main/services/discord.ts'), /type:\s*2/)
})
test('Existing playlist mutations remain present', () => {
  const api = read('src/main/services/koel.ts')
  assert.match(api, /createPlaylist/)
  assert.match(api, /addPlaylistSongs/)
  assert.match(api, /removePlaylistSongs/)
})
test('Windows workflow produces NSIS installer', () => {
  assert.match(read('.github/workflows/windows-build.yml'), /windows-latest/)
  assert.match(read('.github/workflows/windows-build.yml'), /--win nsis/)
})
