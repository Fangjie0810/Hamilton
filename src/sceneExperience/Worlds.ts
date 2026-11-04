import * as THREE from 'three';
import { bi } from '../i18n/text';
import type { Point } from '../demo3d/Navigation';
import type { StoryNpcId } from '../story3d/StoryNpc';
import { EXPERIENCE, RELICS, type ExperienceId } from './data';
import { SceneryKit } from './SceneryKit';

export interface CastSpot { id: StoryNpcId | 'burr'; position: Point; direction: Point }
export class ExperienceWorld extends SceneryKit {
  readonly cast: CastSpot[]=[];
  constructor(readonly id:ExperienceId) {
    super();this.root.name=`experience:${id}`;
    if(id==='street')this.street();else if(id==='tavern')this.tavern();else this.ballroom();
    for(const item of RELICS.filter(item=>item.scene===id))this.relic(item);
    this.finish({x:0,z:0,...EXPERIENCE[id].bounds});this.batchDetails();
  }
  private street(){
    this.m.glass.color.setHex(0x3f4747);this.m.glass.emissive.setHex(0x69431c);
    this.m.warm.emissive.setHex(0xffa731);
    this.floor(0,0,160,150);
    const road=this.m.stone.clone();road.color.setHex(0x586364);road.map=road.map!.clone();road.map.wrapS=road.map.wrapT=THREE.RepeatWrapping;road.map.repeat.set(16,2);road.map.needsUpdate=true;
    this.box(0,-.004,4,65,.015,7,road);
    // Raised edges distinguish street from paving without making hidden collision walls.
    for(const z of [.3,7.7])for(let x=-31;x<32;x+=2)this.box(x,.02,z,1.94,.1,.23,this.m.paleWood);
    this.room('print',bi('印刷店','Print shop'),-16,-9,16,14,{brick:true});
    this.room('cloth',bi('布料铺','Cloth shop'),5,-12,14,16);
    this.room('warehouse',bi('港口仓库','Harbor warehouse'),22,10,14,18,{height:5.6,brick:true});
    this.table(-18,-10,4,1.5);this.table(-12,-13,3,1.6);this.shelf(-21,-14.8,4);
    // Hand press: timber frame, platen, screw and a stack of blank sheets.
    for(const x of [-13,-10])this.box(x,1.7,-9,.23,3.4,.30,this.m.darkWood);
    this.box(-11.5,3.3,-9,3.4,.3,.5,this.m.darkWood);this.box(-11.5,1.1,-9,3.4,.25,2,this.m.paleWood);this.block(-11.5,-9,3.4,2);
    this.cylinder(-11.5,2.3,-9,.12,.12,2,this.m.iron);this.box(-11.5,1.65,-9,2.5,.22,1.5,this.m.darkWood);
    this.box(-12,1.24,-13,.8,.09,.6,this.m.paper);this.candle(-19,-10);this.chair(-18,-11.5);
    this.table(7,-14,3.4,1.5);this.table(0,-7,1.4,3);this.shelf(8,-19,4);
    for(let i=0;i<7;i++){const c=this.cylinder(1+i*.65,1.4,-18,.25,.25,1.7,[this.m.blue,this.m.red,this.m.paper][i%3]);c.rotation.x=Math.PI/2;}
    this.table(24,7,1.5,3);for(const [x,z]of[[18,3],[19.4,3],[25,3],[26.5,3],[27,12],[18,10]])this.crate(x,z);
    this.crate(18.7,3,1.2);for(const z of [6,8,10])this.barrel(27,z);this.shelf(22,1.8,5);
    for(const [x,z]of[[-16,-1], [5,-3],[22,20]])this.nightLantern(x-2,z,3.1,true);
    for(const [x,z]of[[-21,15],[-8,17]])this.marketStall(x,z);
    for(const [x,z]of[[-28,-20],[-28,17],[-2,20],[10,20],[-9,22]])this.tree(x,z);
    for(const [x,z]of[[-28,3],[-6,3],[9,6],[13,19],[-21,14],[-5,13],[0,22]])this.nightLantern(x,z,3.2,true);
    this.pointLight(-17,2.8,-8,0xffbb65,35,12,'print');
    this.pointLight(4,2.8,-11,0xffbb65,35,12,'cloth');
    this.pointLight(22,3.3,9,0xffb55a,45,15,'warehouse');
    // Distant architecture has no navigation or interaction workload.
    for(let x=-65;x<45;x+=10)for(const z of [-32,38]){
      const h=5+(Math.abs(x)%5);this.box(x,h/2,z,8,h,9,this.m.brick);this.box(x,h+.3,z,8.7,.6,10,this.m.roof);
      for(const xx of[-2,1.5])for(const yy of[2,4])this.box(x+xx,yy,z+(z<0?4.55:-4.55),.9,1.2,.08,this.m.glass);
    }
    const water=new THREE.Mesh(new THREE.PlaneGeometry(100,160),new THREE.MeshLambertMaterial({color:0x152735}));water.rotation.x=-Math.PI/2;water.position.set(83,-.12,0);this.root.add(water);
    this.streetBoundary();
    for(const z of[-18,24]){this.box(42,.04,z,18,.12,3,this.m.wood);this.box(46,3.5,z,.15,7,.15,this.m.darkWood);}
    this.cast.push({id:'newsboy',position:{x:0,z:.2},direction:{x:0,z:1}},{id:'burr',position:{x:-7,z:6},direction:{x:1,z:0}},{id:'citizen',position:{x:-14,z:15},direction:{x:-1,z:0}},{id:'loyalist',position:{x:18,z:13},direction:{x:1,z:0}});
  }
  private tavern(){
    this.m.plaster.color.setHex(0x9d805c);this.m.brick.color.setHex(0x80543b);
    this.m.wood.color.setHex(0x7a5434);this.m.darkWood.color.setHex(0x38271b);this.m.paleWood.color.setHex(0x9d7648);
    this.m.wallCrown.color.setHex(0x523720);this.m.red.color.setHex(0x633527);
    this.m.glass.color.setHex(0x253132);this.m.glass.emissive.setHex(0x030607);
    this.m.warm.emissive.setHex(0xff8c24);
    this.floor(0,0,100,100);
    this.room('hall',bi('酒馆前厅','Tavern hall'),0,4,38,22,{back:[-10,10],height:5.3,tavern:true,customFloor:true});
    this.room('cellar',bi('储酒间','Wine store'),-10,-11,16,8,{height:4.5,sharedFront:'hall',tavern:true,customFloor:true});
    this.room('study',bi('后室','Back room'),10,-11,16,8,{height:4.5,sharedFront:'hall',tavern:true,customFloor:true});
    this.plankFloor(0,4,38,22);this.plankFloor(-10,-11,16,8);this.plankFloor(10,-11,16,8);
    this.table(-2,0,7,2.6);this.rug(-2,0,8.5,4.2);
    // Keep the four conversation positions and both circulation lanes clear.
    for(const x of[-4,-2,0]){this.chair(x,-2.1);this.mug(x,0);}
    this.candle(-.5,.4);this.candle(-4.5,-.3);
    this.barCounter(-15,1);this.shelf(-17.8,0,1.2);
    for(const z of[-3,0,4]){this.mug(-15,z,1.06);this.barrel(-17,z);}
    this.table(-10,-12,4,1.5);for(const x of[-16,-14,-6,-4])this.barrel(x,-13.5);this.shelf(-10,-14.2,6);
    this.table(10,-12,4,1.5);this.chair(10,-13.5);this.shelf(15,-14.2,4);this.candle(8.5,-12);
    for(const [x,z]of[[-11,10],[9,10]]){this.table(x,z,3,1.7);this.chair(x-2,z,Math.PI/2);this.chair(x+2,z,-Math.PI/2);this.mug(x,z);this.candle(x+.8,z);}
    this.rug(13,-.8,5.5,3);
    this.tavernHearth();
    this.tavernDetails();
    this.chandelier(-2,0,4.4);this.chandelier(9,6,4.4);
    for(const x of[-10,10])this.lantern(x,-6.8,3.1);
    this.pointLight(-2,3.6,0,0xffb55d,48,15,'hall');
    this.pointLight(9,3.6,6,0xffbb68,40,14,'hall');
    this.pointLight(-14,2.5,2,0xffad50,26,11,'hall');
    this.pointLight(-10,2.7,-11,0xffb65d,32,11,'cellar');
    this.pointLight(10,2.6,-12,0xffc478,30,11,'study');
    this.cast.push({id:'laurens',position:{x:-5.4,z:1.8},direction:{x:1,z:-.5}},{id:'lafayette',position:{x:1.8,z:-1.6},direction:{x:-1,z:1}},{id:'mulligan',position:{x:.5,z:2.4},direction:{x:-1,z:-1}},{id:'citizen',position:{x:-16.8,z:6},direction:{x:1,z:0}},{id:'loyalist',position:{x:9,z:12},direction:{x:0,z:-1}},{id:'burr',position:{x:13,z:7},direction:{x:-1,z:0}});
  }
  private ballroom(){
    this.floor(0,0,110,110);
    this.room('hall',bi('舞会大厅','Ballroom'),0,3,46,30,{back:[-14,14],height:7,brick:true,roof:false,customFloor:true});
    this.room('salon',bi('西侧会客室','West salon'),-14,-15,16,6,{height:4.3,sharedFront:'hall'});
    this.room('dressing',bi('东侧准备室','East dressing room'),14,-15,16,6,{height:4.3,sharedFront:'hall'});
    this.parquetFloor(0,3,46,30);
    // Upper galleries are scenery; the navigable side rooms remain on the ground floor.
    const gallery=this.group(true);this.box(0,5.6,-10,42,.3,3,this.m.darkWood,gallery);
    for(let x=-20;x<=20;x+=1.5)this.box(x,6.15,-8.55,.12,1.1,.12,this.m.paleWood,gallery);
    this.box(0,6.75,-8.55,42,.13,.16,this.m.paleWood,gallery);
    for(const x of[-20,20]){
      for(const z of[-8,0,8,15]){const g=this.group(true);this.box(x,3.3,z,.4,6.6,.4,this.m.darkWood,g);this.box(x,.2,z,.75,.4,.75,this.m.paleWood,g);this.lantern(x,z,3.8);}
      const beam=this.group(true);this.box(x,6.7,3,.35,.4,28,this.m.darkWood,beam);
      this.table(x,x<0?5:7,1.5,3);
      const cloth=this.group(true);this.box(x*.91,4.3,-10,.9,3.5,.08,x<0?this.m.red:this.m.blue,cloth);
    }
    this.table(-14,-16,4,1.5);this.table(14,-16,4,1.5);this.chair(-17,-16,Math.PI/2);this.chair(17,-16,-Math.PI/2);
    this.rug(-14,-15,10,4,true);this.rug(14,-15,10,4,true);
    for(const x of[-11,11])this.chandelier(x,3,6);this.chandelier(0,-4,6.2);
    for(const [x,z]of[[-20,5],[20,7],[-14,-16],[14,-16]])this.candle(x+.5,z);
    for(const x of[-14,14])this.lantern(x,-11.8,3.1);
    for(const [x,z]of[[-11,3],[11,3],[0,-4]])this.pointLight(x,5.5,z,0xffce92,24,15,'hall');
    for(const x of[-16,16]){
      const blue=new THREE.SpotLight(0x568efb,155,44,.72,.85,1.2);
      blue.position.set(x,9,-9);blue.lookAt(x*.35,0,6);
      // Local -Z preserves the same spotlight aim in the static glTF export.
      blue.target.position.set(0,0,-1);blue.add(blue.target);this.root.add(blue);
    }
    this.pointLight(-14,2.8,-15,0x8faef5,25,10,'salon');
    this.pointLight(14,2.8,-15,0x8faef5,25,10,'dressing');
    this.cast.push({id:'burr',position:{x:-12,z:10},direction:{x:1,z:-.4}},{id:'lafayette',position:{x:13,z:11},direction:{x:-1,z:0}});
  }
  private streetBoundary(){
    const g=this.group();g.name='boundary:street';
    const stone=this.m.brick.clone();stone.color.setHex(0x695f4d);
    const grass=new THREE.MeshStandardMaterial({color:0x334534,roughness:1});
    // Visible masonry and railings sit inside the navigation limit, so the player meets a real edge.
    for(const z of[-24.2,24.2]){
      this.box(0,.48,z,63.4,.96,.8,stone,g);this.box(0,1.0,z,63.6,.12,.94,this.m.stone,g);
      this.block(0,z,63.4,.8);this.box(0,-.01,z+Math.sign(z)*1.2,68,.05,1.5,grass,g);
      for(let x=-30;x<=30;x+=2.5){this.box(x,1.6,z,.10,1.2,.10,this.m.iron,g);this.sphere(x,2.23,z,.10,this.m.iron,g);}
      this.box(0,1.65,z,63,.07,.08,this.m.iron,g);
    }
    for(const [z,d]of[[-12.15,24.9],[16.15,16.9]]){
      this.box(-31.3,1.05,z,.8,2.1,d,stone,g);this.box(-31.3,2.14,z,.94,.12,d+.05,this.m.stone,g);this.block(-31.3,z,.8,d);
    }
    // A barred timber gate visibly closes the west road.
    this.box(-31.3,1.4,4,.5,2.8,7.4,this.m.darkWood,g);this.block(-31.3,4,.8,7.4);
    for(let z=.5;z<7.6;z+=.42)this.box(-30.99,1.4,z,.1,2.8,.05,this.m.paleWood,g);
    for(const y of[.65,2.1])this.box(-30.9,y,4,.12,.18,7.5,this.m.iron,g);
    this.box(-33,-.01,0,2,.05,52,grass,g);
    this.box(31.3,.17,0,.9,.34,49.2,this.m.stone,g);this.block(31.3,0,.8,49.2);
    for(let z=-24;z<=24;z+=2){this.box(31.3,.9,z,.19,1.7,.19,this.m.darkWood,g);this.sphere(31.3,1.8,z,.15,this.m.iron,g);}
    for(const y of[.7,1.45])this.box(31.3,y,0,.13,.13,49,this.m.darkWood,g);
    for(const z of[-21,-12,13,21])this.tree(-33.5,z,1.1);
    for(const x of[-25,-14,2,15,26])this.tree(x,27,1.05);
    this.nightLantern(-29.5,.6,3.4,true);this.nightLantern(29,22,3.4,true);
  }
  private tavernHearth(){
    const g=this.group(true);g.name='tavern:brick-hearth';this.block(15,-4,4.6,1.9);
    this.box(15,.08,-3.7,4.9,.16,2.5,this.m.stone,g);
    for(const x of[13.2,16.8])this.box(x,1.6,-4,.8,3.1,1.9,this.m.brick,g);
    this.box(15,3.2,-4,4.4,.7,1.9,this.m.brick,g);this.box(15,4.2,-4.2,3.1,1.3,1.5,this.m.brick,g);
    this.box(15,1.35,-4.88,2.8,2.5,.08,this.m.dark,g);
    this.box(15,2.8,-3.05,4.8,.22,.55,this.m.darkWood,g);
    this.box(15,.21,-3.9,2.8,.1,1.4,this.m.dark,g);
    const flameMaterial=new THREE.MeshBasicMaterial({color:0xf78d27});
    const emberMaterial=new THREE.MeshBasicMaterial({color:0xa7300e});
    for(let i=0;i<9;i++)this.sphere(14.1+i*.21,.31,-3.5+(i%3)*.13,.09,emberMaterial,g).scale.y=.45;
    for(let i=0;i<4;i++){
      const log=this.cylinder(14.45+i*.35,.40,-3.8,.13,.16,1.25,this.m.darkWood,g,12);log.rotation.z=Math.PI/2;log.rotation.y=(i%2?1:-1)*.5;
      const flame=this.plate([[-.18,0],[-.26,.22],[-.11,.5],[-.16,.75],[.09,.58],[.17,.94],[.24,.42],[.18,.12],[.08,0]],.06,flameMaterial,g);
      flame.rotation.set(0,(i-1.5)*.25,0);flame.position.set(14.3+i*.45,.42,-3.55);flame.scale.y=.7+(i%3)*.16;
      flame.castShadow=flame.receiveShadow=false;
    }
    for(const x of[13.8,16.2]){this.box(x,.38,-3,.10,.55,.10,this.m.iron,g);this.box(x,.24,-3.5,.09,.10,1.2,this.m.iron,g);}
    this.pointLight(15,1.35,-2.8,0xff8d39,65,13,'hall');
    for(const x of[13.5,16.5])this.candle(x,-3,2.94,g);
  }
  private tavernDetails(){
    const g=this.group();g.name='tavern:public-house-details';
    // Pewter jug and tray, a small cask rack, pegs and a framed picture without baked text.
    const pewter=new THREE.MeshStandardMaterial({color:0x8b8980,metalness:.55,roughness:.48});
    this.lathe(-15,1.07,-1,[[.14,0],[.23,.10],[.20,.43],[.12,.52],[.12,.65]],pewter,g);
    this.curve([[-14.82,1.24,-1],[-14.54,1.3,-1],[-14.54,1.65,-1],[-14.87,1.69,-1]],.035,pewter,g);
    this.cylinder(-14.8,1.08,2.2,.36,.36,.025,pewter,g,32);
    for(const z of[-5,-3.7]){this.barrel(-12,z);this.bottle(-12,1.13,z);}
    this.box(4,2.3,-6.72,3.4,.16,.12,this.m.darkWood,g);
    for(const x of[2.8,3.6,4.4,5.2])this.cylinder(x,2.2,-6.5,.04,.04,.32,this.detail.brass,g,12).rotation.x=Math.PI/2;
    this.box(4,3.7,-6.69,2.7,1.7,.15,this.m.darkWood,g);
    this.box(4,3.7,-6.59,2.38,1.39,.03,this.m.green,g);
    this.box(4,3.2,-6.56,2.1,.05,.03,this.detail.brass,g);
    const ship=this.plate([[-.8,0],[.7,0],[.45,-.18],[-.6,-.18]],.02,this.m.paleWood,g);
    ship.rotation.set(0,0,0);ship.position.set(4,3.4,-6.54);
    this.box(4,3.8,-6.52,.035,.9,.03,this.m.paleWood,g);
    for(const x of[-18.5,18.5])for(const z of[-3,5,12])this.box(x,.9,z,.18,.42,.8,this.m.darkWood,g);
  }
}
