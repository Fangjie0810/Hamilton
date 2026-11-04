import { setText, setLabel, getLanguage, setLanguage, onLanguageChange, primaryText, accessibleText } from '../i18n/text';
import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import { beatGradeNames } from '../data/labels';
import { YorktownSystem } from '../systems/YorktownSystem';
import { approachWidth, assaultCommands, covers, guards, orders, orderNames, squads } from '../data/yorktown';
import { ActivityPanel, action, el, beatTrack, updateBeat } from './Activity';

export class YorktownActivity extends ActivityPanel {
  private game = new YorktownSystem();
  private held = new Set<string>();
  private shown = '';
  constructor(blocked: () => boolean, private onComplete: (result: YorktownSystem) => void) { super(bi("约克镇 · 1781", "YORKTOWN \u00b7 1781"), blocked); this.refresh(); }
  release() { this.held.clear(); this.game.release(); }
  key(key: string, down: boolean) {
    if (!down) this.held.delete(key);
    if (this.blocked()) return;
    if (down) this.held.add(key);
    if (down && this.game.phase === 'approach' && key === 'e') this.game.toggleSquad();
    if (down && this.game.phase === 'assault') this.hit(key);
    this.refresh();
  }
  update(delta: number) {
    this.game.direction = Number(this.held.has('d') || this.held.has('arrowright')) - Number(this.held.has('a') || this.held.has('arrowleft'));
    this.game.crouched = this.held.has('control');
    if (this.game.phase !== 'assault' || !this.reading) this.game.tick(delta); if (this.game.phase === 'assault') this.cue(String(this.game.commandIndex), this.game.elapsed); this.refresh();
  }
  private hit(key: string) {
    if (![' ', 'a', 'd', 's'].includes(key)) return;
    if (this.reading && this.game.phase === 'assault') { this.stopSpeech(); return; }
    this.game.hit(key);
  }
  private holdButton(text: Text, key: string) {
    const node = action(text, () => {}, 'secondary hold-control');
    node.addEventListener('pointerdown', event => { if (this.blocked()) return; node.setPointerCapture(event.pointerId); this.held.add(key); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(event, () => this.held.delete(key));
    return node;
  }
  private refresh() {
    const g = this.game;
    this.root.dataset.activity = 'yorktown'; this.root.dataset.phase = g.phase; this.root.dataset.round = String(g.commandIndex); this.root.dataset.commandKey = g.command.key;
    this.root.dataset.x = String(Math.round(g.x)); this.root.dataset.squadX = String(Math.round(g.squadX));
    if (this.shown !== `${g.phase}:${g.commandIndex}`) {
      this.shown = `${g.phase}:${g.commandIndex}`;
      if (g.phase === 'briefing') this.render(el('p', 'eyebrow gold', bi("01 / 接近", "01 / APPROACH")), el('h2', '', bi("带所有人抵达攻击位置。", "Bring everyone to the attack position.")), el('p', '', bi("前方有三处哨岗。观察扇形视野，等守卫转身；按住 CTRL 蹲在土丘后可隐蔽。E 让士兵待命或跟随。", "Three sentry posts lie ahead. Watch their cones of vision and wait for the guards to turn. Hold CTRL to crouch behind the earthworks. E orders the troops to hold or follow.")), el('p', 'activity-instructions', bi("A / D 或方向键移动 · CTRL 蹲伏 · E 指挥士兵。鼠标可按住下方按钮。每处哨岗发现你或士兵，只扣一次突袭优势，不会结束任务。抵达最右侧时，士兵也必须到位。", "A / D or arrows move · CTRL crouches · E commands the troops. You can also hold the buttons below. Each post deducts surprise only once if it spots you or your troops. Reach the far right with the whole squad to continue.")), action(bi("出发 →", "Set Out →"), () => { g.begin(); this.refresh(); }, 'primary'));
      else if (g.phase === 'approach') {
        const field = el('div', 'approach-field');
        covers.forEach(x => { const cover = el('div', 'approach-cover', bi("掩体", "Cover")); cover.style.left = `${x / approachWidth * 100}%`; field.append(cover); });
        guards.forEach((x, i) => {
          const cone = el('div', 'guard-cone'); cone.dataset.guard = String(i); cone.style.left = `${x / approachWidth * 100}%`;
          const guard = el('span', 'guard-dot', bi("哨", "Guard")); guard.style.left = `${x / approachWidth * 100}%`; field.append(cone, guard);
        });
        field.append(el('span', 'approach-squad', bi("队", "Squad")), el('span', 'approach-player', 'H'), el('span', 'approach-goal', bi("集结 →", "Rally →")));
        const controls = el('div', 'activity-controls');
        controls.append(this.holdButton('← A', 'a'), this.holdButton('D →', 'd'), this.holdButton(bi("按住蹲伏 · CTRL", "Hold to Crouch · CTRL"), 'control'), action(bi("士兵待命 / 跟随 · E", "Troops Hold / Follow · E"), () => g.toggleSquad()));
        this.render(el('h2', '', bi("接近十号堡垒", "Approach Redoubt No. 10")), el('p', 'approach-status'), field, controls, el('p', 'muted', bi("扇形表示守卫视野。蹲伏只有在掩体附近才隐蔽。抵达后等待全队集结。", "The cones show the guards' view. Crouching hides you only near cover. Wait for all your troops at the rally point.")));
      } else if (g.phase === 'command') {
        const map = el('div', 'tactical-map');
        map.append(el('div', 'redoubt', bi("十号堡垒 · 守军面向正面", "Redoubt No. 10 · Defenders face forward")));
        squads.forEach((squad, i) => { const marker = el('div', 'squad-marker', cat`${i + 1} · ${squad.name}`); marker.style.left = `${squad.x}%`; marker.style.top = `${squad.y}%`; marker.dataset.squad = String(i); map.append(marker); });
        const rows = el('div', 'order-rows');
        squads.forEach((squad, i) => {
          const row = el('div', 'order-row'); row.append(el('strong', '', squad.name), el('span', 'muted', squad.hint));
          const group = el('div', 'order-buttons');
          orders.forEach(order => { const pick = action(orderNames[order], () => { g.order(i, order); this.refresh(); }); pick.dataset.order = order; pick.dataset.squad = String(i); group.append(pick); });
          row.append(group); rows.append(row);
        });
        const deploy = action(bi("确认三队部署 →", "Confirm All Three Orders →"), () => { g.deploy(); this.refresh(); }, 'primary deploy-button');
        this.render(el('p', 'eyebrow gold', bi("02 / 指挥", "02 / COMMAND")), el('h2', '', bi("让每一队知道自己的职责。", "Make sure every squad knows its role.")), el('p', '', f(bi("警戒 {0} · 敌军士气 {1} · 正面固守", "Alert {0} · Enemy Morale {1} · Holding the front"), g.alert, g.morale)), map, rows, deploy);
      } else if (g.phase === 'assault-ready') {
        this.render(el('p', 'eyebrow gold', bi("03 / 突击", "03 / ASSAULT")), el('h2', '', bi("命令现在交到你的手上。", "The commands are in your hands now.")), el('p', '', f(bi("部署配合 {0} / 100 · 敌军士气 {1} · 警戒 {2}", "Coordination {0} / 100 · Enemy Morale {1} · Alert {2}"), g.tactics, g.morale.toFixed(0), g.alert)), el('p', '', g.position), el('p', 'activity-instructions', bi("12 道命令依次出现。在金线附近按正确的键：SPACE 推进、A 左翼、D 右翼、S 待命。也可以点击对应按钮。每道命令只接受第一次输入，失误仍继续。", "Twelve commands appear in sequence. Press the correct key near the gold line: SPACE to advance, A for left flank, D for right flank, S to hold. You can also click the buttons. Only the first input counts; mistakes do not stop the assault.")), action(bi("开始突击 →", "Begin the Assault →"), () => { g.assault(); this.release(); this.refresh(); }, 'primary'));
      } else if (g.phase === 'assault' || g.phase === 'feedback') {
        const controls = el('div', 'activity-controls');
        for (const [key, label] of [[' ', bi("SPACE · 推进", "SPACE · Advance")], ['a', bi("A · 左翼", "A · Left")], ['d', bi("D · 右翼", "D · Right")], ['s', bi("S · 待命", "S · Hold")]] as const) controls.append(action(label, () => { this.hit(key); this.refresh(); }, 'secondary assault-button'));
        const silhouettes = el('div', 'assault-scene');
        silhouettes.innerHTML = '<span class="battle-flag">⚑</span><span class="battle-line">♟ ♟ ♟</span><span class="battle-fort">▰</span>';
        silhouettes.classList.toggle('battle-hit', g.phase === 'feedback' && g.grade !== 'MISS');
        this.render(el('p', 'eyebrow gold', f(bi("03 / 突击 · {0} / {1}", "03 / ASSAULT · {0} / {1}"), g.commandIndex + 1, assaultCommands.length)), el('h2', '', g.command.label), silhouettes, g.phase === 'assault' ? beatTrack() : el('h2', `grade ${g.grade.toLowerCase()}`, beatGradeNames[g.grade]), controls, el('p', 'muted', f(bi("敌军士气 {0} · 保持队形，所有命令结束后自动结算", "Enemy Morale {0} · Keep formation; results follow the last command"), g.morale.toFixed(0))));
        if (g.phase === 'feedback') setText(this.live, cat`${g.command.label} · ${beatGradeNames[g.grade]}`);
      } else {
        this.render(el('p', 'eyebrow gold', bi("约克镇 · 战局正在改变", "YORKTOWN \u00b7 THE WAR IS TURNING")), el('h2', '', bi("炮声渐远。清点你身边的人。", "The guns fade. Count the people beside you.")), el('p', 'activity-score', `${g.performance} / 100`), el('p', '', f(bi("突袭优势 {0} · 部署配合 {1} · 节拍成功 {2} / 12", "Surprise {0} · Coordination {1} · Successful beats {2} / 12"), g.surprise, g.tactics, g.grades.filter(grade => grade !== 'MISS').length)), el('p', 'muted', bi("总评由潜行 20%、部署 30%、节拍 50% 构成。堡垒攻克了；此后的数日，围城仍在继续。", "The score combines stealth 20%, deployment 30%, and rhythm 50%. The redoubt is taken. The siege will continue for several more days.")), action(bi("收起军刀，听炮声之后的故事 →", "Sheathe Your Sword and Hear What Followed →"), () => this.finish(() => this.onComplete(g)), 'primary'));
      }
      if (g.phase === 'assault') {
        const hint = el('p', 'voice-command-hint muted', bi('正在朗读指令 · 节拍尚未开始；按任一指令键或点击指令按钮可跳过朗读', 'Reading the command · The beat has not started; press any command key or click a command button to skip the voice'));
        this.body.append(hint); this.speak([{ speaker: 'hamilton', text: g.command.label }]);
      }
    }
    this.speechStatus();
    const voiceHint = this.root.querySelector<HTMLElement>('.voice-command-hint');
    if (voiceHint) voiceHint.hidden = !this.reading;
    if (g.phase === 'approach') {
      this.root.querySelector<HTMLElement>('.approach-player')!.style.left = `${g.x / approachWidth * 100}%`;
      this.root.querySelector<HTMLElement>('.approach-squad')!.style.left = `${g.squadX / approachWidth * 100}%`;
      this.root.querySelector('.approach-player')!.classList.toggle('crouched', g.crouched);
      setText(this.root.querySelector('.approach-status')!, f(bi("突袭优势 {0} · 士兵{1} · {2}", "Surprise {0} · Troops {1} · {2}"), g.surprise, g.following ? bi("跟随", "Following") : bi("待命", "Hold"), g.crouched ? bi("蹲伏", "Crouched") : bi("直立", "Standing")));
      this.root.querySelectorAll<HTMLElement>('.guard-cone').forEach((cone, i) => { cone.style.transform = `scaleX(${g.guardFacing(i)})`; cone.classList.toggle('detected', g.detected.has(i)); });
      if (g.lastDetection) setText(this.live, g.lastDetection);
    }
    if (g.phase === 'command') {
      this.root.querySelectorAll<HTMLButtonElement>('button[data-order]').forEach(pick => pick.setAttribute('aria-pressed', String(g.deployment[Number(pick.dataset.squad)] === pick.dataset.order)));
      this.root.querySelector<HTMLButtonElement>('.deploy-button')!.disabled = g.deployment.some(order => !order);
      this.root.querySelectorAll<HTMLElement>('.squad-marker').forEach((marker, i) => { setText(marker, cat`${squads[i].name} · ${(g.deployment[i] ? orderNames[g.deployment[i]!] : bi("待下令", "Awaiting orders"))}`); marker.dataset.order = g.deployment[i] ?? ''; });
    }
    updateBeat(this.root, g.elapsed);
  }
}
