import RPC from 'discord-rpc'
import type { PresenceSnapshot, DiscordStatus } from '../../shared/native'

let client: InstanceType<typeof RPC.Client> | null = null
let activeClientId = ''
let ready = false
let latest: PresenceSnapshot = { song: null, playing: false, time: 0, duration: 0 }
let retry: ReturnType<typeof setTimeout> | null = null
let serial = 0
let onStatus: (status: DiscordStatus) => void = () => {}
let status: DiscordStatus = { state: 'disabled', message: 'Rich Presence désactivée.' }

function report(state: DiscordStatus['state'], message: string): void {
  status = { state, message }
  console.info(`[Discord RPC] ${state}: ${message}`)
  onStatus(status)
}
export function getDiscordStatus(): DiscordStatus { return status }
export function setDiscordStatusListener(fn: (s: DiscordStatus) => void): void { onStatus = fn; fn(status) }
function cancelRetry(): void { if (retry) clearTimeout(retry); retry = null }
function dispose(): void {
  serial++
  cancelRetry()
  ready = false
  const old = client
  client = null
  if (old) { try { void Promise.resolve(old.destroy()).catch(() => undefined) } catch { /* already disconnected */ } }
}
function reconnect(current: number): void {
  if (current !== serial || !activeClientId) return
  cancelRetry()
  if (status.state !== 'error') report('waiting', 'Discord indisponible. Nouvelle tentative dans 15 secondes.')
  retry = setTimeout(() => { retry = null; connect() }, 15000)
}
function connect(): void {
  if (!activeClientId) return
  const current = ++serial
  report('connecting', 'Connexion au client Discord Desktop…')
  let rpc: InstanceType<typeof RPC.Client>
  try { rpc = new RPC.Client({ transport: 'ipc' }) }
  catch (error) { report('error', `Impossible de créer le client RPC : ${message(error)}`); reconnect(current); return }
  client = rpc
  ready = false
  rpc.on('ready', () => {
    if (current !== serial) return
    ready = true
    report('connected', 'Connecté à Discord Desktop. En attente d’un morceau…')
    void publish()
  })
  rpc.on('disconnected', () => {
    if (current !== serial) return
    ready = false; client = null
    reconnect(current)
  })
  rpc.on('error', error => {
    if (current !== serial) return
    ready = false
    report('error', `Erreur Discord RPC : ${message(error)}`)
    // A connection can emit an error without emitting "disconnected".
    dispose(); reconnect(serial)
  })
  try {
    void rpc.login({ clientId: activeClientId }).catch(error => {
      if (current !== serial) return
      report('error', `Connexion impossible : ${message(error)}`)
      dispose(); reconnect(serial)
    })
  } catch (error) {
    if (current !== serial) return
    report('error', `Connexion impossible : ${message(error)}`)
    dispose(); reconnect(serial)
  }
}
function message(e: unknown): string { return e instanceof Error ? e.message : String(e) }
export function configureDiscord(enabled: boolean, clientId: string): void {
  const id = enabled && /^\d{17,22}$/.test(clientId.trim()) ? clientId.trim() : ''
  if (id === activeClientId && (client || retry || !id)) return
  dispose()
  activeClientId = id
  if (id) connect()
  else report(enabled ? 'error' : 'disabled', enabled ? 'Application ID invalide.' : 'Rich Presence désactivée.')
}
async function publish(): Promise<void> {
  const rpc = client
  if (!ready || !rpc) return
  const { song, playing, time, duration } = latest
  try {
    if (!song || !playing) {
      await rpc.clearActivity()
      report('connected', 'Connecté à Discord. Lancez un morceau pour afficher votre activité.')
      return
    }
    const now = Date.now()
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
    const progress = Math.min(safeDuration, Math.max(0, time))
    const payload = {
      details: song.title.slice(0, 120) || 'Musique',
      state: `${song.artist || 'Artiste inconnu'} · ${song.album || 'Album inconnu'}`.slice(0, 120),
      ...(safeDuration > 0 ? { startTimestamp: Math.floor((now - progress * 1000) / 1000), endTimestamp: Math.floor((now + (safeDuration - progress) * 1000) / 1000) } : {}),
      instance: false
    }
    // discord-rpc#setActivity discards the activity type and forces "Playing".
    // Send the supported RPC command directly to select Listening (2).
    await rpc.request('SET_ACTIVITY', {
      pid: process.pid,
      activity: {
        type: 2,
        details: payload.details,
        state: payload.state,
        ...(safeDuration > 0 ? {
          timestamps: {
            start: Math.floor((now - progress * 1000) / 1000),
            end: Math.floor((now + (safeDuration - progress) * 1000) / 1000)
          }
        } : {}),
        instance: false
      }
    })
    report('active', `Activité publiée : ${song.title.slice(0, 70)}`)
  } catch (error) {
    report('error', `Discord refuse l’activité : ${message(error)}`)
  }
}
export function updateDiscord(snapshot: PresenceSnapshot): void {
  const previous = latest
  latest = snapshot
  if (previous.song?.id !== snapshot.song?.id || previous.playing !== snapshot.playing || Math.abs(previous.time - snapshot.time) > 18) void publish()
}
export function stopDiscord(): void { dispose(); activeClientId = ''; report('disabled', 'Rich Presence désactivée.') }
