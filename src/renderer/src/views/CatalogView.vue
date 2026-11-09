<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, useKoelStore } from '../stores/koel'
import type { KoelAlbum, KoelArtist, KoelCatalogPage } from '../../../shared/koel'
import MediaGrid from '../components/MediaGrid.vue'

const route = useRoute(), router = useRouter(), koel = useKoelStore(), filter = ref('')
const showCreate = ref(false), creating = ref(false), createName = ref(''), createDescription = ref(''), mutationError = ref(''), notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function showNotice(value: string): void {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  notice.value = value
  noticeTimer = setTimeout(() => { notice.value = ''; noticeTimer = undefined }, 3000)
}

const kind = computed(() => route.path === '/albums' ? 'albums' : route.path === '/artists' ? 'artists' : 'playlists')
const title = computed(() => kind.value === 'albums' ? 'Albums' : kind.value === 'artists' ? 'Artistes' : 'Playlists')
const PAGE_SIZE = 10
// The ordinary browse requests return 10 items. A separate, larger catalogue
// page is used only for filtering, so matches hidden in later pages can be found
// without dozens of clicks on "Charger plus".
const SEARCH_PAGE_SIZE = 100
const MAX_SEARCH_PAGES_PER_RUN = 30
const visibleCount = ref(PAGE_SIZE)
const filtering = computed(() => kind.value !== 'playlists' && !!filter.value.trim())
const filterMatches = ref<(KoelAlbum | KoelArtist)[]>([])
const filteredNextPage = ref<number | null>(null)
const loadingFiltered = ref(false)
const searchError = ref('')
const loading = computed(() => kind.value === 'albums' ? koel.loadingAlbums : kind.value === 'artists' ? koel.loadingArtists : koel.loadingPlaylists)

const availableItems = computed(() => {
  if (filtering.value) return filterMatches.value
  if (kind.value === 'albums') return koel.albums
  if (kind.value === 'artists') return koel.artists
  const term = normalize(filter.value.trim())
  return koel.playlists.filter(item => normalize(item.name).includes(term))
})
const items = computed(() => kind.value === 'playlists' ? availableItems.value : availableItems.value.slice(0, visibleCount.value))
const moreAvailable = computed(() => {
  if (kind.value === 'playlists') return false
  if (availableItems.value.length > visibleCount.value) return true
  if (filtering.value) return filteredNextPage.value !== null
  return kind.value === 'albums' ? koel.albumNextPage !== null : koel.artistNextPage !== null
})
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
}
function matches(item: KoelAlbum | KoelArtist, term: string): boolean {
  // Albums must also be found by artist, not only by the album title.
  return normalize(item.name).includes(term) || ('artist' in item && normalize(item.artist).includes(term))
}

let filterTimer: ReturnType<typeof setTimeout> | undefined
let filterGeneration = 0
let destroyed = false

async function loadFilteredMatches(): Promise<void> {
  if (destroyed || !koel.connected || !filtering.value || loadingFiltered.value) return
  const generation = filterGeneration
  const selectedKind = kind.value
  const term = normalize(filter.value.trim())
  loadingFiltered.value = true
  searchError.value = ''
  try {
    for (let scanned = 0; scanned < MAX_SEARCH_PAGES_PER_RUN; scanned++) {
      if (destroyed || generation !== filterGeneration || kind.value !== selectedKind || !koel.connected) return
      const page = filteredNextPage.value
      if (page === null || filterMatches.value.length >= visibleCount.value) break
      const result: KoelCatalogPage<KoelAlbum | KoelArtist> = selectedKind === 'albums'
        ? await window.desktop.koel.loadAlbums(page, SEARCH_PAGE_SIZE)
        : await window.desktop.koel.loadArtists(page, SEARCH_PAGE_SIZE)
      // The user may have typed a new query or switched servers mid-request.
      if (destroyed || generation !== filterGeneration || kind.value !== selectedKind || !koel.connected) return
      const ids = new Set(filterMatches.value.map(item => item.id))
      const added = result.items.filter(item => matches(item, term) && !ids.has(item.id) && !!ids.add(item.id))
      filterMatches.value = filterMatches.value.concat(added)
      filteredNextPage.value = result.nextPage === page ? null : result.nextPage
    }
  } catch (error) {
    if (!destroyed && generation === filterGeneration) searchError.value = message(error)
  } finally {
    if (!destroyed && generation === filterGeneration) loadingFiltered.value = false
  }
}

async function loadMoreVisible(): Promise<void> {
  if (loading.value || loadingFiltered.value || kind.value === 'playlists') return
  // Reveal the next ten already fetched cards first, before requesting new data.
  if (availableItems.value.length >= visibleCount.value) visibleCount.value += PAGE_SIZE
  if (filtering.value) { await loadFilteredMatches(); return }
  if (kind.value === 'albums' && koel.albums.length < visibleCount.value && koel.albumNextPage !== null) await koel.moreAlbums()
  if (kind.value === 'artists' && koel.artists.length < visibleCount.value && koel.artistNextPage !== null) await koel.moreArtists()
}

watch([filter, kind, () => koel.connected, () => koel.session?.url], () => {
  filterGeneration++
  visibleCount.value = PAGE_SIZE
  filterMatches.value = []
  filteredNextPage.value = filtering.value ? 1 : null
  loadingFiltered.value = false
  searchError.value = ''
  if (filterTimer !== undefined) clearTimeout(filterTimer)
  if (filtering.value && koel.connected) {
    filterTimer = setTimeout(() => { void loadFilteredMatches() }, 250)
  }
}, { immediate: true })
onUnmounted(() => {
  destroyed = true
  filterGeneration++
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  if (filterTimer !== undefined) clearTimeout(filterTimer)
})
// Reload from Koel whenever the user opens the Playlists tab (or switches server).
watch([kind, () => koel.session?.url], () => { if (kind.value === 'playlists' && koel.connected) void koel.fetchPlaylists() }, { immediate: true })
async function createPlaylist(): Promise<void> {
  if (creating.value) return
  creating.value = true; mutationError.value = ''; notice.value = ''
  try {
    const playlist = await koel.createPlaylist(createName.value, createDescription.value)
    showCreate.value = false; createName.value = ''; createDescription.value = ''
    showNotice(`Playlist « ${playlist.name} » créée.`)
    await router.push(`/playlists/${encodeURIComponent(playlist.id)}`)
  } catch(e) { mutationError.value = message(e) }
  finally { creating.value = false }
}
</script>
<template>
  <div class="page-title"><span class="eyebrow">VOTRE MUSIQUE</span><h1>{{title}}</h1><p>Explorez {{kind === 'playlists' ? 'vos playlists Koel' : `vos ${title.toLowerCase()}`}}.</p></div>
  <div v-if="!koel.connected" class="empty-panel">Connectez votre serveur dans <RouterLink to="/settings">Paramètres</RouterLink> pour accéder à votre musique.</div>
  <template v-else>
    <div v-if="kind === 'playlists'" class="playlist-create-bar"><button class="primary-btn" @click="showCreate = !showCreate; mutationError = ''">{{showCreate ? 'Annuler' : '＋ Créer une playlist'}}</button></div>
    <form v-if="kind === 'playlists' && showCreate" class="playlist-create-form" @submit.prevent="createPlaylist">
      <label>Nom de la playlist<input v-model.trim="createName" maxlength="191" required placeholder="Ma nouvelle playlist" /></label>
      <label>Description (facultative)<textarea v-model="createDescription" maxlength="2000" rows="2" placeholder="Quelques mots sur cette sélection…"></textarea></label>
      <button class="primary-btn" type="submit" :disabled="creating || !createName.trim()">{{creating ? 'Création…' : 'Créer la playlist'}}</button>
    </form>
    <p v-if="mutationError" class="notice" role="alert">{{mutationError}}</p>
    <p v-if="notice" class="playlist-success" role="status">{{notice}}</p>
    <div class="library-tools"><label class="search"><span>⌕</span><input v-model="filter" :placeholder="`Rechercher parmi les ${title.toLowerCase()}…`" :aria-label="`Filtrer les ${title.toLowerCase()}`" /></label><span class="count-pill">{{items.length}} {{kind === 'playlists' ? 'éléments' : 'affichés'}}</span></div>
    <p v-if="searchError && filtering" class="notice" role="alert">Recherche interrompue : {{searchError}}</p>
    <p v-if="(loading || loadingFiltered) && !items.length" class="empty" role="status">{{filtering ? 'Recherche dans la bibliothèque…' : `Chargement des ${title.toLowerCase()}…`}}</p>
    <MediaGrid v-else :items="items" :kind="kind" :empty="filtering && filteredNextPage !== null ? 'Recherche partielle. Cliquez sur « Charger plus » pour continuer.' : filter ? 'Aucun élément ne correspond à ce filtre.' : 'Cette collection est vide.'" />
    <div class="load-actions">
      <button v-if="moreAvailable" class="primary-btn" :disabled="loading || loadingFiltered" @click="loadMoreVisible">{{loading || loadingFiltered ? 'Chargement…' : 'Charger plus (+10)'}}</button>
      <span v-if="loadingFiltered && items.length" class="count-pill" role="status">Recherche des autres résultats…</span>
    </div>
  </template>
</template>
