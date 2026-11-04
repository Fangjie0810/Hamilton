import { type GameState, type StateEffect, type StatKey } from '../core/GameState';
import { bi, f, setLabel, setText, type BiText } from '../i18n/text';
import { effectDirections } from '../systems/ChoiceEffects';
import './choice-effects.css';

const labels: Record<StatKey, BiText> = {
  momentum: bi('锐气', 'Momentum'), influence: bi('影响力', 'Influence'),
  washingtonTrust: bi('华盛顿 · 信任', 'Washington · Trust'),
  burrRespect: bi('伯尔 · 尊重', 'Burr · Respect'), burrRivalry: bi('伯尔 · 竞争', 'Burr · Rivalry'),
  debatePerformance: bi('辩论表现', 'Debate Performance'), yorktownPerformance: bi('战役表现', 'Campaign Performance'),
};

export function choiceEffects(effect: StateEffect, state: GameState): HTMLElement {
  const row = document.createElement('span'); row.className = 'choice-effects';
  for (const { stat, direction } of effectDirections(effect, state)) {
    const item = document.createElement('span'); item.className = 'choice-effect';
    item.dataset.stat = stat; item.dataset.direction = direction;
    const description = f(bi('{0}：{1}', '{0}: {1}'), labels[stat], direction === 'up' ? bi('上升', 'Increase') : direction === 'down' ? bi('下降', 'Decrease') : bi('已达边界，不变', 'At the limit; unchanged'));
    setLabel(item, 'aria-label', description); setLabel(item, 'title', description);
    const arrow = document.createElement('span'); arrow.className = 'choice-effect-arrow'; arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '—';
    const label = document.createElement('span'); label.className = 'choice-effect-label'; label.setAttribute('aria-hidden', 'true'); setText(label, labels[stat]);
    item.append(arrow, label); row.append(item);
  }
  return row;
}
