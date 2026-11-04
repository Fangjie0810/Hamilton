import * as THREE from 'three';
import { WalkMap, type Obstacle, type Point } from './Navigation';
import { TavernSign } from './TavernSign';

export const BURR: Point = { x: -3.2, z: 1.5 };
export const SPAWN: Point = { x: 0, z: 5 };
let seed = 1776;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
const plantedYards = [[-17.1, -11, 4.7, 14], [-16.8, 13.8, 4.6, 9], [-3.3, -16.2, 8, 4], [10.8, 17.5, 6, 3.8]] as const;
const backdropGableGeometry = new THREE.BufferGeometry();
backdropGableGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  -.5, 0, .5, .5, 0, .5, 0, 1, .5,
  .5, 0, -.5, -.5, 0, -.5, 0, 1, -.5,
], 3));
backdropGableGeometry.computeVertexNormals();

function material(color: number, map?: THREE.Texture) { return new THREE.MeshLambertMaterial(map ? { color, map } : { color }); }
function texture(kind: 'stone' | 'brick' | 'roof' | 'grass' | 'wood') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const palettes = { stone: ['#585863', '#72717a', '#86818a', '#666873'], brick: ['#633f31', '#a57151', '#946043', '#b7825d'], roof: ['#333d3d', '#515b57', '#626c63', '#414d49'], grass: ['#555c48', '#696d51', '#72765c', '#4c5548'], wood: ['#4c3928', '#886c48', '#947a51', '#725639'] };
  const colors = palettes[kind]; ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, 128, 128);
  if (kind === 'grass') {
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = colors[1 + i % 3]; ctx.fillRect(Math.floor(random() * 64) * 2, Math.floor(random() * 64) * 2, 2 + Math.floor(random() * 3) * 2, 2); }
  } else {
    const h = kind === 'wood' ? 128 : kind === 'brick' ? 12 : 16, w = kind === 'wood' ? 16 : kind === 'brick' ? 32 : 24;
    for (let y = 0, row = 0; y < 128; y += h, row++) for (let x = -w; x < 128; x += w) {
      const xx = x + (row % 2) * w / 2; ctx.fillStyle = colors[1 + Math.floor(random() * 3)]; ctx.fillRect(xx + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(230,226,179,.13)'; ctx.fillRect(xx + 2, y + 1, w - 4, 1);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = random() > .5 ? 'rgba(28,26,21,.12)' : 'rgba(255,242,205,.1)'; ctx.fillRect(xx + random() * w, y + random() * h, 2 + random() * 7, 1); }
    }
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return t;
}

export class StreetWorld {
  readonly root = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  readonly map: WalkMap;
  readonly water: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly flags: THREE.Mesh[] = [];
  readonly leaves: THREE.Group[] = [];
  readonly smoke: THREE.Mesh[] = [];
  readonly occluders: THREE.Group[] = [];
  readonly landmarks = [BURR, { x: -8, z: -2.2 }, { x: 13, z: 5 }] as const;
  private mats: Record<string, THREE.MeshLambertMaterial>;
  private tavernSign?: TavernSign;

  constructor() {
    seed = 1776;
    this.mats = {
      stone: material(0xc7c3c8, texture('stone')), grass: material(0x999b85, texture('grass')),
      brick: material(0xe5c09d, texture('brick')), roof: material(0xd2d3b5, texture('roof')),
      wood: material(0xe0c494, texture('wood')), trim: material(0xd7c6a0), dark: material(0x393f34),
      glass: material(0x283e3a), cream: material(0xcdbd8a), red: material(0x815743), iron: material(0x343c35),
      bark: material(0x69553b), leaf: material(0x53634b), leafLight: material(0x6f775a), leafDark: material(0x3d5143),
      sand: material(0xa99f71), flower: material(0xd6c18f), barrel: material(0x947248), cloth: material(0xd8d0a9),
      warmGlass: new THREE.MeshLambertMaterial({ color: 0xe9b45f, emissive: 0xc36924, emissiveIntensity: .8 }),
    };
    this.mats.roof.map!.repeat.set(2, 3);
    // The waterfront belongs to a paved town; small planted yards sit within the street block.
    this.floor(-94.5, 0, 220, 400, this.mats.stone, -.1, 110, 200);
    for (const [x, z, w, d] of plantedYards) {
      this.floor(x, z, w, d, this.mats.grass, -.065, w / 2, d / 2);
    }
    // Main streets remain open, with side lanes continuing behind the boundary fence.
    this.floor(-94, 3.3, 220, 6.4, this.mats.stone, -.035, 110, 3.2);
    this.floor(-1.5, 0, 6, 240, this.mats.stone, -.03, 3, 120);
    this.floor(-9, -1.4, 12, 2.2, this.mats.stone, -.025, 6, 1.1);
    this.floor(8, -3.6, 9, 2, this.mats.stone, -.025, 4.5, 1);
    this.floor(11.6, 6, 4.6, 29, this.mats.stone, -.02, 2, 14);
    for (let x = -19; x < 14; x += 1) for (const z of [-.02, 6.6]) {
      if (x > -5 && x < 2) continue;
      this.box(x, .04, z, .96, .14, .28, this.mats.trim, false);
    }
    this.building(-10, -7.1, 9, 7, 5.3, this.mats.brick, true);
    this.building(7.4, -10, 8, 8, 5.8, this.mats.cream);
    this.building(-11.5, 13, 8, 6, 3.9, this.mats.cream);
    this.building(6.7, 14, 7, 6, 4.5, this.mats.brick);
    this.market(-7.3, 7.9);
    this.box(15.3, -.35, 1, 2.4, .7, 400, this.mats.stone);
    this.floor(115.5, 0, 200, 400, this.mats.sand, -.95, 54, 77);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(200, 400), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv; uniform float time;
        void main(){vec2 uv=vUv*vec2(8.,6.666667); vec2 p=floor(uv*vec2(180.,280.))/vec2(180.,280.);
          float a=sin(p.y*440.+sin(p.x*40.+time*.35)*2.+time*.65);
          float b=sin(p.x*380.+p.y*110.+time*.3);
          vec3 c=mix(vec3(.035,.075,.11),vec3(.09,.15,.20),min(p.x,1.));
          c+=step(.90,a)*step(.0,b)*.035; c+=step(.999,sin(p.x*333.+p.y*117.+time*.24))*.05;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(115.5, -.36, 0); this.root.add(this.water);
    // The enlarged deck and waterfront navigation share the same z = 2.9..7.1 opening.
    this.obstacles.push({ x: 18, z: -9.05, width: 6, depth: 23.9 }, { x: 18, z: 15.05, width: 6, depth: 15.9 });
    this.dock(16.4, 5, 7.2, 4.2);
    this.boat(21.5, 7.8); this.boat(28, -11, .7);
    for (const [x, z, size] of [[-18, -11, 1.15], [-17, -1, 1.05], [-17, 9, .9], [-7, -16, 1.1], [0, -17, .85], [12, -16, 1.1], [9.9, .3, .9], [-4.8, 10.5, .8], [-5, 18, 1.1], [13, 17, 1]]) this.tree(x, z, size);
    for (const [x, z] of [[-5.4, -2.7], [2.6, -4], [10, 7.8], [-5.3, 7], [14.2, 3.5]]) this.lamp(x, z);
    for (const [x, z] of [[-14, -2.5], [-13.2, -2.6], [11.7, -5.5], [12, -6.4], [17.8, 5.7], [-14.3, 8]]) this.barrel(x, z);
    for (const [x, z] of [[12.2, -4.5], [11.1, -4.4], [17.7, 4.3], [18.2, 4.1]]) this.crate(x, z);
    this.bench(3.8, 7.8); this.bench(-16, 3);
    this.bunting(); this.scatter(); this.backdrop(); this.boundary(); this.batchArchitecture(this.root);
    this.obstacles.push({ ...BURR, width: .5, depth: .5 });
    this.map = new WalkMap({ x: 0, z: .5, width: 40, depth: 39 }, this.obstacles);
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, shadow = true, parent: THREE.Object3D = this.root) {
    const mesh = new THREE.Mesh(boxGeometry, mat); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private batchArchitecture(group: THREE.Object3D) {
    for (const child of [...group.children]) if (child instanceof THREE.Group) this.batchArchitecture(child);
    const batches = new Map<string, THREE.Mesh[]>();
    for (const child of group.children) if (child instanceof THREE.Mesh && (child.geometry === boxGeometry || child.geometry === backdropGableGeometry) && !Array.isArray(child.material)) {
      const key = `${child.geometry.uuid}:${child.material.uuid}:${child.castShadow}`; const batch = batches.get(key) ?? []; batch.push(child); batches.set(key, batch);
    }
    for (const objects of batches.values()) {
      if (objects.length < 2) continue;
      const mesh = new THREE.InstancedMesh(objects[0].geometry, objects[0].material, objects.length); mesh.castShadow = objects[0].castShadow; mesh.receiveShadow = true;
      objects.forEach((obj, i) => { obj.updateMatrix(); mesh.setMatrixAt(i, obj.matrix); group.remove(obj); });
      mesh.computeBoundingSphere(); group.add(mesh);
    }
  }
  private floor(x: number, z: number, w: number, d: number, source: THREE.MeshLambertMaterial, y: number, u: number, v: number) {
    const mat = source.clone(); if (mat.map) { mat.map = mat.map.clone(); mat.map.repeat.set(u, v); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true; this.root.add(mesh);
  }
  private building(x: number, z: number, w: number, d: number, h: number, source: THREE.MeshLambertMaterial, tavern = false) {
    // The tavern door meets its existing story/exploration standing point at x = -8.
    const doorX = tavern ? 2 : 0;
    this.obstacles.push({ x, z, width: w + .2, depth: d + .2 });
    const group = new THREE.Group(); group.position.set(x, 0, z); this.root.add(group); this.occluders.push(group);
    const wall = source.clone(); if (wall.map) { wall.map = wall.map.clone(); wall.map.repeat.set(w / 2.6, h / 2.4); }
    this.box(0, h / 2, 0, w, h, d, wall, true, group);
    this.box(0, .22, 0, w + .2, .44, d + .2, this.mats.stone, true, group);
    this.box(0, h - .1, 0, w + .35, .25, d + .4, this.mats.trim, true, group);
    this.box(0, h * .49, 0, w + .1, .12, d + .1, this.mats.trim, true, group);
    for (const side of [-1, 1]) for (const front of [-1, 1]) this.box(side * (w / 2 - .12), h / 2, front * (d / 2 + .025), .18, h, .15, this.mats.trim, true, group);
    const rise = w * .24, slope = Math.atan2(rise, w / 2 + .4), length = Math.hypot(w / 2 + .4, rise);
    for (const side of [-1, 1]) {
      const roof = this.box(side * (w / 4 + .2), h + rise / 2, 0, length, .22, d + .9, this.mats.roof, true, group); roof.rotation.z = -side * slope;
    }
    const gableShape = new THREE.Shape(); gableShape.moveTo(-w / 2, 0); gableShape.lineTo(w / 2, 0); gableShape.lineTo(0, rise); gableShape.closePath();
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), new THREE.MeshLambertMaterial({ color: tavern ? 0x9c7958 : 0xd3c393, side: THREE.DoubleSide })); gable.position.set(0, h, side * d / 2); gable.castShadow = true; group.add(gable);
      for (const y of [1.6, h - 1.2]) for (let xx = -w / 2 + 1.5; xx < w / 2 - .7; xx += 2.2) {
        if (side === 1 && y === 1.6 && Math.abs(xx - doorX) < 1.3) continue;
        this.window(xx, y, side * (d / 2 + .07), group, side, tavern || Math.abs(Math.round(x + z + xx + y * 2)) % 3 !== 0);
      }
    }
    // Side elevations make orbiting and walking behind the houses useful.
    for (const side of [-1, 1]) for (const zz of [-d / 2 + 1.5, d / 2 - 1.5]) for (const y of [1.6, h - 1.2]) {
      const mount = new THREE.Group(); mount.position.set(side * (w / 2 + .03), 0, zz); mount.rotation.y = side * Math.PI / 2; group.add(mount); this.window(0, y, 0, mount, 1, Math.abs(Math.round(x + zz + y)) % 3 !== 0);
    }
    this.box(doorX, 1.12, d / 2 + .08, 1.4, 2.2, .15, this.mats.dark, true, group);
    this.box(doorX, 1.05, d / 2 + .18, 1.04, 2.06, .12, this.mats.wood, true, group);
    this.box(doorX + .34, 1.05, d / 2 + .27, .07, .1, .06, this.mats.trim, true, group);
    for (const xx of [-.7, .7]) this.box(doorX + xx, 1.17, d / 2 + .2, .13, 2.34, .16, this.mats.trim, true, group);
    this.box(doorX, 2.37, d / 2 + .2, 1.65, .2, .24, this.mats.trim, true, group);
    this.box(-w * .27, h + rise * .8, -d * .2, .8, 2.2, .8, this.mats.brick, true, group);
    this.box(-w * .27, h + rise * .8 + 1.13, -d * .2, 1, .18, 1, this.mats.trim, true, group);
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(leafGeometry, new THREE.MeshLambertMaterial({ color: 0xd6d5bc, transparent: true, opacity: .12 - i * .025, depthWrite: false }));
      puff.position.set(x - w * .27 + i * .25, h + rise * .8 + 1.6 + i * .7, z - d * .2); puff.scale.setScalar(.25 + i * .12); this.root.add(puff); this.smoke.push(puff);
    }
    if (tavern) {
      for (let i = 0; i < 6; i++) {
        const awning = this.box(doorX - 1.5 + i * .6, 2.7, d / 2 + .8, .6, .15, 1.7, i % 2 ? this.mats.red : this.mats.cloth, true, group); awning.rotation.x = .17;
        this.box(doorX - 1.5 + i * .6, 2.51, d / 2 + 1.64, .6, .22, .1, i % 2 ? this.mats.red : this.mats.cloth, true, group);
      }
      for (const xx of [-1.65, 1.65]) {
        this.box(doorX + xx, 1.33, d / 2 + 1.5, .1, 2.66, .1, this.mats.wood, true, group);
        this.obstacles.push({ x: x + doorX + xx, z: z + d / 2 + 1.5, width: .1, depth: .1 });
      }
      // Suspend a large tankard sign beside the canopy, facing the approaching street.
      const signX = doorX - 2.8;
      this.box(signX, 4.48, d / 2 + 1.15, 2.5, .08, .08, this.mats.iron, true, group);
      for (const xx of [-.95, .95]) {
        this.box(signX + xx, 4.48, d / 2 + .6, .08, .08, 1.2, this.mats.iron, true, group);
        this.box(signX + xx, 4.24, d / 2 + 1.15, .045, .48, .045, this.mats.iron, true, group);
      }
      this.tavernSign = new TavernSign(); this.tavernSign.root.position.set(signX, 3.2, d / 2 + 1.15); group.add(this.tavernSign.root);
      for (const xx of [-1.05, 1.05]) {
        this.box(doorX + xx, 1.9, d / 2 + .4, .3, .46, .3, this.mats.iron, true, group);
        this.box(doorX + xx, 1.9, d / 2 + .42, .23, .32, .27, this.mats.warmGlass, false, group);
        const light = new THREE.PointLight(0xffbb62, 3, 3.2, 2); light.position.set(doorX + xx, 1.9, d / 2 + .65); group.add(light);
      }
      this.barrel(x + doorX - 2.6, z + d / 2 + .65);
    }
  }
  private window(x: number, y: number, z: number, parent: THREE.Object3D, side: number, warm = false) {
    this.box(x, y, z, 1.02, 1.45, .12, this.mats.trim, true, parent);
    this.box(x, y, z + .07 * side, .8, 1.23, .08, warm ? this.mats.warmGlass : this.mats.glass, false, parent);
    this.box(x, y, z + .13 * side, .055, 1.23, .055, this.mats.trim, true, parent);
    this.box(x, y + .05, z + .13 * side, .8, .05, .055, this.mats.trim, true, parent);
    this.box(x, y - .72, z, 1.18, .1, .38, this.mats.trim, true, parent);
    for (const s of [-1, 1]) this.box(x + s * .68, y, z, .25, 1.4, .12, this.mats.dark, true, parent);
  }
  private tree(x: number, z: number, size: number) {
    this.obstacles.push({ x, z, width: .85 * size, depth: .85 * size });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17 * size, .38 * size, 4.1 * size, 7), this.mats.bark); trunk.position.set(x, 2 * size, z); trunk.castShadow = true; this.root.add(trunk);
    const crown = new THREE.Group(); crown.position.set(x, 4.4 * size, z); crown.userData.size = size; this.root.add(crown); this.leaves.push(crown); this.occluders.push(crown);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4, radius = (i < 6 ? .6 : 1.45) * size;
      const leaf = new THREE.Mesh(leafGeometry, [this.mats.leaf, this.mats.leafDark, this.mats.leafLight][i % 3]);
      leaf.position.set(Math.cos(a) * radius, (random() - .15) * 1.8 * size, Math.sin(a) * radius);
      leaf.scale.set((.7 + random() * .6) * size, (.7 + random() * .6) * size, (.7 + random() * .5) * size);
      leaf.rotation.set(random(), random(), random()); leaf.castShadow = true; leaf.receiveShadow = true; crown.add(leaf);
    }
  }
  async addFoliage() {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = '/art/environment/elm-foliage-v1.png'; });
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const ctx = source.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height);
    for (let i = 0; i < pixels.data.length; i += 4) { const [r, g, b] = pixels.data.slice(i, i + 3); if (r > 100 && b > 100 && r - g > 50 && b - g > 50) pixels.data[i + 3] = 0; }
    ctx.putImageData(pixels, 0, 0);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
    const output = canvas.getContext('2d')!; output.imageSmoothingEnabled = false; output.drawImage(source, 0, 0, 192, 192);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.NearestFilter;
    const mat = new THREE.MeshLambertMaterial({ map, color: 0x9ca68d, alphaTest: .48, side: THREE.DoubleSide, emissive: 0x49524b, emissiveMap: map, emissiveIntensity: .06 });
    const geometry = new THREE.PlaneGeometry(1, 1);
    for (const crown of this.leaves) {
      crown.clear(); const size = crown.userData.size as number;
      for (let i = 0; i < 30; i++) {
        const a = i * 2.4, r = (i < 8 ? .5 : 1.55) * size;
        const leaf = new THREE.Mesh(geometry, mat); leaf.position.set(Math.cos(a) * r, (random() - .35) * 1.8 * size, Math.sin(a) * r);
        leaf.userData.angle = random() * .6 - .3;
        leaf.rotation.set(-.2, .48 + leaf.userData.angle, random() * .5 - .25); leaf.scale.setScalar((1.5 + random() * .9) * size);
        leaf.castShadow = true; leaf.receiveShadow = true; crown.add(leaf);
      }
    }
  }
  private barrel(x: number, z: number) {
    this.obstacles.push({ x, z, width: .65, depth: .65 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.32, .3, .86, 10), this.mats.barrel); mesh.position.set(x, .43, z); mesh.castShadow = true; this.root.add(mesh);
    for (const y of [.16, .7]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(.332, .332, .065, 10, 1, true), this.mats.iron); band.position.set(x, y, z); this.root.add(band); }
  }
  private crate(x: number, z: number) {
    this.obstacles.push({ x, z, width: .7, depth: .7 });
    this.box(x, .35, z, .7, .7, .7, this.mats.wood);
    for (const xx of [-.28, .28]) this.box(x + xx, .35, z + .37, .08, .7, .05, this.mats.trim);
  }
  private lamp(x: number, z: number) {
    this.obstacles.push({ x, z, width: .3, depth: .3 });
    this.box(x, 1.25, z, .09, 2.5, .09, this.mats.iron);
    this.box(x, .15, z, .25, .3, .25, this.mats.iron);
    this.box(x, 2.6, z, .3, .44, .3, this.mats.warmGlass, false);
    for (const xx of [-.16, .16]) for (const zz of [-.16, .16]) this.box(x + xx, 2.6, z + zz, .04, .51, .04, this.mats.iron);
    for (const y of [2.36, 2.84]) this.box(x, y, z, .36, .045, .36, this.mats.iron);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.33, .22, 4), this.mats.iron); cap.position.set(x, 2.95, z); cap.rotation.y = Math.PI / 4; cap.castShadow = true; this.root.add(cap);
    const light = new THREE.PointLight(0xffb765, 6, 7, 2); light.position.set(x, 2.6, z); this.root.add(light);
  }
  private bench(x: number, z: number) {
    this.obstacles.push({ x, z, width: 1.9, depth: .7 });
    this.box(x, .5, z, 1.9, .14, .65, this.mats.wood); this.box(x, .96, z + .3, 1.9, .5, .12, this.mats.wood);
    for (const side of [-1, 1]) this.box(x + side * .7, .25, z, .12, .5, .55, this.mats.iron);
  }
  private dock(x: number, z: number, w: number, d: number) {
    const planks = Math.ceil(w / .33), pitch = w / planks;
    for (let i = 0; i < planks; i++) this.box(x - w / 2 + pitch * (i + .5), -.035, z, pitch - .025, .17, d, this.mats.wood);
    for (const xx of [x - w / 2 + .3, x, x + w / 2 - .3]) for (const zz of [z - d / 2, z + d / 2]) {
      this.box(xx, -.2, zz, .25, 1.7, .25, this.mats.wood);
      this.obstacles.push({ x: xx, z: zz, width: .25, depth: .25 });
    }
    for (const zz of [z - d / 2, z + d / 2]) this.box(x, -.2, zz, w, .26, .2, this.mats.wood);
  }
  private boat(x: number, z: number, scale = 1) {
    const boat = new THREE.Group(); boat.position.set(x, -.25, z); boat.scale.setScalar(scale); boat.rotation.y = -.2; this.root.add(boat);
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1, .55, .8, 7), this.mats.wood); hull.scale.set(1, 1, 2.8); boat.add(hull);
    this.box(0, .45, 0, 1.5, .1, 3.7, this.mats.dark, true, boat); this.box(0, 2.8, 0, .11, 5.2, .11, this.mats.wood, true, boat);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.2, 5, 5), new THREE.MeshLambertMaterial({ color: 0xd1cfaf, side: THREE.DoubleSide })); sail.position.set(.1, 3, .05); sail.rotation.y = -.3; sail.castShadow = true; boat.add(sail);
    this.box(0, 4.6, 0, 3.1, .07, .07, this.mats.wood, true, boat);
  }
  private market(x: number, z: number) {
    this.obstacles.push({ x, z, width: 3.6, depth: 1.8 });
    this.box(x, .7, z, 3.4, .18, 1.6, this.mats.wood);
    for (const xx of [-1.6, 1.6]) for (const zz of [-.7, .7]) this.box(x + xx, 1.28, z + zz, .09, 2.56, .09, this.mats.wood);
    for (let i = 0; i < 6; i++) { const strip = this.box(x - 1.5 + i * .6, 2.55, z, .6, .09, 2.1, i % 2 ? this.mats.red : this.mats.cloth); strip.rotation.x = -.14; }
    for (let i = 0; i < 18; i++) { const apple = new THREE.Mesh(leafGeometry, i % 3 ? this.mats.red : this.mats.leafLight); apple.scale.setScalar(.11); apple.position.set(x - 1.2 + (i % 6) * .46, .9, z - .4 + Math.floor(i / 6) * .38); this.root.add(apple); }
  }
  private bunting() {
    const points = []; for (let i = 0; i <= 20; i++) points.push(new THREE.Vector3(-5.8 + i * .45, 4.7 - Math.sin(i / 20 * Math.PI) * .85, -2));
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x5b5542 })); this.root.add(cable);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.18, 0, 0, .18, 0, 0, 0, -.48, 0], 3)); geometry.computeVertexNormals();
    for (let i = 1; i < 20; i += 2) { const flag = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: [0xab7958, 0xc5c9a2, 0x556e69][i % 3], side: THREE.DoubleSide })); flag.position.copy(points[i]); this.root.add(flag); this.flags.push(flag); }
  }
  private scatter() {
    const geometry = new THREE.ConeGeometry(.06, .26, 3), grass = new THREE.InstancedMesh(geometry, this.mats.leafLight, 600);
    const flower = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.045, 0), this.mats.flower, 60);
    const dummy = new THREE.Object3D(); let count = 0, flowers = 0;
    for (let i = 0; i < 6000 && count < 600; i++) {
      const x = -20 + random() * 34, z = -19 + random() * 39;
      if (!plantedYards.some(([xx, zz, w, d]) => Math.abs(x - xx) < w / 2 && Math.abs(z - zz) < d / 2)) continue;
      if ((z > -.5 && z < 7) || (x > -5 && x < 2) || x > 9.2 || this.obstacles.some(o => Math.abs(x - o.x) < o.width / 2 + .5 && Math.abs(z - o.z) < o.depth / 2 + .5)) continue;
      dummy.position.set(x, .07 + random() * .04, z); dummy.scale.setScalar(.5 + random()); dummy.rotation.y = random() * 6.28; dummy.updateMatrix(); grass.setMatrixAt(count++, dummy.matrix);
      if (flowers < 60 && i % 5 === 0) { dummy.position.y = .2; dummy.updateMatrix(); flower.setMatrixAt(flowers++, dummy.matrix); }
    }
    grass.count = count; flower.count = flowers; grass.receiveShadow = true; this.root.add(grass, flower);
  }
  private backdrop() {
    // Paved lanes and compact town blocks continue on all three landward sides.
    // Scenery stays outside WalkMap and has no foliage, smoke, lights, or occlusion probes.
    this.floor(-22.1, 0, 2.8, 146, this.mats.stone, -.025, 1.4, 73);
    for (const z of [-21.6, 22.6]) this.floor(-35.1, z, 99, 2.8, this.mats.stone, -.025, 49.5, 1.4);
    for (const x of [-35, -48, -61]) this.floor(x, 0, 3, 146, this.mats.stone, -.04, 1.5, 73);
    for (const z of [-36, -51, 36, 51]) this.floor(-35.1, z, 99, 3.4, this.mats.stone, -.04, 49.5, 1.7);

    for (const x of [-27.8, -40.8, -53.8, -66.8]) for (const z of [-59, -44, -29, -15, -5.5, 12, 27, 43, 59]) {
      const near = x === -27.8 && z >= -29 && z <= 27;
      this.backdropHouse(x, z, 7.2 + random() * 1.6, 7.2, 4.8 + random() * 2.2, Math.PI / 2, near);
    }
    for (const z of [-28, -44, -59, 28, 44, 59]) for (const x of [-14, -3.7, 7.3]) {
      this.backdropHouse(x, z, 7.6 + random() * 1.5, 7.5, 4.7 + random() * 2.5, z < 0 ? 0 : Math.PI, Math.abs(z) === 28);
    }
  }
  private backdropHouse(x: number, z: number, w: number, d: number, h: number, yaw: number, detailed: boolean) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = yaw;
    const wall = Math.round(Math.abs(x + z)) % 3 === 0 ? this.mats.cream : this.mats.brick;
    this.box(0, h / 2, 0, w, h, d, wall, false, group);
    this.box(0, .18, 0, w + .12, .36, d + .12, this.mats.stone, false, group);
    for (const y of [h * .5, h]) this.box(0, y, 0, w + .12, .15, d + .16, this.mats.trim, false, group);
    const rise = w * .23, slope = Math.atan2(rise, w / 2 + .3), length = Math.hypot(w / 2 + .3, rise);
    for (const side of [-1, 1]) {
      const roof = this.box(side * (w / 4 + .15), h + rise / 2, 0, length, .2, d + .65, this.mats.roof, false, group); roof.rotation.z = -side * slope;
    }
    const gable = new THREE.Mesh(backdropGableGeometry, wall); gable.position.y = h; gable.scale.set(w, rise, d); group.add(gable);
    this.box(-w * .27, h + rise * .8 + .25, -d * .18, .65, 1.5, .7, this.mats.brick, false, group);
    this.box(-w * .27, h + rise * .8 + 1, -d * .18, .85, .13, .9, this.mats.trim, false, group);
    for (const side of [-1, 1]) for (const y of [1.6, h - 1.35]) for (const xx of [-w * .31, 0, w * .31]) {
      if (y === 1.6 && xx === 0) continue;
      const lit = Math.abs(Math.round(x + z + xx + y * side)) % 3 !== 0;
      this.box(xx, y, side * (d / 2 + .025), 1.05, 1.5, .07, this.mats.trim, false, group);
      this.box(xx, y, side * (d / 2 + .075), .83, 1.27, .045, lit ? this.mats.warmGlass : this.mats.glass, false, group);
      if (detailed) {
        this.box(xx, y, side * (d / 2 + .11), .045, 1.27, .045, this.mats.dark, false, group);
        this.box(xx, y, side * (d / 2 + .11), .83, .055, .045, this.mats.dark, false, group);
      }
    }
    this.box(0, 1.05, d / 2 + .035, 1.3, 2.1, .1, this.mats.dark, false, group);
    this.box(0, 1.05, d / 2 + .1, 1.03, 1.94, .06, this.mats.wood, false, group);
    // Flatten each local facade into the root so shared materials batch across the whole skyline.
    group.updateMatrix();
    for (const child of [...group.children]) { child.applyMatrix4(group.matrix); this.root.add(child); }
  }
  private boundary() {
    for (let z = -18.8; z <= 20; z += 1.7) {
      this.box(-20.1, .55, z, .15, 1.1, .15, this.mats.wood);
      for (const y of [.35, .78]) this.box(-20.1, y, z + .8, .08, .12, 1.75, this.mats.wood);
    }
    for (const z of [-19.1, 20.1]) for (let x = -19.3; x <= 14; x += 1.7) {
      this.box(x, .55, z, .15, 1.1, .15, this.mats.wood);
      for (const y of [.35, .78]) this.box(x + .8, y, z, 1.75, .12, .08, this.mats.wood);
    }
  }
  update(time: number, reduceMotion: boolean, cameraYaw: number) {
    this.tavernSign?.update();
    this.water.material.uniforms.time.value = reduceMotion ? 0 : time;
    this.leaves.forEach((leaf, i) => { leaf.rotation.z = reduceMotion ? 0 : Math.sin(time * .7 + i) * .014; leaf.children.forEach(card => { card.rotation.y = cameraYaw + (card.userData.angle ?? 0); }); });
    this.flags.forEach((flag, i) => { flag.rotation.x = reduceMotion ? .1 : .15 + Math.sin(time * 1.7 + i * .8) * .18; });
  }
}
