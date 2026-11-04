import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const main = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/renderer/src/views/SettingsView.vue', import.meta.url), 'utf8')
test('Discord client ID baked into main and persisted migration', () => {
  assert.match(main, /const DISCORD_APP_ID = '\d{17,22}'/)
  assert.match(main, /discordClientId: DISCORD_APP_ID/)
})
test('No manual Discord ID field; opt-in retained', () => {
  assert.doesNotMatch(view, /v-model\.trim="native\.discordClientId"/)
  assert.match(view, /v-model="native\.discordEnabled"/)
})
