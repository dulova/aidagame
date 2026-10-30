<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
defineProps<{ title: string; dismissible?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const element = ref<HTMLElement>(); const previous = document.activeElement as HTMLElement | null;
function keys(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); }
  if (e.key !== 'Tab' || !element.value) return;
  const nodes = [...element.value.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],[tabindex="0"]')];
  if (!nodes.length) { e.preventDefault(); element.value.focus(); return; }
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
onMounted(async () => { await nextTick(); (element.value?.querySelector<HTMLElement>('button:not(:disabled)') ?? element.value)?.focus(); document.addEventListener('keydown', keys); });
onBeforeUnmount(() => { document.removeEventListener('keydown', keys); previous?.focus(); });
</script>
<template><Teleport to="body"><div class="modal-root"><div class="modal-backdrop" @pointerdown.self="dismissible && emit('close')"><section ref="element" class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><h2 id="dialog-title" class="dialog-heading">{{ title }}</h2><slot/></section></div></div></Teleport></template>
