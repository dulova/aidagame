<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { DIRECTIONS, type Direction, type Move2048, type State2048 } from './logic';
import { tileColors } from './palette';
const props=defineProps<{game:State2048;theme:string;mode:'light'|'dark';disabled:boolean;attempt:(direction:Direction)=>Move2048|undefined}>();
const emit=defineEmits<{busy:[value:boolean]}>();
interface Tile {key:string;index:number;value:number;effect?:'merge'|'spawn'}
const board=ref<HTMLElement>(),busy=ref(false),visual=shallowRef<Tile[]|null>(null);
const tiles=computed(()=>visual.value??props.game.board.flatMap((value,index)=>value?[{key:'cell-'+index,index,value}]:[]));
let run=0,gesture:{id:number;x:number;y:number}|null=null;
const classes=(tile:Tile)=>({merging:tile.effect==='merge',spawning:tile.effect==='spawn'});
function style(tile:Tile){return{...tileColors(tile.value,props.theme,props.mode),'--column':tile.index%4,'--row':Math.floor(tile.index/4),'--digits':String(tile.value).length};}
async function finishPhase(token:number){
  await nextTick();if(token!==run||document.hidden)return;
  const nodes=[...board.value?.querySelectorAll('.number-tile')??[]];
  for(const node of nodes)node.getBoundingClientRect();
  await Promise.all(nodes.flatMap(node=>node.getAnimations()).map(a=>a.finished.catch(()=>{})));
}
async function move(direction:Direction){
  if(props.disabled||busy.value)return;
  const result=props.attempt(direction);if(!result?.changed)return;
  busy.value=true;emit('busy',true);const token=++run;
  try {
    visual.value=result.movements.map(m=>({key:'move-'+m.from,index:m.from,value:m.value}));
    await nextTick();
    // Resolve starting transforms once per move, before changing target positions.
    for(const node of board.value?.querySelectorAll('.number-tile')??[])node.getBoundingClientRect();
    if(token!==run)return;
    visual.value=result.movements.map(m=>({key:'move-'+m.from,index:m.to,value:m.value}));
    await finishPhase(token);if(token!==run)return;
    const merged=new Set(result.merges.map(m=>m.to));
    const settled=result.state.board.flatMap((value,index)=>value&&index!==result.spawn?.index?[{key:'cell-'+index,index,value,effect:merged.has(index)?'merge' as const:undefined}]:[]);
    visual.value=settled;await finishPhase(token);if(token!==run)return;
    visual.value=[...settled.map(tile=>({...tile,effect:undefined})),...(result.spawn?[{key:'cell-'+result.spawn.index,index:result.spawn.index,value:result.spawn.value,effect:'spawn' as const}]:[])];
    await finishPhase(token);
  }finally{if(token===run){visual.value=null;busy.value=false;emit('busy',false);}}
}
function cancelGesture(){gesture=null;}
function interrupt(){cancelGesture();run++;for(const node of board.value?.querySelectorAll('.number-tile')??[])for(const animation of node.getAnimations())animation.cancel();visual.value=null;busy.value=false;emit('busy',false);}
function down(event:PointerEvent){
  if(!event.isPrimary){cancelGesture();return;}
  if(props.disabled||busy.value||event.button!==0||event.pointerType==='mouse')return;
  event.preventDefault();board.value?.setPointerCapture(event.pointerId);gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
}
function up(event:PointerEvent){
  const g=gesture;if(!g||event.pointerId!==g.id)return;gesture=null;
  const dx=event.clientX-g.x,dy=event.clientY-g.y,x=Math.abs(dx),y=Math.abs(dy);
  if(Math.max(x,y)<24||x===y)return;
  void move(x>y?(dx>0?'right':'left'):(dy>0?'down':'up'));
}
function anotherPointer(event:PointerEvent){if(event.pointerType==='touch'&&!event.isPrimary)cancelGesture();}
function keys(event:KeyboardEvent){
  const key=event.key.replace('Arrow','').toLowerCase() as Direction;
  if(!DIRECTIONS.includes(key)||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||document.querySelector('[role=dialog]'))return;
  if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  event.preventDefault();if(!event.repeat)void move(key);
}
function hidden(){if(document.hidden)interrupt();}
onMounted(()=>{document.addEventListener('keydown',keys);document.addEventListener('pointerdown',anotherPointer);document.addEventListener('visibilitychange',hidden);addEventListener('blur',interrupt);addEventListener('resize',interrupt);});
onBeforeUnmount(()=>{interrupt();document.removeEventListener('keydown',keys);document.removeEventListener('pointerdown',anotherPointer);document.removeEventListener('visibilitychange',hidden);removeEventListener('blur',interrupt);removeEventListener('resize',interrupt);});
</script>
<template>
  <div class="numbers-stage">
    <div ref="board" class="numbers-board" role="grid" aria-label="Игровое поле 2048, 4 на 4" tabindex="0" @pointerdown="down" @pointerup="up" @pointercancel="cancelGesture" @lostpointercapture="cancelGesture">
      <div class="numbers-grid"><div v-for="(value,index) in game.board" :key="index" class="numbers-cell" role="gridcell" :aria-label="`${value||'Свободно'}, ряд ${Math.floor(index/4)+1}, столбец ${index%4+1}`"/></div>
      <span v-for="tile in tiles" :key="tile.key" class="number-tile" :class="classes(tile)" :style="style(tile)" aria-hidden="true">{{ tile.value }}</span>
    </div>
    <p class="numbers-help">Свайпни по полю или используй стрелки клавиатуры</p>
  </div>
</template>
<style scoped>
.numbers-stage{width:100%;height:100%;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:12px;container-type:inline-size}
.numbers-board{width:100%;aspect-ratio:1;position:relative;flex-shrink:0;background:var(--surface);border-radius:5%;touch-action:none;container-type:inline-size;--pad:3cqw;--gap:2cqw;--tile:calc((100cqw - 2 * var(--pad) - 3 * var(--gap)) / 4);--pitch:calc(var(--tile) + var(--gap));isolation:isolate}
.numbers-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:var(--gap);padding:var(--pad)}
.numbers-cell{background:var(--cell);border-radius:17%;min-width:0;min-height:0}
.number-tile{position:absolute;left:var(--pad);top:var(--pad);width:var(--tile);height:var(--tile);border-radius:17%;display:grid;place-items:center;font-weight:780;font-size:min(calc(15cqw / max(1, var(--digits) * .55)),64px);font-variant-numeric:tabular-nums;line-height:1;letter-spacing:-.04em;transform:translate(calc(var(--column) * var(--pitch)),calc(var(--row) * var(--pitch)));transition:transform 120ms ease-out;pointer-events:none;z-index:1}
.merging{animation:merge-number 80ms ease-out}.spawning{animation:spawn-number 80ms ease-out}
@keyframes merge-number{0%{scale:1}50%{scale:1.08}100%{scale:1}}
@keyframes spawn-number{from{opacity:0;scale:.7}to{opacity:1;scale:1}}
.numbers-help{font-size:12px;line-height:1.4;text-align:center;color:var(--secondary);padding:0 4px}
@media(max-height:760px){.numbers-stage{gap:6px}.numbers-help{font-size:10px}}
@media(prefers-reduced-motion:reduce){.number-tile{transition:none;animation:none}}
</style>
