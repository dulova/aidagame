import { validateSave } from '../game/logic.js';
export const DB_NAME='muroblocks-v1';
let instance;
function openDb(){if(!('indexedDB' in globalThis))return Promise.reject(new Error('IndexedDB недоступен'));
  if(instance)return instance; instance=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('items'))db.createObjectStore('items');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return instance;
}
async function transact(mode,callback){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('items',mode);const result=callback(tx.objectStore('items'));tx.oncomplete=()=>resolve(result.result);tx.onerror=()=>reject(tx.error);});}
export async function putItem(key,value){try{await transact('readwrite',s=>s.put(value,key));}catch(error){try{localStorage.setItem(DB_NAME+':'+key,JSON.stringify(value));}catch{console.warn('Не удалось сохранить прогресс',error);}}}
export async function getItem(key){try{const val=await transact('readonly',s=>s.get(key));return val??null;}catch{try{return JSON.parse(localStorage.getItem(DB_NAME+':'+key)||'null');}catch{return null;}}}
export const GAME_KEY='game:block-puzzle';
export const SETTINGS_KEY='app:settings';
export async function loadGame(){const value=await getItem(GAME_KEY);return validateSave(value)?value:null;}
export async function saveGame(value){if(!validateSave(value))throw Error('Невалидное игровое состояние');await putItem(GAME_KEY,value);}
export async function loadSettings(){const value=await getItem(SETTINGS_KEY);return value&&typeof value==='object'?value:null;}
export async function saveSettings(value){await putItem(SETTINGS_KEY,value);}
// Safe, versioned JSON backup helpers for future UI/server integration.
export async function exportBackup(){return JSON.stringify({format:'muroblocks-backup',version:1,date:new Date().toISOString(),game:await loadGame(),settings:await loadSettings()},null,2);}
export async function importBackup(json){const data=JSON.parse(json);if(data?.format!=='muroblocks-backup'||data.version!==1||data.game&&!validateSave(data.game))throw Error('Неверный формат резервной копии');if(data.game)await saveGame(data.game);if(data.settings&&typeof data.settings==='object')await saveSettings(data.settings);}
