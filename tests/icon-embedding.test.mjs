import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = readFileSync(join(root, 'scripts/package-windows.mjs'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
test('Windows .ico asset is preserved', () => {
  assert.ok(existsSync(join(root, 'resources/icon.ico')))
})
test('application executable receives the icon before packaging', () => {
  assert.match(script, /ResEdit\.Resource\.IconGroupEntry\.replaceIconsForResource/)
  assert.match(script, /writeFileSync\(appExe, Buffer\.from\(exe\.generate\(\)\)\)/)
  assert.match(script, /Logo Koel intégré/)
})
test('same application exe is used by Setup and Portable', () => {
  assert.match(script, /File \/r/)
  assert.match(script, /CreateShortCut/)
  assert.match(script, /ExecWait/)
  assert.match(script, /UninstallIcon/)
  assert.equal(pkg.devDependencies.resedit, '^3.1.0')
})
