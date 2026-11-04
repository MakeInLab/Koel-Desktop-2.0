import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
const root = new URL('../', import.meta.url)
const read = p => readFileSync(new URL(p,root),'utf8')
test('one window, one audio engine',()=>{
 const main=read('src/main/index.ts')
 assert.doesNotMatch(main,/new BrowserWindow\(\{ width: 370/)
 assert.match(main,/function setMiniMode/)
 assert.match(main,/win\.setBounds\(\{ x, y, width, height \}, false\)/)
 assert.match(main,/win\.setMinimumSize\(360, 145\)/)
 assert.match(main,/win\.setResizable\(false\)/)
 const shrink = main.indexOf('win.setBounds({ x, y, width, height }, false)')
 const lock = main.indexOf('win.setResizable(false)', shrink)
 assert.ok(shrink > 0 && lock > shrink, 'resize occurs before locking the window')
 assert.match(main,/win\.setAlwaysOnTop\(true/)
 assert.match(main,/normalBounds/)
})
test('compact mode travels safely across preload and Vue',()=>{
 const preload=read('src/preload/index.ts'),app=read('src/renderer/src/App.vue')
 assert.match(preload,/native:mini-mode-changed/)
 assert.match(app,/mini-shell-mode/)
 assert.match(app,/onMiniMode/)
})
test('legacy Koel 9.15 and Discord remain untouched',()=>{
 const koel=read('src/main/services/koel.ts'),discord=read('src/main/services/discord.ts')
 assert.match(koel,/legacyPlayUrl/)
 assert.match(koel,/audioToken/)
 assert.match(discord,/SET_ACTIVITY/)
})
