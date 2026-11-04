import * as THREE from 'three';
import { WorldKit } from './SceneWorld';

/** An open-roof interior: the floor remains flat while furnishings shape the routes. */
export class TavernWorld extends WorldKit {
  private mats = {
    timber: this.material(0x463423, true), wood: this.material(0x946647, true), plank: this.material(0x785437, true),
    lightWood: this.material(0xb38958, true), plaster: this.material(0xc2aa80, true), brick: this.material(0x85523e, true),
    mortar: this.material(0x59453b), iron: this.material(0x282b27), stone: this.material(0x716553, true),
    cream: this.material(0xe2c990), paper: this.material(0xd7c297, true), red: this.material(0x794631, true),
    glass: this.material(0x597477, false, 0x263c3e), green: this.material(0x365744), amber: this.material(0x7d542b),
    dark: this.material(0x241d19), flame: this.material(0xffd782, false, 0xe8a540),
  };

  constructor() {
    super();
    this.root.name = 'tavern';
    this.box(0, -.22, 0, 23, .42, 19, this.mats.stone);
    // The staggered boards are actual shallow geometry, so they catch the candlelight.
    for (let row = 0; row < 42; row++) {
      const z = -8.5 + row * .415;
      for (let x = -10.6 - (row % 2) * 1.3; x < 10.7; x += 2.6) {
        const left = Math.max(-10.65, x), right = Math.min(10.65, x + 2.57);
        if (right <= left) continue;
        this.box((left + right) / 2, -.025, z, right - left, .045, .39, row % 5 === 0 ? this.mats.lightWood : row % 3 ? this.mats.wood : this.mats.plank);
      }
    }
    this.walls();
    this.bar();
    this.table(-2, -2, 4, 2);
    this.bench(-2.25, -3.35, 3.5);
    this.bench(-2.5, -.55, 2.5);
    this.table(2, -6, 4, 1.6);
    this.bench(2, -7.15, 3.2);
    this.table(5, 2, 3, 1.7);
    this.bench(5, 3.3, 2.6);
    this.bench(5, .65, 2.6);
    this.roundTable(-5.6, 5.1);
    this.fireplace();
    this.shelves();
    this.writingDesk();
    this.diningProps();
    this.chandelier(-1.1, 2.5);
    this.chandelier(4, -2.1);
    for (const [x, z] of [[-9.6, 5.1], [-9, 6.2], [-8.15, 6.6], [9.8, -1.8], [9.8, -.6]]) this.barrel(x, z);
    this.rug(0, 4.5, 2.7, 4.1);
    this.rug(4.8, -1.7, 3.6, 2);
    this.door(0, 8.65, 0);
    this.door(10.65, 6, Math.PI / 2);
    this.finish({ x: 0, z: 0, width: 22, depth: 18 });
  }

  private walls() {
    // Short independent sections disappear only when that section hides the player.
    for (let i = 0; i < 6; i++) this.wall(-8.9 + i * 3.56, -8.7, 3.56, 0, i % 2 === 1);
    for (let i = 0; i < 5; i++) this.wall(-10.7, -6.95 + i * 3.48, 3.48, Math.PI / 2, i % 2 === 0);
    for (let i = 0; i < 4; i++) this.wall(10.7, -6.9 + i * 3.6, 3.6, Math.PI / 2, i % 2 === 1);
    this.wall(10.7, 8.1, 1.2, Math.PI / 2, false);
    for (const x of [-8.3, -4.1, 4.1, 8.3]) this.wall(x, 8.7, 3.9, 0, true);
    // A visible perimeter beam suggests the missing roof without closing the room.
    for (const x of [-7, 0, 7]) {
      const beam = this.group(true);
      this.box(x, 4.12, -5.7, .24, .3, 6, this.mats.timber, beam);
      for (const z of [-8.5, -2.8]) {
        const brace = this.box(x, 3.61, z, .19, 1.2, .19, this.mats.timber, beam); brace.rotation.x = z < -5 ? -.5 : .5;
      }
    }
  }

  private wall(x: number, z: number, width: number, angle: number, hasWindow: boolean) {
    const g = this.group(true); g.position.set(x, 0, z); g.rotation.y = angle;
    this.box(0, 1.91, 0, width, 3.82, .32, this.mats.plaster, g);
    this.box(0, .51, -.01, width, 1.02, .4, this.mats.plank, g);
    for (const xx of [-width / 2 + .09, width / 2 - .09]) this.box(xx, 2, 0, .2, 4, .46, this.mats.timber, g);
    for (const y of [.12, 1.05, 3.73]) this.box(0, y, 0, width + .06, .14, .5, this.mats.timber, g);
    const brace = this.box(0, 2.4, .19, .13, width * .83, .11, this.mats.timber, g); brace.rotation.z = .75;
    if (hasWindow) for (const face of [-1, 1]) {
      this.box(0, 2.22, face * .2, 1.38, 1.72, .12, this.mats.timber, g);
      this.box(0, 2.22, face * .28, 1.15, 1.48, .045, this.mats.glass, g);
      for (const xx of [-.38, 0, .38]) this.box(xx, 2.22, face * .32, .04, 1.48, .04, this.mats.cream, g);
      for (const y of [1.84, 2.24, 2.62]) this.box(0, y, face * .32, 1.16, .04, .04, this.mats.cream, g);
      this.box(0, 1.35, face * .25, 1.65, .14, .42, this.mats.lightWood, g);
    }
    this.block(x, z, angle ? .48 : width, angle ? width : .48);
  }

  private door(x: number, z: number, angle: number) {
    const g = this.group(true); g.position.set(x, 0, z); g.rotation.y = angle;
    for (const side of [-1, 1]) this.box(side * 1.1, 1.7, 0, .25, 3.4, .5, this.mats.timber, g);
    this.box(0, 3.35, 0, 2.45, .3, .55, this.mats.timber, g);
    // Open leaves do not cross the walkable doorway.
    for (const side of [-1, 1]) {
      const leaf = this.box(side * 1.18, 1.45, -.5, .12, 2.85, 1.1, this.mats.plank, g);
      leaf.rotation.y = side * .13;
      this.box(side * 1.18, .45, -.5, .17, .1, 1, this.mats.iron, g);
      this.box(side * 1.18, 2.4, -.5, .17, .1, 1, this.mats.iron, g);
    }
    this.box(0, -.025, 0, 2.2, .04, 1.2, this.mats.stone, g);
  }

  private bar() {
    const x = -8, z = -2;
    this.block(x, z, 2, 8.5);
    this.box(x, .72, z, 1.7, 1.44, 8.3, this.mats.plank);
    this.box(x, 1.48, z, 2, .17, 8.5, this.mats.lightWood);
    this.box(-6.98, .22, z, .08, .08, 8.2, this.mats.iron);
    for (let zz = -5.7; zz < 2; zz += 1.45) {
      this.box(-7.1, .74, zz, .06, 1.03, 1.13, this.mats.wood);
      this.box(-7.055, .74, zz, .035, .79, .88, this.mats.timber);
    }
    for (const zz of [-5, -2.5, .3]) { this.bottle(-8.35, 1.59, zz, zz < -4 ? this.mats.green : this.mats.amber); this.mug(-7.55, 1.59, zz + .3); }
    this.candle(-8.2, 1.59, 1.3, true);
    for (const zz of [-5, -2.5, .1]) this.stool(-6.1, zz);
  }

  private table(x: number, z: number, width: number, depth: number) {
    this.block(x, z, width, depth);
    this.box(x, 1.08, z, width, .18, depth, this.mats.lightWood);
    for (const side of [-1, 1]) for (const front of [-1, 1]) this.box(x + side * (width / 2 - .26), .51, z + front * (depth / 2 - .23), .17, 1.02, .17, this.mats.timber);
    this.box(x, .35, z, width - .3, .16, .12, this.mats.plank);
    for (let zz = z - depth / 2 + .32; zz < z + depth / 2; zz += .35) this.box(x, 1.178, zz, width - .04, .012, .014, this.mats.plank);
  }

  private bench(x: number, z: number, width: number) {
    this.block(x, z, width, .43);
    this.box(x, .57, z, width, .15, .43, this.mats.wood);
    for (const side of [-1, 1]) this.box(x + side * (width / 2 - .3), .27, z, .15, .54, .34, this.mats.timber);
  }

  private stool(x: number, z: number) {
    this.block(x, z, .54, .54);
    this.cylinder(x, .7, z, .3, .3, .12, this.mats.lightWood);
    for (const side of [-1, 1]) for (const front of [-1, 1]) this.box(x + side * .17, .33, z + front * .17, .075, .66, .075, this.mats.timber);
  }

  private roundTable(x: number, z: number) {
    this.block(x, z, 1.7, 1.7);
    this.cylinder(x, 1.05, z, .85, .85, .14, this.mats.lightWood, this.root, 12);
    this.cylinder(x, .5, z, .12, .23, 1, this.mats.timber);
    this.box(x, .14, z, 1.25, .15, .18, this.mats.timber);
    this.box(x, .14, z, .18, .15, 1.25, this.mats.timber);
    this.stool(x - 1.35, z); this.stool(x, z + 1.35); this.mug(x + .3, 1.13, z); this.candle(x - .3, 1.13, z - .25);
  }

  private fireplace() {
    const g = this.group(true);
    this.block(8.35, -5.4, 3.3, 3.1);
    this.box(8.35, .09, -5.4, 3.3, .18, 3.1, this.mats.stone, g);
    this.box(8.35, 1.7, -6.65, 3, 3.4, .45, this.mats.mortar, g);
    for (let row = 0; row < 12; row++) for (let i = 0; i < 5; i++) this.box(7.12 + i * .57 + (row % 2) * .1, .35 + row * .24, -6.39, .53, .2, .08, this.mats.brick, g);
    for (const x of [7.1, 9.6]) this.box(x, 1.08, -5.62, .5, 2.16, 2.2, this.mats.brick, g);
    this.box(8.35, 2.1, -5.7, 3.15, .32, 2.4, this.mats.stone, g);
    this.box(8.35, 3.05, -6.1, 2.5, 1.7, 1.5, this.mats.brick, g);
    for (let i = 0; i < 4; i++) { const log = this.cylinder(7.8 + i * .34, .34, -5.4, .15, .15, 1.25, this.mats.dark, g); log.rotation.x = Math.PI / 2; }
    this.fire(8.25, -5.23, .7, 30, g);
    this.fire(8.85, -5.5, .62, 13, g);
    const pot = this.cylinder(8.35, 1.13, -5.6, .37, .25, .44, this.mats.iron, g);
    pot.rotation.z = .05;
    this.box(8.35, 1.66, -5.6, 2.2, .055, .055, this.mats.iron, g);
    this.box(8.35, 1.49, -5.6, .04, .35, .04, this.mats.iron, g);
  }

  private shelves() {
    const g = this.group(true);
    this.block(-10.1, -2.3, .9, 10.6);
    for (const z of [-7.4, 2.7]) this.box(-10.1, 1.8, z, .6, 3.6, .16, this.mats.timber, g);
    for (const y of [.5, 1.6, 2.75]) {
      this.box(-10.1, y, -2.3, .85, .15, 10.6, this.mats.lightWood, g);
      for (let z = -7; z < 2.5; z += .7) this.bottle(-10, y + .08, z, Math.floor(z * 10) % 3 ? this.mats.green : this.mats.amber, g);
    }
  }

  private writingDesk() {
    for (let i = 0; i < 4; i++) {
      const paper = this.box(1 + i * .42, 1.19 + i * .004, -5.9 + (i % 2) * .18, .7, .015, .48, this.mats.paper);
      paper.rotation.y = -.18 + i * .1;
      // Graphical ink marks stay language neutral; prose is rendered by the UI.
      for (let j = 0; j < 4; j++) this.box(1 + i * .42, 1.21 + i * .004, -6.02 + j * .075 + (i % 2) * .18, .35 - (j % 2) * .07, .009, .013, this.mats.wood);
    }
    this.cylinder(3.28, 1.28, -6.1, .11, .15, .18, this.mats.iron);
    const feather = this.box(3.25, 1.6, -6.1, .035, .6, .07, this.mats.cream); feather.rotation.z = -.34;
    this.candle(3.35, 1.18, -6.45, true);
    this.box(.4, 1.23, -6.2, .6, .1, .43, this.mats.red);
    this.box(.4, 1.26, -6.2, .55, .07, .39, this.mats.paper);
  }

  private diningProps() {
    for (const [x, z] of [[-3.3, -2.5], [-2.1, -1.5], [-.6, -2.4], [4.1, 2.4], [5.6, 1.5]]) this.mug(x, 1.18, z);
    this.candle(-1.6, 1.18, -2.1, true); this.candle(5.6, 1.18, 2.3);
    for (const [x, z] of [[-3.1, -1.8], [-.6, -1.65], [4.7, 1.9]]) {
      this.cylinder(x, 1.2, z, .3, .26, .04, this.mats.cream, this.root, 10);
      this.box(x + .03, 1.28, z, .33, .15, .22, this.mats.amber);
    }
    this.bottle(-2.65, 1.18, -2, this.mats.green);
  }

  private bottle(x: number, y: number, z: number, material: THREE.Material, parent: THREE.Object3D = this.root) {
    this.cylinder(x, y + .18, z, .1, .11, .35, material, parent, 6);
    this.cylinder(x, y + .42, z, .044, .068, .16, material, parent, 6);
    this.cylinder(x, y + .51, z, .047, .047, .035, this.mats.wood, parent, 6);
  }

  private mug(x: number, y: number, z: number) {
    this.cylinder(x, y + .13, z, .13, .115, .25, this.mats.cream);
    this.cylinder(x, y + .263, z, .104, .104, .012, this.mats.amber);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.09, .028, 4, 8), this.mats.cream); handle.position.set(x + .13, y + .14, z); this.root.add(handle);
  }

  private candle(x: number, y: number, z: number, lit = false, parent: THREE.Object3D = this.root) {
    this.cylinder(x, y + .04, z, .15, .18, .08, this.mats.iron, parent);
    this.cylinder(x, y + .23, z, .055, .067, .34, this.mats.cream, parent, 6);
    if (lit) this.fire(x, z, y + .49, 4, parent);
    else this.cylinder(x, y + .45, z, .008, .065, .14, this.mats.flame, parent, 5);
  }

  private chandelier(x: number, z: number) {
    const g = this.group(true);
    this.box(x, 3.8, z, .04, 1, .04, this.mats.iron, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.72, .038, 4, 12), this.mats.iron); ring.rotation.x = Math.PI / 2; ring.position.set(x, 3.24, z); g.add(ring);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; this.candle(x + Math.cos(a) * .72, 3.24, z + Math.sin(a) * .72, false, g); }
  }

  private barrel(x: number, z: number) {
    this.block(x, z, .79, .79);
    this.cylinder(x, .51, z, .36, .35, 1.02, this.mats.wood, this.root, 10);
    for (const y of [.17, .82]) this.cylinder(x, y, z, .385, .385, .075, this.mats.iron, this.root, 10);
    this.box(x, 1.03, z, .65, .045, .08, this.mats.lightWood);
  }

  private rug(x: number, z: number, width: number, depth: number) {
    this.box(x, .006, z, width, .014, depth, this.mats.red);
    for (const side of [-1, 1]) {
      this.box(x + side * (width / 2 - .14), .017, z, .065, .006, depth - .15, this.mats.cream);
      this.box(x, .017, z + side * (depth / 2 - .14), width - .15, .006, .065, this.mats.cream);
    }
    for (let zz = z - depth / 2 + .5; zz < z + depth / 2 - .2; zz += .6) { const motif = this.box(x, .019, zz, .25, .008, .25, this.mats.lightWood); motif.rotation.y = Math.PI / 4; }
  }
}
