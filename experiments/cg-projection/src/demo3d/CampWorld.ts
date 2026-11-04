import * as THREE from 'three';
import { WorldKit } from './SceneWorld';

/** A dusk army camp: the broad central lane connects the command post and the field road. */
export class CampWorld extends WorldKit {
  private readonly mats = {
    earth: this.material(0x77674b, true), grass: this.material(0x657349, true), track: this.material(0x948064, true),
    canvas: this.material(0xd7c99b, true), canvasShade: this.material(0xaca582, true), blue: this.material(0x405668, true),
    wood: this.material(0x705238, true), lightWood: this.material(0xa27e4b, true), iron: this.material(0x3c403c),
    stone: this.material(0x77776a, true), paper: this.material(0xd8c89a, true), dark: this.material(0x343c31),
    leaf: this.material(0x3d523b, true), leafLight: this.material(0x566747, true), red: this.material(0x9d6043),
  };
  private readonly smoke: { mesh: THREE.Mesh; x: number; y: number; z: number; phase: number }[] = [];
  private readonly flagCloths: THREE.Mesh[] = [];

  constructor() {
    super();
    this.ground(0, 0, 400, 400, this.mats.grass, -.11);
    this.ground(0, 0, 37.8, 31.8, this.mats.earth, -.065);
    this.ground(0, 0, 5.1, 240, this.mats.track, -.025);
    this.ground(-5.5, -2.8, 15, 3.6, this.mats.track, -.02);
    this.ground(4.5, 9.7, 20, 3.7, this.mats.track, -.02);
    this.ground(-10, 1, 3, 9, this.mats.track, -.02);
    this.tent(-7, -8, 8, 6, 4, true);
    this.mapTable(-7, -4.4);
    this.tent(6.3, -9, 5.3, 5, 2.9);
    this.tent(13.5, -8.5, 4.5, 4.4, 2.6);
    this.tent(12.8, -.5, 5.2, 5, 2.9);
    this.tent(-14.9, -6.9, 3.4, 4.3, 2.6);
    this.tent(-7.5, 11.5, 4.2, 4.8, 2.7);
    this.supplyCart(-11, 5);
    this.crate(-13.7, 4.4, 0, 1.05); this.crate(-13.7, 5.6, 0, .9); this.crate(-13.7, 5.6, .9, .72);
    this.barrel(-8.5, 4.7); this.barrel(-8.4, 5.9);
    this.block(-11, 5, 6, 3);
    this.campfire(4, 3);
    this.logSeat(1.6, 3, Math.PI / 2); this.logSeat(6.4, 3, Math.PI / 2); this.logSeat(4, .8, 0);
    this.weaponRack(8, 6.5);
    this.flag(-2.2, -7.5, 6.1);
    this.lantern(-3.5, -4); this.lantern(2.8, 10.4); this.lantern(-13.8, 1.8);
    this.boundaries();
    this.scatter();
    this.finish({ x: 0, z: 0, width: 38, depth: 32 });
  }

  private ground(x: number, z: number, width: number, depth: number, source: THREE.MeshLambertMaterial, y: number) {
    const material = source.clone();
    if (source.map) { material.map = source.map.clone(); material.map.repeat.set(width / 2, depth / 2); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true; this.root.add(mesh);
  }

  private tent(x: number, z: number, width: number, depth: number, height: number, command = false) {
    this.block(x, z, width + .18, depth + .18);
    const roof = this.group(true); roof.position.set(x, 0, z);
    const eaves = command ? 1.5 : .5, run = width / 2, rise = height - eaves, length = Math.hypot(run, rise);
    const canopy = this.mats.canvas.clone(); canopy.side = THREE.DoubleSide;
    for (const side of [-1, 1]) {
      const panel = this.box(side * run / 2, eaves + rise / 2, 0, length + .16, .07, depth + .25, canopy, roof);
      panel.rotation.z = -side * Math.atan2(rise, run);
      if (eaves > .6) this.box(side * run, eaves / 2, 0, .07, eaves, depth, this.mats.canvasShade, roof);
      for (let zz = -depth / 2; zz <= depth / 2 + .01; zz += depth / 4) {
        const seam = this.box(side * run / 2, eaves + rise / 2 + .055, zz, length, .025, .035, this.mats.canvasShade, roof);
        seam.rotation.z = -side * Math.atan2(rise, run);
      }
    }
    const rear = new THREE.Shape(); rear.moveTo(-run, 0); rear.lineTo(run, 0); rear.lineTo(run, eaves); rear.lineTo(0, height); rear.lineTo(-run, eaves); rear.closePath();
    const rearMesh = new THREE.Mesh(new THREE.ShapeGeometry(rear), canopy); rearMesh.position.z = -depth / 2; rearMesh.castShadow = true; roof.add(rearMesh);
    // The dark open fly and two folded entrance flaps read as canvas, not a solid house wall.
    const entrance = new THREE.Mesh(new THREE.ShapeGeometry(rear), this.mats.dark);
    entrance.position.z = depth / 2 - .22; roof.add(entrance);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(side * run, 0); shape.lineTo(side * run, eaves); shape.lineTo(0, height); shape.lineTo(side * width * .2, .1); shape.closePath();
      const flap = new THREE.Mesh(new THREE.ShapeGeometry(shape), canopy); flap.position.z = depth / 2 + .05; flap.castShadow = true; roof.add(flap);
      this.box(side * run, eaves / 2, depth / 2, .095, eaves + .2, .095, this.mats.lightWood, roof);
      // Ropes remain inside the collision footprint instead of crossing the walkable lane.
      for (const zz of [-depth / 2 + .3, depth / 2 - .3]) {
        const rope = this.box(side * (run - .15), eaves * .48, zz, .035, eaves * 1.08, .035, this.mats.paper, roof); rope.rotation.z = side * .25;
      }
    }
    this.box(0, height + .035, 0, .11, .11, depth + .6, this.mats.lightWood, roof);
    this.box(0, height / 2, -depth / 2, .11, height, .11, this.mats.lightWood, roof);
    if (command) {
      const awning = this.box(0, 2.3, depth / 2 + .38, 3.2, .08, .7, this.mats.blue, roof); awning.rotation.x = -.12;
      this.box(0, 1.98, depth / 2 + .71, 3.2, .48, .06, this.mats.blue, roof);
      for (const side of [-1, 1]) this.box(side * 1.65, 1.2, depth / 2 + .68, .09, 2.4, .09, this.mats.lightWood, roof);
      this.block(x, z + depth / 2 + .38, 3.6, .8);
    }
  }

  private mapTable(x: number, z: number) {
    this.box(x, .9, z, 3, .15, .9, this.mats.lightWood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(x + sx * 1.28, .42, z + sz * .3, .12, .84, .12, this.mats.wood);
    this.box(x - .1, .993, z, 1.9, .025, .65, this.mats.paper);
    for (let i = 0; i < 5; i++) {
      const mark = this.box(x - .74 + i * .3, 1.015, z + Math.sin(i) * .13, .27, .012, .025, this.mats.blue); mark.rotation.y = -.35 + i * .15;
    }
    this.box(x + .53, 1.04, z - .11, .065, .07, .065, this.mats.red);
    this.cylinder(x - .7, 1.05, z + .2, .055, .055, .13, this.mats.iron);
    this.cylinder(x + 1.07, 1.06, z, .07, .09, .17, this.mats.paper);
    this.block(x, z, 3.05, .95);
  }

  private supplyCart(x: number, z: number) {
    const group = this.group(); group.position.set(x, 0, z);
    this.box(0, .85, 0, 3.5, .2, 1.65, this.mats.wood, group);
    for (let i = 0; i < 7; i++) this.box(-1.45 + i * .48, .97, 0, .42, .08, 1.6, this.mats.lightWood, group);
    for (const sz of [-1, 1]) {
      for (const y of [1.13, 1.48, 1.8]) this.box(0, y, sz * .87, 3.6, .19, .08, this.mats.wood, group);
      for (const xx of [-1.6, 0, 1.6]) this.box(xx, 1.35, sz * .85, .11, 1.2, .12, this.mats.lightWood, group);
      for (const xx of [-1.12, 1.12]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(.57, .065, 4, 10), this.mats.iron); rim.position.set(xx, .59, sz * 1.03); group.add(rim); rim.castShadow = true;
        for (let a = 0; a < 4; a++) { const spoke = this.box(xx, .59, sz * 1.03, 1.05, .045, .05, this.mats.lightWood, group); spoke.rotation.z = a * Math.PI / 4; }
        const axle = this.cylinder(xx, .59, 0, .07, .07, 2.3, this.mats.iron, group); axle.rotation.x = Math.PI / 2;
      }
    }
    this.box(-.65, 1.25, -.15, 1.25, .55, 1.1, this.mats.canvasShade, group);
    this.box(.7, 1.32, .1, 1.1, .7, 1.2, this.mats.canvas, group);
    for (const xx of [-.95, -.4, .43, .95]) this.box(xx, 1.7, .12, .05, .045, 1.18, this.mats.wood, group);
  }

  private barrel(x: number, z: number) {
    this.cylinder(x, .52, z, .39, .43, 1.02, this.mats.lightWood);
    for (const y of [.16, .48, .87]) this.cylinder(x, y, z, .442, .442, .07, this.mats.iron);
    this.cylinder(x, 1.04, z, .38, .38, .03, this.mats.wood);
  }

  private crate(x: number, z: number, y: number, size: number) {
    this.box(x, y + size / 2, z, size, size, size, this.mats.lightWood);
    for (const side of [-1, 1]) for (const h of [.12, .87]) this.box(x, y + size * h, z + side * (size / 2 + .015), size, size * .09, .05, this.mats.wood);
    const brace = this.box(x, y + size / 2, z + size / 2 + .045, size * 1.1, .08, .045, this.mats.wood); brace.rotation.z = Math.PI / 4;
  }

  private campfire(x: number, z: number) {
    this.block(x, z, 2, 2);
    this.cylinder(x, .015, z, 1, 1.05, .05, this.mats.dark, this.root, 10);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      this.box(x + Math.cos(a) * .84, .14, z + Math.sin(a) * .84, .3, .25, .28, this.mats.stone).rotation.y = a;
    }
    for (let i = 0; i < 3; i++) { const log = this.box(x, .22, z, 1.15, .18, .19, this.mats.wood); log.rotation.y = i * 1.04; }
    this.fire(x, z, .53, 19);
    const pot = this.cylinder(x + .38, .65, z - .15, .23, .17, .35, this.mats.iron);
    pot.rotation.z = .08;
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.33 + i * .1, 0), new THREE.MeshLambertMaterial({ color: 0xc1bca4, transparent: true, opacity: .12 - i * .012, depthWrite: false, flatShading: true }));
      const px = x + i * .2, py = 1.3 + i * .65; mesh.position.set(px, py, z); this.root.add(mesh); this.smoke.push({ mesh, x: px, y: py, z, phase: i });
    }
  }

  private logSeat(x: number, z: number, angle: number) {
    const mesh = this.cylinder(x, .28, z, .26, .28, 1.85, this.mats.wood);
    mesh.rotation.z = Math.PI / 2; mesh.rotation.y = angle;
    this.block(x, z, angle ? .65 : 2, angle ? 2 : .65);
  }

  private weaponRack(x: number, z: number) {
    const group = this.group(); group.position.set(x, 0, z);
    for (const side of [-1, 1]) {
      this.box(side * 1.3, .8, 0, .13, 1.6, .15, this.mats.wood, group);
      this.box(side * 1.3, .08, 0, .19, .16, .9, this.mats.wood, group);
    }
    this.box(0, 1.23, 0, 2.8, .13, .13, this.mats.lightWood, group);
    for (let i = 0; i < 5; i++) {
      const xx = -1 + i * .49;
      const stock = this.box(xx, .57, .24, .11, 1.08, .13, this.mats.wood, group); stock.rotation.x = -.2;
      const barrel = this.box(xx, 1.28, .09, .055, .8, .055, this.mats.iron, group); barrel.rotation.x = -.2;
      this.box(xx, 1.79, -.01, .027, .32, .027, this.mats.paper, group);
    }
    this.block(x, z, 2.95, 1.05);
  }

  private flag(x: number, z: number, height: number) {
    this.cylinder(x, height / 2, z, .05, .085, height, this.mats.lightWood);
    const cloth = this.box(x + 1, height - .95, z, 2, 1.15, .035, this.mats.blue);
    // No baked text: a simple field standard remains readable in every language.
    for (let i = 0; i < 4; i++) this.box(x + 1.27, height - .58 - i * .25, z + .025, 1.4, .11, .025, this.mats.paper);
    this.flagCloths.push(cloth); this.block(x, z, .25, .25);
  }

  private lantern(x: number, z: number) {
    this.box(x, 1.03, z, .1, 2.06, .1, this.mats.wood);
    this.box(x + .17, 2.03, z, .42, .1, .1, this.mats.wood);
    this.box(x + .3, 1.73, z, .24, .39, .24, this.mats.iron);
    this.box(x + .3, 1.73, z + .127, .16, .26, .025, this.material(0xffd57c, false, 0xe7a13a));
    const light = new THREE.PointLight(0xffc273, 5, 6, 1.7); light.position.set(x + .3, 1.75, z + .25); this.root.add(light);
    this.block(x, z, .32, .32);
  }

  private boundaries() {
    this.fence(-18.75, 15.7, 18.75, 15.7, this.mats.lightWood);
    for (const side of [-1, 1]) for (let z = -15; z <= 15; z += 3) {
      this.box(side * 18.75, .9, z, .15, 1.8, .18, this.mats.wood);
      if (z < 15) for (const y of [.65, 1.2]) this.box(side * 18.75, y, z + 1.5, .12, .1, 3, this.mats.lightWood);
    }
    for (let x = -18; x <= 18; x += 3) {
      this.box(x, .9, -15.7, .16, 1.8, .16, this.mats.wood);
      if (x < 18) for (const y of [.65, 1.2]) this.box(x + 1.5, y, -15.7, 3, .1, .12, this.mats.lightWood);
    }
    this.block(18.75, 0, .25, 32); this.block(-18.75, 0, .25, 32); this.block(0, -15.7, 38, .25);
    // Background trees sit outside the fenced navigable rectangle.
    for (let i = 0; i < 27; i++) {
      const x = i < 15 ? -27 + i * 3.9 : (i % 2 ? -1 : 1) * (22 + this.random() * 7);
      const z = i < 15 ? -21 - this.random() * 7 : -14 + this.random() * 34;
      const h = 4.7 + this.random() * 3;
      this.cylinder(x, h * .35, z, .18, .32, h * .7, this.mats.wood);
      const tree = this.group(true);
      for (let tier = 0; tier < 3; tier++) this.cylinder(x, h * .47 + tier * h * .17, z, .03, 2.5 - tier * .5, h * .5, i % 3 ? this.mats.leaf : this.mats.leafLight, tree, 7);
    }
  }

  private scatter() {
    for (let i = 0; i < 200; i++) {
      const x = (this.random() - .5) * 37, z = (this.random() - .5) * 31;
      if (Math.abs(x) < 2.8 || (z > 8 && z < 12) || (z > -4.8 && z < -.8) || this.obstacles.some(o => Math.abs(x - o.x) < o.width / 2 + .4 && Math.abs(z - o.z) < o.depth / 2 + .4)) continue;
      if (i % 4 === 0) this.box(x, .045, z, .12 + this.random() * .22, .09, .1 + this.random() * .25, this.mats.stone).rotation.y = this.random() * 3;
      else for (let j = 0; j < 3; j++) this.box(x + j * .065, .07 + j * .015, z, .035, .16 + j * .03, .07, this.mats.grass).rotation.z = -.35 + j * .3;
    }
    for (const x of [-.8, .8]) for (let z = -14; z <= 15; z += .9) this.box(x, -.008, z, .15, .008, .4 + this.random() * .4, this.mats.earth);
  }

  override update(time: number, reduceMotion: boolean, cameraYaw: number) {
    super.update(time, reduceMotion, cameraYaw);
    for (const puff of this.smoke) {
      puff.mesh.position.set(puff.x + (reduceMotion ? 0 : Math.sin(time * .7 + puff.phase) * .15), puff.y + (reduceMotion ? 0 : Math.sin(time * .5 + puff.phase) * .12), puff.z);
    }
    for (const flag of this.flagCloths) flag.rotation.y = reduceMotion ? 0 : Math.sin(time * 1.5) * .035;
  }
}
