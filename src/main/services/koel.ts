import { app, net, safeStorage } from 'electron'
import { readFile, writeFile, unlink, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { KoelCredentials, KoelSession, KoelLoginResult, KoelPage, KoelSong, KoelAlbum, KoelArtist, KoelPlaylist, KoelCatalogPage, KoelSearchResult } from '../../shared/koel'

type LoginBody = { token?: unknown; 'audio-token'?: unknown; two_factor?: unknown; login_token?: unknown }
type Auth = { baseUrl: string; email: string; token: string; audioToken: string | null; user: KoelSession['user']; version: string | null }
let current: Auth | null = null
let pending: { baseUrl: string; email: string; loginToken: string; remember: boolean } | null = null
let rememberLogin = false
const MAX_BODY = 12 * 1024 * 1024
function storagePath(): string { return join(app.getPath('userData'), 'koel-session.enc') }
function baseUrl(value: string): string {
  const u = new URL(value.trim())
  if (u.username || u.password || u.search || u.hash) throw new Error('Adresse du serveur invalide.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw new Error('HTTPS obligatoire, sauf pour localhost.')
  return u.origin + u.pathname.replace(/\/+$/, '')
}
function pathUrl(base: string, path: string): string { return base + '/api/' + path.replace(/^\/+/, '') }
async function request<T>(base: string, path: string, method = 'GET', token?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await net.fetch(pathUrl(base, path), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(20000)
    })
  } catch { throw new Error('Connexion au serveur impossible (réseau, certificat ou délai).') }
  if (response.status === 401) throw new Error('Authentification refusée ou session expirée (401).')
  if (!response.ok) throw new Error(`Erreur Koel : HTTP ${response.status}.`)
  const size = Number(response.headers.get('content-length') || 0)
  if (size > MAX_BODY) throw new Error('Réponse trop volumineuse.')
  // Limit bytes *while* downloading. Content-Length can be absent or dishonest.
  if (!response.body) return undefined as T
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_BODY) throw new Error('Réponse trop volumineuse.')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  if (!received) return undefined as T
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as T } catch { throw new Error('Réponse du serveur non JSON.') }
}
function asObject(input: unknown): Record<string, unknown> { return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {} }
function parseUser(input: unknown): KoelSession['user'] {
  const u = asObject(input)
  if ((typeof u.id !== 'string' && typeof u.id !== 'number') || typeof u.email !== 'string') throw new Error('Profil Koel incomplet.')
  return { id: u.id, email: u.email, name: typeof u.name === 'string' ? u.name : u.email }
}
async function getSession(base: string, email: string, token: string, audioToken: string | null): Promise<Auth> {
  const [profile, data] = await Promise.all([
    request<unknown>(base, 'me', 'GET', token), request<unknown>(base, 'data', 'GET', token)
  ])
  const d = asObject(data)
  return { baseUrl: base, email, token, audioToken, user: parseUser(profile), version: typeof d.current_version === 'string' ? d.current_version : typeof d.currentVersion === 'string' ? d.currentVersion : null }
}
function publicSession(auth: Auth): KoelSession { return { url: auth.baseUrl, email: auth.email, user: auth.user, version: auth.version } }
async function save(): Promise<void> {
  if (!current || !rememberLogin || !safeStorage.isEncryptionAvailable()) return
  const payload = JSON.stringify({ url: current.baseUrl, email: current.email, token: current.token, audioToken: current.audioToken })
  const encrypted = safeStorage.encryptString(payload)
  // Do not leave a half-written credential blob after an unexpected shutdown.
  const dest = storagePath()
  const temp = `${dest}.tmp`
  try {
    await writeFile(temp, encrypted, { mode: 0o600, flag: 'w' })
    await rename(temp, dest)
  } catch (error) {
    try { await unlink(temp) } catch { /* no temporary file */ }
    throw error
  }
}
async function forget(): Promise<void> { try { await unlink(storagePath()) } catch { /* not saved */ } }
async function activate(base: string, email: string, token: string, audioToken: string | null, remember: boolean): Promise<KoelSession> {
  const auth = await getSession(base, email, token, audioToken)
  current = auth; rememberLogin = remember; pending = null
  await forget()
  try { await save() } catch { /* Login still works in memory */ }
  return publicSession(auth)
}
export async function restoreSession(): Promise<KoelSession | null> {
  if (current) return publicSession(current)
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const encrypted = await readFile(storagePath())
    if (encrypted.length === 0 || encrypted.length > 32 * 1024) throw new Error('Session enregistrée invalide.')
    const raw = asObject(JSON.parse(safeStorage.decryptString(encrypted)))
    if (typeof raw.url !== 'string' || typeof raw.email !== 'string' || typeof raw.token !== 'string' ||
        raw.email.length > 320 || raw.token.length < 8 || raw.token.length > 8192 ||
        (raw.audioToken != null && (typeof raw.audioToken !== 'string' || raw.audioToken.length > 8192))) throw new Error('Session enregistrée invalide.')
    return await activate(baseUrl(raw.url), raw.email, raw.token, typeof raw.audioToken === 'string' ? raw.audioToken : null, true)
  } catch { await forget(); return null }
}
export async function login(credentials: KoelCredentials): Promise<KoelLoginResult> {
  if (!credentials || typeof credentials.url !== 'string' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string' || typeof credentials.remember !== 'boolean') throw new Error('Identifiants invalides.')
  if (!credentials.email.includes('@') || !credentials.password || credentials.password.length > 512) throw new Error('Email ou mot de passe invalide.')
  const base = baseUrl(credentials.url)
  pending = null
  const result = asObject(await request<LoginBody>(base, 'me', 'POST', undefined, { email: credentials.email, password: credentials.password }))
  if (result.two_factor === true && typeof result.login_token === 'string') {
    pending = { baseUrl: base, email: credentials.email, loginToken: result.login_token, remember: credentials.remember }
    return { kind: 'two-factor', message: 'Saisissez votre code de vérification à deux facteurs.' }
  }
  if (typeof result.token !== 'string' || result.token.length < 8 || result.token.length > 8192) throw new Error('Réponse de connexion Koel non reconnue.')
  return { kind: 'connected', session: await activate(base, credentials.email, result.token, typeof result['audio-token'] === 'string' ? result['audio-token'] : null, credentials.remember) }
}
export async function verifyTwoFactor(code: string): Promise<KoelSession> {
  if (!pending || typeof code !== 'string' || !code.trim() || code.length > 32) throw new Error('Code de vérification invalide.')
  const p = pending
  const result = asObject(await request<unknown>(p.baseUrl, 'me/two-factor-challenge', 'POST', undefined, { login_token: p.loginToken, code: code.trim() }))
  if (typeof result.token !== 'string' || result.token.length < 8 || result.token.length > 8192) throw new Error('Réponse Koel sans jeton.')
  return activate(p.baseUrl, p.email, result.token, typeof result['audio-token'] === 'string' ? result['audio-token'] : null, p.remember)
}
function toSong(input: unknown): KoelSong | null {
  const x = asObject(input)
  if (typeof x.id !== 'string' && typeof x.id !== 'number') return null
  return { id: String(x.id), title: typeof x.title === 'string' ? x.title : 'Sans titre',
    artist: typeof x.artist_name === 'string' ? x.artist_name : 'Artiste inconnu',
    album: typeof x.album_name === 'string' ? x.album_name : 'Album inconnu',
    duration: typeof x.length === 'number' && Number.isFinite(x.length) ? Math.max(0, Math.floor(x.length)) : 0,
    artistId: x.artist_id == null ? null : String(x.artist_id),
    albumId: x.album_id == null ? null : String(x.album_id),
    cover: safeArtwork(x.album_small_cover ?? x.album_cover), color: '#9068bf' }
}
/** Remote artwork is display-only. Never render javascript:, file:, or credential-bearing URLs. */
function safeArtwork(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  if (!current) return null
  try {
    const url = new URL(raw, current.baseUrl + '/')
    if (url.username || url.password || /[?#](?:.*(?:api_token|access_token|auth_token|password|bearer)=)/i.test(url.search)) return null
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null
    return url.href
  } catch { return null }
}
function parseAlbum(input: unknown): KoelAlbum | null {
  const x = asObject(input)
  if (typeof x.id !== 'string' && typeof x.id !== 'number') return null
  return { id: String(x.id), name: typeof x.name === 'string' ? x.name : 'Album sans titre',
    artist: typeof x.artist_name === 'string' ? x.artist_name : 'Artiste inconnu',
    artistId: x.artist_id == null ? null : String(x.artist_id),
    year: typeof x.year === 'number' && Number.isFinite(x.year) ? x.year : null,
    cover: safeArtwork(x.small_cover ?? x.cover) }
}
function parseArtist(input: unknown): KoelArtist | null {
  const x = asObject(input)
  if (typeof x.id !== 'string' && typeof x.id !== 'number') return null
  return { id: String(x.id), name: typeof x.name === 'string' ? x.name : 'Artiste inconnu',
    image: safeArtwork(x.image ?? x.album_cover) }
}
function parsePlaylist(input: unknown): KoelPlaylist | null {
  const x = asObject(input)
  if (typeof x.id !== 'string' && typeof x.id !== 'number') return null
  return { id: String(x.id), name: typeof x.name === 'string' ? x.name : 'Playlist',
    description: typeof x.description === 'string' ? x.description : '',
    cover: safeArtwork(x.cover), smart: x.is_smart === true,
    canEdit: asObject(x.permissions).edit !== false,
    canDelete: asObject(x.permissions).delete !== false,
    canAddSongs: x.is_smart !== true && (x.is_collaborative === true || asObject(x.permissions).edit !== false) }
}
/**
 * Koel's API uses both plain JSON and Laravel resources. Collection actions
 * can return a bare array, { data: [...] }, or a nested resource envelope.
 * A genuinely unrecognized response still raises an error rather than being
 * silently interpreted as an empty music library.
 */
function responseArray(raw: unknown, label: string, key?: string): unknown[] {
  if (Array.isArray(raw)) return raw
  let value: unknown = raw
  for (let depth = 0; depth < 3; depth++) {
    const obj = asObject(value)
    if (key && Array.isArray(obj[key])) return obj[key] as unknown[]
    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.items)) return obj.items
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      value = obj.data
      continue
    }
    break
  }
  throw new Error(`Format des ${label} Koel non reconnu (réponse attendue : tableau).`)
}
function responseItem(raw: unknown, label: string): unknown {
  let value: unknown = raw
  for (let depth = 0; depth < 3; depth++) {
    const obj = asObject(value)
    if ((typeof obj.id === 'string' || typeof obj.id === 'number') && obj.id !== '') return obj
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      value = obj.data
      continue
    }
    break
  }
  throw new Error(`${label} Koel introuvable ou réponse inattendue.`)
}
function auth(): Auth { if (!current) throw new Error('Connectez-vous au serveur Koel.'); return current }
function validPage(page: number): void { if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Numéro de page invalide.') }
function parsePage<T>(raw: unknown, page: number, parse: (value: unknown) => T | null): KoelCatalogPage<T> {
  const object = asObject(raw)
  if (!Array.isArray(object.data)) throw new Error('Format de réponse Koel non reconnu.')
  const items = object.data.map(parse).filter((item): item is T => item !== null)
  const links = asObject(object.links), meta = asObject(object.meta)
  // Koel supports page-based pagination; an empty link means the last page.
  const nextPage = typeof links.next === 'string' && links.next ? page + 1 : null
  return { items, nextPage, total: typeof meta.total === 'number' ? meta.total : null }
}
export async function loadAlbums(page: number): Promise<KoelCatalogPage<KoelAlbum>> {
  validPage(page)
  const a = auth()
  return parsePage(await request<unknown>(a.baseUrl, `albums?per_page=50&page=${page}`, 'GET', a.token), page, parseAlbum)
}
export async function loadArtists(page: number): Promise<KoelCatalogPage<KoelArtist>> {
  validPage(page)
  const a = auth()
  return parsePage(await request<unknown>(a.baseUrl, `artists?per_page=50&page=${page}`, 'GET', a.token), page, parseArtist)
}
export async function loadPlaylists(): Promise<KoelPlaylist[]> {
  const a = auth()
  const raw = await request<unknown>(a.baseUrl, 'playlists', 'GET', a.token)
  return responseArray(raw, 'playlists', 'playlists').map(parsePlaylist).filter((item): item is KoelPlaylist => item !== null)
}
/** Koel v9.15.0 playlist mutation endpoints. Keep API token in Electron main only. */
function playlistId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Identifiant de playlist invalide.')
  return encodeURIComponent(value)
}
function songIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 300 || !value.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new Error('Sélection de morceaux invalide.')
  return [...new Set(value)]
}
export async function createPlaylist(name: string, description: string): Promise<KoelPlaylist> {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 191) throw new Error('Le nom doit contenir entre 1 et 191 caractères.')
  if (typeof description !== 'string' || description.length > 2000) throw new Error('Description trop longue.')
  const a = auth()
  const result = await request<unknown>(a.baseUrl, 'playlists', 'POST', a.token, { name: name.trim(), description: description.trim(), songs: [] })
  const playlist = parsePlaylist(responseItem(result, 'Playlist'))
  if (!playlist) throw new Error('Réponse de création de playlist non reconnue.')
  return playlist
}
export async function addPlaylistSongs(id: string, ids: string[]): Promise<void> {
  const a = auth()
  await request<unknown>(a.baseUrl, `playlists/${playlistId(id)}/songs`, 'POST', a.token, { songs: songIds(ids) })
}
export async function removePlaylistSongs(id: string, ids: string[]): Promise<void> {
  const a = auth()
  await request<unknown>(a.baseUrl, `playlists/${playlistId(id)}/songs`, 'DELETE', a.token, { songs: songIds(ids) })
}
export async function loadCollectionDetails(type: 'albums' | 'artists', id: string): Promise<KoelAlbum | KoelArtist> {
  if (type !== 'albums' && type !== 'artists') throw new Error('Type de collection invalide.')
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Identifiant de collection invalide.')
  const a = auth()
  const raw = await request<unknown>(a.baseUrl, `${type}/${encodeURIComponent(id)}`, 'GET', a.token)
  const resource = responseItem(raw, type === 'albums' ? 'Album' : 'Artiste')
  const item = type === 'albums' ? parseAlbum(resource) : parseArtist(resource)
  if (!item) throw new Error('Collection Koel introuvable.')
  return item
}
export async function loadCollectionSongs(type: 'albums' | 'artists' | 'playlists', id: string): Promise<KoelSong[]> {
  if (!['albums', 'artists', 'playlists'].includes(type)) throw new Error('Collection invalide.')
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Identifiant de collection invalide.')
  const a = auth()
  const raw = await request<unknown>(a.baseUrl, `${type}/${encodeURIComponent(id)}/songs`, 'GET', a.token)
  return responseArray(raw, 'titres', 'songs').map(toSong).filter((item): item is KoelSong => item !== null)
}
export async function search(query: string): Promise<KoelSearchResult> {
  if (typeof query !== 'string' || query.length > 150) throw new Error('Recherche trop longue.')
  const q = query.trim()
  if (q.length < 2) return { songs: [], albums: [], artists: [] }
  const a = auth(), arg = `q=${encodeURIComponent(q)}`
  // Dedicated search endpoints; unlike library filtering they cover the whole server.
  const results = await Promise.allSettled([
    request<unknown>(a.baseUrl, `search/songs?${arg}`, 'GET', a.token),
    request<unknown>(a.baseUrl, `search/albums?${arg}`, 'GET', a.token),
    request<unknown>(a.baseUrl, `search/artists?${arg}`, 'GET', a.token)
  ])
  if (results.every(result => result.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason
  const getItems = <T>(idx: number, mapper: (value: unknown) => T | null): T[] => {
    const result = results[idx]
    if (result.status !== 'fulfilled') return []
    return responseArray(result.value, 'résultats de recherche').map(mapper).filter((item): item is T => item !== null)
  }
  return { songs: getItems(0, toSong), albums: getItems(1, parseAlbum), artists: getItems(2, parseArtist) }
}

export async function loadSongs(page: number): Promise<KoelPage> {
  if (!current) throw new Error('Connectez-vous au serveur Koel.')
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Numéro de page invalide.')
  const raw = asObject(await request<unknown>(current.baseUrl, `songs?per_page=50&page=${page}`, 'GET', current.token))
  if (!Array.isArray(raw.data)) throw new Error('Format de la bibliothèque Koel non reconnu.')
  const songs = raw.data.map(toSong).filter((s): s is KoelSong => s !== null)
  const meta = asObject(raw.meta)
  const links = asObject(raw.links)
  const nextPage = typeof links.next === 'string' && links.next ? page + 1 : null
  const total = typeof meta.total === 'number' ? meta.total : null
  return { songs, nextPage, total }
}
export async function logout(): Promise<void> {
  const auth = current; current = null; pending = null; rememberLogin = false
  await forget()
  if (auth) { try { await request<unknown>(auth.baseUrl, 'me', 'DELETE', auth.token) } catch { /* Local logout must work without network */ } }
}

/**
 * Koel <= 9.15 uses GET /play/{id}?api_token=<audio-token>.
 * The audio token is deliberately scoped to audio (not the full API bearer token).
 * Koel >= 10 (and some newer releases) use GET /api/songs/{id}/play-url.
 * Never log, persist a playback URL, or use the full API token in its query string.
 */
function safeStreamUrl(raw: string, base: string): string {
  let url: URL
  try { url = new URL(raw, base + '/') } catch { throw new Error('URL de lecture Koel invalide.') }
  if (url.username || url.password ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('URL de lecture non sécurisée refusée.')
  }
  return url.href
}
function legacyPlayUrl(a: Auth, songId: string): string {
  if (!a.audioToken) {
    throw new Error('Koel 9.x utilise un jeton audio distinct. Déconnectez-vous, puis reconnectez-vous dans Paramètres pour récupérer ce jeton. Aucun mot de passe ne doit être partagé.')
  }
  const url = new URL(a.baseUrl + '/play/' + encodeURIComponent(songId))
  url.searchParams.set('api_token', a.audioToken)
  // The query contains an audio-only credential intended for <audio> by Koel 9.x.
  // Avoid logging it or sending it to third parties; the renderer must only use it as audio.src.
  return safeStreamUrl(url.href, a.baseUrl)
}
export async function getPlayUrl(songId: string): Promise<string> {
  if (!current) throw new Error('Connectez-vous au serveur Koel.')
  if (typeof songId !== 'string' || !/^[a-f0-9-]{36}$/i.test(songId)) throw new Error('Identifiant de morceau Koel invalide.')
  const a = current
  // Version 9.15 (Plus inclus) has no /api/songs/{id}/play-url endpoint.
  if (/^v?9(?:\.|$)/i.test(a.version?.trim() ?? '')) return legacyPlayUrl(a, songId)
  let raw: unknown
  try {
    raw = await request<unknown>(a.baseUrl, `songs/${encodeURIComponent(songId)}/play-url`, 'GET', a.token)
  } catch (error) {
    // The metadata route can exist while the newer play-url route does not.
    // Only fallback for a missing endpoint AND when a scoped audio token exists.
    if (!(error instanceof Error) || !error.message.includes('HTTP 404')) throw error
    if (!a.audioToken) throw new Error('Route de lecture signée absente (404) et aucun jeton audio disponible. Déconnectez-vous puis reconnectez-vous pour réessayer.')
    return legacyPlayUrl(a, songId)
  }
  const result = asObject(raw)
  if (typeof result.url !== 'string') throw new Error('Le serveur Koel n’a pas fourni d’URL de lecture.')
  return safeStreamUrl(result.url, a.baseUrl)
}
