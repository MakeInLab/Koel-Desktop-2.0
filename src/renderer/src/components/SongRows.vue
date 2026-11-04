<script setup lang="ts">
import type { KoelSong } from '../../../shared/koel'
import Artwork from './Artwork.vue'
import { formatDuration } from '../data/demo'
import { usePlayerStore } from '../stores/player'
import PlaylistMenu from './PlaylistMenu.vue'
const props = withDefaults(defineProps<{ songs: KoelSong[]; empty?: string; playlistId?: string; canRemove?: boolean; removingId?: string | null }>(), { empty: 'Aucun morceau trouvé.' })
const emit = defineEmits<{ 'remove-from-playlist': [song: KoelSong] }>()
const player = usePlayerStore()

</script>
<template>
  <div class="song-list">
    <div v-for="(song, index) in songs" :key="`${song.id}:${index}`" class="song-line" role="button" tabindex="0" :class="{ selected: player.currentSong?.id === song.id }" @click="player.playQueue(songs, index)" @keydown.enter.prevent="player.playQueue(songs,index)" @keydown.space.prevent="player.playQueue(songs,index)">
      <span class="track-index">{{index+1}}</span>
      <Artwork :src="song.cover" :color="song.color" :label="`Pochette de ${song.album}`" size="42px" />
      <span class="song-desc"><strong>{{song.title}}</strong><small>{{song.artist}}</small></span>
      <span class="song-album">{{song.album}}</span><span class="song-length">{{formatDuration(song.duration)}}</span>
      <span class="song-actions">
        <button title="Lire juste après" aria-label="Lire ensuite" @keydown.stop @click.stop="player.playNext(song)">⤴</button>
        <button title="Ajouter à la file" aria-label="Ajouter à la file" @keydown.stop @click.stop="player.enqueue(song)">＋</button>
        <PlaylistMenu :song="song" compact placement="top" />
        <button v-if="props.playlistId && props.canRemove" :disabled="props.removingId === song.id" class="remove-playlist-song" title="Retirer uniquement de cette playlist" aria-label="Retirer de la playlist" @keydown.stop @click.stop="emit('remove-from-playlist', song)">Retirer</button>
      </span>
    </div>
    <p v-if="!songs.length" class="empty">{{empty}}</p>
  </div>
</template>
