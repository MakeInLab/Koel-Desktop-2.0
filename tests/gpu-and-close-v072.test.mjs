import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('hardware acceleration enabled early with GPU diagnosis', () => {
  const main = read('src/main/index.ts')
  assert.match(main, /app\.commandLine\.appendSwitch\('enable-gpu-rasterization'\)/)
  assert.ok(main.indexOf("app.commandLine.appendSwitch('enable-gpu-rasterization')") < main.indexOf('app.whenReady().then'))
  assert.doesNotMatch(main, /app\.disableHardwareAcceleration\(/)
  assert.match(main, /app\.getGPUFeatureStatus\(\)/)
  assert.match(read('src/preload/index.ts'), /desktop:gpu-status/)
  assert.match(read('src/renderer/src/views/SettingsView.vue'), /gpuStatus\.compositing/)
})

test('X always closes even if minimize-to-tray preference was previously enabled', () => {
  const main = read('src/main/index.ts')
  assert.match(main, /mainWindow\.on\('close', saveBounds\)/)
  assert.match(main, /app\.on\('window-all-closed', \(\) => app\.quit\(\)\)/)
  assert.doesNotMatch(main, /mainWindow\.on\('close', event =>/)
  assert.doesNotMatch(main, /settings\.minimizeToTray/)
  assert.match(main, /action === 'minimize'\) mainWindow\.minimize\(\)/)
  assert.match(main, /action === 'close'\) mainWindow\.close\(\)/)
  assert.doesNotMatch(read('src/renderer/src/views/SettingsView.vue'), /v-model="native\.minimizeToTray"/)
  assert.doesNotMatch(read('src/shared/native.ts'), /minimizeToTray/)
})

test('version is synced and Koel streaming and Discord preserved', () => {
  const version = read('src/shared/version.ts').match(/APP_VERSION = '([^']+)'/)?.[1]
  assert.ok(version)
  assert.equal(JSON.parse(read('package.json')).version, version)
  assert.match(read('src/main/services/koel.ts'), /legacyPlayUrl/)
  assert.match(read('src/main/services/discord.ts'), /type:\s*2/)
})
