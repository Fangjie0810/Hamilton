import * as THREE from 'three';
import { bi, f, type Text } from '../i18n/text';
import { chapterOrder } from '../data/chapters';
import type { CharacterId, DialogueLine } from '../data/types';
import { PixelActor } from '../demo3d/PixelActor';
import { isOpaqueSpriteHit } from '../demo3d/SpriteHit';
import type { Point, WalkMap } from '../demo3d/Navigation';
import type { ScenePoint } from '../demo3d/SceneCatalog';
import { saveResult } from '../systems/StateSystem';
import { StoryProgress } from './StoryProgress';
import { STORY_PLACES, DISCOVERY_PLACES, DISCOVERY_PROPS, NEWSPAPER_PICKUP_PLACE, type CastPlacement } from './StoryPlaces';
import { storyMarkerTargets } from './StoryMarkers';
import { loadStoryNpcAtlas, StoryNpc } from './StoryNpc';
import { StoryUI } from './StoryUI';
import { music } from '../ui/music';
import { characters } from '../data/characters';
import { discoveries, discoveryAvailable, resolveDiscovery } from '../data/discoveries';
import { DiscoverySession } from './Discoveries';
import { smallTalkLine, type SmallTalkCharacter } from '../data/smallTalk';
import { collectNewspaper, inventoryItems, newspaperCollected, newspaperItem, newspaperReturned, type InventoryItemId } from '../data/inventory';
import { canSmallTalk, characterInteractions, smallTalkPosition } from './SmallTalk';
import { preloadDialoguePortraits } from '../ui/DialoguePortraits';

export interface StoryTarget extends ScenePoint { enabled: boolean; complete: boolean; exit: boolean; smallTalk?: SmallTalkCharacter; discovery?: string; pickup?: InventoryItemId; propPosition?: Point; propHeight?: number; hideProp?: boolean; optionalComplete?: boolean; optionalReadOnly?: boolean; reaction?: boolean }
export interface StoryHost {
  app: HTMLElement; atlas: THREE.Texture; highAtlas?: THREE.Texture;
  blocked(): boolean;
  loadChapter(): Promise<void>;
  root(): THREE.Group;
  map(): WalkMap;
  position(): Point;
  stop(): void;
  markers(): void;
  focus(): void;
  toast(text: Text): void;
  fail(error: unknown): void;
  title(): void;
  growthPause?(open: boolean): void;
}

/** Connects the existing narrative rules to physical places, without owning rendering or input. */
export class StoryDirector {
  readonly progress = new StoryProgress();
  readonly ui: StoryUI;
  readonly discoveries = new DiscoverySession(this.progress.state);
  loading = true;
  private npcAtlas!: HTMLCanvasElement;
  private highNpcAtlas!: HTMLCanvasElement;
  private cast: { placement: CastPlacement; actor: StoryNpc | PixelActor; direction: Point; talkPosition?: Point }[] = [];
  private talkingAgain?: SmallTalkCharacter;
  private engagedInteractions = new Set<string>();
  private shownRevision = -1;
  private generation = 0;
  private disposed = false;

  constructor(private host: StoryHost) { this.ui = new StoryUI(host.app, () => this.disposed || this.loading || host.blocked()); this.ui.onGrowthOpenChange = open => { this.host.stop(); this.host.growthPause?.(open); }; }
  get place() { return STORY_PLACES[this.progress.chapter.id]; }
  get busy() { return this.loading || this.ui.growthOpen || this.discoveries.busy || !!this.talkingAgain || !['explore', 'exit'].includes(this.progress.phase); }
  get targets(): StoryTarget[] {
    const chapter = this.progress.chapter;
    return [...chapter.interactions.map(interaction => ({
      id: interaction.id, position: this.place.interactions[interaction.id], title: interaction.label, body: interaction.lines[0].text,
      enabled: this.progress.canBegin(interaction.id),
      complete: this.progress.isComplete(interaction.id), exit: false,
    })), { id: 'story-exit', position: this.place.exit, title: chapter.exitLabel, body: chapter.objective, enabled: this.progress.phase === 'exit', complete: false, exit: true }];
  }
  get target() { return this.targets.find(target => target.enabled); }
  get repeatTargets(): StoryTarget[] {
    return this.cast.flatMap(({ placement, talkPosition }) => {
      if (!talkPosition || !canSmallTalk(this.progress.chapter, placement, this.progress.completedInteractions)) return [];
      if (this.deliveryTarget(placement.id)) return [];
      return [{ id: `smalltalk-${placement.id}`, position: talkPosition,
        title: f(bi('闲聊 · {0}', 'Chat · {0}'), characters[placement.id].name), body: smallTalkLine(placement.id, this.progress.state.state).text,
        enabled: true, complete: false, exit: false, smallTalk: placement.id }];
    });
  }
  private deliveryTarget(character: CharacterId): StoryTarget | undefined {
    return this.discoveryTargets.find(target => discoveries.some(def => def.id === target.discovery && def.requiresItem && def.character === character));
  }
  get discoveryTargets(): StoryTarget[] {
    const p = this.progress, state = p.state.state;
    return discoveries.filter(d => d.chapter === p.chapter.id && discoveryAvailable(d, state, p.completedInteractions)).map(d => {
      const content = resolveDiscovery(d, state, p.completedInteractions, [...this.engagedInteractions]);
      const prop = DISCOVERY_PROPS[d.id];
      return { id: `discovery:${d.id}`, position: DISCOVERY_PLACES[d.id], title: !content.active && !content.completed ? f(bi('{0} · 仅查看', '{0} · Read only'), d.label) : d.label, body: content.lines[0]?.text ?? d.label,
        propPosition: prop?.position, propHeight: prop?.height, hideProp: !!d.requiresItem,
        enabled: true, complete: false, exit: false, discovery: d.id, optionalComplete: content.completed, optionalReadOnly: !content.active, reaction: d.marker === 'reaction' };
    });
  }
  get pickupTargets(): StoryTarget[] {
    const state = this.progress.state.state;
    if (this.progress.chapter.id !== 'Arrival' || newspaperCollected(state) || newspaperReturned(state)) return [];
    return [{ id: 'pickup:scattered-newspaper', position: NEWSPAPER_PICKUP_PLACE,
      title: bi('拾取被风吹落的报纸', 'Pick Up the Windblown Pages'), body: newspaperItem.description,
      enabled: true, complete: false, exit: false, pickup: newspaperItem.id }];
  }
  get markerTargets() { return [...storyMarkerTargets(this.targets), ...this.pickupTargets, ...this.discoveryTargets, ...this.repeatTargets]; }
  pick(ray: THREE.Raycaster): StoryTarget | undefined {
    const hits = this.cast.flatMap(entry => ray.intersectObject(entry.actor.body)
      .filter(hit => isOpaqueSpriteHit(hit, entry.actor.texture, entry.actor.body.material.alphaTest))
      .map(hit => ({ distance: hit.distance, placement: entry.placement })));
    hits.sort((a, b) => a.distance - b.distance);
    const hit = hits[0];
    const paper = ray.intersectObjects(this.host.root().children, true).find(entry => entry.object.userData.discoveryTarget);
    if (paper && (!hit || paper.distance < hit.distance)) return this.markerTargets.find(target => target.id === paper.object.userData.discoveryTarget);
    if (!hit) return;
    const interaction = characterInteractions(this.progress.chapter, hit.placement).find(item => !this.progress.isComplete(item.id));
    return interaction ? this.markerTargets.find(target => target.id === interaction.id)
      : this.deliveryTarget(hit.placement.id) ?? this.repeatTargets.find(target => target.smallTalk === hit.placement.id);
  }
  get objective(): Text {
    if (this.progress.chapter.interactionOrder === 'free' && this.progress.phase !== 'exit')
      return f(bi('已交谈 {0} / {1} · 自由选择下一位同伴', 'Spoken to {0} / {1} · Choose any remaining companion'), this.progress.completedInteractions.length, this.progress.chapter.interactions.length);
    if (this.progress.chapter.id === 'Opening' && this.progress.phase === 'exit')
      return bi('序幕完成 · 点击黄色入口，踏上纽约街头。', 'Prologue complete · Click the yellow marker to step into New York.');
    const next = this.progress.interaction;
    return next ? f(bi('{0} / {1} · {2}', '{0} / {1} · {2}'), this.progress.interactionIndex + 1, this.progress.chapter.interactions.length, next.label)
      : f(bi('本幕完成 · {0}', 'Chapter complete · {0}'), this.progress.chapter.exitLabel);
  }
  async start() {
    const [atlas, highAtlas] = await Promise.all([loadStoryNpcAtlas(), loadStoryNpcAtlas(true), preloadDialoguePortraits()]);
    this.npcAtlas = atlas; this.highNpcAtlas = highAtlas;
    if (!this.disposed) await this.enterChapter();
  }
  async restart() {
    if (this.loading || this.progress.phase === 'ending') return;
    this.generation++; this.ui.clear(); this.host.stop(); this.progress.restart(); await this.enterChapter();
  }
  private async newRun() { if (this.loading) return; this.generation++; this.ui.clear(); this.ui.resetGrowthGuide(); this.progress.reset(); await this.enterChapter(); }
  private async enterChapter() {
    this.talkingAgain = undefined; this.discoveries.abort(); this.engagedInteractions.clear();
    this.loading = true; this.generation++; this.host.stop(); this.ui.clear(true); this.cast = [];
    try {
      await this.host.loadChapter();
      if (this.disposed) return;
      this.addCast(); this.loading = false;
      this.ui.showChapter(this.progress.chapter, chapterOrder.indexOf(this.progress.chapter.id), this.progress.state.state);
      this.shownRevision = -1; this.sync(); this.host.focus();
      if (this.progress.chapter.id === 'Opening') this.ui.showTutorial('movement');
      this.ui.setGrowthContext(this.progress.chapter, this.progress.state.state, new Set(this.progress.completedInteractions));
    } catch (error) { if (!this.disposed) this.host.fail(error); }
  }
  private addCast() {
    const root = this.host.root(), map = this.host.map();
    for (const placement of this.place.cast) {
      const actor = placement.id === 'burr' ? new PixelActor(this.host.atlas, true, this.host.highAtlas) : new StoryNpc(this.npcAtlas, placement.id, this.highNpcAtlas);
      root.add(actor.root);
      this.cast.push({ placement, actor, direction: placement.direction ?? { x: 0, z: 1 } });
      if (!placement.height) map.obstacles.push({ ...placement.position, width: .5, depth: .5 });
    }
    for (const entry of this.cast) {
      const last = characterInteractions(this.progress.chapter, entry.placement).at(-1);
      if (last) entry.talkPosition = smallTalkPosition(entry.placement, this.place.interactions[last.id], map);
    }
    if (this.progress.chapter.id === 'Opening') {
      const wood = new THREE.MeshLambertMaterial({ color: 0x8d6848 });
      const crate = new THREE.Mesh(new THREE.BoxGeometry(.6, .72, .65), wood); crate.position.set(16.2, .36, 5); crate.castShadow = crate.receiveShadow = true;
      const letter = new THREE.Mesh(new THREE.BoxGeometry(.46, .02, .36), new THREE.MeshLambertMaterial({ color: 0xf4dfae })); letter.position.set(16.2, .735, 5); letter.rotation.y = -.23;
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .015, 8), new THREE.MeshLambertMaterial({ color: 0x8b3d32 })); seal.position.set(16.2, .753, 5);
      root.add(crate, letter, seal); map.obstacles.push({ x: 16.2, z: 5, width: .6, depth: .65 });
    }
  }
  nearby(): StoryTarget | undefined {
    if (this.busy) return;
    const position = this.host.position();
    return this.markerTargets.filter(target => Math.hypot(target.position.x - position.x, target.position.z - position.z) < 1.65)
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || Number(!!a.smallTalk || !!a.discovery || !!a.pickup) - Number(!!b.smallTalk || !!b.discovery || !!b.pickup)
        || Math.hypot(a.position.x - position.x, a.position.z - position.z) - Math.hypot(b.position.x - position.x, b.position.z - position.z))[0];
  }
  interact(id: string) {
    if (this.disposed || this.host.blocked() || this.busy) return;
    const target = this.markerTargets.find(point => point.id === id), position = this.host.position();
    if (!target || Math.hypot(target.position.x - position.x, target.position.z - position.z) >= 1.65) return;
    if (!target.enabled) {
      this.host.toast(this.progress.chapter.interactionOrder === 'free'
        ? f(bi('先与三位同伴各谈一次 · 已完成 {0} / {1}', 'Speak to all three companions first · Completed {0} / {1}'), this.progress.completedInteractions.length, this.progress.chapter.interactions.length)
        : f(bi('先完成：{0}', 'First complete: {0}'), this.progress.interaction?.label ?? this.progress.chapter.exitLabel));
      return;
    }
    this.host.stop();
    if (target.pickup) {
      if (!collectNewspaper(this.progress.state)) return;
      this.ui.updateInventory(this.progress.state.state); this.host.markers();
      this.host.toast(bi('已拾取报纸', 'Newspaper picked up')); this.host.focus();
    } else if (target.discovery) {
      const definition = discoveries.find(d => d.id === target.discovery)!;
      if (this.discoveries.begin(definition, this.progress.completedInteractions, this.progress.phase, [...this.engagedInteractions])) this.syncDiscovery();
    } else if (target.smallTalk) {
      this.talkingAgain = target.smallTalk;
      this.ui.showLine(smallTalkLine(target.smallTalk, this.progress.state.state), () => {
        this.talkingAgain = undefined; this.ui.clearDialogue(); this.host.focus();
      }, true, undefined, 'hamilton');
    } else if (target.exit) {
      if (!this.progress.nextChapter()) return;
      if (this.progress.phase === 'ending') this.sync(); else void this.enterChapter();
    } else if (this.progress.begin(id)) {
      this.engagedInteractions.add(id); this.sync();
      if (id === 'opening-letter') this.ui.showTutorial('dialogue');
    }
  }
  private syncDiscovery(selected?: DialogueLine) {
    const session = this.discoveries;
    if (session.phase === 'dialogue' && session.line) {
      this.ui.showLine(session.line, () => { session.next(); this.syncDiscovery(); }, false, selected, session.dialoguePartner);
    } else if (session.phase === 'choice' && session.choice) {
      const choice = session.choice;
      this.ui.showChoice(choice, this.progress.state.state, option => {
        if (session.choose(choice.options.indexOf(option))) this.syncDiscovery({ speaker: 'hamilton', text: option.text });
      });
    } else {
      this.ui.clearDialogue(); this.ui.updateState(this.progress.state.state); this.ui.updateInventory(this.progress.state.state); this.ui.toast(session.lastChanges);
      this.ui.setGrowthContext(this.progress.chapter, this.progress.state.state, new Set(this.progress.completedInteractions));
      this.host.markers(); this.host.focus();
    }
  }
  key(key: string, down: boolean) { return this.ui.key(key, down); }
  release() { this.ui.release(); }
  update(delta: number, position: Point, yaw: number, pitch?: number) {
    this.ui.update(delta);
    if (!this.loading && !this.host.blocked()) {
      if (this.progress.tick(delta)) this.sync();
      if (this.progress.phase === 'choice') this.ui.updateChoiceTime(this.progress.remainingMs);
    }
    for (const entry of this.cast) {
      const { placement, actor } = entry;
      const argument = placement.argument;
      const partner = argument && !this.engagedInteractions.has(argument.interactionId)
        ? this.place.cast.find(other => other.id === argument.partnerId) : undefined;
      if (partner) entry.direction = { x: partner.position.x - placement.position.x, z: partner.position.z - placement.position.z };
      else if (!this.host.blocked() && Math.hypot(position.x - placement.position.x, position.z - placement.position.z) < 6)
        entry.direction = { x: position.x - placement.position.x, z: position.z - placement.position.z };
      if (actor instanceof PixelActor) actor.update(placement.position, entry.direction, 0, false, yaw, true, pitch);
      else actor.update(placement.position, entry.direction, yaw, { delta: delta / 1000, arguing: !!partner,
        paused: this.loading || this.host.blocked(), reducedMotion: this.ui.reduceMotion, phase: argument?.phase }, pitch);
      actor.root.position.y = placement.height ?? 0;
    }
  }
  private sync(selected?: DialogueLine) {
    const progress = this.progress;
    if (this.shownRevision === progress.revision || this.disposed) return;
    this.shownRevision = progress.revision;
    this.host.stop(); this.ui.updateState(progress.state.state); this.ui.updateInventory(progress.state.state); this.ui.toast(progress.lastChanges); this.ui.setObjective(this.objective);
    this.ui.setGrowthContext(progress.chapter, progress.state.state, new Set(progress.completedInteractions)); this.host.markers();
    if (progress.phase === 'exit') this.host.toast(this.objective);
    if (progress.phase === 'dialogue' && progress.currentLine) this.ui.showLine(progress.currentLine, () => { if (progress.next()) this.sync(); }, false, selected, progress.dialoguePartner);
    else if (progress.phase === 'choice' && progress.choice) {
      const choice = progress.choice;
      this.ui.showChoice(choice, progress.state.state, option => { if (progress.choose(choice.options.indexOf(option))) this.sync({ speaker: 'hamilton', text: option.text }); }, progress.chapter.id === 'Tavern' ? progress.remainingMs : undefined);
    } else if (progress.phase === 'activity' && progress.activity) {
      const kind = progress.activity, generation = this.generation;
      if (kind === 'debate') music.setDebate(true);
      this.ui.showActivity(kind, progress.state, result => {
        if (this.disposed || generation !== this.generation) return;
        if (kind === 'debate') music.setDebate(false);
        if (kind === 'debate' && 'history' in result) progress.completeActivity('debate', result);
        else if (kind === 'writing' && 'scores' in result) progress.completeActivity('writing', result);
        else if (kind === 'yorktown' && 'grades' in result) progress.completeActivity('yorktown', result);
        this.sync();
      });
    } else if (progress.phase === 'ending') {
      music.stop();
      try { saveResult(localStorage, progress.state.state); } catch { /* Completion also works without storage. */ }
      this.ui.showEnding(progress.state.state, () => { void this.newRun(); }, () => this.host.title());
    } else {
      this.ui.clearDialogue(); this.host.focus();
      if (progress.chapterId === 'Arrival' && progress.completedInteractions.includes('arrival-newspaper')) this.ui.showTutorial('camera');
      this.ui.showGrowthTutorial();
    }
  }
  debug() {
    const p = this.progress;
    return { chapter: p.chapterId, phase: p.phase, index: p.interactionIndex, remaining: p.remainingMs, state: p.state.state, completed: p.completedInteractions,
      discoveries: this.discoveryTargets, pickups: this.pickupTargets, inventory: inventoryItems(p.state.state), discovery: { id: this.discoveries.definition?.id, phase: this.discoveries.phase, choice: this.discoveries.choice }, growthOpen: this.ui.growthOpen, targets: this.targets, target: this.target, cast: this.place.cast, choice: p.choice, repeatTargets: this.repeatTargets, smallTalk: this.talkingAgain,
      castPoses: this.cast.map(({ placement, actor, direction }) => ({ id: placement.id, facing: actor.facing, frame: actor.frame, direction, highAngle: actor.highAngle, tilt: actor.body.rotation.x,
        arguing: !!placement.argument && !this.engagedInteractions.has(placement.argument.interactionId) })) };
  }
  destroy() { this.disposed = true; this.generation++; this.ui.destroy(); this.cast = []; }
}
