<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from '../stores/koel'
import MediaGrid from '../components/MediaGrid.vue'
import { useKoelStore } from '../stores/koel'
const route = useRoute(), router = useRouter(), koel = useKoelStore(), filter = ref('')
const showCreate = ref(false), creating = ref(false), createName = ref(''), createDescription = ref(''), mutationError = ref(''), notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function showNotice(value: string): void {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  notice.value = value
  noticeTimer = setTimeout(() => { notice.value = ''; noticeTimer = undefined }, 3000)
}
onUnmounted(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })
const kind = computed(() => route.path === '/albums' ? 'albums' : route.path === '/artists' ? 'artists' : 'playlists')
const title = computed(() => kind.value === 'albums' ? 'Albums' : kind.value === 'artists' ? 'Artistes' : 'Playlists')
const items = computed(() => koel[kind.value].filter(item => item.name.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase())))
const moreAvailable = computed(() => kind.value === 'albums' ? koel.albumNextPage !== null : kind.value === 'artists' ? koel.artistNextPage !== null : false)
const loading = computed(() => kind.value === 'albums' ? koel.loadingAlbums : kind.value === 'artists' ? koel.loadingArtists : koel.loadingPlaylists)
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
function more(): void { if (kind.value === 'albums') void koel.moreAlbums(); else if (kind.value === 'artists') void koel.moreArtists() }
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
    <div class="library-tools"><label class="search"><span>⌕</span><input v-model="filter" :placeholder="`Filtrer les ${title.toLowerCase()} chargés…`" :aria-label="`Filtrer les ${title.toLowerCase()}`" /></label><span class="count-pill">{{items.length}} éléments</span></div>
    <p v-if="loading && !items.length" class="empty">Chargement des {{title.toLowerCase()}}…</p>
    <MediaGrid v-else :items="items" :kind="kind" :empty="filter ? 'Aucun élément ne correspond à ce filtre.' : 'Cette collection est vide.'" />
    <div class="load-actions"><button v-if="moreAvailable" class="primary-btn" :disabled="loading" @click="more">{{loading ? 'Chargement…' : 'Charger plus'}}</button></div>
  </template>
</template>
