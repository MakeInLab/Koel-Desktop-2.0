import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8')
test('now-playing regular and mini expose playlist menu', () => {
 const v = read('src/renderer/src/components/PlayerBar.vue')
 assert.ok((v.match(/<PlaylistMenu/g) ?? []).length >= 2)
 assert.match(v, /:song="player.currentSong"/)
})
test('queue tracks have playlist shortcut', () => {
 assert.match(read('src/renderer/src/views/QueueView.vue'), /<PlaylistMenu :song="song"/)
})
test('playlists reload on visiting page and manual refresh button is removed', () => {
 const v = read('src/renderer/src/views/CatalogView.vue')
 assert.match(v, /watch\(\[kind, \(\) => koel\.session\?\.url\]/)
 assert.doesNotMatch(v, />Actualiser<\/button>/)
 const detail = read('src/renderer/src/views/CollectionView.vue')
 assert.match(detail, /collectionKind === 'playlists'/)
})
test('playlist menu is keyboard-dismissable and rendered over window', () => {
 const v = read('src/renderer/src/components/PlaylistMenu.vue')
 assert.match(v, /Teleport to="body"/)
 assert.match(v, /event\.key === 'Escape'/)
 assert.match(v, /!p\.smart/)
})
