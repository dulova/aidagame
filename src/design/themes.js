// Each theme is a complete, independent interface AND five-group block palette.
export const themes = {
  pastel: { name: 'Пастель', bg:'#fff4f1', surface:'#fffaf9', soft:'#f2e0dc', text:'#594650', secondary:'#9a7a82', accent:'#a45169', accentText:'#ffffff', selection:'#e9aaa4', selectionText:'#713f46', cell:'#efddda', focus:'#95546c', border:'#e9d7d3', blockSingle:'#e0b06d', blockDouble:'#7eaf97', blockTriple:'#65afbc', blockLine:'#dd8d7f', blockL:'#b18fb8', stamp:'#593c49'},
  winter: { name:'Зима', bg:'#f1f6fb', surface:'#fbfdff', soft:'#e0eaf2', text:'#33495f', secondary:'#6e889d', accent:'#6587b5', accentText:'#ffffff', selection:'#b4c8e2', selectionText:'#314b6e', cell:'#dbe7ef', focus:'#466caa', border:'#d0dce9', blockSingle:'#d3a0ba', blockDouble:'#a3bcdc', blockTriple:'#7abac9', blockLine:'#a6a1ce', blockL:'#638bb9', stamp:'#29425d'},
  spring: {name:'Весна',bg:'#f6faef',surface:'#fefff8',soft:'#e6efd9',text:'#435744',secondary:'#7c9279',accent:'#659f79',accentText:'#fff',selection:'#b9ddac',selectionText:'#3d6b46',cell:'#e1ebd8',focus:'#4d8567',border:'#d6e6d2',blockSingle:'#f0b47f',blockDouble:'#a4c77a',blockTriple:'#90c9b8',blockLine:'#dba2b8',blockL:'#9e9fcf',stamp:'#345342'},
  summer: {name:'Лето',bg:'#fff8eb',surface:'#fffdf5',soft:'#f6e7c8',text:'#654c3b',secondary:'#937966',accent:'#e58569',accentText:'#fff',selection:'#f8c1a2',selectionText:'#8b5139',cell:'#f2e4c9',focus:'#bc734e',border:'#eadcc7',blockSingle:'#efb953',blockDouble:'#87bb72',blockTriple:'#72c8c7',blockLine:'#ed8e6c',blockL:'#b89bc9',stamp:'#684733'},
  autumn: {name:'Осень',bg:'#faf1e8',surface:'#fffaf3',soft:'#ead7c8',text:'#554538',secondary:'#90745f',accent:'#ae6e4e',accentText:'#fff',selection:'#e0b491',selectionText:'#72452c',cell:'#e8d7c9',focus:'#9c6745',border:'#dfcabb',blockSingle:'#dcb05a',blockDouble:'#89976a',blockTriple:'#ad987b',blockLine:'#c97451',blockL:'#a66573',stamp:'#503e32'},
  aidanastya: {name:'Ай Да Настя',bg:'#FAF7F5',surface:'#FFFFFF',soft:'#E8DDD5',text:'#202020',secondary:'#8d735f',accent:'#CA8141',accentText:'#ffffff',selection:'#e7bd9c',selectionText:'#773d20',cell:'#e9ded5',focus:'#CE4320',border:'#e3d4c9',blockSingle:'#e2b267',blockDouble:'#8fa986',blockTriple:'#86b6bd',blockLine:'#CE4320',blockL:'#a08870',stamp:'#442f23'}
};
export const themeOrder = ['winter','spring','summer','autumn','pastel','aidanastya'];
export const patterns = [{id:'none',name:'Однотонный',icon:null},{id:'paw',name:'Лапка',icon:'foot'},{id:'snow',name:'Снежинка',icon:'snow'},{id:'heart',name:'Сердечки',icon:'heart'},{id:'leaf',name:'Лист',icon:'leave'},{id:'pumpkin',name:'Тыковка',icon:'pumpkin'}];
export const blockTokenByGroup = {square_single:'blockSingle',square_double:'blockDouble',square_triple:'blockTriple',line:'blockLine',l_shape:'blockL'};
// A separate, considered dark palette for every visual theme. The 5 groups keep their IDs.
export const darkPalettes = {
  pastel: {bg:'#25232c',surface:'#302d38',soft:'#413843',text:'#f9ecf1',secondary:'#c5abb9',accent:'#dd9cad',accentText:'#30222a',selection:'#705362',selectionText:'#f8d9e3',cell:'#48404c',focus:'#e9afc5',border:'#554650',blockSingle:'#edbc82',blockDouble:'#94c5ad',blockTriple:'#89c9d3',blockLine:'#efaa9b',blockL:'#c6a4d0',stamp:'#261f2c'},
  winter: {bg:'#1c2937',surface:'#253748',soft:'#344b5d',text:'#eff7ff',secondary:'#afc1d4',accent:'#a0c1e5',accentText:'#233447',selection:'#476783',selectionText:'#eef7ff',cell:'#3b5062',focus:'#cce5ff',border:'#4c6070',blockSingle:'#e6b1ce',blockDouble:'#a7c5e6',blockTriple:'#8ccdd8',blockLine:'#bdb6e2',blockL:'#86b0da',stamp:'#243142'},
  spring: {bg:'#1f2b26',surface:'#2b3930',soft:'#3d4c3d',text:'#f0f8eb',secondary:'#b6c7aa',accent:'#a5d4a6',accentText:'#263c2c',selection:'#536e54',selectionText:'#edffe6',cell:'#475b48',focus:'#cee5bd',border:'#556953',blockSingle:'#f1bd93',blockDouble:'#b5d795',blockTriple:'#a0dbca',blockLine:'#e4b4c5',blockL:'#bab7e3',stamp:'#273f32'},
  summer: {bg:'#31271f',surface:'#403429',soft:'#554334',text:'#fff5df',secondary:'#d5b99b',accent:'#f5ad80',accentText:'#402818',selection:'#85634e',selectionText:'#fff0da',cell:'#625040',focus:'#ffd09f',border:'#6c5645',blockSingle:'#f6cc72',blockDouble:'#a5ce7f',blockTriple:'#91d8d3',blockLine:'#f4a28c',blockL:'#ceb3db',stamp:'#3f2f25'},
  autumn: {bg:'#2f261f',surface:'#3e3028',soft:'#554237',text:'#faeadd',secondary:'#cfb29c',accent:'#dda17d',accentText:'#392519',selection:'#725344',selectionText:'#fbe4d4',cell:'#5e4a3d',focus:'#ecc5a3',border:'#694e3f',blockSingle:'#f1c571',blockDouble:'#a8b483',blockTriple:'#cfb79b',blockLine:'#e39572',blockL:'#c88c9c',stamp:'#392c27'},
  aidanastya: {bg:'#24201d',surface:'#322b26',soft:'#493b32',text:'#faf1e9',secondary:'#c7ae98',accent:'#e4a36a',accentText:'#2c211c',selection:'#806042',selectionText:'#fff0e1',cell:'#58483d',focus:'#ed956b',border:'#675245',blockSingle:'#f2be7d',blockDouble:'#aec3a0',blockTriple:'#9acdd0',blockLine:'#e47e60',blockL:'#c4a48a',stamp:'#372920'}
};
export function resolvePalette(id, mode='light') {
  return mode==='dark' ? darkPalettes[id] || darkPalettes.pastel : themes[id] || themes.pastel;
}
export function applyTheme(id,mode='light') {
  const theme=resolvePalette(id,mode);
  const names = {bg:'bg',surface:'surface',soft:'soft',text:'text',secondary:'secondary',accent:'accent',accentText:'accent-text',selection:'selection',selectionText:'selection-text',cell:'cell',border:'border',focus:'focus',blockSingle:'block-single',blockDouble:'block-double',blockTriple:'block-triple',blockLine:'block-line',blockL:'block-l',stamp:'stamp'};
  for (const [key,token] of Object.entries(names)) document.documentElement.style.setProperty(`--${token}`,theme[key]);
  document.documentElement.dataset.theme=id;
  document.documentElement.dataset.mode=mode;
  document.documentElement.style.colorScheme=mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.bg);
}
