import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

test('1.2 -> 2048 -> 1.2 rollback -> 2048 preserves both parties, records and settings through real Service Workers',async({page,context,isMobile})=>{
  test.skip(isMobile,'The original 1010 party is created by mouse; shared migration is tested on mobile elsewhere');test.setTimeout(60000);
  const old=path.resolve('tests/fixtures/v1.2/app'),current=path.resolve('dist');let directory=old;
  const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url!,'http://local').pathname).replace(/^\/aidagame\//,'');const file=path.resolve(directory,name||'index.html');if(!file.startsWith(directory+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(file);const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404).end();}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/aidagame/`;
  async function switchVersion(target:string){directory=target;await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration!.update();});await expect(page.getByRole('button',{name:'Обновить',exact:true})).toBeVisible({timeout:20000});await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Обновить',exact:true}).click()]);await expect(page.locator('#start-game')).toBeEnabled();}
  try{
    await page.addInitScript(()=>{Math.random=()=>0;});await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.locator('#start-game').click();await page.locator('[data-slot="0"]').click();await page.locator('[data-cell="0"]').click();await expect(page.locator('.score-current')).toHaveText('1');await expect(page.getByRole('button',{name:'Настройки',exact:true})).toBeEnabled();
    // A returning installed client: Workbox treats a same-visit first install as
    // initial activation, so begin the update from a fresh controlled document.
    await page.reload();await expect(page.locator('#start-game')).toBeEnabled();
    await switchVersion(current);await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('1');await page.locator('.game-buttons').getByRole('button',{name:'Вернуться',exact:true}).click();await page.locator('#start-2048').click();await expect(page.locator('.numbers-cell')).toHaveCount(16);await expect(page.getByRole('button',{name:'Настройки',exact:true})).toBeEnabled();await page.keyboard.press('ArrowLeft');await expect(page.locator('.score-current')).toHaveText('4');await expect(page.getByRole('button',{name:'Настройки',exact:true})).toBeEnabled();
    await context.setOffline(true);await page.reload();await page.locator('#start-2048').click();await expect(page.locator('.score-current')).toHaveText('4');await context.setOffline(false);
    await switchVersion(old);await expect(page.locator('#start-2048')).toHaveCount(0);await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('1');await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.locator('[data-pattern-choice=heart]').click();await expect(page.locator('[data-pattern-choice=heart]')).toBeEnabled();
    await switchVersion(current);await page.locator('#start-2048').click();await expect(page.locator('.score-current')).toHaveText('4');await expect(page.locator('.score-record')).toContainText('4');await page.locator('.game-buttons').getByRole('button',{name:'Вернуться',exact:true}).click();await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText('1');await page.getByRole('button',{name:'Настройки',exact:true}).click();await expect(page.locator('[data-pattern-choice=heart]')).toHaveAttribute('aria-pressed','true');
  }finally{await context.setOffline(false);server.closeAllConnections();server.close();}
});
