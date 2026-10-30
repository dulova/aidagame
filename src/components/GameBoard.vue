<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import ShapeView from './ShapeView.vue';
import type { Game, Group, Shape } from '../types';
import { shapeSize } from '../game/shapes';
import type { Placement } from '../game/logic';

const props = defineProps<{ game: Game; stamp: string | null; disabled: boolean; attempt: (slot: number, col: number, row: number) => Placement | undefined }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const board = ref<HTMLElement>(); const panel = ref<HTMLElement>();
const selected = ref<number | null>(null); const busy = ref(false);
const clearing = shallowRef(new Map<number, Group>()); const placed = shallowRef(new Set<number>());
const shown = computed(() => props.game.board.map((g,i) => clearing.value.get(i) ?? g));
type Metrics = { left: number; top: number; pitch: number; cell: number };
type Drag = { id: number; slot: number; shape: Shape; startX: number; startY: number; x: number; y: number; touch: boolean; active: boolean; metrics: Metrics };
let drag: Drag | null = null; let raf = 0; let generation = 0; let releasing = false;
const ghost = ref<HTMLElement>(); const ghostShape = shallowRef<Shape | null>(null); const dragSlot = ref<number | null>(null);
function metrics(): Metrics {
  const el = board.value!; const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
  const px = parseFloat(style.paddingLeft), py = parseFloat(style.paddingTop), gap = parseFloat(style.columnGap);
  const cell = (rect.width - px - parseFloat(style.paddingRight) - gap * 9) / 10;
  return { left: rect.left + px, top: rect.top + py, cell, pitch: cell + gap };
}
function position(d: Drag) {
  const { cols, rows } = shapeSize(d.shape);
  return { x: d.x - cols * d.metrics.pitch / 2, y: d.touch ? d.y - rows * d.metrics.pitch - 45 : d.y - rows * d.metrics.pitch / 2 };
}
function paint() { raf = 0; if (!drag || !ghost.value) return; const p = position(drag); ghost.value.style.transform = `translate3d(${p.x}px,${p.y}px,0)`; }
function down(e: PointerEvent, slot: number) {
  if (!e.isPrimary || busy.value || props.disabled || e.button !== 0 || !props.game.slots[slot]) return;
  e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, slot, shape: props.game.slots[slot]!, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', active: false, metrics: metrics() };
}
async function move(e: PointerEvent) {
  const d = drag; if (!d || e.pointerId !== d.id) return;
  d.x = e.clientX; d.y = e.clientY;
  if (!d.active && Math.hypot(d.x - d.startX, d.y - d.startY) < 8) return;
  if (!d.active) { d.active = true; emit('busy', true); ghostShape.value = d.shape; dragSlot.value = d.slot; await nextTick(); if (ghost.value) ghost.value.style.setProperty('--drag-pitch', `${d.metrics.pitch}px`); }
  if (!raf) raf = requestAnimationFrame(paint);
}
async function up(e: PointerEvent) {
  const d = drag; if (!d || d.id !== e.pointerId) return;
  releasing = true;
  d.x = e.clientX; d.y = e.clientY;
  if (!d.active) { cancelDrag(); if (e.pointerType === 'mouse') selected.value = d.slot; releasing = false; return; }
  const p = position(d); const col = Math.round((p.x - d.metrics.left) / d.metrics.pitch); const row = Math.round((p.y - d.metrics.top) / d.metrics.pitch);
  const ok = await place(d.slot, col, row);
  if (!ok && ghost.value) {
    busy.value = true; emit('busy', true);
    const target = panel.value?.children[d.slot]?.getBoundingClientRect();
    if (target && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const rect = ghost.value.getBoundingClientRect();
      await ghost.value.animate([{ transform: `translate(${p.x}px,${p.y}px) scale(1)` }, { transform: `translate(${target.x + target.width / 2 - rect.width / 2}px,${target.y + target.height / 2 - rect.height / 2}px) scale(.58)` }], { duration: 130, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
    }
    busy.value = false; emit('busy', false);
  }
  cancelDrag(); releasing = false;
}
function cancelDrag() { if (raf) cancelAnimationFrame(raf); raf = 0; if (drag && !busy.value) emit('busy', false); drag = null; ghostShape.value = null; dragSlot.value = null; }
async function place(slot: number, col: number, row: number): Promise<boolean> {
  if (busy.value || props.disabled) return false;
  const previous = [...props.game.board], group = props.game.slots[slot]?.group;
  const result = props.attempt(slot, col, row); if (!result?.accepted) return false;
  busy.value = true; cancelDrag(); selected.value = null; emit('busy', true); const run = ++generation;
  placed.value = new Set(result.placedCells);
  const indices = [...new Set([...result.cleared.rows.flatMap((y: number) => Array.from({ length: 10 }, (_, x) => y * 10 + x)), ...result.cleared.cols.flatMap((x: number) => Array.from({ length: 10 }, (_, y) => y * 10 + x))])];
  clearing.value = new Map(indices.map(i => [i, previous[i] || group!]));
  await nextTick();
  const animations = Array.from(board.value?.querySelectorAll('.placing,.clearing') ?? []).flatMap(el => el.getAnimations());
  await Promise.all(animations.map(a => a.finished.catch(() => {})));
  if (run !== generation) return true;
  clearing.value = new Map(); placed.value = new Set(); busy.value = false; emit('busy', false); return true;
}
function click(e: MouseEvent) { if (selected.value === null || e.detail === 0) return; const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]'); if (cell) void place(selected.value, Number(cell.dataset.cell) % 10, Math.floor(Number(cell.dataset.cell) / 10)); }
function key(e: KeyboardEvent, index: number) {
  const offsets: Record<string,number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 };
  if (e.key in offsets) { e.preventDefault(); (board.value?.children[Math.max(0, Math.min(99, index + offsets[e.key]))] as HTMLElement)?.focus(); }
  if ((e.key === 'Enter' || e.key === ' ') && selected.value !== null) { e.preventDefault(); void place(selected.value, index % 10, Math.floor(index / 10)); }
}
function windowResize() { cancelDrag(); }
function outside(e: PointerEvent) { if (e.pointerType === 'touch' && !e.isPrimary) cancelDrag(); if (!(e.target as HTMLElement).closest('.board,.pieces-panel')) selected.value = null; }
function escape(e: KeyboardEvent) { if (e.key === 'Escape') { selected.value = null; cancelDrag(); } }
onMounted(() => { addEventListener('resize', windowResize); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape); });
onBeforeUnmount(() => { generation++; cancelDrag(); emit('busy', false); removeEventListener('resize', windowResize); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); });
watch(() => props.game.turns, () => { if (props.game.turns === 0) { clearing.value = new Map(); placed.value = new Set(); selected.value = null; } });
</script>
<template>
  <div class="play-stack">
    <div class="board-wrap"><div ref="board" class="board" id="game-board" role="grid" aria-label="Игровое поле 10 на 10" @click="click">
      <div v-for="(group, i) in shown" :key="i" class="board-cell" :data-cell="i" role="gridcell" :tabindex="i === 0 ? 0 : -1" :aria-label="`${group ? 'Занятая' : 'Свободная'} клетка, ряд ${Math.floor(i / 10) + 1}, столбец ${i % 10 + 1}`" @keydown="key($event, i)">
        <span v-if="group" :class="['board-block', `group-${group}`, { clearing: clearing.has(i), placing: placed.has(i) && !clearing.has(i) }]" :style="{ '--clear-delay': `${Math.max(0, [...clearing.keys()].indexOf(i)) * 80 / Math.max(1, clearing.size - 1)}ms` }"><span v-if="stamp" class="cell-stamp" :style="{ '--stamp-url': `url('${stamp}')` }"/></span>
      </div>
    </div></div>
    <div ref="panel" class="pieces-panel" id="pieces-panel" aria-label="Доступные фигуры">
      <div v-for="(shape, i) in game.slots" :key="i" :class="['piece-slot', { used: !shape, chosen: selected === i, 'is-drag-origin': dragSlot === i }]" :data-slot="i" :role="shape ? 'button' : undefined" :tabindex="shape ? 0 : undefined" :aria-label="shape ? `Фигура ${i + 1}` : undefined" @pointerdown="down($event, i)" @pointermove="move" @pointerup="up" @pointercancel="cancelDrag" @lostpointercapture="() => { if (!releasing) cancelDrag(); }" @keydown.enter.prevent="selected = i" @keydown.space.prevent="selected = i">
        <ShapeView v-if="shape" :shape="shape" :stamp="stamp"/><span v-else class="empty-slot" aria-hidden="true"/>
      </div>
    </div>
  </div>
  <Teleport to="body"><div v-if="ghostShape" ref="ghost" class="drag-ghost"><ShapeView :shape="ghostShape" :stamp="stamp" type="drag"/></div></Teleport>
</template>
