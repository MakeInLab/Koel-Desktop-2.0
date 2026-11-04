import type { KoelSong } from './koel'
export type PlayerAction = 'toggle' | 'next' | 'previous' | 'play' | 'pause'
export type PresenceSnapshot = { song: Pick<KoelSong, 'id' | 'title' | 'artist' | 'album' | 'duration'> | null; playing: boolean; time: number; duration: number }
export type DiscordStatus = { state: 'disabled' | 'connecting' | 'connected' | 'active' | 'waiting' | 'error'; message: string }
export type DesktopSettings = { discordEnabled: boolean; discordClientId: string; mediaKeys: boolean; notifications: boolean }
export type NativeAPI = {
  getDiscordStatus(): Promise<DiscordStatus>
  onDiscordStatus(callback: (status: DiscordStatus) => void): () => void
  getSettings(): Promise<DesktopSettings>
  setSettings(settings: DesktopSettings): Promise<DesktopSettings>
  setPlayback(snapshot: PresenceSnapshot): void
  onPlayerAction(callback: (action: PlayerAction) => void): () => void
  getMiniMode(): Promise<boolean>
  onMiniMode(callback: (active: boolean) => void): () => void
  openMini(): void
  closeMini(): void
}
