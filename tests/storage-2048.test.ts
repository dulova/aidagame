import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, expect, test } from 'vitest';
import { createRepository, emptySnapshot, exportSnapshot, parseBackup, GAME_KEY } from '../src/storage/repository';
import { createInitialState as bp } from '../src/game/logic';
import { applyMove, createInitialState as numbers } from '../src/games/2048/logic';
import { createRepository as oldRepository } from './fixtures/v1.2/repository';
import { contrast, tileColors } from '../src/games/2048/palette';
import { themeOrder } from '../src/design/themes.js';

beforeEach(()=>{globalThis.indexedDB=new IDBFactory();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});});
const both=()=>{const s=emptySnapshot();s.games['block-puzzle']={save:bp(()=>.5,125),best:125};s.games['2048']={save:applyMove(numbers(()=>0),'left',()=>0).state,best:96};return s;};

test('both parties and records persist independently without changing the physical schema',async()=>{
  const repo=createRepository('both'),initial=await repo.load();const saved=await repo.commit(both(),initial.revision);await repo.close();
  const reopened=createRepository('both');expect(await reopened.load()).toEqual(saved);
  const db=await openDB('both',2);expect(db.version).toBe(2);expect(await db.get('records','2048')).toBe(96);expect(await db.get('records','block-puzzle')).toBe(125);expect(await db.get('items',GAME_KEY)).not.toHaveProperty('best');db.close();await reopened.close();
});
test('migration of a real 1.2 snapshot never invents a 2048 party',async()=>{
  const old=oldRepository('v12');const initial=await old.load();const original={...initial,game:bp(()=>.5,75),best:75};await old.commit(original,initial.revision);await old.close();
  const repo=createRepository('v12');const loaded=await repo.load();expect(loaded.games['block-puzzle']).toEqual({save:original.game,best:75});expect(loaded.games['2048']).toEqual({save:null,best:0});expect(await repo.load()).toEqual(loaded);await repo.close();
});
test('rolling back to the unchanged 1.2 repository can play/save 1010 and preserves hidden 2048 data for forward return',async()=>{
  const repo=createRepository('rollback');const initial=await repo.load();const saved=await repo.commit(both(),initial.revision);await repo.close();
  const old=oldRepository('rollback');const loaded=await old.load();expect(loaded.game).toEqual(saved.games['block-puzzle'].save);expect(loaded.best).toBe(125);
  await old.commit({...loaded,settings:{...loaded.settings,pattern:'heart'}},loaded.revision);await old.close();
  const restored=createRepository('rollback');const forward=await restored.load();expect(forward.games).toEqual(saved.games);expect(forward.settings.pattern).toBe('heart');expect(forward.revision).toBe(saved.revision+1);await restored.close();
});
test('full two-game JSON round-trip and lower records are restored exactly',async()=>{
  const repo=createRepository('json'),initial=await repo.load();const before=await repo.commit(both(),initial.revision);const file=JSON.parse(exportSnapshot(before));file.games['2048'].records.best=4;file.games['block-puzzle'].records.best=10;file.games['block-puzzle'].save.best=10;
  const parsed=parseBackup(JSON.stringify(file));const saved=await repo.commit(parsed,before.revision);expect(saved.games['2048'].best).toBe(4);expect(saved.games['block-puzzle'].best).toBe(10);expect(await repo.load()).toEqual(saved);await repo.close();
});
test('old v1/v2 files explicitly restore absent 2048 as null/zero only after commit',async()=>{
  const repo=createRepository('legacy-import'),initial=await repo.load(),saved=await repo.commit(both(),initial.revision);
  const old=JSON.parse(exportSnapshot(saved));delete old.games['2048'];const parsed=parseBackup(JSON.stringify(old));
  expect(parsed.present).toEqual(['block-puzzle']);expect(parsed.games['2048']).toEqual({save:null,best:0});expect(await repo.load()).toEqual(saved);
  const v1=parseBackup(JSON.stringify({format:'muroblocks-backup',version:1,date:'2026-10-30T12:00:00Z',game:saved.games['block-puzzle'].save,settings:saved.settings}));expect(v1.games['2048']).toEqual({save:null,best:0});
  await repo.commit(parsed,saved.revision);expect((await repo.load()).games['2048']).toEqual({save:null,best:0});await repo.close();
});
test('invalid data in either game rejects the whole file; no partial restore',()=>{
  const good=JSON.parse(exportSnapshot(both()));
  for(const bad of [{...good.games['2048'],saveVersion:2},{...good.games['2048'],save:{...good.games['2048'].save,board:Array(16).fill(0)}},{...good.games['2048'],records:{best:0}}])expect(()=>parseBackup(JSON.stringify({...good,games:{...good.games,'2048':bad}}))).toThrow();
});
test('aborting a full import rolls back both games, both records, settings and revision',async()=>{
  let fail=false;const repo=createRepository('atomic',{beforeCommit(){if(fail)throw Error('disk-full');}}),initial=await repo.load();const before=await repo.commit(both(),initial.revision);const replacement=emptySnapshot();replacement.settings.mode='dark';fail=true;
  await expect(repo.commit(replacement,before.revision)).rejects.toThrow('disk-full');expect(await repo.load()).toEqual(before);await repo.close();
});
test('a damaged 2048 party does not block 1010 or get overwritten by its next commit',async()=>{
  const repo=createRepository('damage'),initial=await repo.load();await repo.commit(both(),initial.revision);const db=await openDB('damage',2),bad={version:1,board:[999]};await db.put('items',bad,'game:2048');
  const loaded=await repo.load();expect(loaded.damaged?.['2048']).toContain('2048');expect(loaded.games['block-puzzle'].best).toBe(125);expect(()=>exportSnapshot(loaded)).toThrow('повреждённые');
  const saved=await repo.commit({...loaded,settings:{...loaded.settings,pattern:'snow'}},loaded.revision);expect(await db.get('items','game:2048')).toEqual(bad);expect(JSON.parse(await repo.rawRecovery()).items).toContainEqual(bad);
  const recovered={...saved,damaged:{}};await repo.commit(recovered,saved.revision);const after=await repo.load();expect(after.damaged).toBeUndefined();expect(after.games['2048']).toEqual({save:null,best:96});expect(after.games['block-puzzle']).toEqual(loaded.games['block-puzzle']);db.close();await repo.close();
});
test('every theme/mode/value has legible digits and stable distinct low-value colors',()=>{
  for(const theme of themeOrder)for(const mode of ['light','dark'] as const){const colors=[];for(let n=1;n<=52;n++){const pair=tileColors(2**n,theme,mode);expect(contrast(pair.background,pair.color)).toBeGreaterThanOrEqual(4.5);if(n<=11)colors.push(pair.background);}expect(new Set(colors).size).toBe(11);}
});
