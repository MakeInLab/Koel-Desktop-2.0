<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import MediaGrid from '../components/MediaGrid.vue'
import SongRows from '../components/SongRows.vue'
import { useKoelStore, message } from '../stores/koel'
import type { KoelSearchResult } from '../../../shared/koel'
const koel = useKoelStore(), term = ref(''), loading = ref(false), error = ref('')
const results = ref<KoelSearchResult>({ songs: [], albums: [], artists: [] })
let timer: ReturnType<typeof setTimeout> | undefined
let epoch = 0
watch([term, () => koel.session?.url], () => {
  if (timer) clearTimeout(timer)
  const id = ++epoch
  results.value = { songs: [], albums: [], artists: [] }; error.value = ''
  if (!koel.connected || term.value.trim().length < 2) { loading.value = false; return }
  loading.value = true
  timer = setTimeout(async () => {
    try { const found = await koel.search(term.value.trim()); if (id === epoch) results.value = found }
    catch (e) { if (id === epoch) error.value = message(e) }
    finally { if (id === epoch) loading.value = false }
  }, 350)
}, { immediate: true })
onUnmounted(() => { epoch++; if (timer) clearTimeout(timer) })
</script>
<template>
  <div class="page-title"><span class="eyebrow">RECHERCHE KOEL</span><h1>Trouvez votre prochain morceau</h1><p>La recherche interroge tout le catalogue de votre serveur.</p></div>
  <div v-if="!koel.connected" class="empty-panel">Connectez-vous dans <RouterLink to="/settings">Paramètres</RouterLink> pour rechercher.</div>
  <template v-else>
    <label class="search search-global"><span>⌕</span><input v-model="term" autofocus placeholder="Rechercher un titre, un album ou un artiste…" aria-label="Rechercher sur Koel" maxlength="150" /></label>
    <p v-if="error" class="notice" role="alert">{{error}}</p>
    <p v-if="loading" class="empty" role="status">Recherche sur Koel…</p>
    <p v-else-if="term.trim().length < 2" class="empty">Saisissez au moins deux caractères.</p>
    <template v-else>
      <section class="result-section"><div class="section-heading"><h2>Morceaux <small>{{results.songs.length}}</small></h2></div><SongRows :songs="results.songs" /></section>
      <section class="result-section"><div class="section-heading"><h2>Albums <small>{{results.albums.length}}</small></h2></div><MediaGrid kind="albums" :items="results.albums" /></section>
      <section class="result-section"><div class="section-heading"><h2>Artistes <small>{{results.artists.length}}</small></h2></div><MediaGrid kind="artists" :items="results.artists" /></section>
    </template>
  </template>
</template>
