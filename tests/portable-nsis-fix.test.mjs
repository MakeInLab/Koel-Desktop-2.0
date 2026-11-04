import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const script = readFileSync(new URL('../scripts/package-windows.mjs', import.meta.url), 'utf8')

test('portable launches the executable using correctly nested NSIS quotes', () => {
  assert.ok(script.includes(`ExecWait '"$PLUGINSDIR\\\\${'${exeName}'}"' $0`))
  assert.ok(!script.includes(`ExecWait '$"`))
})
test('MUI2 is loaded only by setup (portable does not declare unused MUI variables)', () => {
  assert.ok(script.includes('const setup = `!include "MUI2.nsh"'))
  const header = script.substring(script.indexOf('const header = ['), script.indexOf('if (buildSetup)'))
  assert.ok(!header.includes('MUI2.nsh'))
})
