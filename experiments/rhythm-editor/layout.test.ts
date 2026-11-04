import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutNotes,hitShape,timeToY,yToTime,type BoardGeometry} from './layout';
import {createProject,serializeProject,type Note} from './model';
const board: BoardGeometry = {width:700,height:500,left:78,right:16,top:24,bottom:30,lanes:4,startMs:1000,visibleMs:8000};
const note = (id: string, atMs: number, lane=0): Note => ({id,atMs,lane,kind:'tap',durationMs:0,color:'A'});
test('playhead projection round trip preserves exact milliseconds across different views',()=>{
  for (const b of [board,{...board,startMs:330000,visibleMs:4000,height:390}]) for(const ms of [b.startMs,b.startMs+1234,b.startMs+b.visibleMs]) assert.ok(Math.abs(yToTime(timeToY(ms,b),b)-ms)<1e-7);
});
test('three near-coincident notes become separate chronological steps with exact head heights',()=>{
  const notes=[note('a',2000),note('b',2010),note('c',2020)]; const shapes=layoutNotes(notes,board);
  assert.deepEqual(shapes.map(s=>s.columns),[3,3,3]); assert.ok(shapes[0].x<shapes[1].x && shapes[1].x<shapes[2].x);
  for(const s of shapes) { assert.equal(s.headY,timeToY(s.note.atMs,board)); assert.equal(hitShape(shapes,s.x+s.width/2,s.headY,null)?.shape.note.id,s.note.id); }
  for(let i=1;i<shapes.length;i++) assert.ok(shapes[i-1].x+shapes[i-1].width<shapes[i].x-shapes[i].marker);
});
test('same-time notes remain separately selectable even when one is selected',()=>{
  const shapes=layoutNotes([note('a',2000),note('b',2000),note('c',2000)],board);
  for(const s of shapes) assert.equal(hitShape(shapes,s.x+s.width/2,s.headY,'a')?.shape.note.id,s.note.id);
});
test('long fast phrases reuse free columns rather than shrinking every note into one giant group',()=>{
  const shapes=layoutNotes(Array.from({length:100},(_,i)=>note(String(i),2000+i*180)),board);
  assert.equal(Math.max(...shapes.map(s=>s.columns)),3); assert.ok(shapes.every(s=>s.width>25)); assert.equal(shapes[3].column,0);
});
test('separated notes and different lanes retain full width; zooming in unpacks a cluster',()=>{
  const notes=[note('a',2000),note('b',2300),note('other',2000,1),note('far',5000)]; const shapes=layoutNotes(notes,board);
  assert.equal(shapes.find(s=>s.note.id==='other')!.columns,1); assert.equal(shapes.find(s=>s.note.id==='far')!.columns,1);
  assert.ok(layoutNotes(notes,{...board,visibleMs:4000}).every(s=>s.columns===1));
});
test('six narrow lanes keep packed notes inside their lane with positive independent bounds',()=>{
  const b={...board,width:343,lanes:6}; const shapes=layoutNotes(Array.from({length:5},(_,i)=>note(String(i),2000+i*10,5)),b); const laneW=(b.width-b.left-b.right)/b.lanes;
  for(const s of shapes) { assert.ok(s.width>0); assert.ok(s.x-s.marker>=b.left+5*laneW); assert.ok(s.x+s.width<=b.width-b.right); assert.equal(hitShape(shapes,s.x+s.width/2,s.headY,null)?.shape.note.id,s.note.id); }
});
test('a tap head stays selectable where an older hold body crosses it',()=>{
  const hold={...note('hold',2000),kind:'hold' as const,durationMs:3000}; const shapes=layoutNotes([hold,note('tap',4000)],board); const tap=shapes.find(s=>s.note.id==='tap')!;
  assert.equal(hitShape(shapes,tap.x+tap.width/2,tap.headY,'hold')?.shape.note.id,'tap'); const long=shapes.find(s=>s.note.id==='hold')!; assert.equal(hitShape(shapes,long.x+long.width/2,long.tailY,null)?.tail,true);
});
test('layout and hit testing never change exported data or real hold lengths',()=>{
  const p=createProject('my-shot','4k',{fileName:'audio.mp3',sha256:'a'.repeat(64),mimeType:'audio/mpeg',byteLength:1,durationMs:10000});
  p.notes=[note('a',2000),{...note('b',2010),kind:'hold',durationMs:731},note('c',2020)]; const before=serializeProject(p);
  const shapes=layoutNotes(p.notes,board); hitShape(shapes,shapes[1].x,shapes[1].tailY,null);
  assert.equal(serializeProject(p),before); assert.equal(shapes[1].tailY,timeToY(2741,board));
});
