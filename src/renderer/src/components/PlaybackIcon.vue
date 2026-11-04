<script setup lang="ts">
defineProps<{ name: 'play' | 'pause' | 'previous' | 'next' | 'shuffle' | 'repeat' | 'repeat-one' | 'volume' | 'mute' }>()
</script>
<template>
  <svg class="playback-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-if="name === 'play'" d="M8 5.5 18.5 12 8 18.5Z" fill="currentColor" stroke="none" />
    <g v-else-if="name === 'pause'" fill="currentColor" stroke="none"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></g>
    <g v-else-if="name === 'previous'"><path d="M5 5v14"/><path d="M18.5 5.8 7.5 12l11 6.2Z" fill="currentColor" stroke="none"/></g>
    <g v-else-if="name === 'next'"><path d="M19 5v14"/><path d="M5.5 5.8 16.5 12l-11 6.2Z" fill="currentColor" stroke="none"/></g>
    <g v-else-if="name === 'shuffle'"><path d="M4 6h2c3 0 4.3 2.1 6 5s3 5 6 5h2"/><path d="m17 13 3 3-3 3"/><path d="M4 18h2c2.2 0 3.5-1.2 4.6-3"/><path d="M13.3 8.8C14.5 7 15.7 6 18 6h2"/><path d="m17 3 3 3-3 3"/></g>
    <g v-else-if="name === 'repeat' || name === 'repeat-one'"><path d="m17 2 3 3-3 3"/><path d="M20 5H7a4 4 0 0 0-4 4v2"/><path d="m7 22-3-3 3-3"/><path d="M4 19h13a4 4 0 0 0 4-4v-2"/><text v-if="name === 'repeat-one'" x="12" y="15" text-anchor="middle" font-size="9" stroke="none" fill="currentColor" font-weight="800">1</text></g>
    <g v-else-if="name === 'mute'"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6m0-6-5 6"/></g>
    <g v-else-if="name === 'volume'"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a5 5 0 0 1 0 6"/><path d="M19.5 6a9 9 0 0 1 0 12"/></g>
  </svg>
</template>
