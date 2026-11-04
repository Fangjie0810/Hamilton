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
    this.finish({x:0,z:0,...EXPERIENCE[id].bounds});
  }
  private street(){
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
    for(const [x,z]of[[-16,-1], [5,-3],[22,20]]){this.lantern(x-2,z,2.8,true);this.lantern(x+2,z,2.8,true);}
    for(const [x,z]of[[-21,15],[-8,17]]){
      this.table(x,z,5,2);for(const side of[-1,1])this.box(x+side*2.5,1.7,z,.12,3.4,.12,this.m.darkWood);
      const awning=this.box(x,3.35,z,5.5,.12,3.2,this.m.red);awning.rotation.x=.12;
      for(let i=0;i<8;i++)this.box(x-2.2+i*.62,1.35,z,.35,.25,.4,this.m.paper);
    }
    for(const [x,z]of[[-28,-20],[-28,17],[-2,20],[10,20],[-9,22]])this.tree(x,z);
    for(const [x,z]of[[-28,3],[-6,3],[9,6],[13,19]])this.lantern(x,z,3.2,true);
    // Distant architecture has no navigation or interaction workload.
    for(let x=-65;x<45;x+=10)for(const z of [-32,38]){
      const h=5+(Math.abs(x)%5);this.box(x,h/2,z,8,h,9,this.m.brick);this.box(x,h+.3,z,8.7,.6,10,this.m.roof);
      for(const xx of[-2,1.5])for(const yy of[2,4])this.box(x+xx,yy,z+(z<0?4.55:-4.55),.9,1.2,.08,this.m.glass);
    }
    const water=new THREE.Mesh(new THREE.PlaneGeometry(100,160),new THREE.MeshLambertMaterial({color:0x345868}));water.rotation.x=-Math.PI/2;water.position.set(83,-.12,0);this.root.add(water);
    for(let z=-24;z<25;z+=3)this.box(32.5,.4,z,.3,.8,.3,this.m.darkWood);
    this.box(32.5,.76,0,.16,.16,50,this.m.darkWood);
    for(const z of[-18,24]){this.box(42,.04,z,18,.12,3,this.m.wood);this.box(46,3.5,z,.15,7,.15,this.m.darkWood);}
    this.cast.push({id:'newsboy',position:{x:0,z:.2},direction:{x:0,z:1}},{id:'burr',position:{x:-7,z:6},direction:{x:1,z:0}},{id:'citizen',position:{x:-14,z:15},direction:{x:-1,z:0}},{id:'loyalist',position:{x:18,z:13},direction:{x:1,z:0}});
  }
  private tavern(){
    this.floor(0,0,100,100);
    this.room('hall',bi('酒馆前厅','Tavern hall'),0,4,38,22,{back:[-10,10],height:5.3});
    this.room('cellar',bi('储酒间','Wine store'),-10,-11,16,8,{height:4.5});
    this.room('study',bi('后室','Back room'),10,-11,16,8,{height:4.5});
    this.table(-2,0,7,2.6);this.rug(-2,0,10,6);
    // Keep the four conversation positions and both circulation lanes clear.
    for(const x of[-4,-2,0]){this.chair(x,-2.1);this.mug(x,0);}
    this.candle(-.5,.4);this.candle(-4.5,-.3);
    this.table(-15,1,2,12,1.44);this.shelf(-17.8,0,1.2);
    for(const z of[-3,0,4]){this.mug(-15,z,1.53);this.barrel(-17,z);}
    this.table(-10,-12,4,1.5);for(const x of[-16,-14,-6,-4])this.barrel(x,-13.5);this.shelf(-10,-14.2,6);
    this.table(10,-12,4,1.5);this.chair(10,-13.5);this.shelf(15,-14.2,4);this.candle(8.5,-12);
    for(const [x,z]of[[-11,10],[9,10]]){this.table(x,z,3,1.7);this.chair(x-2,z,Math.PI/2);this.chair(x+2,z,-Math.PI/2);this.mug(x,z);this.candle(x+.8,z);}
    this.rug(10,0,9,7);this.rug(0,9,4,10,true);
    const hearth=this.group(true);this.box(15,1.7,-4,4,3.4,1.4,this.m.brick,hearth);this.box(15,1,-3.25,2.7,1.7,.08,this.m.dark,hearth);this.block(15,-4,4,1.4);
    for(let i=0;i<5;i++)this.cylinder(14.2+i*.4,.5,-3,.06,.14,.7,this.m.warm,hearth);
    this.box(15,2.2,-3.1,4.4,.25,.8,this.m.paleWood,hearth);
    this.chandelier(-2,0,4.4);this.chandelier(9,6,4.4);
    for(const x of[-10,10])this.lantern(x,-6.8,3.1);
    this.cast.push({id:'laurens',position:{x:-5.4,z:1.8},direction:{x:1,z:-.5}},{id:'lafayette',position:{x:1.8,z:-1.6},direction:{x:-1,z:1}},{id:'mulligan',position:{x:.5,z:2.4},direction:{x:-1,z:-1}},{id:'citizen',position:{x:-16.8,z:6},direction:{x:1,z:0}},{id:'loyalist',position:{x:9,z:12},direction:{x:0,z:-1}},{id:'burr',position:{x:13,z:7},direction:{x:-1,z:0}});
  }
  private ballroom(){
    this.floor(0,0,110,110);
    this.room('hall',bi('舞会大厅','Ballroom'),0,3,46,30,{back:[-14,14],height:7,brick:true,roof:false});
    this.room('salon',bi('西侧会客室','West salon'),-14,-15,16,6,{height:4.3});
    this.room('dressing',bi('东侧准备室','East dressing room'),14,-15,16,6,{height:4.3});
    const circle=new THREE.Mesh(new THREE.CircleGeometry(9.2,72),this.m.paleWood);circle.rotation.x=-Math.PI/2;circle.position.set(0,.026,0);this.root.add(circle);
    for(const radius of[7.8,9.1,10.3]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.07,72),this.m.brass);ring.rotation.x=-Math.PI/2;ring.position.y=.035;this.root.add(ring);}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const line=this.box(Math.cos(a)*4.5,.038,Math.sin(a)*4.5,.025,.012,9,this.m.darkWood);line.rotation.y=Math.PI/2-a;}
    // Upper galleries are scenery; the navigable side rooms remain on the ground floor.
    const gallery=this.group(true);this.box(0,5.6,-10,42,.3,3,this.m.darkWood,gallery);
    for(let x=-20;x<=20;x+=1.5)this.box(x,6.15,-8.55,.12,1.1,.12,this.m.paleWood,gallery);
    this.box(0,6.75,-8.55,42,.13,.16,this.m.paleWood,gallery);
    for(const x of[-20,20]){
      for(const z of[-8,0,8,15]){const g=this.group(true);this.box(x,3.3,z,.4,6.6,.4,this.m.darkWood,g);this.box(x,.2,z,.75,.4,.75,this.m.paleWood,g);this.lantern(x,z,3.8);}
      const beam=this.group(true);this.box(x,6.7,3,.35,.4,28,this.m.darkWood,beam);
      this.block(x,-8,2.7,5);
      const stairs=this.group(true);for(let i=0;i<12;i++)this.box(x,(i+1)*.22,-6-i*.35,2.7,(i+1)*.44,.38,this.m.wood,stairs);
      this.table(x,x<0?5:7,1.5,3);
      const cloth=this.group(true);this.box(x*.91,4.3,-10,.9,3.5,.08,x<0?this.m.red:this.m.blue,cloth);
    }
    this.table(-14,-16,4,1.5);this.table(14,-16,4,1.5);this.chair(-17,-16,Math.PI/2);this.chair(17,-16,-Math.PI/2);
    this.rug(-14,-15,10,4,true);this.rug(14,-15,10,4,true);
    for(const x of[-11,11])this.chandelier(x,3,6);this.chandelier(0,-4,6.2);
    for(const [x,z]of[[-20,5],[20,7],[-14,-16],[14,-16]])this.candle(x+.5,z);
    for(const x of[-14,14])this.lantern(x,-11.8,3.1);
    // Small, low-detail guests are deliberate stand-ins, not invented principal portraits.
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2,x=Math.cos(a)*12,z=Math.sin(a)*9;
      this.guest(x,z,a+Math.PI,i%2===0);
    }
    this.cast.push({id:'burr',position:{x:-12,z:10},direction:{x:1,z:-.4}},{id:'lafayette',position:{x:13,z:11},direction:{x:-1,z:0}});
  }
  private guest(x:number,z:number,angle:number,dress:boolean){
    const g=this.group();g.position.set(x,0,z);g.rotation.y=angle;
    this.box(0,1.62,0,.3,.32,.3,this.m.paper,g);this.box(0,1.83,-.04,.34,.15,.35,this.m.darkWood,g);
    if(dress)this.cylinder(0,.67,0,.23,.58,1.2,this.m.blue,g,8);else{this.box(0,1.02,0,.5,.7,.32,this.m.darkWood,g);for(const side of[-1,1])this.box(side*.15,.35,0,.16,.7,.2,this.m.paper,g);}
    for(const side of[-1,1]){const arm=this.box(side*.33,1.04,.08,.12,.55,.14,dress?this.m.blue:this.m.darkWood,g);arm.rotation.z=side*.3;}
  }
}
