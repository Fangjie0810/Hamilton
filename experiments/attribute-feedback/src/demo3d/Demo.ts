import * as THREE from 'three';
import { bi, f, setText, setDialogueText, setLabel, getLanguage, getPrimaryLanguage, setLanguage, languageOptions, type Text, type LanguageMode } from '../i18n/text';
import { BURR } from './World';
import { SCENES, SCENE_IDS, sceneId, createWorld, type SceneId, type ScenePoint, type SceneExit } from './SceneCatalog';
import { disposeWorld, type SceneWorld } from './SceneWorld';
import { Walker, type Point } from './Navigation';
import { loadPixelAtlas, PixelActor } from './PixelActor';
import { FocusRenderer } from './FocusRenderer';
import { layoutMarkerLabels, type LabelRect, type MarkerLabel } from './MarkerLayout';
import { Occlusion } from './Occlusion';
import { applyHarborMist } from './HarborMist';
import { StoryDirector, type StoryTarget } from '../story3d/StoryDirector';
import { CURTAIN_FADE_MS, CURTAIN_HOLD_MS, REDUCED_CURTAIN_MS } from '../ui/transitions';
import { artVariant } from '../data/art';
import { chapters } from '../data/chapters';
import { preloadChapterBackdrop, renderChapterTransition } from '../story3d/ChapterTransition';
import './demo.css';
import { voiceover, voiceoverSetting } from '../ui/voiceover';
import { music, musicSetting } from '../ui/music';
import { MAX_CAMERA_PITCH, MIN_CAMERA_PITCH, orbitCamera } from './CameraOrbit';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}
function button(text: Text, className: string, action: () => void) {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
const qualityKey = 'project-hamilton:3d-quality:v1';
function saved(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* The sample works without storage. */ } }

interface StartupOptions { opening?: () => Promise<void>; onStartupError?: () => void }

class StreetDemo {
  private openingPending: boolean;
  private leaving = false;
  constructor(private startup: StartupOptions = {}) { this.openingPending = !!startup.opening; }
  private storyMode = new URLSearchParams(location.search).get('story') === '3d';
  private story?: StoryDirector;
  private app = document.querySelector<HTMLElement>('#app')!;
  private ui = el('div', 'd3-ui');
  private scene = new THREE.Scene();
  private renderer!: THREE.WebGLRenderer;
  private focusRenderer!: FocusRenderer;
  private occlusion!: Occlusion;
  private camera = new THREE.PerspectiveCamera(40, 1, .1, 130);
  private world!: SceneWorld;
  private definition = SCENES[this.storyMode ? 'street' : sceneId(new URLSearchParams(location.search).get('scene'))];
  private switching = false;
  private pauseAfterTransition = false;
  private disposed = false;
  private failed = false;
  private hemisphere = new THREE.HemisphereLight();
  private sceneSelect = el('select', 'd3-scene-select');
  private heading = el('div', 'd3-heading');
  private markerLabels: { node: HTMLButtonElement; point: ScenePoint | SceneExit | StoryTarget }[] = [];
  private markerRoot = new THREE.Group();
  private approached?: ScenePoint | SceneExit | StoryTarget;
  private inspecting?: ScenePoint;
  private visited = new Map<SceneId, Set<number>>();
  private walker!: Walker;
  private player!: PixelActor;
  private burr!: PixelActor;
  private burrDirection: Point = { x: 0, z: 1 };
  private sun = new THREE.DirectionalLight(0xffecd0, 3.1);
  private keys = new Set<string>();
  private pointer?: { x: number; y: number; id: number; surface: HTMLElement };
  private orbitControl = el('button', 'd3-camera-orbit');
  private orbitIndicator = el('span', 'd3-camera-indicator');
  private yaw = .48;
  private pitch = MIN_CAMERA_PITCH;
  private radius = 25;
  private cameraTarget = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private clock = 0;
  private lastTime = 0;
  private ready = false;
  private paused = false;
  private growthPaused = false;
  private talking = false;
  private approachBurr = false;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private quality = saved(qualityKey) ?? 'balanced';
  private modal = el('dialog', 'd3-settings');
  private dialogue = el('section', 'd3-dialogue');
  private dialogueStep = 0;
  private dialogueBranch = 0;
  private spoken = false;
  private discoveries = new Set<number>();
  private trail = new THREE.Mesh(new THREE.RingGeometry(.24, .31, 32), new THREE.MeshBasicMaterial({ color: 0xf4d694, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  private playerRing = new THREE.Mesh(new THREE.RingGeometry(.34, .38, 32), new THREE.MeshBasicMaterial({ color: 0xffe5ad, transparent: true, opacity: .6, depthWrite: false }));
  private npcLabel = button(bi('伯尔 · 交谈', 'Burr · Talk'), 'd3-npc', () => this.visitBurr());
  private prompt = button(bi('E  与伯尔交谈', 'E  Talk to Burr'), 'd3-interact', () => this.interact());
  private objective = el('span', 'd3-progress', bi('先和街口的伯尔谈谈', 'Find Burr at the crossroads'));
  private toast = el('div', 'd3-toast');
  private toastUntil = 0;
  private loading = el('div', 'd3-loading');
  private frame = 0;
  private npcOccluded = false;
  private listener = new AbortController();

  async start() {
    this.app.classList.add('demo3d'); this.app.classList.toggle('story3d', this.storyMode); this.app.replaceChildren(this.ui);
    if (this.storyMode) renderChapterTransition(this.loading, chapters.Opening, artVariant);
    else this.loading.append(el('span', 'd3-kicker', bi('纽约 · 1776', 'NEW YORK · 1776')), el('h1', '', bi('街角，暮色渐深', 'Dusk settles over the street')), el('p', '', bi('准备石路、灯影与远来的年轻人…', 'Preparing cobblestones, lamplight, and a young arrival…')));
    this.ui.append(this.loading);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      this.renderer.setClearColor(0xaebfa3); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.07;
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.info.autoReset = false;
      this.renderer.domElement.className = 'd3-canvas'; this.renderer.domElement.tabIndex = 0;
      this.renderer.domElement.dataset.mode = this.storyMode ? 'story' : 'explore';
      this.renderer.domElement.dataset.frameReady = 'false';
      setLabel(this.renderer.domElement, 'aria-label', bi('纽约街角三维场景。WASD 或方向键移动，E 交谈，Esc 设置。', 'New York street in 3D. Move with WASD or arrow keys, E to talk, Esc for settings.'));
      this.app.prepend(this.renderer.domElement);
      this.scene.background = new THREE.Color(0xaebfa3); this.scene.fog = new THREE.FogExp2(0xaebfa3, .007);
      this.scene.add(this.hemisphere);
      this.sun.position.set(-15, 27, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
      Object.assign(this.sun.shadow.camera, { left: -29, right: 29, top: 29, bottom: -29, near: .5, far: 80 });
      this.sun.shadow.normalBias = .035; this.sun.shadow.bias = -.00015; this.sun.shadow.radius = 3; this.scene.add(this.sun);
      const atlas = await loadPixelAtlas();
      this.player = new PixelActor(atlas); this.burr = new PixelActor(atlas, true); this.scene.add(this.player.root, this.burr.root);
      this.trail.rotation.x = this.playerRing.rotation.x = -Math.PI / 2; this.trail.visible = false; this.scene.add(this.trail, this.playerRing);
      this.focusRenderer = new FocusRenderer(); this.buildUI(); this.bindInput(); this.setQuality(this.quality);
      // Draw behind the curtain as soon as a world is ready, including the first chapter.
      this.renderer.setAnimationLoop(time => this.tick(time));
      if (this.storyMode) {
        this.app.classList.add('story3d');
        this.story = new StoryDirector({
          app: this.app, atlas, blocked: () => this.paused || this.growthPaused || this.switching || this.failed || !this.ready,
          loadChapter: async () => { await this.switchScene(this.story!.place.scene, true, true); if (!this.ready) throw new Error('Story scene failed to load'); },
          root: () => this.world.root, map: () => this.world.map, position: () => this.walker.position,
          stop: () => this.stop(), markers: () => { this.buildMarkers(); this.updateObjective(); },
          focus: () => { if (!this.paused && !this.switching) this.renderer.domElement.focus({ preventScroll: true }); },
          toast: text => this.showToast(text), fail: error => { console.error(error); this.showError(); },
          title: () => { void this.returnToTitle(); },
          growthPause: open => { this.growthPaused = open; this.stop(); voiceover.setPaused('growth', open); music.setPaused('growth', open); this.lastTime = 0; },
        });
        this.story.ui.reduceMotion = this.reduceMotion;
        this.story.ui.textSpeed = Number(saved('project-hamilton:3d-text-speed:v1') ?? 24);
        // Isolated design review only: enter the real Arrival scene through the normal prologue progression.
        if (new URLSearchParams(location.search).has('review')) {
          this.story.progress.begin('opening-letter');
          while (this.story.progress.phase === 'dialogue') this.story.progress.next();
          this.story.progress.nextChapter();
        }
        await this.story.start();
        if (new URLSearchParams(location.search).has('review')) {
          const { mountReview } = await import('../attribute-feedback/review');
          mountReview(this.story);
        }
      } else await this.switchScene(this.definition.id, false);
      if (this.disposed || !this.ready) return;
      if (new URLSearchParams(location.search).has('debug')) {
        Object.assign(window, { __streetTest: {
          project: (x: number, z: number, y = 0) => { const p = new THREE.Vector3(x, y, z).project(this.camera); return { x: (p.x + 1) * .5 * this.app.clientWidth, y: (1 - p.y) * .5 * this.app.clientHeight }; },
          free: (x: number, z: number) => this.world.map.free({ x, z }),
          atlas: () => (this.player.texture.image as HTMLCanvasElement).toDataURL(),
          pose: () => ({ facing: this.player.facing, frame: this.player.frame, flip: this.player.body.scale.x < 0, moving: this.walker.moving }),
          scene: () => ({ id: this.definition.id, spawn: this.definition.spawn, points: this.definition.points, exits: this.definition.exits }),
          environment: () => ({ harborMist: this.world.root.userData.harborMist === true, light: this.definition.light, background: (this.scene.background as THREE.Color).getHexString() }),
          route: (x: number, z: number) => ({ free: this.world.map.free({ x, z }), path: this.world.map.path(this.walker.position, { x, z }) }),
          story: () => this.story?.debug(),
        } });
      }
      this.renderer.domElement.focus({ preventScroll: true });
      this.showToast(this.definition.intro);
    } catch (error) {
      console.error(error); this.showError();
    }
  }
  private async switchScene(id: SceneId, transition = true, storyChapter = false) {
    if (this.disposed || this.switching || (this.ready && this.definition.id === id && !storyChapter)) return;
    voiceover.stop(); voiceover.setPaused('settings', false);
    this.switching = true; this.ready = false; this.stop(); this.paused = false;
    this.talking = false; this.inspecting = undefined; this.dialogue.hidden = true; this.modal.close();
    this.sceneSelect.disabled = true; this.renderer.domElement.dataset.ready = 'false';
    const chapter = this.story?.progress.chapter;
    if (storyChapter && chapter) music.enterChapter(chapter.id, this.openingPending);
    music.setPaused('settings', false);
    const next = this.story && chapter ? { ...SCENES[id], spawn: this.story.place.spawn, title: chapter.title, kicker: chapter.act, subtitle: chapter.subtitle, intro: chapter.objective } : SCENES[id];
    const duration = this.reduceMotion ? REDUCED_CURTAIN_MS : CURTAIN_FADE_MS;
    if (storyChapter && chapter) {
      // Initial loading already owns this image; clearing it would expose the backing again.
      if (!this.loading.isConnected || this.loading.dataset.chapter !== chapter.id) renderChapterTransition(this.loading, chapter, artVariant);
    }
    else this.loading.replaceChildren(el('span', 'd3-kicker', next.kicker), el('h1', '', next.title), el('p', '', bi('沿着故事，走进下一处地方…', 'Following the story into another place…')));
    this.ui.append(this.loading);
    try {
      const filmOpening = this.openingPending;
      if (transition && !filmOpening) await this.loading.animate([{ opacity: 0 }, { opacity: 1 }], { duration, fill: 'forwards' }).finished;
      if (this.disposed || this.failed) return;
      const nextWorld = await createWorld(id);
      if (this.disposed || this.failed) { disposeWorld(nextWorld.root); return; }
      if (this.world) { this.occlusion.dispose(); this.scene.remove(this.world.root); disposeWorld(this.world.root); }
      this.definition = next; this.world = nextWorld; this.scene.add(nextWorld.root);
      this.walker = new Walker({ ...next.spawn }, nextWorld.map); this.occlusion = new Occlusion(nextWorld.occluders);
      if (id === 'street' && chapter?.id === 'Opening') applyHarborMist(nextWorld.root);
      this.discoveries = this.visited.get(id) ?? new Set<number>(); this.visited.set(id, this.discoveries);
      this.burr.root.visible = !this.story && id === 'street'; this.npcLabel.hidden = !!this.story || id !== 'street';
      this.burrDirection = { x: 0, z: 1 }; this.npcOccluded = false;
      const light = next.light;
      this.scene.background = new THREE.Color(light.fog); this.scene.fog = new THREE.FogExp2(light.fog, light.density);
      this.hemisphere.color.setHex(light.sky); this.hemisphere.groundColor.setHex(light.ground); this.hemisphere.intensity = light.ambient;
      this.sun.color.setHex(light.sun); this.sun.intensity = light.power; this.renderer.toneMappingExposure = light.exposure;
      this.sun.position.set(...(light.sunPosition ?? [-15, id === 'camp' ? 15 : 27, 12] as [number, number, number]));
      this.heading.replaceChildren(el('span', 'd3-kicker', next.kicker), el('h1', '', next.title), el('p', '', next.subtitle));
      setLabel(this.renderer.domElement, 'aria-label', f(bi('{0}。WASD 移动，E 查看或前往，Esc 设置。', '{0}. WASD to move, E to inspect or travel, Esc for settings.'), next.title));
      this.sceneSelect.value = id; this.buildMarkers(); this.updateObjective(); this.resetPosition();
      const url = new URL(location.href);
      if (!this.story) url.searchParams.set('scene', id);
      history.replaceState(null, '', url);
      this.renderer.domElement.dataset.scene = id;
      this.ready = true;
      this.tick(performance.now());
      if (filmOpening) {
        await this.startup.opening!();
        this.openingPending = false;
      } else if (storyChapter) await new Promise(resolve => setTimeout(resolve, this.reduceMotion ? REDUCED_CURTAIN_MS : CURTAIN_HOLD_MS));
      if (this.disposed || this.failed) return;
      if (transition) await this.loading.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }).finished;
      if (this.disposed || this.failed) return;
      this.loading.remove(); this.loading.getAnimations().forEach(animation => animation.cancel());
      this.switching = false; this.sceneSelect.disabled = !!this.story; this.lastTime = 0;
      this.renderer.domElement.dataset.ready = 'true';
      if (storyChapter && chapter?.next && chapter.next !== 'Ending') preloadChapterBackdrop(chapter.next, artVariant);
      if (this.pauseAfterTransition || document.hidden) { this.pauseAfterTransition = false; this.openSettings(); }
      else this.renderer.domElement.focus({ preventScroll: true });
      if (storyChapter && chapter) music.revealChapter(chapter.id);
      this.showToast(next.intro);
    } catch (error) { if (this.disposed || this.failed) return; console.error(error); this.switching = false; this.showError(); }
  }
  private buildMarkers() {
    this.markerLabels.forEach(({ node }) => node.remove()); this.markerLabels = [];
    this.markerRoot.removeFromParent(); disposeWorld(this.markerRoot); this.markerRoot = new THREE.Group(); this.world.root.add(this.markerRoot);
    const points = this.definition.id === 'street' ? [] : this.definition.points;
    for (const point of this.story ? this.story.markerTargets : [...points, ...this.definition.exits]) {
      const exit = 'to' in point || ('exit' in point && point.exit);
      const enabled = !('enabled' in point) || point.enabled;
      const guided = !!this.story && exit && enabled;
      const optional = ('discovery' in point && !!point.discovery) || ('pickup' in point && !!point.pickup);
      const complete = 'optionalComplete' in point && point.optionalComplete;
      const readOnly = 'optionalReadOnly' in point && point.optionalReadOnly;
      const node = button(f(exit ? bi('↗ {0}', '↗ {0}') : optional ? complete ? bi('✓ {0}', '✓ {0}') : bi('▤ {0}', '▤ {0}') : bi('◇ {0}', '◇ {0}'), point.title), 'd3-place', () => this.visitPoint(point));
      node.style.width = 'max-content';
      node.dataset.point = point.id; node.dataset.enabled = String(enabled); this.ui.append(node); this.markerLabels.push({ node, point });
      node.dataset.guided = String(guided); node.dataset.optional = String(optional); node.dataset.complete = String(complete);
      if (optional && !('reaction' in point && point.reaction) && !('hideProp' in point && point.hideProp)) {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(.5, .035, .65), new THREE.MeshLambertMaterial({ color: readOnly ? 0xb4b5a0 : 0xf1e0b6 }));
        const { propPosition, propHeight } = point as Partial<StoryTarget>;
        const position = propPosition ?? point.position, height = propHeight ?? .06;
        paper.position.set(position.x, height, position.z); paper.rotation.y = .24; paper.userData.discoveryTarget = point.id;
        this.markerRoot.add(paper);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(guided ? .72 : exit ? .55 : .29, guided ? .88 : exit ? .62 : .34, 4), new THREE.MeshBasicMaterial({ color: guided ? 0xffcf40 : optional ? (readOnly ? 0x82998b : 0x90cfbe) : enabled ? 0xf1d89b : 0x91a092, transparent: true, opacity: guided ? 1 : enabled ? .75 : .25, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(point.position.x, .018, point.position.z); this.markerRoot.add(ring);
    }
  }
  private visitPoint(point: ScenePoint | SceneExit | StoryTarget) {
    if (!this.ready || this.switching || this.paused || this.talking || this.story?.busy) return;
    if (this.distance(point.position) < 1.65) { this.activatePoint(point); return; }
    this.travel(point.position); this.approached = this.walker.path.length ? point : undefined;
  }
  private activatePoint(point: ScenePoint | SceneExit | StoryTarget) {
    if (this.story) { this.story.interact(point.id); return; }
    if ('to' in point) { void this.switchScene(point.to); return; }
    this.stop(); this.talking = true; this.inspecting = point; this.dialogueStep = 0; this.dialogue.hidden = false; this.prompt.hidden = true;
    const speaker = el('div', 'd3-speaker'); speaker.append(el('span', 'd3-kicker', bi('驻足看看', 'PAUSE AND LOOK')), el('h2', '', point.title));
    const content = el('div', 'd3-dialogue-content'); content.append(el('p', 'd3-line', point.body), button(bi('继续探索 →', 'Keep exploring →'), 'd3-choice', () => this.endDialogue()));
    this.dialogue.replaceChildren(speaker, content, button(bi('收起 ×', 'Close ×'), 'd3-close-dialogue', () => this.endDialogue()));
    setLabel(this.dialogue, 'aria-label', point.title); this.markDiscovered(this.definition.points.indexOf(point));
    this.dialogue.tabIndex = -1; this.dialogue.focus({ preventScroll: true });
  }
  private nearbyPoint() {
    if (this.story) return this.story.nearby();
    const points = this.definition.id === 'street' ? this.definition.points.filter(point => point.id === 'waterfront') : this.definition.points;
    return [...this.definition.exits, ...points].filter(point => this.distance(point.position) < 1.65).sort((a, b) => this.distance(a.position) - this.distance(b.position))[0];
  }
  private updateObjective() {
    if (this.story) { setText(this.objective, this.story.objective); return; }
    setText(this.objective, f(bi('本幕探索 {0} / {1} · 菱形驻足，路口前往', 'Explored {0} / {1} · Inspect diamonds, travel at exits'), this.discoveries.size, this.definition.points.length));
  }
  private showError() {
    music.stop();
    this.startup.onStartupError?.(); this.openingPending = false;
    voiceover.stop();
    this.failed = true; this.loading.getAnimations().forEach(animation => animation.cancel());
    this.ready = false; this.renderer?.setAnimationLoop(null); this.loading.replaceChildren();
    this.loading.classList.remove('d3-chapter-loading'); delete this.loading.dataset.chapter;
    if (this.renderer) this.renderer.domElement.dataset.ready = 'false';
    if (this.modal.open) this.modal.close(); this.dialogue.hidden = true;
    this.loading.append(el('h1', '', bi('场景暂时无法打开', 'The scene could not open')), el('p', '', bi('请刷新重试；此样例需要浏览器开启硬件加速并支持 WebGL 2。', 'Reload to try again. This sample requires WebGL 2 and browser hardware acceleration.')), button(bi('重新载入', 'Reload'), 'd3-primary', () => location.reload()), this.originalLink());
    if (!this.loading.isConnected) this.ui.append(this.loading);
  }
  private originalLink() {
    const link = el('a', 'd3-back', bi('返回标题 ↗', 'Return to title ↗')); link.href = '/';
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); void this.returnToTitle();
    });
    return link;
  }
  private async returnToTitle() {
    if (this.leaving) return;
    this.leaving = true; this.paused = true; this.stop(); voiceover.stop(); this.app.inert = true;
    await music.stopAndWait();
    location.assign('/');
  }
  private buildUI() {
    const header = el('header', 'd3-header');
    const selector = el('label', 'd3-scene-picker');
    selector.append(el('span', '', this.storyMode ? bi('主线路线 · 完成目标后前往', 'STORY ROUTE · COMPLETE OBJECTIVES TO TRAVEL') : bi('场景漫游', 'EXPLORE SCENES')), this.sceneSelect);
    setLabel(this.sceneSelect, 'aria-label', bi('选择三维场景', 'Choose a 3D scene'));
    for (const id of SCENE_IDS) { const option = el('option', '', SCENES[id].title); option.value = id; this.sceneSelect.append(option); }
    this.sceneSelect.addEventListener('change', () => { if (!this.storyMode) void this.switchScene(sceneId(this.sceneSelect.value)); });
    const actions = el('nav', 'd3-actions'); actions.append(selector, this.originalLink(), button(bi('设置 / 暂停', 'Settings / Pause'), 'd3-settings-button', () => this.openSettings()));
    if (!this.storyMode) { const link = el('a', 'd3-story-link d3-back', bi('开始三维主线 →', 'Play the 3D Story →')); link.href = '/?story=3d'; actions.prepend(link); }
    header.append(this.heading, actions);
    const bottom = el('footer', 'd3-footer'), controls = el('div', 'd3-controls');
    for (const [keys, text] of [['W A S D / ↑ ↓ ← →', bi('行走', 'Move')], ['SHIFT', bi('快步', 'Hurry')], ['↖', bi('点击地面前往', 'Click to walk')], ['↔', bi('右键拖动视角', 'Right-drag to orbit')], ['↕', bi('滚轮拉近 / 拉远', 'Scroll to zoom')]] as const) {
      const item = el('span', 'd3-control'); item.append(el('kbd', '', keys), el('span', '', text)); controls.append(item);
    }
    const status = el('div', 'd3-status'); status.append(el('span', 'd3-dot'), this.objective);
    bottom.append(status, controls); this.prompt.hidden = true;
    this.dialogue.hidden = true; setLabel(this.dialogue, 'aria-label', bi('与伯尔的对话', 'Conversation with Burr')); this.dialogue.setAttribute('aria-live', 'polite');
    this.toast.setAttribute('role', 'status'); this.modal.addEventListener('cancel', e => { e.preventDefault(); this.closeSettings(); });
    this.orbitControl.type = 'button'; this.orbitControl.setAttribute('role', 'slider');
    this.orbitControl.setAttribute('aria-valuemin', String(Math.round(MIN_CAMERA_PITCH * 180 / Math.PI)));
    this.orbitControl.setAttribute('aria-valuemax', String(Math.round(MAX_CAMERA_PITCH * 180 / Math.PI)));
    setLabel(this.orbitControl, 'aria-label', bi('视角控制球：拖动或使用方向键调整视角', 'Camera sphere: drag or use arrow keys to adjust the view'));
    setLabel(this.orbitControl, 'title', bi('拖动调整视角', 'Drag to adjust the view'));
    const globe = el('span', 'd3-camera-globe'); globe.setAttribute('aria-hidden', 'true');
    globe.append(el('span', 'd3-camera-latitude'), el('span', 'd3-camera-meridian'), this.orbitIndicator);
    this.orbitControl.append(globe); this.syncOrbitControl();
    this.ui.append(header, bottom, this.npcLabel, this.prompt, this.dialogue, this.toast, this.orbitControl, this.modal);
  }
  private buildSettings() {
    this.modal.replaceChildren();
    this.modal.append(el('span', 'd3-kicker', bi('在旅途中歇一会儿', 'A MOMENT ON THE JOURNEY')), el('h2', '', bi('设置与暂停', 'Settings & pause')));
    const language = el('select'); language.id = 'd3-language';
    for (const [value, label] of languageOptions) { const opt = el('option', '', label); opt.value = value; opt.lang = getPrimaryLanguage(value) === 'en' ? 'en' : 'zh-CN'; language.append(opt); }
    language.value = getLanguage(); language.addEventListener('change', () => setLanguage(language.value as LanguageMode));
    const quality = el('select'); quality.id = 'd3-quality';
    for (const [value, label] of [['balanced', bi('均衡 · 柔和景深', 'Balanced · Soft depth of field')], ['high', bi('精细 · 更高分辨率', 'High · Higher resolution')], ['low', bi('流畅 · 关闭景深', 'Performance · No depth of field')]] as const) { const opt = el('option', '', label); opt.value = value; quality.append(opt); }
    quality.value = this.quality; quality.addEventListener('change', () => this.setQuality(quality.value));
    for (const [input, label] of [[language, bi('语言', 'Language')], [quality, bi('画质', 'Graphics')]] as const) {
      const row = el('label', 'd3-setting-row'); row.htmlFor = input.id; row.append(el('span', '', label), input); this.modal.append(row);
    }
    if (this.story) {
      const speed = el('select'); speed.id = 'd3-text-speed';
      this.modal.append(voiceoverSetting('d3-voiceover', 'd3-setting-row'));
      this.modal.append(musicSetting('d3-music', 'd3-setting-row'));
      for (const [value, title] of [[0, bi('即时显示', 'Instant')], [24, bi('正常', 'Normal')], [45, bi('慢速', 'Slow')]] as const) { const option = el('option', '', title); option.value = String(value); speed.append(option); }
      speed.value = String(this.story.ui.textSpeed); speed.addEventListener('change', () => { this.story!.ui.textSpeed = Number(speed.value); save('project-hamilton:3d-text-speed:v1', speed.value); });
      const row = el('label', 'd3-setting-row'); row.htmlFor = speed.id; row.append(el('span', '', bi('文字速度', 'Text speed')), speed); this.modal.append(row);
    }
    this.modal.append(
      button(bi('继续行走', 'Continue walking'), 'd3-primary', () => this.closeSettings()),
      this.story ? button(bi('重开本幕 · 恢复进入时的状态', 'Restart chapter · Restore entry state'), 'd3-secondary s3-restart', () => { this.closeSettings(); void this.story!.restart(); }) : button(bi('回到本幕入口 · 重置镜头', 'Return to this scene’s entrance · Reset camera'), 'd3-secondary', () => { this.resetPosition(); this.closeSettings(); }), this.originalLink());
  }
  private openSettings() {
    if (!this.ready || this.switching || this.paused) return;
    voiceover.setPaused('settings', true);
    music.setPaused('settings', true);
    this.paused = true; this.stop(); this.buildSettings(); this.modal.showModal();
  }
  private closeSettings() {
    voiceover.setPaused('settings', false);
    music.setPaused('settings', false);
    this.paused = false; this.modal.close();
    if (this.story?.ui.growthOpen) { this.story.ui.focus(); }
    else if (!this.story?.busy || !this.story.ui.focus()) this.renderer.domElement.focus({ preventScroll: true });
    this.lastTime = 0;
  }
  private resetPosition() {
    const { spawn, camera } = this.definition;
    this.stop(); this.walker.position.x = spawn.x; this.walker.position.z = spawn.z;
    this.yaw = camera.yaw; this.pitch = camera.pitch; this.radius = camera.radius; this.cameraTarget.set(spawn.x, .7, spawn.z - 1);
    this.syncOrbitControl();
    this.talking = false; this.inspecting = undefined; this.dialogue.hidden = true;
  }
  private setQuality(value: string) {
    this.quality = ['low', 'balanced', 'high'].includes(value) ? value : 'balanced'; save(qualityKey, this.quality);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === 'high' ? 2 : this.quality === 'low' ? 1 : 1.5));
    const size = this.quality === 'low' ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.resize();
  }
  private resize() {
    const width = this.app.clientWidth, height = this.app.clientHeight;
    this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.focusRenderer.resize(Math.round(width * this.renderer.getPixelRatio()), Math.round(height * this.renderer.getPixelRatio()));
  }
  private stop() { this.keys.clear(); this.walker?.halt(); this.story?.release(); this.releaseOrbit(); this.approachBurr = false; this.approached = undefined; this.trail.visible = false; }
  private canOrbit() { return this.ready && !this.switching && !this.paused && !this.growthPaused && !this.talking && !this.story?.busy; }
  private orbitBy(dx: number, dy: number) {
    const view = orbitCamera({ yaw: this.yaw, pitch: this.pitch }, dx, dy);
    this.yaw = view.yaw; this.pitch = view.pitch; this.syncOrbitControl();
  }
  private syncOrbitControl() {
    const height = (this.pitch - MIN_CAMERA_PITCH) / (MAX_CAMERA_PITCH - MIN_CAMERA_PITCH);
    this.orbitControl.style.setProperty('--orbit-yaw', `${this.yaw}rad`);
    this.orbitIndicator.style.left = `${50 + Math.sin(this.yaw) * 27}%`;
    this.orbitIndicator.style.top = `${75 - height * 50}%`;
    this.orbitControl.setAttribute('aria-valuenow', String(Math.round(this.pitch * 180 / Math.PI)));
    setLabel(this.orbitControl, 'aria-valuetext', f(bi('高度角 {0}°，水平角 {1}°', 'Elevation {0}°, azimuth {1}°'), Math.round(this.pitch * 180 / Math.PI), Math.round(this.yaw * 180 / Math.PI)));
  }
  private releaseOrbit() {
    const drag = this.pointer; this.pointer = undefined;
    if (drag?.surface.hasPointerCapture(drag.id)) drag.surface.releasePointerCapture(drag.id);
    this.orbitControl.classList.remove('is-dragging');
  }
  private bindInput() {
    const signal = this.listener.signal, canvas = this.renderer.domElement;
    window.addEventListener('resize', () => this.resize(), { signal });
    window.addEventListener('keydown', event => {
      if (!this.ready || this.switching) return;
      if (event.code === 'Escape') { event.preventDefault(); if (this.story?.ui.growthOpen && !this.paused) { this.story.ui.closeGrowth(); return; } if (this.paused) this.closeSettings(); else if (this.talking && !this.story) this.endDialogue(); else this.openSettings(); return; }
      if (this.paused || this.growthPaused || event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      // A focused choice already has native Enter/Space activation. Never advance it twice.
      if (['Space', 'Enter'].includes(event.code) && (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)) return;
      if (this.story?.busy) { if (!event.repeat && this.story.key(event.key.toLowerCase(), true)) event.preventDefault(); return; }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE'].includes(event.code)) event.preventDefault();
      if (this.talking) { if (event.code === 'Space' && !event.repeat && this.dialogueStep !== 1) this.advanceDialogue(); return; }
      if (event.code === 'KeyE' && !event.repeat) { this.interact(); return; }
      if (event.code === 'KeyR') { Object.assign(this, this.definition.camera); this.syncOrbitControl(); }
      this.keys.add(event.code);
    }, { signal });
    window.addEventListener('keyup', event => { this.keys.delete(event.code); this.story?.key(event.key.toLowerCase(), false); }, { signal });
    window.addEventListener('game-pause', () => this.openSettings(), { signal });
    const pauseOnLeave = () => { if (this.openingPending) return; if (this.switching || !this.ready) this.pauseAfterTransition = true; else if (!this.paused) this.openSettings(); };
    window.addEventListener('blur', pauseOnLeave, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); }, { signal });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    canvas.addEventListener('pointerdown', event => {
      if (!this.canOrbit()) return;
      canvas.focus({ preventScroll: true });
      if (event.button === 2) { this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId, surface: canvas }; canvas.setPointerCapture(event.pointerId); }
      else if (event.button === 0) {
        this.setRay(event.clientX, event.clientY);
        const storyNpc = this.story?.pick(this.ray);
        if (storyNpc) this.visitPoint(storyNpc);
        else if (this.burr.root.visible && this.ray.intersectObject(this.burr.body).length) this.visitBurr();
        else { const hit = this.ray.ray.intersectPlane(this.ground, new THREE.Vector3()); if (hit) this.travel({ x: hit.x, z: hit.z }); }
      }
    }, { signal });
    const moveOrbit = (event: PointerEvent) => {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      if (!this.canOrbit()) { this.releaseOrbit(); return; }
      this.orbitBy(event.clientX - this.pointer.x, event.clientY - this.pointer.y);
      this.pointer.x = event.clientX; this.pointer.y = event.clientY;
    };
    const release = (event: PointerEvent) => { if (this.pointer?.id === event.pointerId) this.releaseOrbit(); };
    const orbitSurfaces: HTMLElement[] = [canvas, this.orbitControl];
    for (const surface of orbitSurfaces) {
      surface.addEventListener('pointermove', moveOrbit, { signal });
      surface.addEventListener('pointerup', release, { signal }); surface.addEventListener('pointercancel', release, { signal }); surface.addEventListener('lostpointercapture', release, { signal });
    }
    this.orbitControl.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      if (!this.canOrbit() || event.button !== 0) return;
      this.releaseOrbit(); this.orbitControl.focus({ preventScroll: true });
      this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId, surface: this.orbitControl };
      this.orbitControl.setPointerCapture(event.pointerId); this.orbitControl.classList.add('is-dragging');
    }, { signal });
    this.orbitControl.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); }, { signal });
    this.orbitControl.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.orbitControl.addEventListener('keydown', event => {
      const directions: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
      const delta = directions[event.code];
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      if (this.canOrbit()) this.orbitBy(delta[0], delta[1]);
    }, { signal });
    const advanceExploration = (event: MouseEvent) => {
      if (!this.talking || this.story || this.paused || event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return;
      if (this.dialogueStep !== 1) this.advanceDialogue();
    };
    canvas.addEventListener('click', advanceExploration, { signal }); this.dialogue.addEventListener('click', advanceExploration, { signal });
    canvas.addEventListener('wheel', event => { event.preventDefault(); if (this.ready && !this.paused) this.radius = THREE.MathUtils.clamp(this.radius + event.deltaY * .015, this.definition.camera.min, this.definition.camera.max); }, { passive: false, signal });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.stop(); this.showError(); }, { signal });
    window.addEventListener('pagehide', () => this.dispose(), { once: true, signal });
    // BFCache restores this same DOM after pagehide has released its WebGL state.
    window.addEventListener('pageshow', event => { if (event.persisted && this.disposed) location.reload(); });
  }
  private setRay(x: number, y: number) { const r = this.renderer.domElement.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), this.camera); }
  private travel(point: Point) {
    this.approachBurr = false; this.approached = undefined; this.walker.travel(point);
    const end = this.walker.path.at(-1); this.trail.visible = !!end;
    if (end) this.trail.position.set(end.x, .012, end.z);
    else this.showToast(bi('这里暂时走不过去，试试旁边的通道。', 'That spot is out of reach. Try the path nearby.'));
  }
  private visitBurr() {
    if (!this.ready || this.switching || this.definition.id !== 'street' || this.paused || this.talking) return;
    if (this.distance(BURR) < 2.3) this.interact();
    else { this.travel({ x: BURR.x + .8, z: BURR.z + 1.2 }); this.approachBurr = this.walker.path.length > 0; }
  }
  private distance(point: Point) { return Math.hypot(this.walker.position.x - point.x, this.walker.position.z - point.z); }
  private interact() {
    if (this.paused || !this.ready || this.switching) return;
    if (this.talking) { if (this.inspecting) this.endDialogue(); else if (this.dialogueStep !== 1) this.advanceDialogue(); return; }
    const nearby = this.nearbyPoint(); if (nearby) { this.activatePoint(nearby); return; }
    if (this.story) return;
    if (this.definition.id !== 'street' || this.distance(BURR) > 2.3) return;
    this.stop(); this.talking = true; this.dialogueStep = this.spoken ? 3 : 0; this.dialogueBranch = 0; this.renderDialogue();
  }
  private renderDialogue() {
    setLabel(this.dialogue, 'aria-label', bi('与伯尔的对话', 'Conversation with Burr'));
    this.dialogue.hidden = false; this.prompt.hidden = true; this.dialogue.replaceChildren();
    const speaker = el('div', 'd3-speaker'); speaker.append(el('span', 'd3-kicker', bi('街口相遇', 'AT THE CROSSROADS')), el('h2', '', bi('阿伦·伯尔', 'Aaron Burr')));
    const lines = [
      bi('刚下船？纽约的路比地图上窄，机会倒比地图上多。你在找谁？', 'Fresh off the boat? New York has narrower streets than its maps suggest—and more opportunities. Who are you looking for?'),
      bi('每个来到这里的年轻人，都觉得自己有话要说。你呢？', 'Every young man who arrives here thinks he has something to say. And you?'),
      this.dialogueBranch === 1 ? bi('那就先看看人们为什么停下来听。酒馆就在那边。走近一点，你会听到这座城真正关心的事。', 'Then notice what makes people stop and listen. The tavern is over there. Walk closer, and you will hear what this city really cares about.') : bi('水岸是个好起点。船带来消息，人把消息变成立场。先走一圈，再决定你想站在哪一边。', 'The waterfront is a good place to begin. Ships bring news; people turn news into convictions. Walk around before you choose a side.'),
      bi('不必急着回答。街道一直在这里。去看看酒馆和水岸，再回来也不迟。', 'There is no need to answer yet. The streets will still be here. Visit the tavern and the waterfront; you can always return.'),
    ];
    const content = el('div', 'd3-dialogue-content'), line = el('p', 'd3-line');
    setDialogueText(line, lines[this.dialogueStep]); content.append(line);
    const choices = el('div', 'd3-choices');
    if (this.dialogueStep === 1) {
      choices.append(button(bi('我想让这座城听见我。', 'I want this city to hear me.'), 'd3-choice', () => { this.dialogueBranch = 1; this.advanceDialogue(); }), button(bi('先带我认识这座城。', 'First, let me get to know it.'), 'd3-choice', () => { this.dialogueBranch = 2; this.advanceDialogue(); }));
      content.append(choices);
    }
    this.dialogue.append(speaker, content, button(bi('收起对话 ×', 'Close conversation ×'), 'd3-close-dialogue', () => this.endDialogue()));
    this.dialogue.tabIndex = -1; this.dialogue.focus({ preventScroll: true });
  }
  private advanceDialogue() { if (this.inspecting || this.dialogueStep >= 2) this.endDialogue(); else { this.dialogueStep++; this.renderDialogue(); } }
  private endDialogue() {
    if (!this.inspecting && this.definition.id === 'street') { this.spoken = true; this.markDiscovered(0); }
    this.inspecting = undefined; this.talking = false; this.dialogue.hidden = true; this.renderer.domElement.focus({ preventScroll: true });
  }
  private markDiscovered(index: number) {
    if (index < 0 || this.discoveries.has(index)) return;
    this.discoveries.add(index);
    this.showToast(f(bi('发现：{0}', 'Discovered: {0}'), this.definition.points[index].title)); this.updateObjective();
  }
  private showToast(text: Text) { setText(this.toast, text); this.toastUntil = this.clock + 5; this.toast.classList.add('visible'); }
  private tick(time: number) {
    this.orbitControl.disabled = !this.canOrbit();
    if (!this.ready) return;
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, .05) : 0; this.lastTime = time;
    if (!this.paused && !this.growthPaused && !this.switching) {
      this.clock += dt;
      this.story?.update(dt * 1000, this.walker.position, this.yaw);
      if (this.switching || !this.ready) return;
      if (!this.talking && !this.story?.busy) {
        const right = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
        const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
        if (right || forward) { this.approachBurr = false; this.approached = undefined; }
        this.walker.tick({ x: right * Math.cos(this.yaw) - forward * Math.sin(this.yaw), z: -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw) }, dt, this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
        if (this.approachBurr && this.distance(BURR) < 1.9) this.interact();
        if (this.approached && this.distance(this.approached.position) < .45) this.activatePoint(this.approached);
        if (this.switching) return;
        if (!this.story && this.definition.id === 'street') {
          if (this.distance(this.definition.points[1].position) < 2.5) this.markDiscovered(1);
          if (this.distance(this.definition.points[2].position) < 2.5) this.markDiscovered(2);
        }
      }
      this.world.update(this.clock, this.reduceMotion, this.yaw);
      this.cameraTarget.lerp(new THREE.Vector3(this.walker.position.x, .7, this.walker.position.z - 1), this.reduceMotion ? 1 : 1 - Math.exp(-dt * 4));
    }
    this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.radius));
    this.camera.lookAt(this.cameraTarget); this.camera.updateMatrixWorld();
    this.player.update(this.walker.position, this.walker.direction, this.walker.distance, this.walker.moving && !this.paused && !this.talking && !this.story?.busy, this.yaw, false);
    if (this.burr.root.visible) {
      if (!this.paused && this.distance(BURR) < 5) this.burrDirection = { x: this.walker.position.x - BURR.x, z: this.walker.position.z - BURR.z };
      this.burr.update(BURR, this.burrDirection, 0, false, this.yaw, true);
    }
    this.scene.updateMatrixWorld(); this.occlusion.update(this.camera, this.player.root.position, dt, this.reduceMotion);
    this.playerRing.position.set(this.walker.position.x, .012, this.walker.position.z);
    if (!this.walker.path.length) this.trail.visible = false;
    const nearby = this.nearbyPoint(), nearBurr = !this.story && this.definition.id === 'street' && this.distance(BURR) < 2.3;
    this.prompt.dataset.guided = String(!!this.story && !!nearby && 'exit' in nearby && nearby.exit && 'enabled' in nearby && nearby.enabled);
    this.prompt.hidden = this.switching || this.paused || this.talking || !!this.story?.busy || (!nearby && !nearBurr);
    const promptId = `${nearby?.id ?? 'burr'}:${nearby && 'enabled' in nearby ? nearby.enabled : true}`;
    if (!this.prompt.hidden && this.prompt.dataset.target !== promptId) {
      this.prompt.dataset.target = promptId;
      setText(this.prompt, nearby ? f('enabled' in nearby && !nearby.enabled ? bi('尚未解锁 · {0}', 'Not yet available · {0}') : bi('E  {0}', 'E  {0}'), nearby.title) : bi('E  与伯尔交谈', 'E  Talk to Burr'));
    }
    if (this.clock > this.toastUntil) this.toast.classList.remove('visible');
    this.placeLabel(); this.placeMarkers();
    this.renderer.info.reset();
    if (this.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.focusRenderer.render(this.renderer, this.scene, this.camera, this.player.root.position.clone().add(new THREE.Vector3(0, .8, 0)));
    if (this.renderer.domElement.dataset.frameReady !== 'true') this.renderer.domElement.dataset.frameReady = 'true';
    if (this.frame++ % 5 === 0) {
      const data = this.renderer.domElement.dataset;
      data.x = this.walker.position.x.toFixed(3); data.z = this.walker.position.z.toFixed(3); data.frame = String(this.player.frame);
      data.facing = this.player.facing; data.flipped = String(this.player.body.scale.x < 0); data.burrFacing = this.burr.facing; data.burrFrame = String(this.burr.frame); data.burrFlipped = String(this.burr.body.scale.x < 0);
      data.moving = String(this.walker.moving); data.paused = String(this.paused || this.growthPaused); data.talking = String(this.talking || !!this.story?.ui.dialogueOpen); data.path = String(this.walker.path.length); data.discovered = String(this.discoveries.size); data.quality = this.quality; data.yaw = this.yaw.toFixed(3); data.pitch = this.pitch.toFixed(3); data.radius = this.radius.toFixed(3); data.cutaways = String(this.occlusion.count);
      data.calls = String(this.renderer.info.render.calls); data.triangles = String(this.renderer.info.render.triangles);
      data.geometries = String(this.renderer.info.memory.geometries); data.textures = String(this.renderer.info.memory.textures);
    }
  }
  private placeLabel() {
    if (this.story || this.definition.id !== 'street' || this.switching) { this.npcLabel.hidden = true; return; }
    if (this.frame % 10 === 0) {
      const head = new THREE.Vector3(BURR.x, 1.7, BURR.z);
      this.ray.set(this.camera.position, head.clone().sub(this.camera.position).normalize());
      this.ray.far = this.camera.position.distanceTo(head) - .6;
      this.npcOccluded = this.ray.intersectObjects(this.world.occluders, true).length > 0;
      this.ray.far = Infinity;
    }
    const projected = new THREE.Vector3(BURR.x, 2.6, BURR.z).project(this.camera);
    const hide = this.npcOccluded || this.talking || this.paused || projected.z > 1 || Math.abs(projected.x) > .92 || Math.abs(projected.y) > .78 || this.distance(BURR) > 13;
    this.npcLabel.hidden = hide;
    if (!hide) { this.npcLabel.style.left = `${(projected.x + 1) * .5 * this.app.clientWidth}px`; this.npcLabel.style.top = `${(1 - projected.y) * .5 * this.app.clientHeight}px`; }
  }
  private placeMarkers() {
    const width = this.app.clientWidth, height = this.app.clientHeight, appRect = this.app.getBoundingClientRect();
    const candidates: { node: HTMLButtonElement; label: Omit<MarkerLabel, 'width' | 'height'> }[] = [];
    for (const { node, point } of this.markerLabels) {
      const projected = new THREE.Vector3(point.position.x, .8, point.position.z).project(this.camera);
      const x = (projected.x + 1) * .5 * width, y = (1 - projected.y) * .5 * height;
      const distance = this.distance(point.position);
      const hide = this.switching || this.paused || this.talking || !!this.story?.busy || projected.z > 1 || Math.abs(projected.x) > .86 || projected.y > .4 || projected.y < -.52 || distance > 11 || distance < 1.65;
      node.hidden = hide;
      if (!hide) candidates.push({ node, label: { id: point.id, x, y,
        priority: ('discovery' in point && point.discovery) || ('pickup' in point && point.pickup) ? 2 : 'smallTalk' in point && point.smallTalk ? 3 : node.dataset.enabled === 'true' ? 0 : 1 } });
    }
    if (!candidates.length) return;
    const blockers: LabelRect[] = [...this.app.querySelectorAll<HTMLElement>('.d3-heading, .d3-actions, .s3-hud, .s3-inventory:not([hidden]), .s3-tutorial:not([hidden]), .d3-camera-orbit, .d3-controls, .d3-interact:not([hidden]), .d3-toast.visible')]
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => ({ left: rect.left - appRect.left, top: rect.top - appRect.top, width: rect.width, height: rect.height }));
    // Read current dimensions together so translations remain correct after language/viewport changes.
    const labels = candidates.map(({ node, label }) => ({ ...label, width: node.offsetWidth, height: node.offsetHeight }));
    const placements = layoutMarkerLabels(labels, { left: 12, top: 12, width: width - 24, height: height - 24 }, blockers);
    for (const { node, label } of candidates) {
      const position = placements.get(label.id);
      node.hidden = !position;
      if (position) { node.style.left = `${position.x}px`; node.style.top = `${position.y}px`; }
    }
  }
  private dispose() {
    music.stop();
    voiceover.stop();
    this.disposed = true; this.ready = false; this.listener.abort(); this.renderer?.setAnimationLoop(null); this.focusRenderer?.dispose();
    this.story?.destroy(); this.occlusion?.dispose(); disposeWorld(this.scene); this.renderer?.dispose();
  }
}

export function startDemo(options: StartupOptions = {}) { return new StreetDemo(options).start(); }
