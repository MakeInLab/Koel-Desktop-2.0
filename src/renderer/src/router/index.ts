import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LibraryView from '../views/LibraryView.vue'
import SettingsView from '../views/SettingsView.vue'
import CatalogView from '../views/CatalogView.vue'
import CollectionView from '../views/CollectionView.vue'
import SearchView from '../views/SearchView.vue'
import QueueView from '../views/QueueView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/library', component: LibraryView },
    { path: '/albums', component: CatalogView },
    { path: '/artists', component: CatalogView },
    { path: '/playlists', component: CatalogView },
    { path: '/search', component: SearchView },
    { path: '/queue', component: QueueView },
    { path: '/:kind(albums|artists|playlists)/:id', component: CollectionView },
    { path: '/settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
