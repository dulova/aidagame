import { CATALOG, SHAPE_BY_ID, chooseWeighted, makeShape, shapeSize } from './shapes.js';
export const BOARD_SIDE=10;
export const SAVE_VERSION=1;
export const emptyBoard=()=>Array(BOARD_SIDE*BOARD_SIDE).fill(null);
export function canPlaceShape(board,shape,x,y){if(!shape)return false;return shape.cells.every(([dx,dy])=> {let col=x+dx,row=y+dy;return Number.isInteger(col)&&Number.isInteger(row)&&col>=0&&row>=0&&col<BOARD_SIDE&&row<BOARD_SIDE&&!board[row*BOARD_SIDE+col];});}
export function availablePositions(board,shape){const {cols,rows}=shapeSize(shape);for(let y=0;y<=BOARD_SIDE-rows;y++)for(let x=0;x<=BOARD_SIDE-cols;x++)if(canPlaceShape(board,shape,x,y))return true;return false;}
export function hasAvailableMoves(board,slots){return slots.some(s=>s && availablePositions(board,s));}
export function generateShapeSet(board,random=Math.random){
  for(let attempts=0;attempts<30;attempts++){
    const slots=Array.from({length:3},()=>makeShape(chooseWeighted(random),random));
    if(slots.some(s=>s.cells.length<=4)&&hasAvailableMoves(board,slots))return slots;
  }
  // Guaranteed termination. If even a single square cannot fit, the game will finish.
  const fallback=makeShape(SHAPE_BY_ID.square_1,random);
  const rest=Array.from({length:2},()=>makeShape(chooseWeighted(random),random));
  return [fallback,...rest];
}
export function createInitialState(random=Math.random,best=0){const board=emptyBoard();return {version:SAVE_VERSION,status:'active',board,slots:generateShapeSet(board,random),score:0,best,clearedLines:0,turns:0};}
export function findCompletedLines(board){const rows=[],cols=[];for(let row=0;row<BOARD_SIDE;row++)if(Array.from({length:BOARD_SIDE},(_,col)=>board[row*BOARD_SIDE+col]).every(Boolean))rows.push(row);for(let col=0;col<BOARD_SIDE;col++)if(Array.from({length:BOARD_SIDE},(_,row)=>board[row*BOARD_SIDE+col]).every(Boolean))cols.push(col);return {rows,cols,count:rows.length+cols.length};}
export function clearCompletedLines(board,lines){const next=[...board];for(const row of lines.rows)for(let col=0;col<BOARD_SIDE;col++)next[row*BOARD_SIDE+col]=null;for(const col of lines.cols)for(let row=0;row<BOARD_SIDE;row++)next[row*BOARD_SIDE+col]=null;return next;}
export function calculateScore(placedCells,clearedLines){return placedCells+clearedLines*10+(clearedLines>=2?5*(clearedLines-1):0);}
export function placeShape(state,slotIndex,col,row,random=Math.random){
  if(state.status!=='active'||!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>2)return {accepted:false,state};
  const shape=state.slots[slotIndex];if(!canPlaceShape(state.board,shape,col,row))return {accepted:false,state};
  const nextBoard=[...state.board];for(const [dx,dy] of shape.cells)nextBoard[(row+dy)*BOARD_SIDE+col+dx]=shape.group;
  const lines=findCompletedLines(nextBoard);const board=clearCompletedLines(nextBoard,lines);
  const gained=calculateScore(shape.cells.length,lines.count);
  const slots=state.slots.map((s,i)=>i===slotIndex?null:s);
  if(slots.every(s=>!s))slots.splice(0,3,...generateShapeSet(board,random));
  const score=state.score+gained;
  const next={...state,board,slots,score,best:Math.max(state.best,score),clearedLines:state.clearedLines+lines.count,turns:state.turns+1,status:hasAvailableMoves(board,slots)?'active':'completed'};
  return {accepted:true,state:next,points:gained,cleared:lines,placedCells:shape.cells.map(([x,y])=>(row+y)*10+(col+x))};
}
export function validateSave(value){
  if(!value||typeof value!=='object'||value.version!==SAVE_VERSION||!['active','completed'].includes(value.status))return false;
  if(!Array.isArray(value.board)||value.board.length!==100||!value.board.every(c=>c===null||['square_single','square_double','square_triple','line','l_shape'].includes(c)))return false;
  if(!Array.isArray(value.slots)||value.slots.length!==3)return false;
  for(const s of value.slots){if(s===null)continue;if(!s||typeof s.id!=='string'||!SHAPE_BY_ID[s.id]||s.group!==SHAPE_BY_ID[s.id].group||!Array.isArray(s.cells))return false;const allowed=SHAPE_BY_ID[s.id].orientations.some(orientation=>JSON.stringify(orientation)===JSON.stringify(s.cells));if(!allowed)return false;}
  return ['score','best','clearedLines','turns'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&value.best>=value.score;
}
