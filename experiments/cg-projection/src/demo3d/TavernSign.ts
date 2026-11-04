import * as THREE from 'three';
import { bi, getLanguage, onLanguageChange, primaryText, type BiText, type LanguageMode } from '../i18n/text';

/** Canvas-text counterpart for a 3D sign: repaint the texture when language changes. */
function canvasText(ctx: CanvasRenderingContext2D, x: number, y: number, text: BiText) {
  const mode = getLanguage();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff0b8';
  ctx.font = mode === 'en' ? 'bold 72px Georgia, serif' : 'bold 112px "Songti SC", SimSun, serif';
  ctx.fillText(primaryText(text), x, mode === 'dual' ? y - 38 : y, 440);
  if (mode === 'dual') {
    ctx.font = 'bold 62px Georgia, serif';
    ctx.fillText(text.en, x, y + 76, 440);
  }
}

export class TavernSign {
  readonly root = new THREE.Group();
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private language?: LanguageMode;

  constructor() {
    this.root.name = 'tavern-sign';
    this.canvas.width = 1024; this.canvas.height = 640;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 4;
    // Settings can change the sign while gameplay is paused. World disposal owns cleanup.
    const unsubscribe = onLanguageChange(() => this.update());
    this.texture.addEventListener('dispose', unsubscribe);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.75, .2), new THREE.MeshLambertMaterial({ color: 0x553821 }));
    board.castShadow = true; this.root.add(board);
    const face = new THREE.MeshLambertMaterial({ map: this.texture, emissive: 0x30220c });
    // Two outward-facing planes keep the reverse of the hanging sign readable.
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.72, 1.67), face);
      panel.position.z = side * .106; panel.rotation.y = side === 1 ? 0 : Math.PI;
      this.root.add(panel);
    }
  }

  update() {
    if (this.language === getLanguage()) return;
    this.language = getLanguage();
    const ctx = this.canvas.getContext('2d')!;
    ctx.fillStyle = '#382b20'; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = '#d0a55e'; ctx.fillRect(18, 18, 988, 604);
    ctx.fillStyle = '#493224'; ctx.fillRect(30, 30, 964, 580);
    for (let y = 40; y < 600; y += 80) {
      ctx.fillStyle = '#513927'; ctx.fillRect(40, y, 944, 3);
    }
    for (const x of [54, 970]) for (const y of [54, 586]) {
      ctx.fillStyle = '#d0a55e'; ctx.fillRect(x - 5, y - 5, 10, 10);
    }
    // A tankard remains recognizable before the lettering is close enough to read.
    ctx.fillStyle = '#efcc7b'; ctx.fillRect(287, 238, 104, 146);
    ctx.fillStyle = '#493224'; ctx.fillRect(306, 263, 59, 96);
    ctx.fillStyle = '#efcc7b'; ctx.fillRect(119, 215, 179, 221);
    ctx.fillStyle = '#fff0b8'; ctx.fillRect(109, 199, 197, 37);
    ctx.fillRect(132, 181, 54, 28); ctx.fillRect(204, 175, 68, 34);
    ctx.fillStyle = '#bc8543'; ctx.fillRect(151, 252, 16, 149); ctx.fillRect(246, 252, 16, 149);
    ctx.fillStyle = '#efcc7b'; ctx.fillRect(112, 426, 194, 16);
    canvasText(ctx, 665, 310, bi('酒馆', 'TAVERN'));
    this.texture.needsUpdate = true;
  }
}
