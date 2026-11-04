import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

test('About shows only product and centralized version, no phase', () => {
  const settings = read('src/renderer/src/views/SettingsView.vue')
  const version = read('src/shared/version.ts')
  assert.match(settings, /APP_NAME, APP_VERSION/)
  assert.doesNotMatch(settings, /APP_PHASE|\{\{ APP_PHASE \}\}/)
  assert.doesNotMatch(version, /APP_PHASE/)
  assert.match(version, /APP_VERSION = '\d+\.\d+\.\d+'/)
})
test('Electron packaged renderer has no devtools or insecure content', () => {
  const main = read('src/main/index.ts')
  assert.match(main, /devTools: !app.isPackaged/)
  assert.match(main, /allowRunningInsecureContent: false/)
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/)
  assert.match(main, /will-attach-webview/)
  assert.match(main, /will-redirect/)
  assert.match(main, /setPermissionRequestHandler/)
  assert.match(main, /setPermissionCheckHandler/)
})
test('Koel responses are streamed with a strict byte limit', () => {
  const source = read('src/main/services/koel.ts')
  assert.match(source, /const reader = response.body.getReader\(\)/)
  assert.match(source, /received > MAX_BODY/)
  assert.match(source, /redirect: 'error'/)
  assert.match(source, /AbortSignal.timeout\(20000\)/)
})
test('Encrypted credentials written atomically with bounded restore', () => {
  const source = read('src/main/services/koel.ts')
  assert.match(source, /safeStorage.encryptString/)
  assert.match(source, /await rename\(temp, dest\)/)
  assert.match(source, /encrypted.length > 32 \* 1024/)
  assert.match(source, /await forget\(\)/)
  assert.doesNotMatch(source, /console\.log\([^\n]*token/)
})
test('Legacy Koel audio path still uses scoped token, not API bearer', () => {
  const source = read('src/main/services/koel.ts')
  assert.match(source, /url.searchParams.set\('api_token', a.audioToken\)/)
  assert.match(source, /legacyPlayUrl\(a, songId\)/)
})
