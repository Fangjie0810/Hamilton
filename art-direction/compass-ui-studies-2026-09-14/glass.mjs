import { sector, progressRadius, splitY } from './shared.mjs';
import { bi } from '../../src/i18n/text.ts';

const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const p = (r, degrees) => {
  const a = degrees * Math.PI / 180;
  return `${120 + Math.cos(a) * r},${120 + Math.sin(a) * r}`;
};
const arc = (r, start, end) => `M${p(r, start)} A${r},${r} 0 0 1 ${p(r, end)}`;

export const variant = {
  id: 'glass',
  title: bi('烟色透镜', 'Smoked lens'),
  subtitle: bi('透光灰底 · 缎面钢边 · 凝练立体', 'Translucent smoke · Satin steel · Sculpted clarity'),
  summary: bi(
    '半透明的浅烟灰保留场景透视，属性从圆心一侧向外生长。石墨斜纹与锁标专门表示尚未解锁的信任。',
    'Light smoke lets the scene show through as attributes grow outward from the core. Graphite hatching and a lock identify trust before it is unlocked.',
  ),
  render(state, uid) {
    const id = `glass-${String(uid).replace(/[^\w-]/g, '-')}`;
    const fill = (name) => `url(#${id}-${name})`;
    const split = splitY(state.burrRivalry, state.burrRespect);
    const sectors = [
      { key: 'momentum', start: -150, end: -30, x: 120, y: 41, ink: '#ffdf78', gradient: 'gold', value: clamp(state.momentum) },
      { key: 'influence', start: -30, end: 90, x: 188, y: 163, ink: '#f5f9fd', gradient: 'carbon', value: clamp(state.influence) },
      { key: 'washingtonTrust', start: 90, end: 210, x: 52, y: 163, ink: '#b6edce', gradient: 'green', value: clamp(state.washingtonTrust) },
    ];
    const typography = 'font-family="Georgia, Times New Roman, serif" font-variant-numeric="tabular-nums" text-anchor="middle" font-weight="700"';
    const ring = sectors.map((item) => {
      const locked = item.key === 'washingtonTrust' && state.locked;
      const r = progressRadius(item.value, 52, 108);
      const body = sector(52, 108, item.start, item.end);
      const face = locked ? fill('locked') : fill('empty');
      return `<g data-stat="${item.key}" class="stat-hit" role="button" tabindex="0" aria-label="${item.key}">
        <path d="${body}" fill="${face}"/>
        ${locked
          ? `<path d="${body}" fill="${fill('hatch')}"/>`
          : `${item.value > 0 ? `<path d="${sector(52, r, item.start, item.end)}" fill="${fill(item.gradient)}"/>
             <path d="${arc(r, item.start, item.end)}" fill="none" stroke="${item.ink}" stroke-opacity=".5" stroke-width="1.05"/>` : ''}`}
        <path d="${body}" fill="${fill('lens')}" pointer-events="none"/>
        <path d="${arc(105.8, item.start + .3, item.end - .3)}" fill="none" stroke="white" stroke-opacity=".2" stroke-width=".8" pointer-events="none"/>
        ${locked ? `<g transform="translate(52 153)" pointer-events="none">
          <path d="M-5 -2v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#dce4eb" stroke-width="2.4" stroke-linecap="round"/>
          <rect x="-8" y="-2" width="16" height="13" rx="3" fill="#c5cfd8" stroke="#f6faff" stroke-width=".7"/>
          <circle cy="3" r="1.6" fill="#3a424c"/><path d="M0 3v4" stroke="#3a424c" stroke-width="1.8"/>
          <path d="M-7 19H7" stroke="#adb9c7" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
        </g>` : `<text x="${item.x}" y="${item.y}" ${typography} font-size="24" fill="${item.key === 'momentum' ? '#fff3c2' : '#f1f8f7'}" stroke="#09141d" stroke-opacity=".55" stroke-width="2.4" paint-order="stroke" pointer-events="none">${Math.round(item.value)}</text>`}
        <path class="hit-target" d="${body}" fill="transparent"/>
      </g>`;
    }).join('');

    return `<defs>
      <clipPath id="${id}-disc"><circle cx="120" cy="120" r="108"/></clipPath>
      <clipPath id="${id}-core"><circle cx="120" cy="120" r="52"/></clipPath>
      <linearGradient id="${id}-empty" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#e8f1fa" stop-opacity=".48"/><stop offset=".58" stop-color="#c9d7e3" stop-opacity=".28"/><stop offset="1" stop-color="#a5b7c7" stop-opacity=".46"/>
      </linearGradient>
      <radialGradient id="${id}-gold" gradientUnits="userSpaceOnUse" cx="120" cy="120" r="108">
        <stop offset=".47" stop-color="#8b5c0c"/><stop offset=".63" stop-color="#c28b16"/><stop offset=".83" stop-color="#edc65e"/><stop offset="1" stop-color="#f9df8b"/>
      </radialGradient>
      <radialGradient id="${id}-carbon" gradientUnits="userSpaceOnUse" cx="120" cy="120" r="108">
        <stop offset=".47" stop-color="#05080c"/><stop offset=".65" stop-color="#141a21"/><stop offset=".84" stop-color="#252d37"/><stop offset="1" stop-color="#414b58"/>
      </radialGradient>
      <radialGradient id="${id}-green" gradientUnits="userSpaceOnUse" cx="120" cy="120" r="108">
        <stop offset=".47" stop-color="#03281f"/><stop offset=".65" stop-color="#064d3c"/><stop offset=".85" stop-color="#117659"/><stop offset="1" stop-color="#328f6d"/>
      </radialGradient>
      <linearGradient id="${id}-locked" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#52606e"/><stop offset=".4" stop-color="#3d4854"/><stop offset="1" stop-color="#252e38"/>
      </linearGradient>
      <pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(36)">
        <path d="M0 0v7" stroke="#95a0ae" stroke-width="1" stroke-opacity=".26"/>
      </pattern>
      <radialGradient id="${id}-lens" cx="27%" cy="15%" r="100%">
        <stop stop-color="#fff" stop-opacity=".27"/><stop offset=".33" stop-color="#fff" stop-opacity=".08"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset=".87" stop-color="#092033" stop-opacity=".1"/><stop offset="1" stop-color="#03111f" stop-opacity=".46"/>
      </radialGradient>
      <linearGradient id="${id}-red" x1=".15" y1="0" x2=".85" y2="1">
        <stop stop-color="#f79c99"/><stop offset=".35" stop-color="#d7464c"/><stop offset="1" stop-color="#802332"/>
      </linearGradient>
      <linearGradient id="${id}-blue" x1=".15" y1="0" x2=".85" y2="1">
        <stop stop-color="#7fbee8"/><stop offset=".42" stop-color="#386caa"/><stop offset="1" stop-color="#153854"/>
      </linearGradient>
      <linearGradient id="${id}-edge" x1=".15" y1="0" x2=".85" y2="1">
        <stop stop-color="#f2f8ff"/><stop offset=".3" stop-color="#92a5b8"/><stop offset=".53" stop-color="#273d4f"/><stop offset=".8" stop-color="#566b7e"/><stop offset="1" stop-color="#d1dce7"/>
      </linearGradient>
      <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3.6" stdDeviation="2.7" flood-color="#06111f" flood-opacity=".6"/></filter>
    </defs>
    <circle cx="120" cy="120" r="108" fill="none" stroke="#142130" stroke-width="2.4" filter="${fill('shadow')}" pointer-events="none"/>
    ${ring}
    <g clip-path="${fill('core')}">
      <g data-stat="burrRivalry" class="stat-hit" role="button" tabindex="0" aria-label="burrRivalry">
        <rect x="68" y="68" width="104" height="${split - 68}" fill="${fill('red')}"/>
        <text x="120" y="${(72 + split) / 2 + 7}" ${typography} font-size="23" fill="#fff0e8" stroke="#651e2a" stroke-opacity=".5" stroke-width="1.5" paint-order="stroke" pointer-events="none">${Math.round(Number(state.burrRivalry) || 0)}</text>
        <rect class="hit-target" x="68" y="68" width="104" height="${split - 68}" fill="transparent"/>
      </g>
      <g data-stat="burrRespect" class="stat-hit" role="button" tabindex="0" aria-label="burrRespect">
        <rect x="68" y="${split}" width="104" height="${172 - split}" fill="${fill('blue')}"/>
        <text x="120" y="${(split + 168) / 2 + 7}" ${typography} font-size="23" fill="#e3f4ff" stroke="#143451" stroke-opacity=".6" stroke-width="1.5" paint-order="stroke" pointer-events="none">${Math.round(Number(state.burrRespect) || 0)}</text>
        <rect class="hit-target" x="68" y="${split}" width="104" height="${172 - split}" fill="transparent"/>
      </g>
      <circle cx="120" cy="120" r="52" fill="${fill('lens')}" pointer-events="none"/>
      <path d="M68 ${split}H172" stroke="#112c3d" stroke-width=".9" stroke-opacity=".7" pointer-events="none"/>
      <path d="M68 ${split + .7}H172" stroke="#d0e7f4" stroke-width=".5" stroke-opacity=".3" pointer-events="none"/>
    </g>
    <g pointer-events="none">
      <g clip-path="${fill('disc')}" opacity=".14"><path d="M5 29 153-8 221 14 21 99Z" fill="white"/><path d="m25 108 202-91 7 3L31 113Z" fill="white"/></g>
      <circle cx="120" cy="120" r="52" fill="none" stroke="#1a3246" stroke-opacity=".7" stroke-width="1"/>
      <path d="${arc(52.7, -155, -27)}" fill="none" stroke="#e1f1fa" stroke-opacity=".6" stroke-width=".7"/>
      ${[-150, -30, 90].map((angle) => `<path d="M${p(52, angle)}L${p(108, angle)}" stroke="#183140" stroke-opacity=".65" stroke-width="1"/>`).join('')}
      <circle cx="120" cy="120" r="108" fill="none" stroke="${fill('edge')}" stroke-width="1.7"/>
      <path d="${arc(108.7, -158, -23)}" fill="none" stroke="#f5fbff" stroke-opacity=".7" stroke-width=".6"/>
      <path d="${arc(107, 19, 151)}" fill="none" stroke="#071422" stroke-opacity=".65" stroke-width="1.1"/>
    </g>`;
  },
};
