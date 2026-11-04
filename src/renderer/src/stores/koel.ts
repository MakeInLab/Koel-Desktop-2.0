import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { KoelAlbum, KoelArtist, KoelCredentials, KoelPlaylist, KoelSession, KoelSong, KoelSearchResult } from '../../../shared/koel'

export const useKoelStore = defineStore('koel', () => {
  const session = ref<KoelSession | null>(null)
  const songs = ref<KoelSong[]>([])
  const albums = ref<KoelAlbum[]>([])
  const artists = ref<KoelArtist[]>([])
  const playlists = ref<KoelPlaylist[]>([])
  const nextPage = ref<number | null>(null)
  const albumNextPage = ref<number | null>(null)
  const artistNextPage = ref<number | null>(null)
  const total = ref<number | null>(null)
  const busy = ref(false)
  const loadingSongs = ref(false)
  const loadingAlbums = ref(false)
  const loadingArtists = ref(false)
  const loadingPlaylists = ref(false)
  const awaiting2FA = ref(false)
  const error = ref('')
  const connected = computed(() => !!session.value)
  // Avoid painting results from a previous session after logout or server switching.
  let epoch = 0

  function empty(): void {
    epoch++
    songs.value = []; albums.value = []; artists.value = []; playlists.value = []
    nextPage.value = null; albumNextPage.value = null; artistNextPage.value = null; total.value = null
    loadingSongs.value = false; loadingAlbums.value = false; loadingArtists.value = false; loadingPlaylists.value = false
  }
  async function restore(): Promise<void> {
    busy.value = true
    try { session.value = await window.desktop.koel.restore(); if (session.value) await refresh() }
    catch (e) { error.value = message(e) } finally { busy.value = false }
  }
  async function login(credentials: KoelCredentials): Promise<boolean> {
    busy.value = true; error.value = ''
    try {
      const response = await window.desktop.koel.login(credentials)
      if (response.kind === 'two-factor') { awaiting2FA.value = true; return false }
      session.value = response.session; awaiting2FA.value = false; await refresh(); return true
    } catch (e) { error.value = message(e); return false } finally { busy.value = false }
  }
  async function verify(code: string): Promise<boolean> {
    busy.value = true; error.value = ''
    try { session.value = await window.desktop.koel.verifyTwoFactor(code); awaiting2FA.value = false; await refresh(); return true }
    catch (e) { error.value = message(e); return false } finally { busy.value = false }
  }
  async function refresh(): Promise<void> {
    empty()
    if (!session.value) return
    nextPage.value = 1; albumNextPage.value = 1; artistNextPage.value = 1
    // All four collections are independent; a failing endpoint doesn't prevent the rest.
    await Promise.allSettled([more(), moreAlbums(), moreArtists(), fetchPlaylists()])
  }
  async function more(): Promise<void> {
    if (!connected.value || !nextPage.value || loadingSongs.value) return
    loadingSongs.value = true; error.value = ''
    const requestEpoch = epoch, page = nextPage.value
    try {
      const result = await window.desktop.koel.loadSongs(page)
      if (requestEpoch !== epoch) return
      songs.value = mergeById(songs.value, result.songs); nextPage.value = result.nextPage; total.value = result.total
    } catch (e) { if (requestEpoch === epoch) error.value = message(e) }
    finally { if (requestEpoch === epoch) loadingSongs.value = false }
  }
  async function moreAlbums(): Promise<void> {
    if (!connected.value || !albumNextPage.value || loadingAlbums.value) return
    loadingAlbums.value = true; const requestEpoch = epoch, page = albumNextPage.value
    try {
      const result = await window.desktop.koel.loadAlbums(page)
      if (requestEpoch !== epoch) return
      albums.value = mergeById(albums.value, result.items); albumNextPage.value = result.nextPage
    } catch (e) { if (requestEpoch === epoch) error.value = message(e) }
    finally { if (requestEpoch === epoch) loadingAlbums.value = false }
  }
  async function moreArtists(): Promise<void> {
    if (!connected.value || !artistNextPage.value || loadingArtists.value) return
    loadingArtists.value = true; const requestEpoch = epoch, page = artistNextPage.value
    try {
      const result = await window.desktop.koel.loadArtists(page)
      if (requestEpoch !== epoch) return
      artists.value = mergeById(artists.value, result.items); artistNextPage.value = result.nextPage
    } catch (e) { if (requestEpoch === epoch) error.value = message(e) }
    finally { if (requestEpoch === epoch) loadingArtists.value = false }
  }
  async function fetchPlaylists(): Promise<void> {
    if (!connected.value || loadingPlaylists.value) return
    loadingPlaylists.value = true; const requestEpoch = epoch
    try {
      const result = await window.desktop.koel.loadPlaylists()
      if (requestEpoch === epoch) playlists.value = result
    } catch (e) { if (requestEpoch === epoch) error.value = message(e) }
    finally { if (requestEpoch === epoch) loadingPlaylists.value = false }
  }
  async function createPlaylist(name: string, description: string): Promise<KoelPlaylist> {
    if (!session.value) throw new Error('Connectez-vous à Koel.')
    const created = await window.desktop.koel.createPlaylist(name, description)
    playlists.value = mergeById(playlists.value, [created])
    await fetchPlaylists()
    return created
  }
  async function addPlaylistSongs(id: string, songIds: string[]): Promise<void> {
    if (!session.value) throw new Error('Connectez-vous à Koel.')
    await window.desktop.koel.addPlaylistSongs(id, songIds)
    await fetchPlaylists()
  }
  async function removePlaylistSongs(id: string, songIds: string[]): Promise<void> {
    if (!session.value) throw new Error('Connectez-vous à Koel.')
    await window.desktop.koel.removePlaylistSongs(id, songIds)
    await fetchPlaylists()
  }
  async function collectionSongs(type: 'albums' | 'artists' | 'playlists', id: string): Promise<KoelSong[]> {
    return window.desktop.koel.loadCollectionSongs(type, id)
  }
  async function search(query: string): Promise<KoelSearchResult> { return window.desktop.koel.search(query) }
  async function logout(): Promise<void> {
    busy.value = true; empty(); session.value = null
    try { await window.desktop.koel.logout() }
    finally { awaiting2FA.value = false; error.value = ''; busy.value = false }
  }
  return { session, songs, albums, artists, playlists, nextPage, albumNextPage, artistNextPage, total,
    busy, loadingSongs, loadingAlbums, loadingArtists, loadingPlaylists, awaiting2FA, error, connected,
    restore, login, verify, refresh, more, moreAlbums, moreArtists, fetchPlaylists, createPlaylist, addPlaylistSongs, removePlaylistSongs, collectionSongs, search, logout }
})
function mergeById<T extends {id: string}>(existing: T[], incoming: T[]): T[] {
  const found = new Set(existing.map(item => item.id))
  return existing.concat(incoming.filter(item => !found.has(item.id)))
}
export function message(e: unknown): string {
  return e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Une erreur inconnue est survenue.'
}
