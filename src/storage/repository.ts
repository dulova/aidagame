import { openDB, type IDBPDatabase } from 'idb';
import { validateSave } from '../game/logic';
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
function valid(snapshot: Snapshot): void {
  parseSettings(snapshot.settings);
  if (!Number.isSafeInteger(snapshot.best) || snapshot.best < 0 || snapshot.game !== null && (!validateSave(snapshot.game) || snapshot.best < snapshot.game.score || snapshot.game.best !== snapshot.best)) throw Error('Повреждённые игровые данные или рекорд');
}
function legacy(game: unknown, settings: unknown): Snapshot {
  if (game !== undefined && game !== null && !validateSave(game)) throw Error('Прежнее сохранение повреждено. Исходные данные не изменены.');
  const g = game as Game | null | undefined;
  return { game: g ?? null, settings: settings == null ? copy(defaults) : parseSettings(settings), best: g?.best ?? 0, revision: 0 };
}
export function parseBackup(json: string): Snapshot & { date: string } {
  if (json.length > 1024 * 1024) throw Error('Файл слишком большой (максимум 1 МиБ)');
  const d = JSON.parse(json);
  let snapshot: Snapshot;
  let date: string;
  if (d?.format === 'muroblocks-backup' && d.version === 1) {
    snapshot = legacy(d.game, d.settings); date = d.date;
  } else if (d?.appId === 'muroblocks' && d.exportVersion === 2) {
    if (!d.games || Object.keys(d.games).length !== 1 || !Object.hasOwn(d.games, 'block-puzzle')) throw Error('Файл содержит неподдерживаемые игры');
    const g = d.games['block-puzzle'];
    if (g?.saveVersion !== 1 || !g.records || !Object.hasOwn(g, 'save')) throw Error('Неподдерживаемая версия сохранения');
    snapshot = { game: g.save, settings: parseSettings(d.settings), best: g.records.best, revision: 0 }; date = d.exportedAt;
  } else throw Error('Неизвестное приложение или версия файла');
  valid(snapshot);
  if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) throw Error('В файле отсутствует корректная дата');
  return { ...copy(snapshot), date };
}
export function exportSnapshot(snapshot: Snapshot): string {
  valid(snapshot);
  const data: Backup = { appId: 'muroblocks', exportVersion: 2, exportedAt: new Date().toISOString(), settings: snapshot.settings,
    games: { 'block-puzzle': { saveVersion: 1, save: snapshot.game, records: { best: snapshot.best } } } };
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
      const best = (await tx.objectStore('records').get('block-puzzle')) ?? 0;
      const game = oldGame ? { ...oldGame, best } : null;
      const snapshot = { game, settings: oldSettings ? parseSettings(oldSettings) : copy(defaults), best, revision };
      valid(snapshot); await tx.done; return copy(snapshot);
    } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
  }
  async function put(tx: any, value: Snapshot, revision: number) {
    const game = value.game ? { ...value.game } as Partial<Game> : null;
    if (game) delete game.best; // The durable record is independent of the current game.
    await tx.objectStore('items').put(game, GAME_KEY);
    await tx.objectStore('items').put(value.settings, SETTINGS_KEY);
    await tx.objectStore('records').put(value.best, 'block-puzzle');
    await tx.objectStore('metadata').put(revision, 'revision');
  }
  async function commit(snapshot: Snapshot, expected: number | undefined): Promise<Snapshot> {
    const value = copy(snapshot); valid(value);
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
    const data = { appId: 'muroblocks-raw-recovery', exportedAt: new Date().toISOString(), items: await tx.objectStore('items').getAll(), itemKeys: await tx.objectStore('items').getAllKeys(), records: await tx.objectStore('records').getAll(), revision: await tx.objectStore('metadata').get('revision') };
    await tx.done; return JSON.stringify(data, null, 2);
  }
  async function reset(): Promise<Snapshot> {
    const db = await open(); const revision = await db.get('metadata', 'revision');
    return commit({ game: null, best: 0, settings: copy(defaults), revision: 0 }, revision);
  }
  return { load, commit, close, rawRecovery, reset };
}
