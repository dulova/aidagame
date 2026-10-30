import { test, expect } from '@playwright/test';
import { createInitialState as bp } from '../../src/game/logic';
import { canMove, type State2048 } from '../../src/games/2048/logic';

const settings={theme:'pastel',mode:'light',pattern:'paw'};
const numberGame=(board=[2,2,4,0,...Array(12).fill(0)],score=0):State2048=>({version:1,status:canMove(board)?'active':'completed',board,score,moves:0});
function backup(game=numberGame(),best=96){const puzzle=bp(()=>0,93);puzzle.score=7;return{appId:'muroblocks',exportVersion:2,exportedAt:'2026-10-30T12:00:00Z',settings,games:{'block-puzzle':{saveVersion:1,save:puzzle,records:{best:93}},'2048':{saveVersion:1,save:game,records:{best}}}};}
async function openSettings(page:any){await page.getByRole('button',{name:'Настройки',exact:true}).click();await expect(page.getByRole('heading',{name:'Сохранения',exact:true})).toBeVisible();}
async function file(page:any,value:unknown){await page.locator('input[type=file]').setInputFiles({name:'all-games.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});}
async function restore(page:any,value:unknown){await file(page,value);await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Восстановить',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
async function setup(page:any,value=backup()){
  await page.addInitScript(()=>{Math.random=()=>0;});await page.goto('./');await openSettings(page);await restore(page,value);await page.locator('.settings-back').click();await page.locator('#start-2048').click();await expect(page.locator('.numbers-cell')).toHaveCount(16);
}
async function stored(page:any){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('muroblocks-v1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const result:Record<string,any>={};for(const[store,key]of [['items','game:2048'],['items','game:block-puzzle'],['records','2048'],['records','block-puzzle'],['metadata','revision']])result[store+':'+key]=await new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return result;});}
async function idle(page:any){await expect(page.locator('.number-tile.merging,.number-tile.spawning')).toHaveCount(0);await expect(page.getByRole('button',{name:'Настройки',exact:true})).toBeEnabled();}
async function exportFile(page:any){const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт сохранений',exact:true}).click();const download=await promise;const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString());}

test('2048 is an independent numeric game; every 1010 pattern stays out of its tiles and survives switching',async({page})=>{
  await setup(page);await expect(page.locator('.number-tile')).toHaveCount(3);await expect(page.locator('.numbers-board .cell-stamp,.numbers-board .pixel-pattern')).toHaveCount(0);
  const before=await stored(page);
  for(const pattern of ['none','paw','snow','heart','leaf','pumpkin']){await openSettings(page);await expect(page.getByRole('heading',{name:'Рисунок блоков 1010!',exact:true})).toBeVisible();await page.locator(`[data-pattern-choice=${pattern}]`).click();await page.locator('.settings-back').click();await expect(page.locator('.number-tile')).toHaveCount(3);await expect(page.locator('.numbers-board .cell-stamp,.numbers-board .pixel-pattern')).toHaveCount(0);}
  await page.locator('.game-buttons').getByRole('button',{name:'Вернуться',exact:true}).click();await page.locator('#start-game').click();await expect(page.locator('.board-cell')).toHaveCount(100);await expect(page.locator('.score-current')).toHaveText('7');
  expect((await stored(page))['items:game:2048']).toEqual(before['items:game:2048']);
  await openSettings(page);await expect(page.locator('[data-pattern-choice=pumpkin]')).toHaveAttribute('aria-pressed','true');
});

test('keyboard moves merge once, animate real tiles, ignore repeat and retain the static 16-cell background',async({page})=>{
  await setup(page);const before=await page.locator('.numbers-cell').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  await page.evaluate(()=>{(window as any).phases=[];new MutationObserver(()=>{(window as any).phases.push({merging:!!document.querySelector('.number-tile.merging'),spawning:!!document.querySelector('.number-tile.spawning')});}).observe(document.querySelector('.numbers-board')!,{subtree:true,childList:true,attributes:true});});
  await page.keyboard.down('ArrowLeft');await expect(page.locator('.score-current')).toHaveText('4');await idle(page);
  expect((await stored(page))['items:game:2048'].board.slice(0,4)).toEqual([4,4,2,0]);
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(160);expect((await stored(page))['items:game:2048'].moves).toBe(1);await page.keyboard.up('ArrowLeft');
  const phases=await page.evaluate(()=>(window as any).phases);expect(phases.some((p:any)=>p.merging)).toBe(true);expect(phases.findIndex((p:any)=>p.spawning)).toBeGreaterThan(phases.findIndex((p:any)=>p.merging));
  expect(await page.locator('.numbers-cell').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()))).toEqual(before);
  await page.keyboard.press('ArrowLeft');await expect(page.locator('.score-current')).toHaveText('12');await idle(page);expect((await stored(page))['items:game:2048'].moves).toBe(2);
  await page.reload();await page.locator('#start-2048').click();await expect(page.locator('.score-current')).toHaveText('12');await expect(page.locator('.score-record')).toContainText('96');
});

test('no-op and off-screen/modal keyboard commands never modify the numeric party',async({page})=>{
  await setup(page,backup(numberGame([2,4,2,4,...Array(12).fill(0)])));const before=await stored(page);await page.keyboard.press('ArrowLeft');await page.waitForTimeout(100);expect(await stored(page)).toEqual(before);
  await page.getByRole('button',{name:'Заново',exact:true}).click();await page.keyboard.press('ArrowRight');expect(await stored(page)).toEqual(before);await page.getByRole('dialog').getByRole('button',{name:'Вернуться',exact:true}).click();
  await openSettings(page);await page.keyboard.press('ArrowDown');expect(await stored(page)).toEqual(before);await page.locator('.settings-back').click();
  await page.locator('.game-buttons').getByRole('button',{name:'Вернуться',exact:true}).click();await page.keyboard.press('ArrowUp');expect(await stored(page)).toEqual(before);
  await page.locator('#start-game').click();await page.keyboard.press('ArrowRight');expect(await stored(page)).toEqual(before);
});

test('full restore previews both games, warns about old files, cancels safely and resets missing 2048 only on confirmation',async({page})=>{
  await setup(page);const before=await stored(page);await openSettings(page);const all=await exportFile(page);expect(Object.keys(all.games).sort()).toEqual(['2048','block-puzzle']);
  const old=backup();delete (old.games as any)['2048'];await file(page,old);await expect(page.getByRole('dialog')).toContainText('Текущие партии и рекорды этих игр будут сброшены');await expect(page.locator('.import-warning')).toContainText('2048');await page.getByRole('button',{name:'Отмена',exact:true}).click();expect(await stored(page)).toEqual(before);
  const invalid=backup();invalid.games['2048'].save.board=[999];await file(page,invalid);await expect(page.getByRole('dialog')).toHaveCount(0);expect(await stored(page)).toEqual(before);
  await restore(page,old);expect((await stored(page))['items:game:2048']).toBeNull();expect((await stored(page))['records:2048']).toBe(0);expect((await stored(page))['items:game:block-puzzle']).toEqual(before['items:game:block-puzzle']);
  await page.locator('.settings-back').click();await page.locator('#start-2048').click();await expect(page.locator('.number-tile')).toHaveCount(2);await expect(page.locator('.score-current')).toHaveText('0');
});

test('reduced motion unlocks input and completion results contain no 1010 line count or 2048 victory popup',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await setup(page,backup(numberGame([1024,1024,0,0,...Array(12).fill(0)]),4096));await page.keyboard.press('ArrowLeft');await expect(page.locator('.score-current')).toHaveText('2048');await idle(page);await expect(page.getByRole('dialog')).toHaveCount(0);
  await openSettings(page);const ending=numberGame([8,4,2,8,32,32,16,2,16,32,2,8,4,2,16,2]);await restore(page,backup(ending));await page.locator('.settings-back').click();await page.keyboard.press('ArrowRight');await expect(page.getByRole('dialog')).toContainText('Игра окончена');await expect(page.getByRole('dialog')).not.toContainText('линий');await expect(page.getByRole('dialog').locator('.result-score')).toContainText('64');
});

test('all 12 numeric palettes fit shared mobile/desktop widths and contain no SVG masks, including long numbers',async({page})=>{
  await setup(page,backup(numberGame([2**52,65536,32768,16384,8192,4096,2048,1024,512,256,128,64,32,16,8,0]),100000));
  for(const theme of ['winter','spring','summer','autumn','pastel','aidanastya'])for(const mode of ['light','dark']){
    await openSettings(page);await page.locator(`[data-theme-choice=${theme}]`).click();if(await page.getByRole('switch').getAttribute('aria-checked')!==(mode==='dark'?'true':'false'))await page.getByRole('switch').click();await page.locator('.settings-back').click();
    const tiles=await page.locator('.number-tile').evaluateAll(nodes=>nodes.map(n=>({width:n.clientWidth,content:n.scrollWidth,mask:getComputedStyle(n).maskImage,font:getComputedStyle(n).fontSize})));expect(tiles.every(t=>t.content<=t.width&&t.mask==='none'&&parseFloat(t.font)>0)).toBe(true);
  }
  for(const size of [{width:320,height:568},{width:393,height:664},{width:390,height:844},{width:1440,height:900},{width:1920,height:1080}]){
    await page.setViewportSize(size);const geometry=await page.evaluate(()=>{const a=document.querySelector('.app-header')!.getBoundingClientRect(),b=document.querySelector('.numbers-board')!.getBoundingClientRect(),c=document.querySelector('.game-buttons')!.getBoundingClientRect();return{header:a.width,board:b.width,height:b.height,x:a.x,boardX:b.x,bottom:c.bottom,innerHeight};});
    expect(Math.abs(geometry.board-geometry.header)).toBeLessThan(1);expect(Math.abs(geometry.board-geometry.height)).toBeLessThan(1);expect(Math.abs(geometry.boardX-geometry.x)).toBeLessThan(1);expect(geometry.bottom).toBeLessThanOrEqual(size.height);await page.screenshot({path:test.info().outputPath(`2048-${size.width}.png`),fullPage:true});
  }
});

test('2048 and its lazy chunk start offline before the game has ever been opened',async({page,context})=>{
  await page.goto('./');await expect(page.getByText('Готово к игре офлайн')).toBeVisible({timeout:20000});await context.setOffline(true);await page.reload();await page.locator('#start-2048').click();await expect(page.locator('.number-tile')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');await idle(page);await openSettings(page);const exported=await exportFile(page);expect(exported.games['2048'].save).not.toBeNull();await page.reload();await page.locator('#start-2048').click();await expect(page.locator('.numbers-cell')).toHaveCount(16);
});

test('a failed numeric write remains in memory and exports; retry persists the same move exactly once',async({page})=>{
  await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){if((window as any).__failWrite)throw new DOMException('Test quota failure','QuotaExceededError');return put.apply(this,args as any);};});
  await setup(page);const before=await stored(page);await page.evaluate(()=>(window as any).__failWrite=true);await page.keyboard.press('ArrowLeft');await expect(page.getByRole('alert')).toContainText('quota');await idle(page);await expect(page.locator('.score-current')).toHaveText('4');expect((await stored(page))['items:game:2048']).toEqual(before['items:game:2048']);
  await openSettings(page);const exported=await exportFile(page);expect(exported.games['2048'].save.score).toBe(4);expect(exported.games['2048'].save.moves).toBe(1);await page.evaluate(()=>(window as any).__failWrite=false);await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);expect((await stored(page))['items:game:2048'].moves).toBe(1);expect((await stored(page))['items:game:block-puzzle']).toEqual(before['items:game:block-puzzle']);
});

test('damaged 2048 can be recovered without losing the 1010 party or readable records',async({page})=>{
  await setup(page);const before=await stored(page);await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(r=>{const request=indexedDB.open('muroblocks-v1',2);request.onsuccess=()=>r(request.result);});await new Promise<void>(r=>{const tx=db.transaction('items','readwrite');tx.objectStore('items').put({version:1,board:[999]},'game:2048');tx.oncomplete=()=>r();});db.close();});await page.reload();await expect(page.getByRole('alert')).toContainText('2048');
  await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('7');await page.getByRole('button',{name:'Восстановить 2048',exact:true}).click();await page.getByRole('button',{name:'Сбросить партию',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await stored(page))['items:game:block-puzzle']).toEqual(before['items:game:block-puzzle']);expect((await stored(page))['records:2048']).toBe(96);await page.locator('#start-2048').click();await expect(page.locator('.score-record')).toContainText('96');
});

test('one real swipe yields one move; short, cancelled, multi-touch and interrupted gestures yield none',async({page,context,isMobile,browserName})=>{
  test.skip(!isMobile||browserName!=='chromium','Native swipe dispatch uses mobile Chromium CDP');await setup(page);const cdp=await context.newCDPSession(page);const b=(await page.locator('.numbers-board').boundingBox())!,x=b.x+b.width*.7,y=b.y+b.height*.5;
  const begin=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});const move=(dx:number)=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y,id:1}]});const end=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const before=await stored(page);await page.locator('.numbers-cell').first().tap();expect(await stored(page)).toEqual(before);await begin();await move(-10);await end();expect(await stored(page)).toEqual(before);
  await begin();await move(-80);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});expect(await stored(page)).toEqual(before);
  await begin();await move(-60);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-60,y,id:1},{x:x-100,y,id:2}]});await end();expect(await stored(page)).toEqual(before);
  await begin();await move(-60);await page.evaluate(()=>dispatchEvent(new Event('blur')));await end();expect(await stored(page)).toEqual(before);
  await begin();await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y:y-60,id:1}]});await end();expect(await stored(page)).toEqual(before);
  await begin();await move(-60);await page.setViewportSize({width:390,height:800});await end();expect(await stored(page)).toEqual(before);await page.setViewportSize({width:390,height:844});
  for(const [dx,dy] of [[-80,0],[0,80],[80,0],[0,-80]]){
    const current=await stored(page);await begin();await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:1}]});await end();await idle(page);expect((await stored(page))['items:game:2048'].moves).toBe(current['items:game:2048'].moves+1);
  }
  expect(await page.evaluate(()=>visualViewport!.scale)).toBe(1);
});


test('a 1010 change in another tab blocks a stale 2048 move and preserves both games',async({page,context})=>{
  await context.addInitScript(()=>{Object.defineProperty(window,'BroadcastChannel',{value:undefined});});
  await setup(page);const stale=await stored(page);const other=await context.newPage();await other.goto('./');await other.locator('#start-game').click();await openSettings(other);await other.locator('[data-pattern-choice=heart]').click();await expect(other.locator('[data-pattern-choice=heart]')).toBeEnabled();
  const latest=await stored(other);expect(latest['metadata:revision']).toBeGreaterThan(stale['metadata:revision']);
  // Same-origin focus checks may detect the conflict first; either route must
  // retain the authoritative snapshot, with no cross-game overwrite.
  await page.keyboard.press('ArrowLeft');await expect(page.getByRole('alert')).toContainText('другой вкладке');expect(await stored(page)).toEqual(latest);
  await page.getByRole('button',{name:'Загрузить актуальную',exact:true}).click();await page.getByRole('button',{name:'Загрузить',exact:true}).click();await page.locator('#start-2048').click();await expect(page.locator('.score-current')).toHaveText('0');await openSettings(page);await expect(page.locator('[data-pattern-choice=heart]')).toHaveAttribute('aria-pressed','true');await other.close();
});


test('interrupting a numeric animation releases input and never repeats its logical operation',async({page})=>{
  await setup(page);await page.keyboard.press('ArrowLeft');await page.evaluate(()=>dispatchEvent(new Event('blur')));await idle(page);const first=await stored(page);expect(first['items:game:2048'].moves).toBe(1);
  await page.keyboard.press('ArrowRight');await page.setViewportSize({width:393,height:700});await idle(page);const second=await stored(page);expect(second['items:game:2048'].moves).toBe(2);
  await page.keyboard.press('ArrowDown');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await idle(page);const third=await stored(page);expect(third['items:game:2048'].moves).toBe(3);
  await openSettings(page);await page.locator('.settings-back').click();expect((await stored(page))['items:game:2048']).toEqual(third['items:game:2048']);await page.keyboard.press('ArrowUp');await idle(page);expect((await stored(page))['items:game:2048'].moves).toBe(4);
});
