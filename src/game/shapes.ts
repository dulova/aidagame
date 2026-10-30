import type { Cell, Group, Shape } from '../types';
export interface Definition { id: string; group: Group; cells: Cell[]; weight: number; orientations: Cell[][] }
// Coordinates, not pixel rendering, define every shape. All rotations/mirrors are deduplicated.
const raw: Omit<Definition, 'orientations'>[] = [
  {id:'square_1',group:'square_single',cells:[[0,0]],weight:15},
  {id:'square_2',group:'square_double',cells:[[0,0],[1,0],[0,1],[1,1]],weight:15},
  {id:'square_3',group:'square_triple',cells:Array.from({length:9},(_,i): Cell=>[i%3,Math.floor(i/3)]),weight:2},
  {id:'line_2',group:'line',cells:[[0,0],[1,0]],weight:10},
  {id:'line_3',group:'line',cells:[[0,0],[1,0],[2,0]],weight:12},
  {id:'line_4',group:'line',cells:[[0,0],[1,0],[2,0],[3,0]],weight:8},
  {id:'line_5',group:'line',cells:[[0,0],[1,0],[2,0],[3,0],[4,0]],weight:3},
  {id:'l_3',group:'l_shape',cells:[[0,0],[1,0],[0,1]],weight:15},
  {id:'l_4',group:'l_shape',cells:[[0,0],[1,0],[2,0],[0,1]],weight:14},
  {id:'l_5',group:'l_shape',cells:[[0,0],[1,0],[2,0],[0,1],[0,2]],weight:6}
];
const key = (cells: Cell[])=>cells.map(([x,y])=>`${x},${y}`).sort().join(';');
function normalize(cells: Cell[]): Cell[]{ const minX=Math.min(...cells.map(c=>c[0])); const minY=Math.min(...cells.map(c=>c[1]));return cells.map(([x,y]): Cell=>[x-minX,y-minY]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]); }
export function allOrientations(cells: Cell[]): Cell[][]{const found=new Map<string, Cell[]>();for(const mirrored of [false,true]){for(let turn=0;turn<4;turn++){let candidate=cells.map(([x,y]): Cell=>[mirrored?-x:x,y]);for(let i=0;i<turn;i++)candidate=candidate.map(([x,y]): Cell=>[-y,x]);candidate=normalize(candidate);found.set(key(candidate),candidate);}}return [...found.values()];}
export const CATALOG = raw.map(shape=>({...shape,orientations:allOrientations(shape.cells)}));
export const SHAPE_BY_ID = Object.fromEntries(CATALOG.map(s=>[s.id,s]));
export function shapeSize(shape: Shape | Definition){return {cols:Math.max(...shape.cells.map(c=>c[0]))+1,rows:Math.max(...shape.cells.map(c=>c[1]))+1};}
export function makeShape(groupDef: Definition,random=Math.random): Shape{const orientations=groupDef.orientations;const orientation=Math.min(orientations.length-1,Math.floor(random()*orientations.length));return {id:groupDef.id,group:groupDef.group,cells:orientations[orientation].map(([x,y])=>[x,y])};}
export function chooseWeighted(random=Math.random){ const sum=CATALOG.reduce((n,s)=>n+s.weight,0);let number=random()*sum;for(const s of CATALOG){number-=s.weight;if(number<0)return s;}return CATALOG.at(-1)!; }
