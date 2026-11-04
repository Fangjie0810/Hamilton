import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** These code-native figures intentionally retain the game's faceless block language. */
type Hair = 'pony' | 'cropped' | 'bald' | 'curls' | 'high-curls' | 'knit' | 'wig' | 'cap' | 'bonnet' | 'tricorne';
interface Figure { id: string; name: string; skin: string; hairColor: string; hair: Hair; coat: string; facing: string; vest: string; trousers: string; build?: 'broad' | 'small'; detail?: 'general' | 'apron' | 'crossbelt' | 'rolled' }
const figures: Figure[] = [
  { id:'hamilton',name:'汉密尔顿',skin:'#c7a486',hairColor:'#251d1b',hair:'pony',coat:'#244e6b',facing:'#d3b983',vest:'#e9dfc5',trousers:'#cfc5ab' },
  { id:'burr',name:'伯尔',skin:'#855a40',hairColor:'#201a17',hair:'cropped',coat:'#35373a',facing:'#5b3b4d',vest:'#735462',trousers:'#bcb097' },
  { id:'washington',name:'华盛顿',skin:'#9d7254',hairColor:'#30241d',hair:'bald',coat:'#24435a',facing:'#d0ac64',vest:'#dac9a0',trousers:'#d3c4a3',build:'broad',detail:'general' },
  { id:'laurens',name:'劳伦斯',skin:'#c69a76',hairColor:'#36251a',hair:'curls',coat:'#346780',facing:'#d6c599',vest:'#ebe0c6',trousers:'#d5c7a7' },
  { id:'lafayette',name:'拉法耶特',skin:'#ac805b',hairColor:'#251e19',hair:'high-curls',coat:'#2a526d',facing:'#d1b37f',vest:'#e9ddc3',trousers:'#d0c1a0' },
  { id:'mulligan',name:'穆利根',skin:'#805a43',hairColor:'#251e1a',hair:'knit',coat:'#315954',facing:'#527069',vest:'#cbbb98',trousers:'#69604d',build:'broad' },
  { id:'loyalist',name:'保皇派撰稿人',skin:'#d5ba9b',hairColor:'#67503c',hair:'wig',coat:'#544238',facing:'#88725b',vest:'#aa8c66',trousers:'#c9b799' },
  { id:'newsboy',name:'报童',skin:'#b59070',hairColor:'#4a3524',hair:'cap',coat:'#887451',facing:'#ab936b',vest:'#c2b499',trousers:'#665c4b',build:'small' },
  { id:'citizen',name:'市民',skin:'#ad7b59',hairColor:'#31251e',hair:'bonnet',coat:'#58656b',facing:'#8d9a98',vest:'#d7ccb3',trousers:'#4b555a',detail:'apron' },
  { id:'revolutionary',name:'革命群众',skin:'#9b7154',hairColor:'#2a211b',hair:'pony',coat:'#d4c5a8',facing:'#b4a386',vest:'#c2b493',trousers:'#bca98a',detail:'rolled' },
  { id:'soldier',name:'大陆军士兵',skin:'#b68d68',hairColor:'#35271d',hair:'tricorne',coat:'#36546a',facing:'#cdb48a',vest:'#d3c6a7',trousers:'#c5b799',detail:'crossbelt' },
];

function svg(f: Figure, variant: 'a'|'b'|'c') {
  const broad = f.build === 'broad' ? 8 : f.build === 'small' ? -7 : 0;
  const edge = variant === 'c' ? '#1a1714' : variant === 'b' ? '#a492702e' : '#e6d9ba40';
  const sw = variant === 'c' ? 2.8 : variant === 'b' ? 1 : 1.3;
  const headX = 80 - (broad > 0 ? 3 : 0), headW = 40 + (broad > 0 ? 6 : 0);
  let hair = '';
  const hc = f.hairColor;
  if (f.hair === 'pony') hair = `<path d="M78 79Q76 51 99 49Q122 50 122 77L115 71L113 61L84 69Z" fill="${hc}"/><path d="M118 74Q138 77 130 100L123 107L126 77Z" fill="${hc}"/><rect x="120" y="78" width="9" height="5" fill="#a9977c"/>`;
  if (f.hair === 'cropped') hair = `<path d="M79 69Q79 48 100 49Q120 49 121 67L113 61L85 62Z" fill="${hc}"/>`;
  if (f.hair === 'bald') hair = `<path d="M79 69Q79 46 100 46Q122 48 121 69" fill="${f.skin}"/>`;
  if (f.hair === 'curls' || f.hair === 'high-curls') hair = `<g fill="${hc}"><path d="M77 74Q72 45 99 46Q124 42 123 73L115 64L88 63Z"/>${[0,1,2,3,4].map((n)=>`<circle cx="${80+n*9}" cy="${53-(n%2)*5}" r="8"/>`).join('')}${f.hair === 'high-curls' ? '<circle cx="112" cy="39" r="16"/><circle cx="121" cy="29" r="11"/><circle cx="103" cy="32" r="10"/>' : '<path d="M119 71Q139 66 135 91Q132 103 124 95Z"/>'}</g>`;
  if (f.hair === 'knit') hair = '<path d="M76 69Q73 38 99 39Q128 39 126 70Z" fill="#8b8679"/><rect x="74" y="61" width="54" height="12" rx="2" fill="#b2a991"/><path d="M83 47L82 60M91 43L90 60M101 43V60M111 44L112 60M119 49L121 60" stroke="#615f54" stroke-width="2"/>';
  if (f.hair === 'wig') hair = `<path d="M76 87L70 83L72 58Q82 37 101 42Q123 43 129 62L128 91L120 87L118 62L86 62L83 88Z" fill="${hc}"/><path d="M127 79L138 109L128 112L122 84" fill="${hc}"/>`;
  if (f.hair === 'cap') hair = '<path d="M71 66Q72 40 100 43L125 59L130 69Z" fill="#554c3f"/><path d="M71 64H129L138 71H77Z" fill="#7e6b50"/>';
  if (f.hair === 'bonnet') hair = '<path d="M69 80Q62 41 98 38Q131 40 131 80L119 90L118 61L81 65L82 91Z" fill="#d6c8ad"/><path d="M79 83L91 116L100 119L119 83" fill="none" stroke="#c3b397" stroke-width="4"/>';
  if (f.hair === 'tricorne') hair = '<path d="M65 67L70 42L101 50L129 40L139 68L103 59Z" fill="#242526" stroke="#aa9469" stroke-width="3"/>';
  const epaulettes = f.detail === 'general' ? '<g fill="#bf9855"><rect x="48" y="107" width="25" height="8"/><rect x="128" y="107" width="25" height="8"/><path d="M50 115V124M55 115V126M61 115V125M67 115V122M132 115V124M138 115V126M145 115V125M151 115V122" stroke="#bf9855" stroke-width="3"/></g>' : '';
  const detail = f.detail === 'crossbelt' ? '<path d="M67 108L128 188M132 108L72 188" stroke="#e3d6b9" stroke-width="9"/><rect x="91" y="150" width="15" height="14" fill="#b19a64"/>' : f.detail === 'apron' ? '<path d="M78 163H122L139 259H63Z" fill="#c9b99a"/><path d="M78 170H122" stroke="#8c7d66" stroke-width="3"/>' : f.detail === 'general' ? '<path d="M68 109L128 188" stroke="#8cb9c9" stroke-width="7"/>' : '';
  const seams = variant !== 'a' ? `<g fill="none" stroke="#f0dcc14d" stroke-width="1.3"><path d="M${62-broad} 124L${66-broad} 177L${57-broad} 228M${137+broad} 125L${134+broad} 177L${142+broad} 228M82 194V235M114 194V235"/><path d="M${46-broad} 152L${61-broad} 155M${139+broad} 155L${154+broad} 152"/></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 200 300"><title>${f.name} — ${variant.toUpperCase()} · 无五官衣装角色</title><g stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round"><path d="M77 205H96L94 270H76Z" fill="${f.trousers}"/><path d="M105 205H124L126 270H107Z" fill="${f.trousers}"/><path d="M74 245H96V278H65V270L74 267Z" fill="#282622"/><path d="M105 245H127L129 266L137 272V278H105Z" fill="#282622"/><path d="M${64-broad} 107L85 100H115L${137+broad} 108L${145+broad} 232L108 225L100 182L92 225L${55-broad} 232Z" fill="${f.coat}"/><path d="M84 108H116L121 185H79Z" fill="${f.vest}"/><path d="M${63-broad} 110L${48-broad} 120L${40-broad} 183L${57-broad} 188L${73-broad} 123Z" fill="${f.coat}"/><path d="M${135+broad} 110L${151+broad} 120L${158+broad} 183L${141+broad} 188L${126+broad} 123Z" fill="${f.coat}"/><path d="M${41-broad} 179L${59-broad} 183L${57-broad} 199L${39-broad} 195Z" fill="${f.facing}"/><path d="M${141+broad} 183L${158+broad} 179L${161+broad} 195L${143+broad} 199Z" fill="${f.facing}"/><rect x="${40-broad}" y="196" width="14" height="18" rx="3" fill="${f.skin}"/><rect x="${147+broad}" y="195" width="14" height="18" rx="3" fill="${f.skin}"/><path d="M82 102L70 115L88 161L91 121Z" fill="${f.facing}"/><path d="M116 102L130 115L111 161L109 121Z" fill="${f.facing}"/><path d="M92 93H108V115H92Z" fill="${f.skin}"/><rect x="${headX}" y="56" width="${headW}" height="46" rx="8" fill="${f.skin}" stroke="none"/><path d="M88 104L101 111L112 103L109 116L99 128L90 116Z" fill="#ebe1cc"/><path d="M96 121L102 139L108 122" fill="#d4c5a6"/>${hair}${epaulettes}${detail}${[133,150,167].map((y)=>`<circle cx="96" cy="${y}" r="1.8" fill="#aa8c55"/><circle cx="106" cy="${y}" r="1.8" fill="#aa8c55"/>`).join('')}${seams}</g></svg>`;
}

const output = path.resolve('public/art/sprites');
await mkdir(output, { recursive: true });
const manifest = [];
for (const figure of figures) for (const variant of ['a','b','c'] as const) {
  const file = `${figure.id}-${variant}.svg`;
  await writeFile(path.join(output, file), svg(figure, variant), 'utf8');
  manifest.push({ id: `${figure.id}-${variant}`, character: figure.id, title: figure.name, variant, style: {a:'纯色剪影',b:'细线衣褶',c:'清晰轮廓'}[variant], path: `/art/sprites/${file}`, width: 400, height: 600, format:'svg', source:'scripts/generate-sprites.ts' });
}
await mkdir('art-direction', { recursive: true });
await writeFile('art-direction/sprites.json', JSON.stringify(manifest, null, 2));
console.log(`Saved ${manifest.length} editable faceless costume sprites.`);
