import { openDB, type IDBPDatabase } from 'idb';
import { validateSave } from '../game/logic';
import { gameModules } from '../game/registry';
import { GAME_IDS, type GameId, type GameEntries } from '../types';
import { themes, patterns } from '../design/themes.js';
import type { Backup, Game, Settings, Snapshot } from '../types';

export const DB_NAME = 'muroblocks-v1';
export const GAME_KEY = 'game:block-puzzle';
export const SETTINGS_KEY = 'app:settings';
export const defaults: Settings = { theme: 'pastel', mode: 'light', pattern: 'none' };
const copy = <T>(value: T): T => structuredClone(value);
export class ConflictError extends Error { constructor() { super('В другой вкладке появились новые данные. Загрузите актуальную версию или экспортируйте свою.'); } }
export class LegacyConflictError extends Error {
  constructor(public candidates: { label: string; snapshot: Snapshot }[]) { super('Найдены разные прежние копии прогресса. Выберите, какую восстановить.'); }
}
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw Error('Некорректные настройки');
  const s = value as Record<string, unknown>;
  const theme = s.theme === 'dark' ? 'pastel' : s.theme;
  const mode = s.theme === 'dark' ? 'dark' : s.mode ?? 'light';
  const pattern = s.pattern === 'cat' ? 'none' : s.pattern ?? 'none';
  if (typeof theme !== 'string' || !Object.hasOwn(themes, theme) || !['light', 'dark'].includes(String(mode)) || !patterns.some(p => p.id === pattern)) throw Error('Неизвестная тема, режим или рисунок');
  return { theme, mode: mode as Settings['mode'], pattern: pattern as string };
}
export function emptySnapshot(): Snapshot {
  return { games: { 'block-puzzle': { save: null, best: 0 }, '2048': { save: null, best: 0 } }, settings: copy(defaults), revision: 0 };
}
function validEntry(id: GameId, entry: GameEntries[GameId]): void {
  if (!entry || !Number.isSafeInteger(entry.best) || entry.best < 0 || entry.save !== null && (!gameModules[id].validateSave(entry.save) || entry.best < entry.save.score)) throw Error('Повреждённая партия или рекорд ' + gameModules[id].name);
  if (id === 'block-puzzle' && entry.save && (entry.save as Game).best !== entry.best) throw Error('Рекорд не соответствует партии 1010!');
}
function valid(snapshot: Snapshot, allowDamaged = false): void {
  parseSettings(snapshot.settings);
  if (!snapshot.games || Object.keys(snapshot.games).length !== GAME_IDS.length || !GAME_IDS.every(id => Object.hasOwn(snapshot.games, id))) throw Error('Некорректный набор игр');
  if (!allowDamaged && Object.keys(snapshot.damaged ?? {}).length) throw Error('Есть повреждённые данные. Скачайте исходные данные перед восстановлением.');
  for (const id of GAME_IDS) if (!snapshot.damaged?.[id]) validEntry(id, snapshot.games[id]);
}
function canonical(snapshot: Snapshot): Snapshot {
  return copy({ games: snapshot.games, settings: snapshot.settings, revision: snapshot.revision, ...(Object.keys(snapshot.damaged ?? {}).length ? { damaged: snapshot.damaged } : {}) });
}
function legacy(game: unknown, settings: unknown): Snapshot {
  if (game !== undefined && game !== null && !validateSave(game)) throw Error('Прежнее сохранение повреждено. Исходные данные не изменены.');
  const g = game as Game | null | undefined;
  return { ...emptySnapshot(), games: { 'block-puzzle': { save: g ?? null, best: g?.best ?? 0 }, '2048': { save: null, best: 0 } }, settings: settings == null ? copy(defaults) : parseSettings(settings) };
}
export function parseBackup(json: string): Snapshot & { date: string; present: GameId[] } {
  if (json.length > 1024 * 1024) throw Error('Файл слишком большой (максимум 1 МиБ)');
  const d = JSON.parse(json);
  let snapshot: Snapshot;
  let date: string;
  let present: GameId[];
  if (d?.format === 'muroblocks-backup' && d.version === 1) {
    snapshot = legacy(d.game, d.settings); date = d.date; present = ['block-puzzle'];
  } else if (d?.appId === 'muroblocks' && d.exportVersion === 2) {
    if (!d.games || typeof d.games !== 'object' || !Object.keys(d.games).length || Object.keys(d.games).some(id => !GAME_IDS.includes(id as GameId))) throw Error('Файл содержит неподдерживаемые игры');
    snapshot = emptySnapshot(); snapshot.settings = parseSettings(d.settings); present = Object.keys(d.games) as GameId[];
    for (const id of present) {
      const g = d.games[id];
      if (g?.saveVersion !== 1 || !g.records || !Object.hasOwn(g, 'save')) throw Error('Неподдерживаемая версия сохранения');
      Object.assign(snapshot.games, { [id]: { save: g.save, best: g.records.best } });
    }
    date = d.exportedAt;
  } else throw Error('Неизвестное приложение или версия файла');
  valid(snapshot);
  if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) throw Error('В файле отсутствует корректная дата');
  return { ...canonical(snapshot), date, present };
}
export function exportSnapshot(snapshot: Snapshot): string {
  valid(snapshot);
  const games = Object.fromEntries(GAME_IDS.map(id => [id, { saveVersion: 1, save: snapshot.games[id].save, records: { best: snapshot.games[id].best } }])) as Backup['games'];
  const data: Backup = { appId: 'muroblocks', exportVersion: 2, exportedAt: new Date().toISOString(), settings: snapshot.settings, games };
  return JSON.stringify(data, null, 2);
}

export function createRepository(name = DB_NAME, options: { notify?: (message: string) => void; beforeCommit?: () => void } = {}) {
  let connection: Promise<IDBPDatabase> | undefined;
  function open(): Promise<IDBPDatabase> {
    if (!connection) {
      let cancelled = false;
      connection = new Promise<IDBPDatabase>((resolve, reject) => {
        openDB(name, 2, {
          upgrade(db) { for (const store of ['items', 'records', 'metadata']) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store); },
          blocked() { cancelled = true; reject(Error('Закройте другие вкладки со старой версией игры и повторите загрузку.')); },
          blocking() { connection?.then(db => db.close()); connection = undefined; options.notify?.('База обновлена другой вкладкой. Загрузите актуальные данные.'); },
          terminated() { connection = undefined; options.notify?.('Соединение с хранилищем прервано. Экспортируйте текущие данные.'); },
        }).then(db => { if (cancelled) db.close(); else resolve(db); }, reject);
      }).catch(error => { connection = undefined; throw error; });
    }
    return connection!;
  }
  async function load(): Promise<Snapshot> {
    // Read legacy localStorage before entering an IndexedDB transaction.
    let fallback: Snapshot | undefined;
    let fallbackError: unknown;
    try {
      const g = globalThis.localStorage?.getItem(name + ':' + GAME_KEY);
      const s = globalThis.localStorage?.getItem(name + ':' + SETTINGS_KEY);
      if (g || s) fallback = legacy(g ? JSON.parse(g) : null, s ? JSON.parse(s) : null);
    } catch (error) { fallbackError = error; }
    const db = await open();
    const tx = db.transaction(['items', 'records', 'metadata'], 'readwrite');
    try {
      const revision = await tx.objectStore('metadata').get('revision');
      const oldGame = await tx.objectStore('items').get(GAME_KEY);
      const oldSettings = await tx.objectStore('items').get(SETTINGS_KEY);
      if (revision === undefined) {
        const existing = legacy(oldGame, oldSettings);
        if (fallbackError) throw Error('Не удалось прочитать прежний localStorage. Экспортируйте данные старой версии перед миграцией.');
        if (fallback && (oldGame || oldSettings) && JSON.stringify({ ...existing, revision: 0 }) !== JSON.stringify({ ...fallback, revision: 0 })) throw new LegacyConflictError([{ label: 'Копия IndexedDB', snapshot: existing }, { label: 'Копия localStorage', snapshot: fallback }]);
        const chosen = oldGame || oldSettings ? existing : fallback ?? existing;
        await put(tx, chosen, 0);
        await tx.done;
        return copy(chosen);
      }
      if (!Number.isSafeInteger(revision) || revision < 0) throw Error('Повреждена ревизия хранилища. Исходные данные не изменены.');
      const snapshot = emptySnapshot(); snapshot.revision = revision; snapshot.settings = oldSettings ? parseSettings(oldSettings) : copy(defaults);
      for (const id of GAME_IDS) {
        const raw = id === 'block-puzzle' ? oldGame : await tx.objectStore('items').get('game:' + id);
        const record = await tx.objectStore('records').get(id);
        const best = record === undefined ? 0 : record;
        const save = raw == null ? null : id === 'block-puzzle' ? { ...raw, best } : raw;
        const entry = { save, best };
        try { validEntry(id, entry); Object.assign(snapshot.games, { [id]: entry }); }
        catch {
          snapshot.damaged ??= {}; snapshot.damaged[id] = 'Не удалось прочитать партию или рекорд ' + gameModules[id].name + '. Исходные данные сохранены.';
          Object.assign(snapshot.games, { [id]: { save: null, best: Number.isSafeInteger(best) && best >= 0 ? best : 0 } });
        }
      }
      valid(snapshot, true); await tx.done; return canonical(snapshot);
    } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
  }
  async function put(tx: any, value: Snapshot, revision: number) {
    for (const id of GAME_IDS) {
      if (value.damaged?.[id]) continue; // Preserve damaged originals while the other game remains usable.
      const entry = value.games[id];
      const game = entry.save ? { ...entry.save } : null;
      if (id === 'block-puzzle' && game) delete (game as Partial<Game>).best;
      await tx.objectStore('items').put(game, 'game:' + id);
      await tx.objectStore('records').put(entry.best, id);
    }
    await tx.objectStore('items').put(value.settings, SETTINGS_KEY);
    await tx.objectStore('metadata').put(revision, 'revision');
  }
  async function commit(snapshot: Snapshot, expected: number | undefined): Promise<Snapshot> {
    const value = canonical(snapshot); valid(value, true);
    const db = await open(); const tx = db.transaction(['items', 'records', 'metadata'], 'readwrite');
    try {
      const actual = await tx.objectStore('metadata').get('revision');
      if (actual !== expected) throw new ConflictError();
      const revision = (actual ?? -1) + 1;
      await put(tx, value, revision);
      options.beforeCommit?.();
      await tx.done;
      return { ...value, revision };
    } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
  }
  async function close() { if (connection) (await connection).close(); connection = undefined; }
  async function rawRecovery(): Promise<string> {
    const db = await open(); const tx = db.transaction(['items', 'records', 'metadata']);
    const data = { appId: 'muroblocks-raw-recovery', exportedAt: new Date().toISOString(), items: await tx.objectStore('items').getAll(), itemKeys: await tx.objectStore('items').getAllKeys(), records: await tx.objectStore('records').getAll(), recordKeys: await tx.objectStore('records').getAllKeys(), revision: await tx.objectStore('metadata').get('revision') };
    await tx.done; return JSON.stringify(data, null, 2);
  }
  async function reset(): Promise<Snapshot> {
    const db = await open(); const revision = await db.get('metadata', 'revision');
    return commit(emptySnapshot(), revision);
  }
  return { load, commit, close, rawRecovery, reset };
}
