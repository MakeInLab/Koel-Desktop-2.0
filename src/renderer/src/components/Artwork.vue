<script setup lang="ts">
import { ref, watch } from 'vue'
const props = withDefaults(defineProps<{ src?: string | null; color?: string; size?: string; symbol?: string; label?: string }>(), {
  color: '#875ace', size: '72px', symbol: '♫', label: 'Illustration'
})
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>
<template>
  <div class="artwork" :style="{ '--art-color': color, '--art-size': size }" role="img" :aria-label="label">
    <img v-if="src && !failed" :src="src" :alt="label" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" />
    <span v-else aria-hidden="true">{{ symbol }}</span>
  </div>
</template>
