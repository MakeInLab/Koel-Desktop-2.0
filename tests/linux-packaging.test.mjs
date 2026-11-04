import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const script = read('../scripts/package-linux.mjs')
const pkg = JSON.parse(read('../package.json'))

test('Debian package is amd64 and installs desktop launcher with original logo', () => {
  assert.match(script, /'Architecture: amd64'/)
  assert.match(script, /\$\{appName\}\.desktop/)
  assert.match(script, /resources', 'icon\.png'/)
  assert.match(script, /'hicolor', '256x256', 'apps'/)
  assert.match(script, /\['--root-owner-group', '--build'/)
})
test('Linux runtime keeps Chromium sandbox enabled and production dependencies only', () => {
  assert.match(script, /chmodSync\(join\(installDir, 'chrome-sandbox'\), 0o4755\)/)
  assert.match(script, /'--omit=dev'/)
  assert.match(script, /'--ignore-scripts'/)
  assert.doesNotMatch(script, /--no-sandbox/)
  assert.equal('electron-builder' in (pkg.devDependencies || {}), false)
})
test('Linux scripts provide .deb and portable .tar.gz without changing version', () => {
  assert.equal(pkg.version, '0.7.6')
  assert.match(pkg.scripts['dist:linux'], /package-linux\.mjs/)
  assert.match(pkg.scripts['dist:deb'], /--deb-only/)
  assert.match(pkg.scripts['dist:linux-portable'], /--portable-only/)
  assert.match(script, /linux-amd64\.deb/)
  assert.match(script, /linux-x64-portable\.tar\.gz/)
})
