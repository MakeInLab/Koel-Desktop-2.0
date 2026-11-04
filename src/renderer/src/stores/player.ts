import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { KoelSong } from '../../../shared/koel'
import { audioEngine } from '../services/audio-engine'
import { useKoelStore } from './koel'

const audio = audioEngine.element
const errorMessage = (error: unknown): string => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Lecture impossible.'
type RepeatMode = 'off' | 'all' | 'one'
type SavedQueue = { queue: KoelSong[]; currentId: string | null; volume: number; shuffle: boolean; repeat: RepeatMode }

export const usePlayerStore = defineStore('player', () => {
  const queue = ref<KoelSong[]>([])
  const index = ref(-1)
  const playing = ref(false)
  const loading = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(72)
  const shuffle = ref(false)
  const repeat = ref<RepeatMode>('off')
  const error = ref('')
  const currentSong = computed(() => queue.value[index.value] ?? null)
  const hasNext = computed(() => index.value >= 0 && queue.value.length > 1 && (repeat.value === 'all' || shuffle.value || index.value + 1 < queue.value.length))
  const upcoming = computed(() => queue.value.slice(Math.max(0, index.value + 1)))
  let generation = 0
  let bag: number[] = []
  let history: number[] = []
  let priority: number[] = []
  let restoring = false
  let activeStorageKey = ''

  function updatePosition(): void {
    currentTime.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    duration.value = Number.isFinite(audio.duration) ? audio.duration : (currentSong.value?.duration ?? 0)
  }
  audio.addEventListener('timeupdate', updatePosition)
  audio.addEventListener('durationchange', updatePosition)
  audio.addEventListener('loadedmetadata', updatePosition)
  audio.addEventListener('play', () => { playing.value = true; updateMediaSession() })
  audio.addEventListener('pause', () => { playing.value = false; updateMediaSession() })
  audio.addEventListener('error', () => { if (audio.src) { loading.value = false; playing.value = false; error.value = 'Flux audio indisponible. Vérifiez le format et la connexion.' } })
  audio.addEventListener('ended', () => { void onEnded() })
  watch(volume, value => audioEngine.setVolume(value), { immediate: true })
  watch(shuffle, () => resetShuffle())

  function updateMediaSession(): void {
    if (!('mediaSession' in navigator)) return
    const song = currentSong.value
    navigator.mediaSession.metadata = song ? new MediaMetadata({ title: song.title, artist: song.artist, album: song.album, artwork: song.cover && !song.cover.includes('api_token=') ? [{ src: song.cover }] : [] }) : null
    navigator.mediaSession.playbackState = playing.value ? 'playing' : 'paused'
    if (song && duration.value > 0 && Number.isFinite(duration.value)) {
      try { navigator.mediaSession.setPositionState({ duration: duration.value, position: Math.min(currentTime.value, duration.value), playbackRate: 1 }) } catch { /* unsupported */ }
    }
  }
  function resetShuffle(): void {
    bag = queue.value.map((_, i) => i).filter(i => i !== index.value)
    priority = []
  }
  async function startAt(nextIndex: number, recordHistory = true): Promise<void> {
    if (nextIndex < 0 || nextIndex >= queue.value.length) return
    const requestId = ++generation
    if (recordHistory && index.value >= 0 && index.value !== nextIndex) history.push(index.value)
    audioEngine.reset()
    index.value = nextIndex
    bag = bag.filter(i => i !== nextIndex)
    priority = priority.filter(i => i !== nextIndex)
    currentTime.value = 0
    duration.value = currentSong.value?.duration ?? 0
    playing.value = false
    loading.value = true
    error.value = ''
    updateMediaSession()
    try {
      const song = currentSong.value
      if (!song) return
      // Keeps Koel 9.15's restricted audio-token fallback in the main process.
      const signedUrl = await window.desktop.koel.getPlayUrl(song.id)
      if (requestId !== generation) return
      audioEngine.load(signedUrl)
      await audioEngine.play()
    } catch (e) {
      if (requestId === generation) { playing.value = false; error.value = errorMessage(e) }
    } finally { if (requestId === generation) loading.value = false }
  }
  function playQueue(songs: KoelSong[], songIndex = 0): Promise<void> {
    if (!songs.length) { clear(); return Promise.resolve() }
    queue.value = [...songs]
    index.value = -1
    history = []
    resetShuffle()
    return startAt(songIndex)
  }
  async function select(song: KoelSong): Promise<void> {
    const existing = queue.value.findIndex(s => s.id === song.id)
    if (existing !== -1) return startAt(existing)
    queue.value.push(song)
    resetShuffle()
    return startAt(queue.value.length - 1)
  }
  function enqueue(song: KoelSong): void {
    queue.value.push(song)
    if (shuffle.value) bag.push(queue.value.length - 1)
  }
  function enqueueMany(songs: KoelSong[]): void { songs.forEach(enqueue) }
  function playNext(song: KoelSong): void {
    if (index.value < 0) { queue.value = [song]; resetShuffle(); void startAt(0); return }
    const target = index.value + 1
    queue.value.splice(target, 0, song)
    history = history.map(i => i >= target ? i + 1 : i)
    bag = bag.map(i => i >= target ? i + 1 : i)
    priority = priority.map(i => i >= target ? i + 1 : i)
    priority.unshift(target)
  }
  function removeAt(target: number): void {
    if (target < 0 || target >= queue.value.length) return
    if (target === index.value) {
      const wasPlaying = playing.value
      ++generation
      audioEngine.reset()
      queue.value.splice(target, 1)
      index.value = -1
      playing.value = false
      currentTime.value = 0; duration.value = 0
      history = []; resetShuffle()
      if (wasPlaying && queue.value.length) void startAt(Math.min(target, queue.value.length - 1))
      else updateMediaSession()
      return
    }
    queue.value.splice(target, 1)
    if (target < index.value) index.value--
    const reindex = (items: number[]) => items.filter(i => i !== target).map(i => i > target ? i - 1 : i)
    history = reindex(history); bag = reindex(bag); priority = reindex(priority)
  }
  function move(from: number, to: number): void {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= queue.value.length || to >= queue.value.length || from === to) return
    const song = currentSong.value
    const [item] = queue.value.splice(from, 1)
    queue.value.splice(to, 0, item)
    // Preserve the *same* playing song and audio stream when moving another row.
    if (song) index.value = queue.value.indexOf(song)
    history = []; resetShuffle()
  }
  function clearUpcoming(): void {
    if (index.value < 0) return
    queue.value.splice(index.value + 1)
    history = []; resetShuffle()
  }
  async function toggle(): Promise<void> {
    if (!currentSong.value || loading.value) return
    if (audio.paused) {
      error.value = ''
      try { if (!audio.getAttribute('src') || audio.error) await startAt(index.value, false); else await audioEngine.play() }
      catch (e) { error.value = errorMessage(e) }
    } else audioEngine.pause()
  }
  function nextIndex(): number {
    if (!queue.value.length) return -1
    while (priority.length) {
      const forced = priority.shift()!
      if (forced >= 0 && forced < queue.value.length && forced !== index.value) return forced
    }
    if (shuffle.value) {
      if (!bag.length && repeat.value === 'all') resetShuffle()
      if (!bag.length) return -1
      const pick = Math.floor(Math.random() * bag.length)
      return bag.splice(pick, 1)[0]
    }
    if (index.value + 1 < queue.value.length) return index.value + 1
    return repeat.value === 'all' ? 0 : -1
  }
  async function next(): Promise<void> {
    const chosen = nextIndex()
    if (chosen === -1) { audioEngine.pause(); return }
    await startAt(chosen)
  }
  async function previous(): Promise<void> {
    if (currentTime.value > 3) { seek(0); return }
    if (history.length) { await startAt(history.pop()!, false); return }
    if (!shuffle.value && index.value > 0) await startAt(index.value - 1)
    else seek(0)
  }
  async function onEnded(): Promise<void> {
    if (repeat.value === 'one') { await startAt(index.value, false); return }
    const chosen = nextIndex()
    if (chosen !== -1) await startAt(chosen)
    else { playing.value = false; updateMediaSession() }
  }
  function seek(value: number): void { audioEngine.seek(value); updatePosition(); updateMediaSession() }
  function cycleRepeat(): void { repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off' }
  function clear(): void {
    ++generation
    audioEngine.reset()
    queue.value = []; index.value = -1; playing.value = false; loading.value = false
    currentTime.value = 0; duration.value = 0; error.value = ''; history = []; resetShuffle()
    updateMediaSession()
  }

  function persist(): void {
    if (!activeStorageKey || restoring) return
    try {
      const value: SavedQueue = { queue: queue.value, currentId: currentSong.value?.id ?? null, volume: volume.value, shuffle: shuffle.value, repeat: repeat.value }
      // Personal music metadata stored locally, no API credentials or stream URLs.
      localStorage.setItem(activeStorageKey, JSON.stringify(value))
    } catch { /* storage disabled or full */ }
  }
  function restoreForServer(url: string, userId: string | number): void {
    const key = `koel:queue:v5:${encodeURIComponent(url)}:${encodeURIComponent(String(userId))}`
    if (key === activeStorageKey) return
    restoring = true
    clear()
    activeStorageKey = key
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null') as SavedQueue | null
      if (raw && Array.isArray(raw.queue)) {
        queue.value = raw.queue.filter((s): s is KoelSong => !!s && typeof s.id === 'string' && typeof s.title === 'string' && typeof s.artist === 'string' && typeof s.album === 'string').slice(0, 5000)
        index.value = raw.currentId ? queue.value.findIndex(s => s.id === raw.currentId) : -1
        volume.value = typeof raw.volume === 'number' ? Math.max(0, Math.min(100, raw.volume)) : 72
        shuffle.value = raw.shuffle === true
        repeat.value = ['off', 'all', 'one'].includes(raw.repeat) ? raw.repeat : 'off'
        // Intentionally do not autoplay after restart; metadata only is restored.
        duration.value = currentSong.value?.duration ?? 0
      }
    } catch { /* unreadable queue */ }
    history = []; resetShuffle()
    restoring = false
    updateMediaSession()
  }
  function detachServer(): void { persist(); activeStorageKey = ''; clear() }
  watch([queue, index, volume, shuffle, repeat], persist, { deep: true })

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { void toggleIfPaused() })
    navigator.mediaSession.setActionHandler('pause', () => { if (!audio.paused) audioEngine.pause() })
    navigator.mediaSession.setActionHandler('previoustrack', () => { void previous() })
    navigator.mediaSession.setActionHandler('nexttrack', () => { void next() })
    navigator.mediaSession.setActionHandler('seekto', details => { if (details.seekTime !== undefined) seek(details.seekTime) })
  }
  async function toggleIfPaused(): Promise<void> { if (audio.paused) await toggle() }
  return { queue, index, currentSong, playing, loading, currentTime, duration, volume, shuffle, repeat, error, hasNext, upcoming,
    select, playQueue, enqueue, enqueueMany, playNext, removeAt, move, clearUpcoming, toggle, next, previous, seek, cycleRepeat, clear, restoreForServer, detachServer }
})
