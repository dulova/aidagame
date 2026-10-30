import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

test('updates from the real v1 Service Worker, preserving its progress, then reopens offline', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'Baseline mouse interaction; shared migration is tested on mobile separately');
  let directory = path.resolve('tests/fixtures/v1');
  const server=http.createServer(async(req,res)=>{
    try {
      const name=decodeURIComponent(new URL(req.url!,'http://localhost').pathname).replace(/^\/aidagame\//,'');
      const file=path.resolve(directory,name||'index.html');if(!file.startsWith(directory+path.sep)){res.writeHead(403).end();return;}
      const data=await fs.readFile(file); const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;
  const url=`http://127.0.0.1:${port}/aidagame/`;
  try {
    await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.locator('#start-game').click();await page.locator('[data-slot="0"]').click();await page.locator('[data-cell="0"]').click();
    const score=await page.locator('.score-current').textContent();expect(Number(score)).toBeGreaterThan(0);
    directory=path.resolve('dist');await page.reload();await expect(page.getByRole('button',{name:'Обновить',exact:true})).toBeVisible({timeout:20000});
    await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Обновить',exact:true}).click()]);
    await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText(score!);
    await context.setOffline(true);await page.reload();await page.locator('#start-game').click();await expect(page.locator('.score-current')).toHaveText(score!);
  } finally { await context.setOffline(false);server.closeAllConnections();server.close(); }
});
