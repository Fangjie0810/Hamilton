import * as THREE from 'three';
import { AssetDetail } from './AssetDetail';
import type { Point } from '../demo3d/Navigation';
import type { BiText } from '../i18n/text';
import type { Relic } from './data';

export interface Room { id: string; name: BiText; x: number; z: number; width: number; depth: number; roof: THREE.Group; doors: Point[]; inside:boolean; facades: { normal:Point; groups:THREE.Group[]; cut?:boolean }[] }
export class SceneryKit extends AssetDetail {
  readonly rooms: Room[] = [];
  readonly relicModels = new Map<string, THREE.Group>();
  readonly m = {
    stone: this.surface('stone', 0x8b9190), brick: this.surface('brick', 0xb68c72), plaster: new THREE.MeshStandardMaterial({color:0xd6c5a3,roughness:.96}),
    wood: this.surface('wood',0x9a714d), darkWood: this.surface('wood',0x544333), paleWood:this.surface('wood',0xc09a67),
    roof: this.surface('wood',0x485d65), iron:this.material(0x303e40), brass:this.material(0xc0a36b),
    glass:new THREE.MeshStandardMaterial({color:0x789a9f,metalness:.18,roughness:.24,emissive:0x15282d}), warm:this.material(0xf5d4a0,false,0x69411e),
    paper:this.material(0xe5d5b1,true), blue:this.material(0x588692,true), red:this.material(0x8a5043,true), green:this.material(0x5a6955,true),
    leaves:this.material(0x657556,true), dark:this.material(0x241f1c), rope:this.material(0xa28b63),
  };
  private surface(kind: 'stone' | 'brick' | 'wood', color: number) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=kind==='wood'?'#84755f':'#605e55';ctx.fillRect(0,0,512,512);
    const height=kind==='brick'?16:kind==='stone'?128:512, width=kind==='brick'?80:kind==='stone'?168:512;
    for(let y=0,row=0;y<512;y+=height,row++) for(let x=-width;x<512;x+=width) {
      const shift=row%2?width/2:0, n=kind==='brick'?.80+this.random()*.16:.65+this.random()*.25;
      ctx.fillStyle=`rgb(${Math.round(235*n)},${Math.round(225*n)},${Math.round(206*n)})`;
      ctx.fillRect(x+shift+1,y+1,width-2,height-2);
      ctx.fillStyle='rgba(255,245,217,.18)';ctx.fillRect(x+shift+2,y+2,width-4,1);
      for(let i=0;i<(kind==='wood'?230:25);i++){ctx.fillStyle='rgba(40,31,22,.13)';ctx.fillRect(x+shift+this.random()*width,y+this.random()*height,kind==='wood'?1:3,kind==='wood'?60+this.random()*160:2);}
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;map.anisotropy=8;map.minFilter=THREE.LinearMipmapLinearFilter;
    return new THREE.MeshStandardMaterial({color,map,roughness:kind==='wood'?.76:.92});
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
        const group=this.group(true);groups.push(group);group.userData.wallCenterX=xx;
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
          this.rounded(wx+(axis==='z'?face*.10:0),1.64,wz+(axis==='x'?face*.10:0),axis==='x'?1.48:.3,.12,axis==='z'?1.48:.3,this.m.paleWood,group);
          for(const y of[2.14,2.86])this.box(wx+(axis==='z'?face*.085:0),y,wz+(axis==='x'?face*.085:0),axis==='x'?1.13:.055,.025,axis==='z'?1.13:.055,this.m.paleWood,group);
        }
        this.block(xx,zz,axis==='x'?span:.4,axis==='z'?span:.4);
      }
    };
    for(const door of openings){
      segment(left,door-gap);left=door+gap;
      const xx=x+(axis==='x'?door:0),zz=z+(axis==='z'?door:0),g=this.group(true);groups.push(g);g.userData.wallCenterX=xx;
      this.box(xx,height-.42,zz,axis==='x'?gap*2:.48,.84,axis==='z'?gap*2:.48,this.m.darkWood,g);
      for(const side of [-1,1])this.box(xx+(axis==='x'?side*gap:0),1.7,zz+(axis==='z'?side*gap:0),.22,3.4,.22,this.m.paleWood,g);
      this.box(xx,.005,zz,axis==='x'?3.5:1,.015,axis==='z'?3.5:1,this.m.paleWood);
    }
    segment(left,half);
    return groups;
  }
  room(id:string,name:BiText,x:number,z:number,width:number,depth:number,options:{front?:number[];back?:number[];height?:number;brick?:boolean;roof?:boolean;sharedFront?:string;customFloor?:boolean}={}) {
    const height=options.height??4.4,front=options.front??[0],back=options.back??[];
    if(!options.customFloor)this.floor(x,z,width,depth,true);
    const facades=[
      {normal:{x:0,z:1},groups:options.sharedFront ? this.rooms.find(room=>room.id===options.sharedFront)!.facades[1].groups.filter(group=>Math.abs(group.userData.wallCenterX-x)<width/2) : this.wallRun(x,z+depth/2,width,'x',front,height,!!options.brick)},
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
    this.rooms.push({id,name,x,z,width,depth,roof,doors,facades,inside:false});
    return roof;
  }
  updateRoofs(position:Point,camera?:Point) {
    for(const group of this.occluders)group.userData.roomCutaway=false;
    for(const room of this.rooms){
      const margin=room.inside?.85:.25;
      const inside=Math.abs(position.x-room.x)<room.width/2+margin&&Math.abs(position.z-room.z)<room.depth/2+margin;
      room.inside=inside;
      room.roof.visible=!inside;
      for(const facade of room.facades){
        const extent=facade.normal.x?room.width/2:room.depth/2;
        const distance=camera?(camera.x-room.x)*facade.normal.x+(camera.z-room.z)*facade.normal.z:-Infinity;
        facade.cut=inside&&distance>extent+(facade.cut?-.8:.8);
        for(const group of facade.groups)if(facade.cut)group.userData.roomCutaway=true;
      }
    }
  }
  roomAt(position:Point) {return this.rooms.find(room=>Math.abs(position.x-room.x)<room.width/2-.2&&Math.abs(position.z-room.z)<room.depth/2-.2);}
  table(x:number,z:number,w=3,d=1.6,h=1.14) {
    this.block(x,z,w,d);const g=this.group();g.name='furniture:joined-table';
    this.rounded(x,h-.045,z,w,.15,d,this.m.darkWood,g,.04);
    const boards=Math.max(3,Math.round(d/.35));
    for(let i=0;i<boards;i++)this.rounded(x,h+.045,z-d/2+(i+.5)*d/boards,w-.025,.07,d/boards-.014,this.m.paleWood,g,.02);
    for(const a of[-1,1])for(const b of[-1,1]){
      const xx=x+a*(w/2-.21),zz=z+b*(d/2-.21);
      this.lathe(xx,0,zz,[[.10,0],[.11,.10],[.065,.22],[.075,h*.65],[.11,h*.78],[.11,h]],this.m.darkWood,g);
      this.sphere(xx,h+.085,zz,.025,this.detail.brass,g).scale.y*=.2;
    }
    for(const side of[-1,1])this.box(x,h-.23,z+side*(d/2-.14),w-.2,.22,.10,this.m.wood,g);
    this.box(x,.30,z,w-.35,.09,.12,this.m.darkWood,g);
  }
  chair(x:number,z:number,angle=0) {
    const g=this.group();g.position.set(x,0,z);g.rotation.y=angle;
    this.rounded(0,.55,0,.72,.13,.72,this.m.wood,g,.045);
    for(const side of[-1,1]){this.lathe(side*.28,0,-.28,[[.05,0],[.045,.5],[.05,1.25]],this.m.darkWood,g);this.box(side*.28,.27,.27,.07,.55,.07,this.m.darkWood,g);}
    this.rounded(0,1.24,-.28,.70,.12,.11,this.m.paleWood,g);
    for(const x of[-.16,0,.16])this.cylinder(x,.91,-.28,.023,.023,.58,this.m.darkWood,g,12);
    this.box(0,.24,0,.56,.06,.06,this.m.darkWood,g);this.block(x,z,.7,.7);
  }
  barrel(x:number,z:number,y=0) {
    this.block(x,z,1,1);const g=this.group();g.name='furniture:staved-barrel';
    this.lathe(x,y,z,[[0,0],[.41,0],[.46,.12],[.51,.52],[.49,.9],[.43,1.1],[0,1.1]],this.m.wood,g);
    for(const yy of[.13,.32,.81,1.02])this.torus(x,y+yy,z,yy>.4&&yy<.9?.495:.454,.028,this.detail.steel,g);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;this.curve([[x+Math.cos(a)*.412,y+.02,z+Math.sin(a)*.412],[x+Math.cos(a)*.512,y+.53,z+Math.sin(a)*.512],[x+Math.cos(a)*.431,y+1.09,z+Math.sin(a)*.431]],.005,this.m.darkWood,g);}
    this.cylinder(x,y+1.105,z,.406,.406,.02,this.m.paleWood,g,32);this.cylinder(x+.17,y+1.125,z,.065,.065,.02,this.m.darkWood,g,16);
  }
  crate(x:number,z:number,y=0,size=1.2) {
    this.block(x,z,size,size);const g=this.group();g.name='furniture:slatted-crate';
    for(const a of[-1,1])for(const b of[-1,1])this.rounded(x+a*(size/2-.07),y+size/2,z+b*(size/2-.07),.12,size,.12,this.m.darkWood,g);
    for(let row=0;row<5;row++)for(const side of[-1,1]){
      const yy=y+(row+.5)*size/5;this.rounded(x,yy,z+side*size/2,size,.18,.065,this.m.wood,g,.015);this.rounded(x+side*size/2,yy,z,.065,.18,size,this.m.wood,g,.015);
      for(const dx of[-.42,.42])this.sphere(x+dx*size,yy,z+side*(size/2+.035),.016,this.detail.steel,g);
    }
    for(let row=0;row<5;row++)this.box(x,y+size,z-size/2+(row+.5)*size/5,size,.07,size/5-.015,this.m.paleWood,g);
    const brace=this.rounded(x,y+size/2,z+size/2+.06,.10,size*1.15,.06,this.m.paleWood,g);brace.rotation.z=.65;
  }
  shelf(x:number,z:number,w:number) {
    this.block(x,z,w,.8);const g=this.group();g.name='furniture:stocked-shelf';
    for(const side of[-1,1])this.rounded(x+side*(w/2-.08),1.5,z,.16,3,.8,this.m.darkWood,g);
    for(const y of[.3,1.15,2,2.85]){
      this.rounded(x,y,z,w,.12,.86,this.m.wood,g);this.box(x,y+.07,z-.39,w,.09,.05,this.m.paleWood,g);
      if(y<2.8)for(let dx=-w/2+.28;dx<w/2-.1;dx+=.47)this.bottle(x+dx,y+.07,z,this.detail.glass,g);
    }
    const brace=this.box(x,1.5,z-.44,.07,Math.hypot(w,2.8),.06,this.m.paleWood,g);brace.rotation.z=-Math.atan2(w,2.8);
  }
  marketStall(x:number,z:number){
    this.table(x,z,5,2,1.02);const g=this.group();g.name='market:produce-shelf';
    for(const side of[-1,1]){this.rounded(x+side*2.45,1.6,z,.14,3.2,.14,this.m.darkWood,g);this.sphere(x+side*2.45,3.25,z,.13,this.m.paleWood,g);}
    for(let i=0;i<10;i++){
      const stripe=this.rounded(x-2.475+i*.55,3.18,z, .55,.055,3.15,i%2?this.m.paper:this.m.red,g,.018);stripe.rotation.x=.12;
      this.rounded(x-2.475+i*.55,2.99,z+1.54,.55,.30,.045,i%2?this.m.paper:this.m.red,g,.02);
    }
    this.box(x,2.96,z+1.50,5.7,.07,.08,this.m.darkWood,g);
    const colors=[0x9d4536,0xc69d50,0x7e8d49].map(color=>new THREE.MeshStandardMaterial({color,roughness:.65}));
    for(let tray=0;tray<3;tray++){
      const xx=x+(tray-1)*1.5;this.rounded(xx,1.12,z,1.34,.10,1.5,this.m.darkWood,g);
      for(const side of[-1,1]){this.rounded(xx+side*.65,1.27,z,.07,.30,1.5,this.m.paleWood,g);this.rounded(xx,1.27,z+side*.7,1.3,.30,.07,this.m.paleWood,g);}
      for(let row=0;row<3;row++)for(let col=0;col<3;col++){
        const px=xx+(col-1)*.34,pz=z+(row-1)*.36;const fruit=this.sphere(px,1.42,pz,.17,colors[tray],g);fruit.scale.y*=tray===1?1.2:.88;
        this.cylinder(px,1.58,pz,.015,.02,.08,this.m.darkWood,g,8);
      }
    }
    for(let i=0;i<5;i++)this.rounded(x-2+i, .36,z,.65,.45,1.1,this.m.paper,g,.14);
    this.box(x,.11,z,4.8,.11,1.8,this.m.darkWood,g);
  }
  barCounter(x:number,z:number){
    // 1.06 top, compared with the previous 1.52: comfortably below the actor's shoulders.
    this.block(x,z,1.8,12);const g=this.group();g.name='furniture:bar-counter';g.userData.counterTop=1.06;
    this.rounded(x,.48,z,1.64,.94,11.8,this.m.darkWood,g,.06);
    for(let i=0;i<6;i++){
      const zz=z-5+i*2;this.rounded(x+.84,.50,zz,.06,.74,1.75,this.m.paleWood,g,.02);this.rounded(x+.88,.50,zz,.035,.59,1.55,this.m.wood,g,.015);
      for(const side of[-1,1])this.box(x+.91,.50,zz+side*.73,.025,.58,.025,this.detail.brass,g);
    }
    this.rounded(x,.99,z,2,.14,12.15,this.m.paleWood,g,.045);
    for(const zz of[z-4.5,z,z+4.5])this.curve([[x+1,.12,zz],[x+1.28,.16,zz],[x+1.28,.28,zz]],.035,this.detail.brass,g);
    this.curve([[x+1.28,.28,z-5.6],[x+1.28,.28,z+5.6]],.045,this.detail.brass,g);
    for(const zz of[z-3,z+3]){this.bottle(x-.35,1.065,zz,this.detail.glass,g);this.cylinder(x+.3,1.07,zz,.29,.29,.035,this.detail.brass,g,32);}
  }
  parquetFloor(x:number,z:number,width:number,depth:number){
    const g=this.group();g.name='floor:herringbone-parquet';
    this.box(x,-.165,z,width,.30,depth,this.m.darkWood,g);
    const tones=[0x8a603c,0x967049,0xa37a50,0xb0875d,0x9e724a,0xb68c62].map(color=>{const m=this.m.wood.clone();m.color.setHex(color);return m;});
    const length=1.6,board=.4;
    for(let i=-35;i<=35;i++)for(let j=-85;j<=85;j++){
      const xx=i*length+j*board,zz=i*length-j*board;
      for(const [cx,cz,w,d]of[[xx+length/2,zz+board/2,length,board],[xx+length-board/2,zz+board+length/2,board,length]]){
        const left=Math.max(cx-w/2,-width/2),right=Math.min(cx+w/2,width/2),back=Math.max(cz-d/2,-depth/2),front=Math.min(cz+d/2,depth/2);
        if(right-left<.03||front-back<.03)continue;
        this.box(x+(left+right)/2,-.021,z+(back+front)/2,right-left-.014,.032,front-back-.014,tones[Math.abs(i*7+j*3)%tones.length],g);
      }
    }
    for(const radius of[8.8,9.05,9.20]){const ring=this.mesh(new THREE.RingGeometry(radius,radius+.035,128),this.detail.brass,g,0,-.001,0);ring.rotation.x=-Math.PI/2;ring.receiveShadow=true;ring.castShadow=false;}
    const center=this.mesh(new THREE.CircleGeometry(.8,64),this.m.darkWood,g,0,-.001,0);center.rotation.x=-Math.PI/2;center.castShadow=false;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const shape=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(-.1,.25),new THREE.Vector2(0,.7),new THREE.Vector2(.1,.25)]);const mesh=this.mesh(new THREE.ShapeGeometry(shape),i%2?this.m.paleWood:this.detail.brass,g,0,.001,0);mesh.rotation.set(-Math.PI/2,0,a);mesh.castShadow=false;}
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
    this.relicAsset(item,g);
    const halo=new THREE.Mesh(new THREE.RingGeometry(.50,.54,32),new THREE.MeshBasicMaterial({color:0xe7c87d,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));halo.name='relic:halo';halo.rotation.x=-Math.PI/2;halo.position.y=.018;g.add(halo);
    return g;
  }
}
