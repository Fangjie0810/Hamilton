import { setText, setLabel, getLanguage, setLanguage, onLanguageChange, primaryText, accessibleText } from '../i18n/text';
import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import { WritingSystem } from '../systems/WritingSystem';
import { dispatchBins, binNames, type DispatchBin } from '../data/writing';
import { ActivityPanel, action, el } from './Activity';
import { noWritingBenefits, type WritingBenefits } from '../data/growth';

export class WritingActivity extends ActivityPanel {
  private game: WritingSystem;
  private selected: string | null = null;
  private shown = '';
  private narrated = '';
  constructor(blocked: () => boolean, private onComplete: (result: WritingSystem) => void, benefits: WritingBenefits = noWritingBenefits) { super(bi("军令桌", "WRITE · Dispatch Desk"), blocked); this.game = new WritingSystem(benefits); this.refresh(); }
  key(key: string, down: boolean) { if (down && !this.blocked() && /^[1-3]$/.test(key) && this.game.phase === 'sort') this.assign(dispatchBins[Number(key) - 1]); }
  update(delta: number) { if (!this.reading) this.game.tick(delta); this.refresh(); }
  private assign(bin: DispatchBin) {
    if (!this.selected || this.blocked()) return;
    this.game.assign(this.selected, bin); this.selected = null; this.shown = ''; this.refresh();
  }
  private refresh() {
    const g = this.game;
    this.root.dataset.activity = 'writing'; this.root.dataset.phase = g.phase; this.root.dataset.round = String(g.round);
    this.root.dataset.remaining = String(Math.round(g.remaining));
    this.root.dataset.referencesUsed = String(g.referencesUsed);
    if (this.shown !== `${g.phase}:${g.round}`) {
      this.shown = `${g.phase}:${g.round}`;
      if (g.phase === 'briefing') this.render(el('h2', '', bi("把杂乱报告写成能执行的命令。", "Turn scattered reports into an executable order.")), el('p', '', bi("三份军令，共有 2 分 30 秒整理时间。将碎片拖进三个栏目，或点击碎片后按 1 / 2 / 3 分配。提交前可以反复移动。", "You have 2 minutes 30 seconds for three dispatches. Drag fragments into the three columns, or select a fragment and press 1 / 2 / 3. You may rearrange them before submitting.")), el('p', 'activity-instructions', bi("优先事项放目标和时限；执行任务放人员与补给；背景情况放地点和状况。每份提交后显示校对稿，首次提交的准确率影响华盛顿的信任。未分配的碎片按缺漏计，超时仍可继续剧情。", "PRIORITY holds objectives and deadlines; ACTION holds personnel and supply tasks; CONTEXT holds locations and conditions. Each submission reveals a corrected draft. First-pass accuracy affects Washington's trust. Unassigned fragments count as omissions; a timeout does not stop the story.")), action(bi("开始整理 →", "Begin Sorting →"), () => { g.begin(); this.refresh(); }, 'primary'));
      else if (g.phase === 'sort') {
        const fragments = el('div', 'dispatch-fragments');
        g.dispatch.fragments.forEach(fragment => {
          const card = action('', () => { this.selected = fragment.id; this.refreshSelection(); this.speak([{ speaker: 'hamilton', text: fragment.text }]); }, 'dispatch-fragment');
          card.dataset.fragment = fragment.id; card.draggable = true;
          card.append(el('span', 'eyebrow gold', fragment.label), el('span', '', fragment.text), el('small', 'muted', g.assignments[fragment.id] ? f(bi("已放入 {0} · 点击可移动", "Placed in {0} · Select to move"), binNames[g.assignments[fragment.id]!]) : bi("尚未分配", "Unassigned")));
          card.addEventListener('dragstart', event => { if (this.blocked()) { event.preventDefault(); return; } this.selected = fragment.id; event.dataTransfer?.setData('text/plain', fragment.id); this.refreshSelection(); });
          fragments.append(card);
        });
        const bins = el('div', 'dispatch-bins');
        dispatchBins.forEach((bin, index) => {
          const target = action('', () => this.assign(bin), 'dispatch-bin'); target.dataset.bin = bin;
          target.append(el('strong', '', cat`${index + 1} · ${binNames[bin]}`));
          g.dispatch.fragments.filter(fragment => g.assignments[fragment.id] === bin).forEach(fragment => target.append(el('p', '', fragment.text)));
          target.addEventListener('dragover', event => { if (!this.blocked()) event.preventDefault(); });
          target.addEventListener('drop', event => { event.preventDefault(); if (this.blocked()) return; const id = event.dataTransfer?.getData('text/plain'); if (id && g.dispatch.fragments.some(fragment => fragment.id === id)) { this.selected = id; this.assign(bin); } });
          bins.append(target);
        });
        this.render(el('h2', '', cat`${g.round + 1} / 3 · ${g.dispatch.title}`), el('p', 'writing-timer'), el('p', 'muted', bi("先选择碎片，再点击栏目或按 1–3；也可以直接拖拽。", "Select a fragment, then click a column or press 1–3. Dragging also works.")), fragments, bins, action(f(bi("提交军令 · 已分配 {0} / 5", "Submit Dispatch · {0} / 5 placed"), Object.keys(g.assignments).length), () => { g.submit(); this.refresh(); }, 'primary'));
        if (g.referencesGranted) {
          const reference = action('', () => {
            if (this.blocked()) return;
            if (g.reference(this.selected)) { this.stopSpeech(); this.refreshReference(); }
          }, 'secondary reference-button');
          const hint = el('p', 'muted reference-hint');
          this.body.insertBefore(reference, bins); this.body.insertBefore(hint, bins);
        }
        this.refreshSelection();
      } else if (g.phase === 'feedback') {
        const corrected = el('div', 'dispatch-correction');
        dispatchBins.forEach(bin => { corrected.append(el('h3', '', binNames[bin])); for (const fragment of g.dispatch.fragments.filter(fragment => fragment.bin === bin)) corrected.append(el('p', g.assignments[fragment.id] === bin ? 'correct' : 'incorrect', cat`${g.assignments[fragment.id] === bin ? '✓' : bi("校对 →", "Corrected →")} ${fragment.text}`)); });
        setText(this.live, f(bi("本份军令正确 {0} 项，共五项", "This dispatch has {0} correct items out of five"), g.scores[g.round]));
        this.render(el('h2', '', f(bi("{0} · 校对稿", "{0} · Corrected Draft"), g.dispatch.title)), el('p', '', f(bi("首次整理 {0} / 5 项准确。下列稿件已把缺漏与错放的信息归位。", "First pass: {0} / 5 correct. The draft below restores missing and misplaced information."), g.scores[g.round])), corrected, action(g.round === 2 || !g.remaining ? bi("完成军令 →", "Complete the Dispatches →") : bi("整理下一份 →", "Sort the Next Dispatch →"), () => { g.next(); this.selected = null; this.refresh(); }, 'primary'));
      } else {
        this.render(el('h2', '', bi("一封信，可以让整支队伍前进。", "One letter can move an entire company.")), el('p', 'activity-score', `${g.performance} / 100`), el('p', '', f(bi("首次分类准确率 · 华盛顿信任 {0}{1}", "First-pass accuracy · Washington Trust {0}{1}"), Number(g.effects().washingtonTrust) > 0 ? '+' : '', g.effects().washingtonTrust)), el('p', 'muted', g.remaining ? bi("军令经过校对后发出。写得清楚，是你承担责任的一部分。", "The corrected dispatches are sent. Clear writing is part of carrying responsibility.") : bi("时限已到，未完成的信息计入缺漏。副官接手校对，军令仍会发出；下一次，你需要更准确地组织信息。", "Time has run out. Unfinished information counts as omissions. Another aide will complete the corrections and send the orders. Next time, organize the information more carefully.")), action(bi("翻过战争中的几年 →", "Turn the Pages of the War →"), () => this.finish(() => this.onComplete(g)), 'primary'));
      }
      if (g.phase === 'briefing') this.body.insertBefore(el('p', 'activity-instructions growth-benefits', f(bi('本场成长：华盛顿信任提供 {0} 次「查阅范例」。先选择一个片段，再查看它的正确类别；你仍需自行分配，查阅不增加整理时间。', 'Growth this activity: Washington Trust provides {0} use of Consult Example. Select one fragment to see its correct category, then place it yourself. Consulting adds no sorting time.'), g.referencesGranted)), this.body.lastElementChild);
      if (g.phase === 'result') this.body.insertBefore(el('p', 'muted growth-result', f(bi('成长帮助：分类范例已使用 {0} / {1} 次。准确率按你提交的分类计算。', 'Growth assistance: category example used {0} / {1} times. Accuracy is calculated from the categories you submitted.'), g.referencesUsed, g.referencesGranted)), this.body.lastElementChild);
      if (g.phase === 'result') this.react(g.performance >= 80 ? 'success' : g.performance >= 50 ? 'neutral' : 'miss');
    }
    if (this.narrated !== `${g.phase}:${g.round}`) {
      this.narrated = `${g.phase}:${g.round}`;
      if (g.phase === 'feedback') this.speak(dispatchBins.flatMap(bin => g.dispatch.fragments.filter(fragment => fragment.bin === bin).map(fragment => ({ speaker: 'hamilton', text: fragment.text }))), g.scores[g.round] >= 4 ? 'success' : g.scores[g.round] >= 3 ? 'neutral' : 'miss');
    }
    this.speechStatus();
    const timer = this.root.querySelector('.writing-timer'); if (timer) setText(timer, f(bi("整理时间 {0} 秒 · 朗读与校对期间不计时", "Sorting time: {0} seconds · Voice playback and corrections do not use time"), Math.ceil(g.remaining / 1000)));
  }
  private refreshSelection() {
    this.root.querySelectorAll<HTMLElement>('[data-fragment]').forEach(card => card.setAttribute('aria-pressed', String(card.dataset.fragment === this.selected)));
    setText(this.live, this.selected ? bi("已选中碎片。按 1、2、3 或点击栏目完成分配。", "Fragment selected. Press 1, 2, or 3, or click a column to place it.") : bi("选择下一条信息。", "Choose the next piece of information."));
    this.refreshReference();
  }
  private refreshReference() {
    const g = this.game, button = this.root.querySelector<HTMLButtonElement>('.reference-button');
    this.root.dataset.referencesUsed = String(g.referencesUsed);
    if (button) { button.disabled = !this.selected || !g.referencesRemaining; setText(button, f(bi('查阅范例 · 剩余 {0} 次', 'Consult Example · {0} use remaining'), g.referencesRemaining)); }
    const hint = this.root.querySelector<HTMLElement>('.reference-hint');
    if (hint) {
      const reference = g.referenceHint;
      if (reference && reference.round === g.round) {
        const fragment = g.dispatch.fragments.find(fragment => fragment.id === reference.fragmentId)!;
        const text = f(bi('华盛顿的信任让你查到范例：「{0}」应放入「{1}」。请自行完成分类。', 'Washington\'s trust gives you access to an example: “{0}” belongs in “{1}.” Place the fragment yourself.'), fragment.label, binNames[reference.bin]);
        setText(hint, text); setText(this.live, text);
      } else setText(hint, g.referencesRemaining ? bi('先选择一个片段，再查阅它的正确类别。', 'Select one fragment, then consult its correct category.') : bi('本场分类范例已用完。', 'The category example has been used for this activity.'));
    }
  }
}
