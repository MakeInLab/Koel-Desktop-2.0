import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const pack = read('scripts/package-windows.mjs')

test('packaging uses no electron-builder or globally overridden minimatch', () => {
  assert.equal(pkg.version, '0.7.6')
  assert.equal(pkg.devDependencies['electron-builder'], undefined)
  assert.equal(pkg.overrides?.minimatch, undefined)
  assert.ok(!existsSync(new URL('../electron-builder.yml', import.meta.url)))
})
test('new packaging emits Setup and Portable with NSIS, without modifying renderer', () => {
  assert.match(pack, /Koel-Desktop-\$\{version\}-Setup-x64\.exe/)
  assert.match(pack, /Koel-Desktop-\$\{version\}-Portable-x64\.exe/)
  assert.match(pack, /InitPluginsDir/)
  assert.match(pack, /ExecWait/)
  assert.match(pack, /RequestExecutionLevel user/)
  assert.match(pack, /SetShellVarContext|CreateShortCut/)
  assert.match(pack, /DeleteRegKey HKCU/)
})
test('runtime uses only production dependencies and refuses unsafe npm scripts', () => {
  assert.match(pack, /--omit=dev/)
  assert.match(pack, /--ignore-scripts/)
  assert.match(pack, /npm_execpath/)
  assert.match(pack, /shell: false/)
  assert.match(pack, /isSymbolicLink\(\)/)
  assert.doesNotMatch(pack, /RMDir \/r "\$INSTDIR"/)
})
test('Windows CI installs NSIS externally and produces two artifacts', () => {
  const workflow = read('.github/workflows/windows-build.yml')
  assert.match(workflow, /choco install nsis/)
  assert.match(workflow, /npm run dist:win/)
  assert.match(workflow, /release\/\*\.exe/)
})
