<script setup lang="ts">
import { computed } from 'vue'
import MediaGrid from '../components/MediaGrid.vue'
import SongRows from '../components/SongRows.vue'
import { useKoelStore } from '../stores/koel'
const koel = useKoelStore()
const albums = computed(() => koel.albums.slice(0, 8))
const artists = computed(() => koel.artists.slice(0, 8))
const latest = computed(() => koel.songs.slice(0, 6))
</script>
<template>
  <div class="welcome"><div><span class="eyebrow">VOTRE UNIVERS MUSICAL</span><h1>La musique, <em>autrement.</em></h1><p>{{ koel.connected ? `Bonjour ${koel.session?.user.name}, retrouvez votre bibliothèque Koel.` : 'Connectez votre serveur Koel pour retrouver votre collection.' }}</p><RouterLink :to="koel.connected ? '/library' : '/settings'" class="primary-btn">{{ koel.connected ? 'Explorer la bibliothèque' : 'Connecter mon serveur' }} <span>↗</span></RouterLink></div><div class="welcome-decoration"><div class="vinyl"><span>♫</span></div></div></div>
  <div class="section-heading"><div><h2>Albums à découvrir</h2><p>Issus de votre serveur Koel</p></div><RouterLink to="/albums" class="text-link">Tout voir →</RouterLink></div>
  <MediaGrid kind="albums" :items="albums" :empty="koel.connected ? 'Aucun album chargé.' : 'Connectez votre serveur pour afficher vos albums.'" />
  <div class="section-heading second"><div><h2>Les artistes</h2><p>Parcourez votre collection</p></div><RouterLink to="/artists" class="text-link">Tout voir →</RouterLink></div>
  <MediaGrid kind="artists" :items="artists" :empty="koel.connected ? 'Aucun artiste chargé.' : 'Votre collection apparaîtra ici.'" />
  <div class="section-heading second"><div><h2>Morceaux de votre bibliothèque</h2><p>{{koel.total ?? koel.songs.length}} titres</p></div><RouterLink to="/library" class="text-link">Bibliothèque →</RouterLink></div>
  <SongRows :songs="latest" :empty="koel.connected ? 'Aucun morceau chargé.' : 'Connectez-vous pour accéder à votre musique.'" />
</template>
