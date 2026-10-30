<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import { themes, themeOrder, patterns, resolvePalette, applyTheme } from './design/themes.js';
import { createInitialState, placeShape, type Placement } from './game/logic';
import { ConflictError, LegacyConflictError, createRepository, defaults, exportSnapshot, parseBackup } from './storage/repository';
import type { Settings, Snapshot } from './types';
import { gameModules } from './game/registry';
import UiIcon from './components/UiIcon.vue';
import ModalDialog from './components/ModalDialog.vue';

const base = import.meta.env.BASE_URL;
const GameBoard = defineAsyncComponent(gameModules['block-puzzle'].load);
const asset = (path: string) => `${base}${path}`;
const state = shallowRef<Snapshot>({ game: null, settings: { ...defaults }, best: 0, revision: 0 });
const screen = ref<'home' | 'game' | 'settings'>('home'); let back: 'home' | 'game' = 'home';
const loading = ref(true), saving = ref(false), animating = ref(false), conflict = ref(false), issue = ref(''), notice = ref('');
const modal = ref<'restart' | 'result' | 'import' | 'reload' | 'reset' | null>(null);
const preview = shallowRef<ReturnType<typeof parseBackup> | null>(null); let previewRevision = 0;
const candidates = shallowRef<LegacyConflictError['candidates']>([]);
const initialized = ref(false), updateAvailable = ref(false), offlineReady = ref(false);
const importInput = ref<HTMLInputElement>();
let serial = Promise.resolve(); let pending = 0; let disposed = false;
const repository = createRepository(undefined, { notify(message) { issue.value = message; conflict.value = true; } });
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('muroblocks-changes') : null;
const locked = computed(() => loading.value || saving.value || conflict.value || !initialized.value);
const settings = computed(() => state.value.settings);
const stamp = computed(() => { const p = patterns.find(p => p.id === settings.value.pattern); return p?.icon ? asset(`icons/pattern-${p.icon}.svg`) : null; });
watch(settings, s => applyTheme(s.theme, s.mode), { immediate: true });
watch(screen, s => { document.body.dataset.screen = s; }, { immediate: true });
watch(animating, value => { if (!value && screen.value === 'game' && state.value.game?.status === 'completed') modal.value = 'result'; });

function describe(error: unknown) { return error instanceof Error ? error.message : 'Не удалось сохранить данные. Экспортируйте текущий прогресс.'; }
function failed(error: unknown) { issue.value = describe(error); if (error instanceof ConflictError) conflict.value = true; }
function publishRevision() { channel?.postMessage({ revision: state.value.revision }); }
function persist(): void {
  if (!initialized.value || issue.value || conflict.value) return;
  const candidate = structuredClone(state.value); pending++; saving.value = true;
  serial = serial.then(async () => {
    if (issue.value || conflict.value) return;
    try {
      const saved = await repository.commit(candidate, state.value.revision);
      state.value = { ...state.value, revision: saved.revision };
      publishRevision();
    } catch (error) { failed(error); }
  }).finally(() => { pending--; saving.value = pending > 0; });
}
function changeSettings(patch: Partial<Settings>) { state.value = { ...state.value, settings: { ...settings.value, ...patch } }; persist(); }
function swatches(id: string) { const p = resolvePalette(id, settings.value.mode); return [p.blockSingle, p.blockDouble, p.blockTriple, p.blockLine, p.blockL]; }
function home() { if (animating.value) return; modal.value = null; screen.value = 'home'; }
function openSettings() { if (animating.value) return; modal.value = null; if (screen.value === 'settings') { screen.value = back; return; } back = screen.value; screen.value = 'settings'; }
function fresh() { if (locked.value) return; state.value = { ...state.value, game: createInitialState(Math.random, state.value.best) }; modal.value = null; screen.value = 'game'; persist(); }
function start() { if (locked.value) return; if (state.value.game?.status !== 'active') fresh(); else screen.value = 'game'; }
function attempt(slot: number, col: number, row: number): Placement | undefined {
  if (!state.value.game || locked.value) return;
  const result = placeShape(state.value.game, slot, col, row);
  if (result.accepted) { state.value = { ...state.value, game: result.state, best: result.state.best }; persist(); }
  return result;
}
async function load() {
  loading.value = true; notice.value = '';
  try {
    const loaded = await repository.load();
    if (disposed) return;
    state.value = loaded; initialized.value = true; candidates.value = []; issue.value = ''; conflict.value = false;
    modal.value = null; screen.value = 'home';
  } catch (error) { failed(error); if (error instanceof LegacyConflictError) candidates.value = error.candidates; }
  finally { loading.value = false; await nextTick(); document.documentElement.dataset.ready = 'true'; performance.mark('muroblocks-ready'); }
}
async function chooseLegacy(snapshot: Snapshot) {
  loading.value = true;
  try { state.value = await repository.commit(snapshot, undefined); initialized.value = true; candidates.value = []; issue.value = ''; conflict.value = false; publishRevision(); }
  catch (error) { failed(error); } finally { loading.value = false; }
}
async function retry() {
  if (!initialized.value) { await load(); return; }
  if (conflict.value) { modal.value = 'reload'; return; }
  issue.value = ''; persist(); await serial;
}
function download() {
  try {
    const text = exportSnapshot(state.value); const blob = new Blob([text], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `muroblocks-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice.value = issue.value ? 'Экспортировано состояние из памяти. Сохраните файл вне приложения.' : 'Файл подготовлен. Сохраните его вне приложения.';
  } catch (error) { notice.value = describe(error); }
}
async function recoverRaw() {
  try { const text = await repository.rawRecovery(); const url = URL.createObjectURL(new Blob([text], {type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='muroblocks-original-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  catch(error) { issue.value=describe(error); }
}
async function resetDamaged() {
  loading.value=true;
  try { state.value=await repository.reset(); initialized.value=true; issue.value='';conflict.value=false;modal.value=null;publishRevision(); }
  catch(error){failed(error);}finally{loading.value=false;}
}
async function selectFile(e: Event) {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw Error('Файл слишком большой (максимум 1 МиБ)');
    await serial; preview.value = parseBackup(await file.text()); previewRevision = state.value.revision; modal.value = 'import'; notice.value = '';
  } catch (error) { notice.value = describe(error); }
}
async function restore() {
  if (!preview.value || saving.value || conflict.value) return;
  saving.value = true;
  try {
    const saved = await repository.commit(preview.value, previewRevision);
    state.value = saved; issue.value = ''; conflict.value = false; modal.value = null; preview.value = null; notice.value = 'Сохранения восстановлены.'; publishRevision();
  } catch (error) { failed(error); modal.value = null; } finally { saving.value = false; }
}
async function checkRevision() {
  if (!initialized.value || loading.value || saving.value || conflict.value || issue.value) return;
  try { const fresh = await repository.load(); if (fresh.revision !== state.value.revision) failed(new ConflictError()); } catch (error) { failed(error); }
}
const updateSW = registerSW({ immediate: true, onNeedRefresh() { updateAvailable.value = true; }, onOfflineReady() { offlineReady.value = true; }, onRegisterError(error) { notice.value = 'Не удалось подготовить офлайн-копию. Проверьте соединение.'; console.error(error); } });
async function update() { await serial; if (!issue.value && !conflict.value && !animating.value && !modal.value && !saving.value) await updateSW(true); }
if (channel) channel.onmessage = e => { if (initialized.value && e.data?.revision !== state.value.revision) failed(new ConflictError()); };
onMounted(() => { void load(); addEventListener('focus', checkRevision); });
onBeforeUnmount(() => { disposed = true; channel?.close(); void repository.close(); removeEventListener('focus', checkRevision); });
const example = ['', '', '', '', '', '', 'square_single', '', '', '', '', 'square_triple', '', '', '', '', '', 'square_double', 'square_double', '', 'square_triple', '', '', '', '', 'square_double', 'square_double', '', 'square_triple', 'l_shape', '', '', 'square_double', 'square_double', '', '', '', 'l_shape', '', '', 'line', 'line', 'line', 'line'];
</script>

<template>
  <div class="app-shell" :inert="modal !== null">
    <header class="app-header">
      <button class="brand" type="button" aria-label="В главное меню" :disabled="animating" @click="home"><span class="brand-mark"><img :src="asset('icons/cat-logo.svg')" alt=""></span><span class="brand-copy"><strong>Муроблоки</strong><small>маленькие игры для отдыха</small></span></button>
      <button class="icon-button" :class="{ active: screen === 'settings' }" aria-label="Настройки" :disabled="animating" @click="openSettings"><UiIcon name="settings"/></button>
    </header>
    <aside v-if="issue" class="storage-warning" role="alert"><p>{{ issue }}</p><div v-if="candidates.length" class="recovery-choices"><button v-for="c in candidates" :key="c.label" class="action secondary" @click="chooseLegacy(c.snapshot)">{{ c.label }} · {{ c.snapshot.game?.score ?? 0 }} очков · рекорд {{ c.snapshot.best }}</button></div><div v-else class="warning-actions"><button @click="retry">{{ conflict ? 'Загрузить актуальную' : 'Повторить' }}</button><button v-if="initialized" @click="download">Экспортировать свою версию</button><template v-else><button @click="recoverRaw">Скачать исходные данные</button><button @click="modal = 'reset'">Начать без прежних данных</button></template></div></aside>
    <aside v-if="updateAvailable" class="update-notice" role="status">Доступна новая версия <button :disabled="animating || saving || !!issue" @click="update">Обновить</button></aside>
    <main class="app-content" :aria-busy="loading">
      <p v-if="loading" class="loading-state">Загружаем сохранения…</p>
      <section v-else-if="screen === 'home'" class="home-screen screen"><h1 class="hero-heading">Играй<br><em>в своём ритме</em></h1><div class="catalog">
        <button class="game-card" id="start-game" :disabled="locked" :aria-label="state.game?.status === 'active' ? 'Продолжить игру 1010!' : 'Начать игру 1010!'" @click="start"><span class="game-card-copy"><strong>1010!</strong><small v-if="state.game?.status === 'active'">Продолжить</small></span><span class="card-mini-board" aria-hidden="true"><i v-for="(_,i) in 49" :key="i" :class="example[i] ? `group-${example[i]}` : ''"/></span></button>
        <div class="game-card unavailable" aria-disabled="true"><span class="game-card-copy"><strong>2048</strong><small>скоро в игре</small></span><span class="tiles-2048" aria-hidden="true"><i>2</i><i>4</i><i>8</i><i>16</i></span></div>
        <div class="game-card unavailable" aria-disabled="true"><span class="game-card-copy"><strong>Tap match</strong><small>скоро в игре</small></span><span class="tap-art" aria-hidden="true"><i/><i/><i/><i/></span></div>
      </div></section>
      <section v-else-if="screen === 'settings'" class="settings-screen screen"><h1 class="hero-heading">Настрой <em>вайб</em></h1>
        <section class="setting-group"><h2>Тема</h2><div class="mode-row"><span>Тёмный режим</span><button class="mode-switch" role="switch" aria-label="Тёмный режим" :aria-checked="settings.mode === 'dark'" :disabled="locked" @click="changeSettings({ mode: settings.mode === 'dark' ? 'light' : 'dark' })"><span/></button></div>
          <div class="theme-grid" role="group" aria-label="Цветовая тема"><button v-for="id in themeOrder" :key="id" class="theme-option" :class="{ selected: settings.theme === id }" :data-theme-choice="id" :aria-pressed="settings.theme === id" :disabled="locked" @click="changeSettings({ theme: id })"><span class="theme-label">{{ themes[id as keyof typeof themes].name }}</span><span class="selection-check" aria-hidden="true">{{ settings.theme === id ? '✓' : '' }}</span><span class="theme-dots" aria-hidden="true"><i v-for="color in swatches(id)" :key="color" :style="{ background: color }"/></span></button></div>
        </section>
        <section class="setting-group patterns-group"><h2>Рисунок</h2><div class="pattern-panel"><div class="pattern-grid" role="group" aria-label="Рисунки на блоках"><button v-for="p in patterns" :key="p.id" class="pattern-option" :class="{ selected: p.id === settings.pattern }" :data-pattern-choice="p.id" :aria-pressed="p.id === settings.pattern" :aria-label="p.name" :title="p.name" :disabled="locked" @click="changeSettings({ pattern: p.id })"><span class="pattern-tile"><span v-if="p.icon" class="pixel-pattern" :style="{ '--stamp-url': `url('${asset(`icons/pattern-${p.icon}.svg`)}')` }"/><span v-if="p.id === settings.pattern" class="pattern-check" aria-hidden="true">✓</span></span><span class="pattern-label">{{ p.name }}</span></button></div></div></section>
        <section class="setting-group saves-group"><h2>Сохранения</h2><p class="save-description">Сохрани файл вне приложения, чтобы восстановить прогресс. Автоматической серверной копии нет.</p><div class="backup-actions"><button class="action secondary" :disabled="loading || animating || !initialized" @click="download">Экспорт сохранений</button><button class="action secondary" :disabled="locked || !!issue" @click="importInput?.click()">Импорт сохранений</button></div><input ref="importInput" type="file" accept=".json,application/json" class="file-input" aria-label="Файл сохранения" @change="selectFile"><p v-if="notice" class="save-status" role="status">{{ notice }}</p></section>
        <button class="action secondary settings-back" @click="screen = back"><UiIcon name="back"/> Вернуться</button>
      </section>
      <section v-else-if="state.game" class="game-screen screen"><div class="scoreboard"><span class="score-current">{{ state.game.score }}</span><span class="score-record"><UiIcon name="trophy"/><span>{{ state.best }}</span></span></div><GameBoard :game="state.game" :stamp="stamp" :disabled="locked" :attempt="attempt" @busy="animating = $event"/><div class="game-buttons"><button class="action secondary" :disabled="animating" @click="home"><UiIcon name="back"/> Вернуться</button><button class="action secondary" :disabled="locked || animating" @click="state.game?.status === 'active' ? modal = 'restart' : fresh()"><UiIcon name="restart"/> Заново</button></div></section>
    </main>
    <footer class="app-footer">С любовью к спокойным головоломкам ✦ <a href="https://aidanastya.ru/" target="_blank" rel="noopener noreferrer">aidanastya</a><span class="offline-ready" role="status">{{ offlineReady ? 'Готово к игре офлайн' : '' }}</span></footer>
  </div>
  <ModalDialog v-if="modal" :title="modal === 'restart' ? 'Начать заново?' : modal === 'result' ? 'Игра окончена!' : modal === 'import' ? 'Восстановить сохранения?' : modal === 'reset' ? 'Начать без прежних данных?' : 'Загрузить актуальную версию?'" :dismissible="modal !== 'result'" @close="() => { if (!saving && modal !== 'result') modal = null; }">
    <template v-if="modal === 'reset'"><p class="dialog-description">Повреждённое сохранение, рекорд и настройки будут заменены пустыми данными. Перед этим скачайте исходные данные для возможного восстановления.</p><div class="dialog-actions"><button class="action secondary" @click="modal = null">Отмена</button><button class="action primary" :disabled="loading" @click="resetDamaged">Начать заново</button></div></template>
    <template v-else-if="modal === 'restart'"><p class="dialog-description">Текущая партия сбросится. Рекорд останется.</p><div class="dialog-actions"><button class="action secondary" @click="modal = null">Вернуться</button><button class="action primary" @click="fresh">Заново</button></div></template>
    <template v-else-if="modal === 'result' && state.game"><div class="fireworks" aria-hidden="true"><i/><i/><i/></div><p class="dialog-description">{{ state.game.score === state.best && state.best > 0 ? 'Новый рекорд ✦' : 'Играй в своём ритме ♡' }}</p><div class="result-score"><strong>{{ state.game.score }}</strong><span class="result-best"><UiIcon name="trophy"/><strong>{{ state.best }}</strong></span></div><div class="result-lines">{{ state.game.clearedLines }} линий очищено</div><div class="dialog-actions"><button class="action secondary" @click="home">В меню</button><button class="action primary" :disabled="locked" @click="fresh">Играть снова</button></div></template>
    <template v-else-if="modal === 'import' && preview"><p class="dialog-description">{{ new Date(preview.date).toLocaleString('ru-RU') }}</p><p class="backup-preview">1010! · {{ preview.game ? (preview.game.status === 'active' ? 'Активная партия' : 'Завершённая партия') : 'Без партии' }}<br>Счёт: {{ preview.game?.score ?? 0 }} · Рекорд: {{ preview.best }}</p><p class="dialog-description">Партия, настройки и рекорд будут полностью заменены данными файла. Даже если текущий рекорд выше.</p><div class="dialog-actions"><button class="action secondary" :disabled="saving" @click="modal = null">Отмена</button><button class="action primary" :disabled="saving || conflict" @click="restore">{{ saving ? 'Восстанавливаем…' : 'Восстановить' }}</button></div></template>
    <template v-else><p class="dialog-description">Несохранённые изменения этой вкладки будут заменены. Сначала можно отменить и экспортировать свою версию.</p><div class="dialog-actions"><button class="action secondary" @click="modal = null">Отмена</button><button class="action primary" @click="load">Загрузить</button></div></template>
  </ModalDialog>
</template>
