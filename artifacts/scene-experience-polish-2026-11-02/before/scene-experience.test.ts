import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIENCE, EXPERIENCE_IDS, RELICS } from '../src/sceneExperience/data';
import { ExperienceWorld } from '../src/sceneExperience/Worlds';
import { ReviewCollection, parseReviewState } from '../src/sceneExperience/state';
import { Walker } from '../src/demo3d/Navigation';
import { disposeWorld } from '../src/demo3d/SceneWorld';

function world(id: typeof EXPERIENCE_IDS[number]) {
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){}})})}});
  try{return new ExperienceWorld(id);}finally{if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document');}
}
for(const id of EXPERIENCE_IDS)test(`${id} experience: real geometry permits all room doors and collectibles, with continuous walking`,()=>{
  const w=world(id),def=EXPERIENCE[id];
  try{
    assert.ok(w.map.free(def.spawn));
    const targets=[...def.places.map(p=>({id:p.id,position:p.position})),...RELICS.filter(i=>i.scene===id).map(i=>({id:i.id,position:i.stand})),...w.rooms.flatMap(r=>r.doors.map((p,i)=>({id:`${r.id}-door-${i}`,position:p})))];
    const walker=new Walker({...def.spawn},w.map);
    for(const target of targets){
      assert.ok(w.map.free(target.position),`${id}/${target.id}: standing point is free`);
      assert.ok(walker.travel(target.position),`${id}/${target.id}: route exists`);
      for(let frame=0;frame<14000&&walker.path.length;frame++){
        walker.tick({x:0,z:0},1/60,true);
        assert.ok(w.map.free(walker.position),`${target.id}: remains outside solids`);
      }
      assert.ok(Math.hypot(walker.position.x-target.position.x,walker.position.z-target.position.z)<.16,`${target.id}: actually reached`);
    }
    for(const room of w.rooms){
      w.updateRoofs({x:room.x,z:room.z});assert.equal(room.roof.visible,false,'entry hides only the roof');assert.equal(w.root.visible,true);
      w.updateRoofs({x:room.x,z:room.z},{x:room.x,z:room.z+room.depth});
      assert.ok(room.facades[0].groups.every(group=>!group.visible),'near wall is cut away from an occupied interior');
      assert.ok(room.facades[1].groups.every(group=>group.visible),'far wall remains visible');
      w.updateRoofs({x:100,z:100});assert.equal(room.roof.visible,true,'roof restored on exit');
      assert.ok(room.facades.every(facade=>facade.groups.every(group=>group.visible)),'facades restored on exit');
    }
    assert.equal(RELICS.filter(i=>i.scene===id).length,4);
    assert.equal(w.relicModels.size,4);
  }finally{disposeWorld(w.root);}
});
test('collection toggle preserves progress; collection is idempotent, reset is scene-scoped and persistence is validated',()=>{
  let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
  const state=new ReviewCollection(storage),first=RELICS[0],other=RELICS.find(i=>i.scene==='tavern')!;
  assert.equal(state.collect(first.id),true);assert.equal(state.collect(first.id),false);
  state.setEnabled(false);assert.equal(state.collect(other.id),false);assert.equal(state.has(first.id),true);
  state.setEnabled(true);assert.equal(state.collect(other.id),true);
  const loaded=new ReviewCollection(storage);assert.equal(loaded.count(),2);
  loaded.reset('street');assert.equal(loaded.has(first.id),false);assert.equal(loaded.has(other.id),true);
  assert.equal(loaded.collect('unknown'),false);
  assert.deepEqual(parseReviewState('{broken'),{version:1,enabled:true,collected:[]});
  assert.deepEqual(parseReviewState(JSON.stringify({version:1,enabled:false,collected:[first.id,first.id,2,'unknown']})),{version:1,enabled:false,collected:[first.id]});
  const unavailable=new ReviewCollection({getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});
  assert.equal(unavailable.collect(first.id),true);
});
test('every collectible has a stable unique ID and complete paired original text',()=>{
  assert.equal(new Set(RELICS.map(i=>i.id)).size,12);
  for(const item of RELICS){for(const pair of[item.name,item.owner,item.text])assert.ok(pair.zh.trim()&&pair.en.trim());assert.ok(item.storyTags.length);}
});
