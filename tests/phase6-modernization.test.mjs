import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
test('updated stable runtime and build dependencies', () => {
  assert.equal(pkg.devDependencies.electron, '45.2.1')
  assert.equal(pkg.devDependencies['electron-vite'], '6.0.0')
  assert.equal(pkg.devDependencies.vite, '8.3.5')
  assert.equal(pkg.dependencies.vue, '3.5.44')
})
test('modern build config with single sandbox preload bundle', () => {
  const s=read('electron.vite.config.ts')
  assert.doesNotMatch(s, /externalizeDepsPlugin\(/)
  assert.match(s, /externalizeDeps:\s*false/)
})
test('Windows CI creates NSIS artifact', () => {
  const s=read('.github/workflows/windows-build.yml')
  assert.match(s, /windows-latest/)
  assert.match(s, /npm run dist:win/)
  assert.match(s, /choco install nsis/)
})
test('Koel 9.15 audio strategy and Discord listening retained', () => {
  assert.match(read('src/main/services/koel.ts'), /legacyPlayUrl/)
  assert.match(read('src/main/services/discord.ts'), /type:\s*2/)
})
