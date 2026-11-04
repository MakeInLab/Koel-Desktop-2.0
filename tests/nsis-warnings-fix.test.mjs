import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const packaging = readFileSync(new URL('../scripts/package-windows.mjs', import.meta.url), 'utf8')

test('NSIS registry uninstall command is quoted without malformed $" constructs', () => {
  const line = packaging.split('\n').find(line => line.includes('"UninstallString"'))
  assert.ok(line)
  assert.match(line, /'"\$INSTDIR\\\\Uninstall\.exe"'/)
  assert.doesNotMatch(line, /\$"/)
})

test('NSIS file version metadata is complete', () => {
  assert.match(packaging, /VIAddVersionKey "FileVersion"/)
  assert.match(packaging, /VIAddVersionKey "LegalCopyright"/)
})

test('staged package explicitly defines npmignore to avoid gitignore fallback', () => {
  assert.match(packaging, /writeFileSync\(join\(appDir, '\.npmignore'\)/)
})
