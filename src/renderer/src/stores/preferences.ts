import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AccentColor = 'violet' | 'pink' | 'blue' | 'green' | 'orange'
export type SurfaceStyle = 'midnight' | 'charcoal' | 'ocean'
export type CornerStyle = 'rounded' | 'square'
export type FontSize = 'normal' | 'large'

export const accents: Record<AccentColor, { label: string; main: string; hover: string; rgb: string }> = {
  violet: { label: 'Violet', main: '#c991ee', hover: '#e0b8f5', rgb: '201,145,238' },
  pink: { label: 'Rose', main: '#ef92b9', hover: '#ffbed7', rgb: '239,146,185' },
  blue: { label: 'Bleu', main: '#79adff', hover: '#a9cbff', rgb: '121,173,255' },
  green: { label: 'Vert', main: '#8cdda7', hover: '#b7edc9', rgb: '140,221,167' },
  orange: { label: 'Orange', main: '#f2ae7d', hover: '#ffcfaa', rgb: '242,174,125' }
}
export const surfaces: Record<SurfaceStyle, { label: string; base: string; sidebar: string; panel: string; elevated: string; border: string }> = {
  midnight: { label: 'Nuit', base: '#0b0e16', sidebar: '#10121b', panel: '#151722', elevated: '#1e1b2a', border: '#303142' },
  charcoal: { label: 'Graphite', base: '#111215', sidebar: '#17181a', panel: '#1e2023', elevated: '#29292e', border: '#404046' },
  ocean: { label: 'Océan', base: '#0a1420', sidebar: '#0e1b2b', panel: '#132238', elevated: '#1c2c44', border: '#30445a' }
}

function loadChoice<T extends string>(key: string, options: Record<T, unknown>, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value !== null && Object.prototype.hasOwnProperty.call(options, value) ? value as T : fallback
  } catch { return fallback }
}
function save(key: string, value: string | boolean): void {
  try { localStorage.setItem(key, String(value)) } catch { /* storage unavailable */ }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const compact = ref(loadChoice<'true' | 'false'>('koel:compact', { true: true, false: false }, 'false') === 'true')
  const accent = ref<AccentColor>(loadChoice('koel:appearance:accent', accents, 'violet'))
  const surface = ref<SurfaceStyle>(loadChoice('koel:appearance:surface', surfaces, 'midnight'))
  const corners = ref<CornerStyle>(loadChoice<CornerStyle>('koel:appearance:corners', { rounded: true, square: true }, 'rounded'))
  const fontSize = ref<FontSize>(loadChoice<FontSize>('koel:appearance:font', { normal: true, large: true }, 'normal'))
  const reducedMotion = ref(loadChoice<'true' | 'false'>('koel:appearance:motion', { true: true, false: false }, 'false') === 'true')

  // Keep the preferences global, including overlays rendered outside the Vue shell.
  watch([compact, accent, surface, corners, fontSize, reducedMotion], () => {
    save('koel:compact', compact.value)
    save('koel:appearance:accent', accent.value)
    save('koel:appearance:surface', surface.value)
    save('koel:appearance:corners', corners.value)
    save('koel:appearance:font', fontSize.value)
    save('koel:appearance:motion', reducedMotion.value)
    const root = document.documentElement
    const color = accents[accent.value]
    const bg = surfaces[surface.value]
    root.style.setProperty('--user-accent', color.main)
    root.style.setProperty('--user-accent-hover', color.hover)
    root.style.setProperty('--user-accent-rgb', color.rgb)
    root.style.setProperty('--user-base', bg.base)
    root.style.setProperty('--user-sidebar', bg.sidebar)
    root.style.setProperty('--user-panel', bg.panel)
    root.style.setProperty('--user-elevated', bg.elevated)
    root.style.setProperty('--user-border', bg.border)
    root.dataset.cornerStyle = corners.value
    root.dataset.fontSize = fontSize.value
    root.dataset.reduceMotion = String(reducedMotion.value)
  }, { immediate: true })

  function resetAppearance(): void {
    accent.value = 'violet'
    surface.value = 'midnight'
    compact.value = false
    corners.value = 'rounded'
    fontSize.value = 'normal'
    reducedMotion.value = false
  }
  return { compact, accent, surface, corners, fontSize, reducedMotion, resetAppearance }
})
