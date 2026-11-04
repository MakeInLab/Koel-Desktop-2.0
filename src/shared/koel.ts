export type KoelConnection = { url: string; email: string; remember: boolean }
export type KoelCredentials = KoelConnection & { password: string }
export type KoelUser = { id: string | number; name: string; email: string }
export type KoelSong = { id: string; title: string; artist: string; album: string; artistId: string | null; albumId: string | null; duration: number; cover: string | null; color: string }
export type KoelAlbum = { id: string; name: string; artist: string; artistId: string | null; year: number | null; cover: string | null }
export type KoelArtist = { id: string; name: string; image: string | null }
export type KoelPlaylist = { id: string; name: string; description: string; cover: string | null; smart: boolean; canEdit: boolean; canDelete: boolean; canAddSongs: boolean }
export type KoelSession = { url: string; email: string; user: KoelUser; version: string | null }
export type KoelLoginResult = { kind: 'connected'; session: KoelSession } | { kind: 'two-factor'; message: string }
export type KoelPage = { songs: KoelSong[]; nextPage: number | null; total: number | null }
export type KoelCatalogPage<T> = { items: T[]; nextPage: number | null; total: number | null }
export type KoelSearchResult = { songs: KoelSong[]; albums: KoelAlbum[]; artists: KoelArtist[] }
export interface KoelDesktopAPI {
  restore(): Promise<KoelSession | null>
  login(credentials: KoelCredentials): Promise<KoelLoginResult>
  verifyTwoFactor(code: string): Promise<KoelSession>
  loadSongs(page: number): Promise<KoelPage>
  loadAlbums(page: number): Promise<KoelCatalogPage<KoelAlbum>>
  loadArtists(page: number): Promise<KoelCatalogPage<KoelArtist>>
  loadPlaylists(): Promise<KoelPlaylist[]>
  createPlaylist(name: string, description: string): Promise<KoelPlaylist>
  addPlaylistSongs(playlistId: string, songIds: string[]): Promise<void>
  removePlaylistSongs(playlistId: string, songIds: string[]): Promise<void>
  loadCollectionDetails(type: 'albums' | 'artists', id: string): Promise<KoelAlbum | KoelArtist>
  loadCollectionSongs(type: 'albums' | 'artists' | 'playlists', id: string): Promise<KoelSong[]>
  search(query: string): Promise<KoelSearchResult>
  getPlayUrl(songId: string): Promise<string>
  logout(): Promise<void>
}
