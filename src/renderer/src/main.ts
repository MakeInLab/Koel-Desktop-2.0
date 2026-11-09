import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles.css'
import { usePreferencesStore } from './stores/preferences'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
// Initialize the palette before rendering a single frame of the UI.
usePreferencesStore(pinia)
app.use(router)
app.mount('#app')
