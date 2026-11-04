import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WorldKit } from '../demo3d/SceneWorld';
import type { Relic } from './data';

/** Reusable authored geometry: bevels, turned profiles, bindings, seams and metalwork. */
export class AssetDetail extends WorldKit {
  readonly detail = {
    brass: new THREE.MeshStandardMaterial({color:0xc6a25d,metalness:.72,roughness:.31}),
    steel: new THREE.MeshStandardMaterial({color:0xbac0bd,metalness:.82,roughness:.28}),
    ink: new THREE.MeshStandardMaterial({color:0x32393c,roughness:.9}),
    paper: new THREE.MeshStandardMaterial({color:0xf0dfb6,roughness:.95}),
    page: new THREE.MeshStandardMaterial({color:0xc4ad83,roughness:1}),
    wax: new THREE.MeshStandardMaterial({color:0x8f342c,roughness:.48}),
    thread: new THREE.MeshStandardMaterial({color:0xd8bc8d,roughness:.92}),
    glass: new THREE.MeshStandardMaterial({color:0x35574b,metalness:.18,roughness:.18}),
  };
  private detailGeometries=new Map<string,THREE.BufferGeometry>();
  private geometry(key:string,create:()=>THREE.BufferGeometry){let geometry=this.detailGeometries.get(key);if(!geometry){geometry=create();this.detailGeometries.set(key,geometry);}return geometry;}
  mesh(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  rounded(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material,parent:THREE.Object3D=this.root,r=.035){r=Math.min(r,w/3,h/3,d/3);return this.mesh(this.geometry(`round:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,2,r)),material,parent,x,y,z);}
  sphere(x:number,y:number,z:number,r:number,material:THREE.Material,parent:THREE.Object3D=this.root){const mesh=this.mesh(this.geometry('sphere',()=>new THREE.SphereGeometry(1,16,12)),material,parent,x,y,z);mesh.scale.setScalar(r);return mesh;}
  torus(x:number,y:number,z:number,r:number,tube:number,material:THREE.Material,parent:THREE.Object3D=this.root,horizontal=true){const mesh=this.mesh(this.geometry(`torus:${r}:${tube}`,()=>new THREE.TorusGeometry(r,tube,8,40)),material,parent,x,y,z);if(horizontal)mesh.rotation.x=Math.PI/2;return mesh;}
  lathe(x:number,y:number,z:number,profile:[number,number][],material:THREE.Material,parent:THREE.Object3D=this.root){const key=`lathe:${JSON.stringify(profile)}`;return this.mesh(this.geometry(key,()=>new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),32)),material,parent,x,y,z);}
  curve(points:number[][],radius:number,material:THREE.Material,parent:THREE.Object3D=this.root){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));return this.mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*4),radius,6,false),material,parent);}
  plate(points:[number,number][],thickness:number,material:THREE.Material,parent:THREE.Object3D,y=.04){const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.006});const mesh=this.mesh(geo,material,parent,0,y,0);mesh.rotation.x=-Math.PI/2;return mesh;}
  bottle(x:number,y:number,z:number,material=this.detail.glass,parent:THREE.Object3D=this.root){
    this.lathe(x,y,z,[[0,0],[.11,0],[.15,.04],[.15,.31],[.12,.39],[.055,.43],[.055,.59],[.07,.60],[.07,.64],[0,.64]],material,parent);
    this.cylinder(x,y+.65,z,.049,.049,.06,this.detail.thread,parent,16);
    this.cylinder(x,y+.22,z,.151,.151,.16,this.detail.paper,parent,24);
  }
  /** Bind repeated detail geometry into instanced draws, retaining independent collectible groups. */
  batchDetails(){
    const parents:THREE.Object3D[]=[];this.root.traverse(o=>{if(o.children.length)parents.push(o);});
    for(const parent of parents){
      const sets=new Map<string,THREE.Mesh[]>();
      for(const child of parent.children)if(child instanceof THREE.Mesh&&!(child instanceof THREE.InstancedMesh)&&!Array.isArray(child.material)){
        const key=`${child.geometry.id}:${child.material.id}:${child.castShadow}:${child.receiveShadow}`;const set=sets.get(key)??[];set.push(child);sets.set(key,set);
      }
      for(const meshes of sets.values())if(meshes.length>=3){
        const source=meshes[0],batch=new THREE.InstancedMesh(source.geometry,source.material,meshes.length);batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;
        meshes.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);parent.remove(mesh);});batch.computeBoundingSphere();parent.add(batch);
      }
    }
  }
  relicAsset(item:Relic,parent:THREE.Group){
    const color=new THREE.MeshStandardMaterial({color:item.color,roughness:item.shape==='ribbon'?.5:.65,metalness:item.shape==='button'||item.shape==='thimble'?.65:.05});
    const {brass,steel,ink,paper,page,wax,thread}=this.detail;
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material=color,r=.015)=>this.rounded(x,y,z,w,h,d,mat,parent,r);
    const ring=(x:number,y:number,z:number,r:number,t:number,mat:THREE.Material=brass)=>this.torus(x,y,z,r,t,mat,parent);
    const line=(p:number[][],r=.006,mat:THREE.Material=ink)=>this.curve(p,r,mat,parent);
    const sheet=(y:number)=>box(0,y,0,.92,.018,.67,paper,.006);
    const writing=(y:number,zStart=-.20)=>{for(let row=0;row<5;row++){const z=zStart+row*.065;for(let word=0;word<3;word++)box(-.28+word*.20,y,z,.11+(row+word)%3*.025,.003,.008,ink,.001);}};
    if(item.shape==='book'){
      box(0,.13,0,.86,.19,.64,paper);for(const y of[.075,.10,.125,.15,.175,.20])box(.005,y,.326,.78,.004,.005,page,.001);
      for(const y of[.025,.24])box(0,y,0,.96,.045,.72,color,.018);
      box(-.46,.13,0,.09,.25,.72);for(const z of[-.25,-.1,.1,.25])box(-.507,.13,z,.012,.21,.035,brass,.004);
      for(const x of[-.37,.37])for(const z of[-.26,.26]){box(x,.268,z,.14,.012,.10,brass);this.sphere(x,.28,z,.015,brass,parent);}
      for(const x of[-.32,.32])box(x,.267,0,.007,.006,.4,brass,.001);for(const z of[-.2,.2])box(0,.267,z,.64,.006,.007,brass,.001);
      box(.04,.27,0,.27,.014,.2,brass);box(.04,.28,0,.23,.008,.16,ink);box(.22,.035,.43,.055,.012,.24,wax);
    }else if(item.shape==='letter'){
      sheet(.025);this.plate([[-.44,-.31],[.44,-.31],[0,.06]],.012,paper,parent,.05);
      line([[-.44,.07,.31],[0,.07,-.05],[.44,.07,.31]],.004,page);
      const seal=this.sphere(.05,.09,.04,.115,wax,parent);seal.scale.y*=.3;ring(.05,.118,.04,.075,.008,brass);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;this.sphere(.05+Math.cos(a)*.04,.125,.04+Math.sin(a)*.04,.015,wax,parent);}
      line([[-.40,.051,-.30],[-.37,.055,.10],[-.35,.051,.31]],.008,thread);
    }else if(item.shape==='card'){
      sheet(.025);for(const x of[-.40,.40])box(x,.038,0,.008,.006,.52,brass,.001);for(const z of[-.26,.26])box(0,.038,z,.80,.006,.008,brass,.001);
      writing(.039,-.14);for(const x of[-.37,.37])for(const z of[-.23,.23])ring(x,.04,z,.025,.004,brass);
      line([[-.35,.045,-.28],[-.49,.06,-.42],[-.58,.08,-.24],[-.48,.06,-.14]],.012,thread);
    }else if(item.shape==='seal'){
      sheet(.025);writing(.04);this.lathe(-.22,.045,.03,[[0,0],[.19,0],[.20,.04],[.17,.09],[.09,.10],[.07,.30],[.14,.42],[.13,.49],[0,.53]],color,parent);
      this.cylinder(-.22,.095,.03,.20,.20,.055,brass,parent,32);ring(-.22,.13,.03,.165,.012);
      const seal=this.sphere(.27,.066,.13,.13,wax,parent);seal.scale.y*=.25;ring(.27,.103,.13,.075,.009,brass);
    }else if(item.shape==='scissors'){
      for(const side of[-1,1]){
        const blade=new THREE.Group();blade.rotation.y=side*.26;parent.add(blade);
        this.plate([[side*.03,-.03],[side*.075,.63],[side*.17,.22],[side*.13,-.05]],.025,steel,blade,.045+side*.018);
        this.torus(side*.11,.07,-.25,.15,.028,brass,blade).scale.z=1.25;
        this.rounded(side*.09,.07,-.08,.055,.05,.19,brass,blade,.02);
      }
      this.cylinder(0,.10,0,.055,.055,.08,brass,parent,24);box(0,.146,0,.055,.006,.008,ink,.001);
    }else if(item.shape==='token'){
      const shape=new THREE.Shape([new THREE.Vector2(-.34,-.23),new THREE.Vector2(.34,-.23),new THREE.Vector2(.34,.17),new THREE.Vector2(.24,.27),new THREE.Vector2(-.24,.27),new THREE.Vector2(-.34,.17)]);
      const hole=new THREE.Path();hole.absellipse(0,.17,.045,.045,0,Math.PI*2,true,0);shape.holes.push(hole);
      const mesh=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelThickness:.012,bevelSize:.015,bevelSegments:2}),color,parent,0,.025,0);mesh.rotation.x=-Math.PI/2;
      for(let i=0;i<5;i++)line([[-.27,.11,-.10+i*.055],[-.07,.108,-.11+i*.055],[.28,.11,-.10+i*.055]],.003,page);
      line([[0,.10,-.17],[.07,.17,-.41],[-.21,.12,-.55],[-.24,.10,-.32],[0,.10,-.17]],.017,thread);
      for(const z of[0,.055])box(0,.115,z,.32,.005,.014,ink,.001);
    }else if(item.shape==='ribbon'){
      const ribbon=(points:number[][],width:number)=>{
        const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number]))),verts:number[]=[],uv:number[]=[],indices:number[]=[];
        for(let i=0;i<=40;i++){const t=i/40,p=path.getPoint(t),tangent=path.getTangent(t),side=new THREE.Vector3(-tangent.z,.25*Math.sin(t*Math.PI*2),tangent.x).normalize().multiplyScalar(width/2);for(const sign of[-1,1]){const v=p.clone().addScaledVector(side,sign);verts.push(v.x,v.y,v.z);uv.push((sign+1)/2,t);}if(i<40){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();color.side=THREE.DoubleSide;this.mesh(geometry,color,parent);
      };
      for(const side of[-1,1]){ribbon([[0,.08,0],[side*.28,.32,-.22],[side*.51,.17,-.04],[side*.29,.08,.10],[0,.13,0]],.16);ribbon([[side*.04,.10,0],[side*.20,.06,.3],[side*.18,.03,.67]],.19);}
      box(0,.13,0,.20,.15,.23,color,.05);
    }else if(item.shape==='thimble'){
      this.lathe(0,.025,0,[[.25,0],[.25,.05],[.23,.10],[.19,.39],[.17,.45],[.09,.48],[0,.49]],color,parent);ring(0,.075,0,.245,.018,brass);ring(0,.11,0,.235,.009,brass);
      for(let row=0;row<5;row++)for(let i=0;i<14;i++){const a=(i+row*.5)/14*Math.PI*2,y=.16+row*.057,r=.23-row*.011;this.sphere(Math.cos(a)*r,y,Math.sin(a)*r,.011,ink,parent);}
      for(let i=0;i<8;i++){const a=i*Math.PI/4;this.sphere(Math.cos(a)*.095,.507,Math.sin(a)*.095,.01,ink,parent);}
    }else if(item.shape==='quill'){
      sheet(.025);writing(.04);this.lathe(-.30,.04,-.14,[[0,0],[.17,0],[.19,.04],[.18,.23],[.10,.27],[.09,.35],[.12,.37],[.12,.41],[0,.41]],ink,parent);ring(-.3,.43,-.14,.10,.018,brass);
      const feather=new THREE.Group();feather.position.set(.13,.20,.05);feather.rotation.set(.25,-.35,-.2);parent.add(feather);
      this.plate([[0,-.44],[-.14,-.2],[-.19,.13],[-.10,.47],[.02,.61],[.14,.37],[.16,.05],[.08,-.22]],.009,paper,feather,.025);
      this.curve([[0,.05,.52],[0,.06,0],[0,.05,-.60]],.012,brass,feather);
      for(let i=0;i<12;i++){const z=-.3+i*.06,w=.15*(1-Math.abs(z)/.7);for(const side of[-1,1])this.curve([[0,.044,z],[side*w*.7,.045,z+.07],[side*w,.043,z+.10]],.002,page,feather);}
    }else if(item.shape==='fan'){
      const radius=.72,count=18,positions:number[]=[],indices:number[]=[];
      for(let i=0;i<=count;i++){const a=i*Math.PI/count,h=.075+(i%2)*.035;positions.push(0,.07,0,Math.cos(a)*radius,h,-Math.sin(a)*radius);if(i<count){const n=i*2;indices.push(n,n+1,n+3);}}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();color.side=THREE.DoubleSide;this.mesh(geo,color,parent);
      for(let i=0;i<=count;i++){const a=i*Math.PI/count;line([[0,.12,0],[Math.cos(a)*radius,.12,-Math.sin(a)*radius]],.008,brass);if(i%2===0){const x=Math.cos(a)*.53,z=-Math.sin(a)*.53;this.sphere(x,.14,z,.022,paper,parent);for(let k=0;k<5;k++){const b=k*Math.PI*2/5;this.sphere(x+Math.cos(b)*.035,.14,z+Math.sin(b)*.035,.013,brass,parent);}}}
      ring(0,.10,0,.055,.015);line([[0,.08,.02],[.08,.04,.27],[.25,.045,.33]],.012,thread);for(let i=0;i<5;i++)line([[.25,.045,.33],[.28+i*.014,.035,.50]],.007,thread);
    }else if(item.shape==='locket'){
      this.lathe(0,.03,0,[[0,0],[.25,0],[.29,.03],[.29,.09],[.24,.12],[0,.12]],brass,parent);this.cylinder(0,.157,0,.23,.23,.008,color,parent,40);ring(0,.17,0,.25,.012);
      const lid=new THREE.Group();lid.position.set(-.27,.12,0);lid.rotation.z=-1.1;parent.add(lid);this.cylinder(-.26,0,0,.27,.27,.06,brass,lid,40);this.cylinder(-.26,.035,0,.23,.23,.012,paper,lid,40);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;this.sphere(Math.cos(a)*.263,.17,Math.sin(a)*.263,.012,brass,parent);}
      ring(0,.13,-.32,.06,.014);for(let i=0;i<34;i++){const a=i/(33)*Math.PI*1.8;const x=Math.sin(a)*.36,z=-.62-Math.cos(a)*.28;const link=ring(x,.035+(i%2)*.006,z,.032,.006);link.rotation.z=i%2?.8:0;}
    }else if(item.shape==='button'){
      const shape=new THREE.Shape();shape.absarc(0,0,.31,0,Math.PI*2,false);for(const x of[-.09,.09])for(const y of[-.09,.09]){const hole=new THREE.Path();hole.absarc(x,y,.036,0,Math.PI*2,true);shape.holes.push(hole);}
      const mesh=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSegments:3,bevelThickness:.015,bevelSize:.018}),color,parent,0,.025,0);mesh.rotation.x=-Math.PI/2;ring(0,.10,0,.275,.010);
      for(const side of[-1,1])line([[-.09,.10,side*.09],[0,.13,0],[.09,.10,-side*.09]],.009,thread);
      line([[.09,.11,.09],[.33,.035,.3],[.53,.025,.24],[.59,.027,.42]],.009,thread);
    }
  }
}
