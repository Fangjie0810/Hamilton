import './gallery.css';
import { bi, setLabel, setText } from '../i18n/text';
import { el } from '../ui/Activity';

const root = document.querySelector<HTMLElement>('#gallery')!;
const header = el('header');
header.append(el('p', 'gallery-eyebrow', bi('HAMILTON · 互动效果预演', 'HAMILTON · INTERACTION PREVIEW')),
  el('h1', '', bi('熟悉的圆盘，在左侧呈现变化。', 'The familiar dial, changing on the left.')),
  el('p', 'gallery-intro', bi('直接复用左上角 HUD 圆盘。在左侧放大 50%，呈现本次属性变化，再恢复原大小。以下为真实游戏录屏。', 'The upper-left HUD dial grows by 50% on the left, shows the attribute change, then returns. Watch the actual game recording below.')));
root.append(header);
const grid = el('div', 'gallery-grid');
const card = el('article', 'gallery-card compass');
const video = document.createElement('video');
video.src = '/artifacts/compass-motion.mp4'; video.poster = '/artifacts/compass-final.png';
video.controls = true; video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'metadata';
setLabel(video, 'aria-label', bi('HUD 圆盘左侧放大动画', 'HUD dial left-side growth animation'));
const copy = el('div', 'gallery-copy');
const link = el('a', 'gallery-play', bi('进入游戏体验 →', 'Try in the game →'));
link.href = '/?story=3d&debug=1&review=compass';
copy.append(el('p', 'gallery-note', bi('当前预演 · 等待确认', 'CURRENT PREVIEW · AWAITING APPROVAL')),
  el('h2', '', bi('HUD 圆盘 · 左侧变化', 'HUD dial · Left-side change')),
  el('p', 'gallery-timing', bi('放大 → 数值与扇区变化 → 收回 · 3.5 秒', 'Expand → Values and sectors change → Return · 3.5 s')),
  el('p', 'gallery-body', bi('保留原圆盘的材质、五个指标与锁定状态。变化区域短暂亮起，填充面积与数字同步过渡；连续变化依次呈现。', 'The original material, five indicators, and locked state remain. Changed regions glow briefly as their fill and numbers move together. Consecutive changes play in order.')), link);
card.append(video, copy); grid.append(card); root.append(grid);
const footer = el('footer');
setText(footer, bi('已实际查看探索、对话与小窗口截图；已检查四种语言和系统减少动态。此版独立保存，确认后再合并。', 'Exploration, dialogue, and compact-window screenshots have been inspected. All four language modes and system reduced motion have been checked. This preview stays isolated until approval.'));
root.append(footer);
