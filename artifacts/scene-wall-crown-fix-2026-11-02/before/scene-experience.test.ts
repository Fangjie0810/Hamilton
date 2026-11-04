import test from 'node:test';
import * as THREE from 'three';
import { StableCutaway } from '../src/sceneExperience/StableCutaway';
import { REVIEW_ZOOM, zoomPercent, zoomRadius, clampZoomRadius, withinDistance } from '../src/sceneExperience/viewState';
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
      assert.ok(room.facades[0].groups.every(group=>group.userData.roomCutaway),'near wall is cut away from an occupied interior');
      assert.ok(room.facades[1].groups.every(group=>!group.userData.roomCutaway),'far wall remains visible');
      w.updateRoofs({x:100,z:100});assert.equal(room.roof.visible,true,'roof restored on exit');
      assert.ok(room.facades.every(facade=>facade.groups.every(group=>!group.userData.roomCutaway)),'facades restored on exit');
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

test('shared interior walls are single geometry and cutaway boundaries resist doorway and camera jitter',()=>{
  for(const id of ['tavern','ballroom'] as const){
    const w=world(id);
    try{
      const hall=w.rooms[0],side=w.rooms[1];
      assert.ok(side.facades[0].groups.length>0);
      assert.ok(side.facades[0].groups.every(g=>hall.facades[1].groups.includes(g)),'same wall objects on both sides, never coplanar duplicates');
      const p={x:side.x,z:side.z+side.depth/2};
      w.updateRoofs(p,{x:side.x,z:20});assert.equal(side.inside,true);
      for(const offset of [.3,.2,.5,.15,.7]){w.updateRoofs({x:p.x,z:p.z+offset},{x:side.x,z:20});assert.equal(side.inside,true);}
      w.updateRoofs({x:p.x,z:p.z+1},{x:side.x,z:20});assert.equal(side.inside,false);
      const occupied={x:hall.x,z:hall.z};
      w.updateRoofs(occupied,{x:0,z:hall.z+hall.depth/2+2});assert.equal(hall.facades[0].cut,true);
      for(const offset of [.1,-.2,.4,-.6]){w.updateRoofs(occupied,{x:0,z:hall.z+hall.depth/2+offset});assert.equal(hall.facades[0].cut,true);}
      w.updateRoofs(occupied,{x:0,z:hall.z+hall.depth/2-1});assert.equal(hall.facades[0].cut,false);
    }finally{disposeWorld(w.root);}
  }
});
test('solid cutaway holds briefly, clips shadows, restores original materials and never enables dithering',()=>{
  const group=new THREE.Group(),original=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(4,4,.4),original);mesh.position.set(0,2,2);group.add(mesh);
  const cutaway=new StableCutaway([group]),camera=new THREE.PerspectiveCamera();camera.position.set(0,3,8);
  try{
    for(let i=0;i<30;i++)cutaway.update(camera,new THREE.Vector3(0,0,0),1/60,false);
    const material=mesh.material as THREE.Material,plane=material.clippingPlanes![0];
    assert.equal(material.transparent,false);assert.equal(material.alphaHash,false);assert.equal(material.clipShadows,true);assert.ok(plane.constant<.7);
    const before=plane.constant;camera.position.set(20,3,8);cutaway.update(camera,new THREE.Vector3(20,0,0),.05,false);assert.ok(plane.constant<=before+.001,'brief loss does not flash the wall back');
    for(let i=0;i<100;i++)cutaway.update(camera,new THREE.Vector3(20,0,0),1/60,false);
    assert.ok(plane.constant>4);
  }finally{cutaway.dispose();assert.equal(mesh.material,original);mesh.geometry.dispose();original.dispose();}
});
test('zoom stays within the approved 100–140 percent range and marker distances have a dead band',()=>{
  assert.equal(zoomRadius(100),27);assert.equal(zoomPercent(27),100);
  for(const radius of[27/1.4,22,26,27])assert.ok(Math.abs(zoomRadius(zoomPercent(radius))-radius)<1e-9);
  assert.equal(REVIEW_ZOOM.minPercent,100);assert.equal(REVIEW_ZOOM.maxPercent,140);assert.equal(clampZoomRadius(76),27);assert.equal(clampZoomRadius(12),27/1.4);
  assert.equal(zoomRadius(1),REVIEW_ZOOM.maxRadius);assert.equal(zoomRadius(999),REVIEW_ZOOM.minRadius);assert.equal(zoomRadius(NaN),27);
  assert.equal(withinDistance(5.6,false,5.5,6.1),false);assert.equal(withinDistance(5.6,true,5.5,6.1),true);assert.equal(withinDistance(6.2,true,5.5,6.1),false);
});
test('refined assets preserve pickup heights and the removed stairs no longer block ballroom aisles',()=>{
  const tavern=world('tavern'),ballroom=world('ballroom');
  try{
    const counter=tavern.root.getObjectByName('furniture:bar-counter')!;assert.equal(counter.userData.counterTop,1.06);
    const thimble=RELICS.find(i=>i.shape==='thimble')!;assert.ok(thimble.height>=1.06&&thimble.height<1.1);
    assert.ok(ballroom.map.free({x:-20,z:-8}));assert.ok(ballroom.map.free({x:20,z:-8}));
    assert.ok(ballroom.root.getObjectByName('floor:herringbone-parquet'));
    for(const w of[tavern,ballroom])for(const group of w.relicModels.values()){
      group.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(group);assert.ok(Number.isFinite(bounds.max.y));assert.ok(bounds.max.y-bounds.min.y>.05);
    }
  }finally{disposeWorld(tavern.root);disposeWorld(ballroom.root);}
});
test('tabletop details fit their supporting furniture and produce retains small object proportions',()=>{
  const w=world('street'),tavern=world('tavern');
  try{
    for(const scene of[w,tavern]){
      scene.root.updateMatrixWorld(true);
      scene.root.traverse(object=>{
        if(object.name==='furniture:joined-table')assert.ok(new THREE.Box3().setFromObject(object).max.y<1.30,'table fittings do not protrude above the display surface');
        if(object instanceof THREE.Mesh&&object.geometry.type==='SphereGeometry'&&!Array.isArray(object.material)&&'color' in object.material){
          const color=(object.material as THREE.MeshStandardMaterial).color.getHex();
          if([0x9d4536,0xc69d50,0x7e8d49].includes(color))assert.ok(new THREE.Box3().setFromObject(object).max.y<1.65,'fruit remains inside the produce display height');
        }
      });
    }
    const letter=tavern.relicModels.get('tavern-laurens-letter')!;assert.ok(new THREE.Box3().setFromObject(letter).max.y<1.43,'wax seal remains flat against the letter');
  }finally{disposeWorld(w.root);disposeWorld(tavern.root);}
});

test('cutaway walls retain a solid capped plinth with no open clipped edges or overlapping corner tops',()=>{
  for(const id of EXPERIENCE_IDS){
    const w=world(id);
    try{
      w.root.updateMatrixWorld(true);
      const facades=new Set(w.rooms.flatMap(r=>r.facades.flatMap(f=>f.groups)));
      for(const group of facades){
        const bounds=new THREE.Box3().setFromObject(group);
        assert.ok(bounds.min.y>.67,`${id}: the .62 cut plane fully removes upper wall skins and studs`);
      }
      const caps:THREE.Mesh[]=[];
      w.root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name==='wall-cap')caps.push(object);});
      assert.ok(caps.length>0);
      for(const cap of caps){
        const box=new THREE.Box3().setFromObject(cap);
        assert.ok(Math.abs(box.max.y-.68)<1e-6);assert.equal(cap.receiveShadow,false);
        assert.ok(!facades.has(cap.parent as THREE.Group),'solid cap is outside the moving cutaway');
        for(const other of caps){if(other===cap)continue;const overlap=box.clone().intersect(new THREE.Box3().setFromObject(other));
          if(!overlap.isEmpty())assert.ok(overlap.max.x-overlap.min.x<1e-6||overlap.max.z-overlap.min.z<1e-6,`${id}: coplanar cap tops never overlap`);
        }
      }
    }finally{disposeWorld(w.root);}
  }
});
