<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { usePreferencesStore, accents, surfaces } from '../stores/preferences'
import type { AccentColor, SurfaceStyle } from '../stores/preferences'
import { useKoelStore } from '../stores/koel'
import { usePlayerStore } from '../stores/player'
import type { DesktopSettings, DiscordStatus } from '../../../shared/native'
import type { GPUStatus } from '../../../shared/desktop'
import { APP_NAME, APP_VERSION } from '../../../shared/version'
const preferences = usePreferencesStore(), koel = useKoelStore(), player = usePlayerStore()
const accentOptions = Object.keys(accents) as AccentColor[]
const surfaceOptions = Object.keys(surfaces) as SurfaceStyle[]
const url = ref('https://'), email = ref(''), password = ref(''), remember = ref(true), otp = ref('')
const native = ref<DesktopSettings>({ discordEnabled: false, discordClientId: '', mediaKeys: false, notifications: false })
const nativeStatus = ref('')
const discordStatus = ref<DiscordStatus>({ state: 'disabled', message: 'Vérification en cours…' })
const gpuStatus = ref<GPUStatus | null>(null)
let offDiscord = () => {}
function openMini(): void { window.desktop.native.openMini() }
onMounted(async () => {
  try {
    offDiscord = window.desktop.native.onDiscordStatus(value => { discordStatus.value = value })
    native.value = await window.desktop.native.getSettings()
    discordStatus.value = await window.desktop.native.getDiscordStatus()
    gpuStatus.value = await window.desktop.getGPUStatus()
  } catch (error) { nativeStatus.value = `Paramètres natifs indisponibles : ${error instanceof Error ? error.message : String(error)}` }
})
onUnmounted(() => offDiscord())
async function connect(): Promise<void> { if (await koel.login({ url: url.value, email: email.value, password: password.value, remember: remember.value })) password.value = '' }
async function verify(): Promise<void> { if (await koel.verify(otp.value)) { password.value = ''; otp.value = '' } }
async function disconnect(): Promise<void> { player.detachServer(); await koel.logout() }
async function saveNative(): Promise<void> {
  // Vue ref() wraps the settings object in a reactive Proxy. Electron's
  // structured clone algorithm cannot transfer a Proxy over IPC.
  // Send a new object containing only primitive values.
  const payload: DesktopSettings = {
    discordEnabled: native.value.discordEnabled,
    discordClientId: native.value.discordClientId,
    mediaKeys: native.value.mediaKeys,
    notifications: native.value.notifications
  }
  try {
    native.value = await window.desktop.native.setSettings(payload)
    nativeStatus.value = 'Préférences enregistrées.'
    discordStatus.value = await window.desktop.native.getDiscordStatus()
  }
  catch (error) { nativeStatus.value = `Impossible d’enregistrer les préférences : ${error instanceof Error ? error.message : String(error)}` }
}
</script>
<template>
  <div class="page-title"><span class="eyebrow">PERSONNALISATION</span><h1>Paramètres</h1><p>Configurez votre expérience Koel Desktop.</p></div>
  <section class="settings-card"><div><h2>Serveur Koel</h2><p>Connexion directe à votre instance Koel via HTTPS.</p></div>
    <div v-if="koel.connected" class="connection-status"><strong>✓ Connecté : {{koel.session?.user.name}}</strong><small>{{koel.session?.email}} · {{koel.session?.url}} · {{koel.session?.version ?? 'Version inconnue'}}</small><button class="secondary-btn" :disabled="koel.busy" @click="disconnect">Se déconnecter</button></div>
    <form v-else-if="!koel.awaiting2FA" class="connection-form" @submit.prevent="connect"><label>URL du serveur <input v-model.trim="url" type="url" required placeholder="https://music.exemple.fr" autocomplete="url" /></label><label>Email <input v-model.trim="email" type="email" required autocomplete="username" /></label><label>Mot de passe <input v-model="password" type="password" required autocomplete="current-password" /></label><label class="remember"><input v-model="remember" type="checkbox" /> Mémoriser la session lorsque le chiffrement système est disponible</label><button class="primary-btn" type="submit" :disabled="koel.busy">{{koel.busy ? 'Connexion…' : 'Se connecter'}}</button></form>
    <form v-else class="connection-form" @submit.prevent="verify"><p>Vérification à deux facteurs demandée par Koel.</p><label>Code de vérification <input v-model.trim="otp" required autocomplete="one-time-code" /></label><button class="primary-btn" type="submit" :disabled="koel.busy">{{koel.busy ? 'Vérification…' : 'Valider le code'}}</button><button class="secondary-btn" type="button" @click="koel.awaiting2FA=false">Retour</button></form>
    <p v-if="koel.error" class="notice" role="alert">{{koel.error}}</p>
    <p class="muted">HTTP n'est accepté que sur localhost. Le jeton audio limité est utilisé pour Koel 9.15. Aucun mot de passe n'est conservé.</p>
  </section>
  <section class="settings-card appearance-settings">
    <div><h2>Personnalisation</h2><p>Choisissez le style de Koel Desktop. Les changements sont instantanés et restent enregistrés sur cet appareil.</p></div>
    <div class="appearance-group">
      <strong>Couleur d'accentuation</strong>
      <p class="muted">Utilisée pour les boutons, les liens, le lecteur et les sélections.</p>
      <div class="appearance-swatches" role="group" aria-label="Couleur d'accentuation">
        <button v-for="key in accentOptions" :key="key" type="button" class="appearance-swatch" :class="{ 'is-selected': preferences.accent === key }" :aria-pressed="preferences.accent === key" :title="accents[key].label" @click="preferences.accent = key">
          <span class="appearance-swatch-dot" :style="{ background: accents[key].main }"><span v-if="preferences.accent === key" aria-hidden="true">✓</span></span>
          <span>{{ accents[key].label }}</span>
        </button>
      </div>
    </div>
    <div class="appearance-group">
      <strong>Ambiance</strong>
      <p class="muted">Modifie le fond, la barre latérale et les panneaux.</p>
      <div class="appearance-themes" role="group" aria-label="Ambiance de l'interface">
        <button v-for="key in surfaceOptions" :key="key" type="button" class="appearance-theme" :class="{ 'is-selected': preferences.surface === key }" :aria-pressed="preferences.surface === key" @click="preferences.surface = key">
          <span class="appearance-theme-preview" :style="{ background: surfaces[key].base, borderColor: surfaces[key].border }"><i :style="{ background: surfaces[key].sidebar }"></i><b :style="{ background: surfaces[key].panel }"></b></span>
          <span>{{ surfaces[key].label }}</span><span v-if="preferences.surface === key" class="appearance-theme-check" aria-hidden="true">✓</span>
        </button>
      </div>
    </div>
    <div class="appearance-group appearance-options">
      <label class="setting-option"><div><strong>Affichage compact</strong><small>Réduit l'espacement des morceaux et des listes</small></div><input type="checkbox" v-model="preferences.compact" /></label>
      <label class="setting-option"><div><strong>Coins arrondis</strong><small>Arrondis des fenêtres, cartes et boutons</small></div><input type="checkbox" :checked="preferences.corners === 'rounded'" @change="preferences.corners = ($event.target as HTMLInputElement).checked ? 'rounded' : 'square'" /></label>
      <label class="setting-option"><div><strong>Texte agrandi</strong><small>Améliore la lisibilité des listes et des informations</small></div><input type="checkbox" :checked="preferences.fontSize === 'large'" @change="preferences.fontSize = ($event.target as HTMLInputElement).checked ? 'large' : 'normal'" /></label>
      <label class="setting-option"><div><strong>Réduire les animations</strong><small>Limite les transitions et les effets de mouvement</small></div><input type="checkbox" v-model="preferences.reducedMotion" /></label>
    </div>
    <div class="appearance-footer"><span class="muted">Préférences enregistrées automatiquement.</span><button type="button" class="secondary-btn" @click="preferences.resetAppearance()">Rétablir l'apparence par défaut</button></div>
  </section>
  <section class="settings-card"><div><h2>Windows et intégration système</h2><p>Des options natives facultatives, qui peuvent dépendre des autorisations Windows.</p></div>
    <label class="setting-option"><div><strong>Touches multimédias globales</strong><small>Lecture/pause, suivant et précédent (si non réservées par Windows ou une autre application)</small></div><input v-model="native.mediaKeys" type="checkbox" /></label>
    <label class="setting-option"><div><strong>Notifications de changement de morceau</strong><small>Affiche titre et artiste dans les notifications Windows</small></div><input v-model="native.notifications" type="checkbox" /></label>
    <p class="muted">Le bouton ✕ ferme complètement Koel Desktop, arrête la lecture et quitte Discord Rich Presence. Le bouton - réduit simplement la fenêtre.</p>
    <button class="secondary-btn" @click="openMini()">Activer le mode mini-lecteur</button>
  </section>
  <section class="settings-card"><div><h2>Discord Rich Presence</h2><p>Afficher publiquement le morceau écouté sur votre profil Discord. Désactivé par défaut.</p></div>
    <label class="setting-option"><div><strong>Activer Discord Rich Presence</strong><small>Discord Desktop doit être ouvert ; aucune adresse de serveur ni aucun jeton Koel n’est envoyé.</small></div><input v-model="native.discordEnabled" type="checkbox" /></label>
    <p class="muted">Discord est intégré : aucun Application ID à saisir. Activez simplement cette option et lancez un morceau.</p>
    <p class="muted">Au lancement, la connexion Discord peut prendre quelques secondes. L’absence de Discord n’empêche pas Koel de fonctionner. La pochette réelle n'est pas envoyée à Discord.</p>
    <p class="notice" role="status"><strong>État Discord : {{ discordStatus.state }}</strong> - {{ discordStatus.message }}</p>
    <p class="muted">Si Discord est connecté mais qu’aucune activité ne s’affiche, démarrez la lecture et activez le partage d’activité dans les paramètres de confidentialité Discord.</p>
    <button class="primary-btn" @click="saveNative">Enregistrer les paramètres natifs</button><p v-if="nativeStatus" class="notice" role="status">{{nativeStatus}}</p>
  </section>
  <section class="settings-card"><div><h2>À propos</h2><p>{{ APP_NAME }} - v{{ APP_VERSION }}</p></div><p class="muted">Compatible avec Koel 9.15.0 Plus, en conservant le jeton de streaming audio spécifique.</p><p class="muted">Accélération matérielle : activée lorsque le GPU et ses pilotes sont pris en charge par Chromium.</p><p v-if="gpuStatus" class="muted">Diagnostic GPU - Composition : {{ gpuStatus.compositing }} · Rendu : {{ gpuStatus.rasterization }}</p></section>
</template>
