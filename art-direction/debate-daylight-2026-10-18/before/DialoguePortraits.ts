import './dialogue-portraits.css';
import { DIALOGUE_CAST } from '../data/dialogueCast';
import { MAIN_PIXEL_ART, type DialoguePerformance, type PortraitPose } from '../data/mainPixelArt';
import type { CharacterId } from '../data/types';
import { extractPortraitFrames, type PortraitKeyColor } from './portraitPixels';

// Main dialogue portraits have their own detailed art, independent of stage Q sprites.
const WIDTH = 360, HEIGHT = 450;
type Side = 'left' | 'right';
type Phase = 'ready' | 'speaking' | 'settled';
interface PortraitArt {
  frames: readonly HTMLCanvasElement[];
  kind: 'atlas' | 'fallback';
  facing: Side;
}
interface PortraitSlot {
  element: HTMLDivElement;
  canvas: HTMLCanvasElement;
  character?: CharacterId;
  frame: number;
  active: boolean;
}

const cache = new Map<CharacterId, PortraitArt>();
const subscribers = new Set<() => void>();
let preload: Promise<void> | undefined;

function canvas(width = WIDTH, height = HEIGHT) {
  const result = document.createElement('canvas'); result.width = width; result.height = height;
  return result;
}

async function loadMainPortrait(id: CharacterId) {
  const layout = MAIN_PIXEL_ART[id];
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const timeout = window.setTimeout(() => {
      img.onload = null; img.onerror = null;
      reject(new Error(`Main pixel portrait timed out: ${layout.path}`));
    }, 15000);
    img.onload = () => { window.clearTimeout(timeout); resolve(img); };
    img.onerror = () => { window.clearTimeout(timeout); reject(new Error(`Main pixel portrait unavailable: ${layout.path}`)); };
    img.src = layout.path;
  });
  const source = canvas(image.naturalWidth, image.naturalHeight);
  const context = source.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const extracted = extractPortraitFrames(context.getImageData(0, 0, source.width, source.height), {
    columns: layout.columns, rows: layout.rows, frameCount: layout.frameCount,
    horizontalOverscan: layout.frameOverscan,
    frameOffsets: layout.frameOffsets,
    key: { color: layout.key as PortraitKeyColor },
    outputWidth: WIDTH, outputHeight: HEIGHT, padding: 5,
  });
  // All cells share one scale and origin. Fitting each frame separately makes a
  // change in hand gesture resize the face and whole body during speech.
  if (extracted.bounds.slice(0, layout.frameCount).some(bound => !bound.width || !bound.height))
    throw new Error(`Main pixel portrait has an empty authored frame: ${layout.path}`);
  const frames = extracted.frames.slice(0, layout.frameCount).map(pixels => {
    const frame = canvas();
    frame.getContext('2d')!.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
    return frame;
  });
  cache.set(id, { frames, kind: 'atlas', facing: layout.facing });
  for (const subscriber of subscribers) subscriber();
}

const PALETTES: Record<CharacterId, { coat: string; shadow: string; hair: string; skin: string }> = {
  hamilton: { coat: '#263e59', shadow: '#192b42', hair: '#563a22', skin: '#e0aa70' },
  burr: { coat: '#643439', shadow: '#38272d', hair: '#34271e', skin: '#a46a43' },
  washington: { coat: '#273d51', shadow: '#192a3b', hair: '#3d352b', skin: '#b57c50' },
  laurens: { coat: '#314967', shadow: '#1c3049', hair: '#35251b', skin: '#c9915e' },
  lafayette: { coat: '#243950', shadow: '#182c40', hair: '#29241e', skin: '#9e643d' },
  mulligan: { coat: '#586243', shadow: '#343e2b', hair: '#26221b', skin: '#9d653d' },
  loyalist: { coat: '#8b3427', shadow: '#5a241f', hair: '#624021', skin: '#dea268' },
  newsboy: { coat: '#9c7546', shadow: '#5a4430', hair: '#584025', skin: '#e7b278' },
  citizen: { coat: '#586b72', shadow: '#334650', hair: '#342c1f', skin: '#b77a46' },
  narrator: { coat: '#9ccdd2', shadow: '#589097', hair: '#2b2825', skin: '#d6a477' },
};

/** Eliza records the story: her pale blue gown and silhouette identify her,
 * while her entire face remains in shadow, without eyes or a visible mouth. */
function elizaPortrait(): PortraitArt {
  const drawing = canvas(72, 88), c = drawing.getContext('2d')!;
  const rect = (color: string, x: number, y: number, width: number, height: number) => { c.fillStyle = color; c.fillRect(x, y, width, height); };
  const polygon = (color: string, points: number[]) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fill();
  };
  // Stepped hair contour and long curls fall behind the sleeves. A three-quarter
  // profile is clear from the silhouette alone, even with no facial features.
  polygon('#181e20', [26,10,32,6,43,6,50,10,54,17,54,27,58,31,55,36,54,49,59,56,58,67,19,68,17,58,20,45,20,22]);
  polygon('#2c2a29', [26,12,32,8,43,8,50,12,52,19,45,17,34,19,29,28,28,43,24,54,25,61,20,62,22,48,22,24]);
  rect('#48403a',27,15,3,10); rect('#3d3732',25,25,3,13); rect('#51443a',24,42,2,9);
  rect('#322d2a',21,54,4,10); rect('#3c3430',49,41,3,14); rect('#292728',53,51,3,10);
  polygon('#111b22', [34,20,45,18,51,21,51,28,56,31,53,34,52,40,47,46,38,46,31,39,30,29]);
  // No eyes, mouth, skin highlights or facial detail are painted inside this shadow.
  polygon('#17232a', [35,44,45,44,45,51,49,54,30,54,35,49]);
  polygon('#233c44', [23,51,32,49,36,53,44,51,51,49,60,56,63,70,57,88,11,88,12,70,17,56]);
  polygon('#76aeb8', [23,53,31,52,36,57,44,55,51,52,58,57,60,68,53,72,53,88,22,88,22,68,15,65,19,57]);
  polygon('#b5dce0', [26,53,32,52,36,57,44,55,49,53,49,65,43,76,28,76,24,65]);
  polygon('#d4e9e5', [28,52,32,52,37,55,44,53,47,52,47,56,37,59,29,56]);
  polygon('#92c7cf', [19,55,23,55,25,64,21,70,14,68,16,61]);
  polygon('#c0e0df', [17,57,20,56,22,63,19,66,15,65]);
  polygon('#9bcbd1', [53,54,57,56,60,65,55,69,50,66,51,59]);
  rect('#d7e8df',15,66,7,3); rect('#d7e8df',53,65,8,3);
  polygon('#669fae', [25,71,44,72,50,88,17,88]);
  polygon('#abd3d8', [29,72,38,73,37,88,24,88]);
  polygon('#89bac7', [41,73,45,74,48,88,39,88]);
  rect('#c2e0df',26,72,19,2); rect('#eef0d5',35,72,4,3);
  // The manuscript rests across her arms; tiny neutral strokes are decorative,
  // not baked-in dialogue or UI language.
  polygon('#bb8d65', [16,69,21,69,26,75,32,77,31,82,24,80,18,76]);
  polygon('#e4b48a', [17,69,20,69,24,75,28,77,27,79,22,77,18,74]);
  polygon('#574a37', [26,66,41,70,58,65,61,84,43,88,26,82]);
  polygon('#d4c59c', [28,67,41,72,56,67,58,81,43,86,28,80]);
  polygon('#ece1bd', [29,68,40,72,41,83,30,79]);
  polygon('#e1d4aa', [43,73,55,68,56,80,44,84]);
  rect('#b1a27b',32,73,6,1); rect('#b1a27b',32,76,7,1); rect('#b1a27b',34,79,5,1);
  rect('#b1a27b',46,73,7,1); rect('#b1a27b',46,77,8,1); rect('#b1a27b',47,80,5,1);
  polygon('#91bec5', [53,67,60,66,59,73,54,75,48,71]);
  rect('#d5e4da',50,69,6,4);
  const result = canvas(), output = result.getContext('2d')!; output.imageSmoothingEnabled = false;
  output.drawImage(drawing, 0, 0, WIDTH, HEIGHT);
  return { frames: [result], kind: 'fallback', facing: 'right' };
}

/** Distinct-role pixel fallback keeps every speaker visible if an atlas fails. */
function authoredPortrait(id: CharacterId): PortraitArt {
  if (id === 'narrator') return elizaPortrait();
  const drawing = canvas(72, 88), c = drawing.getContext('2d')!, p = PALETTES[id];
  const rect = (color: string, x: number, y: number, width: number, height: number) => { c.fillStyle = color; c.fillRect(x, y, width, height); };
  const polygon = (color: string, points: number[]) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fill();
  };
  const outline = '#24241e', gold = '#c6a665', paper = '#e4dac0';
  // Body, sleeves and waistcoat. The inward shoulder and cheek are deliberately
  // asymmetric, so the mirrored pair visibly looks towards one another.
  polygon(outline, [22,43,47,43,58,51,64,79,60,88,10,88,9,70,15,50]);
  polygon(p.shadow, [21,45,30,47,30,88,12,88,12,70,17,52]);
  polygon(p.coat, [30,46,46,45,55,52,58,88,28,88]);
  polygon('#bdab82', [31,47,43,47,46,87,28,87]);
  polygon('#decaa0', [36,49,43,49,45,87,35,87]);
  polygon(gold, [27,45,33,48,29,68,24,72]);
  polygon(gold, [45,46,42,50,48,69,51,72]);
  rect('#8a7146', 32,68,2,2); rect('#8a7146',33,76,2,2); rect('#8a7146',34,84,2,2);
  rect(p.skin,13,77,7,11); rect('#c99464',55,78,7,9);
  rect(paper,12,72,10,6); rect(paper,53,73,10,5);
  rect(gold,13,73,2,3); rect(gold,59,74,2,3);
  // Hair silhouette, tied tail and three-quarter face.
  polygon(outline, [22,9,29,4,42,4,49,8,53,17,52,24,55,29,53,37,48,44,37,48,25,43,18,31,18,19]);
  polygon(p.hair, [22,11,29,6,42,6,48,9,51,18,44,18,38,15,28,23,28,37,23,36,20,29,20,20]);
  rect(p.hair,17,32,7,14); rect(p.hair,14,39,8,10); rect(outline,17,38,6,3);
  polygon(p.skin, [31,18,41,17,49,20,49,27,54,29,54,32,51,33,51,39,46,44,37,44,29,38,28,27]);
  polygon('#edc493', [38,19,44,20,46,27,46,34,42,39,36,37,34,28]);
  rect(p.skin,26,27,5,8); rect('#a46e4e',28,29,2,4);
  rect(outline,35,24,6,2); rect(outline,47,25,4,2);
  rect('#f5e4bf',35,27,6,5); rect('#f5e4bf',47,28,4,4);
  rect(outline,38,27,3,5); rect(outline,49,28,2,4);
  rect('#fff4d0',38,27,1,2); rect('#fff4d0',49,28,1,1);
  rect('#ae774d',45,31,3,4); rect('#9e6648',41,39,7,1);
  rect(p.skin,34,42,10,7);
  polygon(paper, [31,44,36,47,42,44,46,49,40,57,34,54]);
  rect('#fff1d0',35,46,5,6); rect('#bcaf92',38,53,3,5);
  if (id === 'newsboy' || id === 'citizen' || id === 'mulligan') {
    const cap = id === 'newsboy' ? '#9b8056' : id === 'citizen' ? '#d6c8a6' : '#7c7970';
    polygon(outline, [20,12,23,5,40,3,48,7,52,15,48,19,22,21]);
    polygon(cap, [22,12,25,7,40,5,47,9,49,15,22,18]);
    rect(id === 'mulligan' ? '#9d9a8b' : '#b8a280',22,14,28,4);
    if (id === 'mulligan') polygon('#382a1d', [29,35,33,38,44,40,51,35,49,43,41,47,33,44]);
  } else if (id === 'burr' || id === 'washington') {
    rect(p.hair,23,10,23,7); rect(p.skin,21,35,5,10); rect('rgba(0,0,0,0)',14,39,1,1);
    c.clearRect(12,38,10,12);
  } else if (id === 'lafayette') {
    rect(p.hair,17,9,7,12); rect(p.hair,15,13,8,5);
    polygon('#35271e', [29,35,35,39,47,39,51,34,50,43,43,47,33,43]);
  }
  if (id === 'washington' || id === 'lafayette') {
    rect(gold,18,46,10,5); rect(gold,49,46,8,5);
    for (let x = 18; x <= 26; x += 2) rect('#e5c477',x,50,1,5);
    if (id === 'washington') polygon('#a6c2c9', [47,47,52,51,30,82,25,77]);
  }
  const result = canvas(), output = result.getContext('2d')!; output.imageSmoothingEnabled = false;
  output.drawImage(drawing, 0, 0, WIDTH, HEIGHT);
  return { frames: [result], kind: 'fallback', facing: 'right' };
}

function art(id: CharacterId) {
  let existing = cache.get(id);
  if (!existing) { existing = authoredPortrait(id); cache.set(id, existing); }
  return existing;
}

/** Warm each detailed sheet once; a failed sheet retains an identifiable static fallback. */
export function preloadDialoguePortraits(): Promise<void> {
  if (!preload) {
    for (const id of DIALOGUE_CAST) art(id);
    preload = Promise.allSettled(DIALOGUE_CAST.map(loadMainPortrait)).then(() => {});
  }
  return preload;
}

/** Persistent inward-facing upper bodies, with authored speech and attitude frames. */
export class DialoguePortraits {
  readonly element = document.createElement('div');
  private slots: Record<Side, PortraitSlot>;
  private speaker?: CharacterId;
  private performance?: DialoguePerformance;
  private phase: Phase = 'ready';
  private talking = false;
  private elapsed = 0;
  private paused = false;
  private reducedMotion = false;
  private destroyed = false;
  private redraw = () => this.paint();

  constructor() {
    this.element.className = 'dialogue-portraits'; this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    const slot = (side: Side): PortraitSlot => {
      const element = document.createElement('div'), portrait = canvas();
      element.className = 'dialogue-portrait-slot'; element.dataset.side = side;
      element.dataset.facing = side === 'left' ? 'right' : 'left';
      portrait.className = 'dialogue-portrait-canvas';
      element.append(portrait); this.element.append(element);
      return { element, canvas: portrait, frame: 0, active: false };
    };
    this.slots = { left: slot('left'), right: slot('right') };
    subscribers.add(this.redraw); void preloadDialoguePortraits();
  }

  show(speaker: CharacterId, partner: CharacterId = speaker === 'hamilton' ? 'burr' : 'hamilton', performance?: DialoguePerformance) {
    if (this.destroyed) return;
    if (partner === speaker) partner = speaker === 'hamilton' ? 'burr' : 'hamilton';
    const { left, right } = this.slots;
    if (left.character === speaker) right.character = partner;
    else if (right.character === speaker) left.character = partner;
    else if (left.character === partner) right.character = speaker;
    else if (right.character === partner) left.character = speaker;
    else {
      left.character = speaker === 'hamilton' || partner !== 'hamilton' ? speaker : partner;
      right.character = left.character === speaker ? partner : speaker;
    }
    this.speaker = speaker; this.performance = performance;
    this.talking = false; this.elapsed = 0; this.phase = 'ready';
    this.element.hidden = false; this.paint();
  }

  /** Call at each cue boundary, including consecutive lines by the same speaker. */
  setPerformance(performance: DialoguePerformance) {
    if (this.destroyed) return;
    this.performance = performance; this.phase = 'ready'; this.elapsed = 0; this.talking = false;
    this.paint();
  }

  /** `settled` means a cue actually finished, never buffering or playback pause. */
  setSpeaking(speaker: string | undefined, talking: boolean, settled = false) {
    if (this.destroyed || this.element.hidden) return;
    const id = DIALOGUE_CAST.find(character => character === speaker);
    const previousSpeaker = this.speaker;
    if (id && id !== this.slots.left.character && id !== this.slots.right.character) this.show(id, this.speaker);
    if (id) this.speaker = id;
    if (this.speaker !== previousSpeaker) { this.phase = 'ready'; this.elapsed = 0; }
    const nextTalking = talking && Boolean(id);
    const nextPhase: Phase = nextTalking ? 'speaking' : settled ? 'settled' : this.phase;
    if (nextTalking && this.phase !== 'speaking') this.elapsed = 0;
    if (nextTalking === this.talking && nextPhase === this.phase && this.speaker === previousSpeaker) return;
    this.talking = nextTalking; this.phase = nextPhase; this.paint();
  }

  update(deltaMs: number, paused: boolean, reducedMotion: boolean) {
    if (this.destroyed || this.element.hidden) return;
    const changed = paused !== this.paused || reducedMotion !== this.reducedMotion;
    this.paused = paused; this.reducedMotion = reducedMotion;
    if (this.talking && !paused && !reducedMotion) {
      const previousFrame = this.speakingFrame();
      this.elapsed += Math.max(0, Math.min(100, Number.isFinite(deltaMs) ? deltaMs : 0));
      if (changed || previousFrame !== this.speakingFrame()) this.paint();
    } else if (changed) this.paint();
  }

  reset() {
    this.element.hidden = true; this.speaker = undefined; this.performance = undefined;
    this.talking = false; this.elapsed = 0; this.phase = 'ready';
    this.slots.left.character = undefined; this.slots.right.character = undefined;
    delete this.element.dataset.speaker; this.element.dataset.talking = 'false';
    this.element.dataset.phase = 'ready';
  }

  destroy() { this.destroyed = true; subscribers.delete(this.redraw); this.element.remove(); }

  private speakingFrame() {
    if (!this.speaker) return 0;
    const layout = MAIN_PIXEL_ART[this.speaker];
    if (this.speaker === 'narrator') {
      // Eliza writes and occasionally turns a page. Her face stays in shadow;
      // her three authored frames never take part in the mouth cycle.
      return this.elapsed > 0 && this.elapsed % 3600 >= 3200
        ? layout.poses.turn ?? layout.talkFrames[0]
        : layout.poses.write ?? layout.talkFrames[0];
    }
    if (this.performance?.emphasis && this.elapsed >= 350 && this.elapsed < 540) return layout.talkFrames[2];
    return layout.talkFrames[[1, 0, 1, 1, 0, 0, 1, 0][Math.floor(this.elapsed / 115) % 8]];
  }

  private poseFrame(character: CharacterId, pose: PortraitPose, active: boolean) {
    const layout = MAIN_PIXEL_ART[character];
    return layout.poses[pose] ?? layout.poses[active ? layout.defaultPose : layout.listenPose] ?? layout.talkFrames[0];
  }

  private paint() {
    if (this.destroyed || this.element.hidden) return;
    const animate = this.talking && !this.paused && !this.reducedMotion;
    this.element.dataset.speaker = this.speaker ?? '';
    this.element.dataset.talking = String(animate); this.element.dataset.paused = String(this.paused);
    this.element.dataset.reducedMotion = String(this.reducedMotion); this.element.dataset.phase = this.phase;
    for (const side of ['left', 'right'] as const) {
      const slot = this.slots[side]; if (!slot.character) continue;
      const source = art(slot.character), active = slot.character === this.speaker;
      const layout = MAIN_PIXEL_ART[slot.character], motion = animate && active;
      const pose = active
        ? this.phase === 'settled' ? this.performance?.settled ?? layout.listenPose : this.performance?.speaking ?? layout.defaultPose
        : this.performance?.listener ?? layout.listenPose;
      // Attitudes are separately authored closed-mouth frames. During speech we
      // use the registered basic mouth sequence; no painted-on procedural lips.
      const requestedFrame = motion ? this.speakingFrame()
        : active && this.phase === 'speaking' ? layout.talkFrames[0]
          : this.poseFrame(slot.character, pose, active);
      const frame = requestedFrame < source.frames.length ? requestedFrame : 0;
      slot.frame = frame; slot.active = active;
      slot.element.dataset.character = slot.character; slot.element.dataset.active = String(active);
      slot.element.dataset.talking = String(motion); slot.element.dataset.frame = String(frame);
      slot.element.dataset.pose = motion ? 'speaking' : pose;
      slot.element.dataset.art = source.kind;
      slot.element.dataset.artSource = source.kind === 'atlas' ? 'main-pixel' : 'fallback';
      slot.element.dataset.frameCount = String(source.frames.length);
      slot.element.dataset.mirrored = String(source.facing !== (side === 'left' ? 'right' : 'left'));
      const c = slot.canvas.getContext('2d')!;
      c.clearRect(0, 0, WIDTH, HEIGHT); c.imageSmoothingEnabled = false;
      c.save(); c.drawImage(source.frames[frame], 0, 0);
      if (!active) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = 'rgba(89, 95, 93, .35)'; c.fillRect(0, 0, WIDTH, HEIGHT);
        c.fillStyle = 'rgba(8, 15, 17, .59)'; c.fillRect(0, 0, WIDTH, HEIGHT);
      }
      c.restore();
    }
  }
}
