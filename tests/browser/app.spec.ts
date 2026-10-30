import { test, expect } from '@playwright/test';
import { createInitialState } from '../../src/game/logic';

const settings = { theme: 'pastel', mode: 'light', pattern: 'none' };
const backup = (best=0, game=createInitialState(()=>0,best)) => ({appId:'muroblocks',exportVersion:2,exportedAt:'2026-10-30T10:00:00Z',settings,games:{'block-puzzle':{saveVersion:1,save:game,records:{best}}}});
async function openSettings(page: any) { await page.getByRole('button',{name:'Настройки',exact:true}).click(); await expect(page.getByRole('heading',{name:'Сохранения',exact:true})).toBeVisible(); }
async function file(page: any, data: unknown) { await page.locator('input[type=file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))}); }
async function restore(page: any, data: unknown) { await file(page,data); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button',{name:'Восстановить',exact:true}).click(); await expect(page.getByRole('dialog')).toHaveCount(0); }

test('themes, six patterns and SVG paths work under /aidagame/; progress survives reload',async({page,isMobile})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/aidagame/'))errors.push(`${r.status()} ${r.url()}`);});
  await page.goto('./');await openSettings(page);
  await expect(page.locator('[data-theme-choice]')).toHaveCount(6);await expect(page.locator('[data-pattern-choice]')).toHaveCount(6);
  for(const id of ['paw','snow','heart','leaf','pumpkin']){await page.locator(`[data-pattern-choice=${id}]`).click();await expect(page.locator(`[data-pattern-choice=${id}]`)).toHaveAttribute('aria-pressed','true');}
  await page.locator('[data-theme-choice=winter]').click();await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','true');await expect(page.locator('[data-theme-choice=winter]')).toBeEnabled();
  await page.reload();await openSettings(page);await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','true');await expect(page.locator('[data-theme-choice=winter]')).toHaveAttribute('aria-pressed','true');
  for(const icon of ['foot','snow','heart','leave','pumpkin'])expect((await page.request.get(`icons/pattern-${icon}.svg`)).status()).toBe(200);
  await page.screenshot({path:test.info().outputPath('settings.png'),fullPage:true});expect(errors).toEqual([]);
});

test('import previews and cancels without change, fully restores lower records, and exports JSON',async({page})=>{
  await page.goto('./');await openSettings(page);await restore(page,backup(200));
  await file(page,backup(15));await expect(page.getByRole('dialog')).toContainText('Рекорд: 15');await page.getByRole('button',{name:'Отмена',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт сохранений',exact:true}).click();const download=await downloadPromise;
  const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));expect(JSON.parse(Buffer.concat(chunks).toString()).games['block-puzzle'].records.best).toBe(200);
  await restore(page,backup(15));await page.reload();await page.locator('#start-game').click();await expect(page.locator('.score-record')).toContainText('15');
});

test('bad import preserves the previous data',async({page})=>{
  await page.goto('./');await openSettings(page);await restore(page,backup(70));await file(page,{appId:'other',exportVersion:5});
  await expect(page.locator('.save-status')).toContainText('Неизвестное');await expect(page.getByRole('dialog')).toHaveCount(0);await page.locator('#app .settings-back').click();await page.locator('#start-game').click();await expect(page.locator('.score-record')).toContainText('70');
});

test('two tabs detect conflicts; explicit reload preserves the newer version',async({page,context})=>{
  await page.goto('./');const other=await context.newPage();await other.goto('./');await openSettings(page);await page.locator('[data-theme-choice=winter]').click();
  await expect(other.getByRole('alert')).toContainText('другой вкладке');await expect(other.locator('#start-game')).toBeDisabled();await other.getByRole('button',{name:'Загрузить актуальную',exact:true}).click();await other.getByRole('button',{name:'Загрузить',exact:true}).click();
  await expect(other.getByRole('alert')).toHaveCount(0);await openSettings(other);await expect(other.locator('[data-theme-choice=winter]')).toHaveAttribute('aria-pressed','true');
});

test('desktop placement clears only player blocks, leaving all 100 background cells stable',async({page,isMobile})=>{
  test.skip(isMobile,'Two-click mode belongs to mouse input');
  await page.goto('./');await openSettings(page);const game=createInitialState(()=>0);for(let i=1;i<10;i++)game.board[i]='line';await restore(page,backup(0,game));await page.locator('.settings-back').click();await page.locator('#start-game').click();
  await page.locator('[data-slot="0"]').click();await page.locator('[data-cell="0"]').click();
  await expect(page.locator('.score-current')).toHaveText('11');await expect(page.locator('.board-cell')).toHaveCount(100);
  const transforms=await page.locator('.board-cell').evaluateAll(nodes=>nodes.map(n=>({transform:getComputedStyle(n).transform,opacity:getComputedStyle(n).opacity})));
  expect(transforms.every(s=>s.transform==='none'&&s.opacity==='1')).toBe(true);await expect(page.locator('.clearing')).toHaveCount(0);await expect(page.locator('.board-block')).toHaveCount(0);
  await page.reload();await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('11');
});

test('mobile short tap does not place; layout fits all agreed viewports',async({page,isMobile})=>{
  await page.goto('./');await page.locator('#start-game').click();
  if(isMobile){await page.locator('[data-slot="0"]').tap();await page.locator('[data-cell="0"]').tap();await expect(page.locator('.score-current')).toHaveText('0');}
  for(const size of [{width:390,height:844},{width:320,height:568},{width:1440,height:900}]){
    await page.setViewportSize(size);await page.waitForTimeout(50);
    const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.body.scrollHeight,innerWidth,innerHeight,board:document.querySelector('.board')!.getBoundingClientRect().toJSON(),controls:document.querySelector('.game-buttons')!.getBoundingClientRect().toJSON()}));
    expect(layout.width).toBeLessThanOrEqual(size.width);expect(layout.controls.bottom).toBeLessThanOrEqual(size.height);expect(layout.board.width).toBeGreaterThan(200);expect(Math.abs(layout.board.width-layout.board.height)).toBeLessThan(1);
    await page.screenshot({path:test.info().outputPath(`game-${size.width}.png`),fullPage:true});
  }
});

test('PWA reopens offline, including patterns and backup controls',async({page,context})=>{
  await page.goto('./');await expect(page.getByText('Готово к игре офлайн')).toBeVisible({timeout:20000});await context.setOffline(true);await page.reload();await openSettings(page);await page.locator('[data-pattern-choice=snow]').click();await expect(page.getByRole('button',{name:'Экспорт сохранений',exact:true})).toBeEnabled();await restore(page,backup(33));await page.locator('.settings-back').click();await page.locator('#start-game').click();await expect(page.locator('.score-record')).toContainText('33');
});

test('legacy IndexedDB data migrates on first load without losing the party',async({page})=>{
  const game=createInitialState(()=>0,95);game.score=7;game.turns=3;
  await page.addInitScript(({game,settings})=>{
    if(sessionStorage.getItem('legacy-seeded'))return;sessionStorage.setItem('legacy-seeded','1');
    const req=indexedDB.open('muroblocks-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('items');req.onsuccess=()=>{const db=req.result;const tx=db.transaction('items','readwrite');tx.objectStore('items').put(game,'game:block-puzzle');tx.objectStore('items').put(settings,'app:settings');db.close();};
  },{game,settings:{...settings,mode:'dark',pattern:'snow'}});
  await page.goto('./');await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('7');await expect(page.locator('.score-record')).toContainText('95');await expect(page.locator('html')).toHaveAttribute('data-mode','dark');
});

test('mouse drag returns from invalid position and places once in a valid position',async({page,isMobile})=>{
  test.skip(isMobile,'Mouse input');await page.goto('./');await openSettings(page);await restore(page,backup());await page.locator('.settings-back').click();await page.locator('#start-game').click();
  const slot=(await page.locator('[data-slot="0"]').boundingBox())!;await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);await page.mouse.down();await page.mouse.move(2,2,{steps:10});await page.mouse.up();await expect(page.locator('.drag-ghost')).toHaveCount(0);await expect(page.locator('.score-current')).toHaveText('0');
  const cell=(await page.locator('[data-cell="0"]').boundingBox())!;await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);await page.mouse.down();await page.mouse.move(cell.x+cell.width/2,cell.y+cell.height/2,{steps:10});await page.mouse.up();await expect(page.locator('.score-current')).toHaveText('1');await expect(page.locator('.board-block')).toHaveCount(1);
});

test('real touch gesture places using the figure offset, without enabling two-tap mode',async({page,isMobile,browserName,context})=>{
  test.skip(!isMobile||browserName!=='chromium','CDP touch gesture');await page.goto('./');await openSettings(page);await restore(page,backup());await page.locator('.settings-back').click();await page.locator('#start-game').click();
  const slot=(await page.locator('[data-slot="0"]').boundingBox())!,cell=(await page.locator('[data-cell="0"]').boundingBox())!;
  const cdp=await context.newCDPSession(page);const from={x:slot.x+slot.width/2,y:slot.y+slot.height/2};const to={x:cell.x+cell.width/2,y:cell.y+cell.height+45};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.score-current')).toHaveText('1');await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('failed storage keeps the move in memory, warns, exports, and can retry',async({page,isMobile})=>{
  test.skip(isMobile,'Mouse placement; failure logic is shared');await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){if((window as any).__failWrite)throw new DOMException('Test quota failure','QuotaExceededError');return put.apply(this,args as any);};});
  await page.goto('./');await openSettings(page);await restore(page,backup());await page.locator('.settings-back').click();await page.locator('#start-game').click();await page.evaluate(()=>(window as any).__failWrite=true);await page.locator('[data-slot="0"]').click();await page.locator('[data-cell="0"]').click();await expect(page.getByRole('alert')).toContainText('Test quota failure');await expect(page.locator('.score-current')).toHaveText('1');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Экспортировать свою версию',exact:true}).click();const stream=await(await downloaded).createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));expect(JSON.parse(Buffer.concat(chunks).toString()).games['block-puzzle'].save.score).toBe(1);
  await page.evaluate(()=>(window as any).__failWrite=false);await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await page.reload();await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('1');
});
