import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const code = readFileSync(new URL('../src/main/services/discord.ts', import.meta.url),'utf8')
test('Discord SET_ACTIVITY explicitly requests Listening (2)',()=>{
  assert.match(code, /rpc\.request\('SET_ACTIVITY'/)
  assert.match(code, /type:\s*2/)
  assert.doesNotMatch(code, /await rpc\.setActivity\(/)
})
test('Discord song title, artist and timing preserved',()=>{
  assert.match(code, /details: payload\.details/)
  assert.match(code, /state: payload\.state/)
  assert.match(code, /timestamps:/)
  assert.match(code, /rpc\.clearActivity\(/)
})
