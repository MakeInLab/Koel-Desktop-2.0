import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('version metadata and About remain synchronized', () => {
  const pkg = JSON.parse(read('package.json'))
  const version = read('src/shared/version.ts')
  const settings = read('src/renderer/src/views/SettingsView.vue')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.ok(version.includes(`APP_VERSION = '${pkg.version}'`))
  assert.match(settings, /APP_NAME, APP_VERSION/)
  assert.doesNotMatch(settings, /APP_PHASE/)
})
test('dependency audit invokes full, production and dependency tree checks', () => {
  const source = read('scripts/audit-dependencies.mjs')
  assert.match(source, /npm\(\['audit', '--json'\]\)/)
  assert.match(source, /npm\(\['audit', '--omit=dev', '--json'\]\)/)
  assert.match(source, /npm\(\['ls', '--all', '--json'\]\)/)
  assert.match(source, /if \(report\.errors\.length \|\| vulnerable/)
  assert.match(source, /package-lock\.json absent/)
  assert.match(source, /dependances-audit\.md/)
})
test('audit workflow uploads reports and checks production vulnerabilities', () => {
  const workflow = read('.github/workflows/security.yml')
  assert.match(workflow, /scripts\/audit-dependencies\.mjs --strict/)
  assert.match(workflow, /upload-artifact@v4/)
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/)
})
