import * as THREE from 'three';
import { bi, f, setText, setLabel, getLanguage, languageOptions, setLanguage, type Text, type LanguageMode } from '../i18n/text';
import { Walker, type Point } from '../demo3d/Navigation';
import { PixelActor, loadPixelAtlas } from '../demo3d/PixelActor';
import { StoryNpc, loadStoryNpcAtlas } from '../story3d/StoryNpc';
import { StableCutaway } from './StableCutaway';
import { REVIEW_ZOOM, zoomPercent, zoomRadius, clampZoomRadius, withinDistance } from './viewState';
import { disposeWorld } from '../demo3d/SceneWorld';
import { MIN_CAMERA_PITCH, MAX_CAMERA_PITCH, orbitCamera } from '../demo3d/CameraOrbit';
import { EXPERIENCE_IDS, EXPERIENCE, RELICS, experienceId, type ExperienceId, type Relic } from './data';
import { ExperienceWorld, type CastSpot } from './Worlds';
import { ReviewCollection } from './state';
import './experience.css';

function el<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text:Text='') {const node=document.createElement(tag);node.className=className;setText(node,text);return node;}
function button(text:Text,action:()=>void,className='sx-button'){const node=el('button',className,text);node.type='button';node.onclick=action;return node;}
function storage(){try{return localStorage;}catch{return undefined;}}

export async function startExperience(){const experience=new SceneExperience();await experience.start();}

class SceneExperience {
  private app=document.querySelector<HTMLElement>('#app')!;
  private renderer!:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(42,1,.5,240);
  private target=new THREE.Vector3();
  private world!:ExperienceWorld;
  private occlusion!:StableCutaway;
  private walker!:Walker;
  private player!:PixelActor;
  private atlas!:THREE.Texture;
  private highAtlas!:THREE.Texture;
  private npcAtlas!:HTMLCanvasElement;
  private highNpcAtlas!:HTMLCanvasElement;
  private cast:{actor:StoryNpc|PixelActor;spot:CastSpot}[]=[];
  private id:ExperienceId=experienceId(new URLSearchParams(location.search).get('scene'));
  private collection=new ReviewCollection(storage());
  private ui=el('div','sx-ui');
  private header=el('header','sx-header');
  private heading=el('h1');
  private subtitle=el('p','sx-subtitle');
  private tabs=el('nav','sx-tabs');
  private places=el('div','sx-places');
  private location=el('div','sx-location');
  private count=el('span','sx-count');
  private zoom=el('input','sx-zoom-range');
  private zoomValue=el('output','sx-zoom-value');
  private toggle=el('input');
  private prompt=button('',()=>this.inspectNearby(),'sx-prompt');
  private notice=el('div','sx-notice');
  private dialog=el('dialog','sx-dialog');
  private pauseDialog=el('dialog','sx-dialog sx-pause');
  private markers:{item:Relic;node:HTMLButtonElement;shown:boolean}[]=[];
  private nearest?:Relic;
  private pending?:Relic;
  private inspected?:Relic;
  private miniRenderer?:THREE.WebGLRenderer;
  private miniScene=new THREE.Scene();
  private miniModel?:THREE.Group;
  private miniCamera=new THREE.PerspectiveCamera(35,1.7,.1,30);
  private clock=0;
  private last=0;
  private noticeUntil=0;
  private keys=new Set<string>();
  private yaw=.48;
  private pitch=MIN_CAMERA_PITCH;
  private radius=27;
  private overview=false;
  private overviewButton=button(bi('俯视视角','Overhead view'),()=>this.toggleOverview());
  private orbit=button(bi('视角','Orbit'),()=>{},'sx-orbit');
  private drag?:{id:number;x:number;y:number;surface:HTMLElement};
  private motion=matchMedia('(prefers-reduced-motion: reduce)');
  private ray=new THREE.Raycaster();
  private ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private listener=new AbortController();
  private disposed=false;
  private sun=new THREE.DirectionalLight(0xffdfb1,2.1);
  private ambient=new THREE.HemisphereLight(0xe1e9ed,0x5b4d3c,2.2);
  private lamps:THREE.PointLight[]=[];
  private frame=0;
  private modelRevision=0;

  async start(){
    this.app.classList.add('scene-experience');this.app.replaceChildren(this.ui);
    const loading=el('div','sx-loading',bi('搭建街道、门廊与灯光…','Preparing streets, doorways and light…'));this.ui.append(loading);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.localClippingEnabled=true;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    const canvas=this.renderer.domElement;canvas.className='sx-canvas';canvas.tabIndex=0;
    setLabel(canvas,'aria-label',bi('可探索的三维场景。WASD 移动，Shift 奔跑，E 查看收藏品，右键拖动视角，滚轮缩放。','Explorable 3D scene. WASD to move, Shift to run, E to inspect a collectible, right drag to orbit, scroll to zoom.'));
    this.app.prepend(canvas);
    this.sun.position.set(-22,32,18);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:.5,far:110});this.sun.shadow.normalBias=.035;
    this.scene.add(this.ambient,this.sun);
    [this.atlas,this.highAtlas,this.npcAtlas,this.highNpcAtlas]=await Promise.all([loadPixelAtlas(),loadPixelAtlas(true),loadStoryNpcAtlas(),loadStoryNpcAtlas(true)]);
    this.player=new PixelActor(this.atlas,false,this.highAtlas);this.scene.add(this.player.root);
    loading.remove();this.buildUI();this.switchScene(this.id);this.bind();this.resize();
    this.renderer.setAnimationLoop(time=>this.tick(time));canvas.focus({preventScroll:true});
  }
  private buildUI(){
    const branding=el('div','sx-brand');branding.append(el('span','sx-eyebrow',bi('汉密尔顿 · 场景体验','HAMILTON · SCENE STUDIES')),this.heading,this.subtitle);
    setLabel(this.tabs,'aria-label',bi('切换体验场景','Choose an experience scene'));
    const labels=[bi('纽约街头','New York'),bi('酒馆','Tavern'),bi('舞会','Ballroom')];
    EXPERIENCE_IDS.forEach((id,i)=>{const b=button(labels[i],()=>this.switchScene(id),'sx-tab');b.dataset.scene=id;this.tabs.append(b);});
    const tools=el('div','sx-tools'),label=el('label','sx-check');this.toggle.type='checkbox';this.toggle.checked=this.collection.enabled;
    setLabel(this.toggle,'aria-label',bi('显示收藏品','Show collectibles'));
    label.append(this.toggle,el('span','',bi('收藏品','Collectibles')));
    this.toggle.onchange=()=>{this.collection.setEnabled(this.toggle.checked);this.pending=undefined;this.nearest=undefined;this.dialog.close();this.syncCollection();this.focus();};
    const language=el('select','sx-language');setLabel(language,'aria-label',bi('语言','Language'));
    for(const [value,name]of languageOptions){const option=document.createElement('option');option.value=value;option.textContent=name;option.lang=value==='en'||value==='dual-en'?'en':'zh-CN';language.append(option);}
    language.value=getLanguage();language.onchange=()=>{setLanguage(language.value as LanguageMode);this.focus();};
    tools.append(label,this.count,button(bi('收藏册','Collection'),()=>this.journal()),language,button(bi('暂停','Pause'),()=>this.pause()));
    this.header.append(branding,this.tabs,tools);
    const travel=el('details','sx-travel');travel.append(el('summary','',bi('步行探索','Explore on foot')),this.places);
    const view=el('div','sx-view');view.append(this.overviewButton,button(bi('重置视角','Reset camera'),()=>this.resetCamera()),button(bi('保存画面','Save view'),()=>this.saveView()),button(bi('导出模型','Export model'),()=>void this.exportModel()));
    const zoomControl=el('label','sx-zoom');this.zoom.type='range';this.zoom.min=String(REVIEW_ZOOM.minPercent);this.zoom.max=String(REVIEW_ZOOM.maxPercent);this.zoom.step='any';
    setLabel(this.zoom,'aria-label',bi('缩放百分比','Zoom percentage'));setLabel(zoomControl,'title',bi('缩放范围 100%–140%；100% 为默认视距，数值越大画面越近。','Zoom range: 100%–140%. 100% is the default view distance; higher values zoom in.'));
    this.zoom.oninput=()=>{this.radius=zoomRadius(Number(this.zoom.value));this.syncZoom();};
    zoomControl.append(el('span','',bi('缩放','Zoom')),this.zoom,this.zoomValue);view.append(zoomControl);
    const footer=el('footer','sx-footer');footer.append(el('span','',bi('WASD 行走 · Shift 奔跑 · 左键点地行走 · E 查看','WASD move · Shift run · Click ground to walk · E inspect')),el('span','',bi('右键拖动／视角球旋转 · 滚轮缩放','Right drag / orbit control · Scroll to zoom')));
    this.notice.setAttribute('role','status');this.prompt.hidden=true;
    this.ui.append(this.header,travel,view,this.location,footer,this.orbit,this.prompt,this.notice,this.dialog,this.pauseDialog);
    setLabel(this.dialog,'aria-label',bi('角色收藏品','Character collectibles'));
    this.dialog.onclose=()=>{this.inspected=undefined;this.miniModel=undefined;this.miniScene.clear();this.keys.clear();this.focus();};
    this.pauseDialog.append(el('span','sx-eyebrow',bi('暂停','PAUSED')),el('h2','',bi('场景在这里等你','The scene will wait')),button(bi('继续探索','Continue exploring'),()=>{this.pauseDialog.close();this.focus();}));
    this.pauseDialog.onclose=()=>{this.keys.clear();this.last=0;this.focus();};
  }
  private switchScene(id:ExperienceId){
    this.keys.clear();this.pending=undefined;this.nearest=undefined;this.dialog.close();this.pauseDialog.close();
    if(this.world){this.occlusion.dispose();this.scene.remove(this.world.root);disposeWorld(this.world.root);}
    this.cast=[];this.id=id;this.world=new ExperienceWorld(id);this.scene.add(this.world.root);this.modelRevision++;
    const definition=EXPERIENCE[id];this.walker=new Walker({...definition.spawn},this.world.map);
    this.occlusion=new StableCutaway(this.world.occluders);
    for(const spot of this.world.cast){const actor=spot.id==='burr'?new PixelActor(this.atlas,true,this.highAtlas):new StoryNpc(this.npcAtlas,spot.id,this.highNpcAtlas);this.world.root.add(actor.root);this.cast.push({actor,spot});}
    for(const lamp of this.lamps){this.scene.remove(lamp);lamp.dispose();}this.lamps=[];
    const background=id==='street'?0x7c9098:id==='tavern'?0x39332d:0x35464e;
    this.scene.background=new THREE.Color(background);this.scene.fog=new THREE.FogExp2(background,id==='street'?.009:.012);
    this.ambient.color.setHex(id==='street'?0xdde8ec:0xd6d3ce);this.ambient.intensity=id==='street'?2.2:1.8;
    this.sun.intensity=id==='street'?2.3:1.4;
    if(id!=='street')for(const [x,z]of(id==='tavern'?[[-2,0],[10,5],[15,-3]]:[[-11,3],[11,3],[0,-4]])){
      const light=new THREE.PointLight(0xffcb81,45,22,1.4);light.position.set(x,4,z);this.lamps.push(light);this.scene.add(light);
    }
    setText(this.heading,definition.name);setText(this.subtitle,definition.subtitle);
    this.tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===id)));
    this.places.replaceChildren();for(const place of definition.places)this.places.append(button(place.name,()=>{this.pending=undefined;this.walkTo(place.position);this.places.parentElement?.removeAttribute('open');},'sx-place'));
    this.markers.forEach(marker=>marker.node.remove());this.markers=[];
    for(const item of RELICS.filter(item=>item.scene===id)){
      const node=button(item.name,()=>this.approach(item),'sx-marker');node.dataset.relic=item.id;this.ui.append(node);this.markers.push({item,node,shown:false});
    }
    this.resetCamera();this.target.set(this.walker.position.x,.6,this.walker.position.z);this.world.updateRoofs(this.walker.position);this.syncCollection();
    const url=new URL(location.href);url.searchParams.set('experience','3d');url.searchParams.set('scene',id);history.replaceState(null,'',url);
    this.app.dataset.scene=id;this.renderer.domElement.dataset.ready='true';this.focus();
  }
  private syncZoom(){this.radius=clampZoomRadius(this.radius);const percent=zoomPercent(this.radius);this.zoom.value=String(percent);this.zoomValue.value=`${Math.round(percent)}%`;this.app.dataset.zoom=percent.toFixed(2);}
  private resetCamera(){this.yaw=.48;this.pitch=MIN_CAMERA_PITCH;this.radius=REVIEW_ZOOM.referenceRadius;this.syncZoom();this.overview=false;this.overviewButton.setAttribute('aria-pressed','false');this.focus();}
  private toggleOverview(){this.overview=!this.overview;this.pitch=this.overview?MAX_CAMERA_PITCH:MIN_CAMERA_PITCH;this.overviewButton.setAttribute('aria-pressed',String(this.overview));this.syncZoom();this.focus();}
  private focus(){if(!this.dialog.open&&!this.pauseDialog.open)this.renderer?.domElement.focus({preventScroll:true});}
  private paused(){return this.dialog.open||this.pauseDialog.open||document.hidden;}
  private pause(){if(!this.pauseDialog.open&&!this.dialog.open){this.keys.clear();this.walker?.halt();this.pauseDialog.showModal();}}
  private bind(){
    const signal=this.listener.signal,canvas=this.renderer.domElement;
    window.addEventListener('resize',()=>this.resize(),{signal});
    window.addEventListener('keydown',event=>{
      if(this.disposed)return;
      if(event.code==='Escape'&&!this.dialog.open&&!this.pauseDialog.open){event.preventDefault();this.pause();return;}
      if(this.paused()||event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLButtonElement||(event.target instanceof Element&&event.target.tagName==='SUMMARY'))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyR','ShiftLeft','ShiftRight'].includes(event.code))event.preventDefault();
      if(event.code==='KeyE'&&!event.repeat)this.inspectNearby();else if(event.code==='KeyR'&&!event.repeat)this.resetCamera();else this.keys.add(event.code);
    },{signal});
    window.addEventListener('keyup',event=>this.keys.delete(event.code),{signal});
    window.addEventListener('blur',()=>{this.keys.clear();this.walker?.halt();this.pause();this.releaseDrag();},{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.keys.clear();this.walker?.halt();this.pause();}},{signal});
    canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal});
    canvas.addEventListener('pointerdown',event=>{
      if(this.paused())return;this.focus();
      if(event.button===2)this.beginDrag(event,canvas);
      else if(event.button===0){
        const r=canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),this.camera);
        if(this.collection.enabled){for(const {item}of this.markers){const model=this.world.relicModels.get(item.id)!;if(model.visible&&this.ray.intersectObject(model,true).length){this.approach(item);return;}}}
        const hit=this.ray.ray.intersectPlane(this.ground,new THREE.Vector3());if(hit){this.pending=undefined;this.walkTo(hit);}
      }
    },{signal});
    this.orbit.addEventListener('pointerdown',event=>{if(event.button===0&&!this.paused()){event.preventDefault();this.beginDrag(event,this.orbit);}},{signal});
    this.orbit.addEventListener('keydown',event=>{const move:Record<string,[number,number]>={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,12],ArrowDown:[0,-12]};const d=move[event.code];if(d){event.preventDefault();event.stopPropagation();Object.assign(this,orbitCamera({yaw:this.yaw,pitch:this.pitch},d[0],d[1]));}},{signal});
    const surfaces:HTMLElement[]=[canvas,this.orbit];
    for(const surface of surfaces){
      surface.addEventListener('pointermove',event=>{const drag=this.drag;if(drag&&drag.id===event.pointerId){Object.assign(this,orbitCamera({yaw:this.yaw,pitch:this.pitch},event.clientX-drag.x,event.clientY-drag.y));drag.x=event.clientX;drag.y=event.clientY;}},{signal});
      for(const type of['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,()=>this.releaseDrag(),{signal});
    }
    canvas.addEventListener('wheel',event=>{event.preventDefault();if(!this.paused()){this.radius=clampZoomRadius(this.radius+event.deltaY*.02);this.syncZoom();}},{passive:false,signal});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.pause();this.toast(bi('画面暂时中断，请刷新恢复。','Rendering was interrupted. Refresh to recover.'));},{signal});
    window.addEventListener('pagehide',()=>this.dispose(),{once:true,signal});
    window.addEventListener('pageshow',event=>{if(event.persisted&&this.disposed)location.reload();},{signal});
  }
  private beginDrag(event:PointerEvent,surface:HTMLElement){this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,surface};surface.setPointerCapture(event.pointerId);}
  private releaseDrag(){const drag=this.drag;this.drag=undefined;if(drag?.surface.hasPointerCapture(drag.id))drag.surface.releasePointerCapture(drag.id);}
  private walkTo(position:Point){if(this.walker.travel(position))this.focus();else this.toast(bi('这里走不过去，试试门口或旁边的通道。','That spot is out of reach. Try the doorway or a nearby path.'));}
  private distance(point:Point){return Math.hypot(this.walker.position.x-point.x,this.walker.position.z-point.z);}
  private reachable(item:Relic){return this.distance(item.stand)<=1.65&&this.world.map.clear(this.walker.position,item.stand);}
  private approach(item:Relic){if(!this.collection.enabled||this.collection.has(item.id))return;if(this.reachable(item))this.inspect(item);else{this.pending=item;this.walkTo(item.stand);}}
  private inspectNearby(){if(this.nearest&&this.collection.enabled&&!this.paused())this.inspect(this.nearest);}
  private inspect(item:Relic){
    this.walker.halt();this.keys.clear();this.pending=undefined;this.inspected=item;this.dialog.replaceChildren();
    const close=button(bi('关闭','Close'),()=>this.dialog.close(),'sx-close');
    const heading=el('div','sx-item-heading');heading.append(el('span','sx-eyebrow',item.owner),el('h2','',item.name));
    const image=el('div','sx-object');
    this.miniRenderer??=new THREE.WebGLRenderer({alpha:true,antialias:true});this.miniRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.miniRenderer.setSize(420,250);image.append(this.miniRenderer.domElement);
    setLabel(this.miniRenderer.domElement,'aria-label',f(bi('{0}的三维模型','3D model of {0}'),item.name));
    this.miniScene.clear();this.miniScene.add(new THREE.HemisphereLight(0xffffff,0x7b6345,3));const light=new THREE.DirectionalLight(0xffdfb0,3);light.position.set(2,4,3);this.miniScene.add(light);
    const source=this.world.relicModels.get(item.id);
    if(source){this.miniModel=source.clone();this.miniModel.position.set(0,0,0);this.miniModel.visible=true;const halo=this.miniModel.getObjectByName('relic:halo');if(halo)this.miniModel.remove(halo);this.miniScene.add(this.miniModel);}
    const bounds=new THREE.Box3().setFromObject(this.miniModel!),center=bounds.getCenter(new THREE.Vector3());
    const radius=Math.max(.28,bounds.getBoundingSphere(new THREE.Sphere()).radius),distance=radius/Math.sin(THREE.MathUtils.degToRad(35/2))*1.03;
    this.miniCamera.aspect=420/250;this.miniCamera.updateProjectionMatrix();this.miniCamera.position.copy(center).add(new THREE.Vector3(1.1,1.45,1.8).normalize().multiplyScalar(distance));this.miniCamera.lookAt(center);
    const text=el('p','sx-lore',item.text),note=el('span','sx-eyebrow',bi('物品附文 · 原创故事片段','ITEM NOTE · ORIGINAL VIGNETTE'));
    const take=button(this.collection.has(item.id)?bi('已收入收藏册','In your collection'):bi('收入收藏册','Keep in collection'),()=>{
      if(!this.reachable(item)||!this.collection.enabled)return;
      if(this.collection.collect(item.id)){this.syncCollection();this.toast(f(bi('已收集：{0}','Collected: {0}'),item.name));}
      this.dialog.close();
    },'sx-take');take.disabled=this.collection.has(item.id)||!this.collection.enabled;
    this.dialog.append(close,heading,image,note,text,take);if(!this.dialog.open)this.dialog.showModal();
  }
  private journal(){
    this.walker.halt();this.keys.clear();this.inspected=undefined;this.miniModel=undefined;this.dialog.replaceChildren();
    this.dialog.append(button(bi('关闭','Close'),()=>this.dialog.close(),'sx-close'),el('span','sx-eyebrow',bi('留在身边的故事','STORIES TO KEEP')),el('h2','',bi('收藏册','Your collection')),el('p','sx-lore',bi('拾取后的附文可以在这里重读。关闭场景中的收藏品，不会清空记录。','Revisit the notes you have collected. Hiding collectibles in the scene preserves your collection.')));
    for(const id of EXPERIENCE_IDS){
      this.dialog.append(el('h3','',f(bi('{0} · {1}/4','{0} · {1}/4'),EXPERIENCE[id].name,this.collection.count(id))));
      for(const item of RELICS.filter(item=>item.scene===id)){
        const row=el('details','sx-entry');row.append(el('summary','',this.collection.has(item.id)?item.name:bi('尚未发现','Not yet found')));
        if(this.collection.has(item.id))row.append(el('span','sx-eyebrow',item.owner),el('p','sx-lore',item.text));
        this.dialog.append(row);
      }
    }
    this.dialog.append(button(bi('重置本场收藏品','Reset this scene’s collectibles'),()=>{this.collection.reset(this.id);this.syncCollection();this.journal();},'sx-reset'));
    if(!this.dialog.open)this.dialog.showModal();
  }
  private syncCollection(){
    for(const item of RELICS.filter(item=>item.scene===this.id)){const visible=this.collection.enabled&&!this.collection.has(item.id);this.world.relicModels.get(item.id)!.visible=visible;}
    for(const marker of this.markers){marker.node.hidden=true;marker.shown=false;}
    this.prompt.hidden=true;setText(this.count,f(bi('{0}/4','{0}/4'),this.collection.count(this.id)));
    this.app.dataset.collectibles=String(this.collection.enabled);this.app.dataset.collected=String(this.collection.count());
  }
  private toast(text:Text){setText(this.notice,text);this.noticeUntil=performance.now()+3800;this.notice.hidden=false;}
  private resize(){const width=this.app.clientWidth,height=this.app.clientHeight;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  private tick(time:number){
    if(this.disposed)return;
    const dt=this.last?Math.min(.05,(time-this.last)/1000):0;this.last=time;const paused=this.paused(),reduced=this.motion.matches;
    if(!paused){
      this.clock+=dt;const x=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
      const z=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
      if(x||z)this.pending=undefined;
      this.walker.tick({x:x*Math.cos(this.yaw)+z*Math.sin(this.yaw),z:-x*Math.sin(this.yaw)+z*Math.cos(this.yaw)},dt,this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'));
      if(this.pending&&this.distance(this.pending.stand)<.2){const item=this.pending;this.pending=undefined;this.inspect(item);}
    }
    const p=this.walker.position;
    this.player.update(p,this.walker.direction,this.walker.distance,this.walker.moving&&!paused,this.yaw,reduced,this.pitch);
    for(const {actor,spot}of this.cast){if(actor instanceof PixelActor)actor.update(spot.position,spot.direction,0,false,this.yaw,reduced,this.pitch);else actor.update(spot.position,spot.direction,this.yaw,undefined,this.pitch);}
    const destination=new THREE.Vector3(p.x,.65,p.z);
    this.target.lerp(destination,reduced?1:1-Math.exp(-dt*7));
    this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(this.pitch)*this.radius,this.target.y+Math.sin(this.pitch)*this.radius,this.target.z+Math.cos(this.yaw)*Math.cos(this.pitch)*this.radius);
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();this.world.updateRoofs(p,this.camera.position);
    this.occlusion.update(this.camera,new THREE.Vector3(p.x,0,p.z),dt,reduced);this.world.update(this.clock,reduced,this.yaw);
    this.renderer.render(this.scene,this.camera);
    if(this.dialog.open&&this.miniModel&&this.miniRenderer){if(!reduced)this.miniModel.rotation.y+=dt*.25;this.miniRenderer.render(this.miniScene,this.miniCamera);}
    // Project every rendered frame, after the camera update: labels stay attached to the object.
    this.nearest=undefined;let nearestDistance=Infinity;
    const width=this.app.clientWidth,height=this.app.clientHeight;
    for(const marker of this.markers){
      const {item,node}=marker,available=this.collection.enabled&&!this.collection.has(item.id),distance=this.distance(item.stand);
      if(available&&distance<nearestDistance&&this.reachable(item)){this.nearest=item;nearestDistance=distance;}
      const point=new THREE.Vector3(item.position.x,item.height+.65,item.position.z).project(this.camera);
      const screenLimit=marker.shown?.96:.9;
      marker.shown=available&&!paused&&withinDistance(distance,marker.shown,5.5,6.1)&&Math.abs(point.x)<screenLimit&&Math.abs(point.y)<screenLimit&&point.z<1&&point.z> -1;
      node.hidden=!marker.shown;
      if(marker.shown){node.style.transform=`translate3d(${((point.x+1)*width/2).toFixed(2)}px,${((1-point.y)*height/2).toFixed(2)}px,0) translate(-50%,-100%)`;}
    }
    this.prompt.hidden=!this.nearest||paused;
    if(this.nearest)setText(this.prompt,f(bi('E · 查看{0}','E · Inspect {0}'),this.nearest.name));
    if(this.frame++%4===0){
      const room=this.world.roomAt(p);setText(this.location,room?f(bi('所在 · {0}','INSIDE · {0}'),room.name):bi('街道与庭院','STREETS & COURTYARDS'));
      this.renderer.domElement.dataset.frameReady='true';this.app.dataset.room=room?.id??'outside';this.app.dataset.worldRevision=String(this.modelRevision);
      this.app.dataset.position=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;
    }
    if(time>this.noticeUntil)this.notice.hidden=true;
  }
  private async exportModel(){
    const exportButtons=[...this.ui.querySelectorAll<HTMLButtonElement>('.sx-view button')];const trigger=exportButtons.at(-1)!;if(trigger.disabled)return;
    trigger.disabled=true;setText(trigger,bi('正在导出…','Exporting…'));
    const id=this.id,world=new ExperienceWorld(id);
    try{
      const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
      for(const model of world.relicModels.values())model.visible=this.collection.enabled;
      const data=await new GLTFExporter().parseAsync(world.root,{binary:true,onlyVisible:true});
      if(!(data instanceof ArrayBuffer))throw new Error('Expected binary glTF');
      const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download=`hamilton-${id}-detail-2026-11-02.glb`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      this.toast(bi('模型已导出，包含完整建筑与屋顶。','Model exported, including complete buildings and roofs.'));
    }catch(error){console.error(error);this.toast(bi('导出未完成，请重试。','Export could not finish. Please try again.'));}
    finally{disposeWorld(world.root);trigger.disabled=false;setText(trigger,bi('导出模型','Export model'));}
  }
  private saveView(){
    this.renderer.render(this.scene,this.camera);
    this.renderer.domElement.toBlob(blob=>{
      if(!blob){this.toast(bi('画面保存失败，请重试。','The view could not be saved. Please try again.'));return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hamilton-${this.id}-detail-view.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      this.toast(bi('当前三维画面已保存。','The current 3D view has been saved.'));
    },'image/png');
  }
  private dispose(){
    if(this.disposed)return;this.disposed=true;this.listener.abort();this.renderer.setAnimationLoop(null);this.occlusion.dispose();disposeWorld(this.world.root);disposeWorld(this.player.root);this.atlas.dispose();this.highAtlas.dispose();this.renderer.dispose();this.miniRenderer?.dispose();
  }
}
