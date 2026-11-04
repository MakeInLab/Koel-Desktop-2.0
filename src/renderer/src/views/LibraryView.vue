<script setup lang="ts">
import { computed, ref } from 'vue'
import SongRows from '../components/SongRows.vue'
import { useKoelStore } from '../stores/koel'
const koel = useKoelStore(), filter = ref('')
const tracks = computed(() => koel.songs.filter(song => `${song.artist} ${song.title} ${song.album}`.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase())))
</script>
<template>
  <div class="page-title"><span class="eyebrow">MA COLLECTION</span><h1>Bibliothèque musicale</h1><p>{{ koel.connected ? `Connecté à ${koel.session?.url}. Pour une recherche globale, utilisez Recherche.` : 'Connectez votre serveur Koel depuis les Paramètres.' }}</p></div>
  <p v-if="koel.error" class="notice" role="alert">{{koel.error}}</p>
  <div class="library-tools"><label class="search"><span>⌕</span><input v-model="filter" placeholder="Filtrer les morceaux chargés…" aria-label="Filtrer les morceaux chargés" /></label><span class="count-pill">{{koel.songs.length}}{{koel.total !== null ? ` / ${koel.total}` : ''}} morceaux</span></div>
  <div class="table-header"><span>#</span><span>TITRE</span><span>ALBUM</span><span>DURÉE</span></div>
  <SongRows :songs="tracks" :empty="koel.loadingSongs ? 'Chargement…' : 'Aucun morceau à afficher.'" />
  <div class="load-actions"><button v-if="koel.nextPage" class="primary-btn" :disabled="koel.loadingSongs" @click="koel.more()">{{koel.loadingSongs ? 'Chargement…' : 'Charger 50 morceaux supplémentaires'}}</button><button v-if="koel.connected" class="secondary-btn" :disabled="koel.loadingSongs" @click="koel.refresh()">Actualiser tout</button></div>
</template>
