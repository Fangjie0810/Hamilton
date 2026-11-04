import type { GameState } from '../core/GameState';
import type { ChapterId } from '../data/types';
import { growthAttributes, type GrowthAttributeId } from '../data/growth';
import { bi, f, setLabel, setText, type Text } from '../i18n/text';
import { el } from '../ui/Activity';
import { CampaignCompass } from './CampaignCompass';
// These SVG nodes bind only attributes, so the shared language updater never inserts HTML into them.
const label = (node: SVGElement, text: Text) => setLabel(node as unknown as HTMLElement, 'aria-label', text);
let compassId = 0;

export class GrowthCompass {
  readonly element = el('div', 's3-compass');
  private appearance = new CampaignCompass(`growth-compass-${++compassId}`);
  private tooltip = el('div', 's3-compass-tooltip');
  private state?: GameState;
  private locked = true;
  private hovered?: GrowthAttributeId;

  constructor(private open: (stat: GrowthAttributeId) => void) {
    for (const [stat, group] of this.appearance.parts) this.bindPart(group, stat);
    this.tooltip.hidden = true; this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.id = `compass-tip-${compassId}`;
    this.element.dataset.design = 'campaign';
    this.element.append(this.appearance.element, this.tooltip);
    setLabel(this.element, 'aria-label', bi('成长与伯尔关系', 'Growth and Burr Relationships'));
    this.element.setAttribute('role', 'group');
    this.element.addEventListener('pointerleave', () => this.hideTip());
  }

  private bindPart(group: SVGGElement, stat: GrowthAttributeId) {
    group.setAttribute('aria-haspopup', 'dialog'); group.setAttribute('aria-controls', 's3-growth');
    group.addEventListener('click', event => { event.stopPropagation(); this.hideTip(); this.open(stat); });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); this.hideTip(); this.open(stat); }
    });
    group.addEventListener('pointerenter', () => this.showTip(stat));
    group.addEventListener('focus', () => this.showTip(stat));
    group.addEventListener('blur', () => this.hideTip());
  }

  update(state: GameState, chapter: ChapterId) {
    this.state = state; this.locked = !['Washington', 'Yorktown'].includes(chapter);
    const split = this.appearance.update(state, this.locked);
    for (const attribute of growthAttributes) {
      const group = this.appearance.parts.get(attribute.id)!;
      const locked = attribute.id === 'washingtonTrust' && this.locked;
      group.dataset.locked = String(locked); group.dataset.value = String(state[attribute.id]);
      label(group, locked ? f(bi('{0} · 未解锁，进入军营后开启 · 点击查看含义', '{0} · Locked until camp · Click for details'), attribute.name)
        : f(bi('{0} {1} · 点击查看含义', '{0} {1} · Click for details'), attribute.name, state[attribute.id]));
    }
    this.element.dataset.relationshipSplit = split.toFixed(2);
    if (this.hovered) this.showTip(this.hovered);
  }

  private showTip(stat: GrowthAttributeId) {
    if (!this.state) return;
    this.hovered = stat;
    const attribute = growthAttributes.find(item => item.id === stat)!;
    setText(this.tooltip, stat === 'washingtonTrust' && this.locked
      ? bi('华盛顿信任 · 进入军营后解锁。点击了解用途。', 'Washington Trust · Unlocks in camp. Click to learn more.')
      : f(bi('{0} · {1}　点击了解含义', '{0} · {1} · Click for details'), attribute.name, this.state[stat]));
    this.tooltip.hidden = false;
  }
  private hideTip() { this.hovered = undefined; this.tooltip.hidden = true; }
}
