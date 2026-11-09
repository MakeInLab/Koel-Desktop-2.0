import { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage, globalShortcut, screen, Notification } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { login, verifyTwoFactor, loadSongs, getPlayUrl, logout, restoreSession, loadAlbums, loadArtists, loadPlaylists, loadCollectionSongs, loadCollectionDetails, search, createPlaylist, addPlaylistSongs, removePlaylistSongs } from './services/koel'
import { configureDiscord, stopDiscord, updateDiscord, getDiscordStatus, setDiscordStatusListener } from './services/discord'
import type { DesktopSettings, PlayerAction, PresenceSnapshot } from '../shared/native'

// Discord public Application ID: shared by all Koel Desktop installations.
// Electron normally enables GPU compositing by default. Request GPU rasterization
// as well; Chromium may still fall back to software if the driver is blocked.
// These switches must be set before app.whenReady().
app.commandLine.appendSwitch('enable-gpu-rasterization')

const DISCORD_APP_ID = '1567174355656638625'
let mainWindow: BrowserWindow | null = null
let miniMode = false
let normalBounds: Electron.Rectangle | null = null
let normalWasMaximized = false
let isTransitioningMini = false
let tray: Tray | null = null
let settings: DesktopSettings = { discordEnabled: false, discordClientId: DISCORD_APP_ID, mediaKeys: false, notifications: false }
let playback: PresenceSnapshot = { song: null, playing: false, time: 0, duration: 0 }
let lastNotified = ''

// The packagers install icon/tray files DIRECTLY into Electron's resources/
// directory. process.resourcesPath already ends in `resources`, so never add
// a second `resources/` segment in packaged builds.
function assetPath(name: string): string {
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), 'resources', name)
}
function configFile(): string { return join(app.getPath('userData'), 'desktop-settings.json') }
function boundsFile(): string { return join(app.getPath('userData'), 'window-bounds.json') }
function miniBoundsFile(): string { return join(app.getPath('userData'), 'mini-player-bounds.json') }
const MINI_MIN_WIDTH = 380
const MINI_MIN_HEIGHT = 190
const MINI_DEFAULT_WIDTH = 488
const MINI_DEFAULT_HEIGHT = 208
// Reference: the requested largest mini-player is approximately 600 × 300.
const MINI_MAX_WIDTH = 600
const MINI_MAX_HEIGHT = 300
function stateFile(): string { return join(app.getPath('userData'), 'window-state.json') }
function shouldStartMaximized(): boolean { return record(readJson(stateFile())).maximized === true }
function persistMaximized(maximized: boolean): void {
  if (miniMode || isTransitioningMini) return
  try { writeFileSync(stateFile(), JSON.stringify({ maximized }), 'utf8') }
  catch (error) { console.warn('[Window] Could not persist maximized state:', error) }
}
function emitWindowState(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('desktop:maximized-changed', mainWindow.isMaximized())
}
function readJson(file: string): unknown { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function validateSettings(value: unknown): DesktopSettings {
  const v = record(value)
  return { discordEnabled: v.discordEnabled === true, discordClientId: DISCORD_APP_ID,
    mediaKeys: v.mediaKeys === true, notifications: v.notifications === true }
}
function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame
}

function notifyRenderer(action: PlayerAction): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('player:action', action)
}
function emitPlayback(): void {
  if (tray) tray.setToolTip(playback.song ? `Koel Desktop - ${playback.song.title}` : 'Koel Desktop')
  updateDiscord(playback)
}
function validatePlayback(value: unknown): PresenceSnapshot | null {
  const v = record(value), s = record(v.song)
  if (typeof v.playing !== 'boolean' || typeof v.time !== 'number' || typeof v.duration !== 'number' || !Number.isFinite(v.time) || !Number.isFinite(v.duration)) return null
  if (v.song !== null && (typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.artist !== 'string' || typeof s.album !== 'string')) return null
  const song = v.song === null ? null : { id: s.id as string, title: (s.title as string).slice(0, 200), artist: (s.artist as string).slice(0, 200), album: (s.album as string).slice(0, 200), duration: Number(s.duration) || 0 }
  return { song, playing: v.playing, time: Math.max(0, v.time), duration: Math.max(0, v.duration) }
}
function mainBounds(): Electron.Rectangle | undefined {
  const b = record(readJson(boundsFile()))
  if (!['x', 'y', 'width', 'height'].every(key => typeof b[key] === 'number' && Number.isFinite(b[key]))) return undefined
  const bounds = { x: b.x as number, y: b.y as number, width: b.width as number, height: b.height as number }
  if (bounds.width < 940 || bounds.height < 600 || bounds.width > 5000 || bounds.height > 3500) return undefined
  if (!screen.getAllDisplays().some(display => {
    const a = display.workArea
    return bounds.x + bounds.width > a.x + 100 && bounds.x < a.x + a.width - 100 && bounds.y + bounds.height > a.y + 80 && bounds.y < a.y + a.height - 80
  })) return undefined
  return bounds
}
function saveBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || miniMode || isTransitioningMini || mainWindow.isMinimized() || mainWindow.isMaximized()) return
  try { writeFileSync(boundsFile(), JSON.stringify(mainWindow.getBounds())) } catch { /* unavailable disk */ }
}
function savedMiniSize(): { width: number; height: number } {
  const b = record(readJson(miniBoundsFile()))
  const width = typeof b.width === 'number' ? b.width : MINI_DEFAULT_WIDTH
  const height = typeof b.height === 'number' ? b.height : MINI_DEFAULT_HEIGHT
  return {
    width: Number.isFinite(width) ? Math.max(MINI_MIN_WIDTH, Math.min(MINI_MAX_WIDTH, Math.round(width))) : MINI_DEFAULT_WIDTH,
    height: Number.isFinite(height) ? Math.max(MINI_MIN_HEIGHT, Math.min(MINI_MAX_HEIGHT, Math.round(height))) : MINI_DEFAULT_HEIGHT
  }
}
function saveMiniSize(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !miniMode || isTransitioningMini || mainWindow.isMinimized()) return
  try {
    const { width, height } = mainWindow.getBounds()
    // Persist only a size the mini window can actually restore.
    writeFileSync(miniBoundsFile(), JSON.stringify({
      width: Math.max(MINI_MIN_WIDTH, Math.min(MINI_MAX_WIDTH, width)),
      height: Math.max(MINI_MIN_HEIGHT, Math.min(MINI_MAX_HEIGHT, height))
    }), 'utf8')
  } catch (error) { console.warn('[Mini player] Could not save window size:', error) }
}
function hardenWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-attach-webview', event => event.preventDefault())
  win.webContents.on('will-redirect', event => event.preventDefault())
  // DevTools are available only for development, never in public builds.
  if (app.isPackaged) win.webContents.on('devtools-opened', () => win.webContents.closeDevTools())
  win.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== win.webContents.getURL().split('#')[0]) event.preventDefault()
  })
}
function loadUI(win: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL('index.html', process.env.ELECTRON_RENDERER_URL)
    void win.loadURL(url.href)
  } else void win.loadFile(join(__dirname, '../renderer/index.html'))
}
function showMain(): void { if (!mainWindow || mainWindow.isDestroyed()) createWindow(); mainWindow?.show(); mainWindow?.focus() }
function createWindow(): void {
  const savedBounds = mainBounds()
  const launchMaximized = shouldStartMaximized()
  mainWindow = new BrowserWindow({
    ...savedBounds, width: savedBounds?.width ?? 1320, height: savedBounds?.height ?? 840,
    minWidth: 940, minHeight: 600, backgroundColor: '#0b0d14', title: 'Koel Desktop', autoHideMenuBar: true,
    frame: false, thickFrame: true,
    icon: assetPath(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged, allowRunningInsecureContent: false }
  })
  hardenWindow(mainWindow)
  // The X button always closes the window. No hidden background process.
  mainWindow.on('close', () => { saveBounds(); saveMiniSize() })
  mainWindow.on('move', saveBounds)
  mainWindow.on('resize', () => { saveBounds(); saveMiniSize() })
  mainWindow.on('maximize', () => { persistMaximized(true); emitWindowState() })
  mainWindow.on('unmaximize', () => { persistMaximized(false); emitWindowState() })
  loadUI(mainWindow)
  if (launchMaximized) mainWindow.maximize()
}
// Compact mode resizes the SAME BrowserWindow: the Vue renderer and HTMLAudioElement
// remain mounted, so playback, Discord presence and the queue are uninterrupted.
function setMiniMode(enabled: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed() || miniMode === enabled) return
  const win = mainWindow
  if (!enabled) saveMiniSize()
  isTransitioningMini = true
  try {
    if (enabled) {
      if (win.isMinimized()) win.restore()
      normalWasMaximized = win.isMaximized()
      // Keep the saved normal window rectangle, even if the window was maximized.
      normalBounds = normalWasMaximized ? win.getNormalBounds() : win.getBounds()
      if (!normalWasMaximized) saveBounds()
      if (win.isFullScreen()) win.setFullScreen(false)
      if (win.isMaximized()) win.unmaximize()

      win.setResizable(true)
      win.setMinimumSize(MINI_MIN_WIDTH, MINI_MIN_HEIGHT)
      win.setMaximumSize(MINI_MAX_WIDTH, MINI_MAX_HEIGHT)
      win.setMaximizable(false)
      const area = screen.getDisplayMatching(normalBounds).workArea
      const stored = savedMiniSize()
      // Keep the whole widget reachable when monitors or resolution change.
      const width = Math.min(stored.width, Math.max(MINI_MIN_WIDTH, area.width))
      const height = Math.min(stored.height, Math.max(MINI_MIN_HEIGHT, area.height))
      const x = Math.max(area.x, Math.min(normalBounds.x, area.x + area.width - width))
      const y = Math.max(area.y, Math.min(normalBounds.y, area.y + area.height - height))
      miniMode = true
      win.setBounds({ x, y, width, height }, false)
      // Keep native resizing enabled, including on frameless Windows windows.
      win.setResizable(true)
      win.setAlwaysOnTop(true, 'floating')
    } else {
      // Mini dimensions have been saved before starting this transition.
      win.setAlwaysOnTop(false)
      win.setResizable(true)
      // Restore full-window constraints BEFORE restoring its large rectangle.
      win.setMaximumSize(10000, 10000)
      win.setMaximizable(true)
      win.setMinimumSize(360, 145)
      const bounds = normalBounds ?? mainBounds() ?? { width: 1320, height: 840 }
      win.setBounds(bounds, false)
      win.setMinimumSize(940, 600)
      miniMode = false
      if (normalWasMaximized) win.maximize()
      else saveBounds()
      normalBounds = null
      normalWasMaximized = false
    }
  } finally {
    isTransitioningMini = false
  }
  win.webContents.send('native:mini-mode-changed', miniMode)
  emitWindowState()
  if (!win.isVisible()) win.show()
  win.focus()
  updateTray()
}

function toggleMini(): void { setMiniMode(!miniMode) }
function updateTray(): void {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Afficher Koel Desktop', click: showMain },
    { label: miniMode ? 'Revenir au lecteur complet' : 'Mode mini-lecteur', click: toggleMini },
    { type: 'separator' },
    { label: playback.playing ? 'Pause' : 'Lecture', click: () => notifyRenderer('toggle') },
    { label: 'Précédent', click: () => notifyRenderer('previous') },
    { label: 'Suivant', click: () => notifyRenderer('next') },
    { type: 'separator' },
    { label: 'Quitter Koel Desktop', click: () => app.quit() }
  ]))
}
function setupTray(): void {
  // Windows: prefer the multi-resolution ICO, then the transparent PNG.
  // The final fallbacks are the application's own icon assets.
  // Every candidate must resolve to the same location used by the packagers.
  const candidates = process.platform === 'win32'
    ? ['tray.ico', 'tray.png', 'icon.ico', 'icon.png']
    : ['tray.png', 'icon.png']
  let image = nativeImage.createEmpty()
  for (const candidate of candidates) {
    const path = assetPath(candidate)
    const loaded = nativeImage.createFromPath(path)
    if (!loaded.isEmpty()) {
      image = loaded
      break
    }
    console.warn(`[Tray] Failed to load icon: ${path}`)
  }
  // Never create a Tray with an empty image: Windows would show a blank slot.
  if (image.isEmpty()) {
    console.error('[Tray] No usable icon found in packaged resources')
    return
  }
  try {
    tray = new Tray(image)
    tray.setToolTip('Koel Desktop')
    tray.on('double-click', showMain)
    tray.on('click', showMain)
    updateTray()
  } catch (error) {
    // Some Linux environments do not provide a notification area.
    console.error('[Tray] Failed to initialize notification icon:', error)
    tray = null
  }
}
const mediaKeys = [ ['MediaPlayPause', 'toggle'], ['MediaNextTrack', 'next'], ['MediaPreviousTrack', 'previous'] ] as const
function setMediaKeys(enabled: boolean): void {
  // Some Windows/Electron versions reject Media* accelerators even on unregister.
  // Optional desktop features must never prevent settings from being saved.
  for (const [accelerator] of mediaKeys) {
    try { globalShortcut.unregister(accelerator) }
    catch (error) { console.warn(`[Media keys] Cannot unregister ${accelerator}:`, error) }
  }
  if (!enabled) return
  for (const [accelerator, action] of mediaKeys) {
    try {
      if (!globalShortcut.register(accelerator, () => notifyRenderer(action))) {
        console.warn(`[Media keys] ${accelerator} is reserved or unavailable`)
      }
    } catch (error) { console.warn(`[Media keys] Cannot register ${accelerator}:`, error) }
  }
}
function applySettings(): void {
  // A problem with the Windows shortcut API must not block Discord (or vice versa).
  try { setMediaKeys(settings.mediaKeys) }
  catch (error) { console.error('[Settings] Media keys configuration failed:', error) }
  try { configureDiscord(settings.discordEnabled, settings.discordClientId) }
  catch (error) { console.error('[Settings] Discord configuration failed:', error) }
}

app.whenReady().then(() => {
  settings = validateSettings(readJson(configFile()))
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  session.defaultSession.setSpellCheckerEnabled(false)
  session.defaultSession.setPermissionCheckHandler(() => false)
  ipcMain.handle('desktop:maximized', event => { if (!trusted(event)) throw new Error('IPC unauthorized'); return mainWindow?.isMaximized() ?? false })
  ipcMain.handle('desktop:info', event => { if (!trusted(event)) throw new Error('IPC unauthorized'); return { platform: process.platform, version: app.getVersion() } })
  ipcMain.handle('desktop:gpu-status', event => {
    if (!trusted(event)) throw new Error('IPC unauthorized')
    const features = app.getGPUFeatureStatus()
    return { compositing: features.gpu_compositing ?? 'unknown', rasterization: features.rasterization ?? 'unknown' }
  })
  ipcMain.on('desktop:window', (event, action: unknown) => {
    if (!trusted(event) || !mainWindow || typeof action !== 'string') return
    if (action === 'minimize') mainWindow.minimize()
    else if (action === 'maximize' && !miniMode) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
    else if (action === 'close') mainWindow.close()
  })
  setDiscordStatusListener(status => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('native:discord-status-changed', status) })
  ipcMain.handle('native:discord-status', event => { if (!trusted(event)) throw new Error('IPC unauthorized'); return getDiscordStatus() })
  ipcMain.handle('native:settings', event => { if (!trusted(event)) throw new Error('IPC unauthorized'); return settings })
  ipcMain.handle('native:set-settings', (event, value: unknown) => {
    if (!trusted(event)) throw new Error('IPC unauthorized')
    const next = validateSettings(value)
    // Persist first and report a real filesystem problem instead of silently hiding it.
    try { writeFileSync(configFile(), JSON.stringify(next), 'utf8') }
    catch (error) {
      console.error('[Settings] Cannot write desktop settings:', error)
      throw new Error(`Impossible de sauvegarder les paramètres Windows : ${error instanceof Error ? error.message : String(error)}`)
    }
    settings = next
    applySettings()
    return settings
  })
  ipcMain.on('player:state', (event, value: unknown) => {
    if (!trusted(event)) return
    const next = validatePlayback(value)
    if (!next) return
    const newlyPlaying = next.playing && next.song && next.song.id !== lastNotified
    playback = next
    emitPlayback(); updateTray()
    if (newlyPlaying && settings.notifications && Notification.isSupported()) {
      new Notification({ title: next.song!.title, body: `${next.song!.artist} - ${next.song!.album}`, silent: true }).show()
    }
    if (next.playing && next.song) lastNotified = next.song.id
    if (!next.song) lastNotified = ''
  })
  ipcMain.handle('native:mini-mode', event => { if (!trusted(event)) throw new Error('IPC unauthorized'); return miniMode })
  ipcMain.on('native:mini', (event, open: unknown) => {
    if (!trusted(event)) return
    if (open === true) setMiniMode(true)
    else if (open === false) setMiniMode(false)
    else toggleMini()
  })
  function handle(channel: string, fn: (...args: any[]) => Promise<unknown>): void {
    ipcMain.handle(channel, (event, ...args: unknown[]) => { if (!trusted(event)) throw new Error('IPC unauthorized'); return fn(...args) })
  }
  handle('koel:restore', restoreSession)
  handle('koel:login', login)
  handle('koel:verify2fa', verifyTwoFactor)
  handle('koel:songs', loadSongs)
  handle('koel:albums', loadAlbums)
  handle('koel:artists', loadArtists)
  handle('koel:playlists', loadPlaylists)
  handle('koel:create-playlist', createPlaylist)
  handle('koel:add-playlist-songs', addPlaylistSongs)
  handle('koel:remove-playlist-songs', removePlaylistSongs)
  handle('koel:collection-songs', loadCollectionSongs)
  handle('koel:collection-details', loadCollectionDetails)
  handle('koel:search', search)
  handle('koel:play-url', getPlayUrl)
  handle('koel:logout', logout)
  createWindow()
  setupTray()
  applySettings()
  app.on('activate', showMain)
})
app.on('before-quit', () => { saveBounds(); stopDiscord(); globalShortcut.unregisterAll() })
app.on('window-all-closed', () => app.quit())
