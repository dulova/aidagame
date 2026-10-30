import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolvePalette, themes, themeOrder, patterns, darkPalettes} from '../src/design/themes.js';

const tokens=['bg','surface','soft','text','secondary','accent','accentText','selection','selectionText','cell','focus','border','blockSingle','blockDouble','blockTriple','blockLine','blockL','stamp'];
test('six independent themes with light and dark variants',()=>{
 assert.equal(themeOrder.length,6);
 assert.equal(new Set(themeOrder).size,6);
 assert.deepEqual(Object.keys(themes).sort(),[...themeOrder].sort());
 assert.deepEqual(Object.keys(darkPalettes).sort(),[...themeOrder].sort());
 for(const id of themeOrder){
  for(const mode of ['light','dark']){
   const palette=resolvePalette(id,mode);
   for(const token of tokens)assert.match(palette[token],/^#[0-9A-Fa-f]{3,8}$/u,`${id} ${mode} ${token}`);
   assert.notEqual(palette.bg,palette.cell,`${id} ${mode}: field cells must differ from background`);
  }
  assert.notEqual(resolvePalette(id,'light').bg,resolvePalette(id,'dark').bg);
 }
});
test('six selectable patterns, each uses a supplied SVG asset',()=>{
 assert.equal(patterns.length,6);
 assert.equal(patterns[0].id,'none');
 for(const p of patterns.slice(1))assert.ok(existsSync(new URL(`../icons/pattern-${p.icon}.svg`,import.meta.url)),p.name);
});
