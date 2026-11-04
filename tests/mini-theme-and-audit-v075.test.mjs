import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
test('app version is synchronized', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.ok(read('src/shared/version.ts').includes(`APP_VERSION = '${pkg.version}'`))
})
test('full mini-player adopts all appearance variables', () => {
  const css = read('src/renderer/src/styles.css')
  const area = css.slice(css.indexOf('/* v0.7.5 - one appearance system'))
  assert.match(area, /\.shell\.mini-shell-mode.*\.mini-widget\s*\{/s)
  assert.match(area, /\.mini-widget-controls \.mini-control\.mini-play\s*\{[\s\S]*?background:var\(--user-accent\)/)
  assert.match(area, /\.mini-widget-timeline input\s*\{[\s\S]*?var\(--user-accent\)/)
  assert.match(area, /\.mini-widget-volume input/)
  assert.match(area, /\.volume-control \.mini-open\s*\{[\s\S]*?var\(--user-accent\)/)
  assert.match(area, /\.mini-shell-mode \.playlist-menu-trigger/)
  assert.match(area, /data-corner-style="square"/)
})
test('security repair uses non-breaking npm fix and strict audit, no force', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['security:fix'], 'node scripts/repair-dependencies.mjs')
  const script = read('scripts/repair-dependencies.mjs')
  assert.match(script, /npm\(\['audit', 'fix'\]\)/)
  assert.match(script, /npm\(\['run', 'audit:check'\]\)/)
  assert.doesNotMatch(script, /npm\(\['audit', 'fix', '--force'\]/)
})
