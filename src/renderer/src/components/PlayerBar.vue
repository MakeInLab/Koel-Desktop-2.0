<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import Artwork from './Artwork.vue'
import PlaylistMenu from './PlaylistMenu.vue'
import PlaybackIcon from './PlaybackIcon.vue'
import { formatDuration } from '../data/demo'

const player = usePlayerStore()
const props = withDefaults(defineProps<{ miniMode?: boolean }>(), { miniMode: false })

function openMini(): void { window.desktop.native.openMini() }
function closeMini(): void { window.desktop.native.closeMini() }
function minimizeWindow(): void { window.desktop.minimize() }
function closeWindow(): void { window.desktop.close() }
const progress = computed(() => Math.max(0, Math.min(100, (player.currentTime / (player.duration || 1)) * 100)))
let previousVolume = 72
function toggleMute(): void {
  if (player.volume > 0) { previousVolume = player.volume; player.volume = 0 }
  else player.volume = previousVolume
}
</script>

<template>
  <section v-if="props.miniMode" class="mini-widget" aria-label="Koel Mini Player">
    <header class="mini-widget-header title-drag">
      <div class="mini-widget-brand mini-drag-surface"><span class="mini-live-dot" aria-hidden="true"></span> KOEL <span class="mini-widget-subtitle">MINI PLAYER</span></div>
      <div class="mini-widget-window no-drag">
        <button class="mini-window-icon" title="Réduire dans la barre des tâches" aria-label="Réduire" @click="minimizeWindow">−</button>
        <button class="mini-window-icon" title="Revenir à la bibliothèque" aria-label="Restaurer la fenêtre" @click="closeMini">▢</button>
        <button class="mini-window-icon mini-close" title="Fermer Koel Desktop" aria-label="Fermer" @click="closeWindow">×</button>
      </div>
    </header>
    <div class="mini-widget-track mini-drag-surface" title="Maintenez ici pour déplacer le mini-lecteur">
      <Artwork v-if="player.currentSong" :src="player.currentSong.cover" :color="player.currentSong.color" :label="`Pochette de ${player.currentSong.album}`" size="60px" />
      <div v-else class="mini-placeholder" aria-hidden="true">♫</div>
      <div class="mini-widget-info mini-drag-surface">
        <strong :title="player.currentSong?.title || ''">{{ player.currentSong?.title || 'Aucun morceau' }}</strong>
        <span :title="player.currentSong?.artist || ''">{{ player.currentSong?.artist || 'Ouvrez votre bibliothèque' }}</span>
        <small v-if="player.error" class="mini-widget-error" :title="player.error">{{ player.error }}</small>
        <small v-else :title="player.currentSong?.album || ''">{{ player.currentSong?.album || 'Koel Desktop' }}</small>
      </div>
      <PlaylistMenu v-if="player.currentSong" :song="player.currentSong" compact placement="bottom" />
      <div class="mini-widget-volume no-drag">
        <button class="mini-mute" type="button" :aria-label="player.volume ? 'Couper le son' : 'Rétablir le son'" :title="player.volume ? 'Couper le son' : 'Rétablir le son'" @click="toggleMute"><PlaybackIcon :name="player.volume ? 'volume' : 'mute'" /></button>
        <input type="range" min="0" max="100" v-model.number="player.volume" aria-label="Volume" title="Volume" />
      </div>
    </div>
    <div class="mini-widget-controls no-drag">
      <button class="mini-control mini-secondary" :class="{'is-on':player.shuffle}" :disabled="player.queue.length < 2" aria-label="Lecture aléatoire" title="Lecture aléatoire" @click="player.shuffle=!player.shuffle"><PlaybackIcon name="shuffle" /></button>
      <button class="mini-control" :disabled="!player.currentSong" aria-label="Précédent" title="Précédent" @click="player.previous()"><PlaybackIcon name="previous" /></button>
      <button class="mini-control mini-play" :disabled="!player.currentSong || player.loading" :aria-label="player.playing ? 'Pause' : 'Lecture'" :title="player.playing ? 'Pause' : 'Lecture'" @click="player.toggle()"><span v-if="player.loading" class="playback-loading">…</span><PlaybackIcon v-else :name="player.playing ? 'pause' : 'play'" /></button>
      <button class="mini-control" :disabled="!player.hasNext" aria-label="Suivant" title="Suivant" @click="player.next()"><PlaybackIcon name="next" /></button>
      <button class="mini-control mini-secondary" :class="{'is-on':player.repeat!=='off'}" :disabled="!player.currentSong" :aria-label="`Répétition ${player.repeat}`" :title="`Répétition ${player.repeat}`" @click="player.cycleRepeat()"><PlaybackIcon :name="player.repeat === 'one' ? 'repeat-one' : 'repeat'" /></button>
    </div>
    <div class="mini-widget-timeline no-drag">
      <span>{{formatDuration(player.currentTime)}}</span>
      <input type="range" min="0" :max="Math.max(player.duration,1)" step="1" :value="player.currentTime" :disabled="!player.currentSong || !player.duration" :style="{'--position':`${progress}%`}" @input="player.seek(Number(($event.target as HTMLInputElement).value))" aria-label="Avancer ou reculer dans le morceau" />
      <span>{{formatDuration(player.duration)}}</span>
    </div>
  </section>
  <footer v-else class="player-bar">
    <div v-if="props.miniMode" class="mini-floating-head">
      <div class="mini-floating-title">Koel Mini Player</div>
      <div class="mini-window-actions no-drag">
        <button class="mini-window-btn" aria-label="Réduire" title="Réduire" @click="minimizeWindow">-</button>
        <button class="mini-window-btn" :title="'Revenir à la bibliothèque'" :aria-label="'Revenir à la bibliothèque'" @click="closeMini">▢</button>
        <button class="mini-window-btn mini-window-btn-close" aria-label="Fermer" title="Fermer" @click="closeWindow">✕</button>
      </div>
    </div>

    <div class="now-playing" v-if="player.currentSong">
      <Artwork :src="player.currentSong.cover" :color="player.currentSong.color" :label="`Pochette de ${player.currentSong.album}`" :size="props.miniMode ? '62px' : '51px'" />
      <div class="ellipsis">
        <strong>{{ player.currentSong.title }}</strong>
        <span>{{ player.currentSong.artist }}</span>
        <small v-if="props.miniMode" class="mini-album-line">{{ player.currentSong.album }}</small>
        <small v-if="player.error" class="player-error" :title="player.error">{{ player.error }}</small>
      </div>
    </div>
    <div class="now-playing" v-else>
      <span class="muted">Choisissez un morceau dans la bibliothèque</span>
    </div>

    <div class="play-center">
      <div class="play-controls no-drag">
        <button :class="{ 'control-active': player.shuffle }" :disabled="player.queue.length < 2" @click="player.shuffle=!player.shuffle" aria-label="Lecture aléatoire" title="Lecture aléatoire"><PlaybackIcon name="shuffle" /></button>
        <button :disabled="!player.currentSong" @click="player.previous()" aria-label="Précédent"><PlaybackIcon name="previous" /></button>
        <button class="play-button" :disabled="!player.currentSong || player.loading" @click="player.toggle()" :aria-label="player.playing ? 'Pause' : 'Lecture'"><span v-if="player.loading" class="playback-loading">…</span><PlaybackIcon v-else :name="player.playing ? 'pause' : 'play'" /></button>
        <button :disabled="!player.hasNext" @click="player.next()" aria-label="Suivant"><PlaybackIcon name="next" /></button>
        <button :class="{ 'control-active': player.repeat !== 'off' }" :disabled="!player.currentSong" @click="player.cycleRepeat()" :aria-label="`Répétition ${player.repeat}`" :title="`Répétition ${player.repeat}`"><PlaybackIcon :name="player.repeat === 'one' ? 'repeat-one' : 'repeat'" /></button>
      </div>
      <div class="progress no-drag">
        <span>{{ formatDuration(player.currentTime) }}</span>
        <input class="seek-slider" type="range" min="0" :max="Math.max(player.duration, 1)" step="1" :value="player.currentTime" :disabled="!player.currentSong || !player.duration" :style="{ '--position': `${progress}%` }" @input="player.seek(Number(($event.target as HTMLInputElement).value))" aria-label="Position de lecture" />
        <span>{{ formatDuration(player.duration) }}</span>
      </div>
    </div>

    <div class="volume-control no-drag">
      <button type="button" class="player-mute-button" :aria-label="player.volume ? 'Couper le son' : 'Rétablir le son'" @click="toggleMute"><PlaybackIcon :name="player.volume ? 'volume' : 'mute'" /></button>
      <input aria-label="Volume" type="range" min="0" max="100" v-model.number="player.volume" />
      <span>{{ player.volume }}%</span>
      <PlaylistMenu v-if="player.currentSong" :song="player.currentSong" compact placement="top" />
      <RouterLink v-if="!props.miniMode" to="/queue" class="queue-size" :title="`${player.queue.length} morceaux dans la file`">☷ {{ player.queue.length }}</RouterLink>
      <button v-if="!props.miniMode" class="mini-open" type="button" :title="'Mode mini-lecteur'" :aria-label="'Mode mini-lecteur'" @click="openMini">▣</button>
    </div>
  </footer>
</template>
