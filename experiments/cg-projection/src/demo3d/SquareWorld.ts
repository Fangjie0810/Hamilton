import * as THREE from 'three';
import { WorldKit } from './SceneWorld';

/** A civic square with a debate platform, working press and a central memorial. */
export class SquareWorld extends WorldKit {
  private mats = {
    stone: this.material(0x9b9681, true), paleStone: this.material(0xc0b49a, true), darkStone: this.material(0x817e6d, true),
    plaster: this.material(0xd2c398, true), brick: this.material(0xa16e52, true), roof: this.material(0x4d5952, true),
    wood: this.material(0x8d6c45, true), trim: this.material(0xd5c196), timber: this.material(0x594532, true),
    iron: this.material(0x344137), glass: this.material(0x3b5752), cloth: this.material(0xdacba7, true),
    red: this.material(0x9c5740, true), blue: this.material(0x526d70, true), paper: this.material(0xe3d3a8, true),
    grass: this.material(0x747f4e, true), dirt: this.material(0x8a7954, true), leaf: this.material(0x758b4d),
    bronze: this.material(0x526459, true), water: this.material(0x668d80, false, 0x10291e), amber: this.material(0xc29751),
  };
  private pennants: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>[] = [];
  private foliage: THREE.Mesh[] = [];
  private ripples: THREE.Mesh[] = [];

  constructor() {
    super();
    this.root.name = 'square';
    this.ground(0, 0, 400, 400, this.mats.grass, -.15);
    this.ground(0, 0, 40, 37, this.mats.dirt, -.07);
    this.box(0, -.09, 0, 32, .14, 28, this.mats.darkStone);
    const pavement = [this.mats.stone, this.mats.paleStone, this.mats.darkStone];
    for (let row = 0; row < 51; row++) for (let col = 0; col < 42; col++) {
      const x = -15.7 + col * .76 + (row % 2) * .36, z = -13.7 + row * .55;
      if (x > 15.6) continue;
      this.box(x, -.032, z, .71, .045, .5, pavement[Math.floor(this.random() * 8) % 3]);
    }
    // Pale stone bands give the plaza a legible axial route across the small cobbles.
    for (const x of [-1.1, 1.1]) this.box(x, -.004, 3.4, .17, .022, 20.6, this.mats.trim);
    for (const z of [-.8, 1.1]) this.box(0, -.004, z, 31, .022, .14, this.mats.trim);
    this.building(0, -14.3, 13, 5.2, 6, true);
    this.building(-13.4, -5.5, 4.5, 8, 4.4);
    this.building(13.7, -7.5, 4.6, 8.5, 5.3);
    this.building(-14, 12.9, 4.4, 4.6, 3.8);
    this.fountain(-5, -3);
    this.stage();
    this.printingStall();
    this.noticeboard();
    this.market(12.9, 3.3);
    for (const [x, z] of [[-10, -10.7], [-13.6, 8.2], [11.4, 12.4]]) this.tree(x, z);
    for (const [x, z] of [[-8.4, -6.8], [-5, 1.05], [2.8, 6], [7.7, 10.5]]) this.bench(x, z);
    for (const [x, z] of [[-8.8, 7.3], [9.8, -1.4], [-1.8, 10.6], [10.5, -10.5]]) this.lamp(x, z);
    for (const [x, z] of [[-14.6, 2.3], [-14.5, 3.3], [14.2, 6.4], [13.3, 6.8]]) this.barrel(x, z);
    this.bannerLine(-10, 7.4, 9.9, 7.2);
    this.bannerLine(-8.7, -9.2, 10.5, -9.6);
    this.surroundings();
    this.perimeter();
    this.finish({ x: 0, z: 0, width: 32, depth: 28 });
  }

  private ground(x: number, z: number, width: number, depth: number, source: THREE.MeshLambertMaterial, y: number) {
    const material = source.clone();
    if (source.map) { material.map = source.map.clone(); material.map.repeat.set(width / 2, depth / 2); }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    ground.position.set(x, y, z); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.root.add(ground);
  }

  private surroundings() {
    // Low-cost ground extends beyond every allowed camera view; only the original plaza is navigable.
    for (const x of [-21, 0, 21]) this.ground(x, 0, 5.5, 240, this.mats.darkStone, -.115);
    for (const z of [-21, 21]) this.ground(0, z, 240, 5.5, this.mats.darkStone, -.11);
    for (const [x, z, width, depth, height] of [
      [-30, -12, 7, 9, 5], [-30, 4, 8, 8, 4.4], [-30, 29, 8, 7, 4.8],
      [-12, -31, 8, 7, 5.3], [3, -32, 9, 8, 5.7], [19, -31, 8, 7, 4.8],
      [31, -12, 8, 9, 5.2], [31, 5, 7, 8, 4.4], [30, 29, 8, 8, 5.5],
      [-12, 34, 7, 8, 4.6], [5, 35, 8, 7, 5],
    ]) this.building(x, z, width, depth, height);
  }

  private building(x: number, z: number, width: number, depth: number, height: number, civic = false) {
    this.block(x, z, width + .15, depth + .15);
    const g = this.group(true); g.position.set(x, 0, z);
    this.box(0, height / 2, 0, width, height, depth, civic ? this.mats.paleStone : this.mats.brick, g);
    this.box(0, .3, 0, width + .2, .6, depth + .2, this.mats.darkStone, g);
    for (const y of [1.1, height * .52, height]) this.box(0, y, 0, width + .22, .18, depth + .22, this.mats.trim, g);
    const rise = width * .2, pitch = Math.atan2(rise, width / 2 + .35);
    for (const side of [-1, 1]) {
      const roof = this.box(side * (width / 4 + .175), height + rise / 2, 0, Math.hypot(width / 2 + .35, rise), .24, depth + .65, this.mats.roof, g); roof.rotation.z = -side * pitch;
      for (let xx = -width / 2 + 1.3; xx < width / 2 - .8; xx += 2.25) for (const y of [1.95, height - 1.2]) {
        if (civic && Math.abs(xx) < 1.35 && y < 3) continue;
        this.window(xx, y, side * (depth / 2 + .08), side, g);
      }
    }
    for (const side of [-1, 1]) {
      const gable = new THREE.Shape(); gable.moveTo(-width / 2, 0); gable.lineTo(width / 2, 0); gable.lineTo(0, rise); gable.closePath();
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(gable), new THREE.MeshLambertMaterial({ color: civic ? 0xc0b399 : 0xa97858, side: THREE.DoubleSide })); mesh.position.set(0, height, side * depth / 2); mesh.castShadow = true; g.add(mesh);
      for (const zz of [-depth / 2 + 1.5, depth / 2 - 1.5]) {
        const mount = new THREE.Group(); mount.position.set(side * (width / 2 + .04), 0, zz); mount.rotation.y = side * Math.PI / 2; g.add(mount);
        for (const y of [1.9, height - 1.1]) this.window(0, y, 0, 1, mount);
      }
    }
    this.box(0, 1.2, depth / 2 + .13, 1.5, 2.4, .15, this.mats.timber, g);
    for (const xx of [-.9, .9]) this.box(xx, 1.4, depth / 2 + .19, .22, 2.8, .32, this.mats.trim, g);
    this.box(0, 2.9, depth / 2 + .19, 2.1, .23, .42, this.mats.trim, g);
    if (civic) {
      // The courthouse clock and pediment are symbols, with no baked-in lettering.
      this.cylinder(0, height + .9, depth / 2 + .14, .68, .68, .1, this.mats.trim, g, 12).rotation.x = Math.PI / 2;
      this.cylinder(0, height + .9, depth / 2 + .22, .56, .56, .1, this.mats.paper, g, 12).rotation.x = Math.PI / 2;
      this.box(0, height + 1.04, depth / 2 + .28, .035, .3, .035, this.mats.iron, g);
      const hand = this.box(.13, height + .85, depth / 2 + .28, .28, .035, .035, this.mats.iron, g); hand.rotation.z = -.3;
      for (const xx of [-5, -2.8, 2.8, 5]) {
        this.cylinder(xx, 1.7, depth / 2 + .33, .25, .3, 3.4, this.mats.trim, g, 8);
        this.box(xx, 3.5, depth / 2 + .33, .64, .2, .64, this.mats.paleStone, g);
      }
      this.box(0, 3.73, depth / 2 + .34, 12, .24, .83, this.mats.trim, g);
      this.block(x, z + depth / 2 + .35, 12, .8);
    } else {
      this.box(-width * .24, height + rise * .6, -.6, .65, 2, .75, this.mats.brick, g);
      this.box(-width * .24, height + rise * .6 + 1, -.6, .83, .18, .94, this.mats.trim, g);
    }
  }

  private window(x: number, y: number, z: number, side: number, g: THREE.Object3D) {
    this.box(x, y, z, 1.08, 1.47, .12, this.mats.trim, g);
    this.box(x, y, z + side * .08, .86, 1.24, .07, this.mats.glass, g);
    this.box(x, y, z + side * .125, .045, 1.24, .04, this.mats.trim, g);
    this.box(x, y, z + side * .125, .86, .045, .04, this.mats.trim, g);
    for (const xx of [-.7, .7]) this.box(x + xx, y, z, .22, 1.46, .15, this.mats.roof, g);
    this.box(x, y - .77, z, 1.31, .1, .35, this.mats.paleStone, g);
  }

  private fountain(x: number, z: number) {
    this.block(x, z, 4, 4);
    this.cylinder(x, .15, z, 2, 2.04, .3, this.mats.darkStone, this.root, 12);
    this.cylinder(x, .4, z, 1.89, 1.85, .48, this.mats.paleStone, this.root, 12);
    this.cylinder(x, .65, z, 1.68, 1.68, .025, this.mats.water, this.root, 12);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.83, .16, 5, 12), this.mats.trim); rim.position.set(x, .66, z); rim.rotation.x = Math.PI / 2; rim.castShadow = true; this.root.add(rim);
    this.box(x, .92, z, 1.17, .62, 1.17, this.mats.darkStone);
    this.box(x, 1.26, z, 1.35, .13, 1.35, this.mats.trim);
    this.box(x, 1.72, z, .85, .83, .85, this.mats.paleStone);
    this.box(x, 2.18, z, 1.08, .14, 1.08, this.mats.trim);
    const statue = this.group(true);
    // A weathered bronze civic figure, deliberately sculptural beside the pixel actor.
    this.box(x, 2.45, z, .6, .43, .5, this.mats.bronze, statue);
    for (const side of [-1, 1]) this.box(x + side * .18, 2.84, z, .23, .74, .25, this.mats.bronze, statue);
    this.box(x, 3.4, z, .67, .65, .38, this.mats.bronze, statue);
    this.box(x, 3.89, z, .32, .35, .32, this.mats.bronze, statue);
    this.box(x, 4.08, z, .65, .1, .45, this.mats.bronze, statue);
    this.box(x, 4.18, z, .36, .15, .3, this.mats.bronze, statue);
    const arm = this.box(x + .49, 3.57, z, .65, .2, .23, this.mats.bronze, statue); arm.rotation.z = -.47;
    const scroll = this.box(x + .79, 3.41, z, .22, .36, .14, this.mats.bronze, statue); scroll.rotation.z = .19;
    this.box(x - .44, 3.32, z, .2, .59, .25, this.mats.bronze, statue);
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(.22 + i * .12, .014, 3, 14), this.mats.trim); mesh.rotation.x = Math.PI / 2; mesh.position.set(x + .65, .676 + i * .001, z + .65); this.root.add(mesh); this.ripples.push(mesh);
    }
  }

  private stage() {
    const x = 5, z = -6;
    this.block(x, z, 8, 5);
    this.box(x, .36, z, 8, .72, 5, this.mats.timber);
    for (let xx = 1.12; xx < 9; xx += .32) this.box(xx, .74, z, .3, .1, 4.9, this.mats.wood);
    const structure = this.group(true);
    for (const xx of [1.3, 8.7]) {
      this.box(xx, 2.35, -8.1, .17, 3.25, .17, this.mats.timber, structure);
      this.box(xx, 3.7, -7.85, .05, .05, .64, this.mats.iron, structure);
      this.banner(xx, 2.97, -7.63, .88, 1.35, xx < 5 ? this.mats.red : this.mats.blue, structure);
    }
    this.box(5, 3.92, -8.1, 7.6, .17, .2, this.mats.timber, structure);
    this.box(5, 1.26, -7.5, 6.6, .1, .48, this.mats.timber, structure);
    for (const xx of [2, 4, 6, 8]) this.box(xx, 1.09, -7.5, .11, .7, .11, this.mats.timber, structure);
    this.box(5, 1.18, -4.7, 1.5, .8, .85, this.mats.timber);
    const lectern = this.box(5, 1.71, -4.7, 1.73, .11, 1, this.mats.wood); lectern.rotation.x = .16;
    this.box(5, 1.8, -4.75, .56, .018, .4, this.mats.paper);
    // Front risers lie inside the blocked stage footprint, leaving the inspection point free.
    this.box(5, .18, -3.66, 2.8, .36, .31, this.mats.wood);
    this.box(5, .43, -3.95, 2.8, .5, .32, this.mats.wood);
    for (const xx of [2.5, 7.5]) {
      this.box(xx, 1.16, -6.5, 1.1, .12, .6, this.mats.wood);
      for (const side of [-1, 1]) this.box(xx + side * .36, .93, -6.5, .09, .45, .42, this.mats.timber);
    }
  }

  private printingStall() {
    const x = -11, z = 4, g = this.group(true);
    this.block(x, z, 3.5, 3.3);
    for (const xx of [-12.6, -9.4]) for (const zz of [2.5, 5.5]) this.box(xx, 1.53, zz, .13, 3.06, .13, this.mats.timber, g);
    for (let i = 0; i < 7; i++) {
      const awning = this.box(-12.5 + i * .5, 3.03, z, .5, .09, 3.35, i % 2 ? this.mats.cloth : this.mats.red, g); awning.rotation.x = .09;
      this.box(-12.5 + i * .5, 2.79, 5.64, .5, .39, .07, i % 2 ? this.mats.cloth : this.mats.red, g);
    }
    // Recognizable wooden screw press, visible through three open sides of the awning.
    for (const xx of [-11.85, -10.45]) {
      this.box(xx, 1.27, 3.45, .24, 2.4, .3, this.mats.timber, g);
      this.box(xx, .17, 3.55, .37, .27, 1.67, this.mats.timber, g);
    }
    this.box(-11.15, 2.41, 3.45, 1.82, .33, .43, this.mats.wood, g);
    this.cylinder(-11.15, 1.95, 3.45, .12, .12, .72, this.mats.iron, g);
    for (let y = 1.63; y < 2.32; y += .13) this.cylinder(-11.15, y, 3.45, .16, .16, .045, this.mats.wood, g);
    this.box(-11.15, 1.61, 3.45, 1.2, .14, .87, this.mats.timber, g);
    this.box(-11.15, 1.16, 3.78, 1.8, .19, 1.61, this.mats.wood, g);
    this.box(-11.15, 1.27, 3.99, 1.13, .04, .77, this.mats.paper, g);
    this.box(-10.5, 1.98, 3.45, 1.5, .075, .075, this.mats.iron, g);
    this.box(-11, .88, 5.04, 2.65, .16, .77, this.mats.wood, g);
    for (const xx of [-12.12, -9.9]) this.box(xx, .41, 5.04, .15, .82, .56, this.mats.timber, g);
    for (let i = 0; i < 3; i++) this.paperStack(-11.8 + i * .8, 1, 5.04, g);
    this.box(-9.41, 1.9, 4.6, .06, .8, .62, this.mats.paper, g);
  }

  private noticeboard() {
    const x = 8, z = 5.5, g = this.group(true);
    this.block(x, z, 2.7, .55);
    for (const side of [-1, 1]) this.box(x + side * 1.18, 1.36, z, .17, 2.72, .2, this.mats.timber, g);
    this.box(x, 1.95, z, 2.55, 1.43, .17, this.mats.wood, g);
    this.box(x, 2.75, z, 2.92, .16, .52, this.mats.roof, g);
    for (const face of [-1, 1]) for (let i = 0; i < 4; i++) {
      const xx = x - .87 + (i % 2) * 1.05, yy = 1.65 + Math.floor(i / 2) * .61;
      const sheet = this.box(xx, yy, z + face * .1, .72, .49, .02, this.mats.paper, g); sheet.rotation.z = i % 2 ? .06 : -.09;
      for (let row = 0; row < 4; row++) this.box(xx, yy + .13 - row * .082, z + face * .12, .45 - (row % 3) * .05, .015, .009, this.mats.timber, g);
      this.box(xx + .23, yy - .13, z + face * .13, .1, .1, .012, this.mats.red, g);
    }
  }

  private market(x: number, z: number) {
    this.block(x, z, 3.9, 3.2);
    const g = this.group(true);
    for (const side of [-1, 1]) for (const face of [-1, 1]) this.box(x + side * 1.7, 1.37, z + face * 1.37, .12, 2.74, .12, this.mats.timber, g);
    for (let i = 0; i < 8; i++) { const strip = this.box(x - 1.69 + i * .49, 2.8, z, .49, .08, 3.23, i % 2 ? this.mats.blue : this.mats.cloth, g); strip.rotation.x = .13; }
    this.box(x, .97, z + .67, 3.7, .15, 1.05, this.mats.wood, g);
    for (const side of [-1, 1]) this.box(x + side * 1.4, .48, z + .67, .16, .96, .9, this.mats.timber, g);
    for (let i = 0; i < 3; i++) {
      const xx = x - 1.15 + i * 1.1;
      this.box(xx, 1.13, z + .67, .92, .22, .76, this.mats.timber, g);
      for (let j = 0; j < 7; j++) this.box(xx + (j % 3 - 1) * .24, 1.32 + Math.floor(j / 3) * .035, z + .49 + Math.floor(j / 3) * .17, .2, .18, .18, i % 2 ? this.mats.amber : this.mats.red, g);
    }
  }

  private paperStack(x: number, y: number, z: number, parent: THREE.Object3D) {
    for (let i = 0; i < 4; i++) this.box(x + (i % 2) * .015, y + i * .025, z, .58, .025, .45, this.mats.paper, parent);
    for (let i = 0; i < 4; i++) this.box(x, y + .092, z - .12 + i * .07, .36 - (i % 2) * .05, .009, .013, this.mats.timber, parent);
  }

  private tree(x: number, z: number) {
    this.block(x, z, 1.3, 1.3);
    this.cylinder(x, .09, z, .95, .95, .18, this.mats.paleStone, this.root, 10);
    this.cylinder(x, 2, z, .17, .34, 4, this.mats.timber, this.root, 7);
    for (const side of [-1, 1]) { const branch = this.cylinder(x + side * .43, 3.2, z, .07, .15, 1.6, this.mats.timber); branch.rotation.z = side * -.57; }
    const crown = this.group(true);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!, shades = ['#556d39', '#6d8343', '#879650', '#a0a661'];
    for (let i = 0; i < 180; i++) {
      const a = this.random() * Math.PI * 2, r = Math.sqrt(this.random()) * 24, px = 32 + Math.cos(a) * r, py = 32 + Math.sin(a) * r * .85;
      ctx.fillStyle = shades[i % 4]; ctx.fillRect(Math.round(px / 2) * 2, Math.round(py / 2) * 2, 4 + (i % 3) * 2, 4 + (i % 2) * 2);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.NearestFilter;
    const mat = new THREE.MeshLambertMaterial({ map, color: 0xe5e4bc, alphaTest: .4, side: THREE.DoubleSide, emissive: 0x304016, emissiveIntensity: .2 });
    const geometry = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 25; i++) {
      const angle = i * 2.4, radius = i < 6 ? .4 : 1.3;
      const leaf = new THREE.Mesh(geometry, mat); leaf.position.set(x + Math.cos(angle) * radius, 4.2 + (this.random() - .3) * 1.9, z + Math.sin(angle) * radius); leaf.scale.setScalar(1.7 + this.random() * .6);
      leaf.rotation.set(-.2, .48 + this.random() * .5, this.random() * .4 - .2); leaf.userData.angle = leaf.rotation.y - .48; leaf.castShadow = leaf.receiveShadow = true; crown.add(leaf); this.foliage.push(leaf);
    }
  }

  private bench(x: number, z: number) {
    this.block(x, z, 2.7, .77);
    this.box(x, .57, z, 2.7, .15, .68, this.mats.wood);
    this.box(x, 1.01, z + .32, 2.7, .53, .13, this.mats.wood);
    for (const side of [-1, 1]) this.box(x + side * 1, .31, z, .14, .62, .57, this.mats.iron);
  }

  private lamp(x: number, z: number) {
    this.block(x, z, .35, .35);
    this.box(x, 1.6, z, .1, 3.2, .1, this.mats.iron);
    this.box(x, .13, z, .32, .26, .32, this.mats.iron);
    this.box(x, 3.32, z, .37, .52, .37, this.mats.amber);
    for (const side of [-1, 1]) {
      this.box(x + side * .18, 3.32, z, .035, .56, .4, this.mats.iron);
      this.box(x, 3.32, z + side * .18, .4, .56, .035, this.mats.iron);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.35, .25, 4), this.mats.iron); cap.position.set(x, 3.73, z); cap.rotation.y = Math.PI / 4; cap.castShadow = true; this.root.add(cap);
  }

  private barrel(x: number, z: number) {
    this.block(x, z, .75, .75);
    this.cylinder(x, .48, z, .34, .33, .96, this.mats.wood, this.root, 10);
    for (const y of [.17, .76]) this.cylinder(x, y, z, .363, .363, .07, this.mats.iron, this.root, 10);
  }

  private banner(x: number, y: number, z: number, width: number, height: number, source: THREE.MeshLambertMaterial, parent: THREE.Object3D = this.root) {
    const material = source.clone(); material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 4, 5), material); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); this.pennants.push(mesh);
  }

  private bannerLine(x1: number, z1: number, x2: number, z2: number) {
    for (const [x, z] of [[x1, z1], [x2, z2]]) { this.box(x, 2.12, z, .1, 4.24, .1, this.mats.timber); this.block(x, z, .2, .2); }
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = 4.2 - Math.sin(t * Math.PI) * .65;
      points.push(new THREE.Vector3(x, y, z));
      if (i > 0 && i < 20 && i % 2 === 0) this.banner(x, y - .3, z, .63, .61, i % 6 ? this.mats.cloth : this.mats.red);
    }
    this.root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x5a503c })));
  }

  private perimeter() {
    // The exit markers stand inside the fence; streets continue visually beyond the playable area.
    this.railing(-15.75, -13.75, -15.75, 13.75);
    this.railing(15.75, -13.75, 15.75, 13.75);
    this.railing(-15.75, 13.75, 15.75, 13.75);
    this.railing(-15.75, -13.75, 15.75, -13.75);
    for (const x of [-15.4, 15.4]) for (const z of [-.2, 8.6]) {
      this.box(x, .2, z, .65, .4, 2.8, this.mats.paleStone);
      this.box(x, .47, z, .57, .28, 2.6, this.mats.grass);
      this.block(x, z, .7, 2.8);
    }
    for (const x of [-9, -5, 5, 9]) {
      this.box(x, .37, 13.6, 2.5, .74, .43, this.mats.darkStone);
      this.box(x, .78, 13.6, 2.75, .12, .57, this.mats.trim);
      this.block(x, 13.6, 2.75, .57);
    }
  }

  private railing(x1: number, z1: number, x2: number, z2: number) {
    const horizontal = z1 === z2, length = Math.hypot(x2 - x1, z2 - z1), sections = Math.ceil(length / 2.3);
    for (let i = 0; i <= sections; i++) {
      const t = i / sections, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      this.box(x, .52, z, .25, 1.04, .25, this.mats.paleStone);
      this.box(x, 1.07, z, .34, .12, .34, this.mats.trim);
    }
    for (const y of [.4, .86]) this.box((x1 + x2) / 2, y, (z1 + z2) / 2, horizontal ? length : .1, .09, horizontal ? .1 : length, this.mats.iron);
    this.block((x1 + x2) / 2, (z1 + z2) / 2, horizontal ? length + .25 : .25, horizontal ? .25 : length + .25);
  }

  override update(time: number, reduceMotion: boolean, cameraYaw: number) {
    super.update(time, reduceMotion, cameraYaw);
    for (const mesh of this.pennants) {
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), weight = Math.max(0, .5 - y / (mesh.geometry.parameters.height || 1));
        pos.setZ(i, reduceMotion ? 0 : Math.sin(time * 2.1 + x * 3 + mesh.position.x) * .095 * weight);
      }
      pos.needsUpdate = true;
    }
    for (const leaf of this.foliage) leaf.rotation.y = cameraYaw + leaf.userData.angle + (reduceMotion ? 0 : Math.sin(time * .8 + leaf.position.x) * .055);
    for (let i = 0; i < this.ripples.length; i++) this.ripples[i].scale.setScalar(reduceMotion ? 1 : 1 + Math.sin(time * .8 + i * .8) * .09);
  }
}
