<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { KoelAlbum, KoelArtist, KoelPlaylist } from '../../../shared/koel'
import Artwork from './Artwork.vue'
const props = withDefaults(defineProps<{
  items: (KoelAlbum | KoelArtist | KoelPlaylist)[];
  kind: 'albums' | 'artists' | 'playlists'; empty?: string
}>(), { empty: 'Aucun résultat à afficher.' })
const router = useRouter()
const name = (item: KoelAlbum | KoelArtist | KoelPlaylist): string => item.name
const image = (item: KoelAlbum | KoelArtist | KoelPlaylist): string | null => 'image' in item ? item.image : item.cover
const secondary = (item: KoelAlbum | KoelArtist | KoelPlaylist): string => 'artist' in item ? item.artist : 'description' in item ? item.description || (item.smart ? 'Playlist intelligente' : 'Playlist') : 'Artiste'
function go(id: string): void { void router.push(`/${props.kind}/${encodeURIComponent(id)}`) }
</script>
<template>
  <div class="album-grid media-grid">
    <button v-for="item in items" :key="item.id" class="album-tile" @click="go(item.id)" :aria-label="`Ouvrir ${item.name}`">
      <Artwork :src="image(item)" :label="`Pochette de ${name(item)}`" size="100%" :symbol="kind === 'artists' ? '♬' : '♫'" />
      <strong>{{name(item)}}</strong><span>{{secondary(item)}}</span>
    </button>
  </div>
  <p v-if="!items.length" class="empty">{{empty}}</p>
</template>
