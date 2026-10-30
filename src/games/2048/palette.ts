import { resolvePalette } from '../../design/themes.js';
const rgb = (hex: string) => {
  let h=hex.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
};
const mix = (a: string,b: string,t: number) => '#'+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');
const luminance = (hex: string) => rgb(hex).map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
export const contrast = (a: string,b: string) => {const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
export function tileColors(value: number, theme: string, mode: 'light' | 'dark') {
  const p=resolvePalette(theme,mode);
  const anchors=[mix(p.surface,p.cell,.65),p.blockSingle,p.blockDouble,p.blockTriple,p.blockLine,p.blockL,p.accent];
  const exponent=Math.max(0,Math.log2(value)-1);
  let background: string;
  if(exponent<=10){const position=exponent/10*(anchors.length-1),index=Math.min(anchors.length-2,Math.floor(position));background=mix(anchors[index],anchors[index+1],position-index);}
  else background=mix(p.accent,mode==='dark'?'#f8f0e9':'#342b32',Math.min(.75,(exponent-10)*.12));
  const foreground=contrast(background,'#211e23')>=4.5?'#211e23':contrast(background,'#ffffff')>=4.5?'#ffffff':'#000000';
  return { background, color:foreground };
}
