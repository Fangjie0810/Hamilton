import { sector, point, progressRadius, splitY, escape } from './shared.mjs';
import { bi } from '../../src/i18n/text.ts';

// A compact campaign insignia: forged edges, translucent recesses and radial relief.
// Geometry is shared with the other studies so value changes can be compared directly.
export const variant = {
  id: 'tactical',
  title: bi('战役徽章', 'Campaign insignia'),
  subtitle: bi('锻铁边缘 · 浮雕进度', 'Forged edges · Sculpted progress'),
  summary: bi(
    '更具策略游戏感的军徽。属性像浮雕从内圈向外生长，浅烟灰凹槽仍透出场景；封锁区域使用更深的石墨灰与斜纹。',
    'A strategy-game insignia. Sculpted attributes grow outward into translucent smoke-gray recesses; graphite hatching distinguishes the locked sector.',
  ),
  render(state, uid) {
    const id = (name) => `${uid}-tactical-${name}`;
    const url = (name) => `url(#${id(name)})`;
    const cleanValue = (value) => Math.max(0, Math.min(100, Number(value) || 0));
    const values = {
      momentum: cleanValue(state.momentum),
      influence: cleanValue(state.influence),
      washingtonTrust: cleanValue(state.washingtonTrust),
      burrRivalry: cleanValue(state.burrRivalry),
      burrRespect: cleanValue(state.burrRespect),
    };
    const dividingY = splitY(values.burrRivalry, values.burrRespect);
    const valueText = (x, y, value, size = 26, fill = '#fff5db') => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" stroke="#151b18" stroke-width="3.2" paint-order="stroke fill" font-size="${size}" font-weight="800" font-family="Georgia, 'Times New Roman', serif" style="font-variant-numeric:tabular-nums;pointer-events:none">${escape(String(value))}</text>`;
    const icon = (name, x, y, locked = false) => {
      const path = locked
        ? '<path d="M-3-2v-2a3 3 0 0 1 6 0v2M-5-2H5v8H-5ZM0 1v2"/>'
        : name === 'momentum'
          ? '<path d="M0-6 4 0 1-1v7h-2v-7l-3 1Z"/>'
          : name === 'influence'
            ? '<path d="m-6 4 1-8 4 4 2-6 2 6 4-4 1 8ZM-5 6H5"/>'
            : '<path d="M0-6 6-3 5 3 0 7-5 3-6-3ZM-2 0l2 2 3-4"/>';
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${locked ? '#cbd1d2' : '#f3e4bf'}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" opacity=".95" style="pointer-events:none">${path}</g>`;
    };
    const bands = [66, 81, 95].map((radius) => `<circle cx="120" cy="120" r="${radius}" fill="none" stroke="#e8eef0" stroke-opacity=".095" stroke-width=".8"/>`).join('');
    const entries = [
      { key: 'momentum', label: 'Momentum', start: -150, end: -30, x: 120, y: 43, ix: 120, iy: 25 },
      { key: 'influence', label: 'Influence', start: -30, end: 90, x: 188, y: 166, ix: 188, iy: 145 },
      { key: 'washingtonTrust', label: 'Washington’s trust', start: 90, end: 210, x: 52, y: 166, ix: 52, iy: 145 },
    ];
    const wedges = entries.map(({ key, label, start, end, x, y, ix, iy }) => {
      const locked = key === 'washingtonTrust' && state.locked;
      const extent = progressRadius(values[key]);
      return `<g class="compass-part" data-stat="${key}" role="button" tabindex="0" aria-label="${escape(label)}">
        <path class="part-surface" d="${sector(52, 108, start, end)}" fill="${locked ? url('locked') : url('recess')}"/>
        ${locked ? `<path d="${sector(52, 108, start, end)}" fill="${url('hatching')}" opacity=".62"/>` : `
          ${values[key] > 0 ? `<path d="${sector(52, extent, start, end)}" fill="${url(key)}"/>
            <path d="${sector(Math.max(52, extent - 2.3), extent, start, end)}" fill="${url(`${key}-lip`)}" opacity=".88"/>
            <path d="${sector(Math.max(52, extent - 4), Math.max(52, extent - 2.5), start, end)}" fill="#0b100c" opacity=".2"/>` : ''}
          <g clip-path="${url(`sector-${key}`)}" style="pointer-events:none">${bands}</g>
        `}
        <path class="part-hover" d="${sector(52, 108, start, end)}" fill="#fff8db" opacity="0"/>
        ${icon(key, ix, iy, locked)}
        ${valueText(x, y, locked ? '—' : Math.round(values[key]), 26, locked ? '#c0c7c8' : '#fff3d4')}
      </g>`;
    }).join('');
    const boundaries = [-150, -30, 90].map((angle) => {
      const a = point(52, angle);
      const b = point(108, angle);
      return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#131b16" stroke-width="1.25" stroke-opacity=".92"/>`;
    }).join('');
    const redY = (68 + dividingY) / 2 + 1;
    const blueY = (dividingY + 172) / 2 + 1;
    return `<defs>
      <radialGradient id="${id('recess')}" cx="34%" cy="24%" r="90%">
        <stop stop-color="#e4eced" stop-opacity=".41"/><stop offset=".58" stop-color="#c0cbd0" stop-opacity=".34"/><stop offset="1" stop-color="#71827f" stop-opacity=".4"/>
      </radialGradient>
      <radialGradient id="${id('locked')}" cx="32%" cy="20%" r="100%">
        <stop stop-color="#666e72"/><stop offset=".6" stop-color="#41494d"/><stop offset="1" stop-color="#222a2d"/>
      </radialGradient>
      <pattern id="${id('hatching')}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
        <path d="M0 0V7" stroke="#171e20" stroke-width="1.6"/><path d="M2 0V7" stroke="#b6bfc1" stroke-width=".55" stroke-opacity=".3"/>
      </pattern>
      <radialGradient id="${id('momentum')}" cx="120" cy="120" r="108" gradientUnits="userSpaceOnUse">
        <stop offset=".45" stop-color="#856019"/><stop offset=".62" stop-color="#c39c30"/><stop offset=".88" stop-color="#dfbf50"/><stop offset="1" stop-color="#f3d16d"/>
      </radialGradient>
      <linearGradient id="${id('momentum-lip')}" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff5b1"/><stop offset="1" stop-color="#b78e2d"/></linearGradient>
      <radialGradient id="${id('influence')}" cx="120" cy="120" r="108" gradientUnits="userSpaceOnUse">
        <stop offset=".45" stop-color="#050607"/><stop offset=".65" stop-color="#15191b"/><stop offset=".87" stop-color="#2b3135"/><stop offset="1" stop-color="#121719"/>
      </radialGradient>
      <linearGradient id="${id('influence-lip')}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b2bec3"/><stop offset=".5" stop-color="#718087"/><stop offset="1" stop-color="#39474d"/></linearGradient>
      <radialGradient id="${id('washingtonTrust')}" cx="120" cy="120" r="108" gradientUnits="userSpaceOnUse">
        <stop offset=".45" stop-color="#0a2922"/><stop offset=".68" stop-color="#124338"/><stop offset=".9" stop-color="#246650"/><stop offset="1" stop-color="#174d3e"/>
      </radialGradient>
      <linearGradient id="${id('washingtonTrust-lip')}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a0d0a5"/><stop offset="1" stop-color="#3b8061"/></linearGradient>
      <linearGradient id="${id('forged-edge')}" x1=".14" y1="0" x2=".86" y2="1">
        <stop stop-color="#d5c493"/><stop offset=".17" stop-color="#717465"/><stop offset=".45" stop-color="#2b3831"/><stop offset=".71" stop-color="#101a15"/><stop offset=".87" stop-color="#4b5b4b"/><stop offset="1" stop-color="#17211a"/>
      </linearGradient>
      <radialGradient id="${id('red')}" cx="28%" cy="18%" r="90%"><stop stop-color="#d0715b"/><stop offset=".46" stop-color="#a4453a"/><stop offset="1" stop-color="#56241f"/></radialGradient>
      <radialGradient id="${id('blue')}" cx="27%" cy="15%" r="100%"><stop stop-color="#789ea9"/><stop offset=".44" stop-color="#456d80"/><stop offset="1" stop-color="#193b50"/></radialGradient>
      <radialGradient id="${id('core-relief')}" cx="43%" cy="37%" r="65%"><stop offset=".55" stop-color="#06100c" stop-opacity="0"/><stop offset=".87" stop-color="#06100c" stop-opacity=".09"/><stop offset="1" stop-color="#06100c" stop-opacity=".58"/></radialGradient>
      <clipPath id="${id('core')}"><circle cx="120" cy="120" r="52"/></clipPath>
      <clipPath id="${id('upper')}"><rect x="68" y="68" width="104" height="${dividingY - 68}"/></clipPath>
      <clipPath id="${id('lower')}"><rect x="68" y="${dividingY}" width="104" height="${172 - dividingY}"/></clipPath>
      ${entries.map(({ key, start, end }) => `<clipPath id="${id(`sector-${key}`)}"><path d="${sector(52, 108, start, end)}"/></clipPath>`).join('')}
    </defs>
    ${wedges}
    <g clip-path="${url('core')}">
      <g class="compass-part" data-stat="burrRivalry" role="button" tabindex="0" aria-label="Burr rivalry" clip-path="${url('upper')}">
        <circle class="part-surface" cx="120" cy="120" r="52" fill="${url('red')}"/>
        <circle class="part-hover" cx="120" cy="120" r="52" fill="#fff0d2" opacity="0"/>
        ${valueText(120, redY, Math.round(values.burrRivalry), 24, '#fff0de')}
      </g>
      <g class="compass-part" data-stat="burrRespect" role="button" tabindex="0" aria-label="Burr respect" clip-path="${url('lower')}">
        <circle class="part-surface" cx="120" cy="120" r="52" fill="${url('blue')}"/>
        <circle class="part-hover" cx="120" cy="120" r="52" fill="#e7f4ff" opacity="0"/>
        ${valueText(120, blueY, Math.round(values.burrRespect), 24, '#eaf7f5')}
      </g>
      <path d="M68 ${dividingY}H172" stroke="#10221e" stroke-width="1.5" pointer-events="none"/>
      <path d="M68 ${dividingY + 1.2}H172" stroke="#c2d0c7" stroke-opacity=".5" stroke-width=".65" pointer-events="none"/>
      <circle cx="120" cy="120" r="52" fill="${url('core-relief')}" pointer-events="none"/>
    </g>
    <g pointer-events="none">
      ${boundaries}
      <circle cx="120" cy="120" r="52" fill="none" stroke="#10221a" stroke-width="1.35"/>
      <circle cx="120" cy="120" r="51.2" fill="none" stroke="#e3d5ad" stroke-opacity=".26" stroke-width=".65"/>
      <circle cx="120" cy="120" r="108" fill="none" stroke="#09130d" stroke-width="4"/>
      <circle cx="120" cy="120" r="108" fill="none" stroke="${url('forged-edge')}" stroke-width="3"/>
      <circle cx="120" cy="120" r="105.7" fill="none" stroke="#edf1ce" stroke-opacity=".36" stroke-width=".7"/>
      ${[-150, -30, 90].map((angle) => { const p = point(108, angle); return `<circle cx="${p.x}" cy="${p.y}" r="2.6" fill="#4d5846" stroke="#19261b" stroke-width=".7"/><path d="M${p.x - .8} ${p.y - .8}l1.6 1.6" stroke="#c8be94" stroke-opacity=".76" stroke-width=".6"/>`; }).join('')}
    </g>`;
  },
};
