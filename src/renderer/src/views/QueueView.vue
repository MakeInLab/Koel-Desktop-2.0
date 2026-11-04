<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import Artwork from '../components/Artwork.vue'
import PlaylistMenu from '../components/PlaylistMenu.vue'
import { formatDuration } from '../data/demo'
const player = usePlayerStore()
const dragging = ref<number | null>(null)
function drop(to: number): void { if (dragging.value !== null) player.move(dragging.value, to); dragging.value = null }
</script>
<template>
  <div class="page-title"><span class="eyebrow">VOTRE MUSIQUE</span><h1>File de lecture</h1><p>Réorganisez les morceaux par glisser-déposer. La file est sauvegardée pour ce compte Koel.</p></div>
  <div class="queue-toolbar"><span>{{ player.queue.length }} morceaux</span><div class="queue-toolbar-actions"><button class="secondary-btn" :disabled="player.index < 0 || !player.upcoming.length" @click="player.clearUpcoming()">Vider les titres suivants</button><button class="secondary-btn" :disabled="!player.queue.length" @click="player.clear()">Vider toute la file</button></div></div>
  <div v-if="!player.queue.length" class="empty-panel">La file est vide. Ajoutez des morceaux depuis votre bibliothèque.</div>
  <div v-else class="queue-list">
    <div v-for="(song,i) in player.queue" :key="`${song.id}:${i}`" class="queue-row" :class="{current: i===player.index, dragging:dragging===i}" draggable="true" @dragstart="dragging=i" @dragend="dragging=null" @dragover.prevent @drop.prevent="drop(i)">
      <span class="drag-handle" title="Glisser pour déplacer">⠿</span>
      <Artwork :src="song.cover" :color="song.color" :label="song.album" size="42px"/>
      <div class="queue-track"><strong>{{ song.title }}</strong><small>{{ song.artist }} · {{ song.album }}</small></div>
      <span v-if="i===player.index" class="queue-current">{{player.playing?'En lecture':'Sélectionné'}}</span>
      <span v-else class="queue-duration">{{formatDuration(song.duration)}}</span>
      <PlaylistMenu :song="song" compact placement="top" />
      <button class="queue-btn" title="Lire ce titre" aria-label="Lire ce titre" @click="player.playQueue([...player.queue],i)">▶</button>
      <button class="queue-btn" title="Déplacer vers le haut" aria-label="Monter" :disabled="i===0" @click="player.move(i,i-1)">↑</button>
      <button class="queue-btn" title="Déplacer vers le bas" aria-label="Descendre" :disabled="i===player.queue.length-1" @click="player.move(i,i+1)">↓</button>
      <button class="queue-btn" title="Supprimer de la file" aria-label="Supprimer" @click="player.removeAt(i)">×</button>
    </div>
  </div>
</template>
