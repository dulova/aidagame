import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const root=process.cwd();const old=process.env.BASELINE_DIR;if(!old)throw Error('Set BASELINE_DIR to the checkout of the original version');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
async function server(directory,port){const s=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/aidagame\//,'');const target=path.resolve(directory,name||'index.html');if(!target.startsWith(path.resolve(directory)+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(target);const compress=/\.(js|css|html|svg|webmanifest)$/.test(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache',...(compress?{'Content-Encoding':'gzip'}:{})});res.end(compress?gzipSync(data):data);}catch{res.writeHead(404).end();}});await new Promise((resolve,reject)=>s.listen(port,'127.0.0.1',resolve).on('error',reject));return s;}
const servers=await Promise.all([server(old,4180),server(path.join(root,'dist'),4181)]);
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROME_PATH?{executablePath:process.env.PLAYWRIGHT_CHROME_PATH}:{});
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];const report={profile:{browser:browser.version(),viewport:'390x844',cpuSlowdown:4,downloadMbps:1.6,uploadMbps:.75,latencyMs:150,runs:5,host:process.platform+' '+process.arch,gzip:true,physicalPhone:false},versions:{}};
try{
 for(const [name,port]of [['baseline',4180],['vue',4181]]){
  const cold=[],cached=[],frames=[];
  for(let i=0;i<5;i++){
   const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:.75*1024*1024/8});
   await page.goto(`http://127.0.0.1:${port}/aidagame/`);await page.locator('#start-game').waitFor();await page.waitForFunction(()=>!(document.querySelector('#start-game')?.disabled));cold.push(await page.evaluate(()=>performance.now()));
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForTimeout(150);await context.setOffline(true);await page.reload();await page.locator('#start-game').waitFor();await page.waitForFunction(()=>!(document.querySelector('#start-game')?.disabled));cached.push(await page.evaluate(()=>performance.now()));
   await page.locator('#start-game').click();await page.locator('.piece-slot').first().waitFor();
   await page.evaluate(()=>{window.frameGaps=[];window.runningFrames=true;let previous;function tick(t){if(previous)window.frameGaps.push(t-previous);previous=t;if(window.runningFrames)requestAnimationFrame(tick);}requestAnimationFrame(tick);});
   const slot=await page.locator('[data-slot="0"]').boundingBox();const board=await page.locator('.board').boundingBox();await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);await page.mouse.down();await page.mouse.move(board.x+board.width/2,board.y+board.height/2,{steps:30});await page.mouse.up();await page.waitForTimeout(250);frames.push(await page.evaluate(()=>{window.runningFrames=false;return {samples:window.frameGaps.length,over50ms:window.frameGaps.filter(n=>n>50).length,maxMs:Math.max(0,...window.frameGaps)};}));
   await context.close();
  }
  report.versions[name]={coldMs:cold,cachedMs:cached,coldMedianMs:median(cold),cachedMedianMs:median(cached),dragFrameSamples:frames};
 }
 report.budgets={coldPassed:report.versions.vue.coldMedianMs<=3000,cachedPassed:report.versions.vue.cachedMedianMs<=1000};
 await fs.mkdir('docs/verification',{recursive:true});await fs.writeFile('docs/verification/performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();for(const s of servers)s.close();}
