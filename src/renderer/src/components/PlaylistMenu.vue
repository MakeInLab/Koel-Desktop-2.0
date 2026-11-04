<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useKoelStore, message } from '../stores/koel'
import type { KoelSong } from '../../../shared/koel'

const props = withDefaults(defineProps<{
  song: KoelSong
  compact?: boolean
  placement?: 'top' | 'bottom'
}>(), { compact: false, placement: 'top' })
const koel = useKoelStore()
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const open = ref(false)
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const feedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
function showFeedback(value: string): void {
  if (feedbackTimer !== undefined) clearTimeout(feedbackTimer)
  feedback.value = value
  feedbackTimer = setTimeout(() => { feedback.value = ''; feedbackTimer = undefined }, 3000)
}
const filter = ref('')
const creating = ref(false)
const newName = ref('')
const available = computed(() => koel.playlists.filter(p => p.canAddSongs && !p.smart && p.name.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase())))

function close(): void { open.value = false; creating.value = false; filter.value = ''; error.value = '' }
function outside(event: PointerEvent): void { if (root.value && !root.value.contains(event.target as Node) && !panel.value?.contains(event.target as Node)) close() }
function onKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') close() }
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', onKeydown); window.addEventListener('resize', close, { passive: true }) })
onUnmounted(() => { if (feedbackTimer !== undefined) clearTimeout(feedbackTimer); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', onKeydown); window.removeEventListener('resize', close) })

async function toggle(): Promise<void> {
  if (open.value) { close(); return }
  if (!koel.connected) return
  const anchor = root.value?.getBoundingClientRect()
  const small = window.innerHeight < 330
  const width = Math.min(308, Math.max(220, window.innerWidth - 20))
  const left = Math.max(10, Math.min((anchor?.left ?? 10), window.innerWidth - width - 10))
  const top = small ? 8 : Math.max(8, Math.min(window.innerHeight - 310, props.placement === 'top' ? (anchor?.top ?? 0) - 306 : (anchor?.bottom ?? 0) + 8))
  panelStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${Math.max(130, window.innerHeight - top - 8)}px` }
  open.value = true; error.value = ''; loading.value = true
  try { await koel.fetchPlaylists() } catch(e) { error.value = message(e) }
  finally { loading.value = false }
}
async function add(id: string): Promise<void> {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    await koel.addPlaylistSongs(id, [props.song.id])
    const target = koel.playlists.find(p => p.id === id)
    showFeedback(`Ajouté à « ${target?.name ?? 'playlist'} »`)
    close()
  } catch(e) { error.value = message(e) }
  finally { busy.value = false }
}
async function createAndAdd(): Promise<void> {
  if (busy.value || !newName.value.trim()) return
  busy.value = true; error.value = ''
  try {
    const created = await koel.createPlaylist(newName.value.trim(), '')
    await koel.addPlaylistSongs(created.id, [props.song.id])
    showFeedback(`Playlist « ${created.name} » créée, morceau ajouté.`)
    close(); newName.value = ''
  } catch(e) { error.value = message(e) }
  finally { busy.value = false }
}
</script>

<template>
  <div ref="root" class="playlist-menu-root" @click.stop @keydown.esc.stop.prevent="close" @keydown.stop>
    <button type="button" class="playlist-menu-trigger" :class="{ 'playlist-trigger-compact': compact }" :disabled="!koel.connected" :aria-label="`Ajouter ${song.title} à une playlist`" :aria-expanded="open" aria-haspopup="true" :title="`Ajouter « ${song.title} » à une playlist`" @click.stop="toggle">
      <span class="playlist-plus-icon">＋</span><span v-if="!compact">Playlist</span>
    </button>
    <span v-if="feedback && !open" class="playlist-menu-feedback" role="status">{{ feedback }}</span>
    <Teleport to="body">
    <div v-if="open" ref="panel" class="playlist-menu-panel" :style="panelStyle" role="dialog" :aria-label="`Ajouter ${song.title} à une playlist`" @click.stop @keydown.esc.stop.prevent="close" @keydown.stop>
      <div class="playlist-menu-header"><strong>Ajouter à une playlist</strong><button type="button" aria-label="Fermer le menu" @click.stop="close">×</button></div>
      <p class="playlist-menu-song" :title="song.title">{{ song.title }} · {{ song.artist }}</p>
      <label class="playlist-menu-search"><span>⌕</span><input v-model="filter" placeholder="Rechercher une playlist…" aria-label="Rechercher une playlist" /></label>
      <p v-if="loading" class="playlist-menu-muted">Actualisation des playlists…</p>
      <div class="playlist-menu-items">
        <button v-for="playlist in available" :key="playlist.id" type="button" :disabled="busy" @click.stop="add(playlist.id)"><span class="playlist-menu-icon">♫</span><span>{{ playlist.name }}</span><span class="playlist-menu-arrow">＋</span></button>
        <p v-if="!loading && !available.length" class="playlist-menu-muted">Aucune playlist modifiable.</p>
      </div>
      <form v-if="creating" class="playlist-menu-new" @submit.prevent="createAndAdd">
        <input v-model="newName" maxlength="191" required autofocus placeholder="Nom de la playlist" aria-label="Nom de la nouvelle playlist" />
        <button type="submit" :disabled="busy || !newName.trim()">{{busy ? 'Création…' : 'Créer et ajouter'}}</button>
      </form>
      <button v-else type="button" class="playlist-menu-create" @click.stop="creating = true">＋ Créer une playlist</button>
      <p v-if="error" class="playlist-menu-error" role="alert">{{ error }}</p>
    </div>
    </Teleport>
  </div>
</template>
