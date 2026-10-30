<script setup lang="ts">
import { computed } from 'vue';
import { shapeSize } from '../game/shapes';
import type { Shape } from '../types';
const props = defineProps<{ shape: Shape; stamp: string | null; type?: 'mini' | 'drag' }>();
const size = computed(() => shapeSize(props.shape));
const cells = computed(() => new Set(props.shape.cells.map(([x,y]) => `${x},${y}`)));
</script>
<template>
  <div :class="[`shape-${type || 'mini'}`, `group-${shape.group}`]" :style="{ '--shape-cols': size.cols, '--shape-rows': size.rows }">
    <template v-for="(_, i) in size.cols * size.rows" :key="i">
      <span v-if="cells.has(`${i % size.cols},${Math.floor(i / size.cols)}`)" class="piece-cell"><span v-if="stamp" class="cell-stamp" :style="{ '--stamp-url': `url('${stamp}')` }"/></span>
      <span v-else class="piece-blank"/>
    </template>
  </div>
</template>
