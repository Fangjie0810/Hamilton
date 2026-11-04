import * as THREE from 'three';
import { WorldKit } from '../demo3d/SceneWorld';
import type { Point } from '../demo3d/Navigation';
import type { BiText } from '../i18n/text';
import type { Relic } from './data';

export interface Room { id: string; name: BiText; x: number; z: number; width: number; depth: number; roof: THREE.Group; doors: Point[]; facades: { normal:Point; groups:THREE.Group[] }[] }
export class SceneryKit extends WorldKit {
  readonly rooms: Room[] = [];
  readonly relicModels = new Map<string, THREE.Group>();
  readonly m = {
    stone: this.surface('stone', 0x8b9190), brick: this.surface('brick', 0xb68c72), plaster: this.material(0xd6c5a3,true),
    wood: this.surface('wood',0x9a714d), darkWood: this.surface('wood',0x544333), paleWood:this.surface('wood',0xc09a67),
    roof: this.surface('wood',0x485d65), iron:this.material(0x303e40), brass:this.material(0xc0a36b),
    glass:this.material(0x7ba2a7,false,0x2a494e), warm:this.material(0xf5d4a0,false,0x69411e),
    paper:this.material(0xe5d5b1,true), blue:this.material(0x588692,true), red:this.material(0x8a5043,true), green:this.material(0x5a6955,true),
    leaves:this.material(0x657556,true), dark:this.material(0x241f1c), rope:this.material(0xa28b63),
  };
  private surface(kind: 'stone' | 'brick' | 'wood', color: number) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=kind==='wood'?'#84755f':'#605e55';ctx.fillRect(0,0,128,128);
    const height=kind==='brick'?16:kind==='stone'?32:128, width=kind==='brick'?40:kind==='stone'?42:16;
    for(let y=0,row=0;y<128;y+=height,row++) for(let x=-width;x<128;x+=width) {
      const shift=row%2?width/2:0, n=.55+this.random()*.3;
      ctx.fillStyle=`rgb(${Math.round(235*n)},${Math.round(225*n)},${Math.round(206*n)})`;
      ctx.fillRect(x+shift+1,y+1,width-2,height-2);
      ctx.fillStyle='rgba(255,245,217,.18)';ctx.fillRect(x+shift+2,y+2,width-4,1);
      for(let i=0;i<7;i++){ctx.fillStyle='rgba(40,31,22,.13)';ctx.fillRect(x+shift+this.random()*width,y+this.random()*height,kind==='wood'?1:3,kind==='wood'?10:1);}
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.NearestFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
    return new THREE.MeshLambertMaterial({color,map});
  }
  floor(x:number,z:number,w:number,d:number,wood=false,parent=this.root) {
    const material=(wood?this.m.wood:this.m.stone).clone();material.map=material.map!.clone();material.map.wrapS=material.map.wrapT=THREE.RepeatWrapping;material.map.repeat.set(w/(wood?6:5),d/(wood?8:5));material.map.needsUpdate=true;
    // Indoor boards sit above the exterior paving, below the actor's shadow plane.
    this.box(x,wood?-.13:-.16,z,w,.25,d,material,parent);
    if(wood) for(let zz=z-d/2+.6;zz<z+d/2;zz+=1.2) this.box(x,-.008,zz,w,.012,.025,this.m.darkWood,parent);
  }
  private wallRun(x:number,z:number,length:number,axis:'x'|'z',doors:number[],height:number,brick:boolean) {
    const groups:THREE.Group[]=[];
    const half=length/2, gap=1.8;
    const openings=doors.slice().sort((a,b)=>a-b);
    let left=-half;
    const segment=(a:number,b:number)=>{
      if(b<=a)return;
      const count=Math.ceil((b-a)/3.5), span=(b-a)/count;
      for(let i=0;i<count;i++){
        const center=a+(i+.5)*span, xx=x+(axis==='x'?center:0),zz=z+(axis==='z'?center:0);
        const group=this.group(true);groups.push(group);
        this.box(xx,.17,zz,axis==='x'?span:.46,.34,axis==='z'?span:.46,this.m.darkWood);
        this.box(xx,height/2,zz,axis==='x'?span:.35,height,axis==='z'?span:.35,brick?this.m.brick:this.m.plaster,group);
        this.box(xx,.4,zz,axis==='x'?span:.43,.8,axis==='z'?span:.43,this.m.darkWood,group);
        for(const y of [1.05,height-.12]) this.box(xx,y,zz,axis==='x'?span:.47,.16,axis==='z'?span:.47,this.m.darkWood,group);
        this.box(xx,height/2,zz,axis==='x'?.14:.49,height,axis==='z'?.14:.49,this.m.darkWood,group);
        if(span>2.5) for(const face of [-1,1]){
          const wx=xx+(axis==='z'?face*.23:0),wz=zz+(axis==='x'?face*.23:0);
          this.box(wx,2.5,wz,axis==='x'?1.28:.07,1.65,axis==='z'?1.28:.07,this.m.darkWood,group);
          this.box(wx+(axis==='z'?face*.05:0),2.5,wz+(axis==='x'?face*.05:0),axis==='x'?1.1:.04,1.43,axis==='z'?1.1:.04,this.m.glass,group);
          this.box(wx+(axis==='z'?face*.08:0),2.5,wz+(axis==='x'?face*.08:0),axis==='x'?.06:.05,1.5,axis==='z'?.06:.05,this.m.paleWood,group);
          this.box(wx+(axis==='z'?face*.08:0),2.5,wz+(axis==='x'?face*.08:0),axis==='x'?1.15:.05,.06,axis==='z'?1.15:.05,this.m.paleWood,group);
        }
        this.block(xx,zz,axis==='x'?span:.4,axis==='z'?span:.4);
      }
    };
    for(const door of openings){
      segment(left,door-gap);left=door+gap;
      const xx=x+(axis==='x'?door:0),zz=z+(axis==='z'?door:0),g=this.group(true);groups.push(g);
      this.box(xx,height-.42,zz,axis==='x'?gap*2:.48,.84,axis==='z'?gap*2:.48,this.m.darkWood,g);
      for(const side of [-1,1])this.box(xx+(axis==='x'?side*gap:0),1.7,zz+(axis==='z'?side*gap:0),.22,3.4,.22,this.m.paleWood,g);
      this.box(xx,.005,zz,axis==='x'?3.5:1,.015,axis==='z'?3.5:1,this.m.paleWood);
    }
    segment(left,half);
    return groups;
  }
  room(id:string,name:BiText,x:number,z:number,width:number,depth:number,options:{front?:number[];back?:number[];height?:number;brick?:boolean;roof?:boolean}={}) {
    const height=options.height??4.4,front=options.front??[0],back=options.back??[];
    this.floor(x,z,width,depth,true);
    const facades=[
      {normal:{x:0,z:1},groups:this.wallRun(x,z+depth/2,width,'x',front,height,!!options.brick)},
      {normal:{x:0,z:-1},groups:this.wallRun(x,z-depth/2,width,'x',back,height,!!options.brick)},
      {normal:{x:-1,z:0},groups:this.wallRun(x-width/2,z,depth,'z',[],height,!!options.brick)},
      {normal:{x:1,z:0},groups:this.wallRun(x+width/2,z,depth,'z',[],height,!!options.brick)},
    ];
    const roof=this.group(true);roof.name=`roof:${id}`;
    if(options.roof!==false){
      const rise=Math.min(width*.22,3.3),angle=Math.atan2(rise,width/2),slope=Math.hypot(width/2,rise);
      for(const side of [-1,1]){
        const panel=this.box(x+side*width/4,height+rise/2,z,slope+.5,.20,depth+1,this.m.roof,roof);panel.rotation.z=-side*angle;
        for(let dz=-depth/2;dz<=depth/2;dz+=1.1){const beam=this.box(x+side*width/4,height+rise/2+.13,z+dz,slope+.5,.08,.06,this.m.darkWood,roof);beam.rotation.z=-side*angle;}
      }
      this.box(x,height+rise+.08,z,.2,.20,depth+1.2,this.m.darkWood,roof);
      for(const side of[-1,1]){
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-width/2,0,0,width/2,0,0,0,rise,0],3));geometry.computeVertexNormals();
        const mat=this.m.darkWood.clone();mat.side=THREE.DoubleSide;const face=new THREE.Mesh(geometry,mat);face.position.set(x,height,z+side*depth/2);roof.add(face);
      }
    }
    const doors=[...front.map(dx=>({x:x+dx,z:z+depth/2})),...back.map(dx=>({x:x+dx,z:z-depth/2}))];
    this.rooms.push({id,name,x,z,width,depth,roof,doors,facades});
    return roof;
  }
  updateRoofs(position:Point,camera?:Point) {
    for(const room of this.rooms){
      const inside=Math.abs(position.x-room.x)<room.width/2+.4&&Math.abs(position.z-room.z)<room.depth/2+.4;
      room.roof.visible=!inside;
      for(const facade of room.facades){
        const facing=!!camera&&((camera.x-room.x)*facade.normal.x>room.width/2||(camera.z-room.z)*facade.normal.z>room.depth/2);
        for(const group of facade.groups)group.visible=!(inside&&facing);
      }
    }
  }
  roomAt(position:Point) {return this.rooms.find(room=>Math.abs(position.x-room.x)<room.width/2-.2&&Math.abs(position.z-room.z)<room.depth/2-.2);}
  table(x:number,z:number,w=3,d=1.6,h=1.14) {
    this.block(x,z,w,d);this.box(x,h,z,w,.16,d,this.m.paleWood);
    for(const a of [-1,1])for(const b of [-1,1])this.box(x+a*(w/2-.2),h/2,z+b*(d/2-.2),.16,h,.16,this.m.darkWood);
    this.box(x,.35,z,w-.3,.12,.16,this.m.darkWood);
  }
  chair(x:number,z:number,angle=0) {
    const g=this.group();g.position.set(x,0,z);g.rotation.y=angle;
    this.box(0,.55,0,.65,.12,.65,this.m.wood,g);this.box(0,1.05,-.3,.65,.9,.12,this.m.darkWood,g);
    for(const a of [-1,1])for(const b of [-1,1])this.box(a*.25,.27,b*.25,.09,.55,.09,this.m.darkWood,g);
    this.block(x,z,.7,.7);
  }
  barrel(x:number,z:number,y=0) {
    this.block(x,z,1,1);const g=this.group();
    this.cylinder(x,y+.56,z,.43,.48,1.1,this.m.wood,g,12);
    for(const yy of [.18,.85])this.cylinder(x,y+yy,z,.49,.49,.07,this.m.iron,g,12);
    this.cylinder(x,y+1.13,z,.43,.43,.04,this.m.paleWood,g,12);
  }
  crate(x:number,z:number,y=0,size=1.2) {
    this.block(x,z,size,size);this.box(x,y+size/2,z,size,size,size,this.m.wood);
    for(const side of [-1,1])for(const yy of [.12,size-.12])this.box(x,y+yy,z+side*(size/2+.01),size+.02,.1,.07,this.m.paleWood);
    const b=this.box(x,y+size/2,z+size/2+.05,.10,size*1.2,.07,this.m.paleWood);b.rotation.z=.7;
  }
  shelf(x:number,z:number,w:number) {
    this.block(x,z,w,.8);
    for(const side of [-1,1])this.box(x+side*(w/2-.1),1.6,z,.16,3.2,.75,this.m.darkWood);
    for(const y of [.3,1.2,2.1,3]){
      this.box(x,y,z,w,.12,.85,this.m.wood);
      if(y<3)for(let dx=-w/2+.35;dx<w/2;dx+=.65){this.cylinder(x+dx,y+.31,z,.12,.16,.5,this.m.green);this.cylinder(x+dx,y+.62,z,.06,.08,.15,this.m.brass);}
    }
  }
  lantern(x:number,z:number,y=3,post=false) {
    const g=this.group(true);
    if(post){this.box(x,y/2,z,.13,y,.13,this.m.iron,g);this.box(x+.3,y+.25,z,.7,.1,.1,this.m.iron,g);x+=.5;}
    this.box(x,y,z,.37,.55,.37,this.m.warm,g);
    for(const a of [-1,1])for(const b of [-1,1])this.box(x+a*.2,y,z+b*.2,.05,.65,.05,this.m.iron,g);
    this.box(x,y+.34,z,.5,.1,.5,this.m.iron,g);this.box(x,y-.34,z,.5,.1,.5,this.m.iron,g);
  }
  candle(x:number,z:number,y=1.23) {
    this.cylinder(x,y+.04,z,.17,.2,.08,this.m.brass);this.cylinder(x,y+.24,z,.065,.065,.4,this.m.paper);
    this.cylinder(x,y+.49,z,.005,.07,.13,this.m.warm);
  }
  mug(x:number,z:number,y=1.23) {
    this.cylinder(x,y+.17,z,.13,.11,.32,this.m.paper);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.10,.035,4,8),this.m.brass);handle.position.set(x+.14,y+.17,z);this.root.add(handle);
  }
  rug(x:number,z:number,w:number,d:number,blue=false) {
    this.box(x,.012,z,w,.016,d,blue?this.m.blue:this.m.red);
    for(const side of [-1,1])this.box(x,.023,z+side*(d/2-.14),w-.2,.008,.05,this.m.brass);
  }
  chandelier(x:number,z:number,y=5) {
    const g=this.group(true),ring=new THREE.Mesh(new THREE.TorusGeometry(1.3,.07,5,24),this.m.iron);
    ring.rotation.x=Math.PI/2;ring.position.set(x,y,z);g.add(ring);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this.box(x+Math.cos(a)*1.3,y+.24,z+Math.sin(a)*1.3,.1,.45,.1,this.m.paper,g);this.box(x+Math.cos(a)*1.3,y+.52,z+Math.sin(a)*1.3,.1,.12,.1,this.m.warm,g);}
    this.box(x,y+1,z,.06,2,.06,this.m.iron,g);
  }
  tree(x:number,z:number,scale=1) {
    this.block(x,z,1,1);this.cylinder(x,1.6*scale,z,.2,.35,3.2*scale,this.m.darkWood);
    for(let i=0;i<5;i++){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8*scale,1),this.m.leaves);mesh.position.set(x+Math.cos(i*2.4)*.8*scale,(3.2+(i%2)*.7)*scale,z+Math.sin(i*2.4)*.8*scale);mesh.castShadow=true;this.root.add(mesh);}
  }
  relic(item:Relic) {
    const g=new THREE.Group();g.name=item.id;g.position.set(item.position.x,item.height,item.position.z);this.root.add(g);this.relicModels.set(item.id,g);
    const colored=this.material(item.color),box=(x:number,y:number,z:number,w:number,h:number,d:number,mat=colored)=>this.box(x,y,z,w,h,d,mat,g);
    const cyl=(x:number,y:number,z:number,r:number,h:number,mat=colored)=>this.cylinder(x,y,z,r,r,h,mat,g,16);
    if(item.shape==='book'){box(0,.10,0,.85,.18,.65);box(0,.1,.02,.76,.10,.61,this.m.paper);box(0,.2,0,.87,.03,.67);box(-.29,.23,0,.05,.03,.5,this.m.brass);}
    if(item.shape==='letter'||item.shape==='card'){box(0,.04,0,.85,.06,.56,this.m.paper);box(.02,.08,0,.55,.015,.02,this.m.iron);if(item.shape==='letter')cyl(.2,.09,.12,.1,.04,this.m.red);}
    if(item.shape==='seal'){box(0,.03,0,.7,.04,.6,this.m.paper);cyl(0,.1,0,.23,.12,this.m.brass);cyl(0,.32,0,.13,.35);cyl(.25,.07,.16,.12,.04);}
    if(item.shape==='scissors'){for(const side of [-1,1]){const blade=box(side*.12,.07,.08,.07,.08,.65,this.m.brass);blade.rotation.y=side*.35;const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.04,5,12),this.m.brass);ring.rotation.x=Math.PI/2;ring.position.set(side*.19,.08,-.32);g.add(ring);}}
    if(item.shape==='token'){box(0,.07,0,.65,.12,.45);for(const dx of [-.16,0,.16])box(dx,.14,0,.03,.015,.25,this.m.darkWood);}
    if(item.shape==='ribbon'){for(const side of [-1,1]){const loop=new THREE.Mesh(new THREE.TorusGeometry(.22,.08,5,12),colored);loop.rotation.x=Math.PI/2;loop.scale.x=1.3;loop.position.set(side*.24,.12,0);g.add(loop);const tail=box(side*.12,.045,.3,.16,.05,.7);tail.rotation.y=side*.25;}cyl(0,.12,0,.12,.18);}
    if(item.shape==='thimble'){this.cylinder(0,.23,0,.17,.25,.45,colored,g,12);for(let i=0;i<8;i++){const a=i/8*6.28;box(Math.cos(a)*.2,.2,Math.sin(a)*.2,.04,.04,.04,this.m.iron);}}
    if(item.shape==='quill'){box(0,.03,0,.9,.04,.65,this.m.paper);cyl(-.3,.17,-.1,.18,.28,this.m.iron);const feather=box(.08,.28,.05,.18,.04,.85);feather.rotation.z=-.25;const stem=box(.08,.25,.05,.025,.05,1,this.m.brass);stem.rotation.z=-.25;}
    if(item.shape==='fan'){const fan=new THREE.Mesh(new THREE.CircleGeometry(.65,16,0,Math.PI),colored);fan.rotation.x=-Math.PI/2;fan.position.y=.06;g.add(fan);for(let i=0;i<7;i++){const a=i*Math.PI/6;const rib=box(Math.cos(a)*.30,.08,-Math.sin(a)*.30,.025,.03,.63,this.m.brass);rib.rotation.y=Math.PI/2+a;}}
    if(item.shape==='locket'){cyl(0,.1,0,.3,.12,this.m.brass);cyl(0,.17,0,.23,.03);const chain=new THREE.Mesh(new THREE.TorusGeometry(.39,.018,4,24),this.m.brass);chain.rotation.x=Math.PI/2;chain.scale.x=.65;chain.position.set(0,.03,-.5);g.add(chain);}
    if(item.shape==='button'){cyl(0,.08,0,.3,.14);for(const x of [-.09,.09])for(const z of [-.09,.09])cyl(x,.16,z,.035,.01,this.m.dark);box(.18,.03,.28,.03,.03,.4,this.m.paper);}
    const halo=new THREE.Mesh(new THREE.RingGeometry(.50,.54,32),new THREE.MeshBasicMaterial({color:0xe7c87d,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.018;g.add(halo);
    return g;
  }
}
