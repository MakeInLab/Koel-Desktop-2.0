import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')

test('audit and repair use shared npm runner without shell true', () => {
  const audit = read('scripts/audit-dependencies.mjs')
  const repair = read('scripts/repair-dependencies.mjs')
  const helper = read('scripts/npm-process.mjs')
  assert.match(audit, /npmProcess\(args/)
  assert.match(repair, /npmProcess\(args/)
  assert.match(helper, /shell: false/)
  assert.doesNotMatch(audit + repair + helper, /shell: true/)
})
test('no unsafe global override of minimatch or forced electron-builder downgrade', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.devDependencies['electron-builder'], undefined)
  assert.match(pkg.scripts['dist:win'], /scripts\/package-windows\.mjs/)
  assert.equal(pkg.overrides?.minimatch, undefined)
})
