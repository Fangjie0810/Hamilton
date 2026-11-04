import { sector, point, progressRadius, splitY } from './shared.mjs';
import { bi } from '../../src/i18n/text.ts';

// Fine old-gold seams follow the exact shared sector edges: the enamel itself
// reaches both its neighbours and the central glass. There is no backing disc.
export const variant = {
  id: 'enamel',
  title: bi('鎏金珐琅', 'Gilt Enamel'),
  subtitle: bi('精细金边 · 通透釉面 · 古典立体感', 'Fine gilt seams · Glazed glass · Classical depth'),
  summary: bi(
    '像一枚嵌在画面上的珐琅徽章。三项属性从中心向外生长，极细金属分界连接所有区域；未填充处为透景烟灰玻璃，锁定区为带斜纹的实心石墨。',
    'An enamel medallion suspended over the scene. Each attribute grows outward from the centre, joined by fine metallic seams. Unfilled areas are translucent smoked glass; a locked sector is solid, hatched graphite.',
  ),
  render(state, uid) {
    const id = (name) => `${uid}-${name}`;
    const ref = (name) => `url(#${id(name)})`;
    const value = (key) => Math.max(0, Math.min(100, Number(state[key]) || 0));
    const relationY = splitY(value('burrRivalry'), value('burrRespect'));
    const arc = (radius, start, end) => {
      const a = point(radius, start);
      const b = point(radius, end);
      return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`;
    };
    const defs = `
      <defs>
        <linearGradient id="${id('gold')}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff0b4"/><stop offset=".27" stop-color="#dbb454"/>
          <stop offset=".63" stop-color="#8a5c20"/><stop offset="1" stop-color="#e7c776"/>
        </linearGradient>
        <linearGradient id="${id('momentum')}" x1="0" y1="0" x2=".7" y2="1">
          <stop stop-color="#ffe7a0"/><stop offset=".28" stop-color="#e4bc4f"/>
          <stop offset=".76" stop-color="#bf891f"/><stop offset="1" stop-color="#846013"/>
        </linearGradient>
        <linearGradient id="${id('influence')}" x1="0" y1="0" x2=".8" y2="1">
          <stop stop-color="#56616a"/><stop offset=".34" stop-color="#252b30"/>
          <stop offset=".72" stop-color="#090c0e"/><stop offset="1" stop-color="#18232a"/>
        </linearGradient>
        <linearGradient id="${id('washingtonTrust')}" x1="0" y1="0" x2=".8" y2="1">
          <stop stop-color="#5a9981"/><stop offset=".30" stop-color="#27644f"/>
          <stop offset=".78" stop-color="#123d2c"/><stop offset="1" stop-color="#0a281e"/>
        </linearGradient>
        <linearGradient id="${id('empty')}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#e0e7e9" stop-opacity=".32"/><stop offset=".55" stop-color="#adb8bf" stop-opacity=".19"/>
          <stop offset="1" stop-color="#71818c" stop-opacity=".27"/>
        </linearGradient>
        <linearGradient id="${id('locked')}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#717b85"/><stop offset=".48" stop-color="#4d5660"/>
          <stop offset="1" stop-color="#2e3740"/>
        </linearGradient>
        <pattern id="${id('hatch')}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0 0V7" stroke="#c6d0d9" stroke-opacity=".15" stroke-width="1.6"/>
        </pattern>
        <linearGradient id="${id('red')}" x1="0" y1="0" x2=".5" y2="1">
          <stop stop-color="#e17b70"/><stop offset=".22" stop-color="#b44340"/>
          <stop offset=".8" stop-color="#83292e"/><stop offset="1" stop-color="#591a26"/>
        </linearGradient>
        <linearGradient id="${id('blue')}" x1="0" y1="0" x2=".7" y2="1">
          <stop stop-color="#629aaf"/><stop offset=".22" stop-color="#3c7296"/>
          <stop offset=".76" stop-color="#204366"/><stop offset="1" stop-color="#142f50"/>
        </linearGradient>
        <radialGradient id="${id('gloss')}" cx=".31" cy=".13" r=".86">
          <stop stop-color="#fff" stop-opacity=".28"/><stop offset=".35" stop-color="#fff" stop-opacity=".055"/>
          <stop offset=".63" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#00111c" stop-opacity=".17"/>
        </radialGradient>
        <linearGradient id="${id('edge')}" x1=".1" y1="0" x2=".75" y2="1">
          <stop stop-color="#fff9da" stop-opacity=".9"/><stop offset=".38" stop-color="#fff9da" stop-opacity=".13"/>
          <stop offset=".55" stop-color="#010b10" stop-opacity=".65"/><stop offset="1" stop-color="#010b10" stop-opacity=".85"/>
        </linearGradient>
        <clipPath id="${id('centre')}"><circle cx="120" cy="120" r="52"/></clipPath>
        <filter id="${id('shadow')}" x="-15%" y="-15%" width="130%" height="138%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#031218" flood-opacity=".56"/>
        </filter>
        <filter id="${id('type-shadow')}" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation=".6" flood-color="#050d11" flood-opacity=".75"/>
        </filter>
      </defs>`;

    const sectors = [
      { key: 'momentum', from: -150, to: -30, labelX: 120, labelY: 40, glyph: 'quill' },
      { key: 'influence', from: -30, to: 90, labelX: 191, labelY: 161, glyph: 'column' },
      { key: 'washingtonTrust', from: 90, to: 210, labelX: 49, labelY: 161, glyph: 'star' },
    ];
    const lock = (x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="#e3e8eb" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M-4-2v-3a4 4 0 0 1 8 0v3"/><rect x="-6" y="-2" width="12" height="10" rx="1.6" fill="#29333d"/><path d="M0 2v3"/></g>`;
    const glyph = (kind, x, y) => {
      const path = kind === 'quill'
        ? '<path d="M-6 5 5-6c4 3 0 9-4 9l-5 3m5-5 3 0M-7 7l3-3"/>'
        : kind === 'column'
          ? '<path d="m-7-4 7-4 7 4H-7m2 2v7M0-2v7M5-2v7M-7 7H7"/>'
          : '<path d="m0-8 2.3 5 5.5.6-4 3.7L5 7 0 4.2-5 7l1.2-5.7-4-3.7 5.5-.6Z"/>';
      return `<g transform="translate(${x} ${y})" fill="none" stroke="#f4e6bd" stroke-opacity=".9" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${path}</g>`;
    };
    const rings = sectors.map(({ key, from, to, labelX, labelY, glyph: symbol }) => {
      const locked = key === 'washingtonTrust' && state.locked;
      const full = sector(52, 108, from, to);
      const radius = progressRadius(value(key));
      return `<g class="compass-part" data-stat="${key}" tabindex="0" role="button" aria-label="${key}">
        <path d="${full}" fill="${ref(locked ? 'locked' : 'empty')}"/>
        ${locked
          ? `<path d="${full}" fill="${ref('hatch')}"/>`
          : value(key) > 0 ? `<path d="${sector(52, radius, from, to)}" fill="${ref(key)}"/><path d="${arc(radius, from, to)}" stroke="#edf4e4" stroke-opacity=".45" stroke-width="1.2" fill="none"/>` : ''}
        <path d="${full}" fill="transparent"/>
        <g pointer-events="none" filter="${ref('type-shadow')}">
          ${locked ? lock(labelX, labelY - 9) : glyph(symbol, labelX, labelY - 12)}
          <text x="${labelX}" y="${labelY + 12}" fill="${locked ? '#d4dce3' : '#fff4d4'}" font-family="Georgia, 'Times New Roman', serif" font-size="23" font-weight="700" text-anchor="middle">${locked ? '—' : value(key)}</text>
        </g>
      </g>`;
    }).join('');

    const redNumberY = Math.min(110, (68 + relationY) / 2 + 6);
    const blueNumberY = Math.max(144, (172 + relationY) / 2 + 6);
    const centre = `<g clip-path="${ref('centre')}">
      <g class="compass-part" data-stat="burrRivalry" tabindex="0" role="button" aria-label="burrRivalry">
        <rect x="68" y="68" width="104" height="${relationY - 68}" fill="${ref('red')}"/>
        <text x="120" y="${redNumberY}" fill="#fff1db" font-family="Georgia, 'Times New Roman', serif" font-size="23" font-weight="700" text-anchor="middle" pointer-events="none" filter="${ref('type-shadow')}">${value('burrRivalry')}</text>
      </g>
      <g class="compass-part" data-stat="burrRespect" tabindex="0" role="button" aria-label="burrRespect">
        <rect x="68" y="${relationY}" width="104" height="${172 - relationY}" fill="${ref('blue')}"/>
        <text x="120" y="${blueNumberY}" fill="#eaf7fc" font-family="Georgia, 'Times New Roman', serif" font-size="23" font-weight="700" text-anchor="middle" pointer-events="none" filter="${ref('type-shadow')}">${value('burrRespect')}</text>
      </g>
      <path d="M68 ${relationY}H172" stroke="${ref('gold')}" stroke-width="1.1" pointer-events="none"/>
    </g>`;

    const seams = [-150, -30, 90].map((angle) => {
      const a = point(52, angle);
      const b = point(108, angle);
      return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`;
    }).join('');
    return `${defs}<g filter="${ref('shadow')}">${rings}${centre}
      <g pointer-events="none">
        <circle cx="120" cy="120" r="107.5" fill="${ref('gloss')}"/>
        <circle cx="120" cy="120" r="106.4" fill="none" stroke="${ref('edge')}" stroke-width="2.5"/>
        <circle cx="120" cy="120" r="108" fill="none" stroke="${ref('gold')}" stroke-width="1.2"/>
        <circle cx="120" cy="120" r="52" fill="none" stroke="${ref('gold')}" stroke-width="1.2"/>
        <circle cx="120" cy="120" r="50.7" fill="none" stroke="${ref('edge')}" stroke-width="1.4"/>
        <g fill="none" stroke="${ref('gold')}" stroke-width="1.05">${seams}</g>
        <path d="${arc(104.5, -146, -47)}" fill="none" stroke="#fff4c9" stroke-opacity=".53" stroke-width=".65"/>
      </g>
    </g>`;
  },
};
