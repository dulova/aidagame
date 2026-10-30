import { themes, themeOrder, patterns, resolvePalette, applyTheme } from './design/themes.js';
import { createInitialState, placeShape } from './game/logic.js';
import { shapeSize } from './game/shapes.js';
import { loadGame, saveGame, loadSettings, saveSettings } from './storage/db.js';

const app=document.getElementById('app');
const modalRoot=document.getElementById('overlay');
const brand=document.getElementById('brand');
const settingsButton=document.getElementById('settings-button');
const model={screen:'home',back:'home',game:null,settings:{theme:'pastel',pattern:'none',mode:'light'},selectedSlot:null,busy:false,drag:null};
const uiIcon=name=>{
 const paths={back:'<path d="M19 12H5m7-7-7 7 7 7"/>',restart:'<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/>',trophy:'<path d="M7 3h10v8a5 5 0 0 1-10 0V3Zm10 2h4v3a4 4 0 0 1-4 4M7 5H3v3a4 4 0 0 0 4 4m5 4v4m-4 0h8"/>'};
 return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;
};
const setScreen=s=>{model.screen=s;document.body.dataset.screen=s;settingsButton.classList.toggle('active',s==='settings');};
const patternById=id=>patterns.find(p=>p.id===id);
const cellColorClass=group=>`group-${group}`;
function stamp(){const p=patternById(model.settings.pattern);return p?.icon?`<span class="cell-stamp" style="--stamp-url:url('./icons/pattern-${p.icon}.svg')"></span>`:'';}
function overlayClose(){modalRoot.innerHTML='';document.body.classList.remove('modal-visible');}
function gotoHome(){removeDrag();overlayClose();model.selectedSlot=null;setScreen('home');renderHome();}
function gotoSettings(){removeDrag();overlayClose();model.back=model.screen==='settings'?model.back:model.screen;setScreen('settings');renderSettings();}
function backFromSettings(){model.back==='game'?showGame(false):gotoHome();}
function doNewGame(){model.game=createInitialState(Math.random,model.game?.best||0);model.selectedSlot=null;saveGame(model.game);showGame(false);}
function showGame(ensure=true){removeDrag();overlayClose();if(ensure&&model.game?.status!=='active')model.game=createInitialState(Math.random,model.game?.best||0);if(!model.game)model.game=createInitialState();saveGame(model.game);model.selectedSlot=null;setScreen('game');renderGame();if(model.game.status==='completed')showResults();}
function showConfirm(){if(model.game?.status!=='active'){doNewGame();return;}openModal(`<div class="dialog-heading">Начать заново?</div><p class="dialog-description">Текущая партия сбросится</p><div class="dialog-actions"><button class="action secondary" id="confirm-cancel">Вернуться</button><button class="action primary" id="confirm-new">Заново</button></div>`,()=>{document.getElementById('confirm-cancel').onclick=overlayClose;document.getElementById('confirm-new').onclick=()=>{overlayClose();doNewGame();};});}
function openModal(content,wire){modalRoot.innerHTML=`<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true">${content}</section></div>`;document.body.classList.add('modal-visible');modalRoot.querySelector('.modal-backdrop').addEventListener('pointerdown',e=>{if(e.target===e.currentTarget)overlayClose();});wire?.();}
function showResults(){if(model.screen!=='game'||model.game?.status!=='completed')return;const record=model.game.score===model.game.best&&model.game.score>0;openModal(`<div class="fireworks" aria-hidden="true"><i></i><i></i><i></i></div><h2 class="dialog-heading">Игра окончена!</h2><p class="dialog-description">${record?'Новый рекорд ✦':'Играй в своём ритме ♡'}</p><div class="result-score"><strong>${model.game.score}</strong><span class="result-best">${uiIcon('trophy')}<strong>${model.game.best}</strong></span></div><div class="result-lines">${model.game.clearedLines} линий очищено</div><div class="dialog-actions"><button class="action secondary" id="results-home">В меню</button><button class="action primary" id="results-retry">Играть снова</button></div>`,()=>{document.getElementById('results-home').onclick=gotoHome;document.getElementById('results-retry').onclick=doNewGame;});}
const exampleBoard=['','','','','','','square_single','','','','','square_triple','','','', '', '','square_double','square_double','','square_triple','','','', '', 'square_double','square_double','','square_triple','l_shape','', '', 'square_double','square_double','','','','l_shape','','','line','line','line','line','','',''];
function renderMiniBoard(){return `<div class="card-mini-board" aria-hidden="true">${Array.from({length:49},(_,i)=>{const g=exampleBoard[i]||null;return `<i class="${g?cellColorClass(g):''}"></i>`;}).join('')}</div>`;}
function renderHome(){app.innerHTML=`<section class="home-screen screen"><h1 class="hero-heading">Играй<br><em>в своём ритме</em></h1><div class="catalog"><button class="game-card" id="start-game" aria-label="${model.game?.status==='active'?'Продолжить игру 1010!':'Начать игру 1010!'}"><span class="game-card-copy"><strong>1010!</strong>${model.game?.status==='active'?'<small>Продолжить</small>':''}</span>${renderMiniBoard()}</button><div class="game-card unavailable" aria-disabled="true"><span class="game-card-copy"><strong>2048</strong><small>скоро в игре</small></span><span class="tiles-2048" aria-hidden="true"><i>2</i><i>4</i><i>8</i><i>16</i></span></div><div class="game-card unavailable" aria-disabled="true"><span class="game-card-copy"><strong>Tap match</strong><small>скоро в игре</small></span><span class="tap-art" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div></section>`;document.getElementById('start-game').onclick=()=>showGame(true);}
function themeSwatches(id){const t=resolvePalette(id,model.settings.mode);return [t.blockSingle,t.blockDouble,t.blockTriple,t.blockLine,t.blockL].map(color=>`<i style="background:${color}"></i>`).join('');}
function renderSettings(){app.innerHTML=`<section class="settings-screen screen"><h1 class="hero-heading">Настрой <em>вайб</em></h1><section class="setting-group"><h2>Тема</h2><div class="mode-row"><span>Тёмный режим</span><button type="button" class="mode-switch" id="mode-switch" role="switch" aria-checked="${model.settings.mode==='dark'}" aria-label="Тёмный режим"><span></span></button></div><div class="theme-grid" role="group" aria-label="Цветовая тема">${themeOrder.map(id=>`<button class="theme-option ${model.settings.theme===id?'selected':''}" data-theme-choice="${id}" aria-pressed="${model.settings.theme===id}"><span class="theme-label">${themes[id].name}</span><span class="theme-dots" aria-hidden="true">${themeSwatches(id)}</span></button>`).join('')}</div></section><section class="setting-group patterns-group"><h2>Рисунок</h2><div class="pattern-panel"><div class="pattern-grid" role="group" aria-label="Рисунки на блоках">${patterns.map(p=>`<button class="pattern-option ${p.id===model.settings.pattern?'selected':''}" data-pattern-choice="${p.id}" aria-pressed="${p.id===model.settings.pattern}" aria-label="${p.name}" title="${p.name}"><span class="pattern-tile">${p.icon?`<span class="pixel-pattern" style="--stamp-url:url('./icons/pattern-${p.icon}.svg')"></span>`:''}</span></button>`).join('')}</div></div></section><button class="action secondary settings-back" id="settings-back">${uiIcon('back')} Вернуться</button></section>`;
  app.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>{model.settings.theme=button.dataset.themeChoice;applyTheme(model.settings.theme,model.settings.mode);saveSettings(model.settings);renderSettings();});
  document.getElementById('mode-switch').onclick=()=>{model.settings.mode=model.settings.mode==='dark'?'light':'dark';applyTheme(model.settings.theme,model.settings.mode);saveSettings(model.settings);renderSettings();};
  app.querySelectorAll('[data-pattern-choice]').forEach(button=>button.onclick=()=>{model.settings.pattern=button.dataset.patternChoice;saveSettings(model.settings);renderSettings();});
  document.getElementById('settings-back').onclick=backFromSettings;
}
function cellMarkup(group,index){return `<div class="board-cell ${group?`filled ${cellColorClass(group)}`:''}" role="gridcell" data-cell="${index}" aria-label="${group?'Занятая':'Свободная'} клетка, ряд ${Math.floor(index/10)+1}, столбец ${index%10+1}" tabindex="${index===0?'0':'-1'}">${group?stamp():''}</div>`;}
function shapeMarkup(shape,type='mini'){if(!shape)return '<span class="empty-slot" aria-hidden="true"></span>';const {cols,rows}=shapeSize(shape);const cset=new Set(shape.cells.map(([x,y])=>`${x},${y}`));return `<div class="shape-${type} ${cellColorClass(shape.group)}" style="--shape-cols:${cols};--shape-rows:${rows}">${Array.from({length:cols*rows},(_,i)=>cset.has(`${i%cols},${Math.floor(i/cols)}`)?`<span class="piece-cell">${stamp()}</span>`:'<span class="piece-blank"></span>').join('')}</div>`;}
function renderGame(){if(!model.game)return;const game=model.game;app.innerHTML=`<section class="game-screen screen"><div class="scoreboard"><span class="score-current">${game.score}</span><span class="score-record">${uiIcon('trophy')}<span>${game.best}</span></span></div><div class="play-stack"><div class="board-wrap"><div class="board" id="game-board" role="grid" aria-label="Игровое поле 10 на 10">${game.board.map((group,index)=>cellMarkup(group,index)).join('')}</div></div><div class="pieces-panel" id="pieces-panel" aria-label="Доступные фигуры">${game.slots.map((shape,i)=>`<div class="piece-slot ${!shape?'used':''} ${model.selectedSlot===i?'chosen':''}" data-slot="${i}" ${shape?`role="button" tabindex="0" aria-label="Фигура ${i+1}"`:'aria-hidden="true"'}>${shapeMarkup(shape)}</div>`).join('')}</div></div><div class="game-buttons"><button class="action secondary" id="back-to-menu">${uiIcon('back')} Вернуться</button><button class="action secondary" id="restart-game">${uiIcon('restart')} Заново</button></div></section>`;
  sizePieces();
  document.getElementById('back-to-menu').onclick=gotoHome;
  document.getElementById('restart-game').onclick=showConfirm;
  app.querySelectorAll('.piece-slot[role="button"]').forEach(slot=>{slot.addEventListener('pointerdown',onSlotPointerDown);slot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.key==='Enter')model.selectedSlot=Number(slot.dataset.slot);renderGame();}});});
  document.getElementById('game-board').addEventListener('click',onBoardClick);
  document.getElementById('game-board').addEventListener('keydown',e=>{if(model.selectedSlot!==null&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const target=e.target.closest('[data-cell]');if(target){const index=Number(target.dataset.cell);tryPlacement(model.selectedSlot,index%10,Math.floor(index/10));}}});
}
function sizePieces(){
 const board=document.getElementById('game-board');const panel=document.getElementById('pieces-panel');
 if(!board||!panel)return;
 const grid=getBoardMetrics();
 const maximumRows=5;
 const maximumCols=5; // Largest possible figure (a five-cell line).
 const available=window.innerHeight; const compact=available<=650;
 const cell=Math.max(compact?9:11,Math.min(grid.cell*.58,compact?14:23));
 const maxSize=Math.min(cell,(panel.clientWidth/3-14-(maximumCols-1)*2)/maximumCols);
 const pieceCell=Math.max(8,maxSize);
 const trayHeight=Math.ceil(maximumRows*pieceCell+(maximumRows-1)*2+(compact?13:22));
 panel.style.setProperty('--tray-cell',`${pieceCell}px`);
 panel.style.height=`${trayHeight}px`;
}
window.addEventListener('resize',()=>{if(model.screen==='game'&&!model.drag)sizePieces();});
function getBoardMetrics(){const board=document.getElementById('game-board');const rect=board.getBoundingClientRect();const style=getComputedStyle(board);const padX=parseFloat(style.paddingLeft),padY=parseFloat(style.paddingTop),gap=parseFloat(style.columnGap);const cell=(rect.width-padX-parseFloat(style.paddingRight)-9*gap)/10;return {rect,originLeft:rect.left+padX,originTop:rect.top+padY,pitch:cell+gap,cell};}
function onBoardClick(e){if(model.selectedSlot===null||model.busy||!window.matchMedia('(pointer:fine)').matches)return;const cell=e.target.closest('[data-cell]');if(!cell)return;const index=Number(cell.dataset.cell);tryPlacement(model.selectedSlot,index%10,Math.floor(index/10));}
function onSlotPointerDown(e){if(model.busy||e.button!==0)return;const slot=Number(e.currentTarget.dataset.slot);const shape=model.game.slots[slot];if(!shape)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const isTouch=e.pointerType==='touch'||e.pointerType==='pen';model.drag={pointerId:e.pointerId,slot,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false,isTouch,element:null};const node=e.currentTarget;
  node.addEventListener('pointermove',onSlotPointerMove);
  node.addEventListener('pointerup',onSlotPointerUp,{once:true});
  node.addEventListener('pointercancel',onSlotPointerCancel,{once:true});
  node.addEventListener('lostpointercapture',onSlotPointerCancel,{once:true});
}
function dragPosition(pointerX,pointerY,shape,isTouch){const {pitch}=getBoardMetrics();const {cols,rows}=shapeSize(shape);return {left:pointerX-cols*pitch/2,top:isTouch?pointerY-rows*pitch-45:pointerY-rows*pitch/2,width:cols*pitch,height:rows*pitch,pitch};}
function onSlotPointerMove(e){const d=model.drag;if(!d||e.pointerId!==d.pointerId)return;d.x=e.clientX;d.y=e.clientY;if(!d.active&&Math.hypot(d.x-d.startX,d.y-d.startY)<8)return;if(!d.active){d.active=true;const shape=model.game.slots[d.slot];const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=shapeMarkup(shape,'drag');document.body.appendChild(ghost);d.element=ghost;e.currentTarget.classList.add('is-drag-origin');}positionDrag(d);}
function positionDrag(d){const shape=model.game.slots[d.slot];if(!shape||!d.element)return;const p=dragPosition(d.x,d.y,shape,d.isTouch);d.element.style.left=`${p.left}px`;d.element.style.top=`${p.top}px`;d.element.style.setProperty('--drag-pitch',`${p.pitch}px`);}
function onSlotPointerUp(e){const d=model.drag;if(!d||e.pointerId!==d.pointerId)return;const node=e.currentTarget;cleanupSlotListeners(node);const isActive=d.active;const slot=d.slot;if(isActive){d.x=e.clientX;d.y=e.clientY;const shape=model.game.slots[slot];const metrics=getBoardMetrics();const p=dragPosition(d.x,d.y,shape,d.isTouch);const col=Math.round((p.left-metrics.originLeft)/metrics.pitch);const row=Math.round((p.top-metrics.originTop)/metrics.pitch);removeDrag();tryPlacement(slot,col,row);}else{removeDrag();if(e.pointerType==='mouse'){model.selectedSlot=slot;renderGame();}}}
function onSlotPointerCancel(e){const d=model.drag;if(!d||e.pointerId!==d.pointerId)return;cleanupSlotListeners(e.currentTarget);removeDrag();}
function cleanupSlotListeners(node){node.removeEventListener('pointermove',onSlotPointerMove);}
function removeDrag(){if(model.drag?.element)model.drag.element.remove();document.querySelectorAll('.is-drag-origin').forEach(n=>n.classList.remove('is-drag-origin'));model.drag=null;}
function tryPlacement(slot,col,row){
 if(model.busy)return;
 const previousBoard=model.game.board;
 const placedGroup=model.game.slots[slot]?.group;
 const result=placeShape(model.game,slot,col,row,Math.random);
 if(!result.accepted)return;
 model.game=result.state;
 model.selectedSlot=null;
 model.busy=true;
 saveGame(model.game);
 renderGame();
 const lines=result.cleared;
 if(!lines.count){window.setTimeout(finishPlacement,110);return;}
 const indices=[...new Set([...lines.rows.flatMap(y=>Array.from({length:10},(_,x)=>y*10+x)),...lines.cols.flatMap(x=>Array.from({length:10},(_,y)=>y*10+x))])];
 const cleared=indices.map(index=>({index,group:previousBoard[index] || placedGroup}));
 const board=document.getElementById('game-board');
 const duration=210;
 cleared.forEach(({index,group},order)=>{
   const cell=board.children[index];
   if(!cell||!group)return;
   cell.classList.add('filled',cellColorClass(group),'clearing');
   cell.innerHTML=stamp();
   cell.style.setProperty('--clear-delay',`${order* (Math.min(88, duration*.4)/Math.max(cleared.length-1,1))}ms`);
 });
 window.setTimeout(()=>{if(model.screen==='game')renderGame();finishPlacement();},duration+20);
}
function finishPlacement(){
 model.busy=false;
 if(model.screen==='game'&&model.game.status==='completed')showResults();
}
brand.onclick=gotoHome;
settingsButton.onclick=()=>model.screen==='settings'?backFromSettings():gotoSettings();
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modalRoot.children.length){if(model.game?.status==='completed')return;overlayClose();}else if(model.selectedSlot!==null){model.selectedSlot=null;if(model.screen==='game')renderGame();}else if(model.screen==='settings')backFromSettings();}});
async function init(){try{const [settings,game]=await Promise.all([loadSettings(),loadGame()]);if(settings){if(themes[settings.theme])model.settings.theme=settings.theme;else if(settings.theme==='dark')model.settings.mode='dark';if(patternById(settings.pattern))model.settings.pattern=settings.pattern; if(settings.mode==='dark'||settings.mode==='light')model.settings.mode=settings.mode; if(settings.pattern==='cat')model.settings.pattern='none';}if(game)model.game=game;}catch(error){console.warn('Данные недоступны',error);}applyTheme(model.settings.theme,model.settings.mode);gotoHome();if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Не удалось включить офлайн-режим',error));}
init();
