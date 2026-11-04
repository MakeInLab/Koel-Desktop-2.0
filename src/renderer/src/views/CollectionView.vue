<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Artwork from '../components/Artwork.vue'
import SongRows from '../components/SongRows.vue'
import { useKoelStore, message } from '../stores/koel'
import { usePlayerStore } from '../stores/player'
import type { KoelSong, KoelAlbum, KoelArtist } from '../../../shared/koel'
const route = useRoute(), koel = useKoelStore(), player = usePlayerStore()
const removingId = ref<string | null>(null), mutationError = ref(''), mutationNotice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function showNotice(value: string): void {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  mutationNotice.value = value
  noticeTimer = setTimeout(() => { mutationNotice.value = ''; noticeTimer = undefined }, 3000)
}
onUnmounted(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })
const songs = ref<KoelSong[]>([]), details = ref<KoelAlbum | KoelArtist | null>(null), loading = ref(false), error = ref('')
const kind = computed(() => String(route.params.kind) as 'albums' | 'artists' | 'playlists')
const id = computed(() => String(route.params.id))
const item = computed(() => koel[kind.value]?.find(item => item.id === id.value) ?? details.value)
const playlist = computed(() => kind.value === 'playlists' ? koel.playlists.find(item => item.id === id.value) : null)
const canRemove = computed(() => playlist.value && !playlist.value.smart && playlist.value.canAddSongs)
const name = computed(() => item.value?.name ?? 'Collection')
const cover = computed(() => item.value && ('image' in item.value ? item.value.image : item.value.cover))
const subtitle = computed(() => item.value && 'artist' in item.value ? item.value.artist : item.value && 'description' in item.value ? item.value.description : '')
let serial = 0
watch([kind, id, () => koel.session?.url], async () => {
  const requestId = ++serial
  songs.value = []; details.value = null; error.value = ''
  if (!koel.connected || !['albums','artists','playlists'].includes(kind.value)) return
  loading.value = true
  const collectionKind = kind.value
  if (collectionKind === 'playlists') void koel.fetchPlaylists()
  try {
    const [songsResult, detailsResult] = await Promise.all([
      koel.collectionSongs(collectionKind, id.value),
      collectionKind !== 'playlists' ? window.desktop.koel.loadCollectionDetails(collectionKind, id.value).catch(() => null) : Promise.resolve(null)
    ])
    if (serial === requestId) { songs.value = songsResult; details.value = detailsResult }
  }
  catch (e) { if (serial === requestId) error.value = message(e) }
  finally { if (serial === requestId) loading.value = false }
}, { immediate: true })
async function removeSong(song: KoelSong): Promise<void> {
  if (!canRemove.value || removingId.value) return
  removingId.value = song.id; mutationError.value = ''; mutationNotice.value = ''
  try {
    await koel.removePlaylistSongs(id.value, [song.id])
    songs.value = await koel.collectionSongs('playlists', id.value)
    showNotice(`« ${song.title} » retiré de cette playlist.`)
  } catch (e) { mutationError.value = message(e) }
  finally { removingId.value = null }
}
function playAll(): void { if (songs.value.length) void player.playQueue(songs.value, 0) }
</script>
<template>
  <RouterLink :to="`/${kind}`" class="text-link">← Retour aux {{kind}}</RouterLink>
  <div class="collection-hero">
    <Artwork :src="cover" :label="`Pochette : ${name}`" size="180px" />
    <div><span class="eyebrow">{{kind === 'albums' ? 'ALBUM' : kind === 'artists' ? 'ARTISTE' : 'PLAYLIST'}}</span><h1>{{name}}</h1><p>{{subtitle}}</p><p class="muted">{{songs.length}} titres</p><button class="primary-btn" :disabled="!songs.length" @click="playAll">▶ Tout écouter</button></div>
  </div>
  <p v-if="mutationError" class="notice" role="alert">{{mutationError}}</p>
  <p v-if="mutationNotice" class="playlist-success" role="status">{{mutationNotice}}</p>
  <p v-if="playlist?.smart" class="playlist-hint">Cette playlist est intelligente : ses morceaux sont gérés automatiquement par Koel.</p>
  <p v-if="error" class="notice" role="alert">{{error}}</p>
  <p v-if="loading" class="empty">Chargement des morceaux…</p>
  <SongRows v-else :songs="songs" :playlist-id="kind === 'playlists' ? id : undefined" :can-remove="!!canRemove" :removing-id="removingId" @remove-from-playlist="removeSong" :empty="koel.connected ? 'Aucun morceau dans cette collection.' : 'Connectez-vous à Koel.'" />
</template>
