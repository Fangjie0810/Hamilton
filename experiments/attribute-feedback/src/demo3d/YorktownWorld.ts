import * as THREE from 'three';
import { WorldKit } from './SceneWorld';

/** Moonlit siege works, with two ground-level gates through the raised redoubt. */
export class YorktownWorld extends WorldKit {
  private readonly mats = {
    earth: this.material(0x695e4a, true), bank: this.material(0x837454, true), path: this.material(0x9a8c6c, true),
    wood: this.material(0x756348, true), lightWood: this.material(0xa28b5e, true), iron: this.material(0x3e4442),
    bronze: this.material(0x78734d, true), sandbag: this.material(0xa39974, true), stone: this.material(0x7b7d70, true),
    grass: this.material(0x596447, true), dark: this.material(0x343d35), canvas: this.material(0xbab394, true),
    red: this.material(0x995744, true), paper: this.material(0xcec4a1), water: this.material(0x354f54, true),
  };
  private readonly smoke: { mesh: THREE.Mesh; x: number; y: number; z: number; phase: number }[] = [];
  private readonly waterLines: THREE.Mesh[] = [];

  constructor() {
    super();
    this.ground(-89.25, 0, 221.5, 400, this.mats.grass, -.14);
    this.ground(0, 0, 40, 34, this.mats.earth, -.065);
    this.ground(0, 1, 5, 32, this.mats.path, -.027);
    this.ground(9, -5, 3.2, 17, this.mats.path, -.027);
    this.ground(0, 5, 35, 3, this.mats.path, -.025);
    this.ground(0, -11, 35, 4.2, this.mats.path, -.025);
    this.earthwork(-10.9, -6.6, 14.2, 2.7, 1.6);
    this.earthwork(5.15, -6.6, 3.1, 2.7, 1.6);
    this.earthwork(14.65, -6.6, 6.7, 2.7, 1.6);
    this.earthwork(-11, -13.8, 13.8, 2.3, 1.7);
    this.earthwork(11, -13.8, 13.8, 2.3, 1.7);
    this.sideEarthwork(-18, -10.2, 1.7, 9); this.sideEarthwork(18, -10.2, 1.7, 9);
    this.cannon(-10.2, .1, -.12, true); this.block(-10.2, .1, 3.2, 4.2);
    this.cannon(12.6, -.2, .15, true); this.block(12.6, -.2, 3.2, 4.2);
    this.cannon(-11, -10.4, -.08, false); this.block(-11, -10.4, 3.1, 4);
    this.ammunition(-13.5, 1.4); this.ammunition(15.3, 1.3);
    this.chevaux(-7.3, 8.3, 7.1); this.chevaux(5.5, 8.3, 3.7); this.chevaux(14.5, 8.3, 5.6);
    this.trench(-8.8, 4.1, 12.5); this.trench(14.4, 4.1, 5.8);
    this.stockade(-16, 11); this.stockade(16.7, 10.5);
    this.commandStation(4.9, 12.4);
    this.supply(-14.6, 12.9);
    for (const [x, z] of [[-3.05, -5.5], [3.05, -5.5], [7.25, -5.5], [10.75, -5.5], [-2.6, 11.5], [2.6, 11.5]]) this.torch(x, z);
    this.fire(-16.2, -11.2, .8, 13); this.addSmoke(-16.2, -11.2, 1.3, 6);
    this.fire(16.2, -11.3, .8, 12); this.addSmoke(16.2, -11.3, 1.3, 5);
    this.block(-16.2, -11.2, 1.5, 1.5); this.block(16.2, -11.3, 1.5, 1.5);
    this.shore(); this.scatter();
    this.fence(-19.75, -16.75, -19.75, 16.75, this.mats.wood);
    this.fence(19.75, -16.75, 19.75, 16.75, this.mats.wood);
    this.fence(-19.75, -16.75, 19.75, -16.75, this.mats.wood);
    this.fence(-19.75, 16.75, 19.75, 16.75, this.mats.wood);
    this.finish({ x: 0, z: 0, width: 40, depth: 34 });
  }

  private ground(x: number, z: number, width: number, depth: number, source: THREE.MeshLambertMaterial, y: number) {
    const material = source.clone();
    if (source.map) { material.map = source.map.clone(); material.map.repeat.set(width / 2, depth / 2); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true; this.root.add(mesh);
  }

  private earthwork(x: number, z: number, width: number, depth: number, height: number) {
    this.block(x, z, width, depth);
    // The sloped bank and timber retaining wall give the flat navigation route genuine depth.
    const group = this.group(true);
    this.box(x, height * .28, z, width, height * .56, depth, this.mats.bank, group);
    this.box(x, height * .63, z - .2, width - .2, height * .25, depth * .76, this.mats.earth, group);
    for (let xx = x - width / 2 + .18; xx < x + width / 2; xx += .36) {
      this.box(xx, height * .4, z + depth / 2 - .05, .28, height * .8, .15, this.mats.wood, group);
      this.box(xx, .12, z + depth / 2 - .07, .3, .2, .19, this.mats.dark, group);
    }
    for (const y of [.36, .94]) this.box(x, y, z + depth / 2 + .015, width, .12, .16, this.mats.lightWood, group);
    for (let xx = x - width / 2 + .45; xx < x + width / 2 - .2; xx += .82) {
      this.box(xx, height * .88, z + .25, .78, .36, .53, this.mats.sandbag, group).rotation.y = (this.random() - .5) * .13;
      this.box(xx + .13, height * 1.08, z + .1, .76, .28, .51, this.mats.sandbag, group).rotation.y = (this.random() - .5) * .13;
      if (Math.floor(xx * 2) % 3 === 0) this.box(xx, height * .84, z - .7, .6, .22, .47, this.mats.bank, group);
    }
  }

  private sideEarthwork(x: number, z: number, width: number, depth: number) {
    this.block(x, z, width, depth);
    const group = this.group(true);
    this.box(x, .63, z, width, 1.25, depth, this.mats.bank, group);
    for (let zz = z - depth / 2 + .25; zz < z + depth / 2; zz += .45) {
      this.box(x - Math.sign(x) * width / 2, .7, zz, .17, 1.4, .32, this.mats.wood, group);
      this.box(x, 1.4, zz, .9, .31, .42, this.mats.sandbag, group);
    }
  }

  private cannon(x: number, z: number, angle: number, smoke: boolean) {
    const group = this.group(); group.position.set(x, 0, z); group.rotation.y = angle;
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(.69, .075, 4, 12), this.mats.iron);
      wheel.position.set(side * 1.03, .75, .16); wheel.rotation.y = Math.PI / 2; wheel.castShadow = true; group.add(wheel);
      for (let i = 0; i < 6; i++) {
        const spoke = this.box(side * 1.03, .75, .16, .065, 1.27, .065, this.mats.lightWood, group); spoke.rotation.x = i * Math.PI / 6;
      }
      const cheek = this.box(side * .5, .76, .24, .23, .85, 1.3, this.mats.wood, group); cheek.rotation.x = -.2;
      this.box(side * .38, .4, 1.15, .22, .26, 1.8, this.mats.lightWood, group).rotation.y = -side * .18;
    }
    const axle = this.cylinder(0, .75, .16, .095, .095, 2.4, this.mats.iron, group); axle.rotation.z = Math.PI / 2;
    const barrel = this.cylinder(0, 1.23, -.45, .23, .33, 2.45, this.mats.bronze, group, 10); barrel.rotation.x = Math.PI / 2 - .085;
    for (const zz of [-1.45, -.9, .35]) {
      const ring = this.cylinder(0, 1.23 + (-zz - .45) * .085, zz, zz === -1.45 ? .263 : .34, zz === -1.45 ? .263 : .34, .11, this.mats.iron, group, 10); ring.rotation.x = Math.PI / 2 - .085;
    }
    const mouth = this.cylinder(0, 1.33, -1.69, .176, .176, .03, this.mats.dark, group, 10); mouth.rotation.x = Math.PI / 2;
    this.cylinder(0, 1.19, .85, .13, .15, .27, this.mats.bronze, group).rotation.x = Math.PI / 2;
    if (smoke) this.addSmoke(x + Math.sin(angle) * -1.7, z + Math.cos(angle) * -1.7, 1.65, 4);
  }

  private ammunition(x: number, z: number) {
    this.box(x, .28, z, 1.65, .55, 1.1, this.mats.wood);
    for (const side of [-1, 1]) this.box(x + side * .65, .57, z, .12, .07, 1.14, this.mats.iron);
    const shotGeometry = new THREE.IcosahedronGeometry(.16, 1);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3 - row; col++) {
      const shot = new THREE.Mesh(shotGeometry, this.mats.iron); shot.position.set(x - .32 + col * .32 + row * .16, .74 + row * .19, z + .2 - row * .13); shot.castShadow = true; this.root.add(shot);
    }
    this.block(x, z, 1.7, 1.2);
  }

  private chevaux(x: number, z: number, width: number) {
    const group = this.group();
    this.box(x, .6, z, width, .25, .3, this.mats.wood, group);
    for (let xx = x - width / 2 + .35; xx < x + width / 2; xx += .63) {
      for (const side of [-1, 1]) {
        const stake = this.box(xx, .68, z, .095, 1.9, .095, this.mats.lightWood, group); stake.rotation.x = side * .72;
        const point = this.cylinder(xx, 1.42, z + side * .62, 0, .09, .24, this.mats.lightWood, group, 4); point.rotation.x = side * .72;
      }
    }
    this.block(x, z, width + .15, 1.65);
  }

  private trench(x: number, z: number, width: number) {
    // The trench bed stays level with the actor; raised edges produce the excavated profile.
    this.ground(x, z, width, 1.6, this.mats.dark, -.019);
    for (let xx = x - width / 2; xx < x + width / 2; xx += .48) this.box(xx, -.005, z, .23, .025, 1.3, this.mats.wood);
    for (const side of [-1, 1]) {
      this.box(x, .22, z + side * 1.03, width, .44, .46, this.mats.bank);
      this.block(x, z + side * 1.03, width, .46);
    }
  }

  private stockade(x: number, z: number) {
    const group = this.group(true);
    for (let i = 0; i < 7; i++) {
      const height = i === 2 || i === 4 ? .65 : 1.8 + this.random() * .6;
      const xx = x - 1.65 + i * .55;
      this.box(xx, height / 2, z, .28, height, .24, this.mats.wood, group);
      const tip = this.cylinder(xx, height + .12, z, 0, .2, .3, this.mats.lightWood, group, 4); tip.rotation.y = Math.PI / 4;
    }
    this.box(x, .45, z + .15, 3.9, .17, .13, this.mats.wood, group);
    const broken = this.box(x + .4, .25, z + .3, 1.8, .19, .19, this.mats.lightWood, group); broken.rotation.y = .8; broken.rotation.z = -.25;
    this.block(x, z + .15, 4.1, .9);
  }

  private commandStation(x: number, z: number) {
    this.box(x, .75, z, 2.4, .14, 1.2, this.mats.wood);
    for (const side of [-1, 1]) this.box(x + side * .95, .38, z, .15, .75, .95, this.mats.lightWood);
    this.box(x - .2, .837, z, 1.3, .025, .88, this.mats.paper);
    for (let i = 0; i < 5; i++) this.box(x - .6 + i * .19, .86, z + Math.sin(i * 1.6) * .18, .08, .04, .08, i % 2 ? this.mats.red : this.mats.dark);
    this.cylinder(x + .85, .94, z - .3, .08, .09, .2, this.mats.canvas);
    this.block(x, z, 2.5, 1.3);
    this.cylinder(x + 1.9, 2.1, z, .035, .07, 4.2, this.mats.lightWood);
    this.box(x + 2.5, 3.6, z, 1.15, .7, .04, this.mats.red);
    this.block(x + 1.9, z, .24, .24);
  }

  private supply(x: number, z: number) {
    for (let i = 0; i < 3; i++) {
      this.box(x + i * .9, .42, z, .8, .82, .85, this.mats.lightWood);
      for (const side of [-1, 1]) this.box(x + i * .9, .42 + side * .29, z + .44, .8, .09, .035, this.mats.wood);
    }
    this.box(x + .45, 1.08, z, 1.1, .45, .7, this.mats.canvas);
    this.cylinder(x - .9, .58, z - .1, .4, .42, 1.15, this.mats.wood);
    for (const y of [.2, .88]) this.cylinder(x - .9, y, z - .1, .435, .435, .08, this.mats.iron);
    this.block(x + .45, z, 3.6, 1.15);
  }

  private torch(x: number, z: number) {
    this.box(x, .75, z, .11, 1.5, .11, this.mats.wood);
    this.cylinder(x, 1.45, z, .17, .12, .23, this.mats.iron);
    this.fire(x, z, 1.78, 7);
    this.block(x, z, .34, .34);
  }

  private addSmoke(x: number, z: number, base: number, count: number) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.3 + i * .14, 0), new THREE.MeshLambertMaterial({ color: 0xa6b3ad, transparent: true, opacity: .1 - i * .008, depthWrite: false, flatShading: true }));
      const xx = x + i * .18, y = base + i * .48, zz = z - i * .07; mesh.position.set(xx, y, zz); this.root.add(mesh);
      this.smoke.push({ mesh, x: xx, y, z: zz, phase: i + this.random() * 2 });
    }
  }

  private shore() {
    this.ground(111.5, 0, 180, 400, this.mats.water, -.22);
    this.ground(22.1, 0, 2.9, 400, this.mats.bank, -.1);
    const shimmer = this.material(0x698087, false, 0x152226);
    for (let i = 0; i < 32; i++) {
      const mesh = this.box(26 + this.random() * 17, -.19, -32 + this.random() * 64, .4 + this.random() * 2.3, .012, .045, shimmer);
      mesh.userData.baseX = mesh.position.x; this.waterLines.push(mesh);
    }
    for (const [x, z, size] of [[31, -18, 1], [38, 4, .68]]) {
      const group = this.group(); group.position.set(x, -.07, z); group.scale.setScalar(size); group.rotation.y = -.3;
      this.box(0, .5, 0, 2.2, 1, 7.5, this.mats.dark, group);
      this.box(0, 1.02, 0, 2.1, .12, 7.3, this.mats.wood, group);
      for (const zz of [-1.65, 1.6]) {
        this.cylinder(0, 4.8, zz, .05, .1, 8, this.mats.wood, group);
        for (const y of [3.1, 5.1, 6.8]) {
          this.box(0, y + .55, zz, 4.3 - y * .27, .07, .08, this.mats.wood, group);
          const sail = this.box(0, y, zz, 4.1 - y * .27, 1.04, .055, this.mats.canvas, group); sail.rotation.y = -.2;
        }
      }
    }
    // A low distant silhouette frames the fort without closing its accessible gates.
    for (let i = 0; i < 17; i++) {
      const x = -31 + i * 3.3, h = 2 + this.random() * 2.2;
      this.box(x, h / 2, -26 - this.random() * 7, 2.5 + this.random() * 1.8, h, 3, this.mats.dark);
    }
  }

  private scatter() {
    for (let i = 0; i < 180; i++) {
      const x = (this.random() - .5) * 39, z = (this.random() - .5) * 33;
      if (Math.abs(x) < 2.65 || Math.abs(x - 9) < 1.7 || this.obstacles.some(o => Math.abs(x - o.x) < o.width / 2 + .35 && Math.abs(z - o.z) < o.depth / 2 + .35)) continue;
      const s = .07 + this.random() * .16;
      this.box(x, s * .35, z, s * 1.5, s * .7, s, i % 4 ? this.mats.stone : this.mats.lightWood).rotation.y = this.random() * 3;
    }
    for (const [x, z] of [[-4.5, .3], [5.7, -1.7], [-15.5, -3.7], [16.6, 6.4]]) {
      this.cylinder(x, -.025, z, .8, .8, .03, this.mats.dark, this.root, 9);
      for (let i = 0; i < 8; i++) this.box(x + Math.cos(i * Math.PI / 4) * .9, .09, z + Math.sin(i * Math.PI / 4) * .9, .3, .18, .25, this.mats.bank).rotation.y = i;
    }
  }

  override update(time: number, reduceMotion: boolean, cameraYaw: number) {
    super.update(time, reduceMotion, cameraYaw);
    for (const puff of this.smoke) puff.mesh.position.set(puff.x + (reduceMotion ? 0 : Math.sin(time * .6 + puff.phase) * .19), puff.y + (reduceMotion ? 0 : Math.sin(time * .4 + puff.phase) * .14), puff.z);
    for (const line of this.waterLines) line.position.x = line.userData.baseX + (reduceMotion ? 0 : Math.sin(time * .45 + line.position.z) * .16);
  }
}
