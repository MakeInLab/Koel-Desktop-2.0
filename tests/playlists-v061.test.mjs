import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8')
test('Koel v9.15 playlist mutations use exact routes and verbs',()=>{
 const code=read('src/main/services/koel.ts')
 assert.match(code, /'playlists', 'POST', a\.token, \{ name:/)
 assert.match(code, /`playlists\/\$\{playlistId\(id\)\}\/songs`, 'POST', a\.token, \{ songs: songIds\(ids\) \}/)
 assert.match(code, /`playlists\/\$\{playlistId\(id\)\}\/songs`, 'DELETE', a\.token, \{ songs: songIds\(ids\) \}/)
 assert.match(code, /function songIds\(value: unknown\)/)
})
test('IPC bridges all three writes without exposing API credentials',()=>{
 const main=read('src/main/index.ts'),preload=read('src/preload/index.ts')
 for (const ch of ['koel:create-playlist','koel:add-playlist-songs','koel:remove-playlist-songs']) {
  assert.ok(main.includes(ch), `main missing ${ch}`)
  assert.ok(preload.includes(ch), `preload missing ${ch}`)
 }
 assert.match(main,/if \(!trusted\(event\)\)/)
})
test('creating playlist is available in catalog with form validation',()=>{
 const view=read('src/renderer/src/views/CatalogView.vue')
 assert.match(view,/Créer une playlist/)
 assert.match(view,/createPlaylist/)
 assert.match(view,/maxlength="191"/)
})
test('song rows use the shared one-click playlist menu',()=>{
 const view=read('src/renderer/src/components/SongRows.vue')
 const menu=read('src/renderer/src/components/PlaylistMenu.vue')
 assert.match(view,/<PlaylistMenu :song=\"song\"/)
 assert.match(menu,/koel\.addPlaylistSongs\(id, \[props\.song\.id\]\)/)
 assert.match(menu,/createAndAdd/)
 assert.doesNotMatch(view,/<select/)
})
test('playlist details refresh after removal and smart playlists remain protected',()=>{
 const view=read('src/renderer/src/views/CollectionView.vue')
 assert.match(view,/removePlaylistSongs\(id\.value, \[song\.id\]\)/)
 assert.match(view,/songs\.value = await koel\.collectionSongs\('playlists', id\.value\)/)
 assert.match(view,/!playlist\.value\.smart/)
 assert.match(view,/playlist-hint/)
})
test('legacy audio streaming and Discord listening preserved',()=>{
 assert.match(read('src/main/services/koel.ts'),/legacyPlayUrl/)
 assert.match(read('src/main/services/discord.ts'),/type:\s*2/)
})
