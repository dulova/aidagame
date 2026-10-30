<script setup lang="ts">
defineProps<{ name: 'back' | 'restart' | 'trophy' | 'settings' }>();
const paths = {
  back: 'M19 12H5m7-7-7 7 7 7', restart: 'M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7',
  trophy: 'M7 3h10v8a5 5 0 0 1-10 0V3Zm10 2h4v3a4 4 0 0 1-4 4M7 5H3v3a4 4 0 0 0 4 4m5 4v4m-4 0h8',
  settings: 'M12 2.8 14 4l2.2-.5 1.3 2 2.3.9.1 2.5L21.3 11l-1 2.1.4 2.2-2 1.3-.9 2.3-2.5.1L13 20.5l-2.1-1-2.2.4-1.3-2-2.3-.9L5 14.5 3.6 12l1-2.1-.4-2.2 2-1.3.9-2.3 2.5-.1L12 2.8Z',
};
</script>
<template><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]"/><circle v-if="name === 'settings'" cx="12" cy="12" r="3.1"/></svg></template>
