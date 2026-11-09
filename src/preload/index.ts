import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopAPI } from '../shared/desktop'
import type { PlayerAction, PresenceSnapshot, DiscordStatus } from '../shared/native'
const desktop: DesktopAPI = {
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  getGPUStatus: () => ipcRenderer.invoke('desktop:gpu-status'),
  minimize: () => ipcRenderer.send('desktop:window', 'minimize'),
  toggleMaximize: () => ipcRenderer.send('desktop:window', 'maximize'),
  isMaximized: () => ipcRenderer.invoke('desktop:maximized'),
  onMaximizedChange: callback => {
    const listener = (_event: Electron.IpcRendererEvent, value: boolean) => callback(value)
    ipcRenderer.on('desktop:maximized-changed', listener)
    return () => ipcRenderer.removeListener('desktop:maximized-changed', listener)
  },
  close: () => ipcRenderer.send('desktop:window', 'close'),
  native: {
    getDiscordStatus: () => ipcRenderer.invoke('native:discord-status'),
    onDiscordStatus: callback => {
      const listener = (_event: Electron.IpcRendererEvent, status: DiscordStatus) => callback(status)
      ipcRenderer.on('native:discord-status-changed', listener)
      return () => ipcRenderer.removeListener('native:discord-status-changed', listener)
    },
    getSettings: () => ipcRenderer.invoke('native:settings'),
    setSettings: settings => ipcRenderer.invoke('native:set-settings', settings),
    setPlayback: snapshot => ipcRenderer.send('player:state', snapshot),
    onPlayerAction: callback => {
      const listener = (_event: Electron.IpcRendererEvent, action: PlayerAction) => callback(action)
      ipcRenderer.on('player:action', listener)
      return () => ipcRenderer.removeListener('player:action', listener)
    },
    getMiniMode: () => ipcRenderer.invoke('native:mini-mode'),
    onMiniMode: callback => {
      const listener = (_event: Electron.IpcRendererEvent, active: boolean) => callback(active)
      ipcRenderer.on('native:mini-mode-changed', listener)
      return () => ipcRenderer.removeListener('native:mini-mode-changed', listener)
    },
    openMini: () => ipcRenderer.send('native:mini', true),
    closeMini: () => ipcRenderer.send('native:mini', false)
  },
  koel: {
    restore: () => ipcRenderer.invoke('koel:restore'),
    login: credentials => ipcRenderer.invoke('koel:login', credentials),
    verifyTwoFactor: code => ipcRenderer.invoke('koel:verify2fa', code),
    loadSongs: page => ipcRenderer.invoke('koel:songs', page),
    loadAlbums: (page, perPage) => ipcRenderer.invoke('koel:albums', page, perPage),
    loadArtists: (page, perPage) => ipcRenderer.invoke('koel:artists', page, perPage),
    loadPlaylists: () => ipcRenderer.invoke('koel:playlists'),
    createPlaylist: (name, description) => ipcRenderer.invoke('koel:create-playlist', name, description),
    addPlaylistSongs: (playlistId, songIds) => ipcRenderer.invoke('koel:add-playlist-songs', playlistId, songIds),
    removePlaylistSongs: (playlistId, songIds) => ipcRenderer.invoke('koel:remove-playlist-songs', playlistId, songIds),
    loadCollectionDetails: (type, id) => ipcRenderer.invoke('koel:collection-details', type, id),
    loadCollectionSongs: (type, id) => ipcRenderer.invoke('koel:collection-songs', type, id),
    search: query => ipcRenderer.invoke('koel:search', query),
    getPlayUrl: songId => ipcRenderer.invoke('koel:play-url', songId),
    logout: () => ipcRenderer.invoke('koel:logout')
  }
}
contextBridge.exposeInMainWorld('desktop', desktop)
