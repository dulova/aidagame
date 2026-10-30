import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, expect, test } from 'vitest';
import { createInitialState } from '../src/game/logic';
import { ConflictError, LegacyConflictError, createRepository, defaults, exportSnapshot, parseBackup, emptySnapshot, GAME_KEY, SETTINGS_KEY } from '../src/storage/repository';
import type { Snapshot } from '../src/types';

let memory: Map<string,string>;
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory(); memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string,v: string) => memory.set(k,v) } });
});
const state = (best = 0): Snapshot => ({ ...emptySnapshot(), games: { 'block-puzzle': { save: createInitialState(() => .5, best), best }, '2048': { save: null, best: 0 } } });

test('migrates IndexedDB v1 without changing game, groups, settings or record; repeated load is stable', async () => {
  const old = await openDB('migration', 1, { upgrade(db) { db.createObjectStore('items'); } });
  const snapshot = state(123); snapshot.settings = { theme: 'winter', mode: 'dark', pattern: 'snow' };
  await old.put('items', snapshot.games['block-puzzle'].save, GAME_KEY); await old.put('items', snapshot.settings, SETTINGS_KEY); old.close();
  const repo = createRepository('migration');
  expect(await repo.load()).toEqual(snapshot); expect(await repo.load()).toEqual(snapshot);
  const db = await openDB('migration', 2);
  expect(await db.get('records','block-puzzle')).toBe(123);
  expect(await db.get('items',GAME_KEY)).not.toHaveProperty('best');
  db.close(); await repo.close();
});
test('migrates localStorage fallback and imports legacy JSON including its record', async () => {
  const snapshot = state(99);
  memory.set('fallback:'+GAME_KEY,JSON.stringify(snapshot.games['block-puzzle'].save)); memory.set('fallback:'+SETTINGS_KEY,JSON.stringify(snapshot.settings));
  const repo = createRepository('fallback'); expect(await repo.load()).toEqual(snapshot);
  const file = JSON.stringify({ format: 'muroblocks-backup', version: 1, date: '2026-10-29T12:00:00Z', game: snapshot.games['block-puzzle'].save, settings: snapshot.settings });
  expect(parseBackup(file).games['block-puzzle'].best).toBe(99); await repo.close();
});
test('never guesses which differing legacy copy is newer', async () => {
  const old = await openDB('ambiguous',1,{upgrade(db){db.createObjectStore('items');}});
  await old.put('items',state(50).games['block-puzzle'].save,GAME_KEY); old.close();
  memory.set('ambiguous:'+GAME_KEY,JSON.stringify(state(20).games['block-puzzle'].save));
  const repo=createRepository('ambiguous'); await expect(repo.load()).rejects.toBeInstanceOf(LegacyConflictError);
  await repo.commit(state(20),undefined); expect((await repo.load()).games['block-puzzle'].best).toBe(20); await repo.close();
});
test('atomically detects stale revisions even without BroadcastChannel', async () => {
  const a=createRepository('tabs'), b=createRepository('tabs'); const first=await a.load(); const stale=await b.load();
  const saved=await a.commit({...first,settings:{...defaults,mode:'dark'}},first.revision);
  await expect(b.commit({...stale,settings:{...defaults,theme:'winter'}},stale.revision)).rejects.toBeInstanceOf(ConflictError);
  expect(await b.load()).toEqual(saved); await a.close(); await b.close();
});
test('storage failure rejects the operation and rolls back game, settings, records and revision', async () => {
  let fail=false;
  const repo=createRepository('abort',{beforeCommit(){if(fail)throw new Error('Simulated disk failure');}});
  const before=await repo.load(); fail=true;
  await expect(repo.commit({...state(77),settings:{...defaults,mode:'dark'}},before.revision)).rejects.toThrow('Simulated disk failure');
  expect(await repo.load()).toEqual(before); await repo.close();
});
test('full import can restore a lower record, survives restart, and has no accumulated counters', async () => {
  const repo=createRepository('restore'); const first=await repo.load();
  const high=await repo.commit(state(200),first.revision);
  const imported=parseBackup(exportSnapshot(state(15)));
  const low=await repo.commit(imported,high.revision);
  expect(low.games['block-puzzle'].best).toBe(15); await repo.close(); const reopened=createRepository('restore');
  expect((await reopened.load()).games['block-puzzle'].best).toBe(15); expect(exportSnapshot(low)).not.toContain('totalGames'); await reopened.close();
});
test('new party retains independent record and current-party statistics survive round-trip', async () => {
  const repo=createRepository('records'); const initial=await repo.load();
  const current=state(90); current.games['block-puzzle'].save!.turns=6; current.games['block-puzzle'].save!.clearedLines=2;
  const saved=await repo.commit(current,initial.revision); const restored=parseBackup(exportSnapshot(saved));
  expect(restored.games['block-puzzle'].save!.turns).toBe(6); expect(restored.games['block-puzzle'].save!.clearedLines).toBe(2);
  const fresh=await repo.commit({...saved,games:{...saved.games,'block-puzzle':{save:createInitialState(()=>.5,saved.games['block-puzzle'].best),best:saved.games['block-puzzle'].best}}},saved.revision);
  expect(fresh.games['block-puzzle'].best).toBe(90); expect(fresh.games['block-puzzle'].save!.turns).toBe(0); await repo.close();
});
test('rejects malformed, future, foreign, invalid settings, unsupported games and mismatching records before write', () => {
  for(const file of ['{', 'null', JSON.stringify({appId:'other',exportVersion:2}), JSON.stringify({appId:'muroblocks',exportVersion:99})]) expect(()=>parseBackup(file)).toThrow();
  const good=JSON.parse(exportSnapshot(state(20)));
  expect(()=>parseBackup(JSON.stringify({...good,settings:{...defaults,theme:'made-up'}}))).toThrow();
  expect(()=>parseBackup(JSON.stringify({...good,games:{...good.games,fake:{}}}))).toThrow();
  for (const save of [false, 0, '', [], {}]) expect(()=>parseBackup(JSON.stringify({...good,games:{'block-puzzle':{...good.games['block-puzzle'],save}}}))).toThrow();
  good.games['block-puzzle'].records.best=0; expect(()=>parseBackup(JSON.stringify(good))).toThrow();
});
test('two simultaneous writers cannot both commit the same expected revision', async () => {
  const a=createRepository('race'),b=createRepository('race');const first=await a.load(); await b.load();
  const results=await Promise.allSettled([a.commit(state(10),first.revision),b.commit(state(20),first.revision)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  await a.close();await b.close();
});

test('damaged legacy data stays intact until an explicit reset; raw recovery remains downloadable', async () => {
  const old=await openDB('damaged',1,{upgrade(db){db.createObjectStore('items');}});
  await old.put('items',{version:1,board:['bad'],best:75},GAME_KEY);old.close();
  const repo=createRepository('damaged');await expect(repo.load()).rejects.toThrow('повреждено');
  expect(JSON.parse(await repo.rawRecovery()).items[0].best).toBe(75);
  await repo.reset();expect(await repo.load()).toEqual(emptySnapshot());await repo.close();
});
test('an old open connection reports a blocked migration; retry works after closing it', async () => {
  const old=await openDB('blocked',1,{upgrade(db){db.createObjectStore('items');}});
  const repo=createRepository('blocked');await expect(repo.load()).rejects.toThrow('Закройте');old.close();
  await new Promise(resolve=>setTimeout(resolve,10));expect((await repo.load()).revision).toBe(0);await repo.close();
});
