<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlayerBar from './components/PlayerBar.vue'
import { usePreferencesStore } from './stores/preferences'
import { useKoelStore } from './stores/koel'
import { usePlayerStore } from './stores/player'
import type { PresenceSnapshot } from '../../shared/native'
import { APP_VERSION } from '../../shared/version'

const route = useRoute()
const preferences = usePreferencesStore()
const koel = useKoelStore()
const player = usePlayerStore()
const platform = ref('desktop')
const version = ref<string>(APP_VERSION)
const maximized = ref(false)
let offMaximized: () => void = () => {}
const miniMode = ref(false)
let offMiniMode: () => void = () => {}
let offActions: () => void = () => {}
let lastSent = 0

function minimizeWindow(): void { window.desktop.minimize() }
function maximizeWindow(): void { window.desktop.toggleMaximize() }
function closeWindow(): void { window.desktop.close() }

function sendPlayback(): void {
  const song = player.currentSong
  const snapshot: PresenceSnapshot = {
    song: song ? { id: song.id, title: song.title, artist: song.artist, album: song.album, duration: song.duration } : null,
    playing: player.playing,
    time: player.currentTime,
    duration: player.duration
  }
  window.desktop.native.setPlayback(snapshot)
}

watch(() => koel.session, session => {
  if (session) player.restoreForServer(session.url, session.user.id)
  else player.detachServer()
})
watch(() => [player.currentSong?.id, player.playing, player.duration], () => { lastSent = Date.now(); sendPlayback() })
watch(() => player.currentTime, () => { if (Date.now() - lastSent > 8000) { lastSent = Date.now(); sendPlayback() } })

onUnmounted(() => { offActions(); offMiniMode(); offMaximized() })
onMounted(async () => {
  try {
    offActions = window.desktop.native.onPlayerAction(action => {
      if (action === 'toggle') void player.toggle()
      else if (action === 'next') void player.next()
      else if (action === 'previous') void player.previous()
      else if (action === 'play' && !player.playing) void player.toggle()
      else if (action === 'pause' && player.playing) void player.toggle()
    })
    offMiniMode = window.desktop.native.onMiniMode(active => { miniMode.value = active })
    miniMode.value = await window.desktop.native.getMiniMode()
    offMaximized = window.desktop.onMaximizedChange(value => { maximized.value = value })
    maximized.value = await window.desktop.isMaximized()
    const info = await window.desktop.getInfo()
    platform.value = info.platform
    version.value = info.version
    await koel.restore()
    sendPlayback()
  } catch {
    koel.error = 'Electron est nécessaire pour accéder au serveur.'
  }
})

const pageTitle = computed(() => {
  const p = route.path
  return p === '/' ? 'Accueil' : p.startsWith('/library') ? 'Bibliothèque' : p.startsWith('/albums') ? 'Albums' : p.startsWith('/artists') ? 'Artistes' : p.startsWith('/playlists') ? 'Playlists' : p.startsWith('/queue') ? 'File de lecture' : p.startsWith('/search') ? 'Recherche' : 'Paramètres'
})
</script>

<template>
  <div class="shell" :class="{ compact: preferences.compact, 'mini-shell-mode': miniMode, 'frameless-shell': true, 'window-maximized': maximized && !miniMode }">
    <aside class="sidebar">
      <div class="brand"><div class="brand-icon">♫</div><div><strong>koel<span>.</span></strong><small>DESKTOP 2.0</small></div></div>
      <div class="side-label">EXPLORER</div>
      <nav class="navigation" aria-label="Navigation principale">
        <RouterLink to="/" class="nav-link"><span>⌂</span> Accueil</RouterLink>
        <RouterLink to="/search" class="nav-link"><span>⌕</span> Recherche</RouterLink>
        <RouterLink to="/library" class="nav-link"><span>▤</span> Bibliothèque</RouterLink>
        <RouterLink to="/albums" class="nav-link"><span>▣</span> Albums</RouterLink>
        <RouterLink to="/artists" class="nav-link"><span>♬</span> Artistes</RouterLink>
        <RouterLink to="/playlists" class="nav-link" @click="() => { if (route.path === '/playlists') void koel.fetchPlaylists() }"><span>☷</span> Playlists</RouterLink>
        <RouterLink to="/queue" class="nav-link"><span>≡</span> File de lecture</RouterLink>
      </nav>
      <div class="side-label side-label-secondary">APPLICATION</div>
      <nav class="navigation"><RouterLink to="/settings" class="nav-link"><span>⚙</span> Paramètres</RouterLink></nav>
      <div class="sidebar-bottom"><span class="status-dot" :style="{ background: koel.connected ? '#4fd9a2' : '#bd90ef' }"></span> {{ koel.connected ? koel.session?.url : 'Non connecté' }} <small>{{ platform }} · v{{ version }}</small></div>
    </aside>

    <section class="main-area">
      <header class="top-bar title-bar-shell">
        <div class="breadcrumb title-drag">MUSIQUE <span>/</span> <b>{{ pageTitle }}</b></div>
        <div class="top-right no-drag">
          <RouterLink to="/search" class="top-search" aria-label="Rechercher dans Koel">⌕ Rechercher</RouterLink>
          <RouterLink to="/settings" class="demo-pill">● {{ koel.connected ? koel.session?.user.name : 'Se connecter' }}</RouterLink>
          <div class="avatar">{{ koel.session?.user.name?.slice(0,1).toUpperCase() ?? 'K' }}</div>
          <div class="window-controls">
            <button class="window-btn" aria-label="Réduire" title="Réduire" @click="minimizeWindow">-</button>
            <button class="window-btn" :aria-label="maximized ? 'Restaurer la fenêtre' : 'Agrandir'" :title="maximized ? 'Restaurer la fenêtre' : 'Agrandir'" @click="maximizeWindow">{{ maximized ? '❐' : '▢' }}</button>
            <button class="window-btn window-btn-close" aria-label="Fermer" title="Fermer" @click="closeWindow">✕</button>
          </div>
        </div>
      </header>
      <main class="page-content"><p v-if="koel.error" class="notice" role="alert">{{ koel.error }}</p><RouterView /></main>
    </section>

    <PlayerBar :mini-mode="miniMode" />
  </div>
</template>
