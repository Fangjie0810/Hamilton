import { variant as enamel } from './enamel.mjs';
import { variant as glass } from './glass.mjs';
import { variant as tactical } from './tactical.mjs';
import { progressRadius } from './shared.mjs';
import { bi, f, setText, setLabel } from '../../src/i18n/text.ts';

const variants = [enamel, glass, tactical];
const presets = {
  arrival: { momentum: 61, influence: 26, washingtonTrust: 0, burrRivalry: 18, burrRespect: 24, locked: true },
  camp: { momentum: 72, influence: 43, washingtonTrust: 38, burrRivalry: 28, burrRespect: 32, locked: false },
  equal: { momentum: 50, influence: 50, washingtonTrust: 50, burrRivalry: 25, burrRespect: 25, locked: false },
};
let state = { ...presets.arrival }, language = 'zh', background = 'scene', actualSize = false;
// The study's language switch stays local; it does not overwrite the game's saved preference.
const text = copy => copy[language];
const copy = {
  title: bi('同一组属性，三种质感', 'One set of attributes. Three materials.'),
  intro: bi('透明底 · 中心与外环无缝相接 · 进度由内向外生长', 'Transparent backing · Seamless core and ring · Progress grows outward'),
  live: bi('试着改变数值', 'Try changing the values'), reset: bi('重置', 'Reset'),
  arrival: bi('街头 · 锁定', 'Street · Locked'), camp: bi('军营 · 解锁', 'Camp · Unlocked'), equal: bi('各项 50', 'All at 50'),
  lock: bi('华盛顿信任尚未解锁', 'Washington Trust is locked'),
  background: bi('查看背景', 'Preview backdrop'), scene: bi('游戏场景', 'Game scene'), checker: bi('透明网格', 'Transparency grid'), light: bi('浅色底', 'Light'),
  size: bi('按游戏实际尺寸查看 · 174 px', 'View at game size · 174 px'),
  empty: bi('未填充：浅烟灰，能透出场景', 'Unfilled: light smoke; the scene shows through'),
  locked: bi('锁定：更深的实灰＋斜纹＋锁头', 'Locked: deeper solid grey, hatching and a lock'),
  note: bi('拖动滑块观察径向进度；悬停或点击圆盘上的五个部分查看指标。红上蓝下仍表示竞争与尊重，面积放大两项的差异。', 'Drag the sliders to see radial progress. Hover or click any of the five parts for details. Red above and blue below still represent rivalry and respect; the split exaggerates their difference.'),
  footer: bi('已选定 C「战役徽章」并接入游戏 · 三版保留供对照', 'C · Campaign Insignia is now used in the game · All three studies are kept for comparison'),
  download: bi('下载三版对比图', 'Download comparison'),
};
const metrics = {
  momentum: { name: bi('锐气', 'Momentum'), color: '#d6a62d', info: bi('主动争取机会的劲头。黄色进度从中心边缘向外扩展，增加的是厚度，而非绕圈的角度。', 'Your drive to seize opportunities. Yellow grows outward from the core, adding radial depth instead of sweeping around the ring.') },
  influence: { name: bi('影响力', 'Influence'), color: '#303738', info: bi('愿意听你说话、传播主张的人。黑色是已有影响力，外侧的透光灰仍是未填充部分。', 'People willing to listen and spread your ideas. Black shows existing influence; translucent grey outside remains unfilled.') },
  washingtonTrust: { name: bi('华盛顿信任', 'Washington Trust'), color: '#27634b', info: bi('进入军营后开启。解锁后以墨绿色从内向外填充；锁定时使用独立的深灰斜纹表面。', 'Unlocks in camp. Dark green then grows outward; a locked sector uses a distinct deep-grey hatched surface.') },
  burrRivalry: { name: bi('伯尔 · 竞争', 'Burr · Rivalry'), color: '#b33e3c', info: bi('伯尔把你视为值得认真面对的对手。中心上方红色区域代表竞争；数值独立于尊重。', 'Burr sees you as an opponent worth taking seriously. Red above shows rivalry, independently of respect.') },
  burrRespect: { name: bi('伯尔 · 尊重', 'Burr · Respect'), color: '#407b9e', info: bi('伯尔对你判断力的认可。中心下方蓝色区域代表尊重；两项关系可以同时增长。', 'Burr’s regard for your judgment. Blue below shows respect; both relationships can grow together.') },
};

const cards = variants.map((variant, index) => {
  const article = document.createElement('article'); article.className = 'design'; article.dataset.variant = variant.id;
  article.innerHTML = `<header><span class="option-code">${String.fromCharCode(65 + index)}</span><div><h2></h2><p></p></div></header><div class="stage" data-background="scene"><span class="stage-note"></span><svg class="dial" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="group"></svg><div class="tooltip" role="tooltip" hidden></div></div><div class="description"></div><div class="exports"><a class="png" download></a><a class="svg" download>SVG</a></div>`;
  document.querySelector('#comparisons').append(article);
  return { variant, article, svg: article.querySelector('svg'), stage: article.querySelector('.stage'), tooltip: article.querySelector('.tooltip') };
});
for (const [key, metric] of Object.entries(metrics)) {
  const label = document.createElement('label'); label.className = 'range-row'; label.style.setProperty('--metric', metric.color);
  label.innerHTML = `<span class="range-label"></span><output></output><input type="range" min="0" max="100" step="1" data-key="${key}">`;
  label.querySelector('input').addEventListener('input', event => { state[key] = Number(event.target.value); renderDials(); updateControls(); });
  document.querySelector('#sliders').append(label);
}
const detail = document.querySelector('#detail');
let previousFocus;
function openDetail(key, index) {
  previousFocus = document.activeElement;
  setText(document.querySelector('#detail-code'), `HAMILTON · ${String.fromCharCode(65 + index)}`);
  setText(document.querySelector('#detail-name'), text(metrics[key].name));
  setText(document.querySelector('#detail-value'), key === 'washingtonTrust' && state.locked ? text(bi('尚未解锁', 'Locked')) : String(state[key]));
  setText(document.querySelector('#detail-copy'), text(metrics[key].info));
  detail.showModal();
}
document.querySelector('#close-detail').onclick = () => detail.close();
detail.addEventListener('close', () => previousFocus?.focus());
function renderDials() {
  cards.forEach(({ variant, svg, article, tooltip }, index) => {
    svg.innerHTML = variant.render(state, `study-${variant.id}`);
    setLabel(svg, 'aria-label', text(variant.title));
    article.dataset.locked = String(state.locked);
    for (const part of svg.querySelectorAll('[data-stat]')) {
      const key = part.dataset.stat, metric = metrics[key];
      setLabel(part, 'aria-label', text(f(bi('{0} · {1}', '{0} · {1}'), metric.name, key === 'washingtonTrust' && state.locked ? bi('未解锁', 'Locked') : state[key])));
      part.setAttribute('aria-haspopup', 'dialog');
      part.dataset.value = state[key]; part.dataset.locked = String(key === 'washingtonTrust' && state.locked);
      if (['momentum', 'influence', 'washingtonTrust'].includes(key)) part.dataset.radius = progressRadius(key === 'washingtonTrust' && state.locked ? 0 : state[key]);
      const show = () => { setText(tooltip, text(f(bi('{0} · 点击了解含义', '{0} · Click for details'), part.getAttribute('aria-label')))); tooltip.hidden = false; };
      const hide = () => { tooltip.hidden = true; };
      part.addEventListener('pointerenter', show); part.addEventListener('pointerleave', hide);
      part.addEventListener('focus', show); part.addEventListener('blur', hide);
      part.addEventListener('click', () => { hide(); openDetail(key, index); });
      part.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hide(); openDetail(key, index); } });
    }
  });
}
function updateControls() {
  document.querySelectorAll('.range-row').forEach(row => {
    const input = row.querySelector('input'), key = input.dataset.key;
    setText(row.querySelector('.range-label'), text(metrics[key].name));
    setText(row.querySelector('output'), String(state[key])); input.value = state[key];
    input.disabled = key === 'washingtonTrust' && state.locked;
    setLabel(input, 'aria-label', text(metrics[key].name));
  });
  document.querySelector('#locked').checked = state.locked;
}
function translate() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-copy]').forEach(node => { setText(node, text(copy[node.dataset.copy])); });
  setText(document.querySelector('#language'), language === 'zh' ? 'English' : '中文');
  setLabel(document.querySelector('#close-detail'), 'aria-label', text(bi('关闭', 'Close')));
  cards.forEach(({ variant, article }) => {
    setText(article.querySelector('h2'), text(variant.title));
    setText(article.querySelector('header p'), text(variant.subtitle));
    setText(article.querySelector('.description'), text(variant.summary));
    setText(article.querySelector('.stage-note'), text(bi('悬停查看 · 点击说明', 'Hover to inspect · Click for details')));
    setText(article.querySelector('.png'), text(bi('样稿透明 PNG', 'Sample transparent PNG')));
    article.querySelector('.png').href = `./exports/${variant.id}-${state.locked ? 'locked' : 'unlocked'}.png`;
    article.querySelector('.svg').href = `./exports/${variant.id}-${state.locked ? 'locked' : 'unlocked'}.svg`;
  });
  updateControls(); renderDials();
}
document.querySelector('#language').onclick = () => { language = language === 'zh' ? 'en' : 'zh'; translate(); };
document.querySelector('#reset').onclick = () => { state = { ...presets.arrival }; translate(); };
document.querySelector('#locked').onchange = event => { state.locked = event.target.checked; translate(); };
document.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => { state = { ...presets[button.dataset.preset] }; translate(); });
document.querySelectorAll('[data-background]').forEach(button => {
  if (button.tagName !== 'BUTTON') return;
  button.onclick = () => { background = button.dataset.background; cards.forEach(({ stage }) => { stage.dataset.background = background; }); updateBackgroundButtons(); };
});
function updateBackgroundButtons() { document.querySelectorAll('button[data-background]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.background === background))); }
document.querySelector('#actual-size').onchange = event => { actualSize = event.target.checked; document.body.classList.toggle('actual-size', actualSize); };
// Read-only fixture rendering for exported transparent assets and consistent comparisons.
window.compassStudies = { variants: variants.map(item => item.id), render: (id, values, uid = 'export') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="720" height="720">${variants.find(v => v.id === id).render(values, uid)}</svg>`, getState: () => ({ ...state }), preset: name => { state = { ...presets[name] }; translate(); } };
translate(); updateBackgroundButtons();
