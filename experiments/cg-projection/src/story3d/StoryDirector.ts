import * as THREE from 'three';
import { bi, f, type Text } from '../i18n/text';
import { chapterOrder } from '../data/chapters';
import type { DialogueLine } from '../data/types';
import { PixelActor } from '../demo3d/PixelActor';
import type { Point, WalkMap } from '../demo3d/Navigation';
import type { ScenePoint } from '../demo3d/SceneCatalog';
import { saveResult } from '../systems/StateSystem';
import { StoryProgress } from './StoryProgress';
import { STORY_PLACES, type CastPlacement } from './StoryPlaces';
import { loadStoryNpcAtlas, StoryNpc } from './StoryNpc';
import { StoryUI } from './StoryUI';

export interface StoryTarget extends ScenePoint { enabled: boolean; complete: boolean; exit: boolean }
export interface StoryHost {
  app: HTMLElement; atlas: THREE.Texture;
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
}

/** Connects the existing narrative rules to physical places, without owning rendering or input. */
export class StoryDirector {
  readonly progress = new StoryProgress();
  readonly ui: StoryUI;
  loading = true;
  private npcAtlas!: HTMLCanvasElement;
  private cast: { placement: CastPlacement; actor: StoryNpc | PixelActor; direction: Point }[] = [];
  private shownRevision = -1;
  private generation = 0;
  private disposed = false;

  constructor(private host: StoryHost) { this.ui = new StoryUI(host.app, () => this.disposed || this.loading || host.blocked()); }
  get place() { return STORY_PLACES[this.progress.chapter.id]; }
  get busy() { return this.loading || !['explore', 'exit'].includes(this.progress.phase); }
  get targets(): StoryTarget[] {
    const chapter = this.progress.chapter;
    return [...chapter.interactions.map(interaction => ({
      id: interaction.id, position: this.place.interactions[interaction.id], title: interaction.label, body: interaction.lines[0].text,
      enabled: this.progress.canBegin(interaction.id),
      complete: this.progress.isComplete(interaction.id), exit: false,
    })), { id: 'story-exit', position: this.place.exit, title: chapter.exitLabel, body: chapter.objective, enabled: this.progress.phase === 'exit', complete: false, exit: true }];
  }
  get target() { return this.targets.find(target => target.enabled); }
  pick(ray: THREE.Raycaster): StoryTarget | undefined {
    const hits = this.cast.flatMap(entry => ray.intersectObject(entry.actor.body).map(hit => ({ distance: hit.distance, placement: entry.placement })));
    hits.sort((a, b) => a.distance - b.distance);
    const hit = hits[0]; if (!hit) return;
    const interaction = this.progress.chapter.interactions.find(item => !this.progress.isComplete(item.id)
      && (item.character === hit.placement.id || hit.placement.interactionIds?.includes(item.id)));
    return interaction ? this.targets.find(target => target.id === interaction.id) : undefined;
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
  async start() { this.npcAtlas = await loadStoryNpcAtlas(); if (!this.disposed) await this.enterChapter(); }
  async restart() {
    if (this.loading || this.progress.phase === 'ending') return;
    this.generation++; this.ui.clear(); this.host.stop(); this.progress.restart(); await this.enterChapter();
  }
  private async newRun() { if (this.loading) return; this.generation++; this.ui.clear(); this.progress.reset(); await this.enterChapter(); }
  private async enterChapter() {
    this.loading = true; this.generation++; this.host.stop(); this.ui.clear(); this.cast = [];
    try {
      await this.host.loadChapter();
      if (this.disposed) return;
      this.addCast(); this.loading = false;
      this.ui.showChapter(this.progress.chapter, chapterOrder.indexOf(this.progress.chapter.id), this.progress.state.state);
      this.shownRevision = -1; this.sync(); this.host.toast(this.progress.chapter.objective); this.host.focus();
    } catch (error) { if (!this.disposed) this.host.fail(error); }
  }
  private addCast() {
    const root = this.host.root(), map = this.host.map();
    for (const placement of this.place.cast) {
      const actor = placement.id === 'burr' ? new PixelActor(this.host.atlas, true) : new StoryNpc(this.npcAtlas, placement.id);
      root.add(actor.root);
      this.cast.push({ placement, actor, direction: placement.direction ?? { x: 0, z: 1 } });
      if (!placement.height) map.obstacles.push({ ...placement.position, width: .5, depth: .5 });
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
    return this.targets.filter(target => !target.complete && Math.hypot(target.position.x - position.x, target.position.z - position.z) < 1.65)
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || Math.hypot(a.position.x - position.x, a.position.z - position.z) - Math.hypot(b.position.x - position.x, b.position.z - position.z))[0];
  }
  interact(id: string) {
    if (this.disposed || this.host.blocked() || this.busy) return;
    const target = this.targets.find(point => point.id === id), position = this.host.position();
    if (!target || Math.hypot(target.position.x - position.x, target.position.z - position.z) >= 1.65) return;
    if (!target.enabled) {
      this.host.toast(this.progress.chapter.interactionOrder === 'free'
        ? f(bi('先与三位同伴各谈一次 · 已完成 {0} / {1}', 'Speak to all three companions first · Completed {0} / {1}'), this.progress.completedInteractions.length, this.progress.chapter.interactions.length)
        : f(bi('先完成：{0}', 'First complete: {0}'), this.progress.interaction?.label ?? this.progress.chapter.exitLabel));
      return;
    }
    this.host.stop();
    if (target.exit) {
      if (!this.progress.nextChapter()) return;
      if (this.progress.phase === 'ending') this.sync(); else void this.enterChapter();
    } else if (this.progress.begin(id)) this.sync();
  }
  key(key: string, down: boolean) { return this.ui.key(key, down); }
  release() { this.ui.release(); }
  update(delta: number, position: Point, yaw: number) {
    if (!this.loading && !this.host.blocked()) {
      this.ui.update(delta);
      if (this.progress.tick(delta)) this.sync();
      if (this.progress.phase === 'choice') this.ui.updateChoiceTime(this.progress.remainingMs);
    }
    for (const entry of this.cast) {
      const { placement, actor } = entry;
      if (!this.host.blocked() && Math.hypot(position.x - placement.position.x, position.z - placement.position.z) < 6)
        entry.direction = { x: position.x - placement.position.x, z: position.z - placement.position.z };
      if (actor instanceof PixelActor) actor.update(placement.position, entry.direction, 0, false, yaw, true);
      else actor.update(placement.position, entry.direction, yaw);
      actor.root.position.y = placement.height ?? 0;
    }
  }
  private sync(selected?: DialogueLine) {
    const progress = this.progress;
    if (this.shownRevision === progress.revision || this.disposed) return;
    this.shownRevision = progress.revision;
    this.host.stop(); this.ui.updateState(progress.state.state); this.ui.toast(progress.lastChanges); this.ui.setObjective(this.objective); this.host.markers();
    if (progress.phase === 'exit') this.host.toast(this.objective);
    if (progress.phase === 'dialogue' && progress.currentLine) this.ui.showLine(progress.currentLine, () => { if (progress.next()) this.sync(); }, false, selected);
    else if (progress.phase === 'choice' && progress.choice) {
      const choice = progress.choice;
      this.ui.showChoice(choice, progress.state.state, option => { if (progress.choose(choice.options.indexOf(option))) this.sync({ speaker: 'hamilton', text: option.text }); }, progress.chapter.id === 'Tavern' ? progress.remainingMs : undefined);
    } else if (progress.phase === 'activity' && progress.activity) {
      const kind = progress.activity, generation = this.generation;
      this.ui.showActivity(kind, progress.state, result => {
        if (this.disposed || generation !== this.generation) return;
        if (kind === 'debate' && 'history' in result) progress.completeActivity('debate', result);
        else if (kind === 'writing' && 'scores' in result) progress.completeActivity('writing', result);
        else if (kind === 'yorktown' && 'grades' in result) progress.completeActivity('yorktown', result);
        this.sync();
      });
    } else if (progress.phase === 'ending') {
      try { saveResult(localStorage, progress.state.state); } catch { /* Completion also works without storage. */ }
      this.ui.showEnding(progress.state.state, () => { void this.newRun(); }, () => { location.href = '/'; });
    } else { this.ui.clearDialogue(); this.host.focus(); }
  }
  debug() {
    const p = this.progress;
    return { chapter: p.chapterId, phase: p.phase, index: p.interactionIndex, remaining: p.remainingMs, state: p.state.state, completed: p.completedInteractions, targets: this.targets, target: this.target, cast: this.place.cast, choice: p.choice };
  }
  destroy() { this.disposed = true; this.generation++; this.ui.destroy(); this.cast = []; }
}
