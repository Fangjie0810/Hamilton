import './style.css';
import chartData from './chart.json';
import { bi, f, setText, setLabel, primaryText, languageOptions, getLanguage, setLanguage, onLanguageChange, type BiText, type LanguageMode } from '../../src/i18n/text';
import { RhythmJudge } from './engine';
import { AudioTransport } from './audio';
import type { Chart, ChartNote, JudgementEvent } from './types';

const chart = chartData as unknown as Chart;
const audio = new AudioTransport();
const KEYS = ['D', 'F', 'J', 'K'];
const CODES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
const COLORS = ['#e3b866', '#f3d7a1', '#c8d6b4', '#8cb89c'];
const copy = {
  rhythm: bi('音游实验 · 01', 'RHYTHM STUDY · 01'),
  subtitle: bi('把听过无数次的旋律，交给你的指尖。', 'You know every beat. Now make it yours.'),
  cast: bi('《汉密尔顿》百老汇原声带', 'HAMILTON · ORIGINAL BROADWAY CAST'),
  prototype: bi('本地试玩', 'LOCAL PROTOTYPE'),
  mode: bi('读谱方式', 'READ THE MUSIC'),
  falling: bi('下落音符', 'Falling notes'), circles: bi('圆点收圈', 'Approach circles'),
  arrangement: bi('谱面', 'ARRANGEMENT'), beginner: bi('入门', 'Beginner'), normal: bi('标准', 'Standard'),
  range: bi('演奏范围', 'PLAY RANGE'), full: bi('完整歌曲', 'Full song'), sample: bi('开场 45 秒', 'Opening · 45 sec'),
  section: bi('分段练习', 'Section practice'), start: bi('开始演奏', 'Play the song'), demo: bi('先看演示', 'Watch the chart'),
  pause: bi('暂停', 'Pause'), resume: bi('继续演奏', 'Resume'), restart: bi('重新开始', 'Restart'),
  ready: bi('轮到你了。', 'Your moment.'),
  how: bi('音符落到金线，按下对应按键。', 'Press the matching key as the note reaches the gold line.'),
  howCircles: bi('外圈收拢到目标圆时，按下圆中的字母。', 'Press the letter when the outer ring meets the target circle.'),
  help: bi('空格 暂停 / 继续 · Esc 暂停 · R 重来', 'Space pause / resume · Esc pause · R restart'),
  audioLoading: bi('正在准备原声带…', 'Preparing the soundtrack…'),
  error: bi('音频未能加载。请确认本地服务正常，然后重试。', 'Could not load the audio. Check the local server, then retry.'),
  paused: bi('乐句，为你停留。', 'Hold that thought.'), pauseHelp: bi('继续后会预备一拍，再回到刚才的位置。', 'A short count-in brings you back to the same moment.'),
  finished: bi('这一刻，属于你。', 'That was your shot.'), demoFinished: bi('现在，换你来。', 'Now take your shot.'),
  demoLabel: bi('自动演示 · 不计入成绩', 'AUTOPLAY · NOT A PERSONAL SCORE'),
  playing: bi('演奏中', 'PLAYING'), readyLabel: bi('准备就绪', 'READY WHEN YOU ARE'),
  score: bi('得分', 'SCORE'), accuracy: bi('准确率', 'ACCURACY'), combo: bi('连击', 'COMBO'),
  maxCombo: bi('最高连击', 'BEST COMBO'), perfect: bi('完美', 'PERFECT'), great: bi('准确', 'GREAT'), good: bi('命中', 'GOOD'), miss: bi('错过', 'MISS'), ghost: bi('空按', 'EMPTY HIT'),
  notes: bi('{0} 个音符', '{0} notes'), progress: bi('歌曲进度', 'Song progress'),
  timing: bi('手感调整', 'MAKE IT FEEL RIGHT'), offset: bi('输入校准', 'Input offset'),
  offsetHelp: bi('总是偏晚：往正值调；总是偏早：往负值调。', 'Usually late? Increase this. Usually early? Decrease it.'),
  lead: bi('音符预告', 'Note lead time'), volume: bi('音乐音量', 'Music volume'), guide: bi('节拍参考音', 'Beat guide'),
  guideHelp: bi('叠加节拍声，帮助听清谱面重拍。', 'Adds a quiet click to make the chart pulse audible.'),
  musicNote: bi('先跟住鼓点，再进入说唱的切分。', 'Find the pulse. Then lean into the syncopation.'),
  analysis: bi('关于这份谱面', 'ABOUT THIS CHART'),
  analysisText: bi('基于所附录音的节拍与起音分析，再用乐句节奏型编排。入门保留主脉冲，标准加入切分与重音双押。当前为实验谱，仍需实际演奏听审。', 'Built from beat and onset analysis of this recording, with arranged phrase patterns. Beginner follows the pulse; Standard adds syncopation and accent chords. An experimental chart, pending musical playtesting.'),
  early: bi('偏早 {0} ms', '{0} ms early'), late: bi('偏晚 {0} ms', '{0} ms late'), onTime: bi('正中节拍', 'Right on the beat'),
  demoHelp: bi('观察音符如何对应音乐；演示结束后可以亲自尝试。', 'Listen to how the notes fit the music, then try it yourself.'),
  back: bi('返回准备', 'Back to setup'), language: bi('语言', 'Language'),
  practice: bi('练习段落', 'PRACTICE SEGMENT'), introTag: bi('四个按键 · 一首熟悉的歌', 'FOUR KEYS. ONE FAMILIAR SONG.'),
  resultDetail: bi('完成 {0} / {1} 个音符', '{0} / {1} notes judged'),
};
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: BiText | string) {
  const node = document.createElement(tag); node.className = cls;
  if (text !== undefined) setText(node, text); return node;
}
function label(text: BiText, control: HTMLElement) { const node = el('label', 'field'); node.append(el('span', 'field-label', text), control); return node; }
function button(text: BiText, cls = '', handler?: () => void) { const node = el('button', cls, text); node.type = 'button'; if (handler) node.addEventListener('click', handler); return node; }
function options(items: [string, BiText][]) { const node = el('select'); for (const [value, text] of items) { const option = el('option', '', text); option.value = value; node.append(option); } return node; }
function clock(t: number) { const seconds = Math.max(0, Math.floor(t)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function readSetting(key: string, fallback: number) { try { const value = localStorage.getItem(`ham:rhythm:${key}`); return value === null || !Number.isFinite(Number(value)) ? fallback : Number(value); } catch { return fallback; } }
function saveSetting(key: string, value: number) { try { localStorage.setItem(`ham:rhythm:${key}`, String(value)); } catch { /* Controls remain usable without storage. */ } }
const app = document.querySelector<HTMLDivElement>('#app')!;
const page = el('div', 'page'); app.append(page);
const masthead = el('header', 'masthead');
const brand = el('div', 'brand'); brand.append(el('span', 'star', '★'), el('span', '', bi('HAMILTON', 'HAMILTON')), el('span', 'brand-divider', '/'), el('span', 'study', copy.rhythm));
const lang = el('select', 'language'); setLabel(lang, 'aria-label', copy.language);
for (const [mode, text] of languageOptions) { const option = el('option', '', text); option.value = mode; option.lang = mode === 'en' || mode === 'dual-en' ? 'en' : 'zh-CN'; lang.append(option); }
lang.value = getLanguage(); lang.addEventListener('change', () => setLanguage(lang.value as LanguageMode));
masthead.append(brand, lang); page.append(masthead);
const hero = el('section', 'hero'); const heroTitle = el('div');
heroTitle.append(el('p', 'eyebrow', copy.cast), el('h1', '', bi('MY SHOT', 'MY SHOT')), el('p', 'subtitle', copy.subtitle));
const heroMeta = el('div', 'hero-meta'); heroMeta.append(el('span', 'local-badge', copy.prototype), el('div', 'track-meta', f(bi('{0} / ~{1} BPM', '{0} / ~{1} BPM'), clock(chart.duration), Math.round(chart.bpm))), el('span', 'time-signature', '4/4'));
hero.append(heroTitle, heroMeta); page.append(hero);
const layout = el('main', 'layout'); const sidebar = el('aside', 'sidebar'); const theatre = el('section', 'theatre'); layout.append(sidebar, theatre); page.append(layout);
sidebar.append(el('div', 'sidebar-heading', bi('01 / 演奏设置', '01 / SET THE STAGE')));
const view = options([['falling', copy.falling], ['circles', copy.circles]]);
const difficulty = options([['beginner', copy.beginner], ['normal', copy.normal]]); difficulty.value = 'normal';
const range = options([['full', copy.full], ['sample', copy.sample], ...chart.sections.map(section => [section.id, section.label] as [string, BiText])]);
sidebar.append(label(copy.mode, view), label(copy.arrangement, difficulty), label(copy.range, range));
const noteCount = el('p', 'note-count'); sidebar.append(noteCount);
const settings = el('details', 'settings'); const summary = el('summary', '', copy.timing); settings.append(summary);
function slider(text: BiText, min: number, max: number, step: number, initial: number, key: string, suffix: string, onChange: (value: number) => void) {
  const input = el('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(Math.min(max, Math.max(min, readSetting(key, initial))));
  const row = el('div', 'slider-row'); const output = el('output'); output.textContent = `${input.value}${suffix}`; row.append(input, output);
  const wrapper = label(text, row); input.addEventListener('input', () => { output.textContent = `${input.value}${suffix}`; saveSetting(key, Number(input.value)); onChange(Number(input.value)); });
  setLabel(input, 'aria-label', text); settings.append(wrapper); return input;
}
let offset = Math.max(-200, Math.min(200, readSetting('offset', 0))) / 1000;
let leadTime = Math.max(1, Math.min(3, readSetting('lead', 1.8)));
const offsetControl = slider(copy.offset, -200, 200, 5, 0, 'offset', ' ms', value => offset = value / 1000);
settings.append(el('p', 'fine-print', copy.offsetHelp));
slider(copy.lead, 1, 3, .1, 1.8, 'lead', ' s', value => leadTime = value);
const volume = slider(copy.volume, 0, 100, 1, 75, 'volume', '%', value => audio.setVolume(value / 100)); audio.setVolume(Number(volume.value) / 100);
const guide = el('input'); guide.type = 'checkbox'; const guideLabel = el('label', 'checkbox'); guideLabel.append(guide, el('span', '', copy.guide)); settings.append(guideLabel, el('p', 'fine-print', copy.guideHelp));
guide.addEventListener('change', () => audio.setGuide(guide.checked, chart.beats)); sidebar.append(settings);
const sidebarFoot = el('div', 'sidebar-foot'); sidebarFoot.append(el('span', 'small-star', '✦'), el('p', '', copy.musicNote)); sidebar.append(sidebarFoot);
const scorebar = el('div', 'scorebar');
function stat(text: BiText, cls: string) { const wrap = el('div', `stat ${cls}`); const value = el('strong', '', '0'); wrap.append(el('span', 'stat-label', text), value); scorebar.append(wrap); return value; }
const scoreValue = stat(copy.score, 'score'); const accuracyValue = stat(copy.accuracy, 'accuracy'); const comboValue = stat(copy.combo, 'combo');
const status = el('span', 'status', copy.readyLabel); scorebar.append(status); theatre.append(scorebar);
const stage = el('div', 'stage'); const canvas = el('canvas', 'playfield'); setLabel(canvas, 'aria-label', bi('四键音游画面，D F J K 操作', 'Four-key rhythm playfield, controlled with D F J K')); canvas.tabIndex = -1;
const ctx = canvas.getContext('2d')!; stage.append(canvas);
const sectionLabel = el('div', 'section-label'); const judgement = el('div', 'judgement'); const judgementWord = el('strong'); const judgementTiming = el('span'); judgement.append(judgementWord, judgementTiming); stage.append(sectionLabel, judgement);
const overlay = el('div', 'overlay'); const overlayCard = el('div', 'overlay-card');
const overlayTag = el('p', 'eyebrow', copy.introTag); const overlayTitle = el('h2', '', copy.ready); const overlayText = el('p', 'overlay-description', copy.how);
const keyLegend = el('div', 'key-legend'); KEYS.forEach(key => keyLegend.append(el('kbd', '', key)));
const result = el('div', 'result-grid');
const play = button(copy.start, 'primary', () => { if (state === 'paused') void resume(); else void start(false); }); const demo = button(copy.demo, 'secondary', () => void start(true));
const overlayActions = el('div', 'overlay-actions'); overlayActions.append(play, demo); overlayCard.append(overlayTag, overlayTitle, overlayText, keyLegend, result, overlayActions); overlay.append(overlayCard); stage.append(overlay);
const countIn = el('div', 'count-in'); stage.append(countIn); theatre.append(stage);
const keyStrip = el('div', 'key-strip'); const keyButtons = KEYS.map((key, lane) => { const node = el('button', 'key-pad'); node.type = 'button'; node.append(el('kbd', '', key), el('span', 'key-line')); setLabel(node, 'aria-label', f(bi('敲击 {0} 轨', 'Play lane {0}'), key)); node.style.setProperty('--lane', COLORS[lane]); node.addEventListener('pointerdown', event => { event.preventDefault(); node.setPointerCapture(event.pointerId); pressLane(lane); }); node.addEventListener('pointerup', () => releaseLane(lane)); node.addEventListener('pointercancel', () => releaseLane(lane)); keyStrip.append(node); return node; }); theatre.append(keyStrip);
const transport = el('div', 'transport'); const pauseButton = button(copy.pause, 'transport-button', togglePause); const restartButton = button(copy.restart, 'transport-button', () => void start(isDemo)); const setupButton = button(copy.back, 'transport-button', reset);
const timeValue = el('span', 'time-value'); transport.append(pauseButton, restartButton, setupButton, timeValue); theatre.append(transport);
const timeline = el('div', 'timeline'); setLabel(timeline, 'aria-label', copy.progress); timeline.setAttribute('role', 'progressbar'); timeline.setAttribute('aria-valuemin', '0'); timeline.setAttribute('aria-valuemax', String(chart.duration)); const waveform = el('div', 'waveform'); const cursor = el('div', 'timeline-cursor'); const rangeHighlight = el('div', 'range-highlight'); timeline.append(rangeHighlight, waveform, cursor); theatre.append(timeline);
const below = el('div', 'below-stage'); const hint = el('span', '', copy.help); const segment = el('span'); below.append(hint, segment); theatre.append(below);
const footer = el('footer', 'footer'); const about = el('details', 'about'); about.append(el('summary', '', copy.analysis), el('p', '', copy.analysisText)); footer.append(about, el('span', 'footer-mark', bi('聆听。回应。留下你的声音。', 'LISTEN. RESPOND. LEAVE YOUR MARK.'))); page.append(footer);

let state: 'ready' | 'loading' | 'playing' | 'paused' | 'ended' | 'error' = 'ready';
let isDemo = false;
let selectedStart = 0; let selectedEnd = chart.duration;
const circleRows = new Map<string, number>();
let judge: RhythmJudge; let runToken = 0; let autoIndex = 0; let time = 0;
const pressed = new Set<number>(); const flashes = [0, 0, 0, 0];
let feedbackUntil = 0; let lastUI = 0; let width = 800; let height = 440; let lastSection = '';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function selection() {
  selectedStart = 0; selectedEnd = chart.duration;
  if (range.value === 'sample') selectedEnd = 45;
  else if (range.value !== 'full') { const section = chart.sections.find(section => section.id === range.value); if (section) { selectedStart = section.start; selectedEnd = section.end; } }
  judge = new RhythmJudge(chart.difficulties[difficulty.value as 'normal' | 'beginner'].notes, {start: selectedStart, end: selectedEnd});
  circleRows.clear(); const laneCounts = [0, 0, 0, 0]; for (const note of judge.notes) circleRows.set(note.id, laneCounts[note.lane]++ % 3);
  setText(noteCount, f(copy.notes, judge.notes.length));
  rangeHighlight.style.left = `${selectedStart / chart.duration * 100}%`; rangeHighlight.style.width = `${(selectedEnd - selectedStart) / chart.duration * 100}%`;
  setText(segment, range.value === 'full' ? copy.full : f(bi('练习 {0} — {1}', 'Practice {0} — {1}'), clock(selectedStart), clock(selectedEnd)));
}
function setLocked(locked: boolean) { difficulty.disabled = locked; range.disabled = locked; offsetControl.disabled = locked; }
function refreshUI() {
  const stats = judge.stats; scoreValue.textContent = String(stats.score).padStart(7, '0'); accuracyValue.textContent = stats.judged ? `${stats.accuracy.toFixed(1)}%` : '—'; comboValue.textContent = String(stats.combo).padStart(3, '0');
  setText(status, state === 'playing' ? isDemo ? copy.demoLabel : copy.playing : state === 'paused' ? copy.pause : state === 'loading' ? copy.audioLoading : copy.readyLabel);
  status.classList.toggle('is-demo', isDemo && state === 'playing');
  pauseButton.disabled = !['playing', 'paused'].includes(state); restartButton.disabled = state === 'loading'; setupButton.disabled = state === 'loading';
  setText(pauseButton, state === 'paused' ? copy.resume : copy.pause); setLocked(['playing', 'paused', 'loading'].includes(state));
  overlay.hidden = state === 'playing'; play.disabled = state === 'loading'; demo.disabled = state === 'loading';
  result.hidden = state !== 'ended'; keyLegend.hidden = state === 'ended'; demo.hidden = state === 'paused';
  if (state === 'ready') { setText(overlayTitle, copy.ready); setText(overlayText, view.value === 'falling' ? copy.how : copy.howCircles); setText(play, copy.start); setText(overlayTag, copy.introTag); setText(demo, copy.demo); }
  if (state === 'loading') { setText(overlayTitle, copy.audioLoading); setText(overlayText, copy.introTag); }
  if (state === 'paused') { setText(overlayTitle, copy.paused); setText(overlayText, copy.pauseHelp); setText(play, copy.resume); }
  if (state === 'error') { setText(overlayTitle, copy.error); setText(overlayText, copy.introTag); setText(play, copy.restart); }
  if (state === 'ended') {
    setText(overlayTitle, isDemo ? copy.demoFinished : copy.finished); setText(overlayTag, isDemo ? copy.demoLabel : copy.finished);
    setText(overlayText, isDemo ? copy.demoHelp : f(copy.resultDetail, stats.judged, stats.total)); setText(play, copy.restart); setText(demo, copy.demo);
    result.replaceChildren();
    if (!isDemo) for (const [title, value] of [[copy.perfect, stats.perfect], [copy.great, stats.great], [copy.good, stats.good], [copy.miss, stats.miss], [copy.maxCombo, stats.maxCombo], [copy.ghost, stats.ghost]] as [BiText, number][]) { const cell = el('div'); cell.append(el('strong', '', String(value)), el('span', '', title)); result.append(cell); }
  }
}
function clearKeys() { pressed.clear(); keyButtons.forEach(node => node.classList.remove('pressed')); judge.clearPressed(); }
function reset() { runToken++; audio.stop(); state = 'ready'; isDemo = false; selection(); clearKeys(); autoIndex = 0; time = selectedStart; lastSection = ''; judgement.hidden = true; refreshUI(); }
async function start(demonstration = false) {
  const token = ++runToken; audio.stop(); state = 'loading'; isDemo = demonstration; selection(); clearKeys(); autoIndex = 0; judgement.hidden = true; refreshUI();
  try {
    if (!audio.loaded) { await audio.load(`${import.meta.env.BASE_URL}my-shot.mp3`); if (token !== runToken) return; }
    renderWaveform();
    audio.setGuide(guide.checked, chart.beats);
    await audio.start(selectedStart, 2.1);
    if (token !== runToken) return;
    state = 'playing'; lastSection = ''; refreshUI(); canvas.focus({preventScroll: true});
  } catch (error) { if (token === runToken) { console.error(error); state = 'error'; audio.stop(); refreshUI(); } }
}
function pause() { if (state !== 'playing') return; time = audio.pause(); state = 'paused'; clearKeys(); refreshUI(); }
async function resume() { if (state !== 'paused') return; const token = ++runToken; state = 'loading'; refreshUI(); try { await audio.resume(1.1); if (token !== runToken) return; state = 'playing'; refreshUI(); canvas.focus({preventScroll: true}); } catch (error) { if (token === runToken) { console.error(error); state = 'error'; refreshUI(); } } }
function togglePause() { if (state === 'playing') pause(); else if (state === 'paused') void resume(); }
function end() { judge.finish(time - (isDemo ? 0 : offset)); audio.stop(); state = 'ended'; clearKeys(); consumeEvents(); refreshUI(); }
function pressLane(lane: number) {
  if (pressed.has(lane)) return;
  pressed.add(lane); keyButtons[lane].classList.add('pressed'); flashes[lane] = performance.now();
  if (state === 'playing' && !isDemo && audio.countInRemaining <= 0) { judge.press(lane, audio.now() - offset); consumeEvents(); }
}
function releaseLane(lane: number) { pressed.delete(lane); keyButtons[lane].classList.remove('pressed'); if (state === 'playing' && !isDemo) { judge.release(lane, audio.now() - offset); consumeEvents(); } }
function consumeEvents() {
  for (const event of judge.drainEvents()) {
    if (event.kind === 'hold') continue;
    const word = copy[event.kind as 'perfect' | 'great' | 'good' | 'miss' | 'ghost'];
    if (!word) continue;
    setText(judgementWord, word); judgement.dataset.kind = event.kind;
    if (['perfect', 'great', 'good'].includes(event.kind)) {
      flashes[event.lane] = performance.now(); const delta = Math.round(event.delta * 1000);
      setText(judgementTiming, Math.abs(delta) < 10 ? copy.onTime : f(delta < 0 ? copy.early : copy.late, Math.abs(delta)));
    } else setText(judgementTiming, bi('跟住下一个节拍', 'Find the next beat'));
    feedbackUntil = performance.now() + 650; judgement.hidden = false;
  }
}
for (const control of [difficulty, range]) control.addEventListener('change', reset);
view.addEventListener('change', () => { stage.dataset.view = view.value; if (state === 'ready') refreshUI(); });
onLanguageChange(() => { refreshUI(); lastSection = ''; });
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement)?.isContentEditable) return;
  if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
  const lane = CODES.indexOf(event.code);
  if (lane >= 0) { event.preventDefault(); if (!event.repeat) pressLane(lane); }
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) { if (state === 'ready' || state === 'ended' || state === 'error') void start(false); else togglePause(); } }
  if (event.code === 'Escape') pause();
  if (event.code === 'KeyR' && !event.repeat && state !== 'loading') void start(isDemo);
});
window.addEventListener('keyup', event => { const lane = CODES.indexOf(event.code); if (lane >= 0) releaseLane(lane); });
window.addEventListener('blur', () => { if (state === 'loading') { runToken++; audio.pause(); state = 'ready'; refreshUI(); } else pause(); clearKeys(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'loading') { runToken++; audio.pause(); state = 'ready'; refreshUI(); } else pause(); clearKeys(); } });

function renderWaveform() {
  waveform.replaceChildren();
  for (const amplitude of audio.waveform(160)) { const bar = el('i'); bar.style.height = `${Math.max(7, amplitude * 100)}%`; waveform.append(bar); }
}
for (let i = 0; i < 160; i++) { const bar = el('i'); bar.style.height = '8%'; waveform.append(bar); }
new ResizeObserver(entries => { const box = entries[0].contentRect; width = box.width; height = box.height; const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); }).observe(stage);
function line(x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1) { ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function roundRect(x: number, y: number, w: number, h: number, radius: number, fill: string) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
function drawStage(now: number, stamp: number) {
  ctx.clearRect(0, 0, width, height);
  const left = width * .17; const trackWidth = width * .66; const laneWidth = trackWidth / 4; const hitY = height * .84; const top = 30;
  const energy = reducedMotion.matches || state !== 'playing' ? .1 : audio.getEnergy();
  const glow = ctx.createRadialGradient(width / 2, height * .85, 5, width / 2, height * .6, width * .65); glow.addColorStop(0, `rgba(157,118,49,${.05 + energy * .1})`); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
  const displayTime = state === 'ready' || state === 'error' || state === 'loading' && !audio.loaded ? selectedStart + .2 : now;
  const visible = judge.notes.filter(note => note.time >= displayTime - .18 && note.time <= displayTime + leadTime && judge.state.get(note.id) === 'pending');
  if (view.value === 'falling') {
    for (let lane = 0; lane <= 4; lane++) line(left + laneWidth * lane, top, left + laneWidth * lane, hitY + 40, lane === 2 ? '#bcb08725' : '#d8c29b13');
    for (const beat of chart.beats) {
      const remaining = beat - displayTime; if (remaining < -.2 || remaining > leadTime) continue;
      const y = hitY - remaining / leadTime * (hitY - top); line(left, y, left + trackWidth, y, '#e8d5a310');
    }
    for (let lane = 0; lane < 4; lane++) {
      const center = left + (lane + .5) * laneWidth;
      const flash = Math.max(0, 1 - (stamp - flashes[lane]) / 240);
      if (flash > 0) { const gradient = ctx.createLinearGradient(0, hitY, 0, hitY - height * .45); gradient.addColorStop(0, `${COLORS[lane]}70`); gradient.addColorStop(1, `${COLORS[lane]}00`); ctx.globalAlpha = flash; ctx.fillStyle = gradient; ctx.fillRect(center - laneWidth / 2, hitY - height * .45, laneWidth, height * .45); ctx.globalAlpha = 1; }
      roundRect(center - laneWidth * .29, hitY - 4, laneWidth * .58, 8, 3, pressed.has(lane) ? COLORS[lane] : '#bdaa7838');
      ctx.fillStyle = '#b7ad93'; ctx.font = '14px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(KEYS[lane], center, hitY + 33);
    }
    line(left - 15, hitY, left + trackWidth + 15, hitY, '#d5b36d', 1.5);
    for (const note of visible) { const y = hitY - (note.time - displayTime) / leadTime * (hitY - top); const x = left + note.lane * laneWidth + laneWidth * .16; ctx.shadowColor = COLORS[note.lane]; ctx.shadowBlur = reducedMotion.matches ? 0 : 10; roundRect(x, y - 5, laneWidth * .68, 10, 3, COLORS[note.lane]); ctx.shadowBlur = 0; line(x + 4, y - 3, x + laneWidth * .68 - 4, y - 3, '#fff5d8a0'); }
  } else {
    for (let lane = 0; lane < 4; lane++) { const x = width * (.17 + lane * .22); line(x, 70, x, height - 45, '#d8c29b0b'); ctx.font = '15px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c8b47d66'; ctx.fillText(KEYS[lane], x, height - 30); }
    for (const note of [...visible].reverse()) {
      const phase = Math.max(0, Math.min(1, (note.time - displayTime) / leadTime));
      const x = width * (.17 + note.lane * .22); const y = height * (.30 + (circleRows.get(note.id) ?? 0) * .20); const radius = Math.max(18, Math.min(width * .035, 28));
      ctx.globalAlpha = Math.min(1, (1 - phase) * 4 + .15); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = `${COLORS[note.lane]}20`; ctx.fill(); ctx.strokeStyle = COLORS[note.lane]; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, radius + phase * Math.min(58, width * .07), 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = COLORS[note.lane]; ctx.font = 'bold 18px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(KEYS[note.lane], x, y + 6); ctx.globalAlpha = 1;
    }
    for (let lane = 0; lane < 4; lane++) { const flash = Math.max(0, 1 - (stamp - flashes[lane]) / 200); if (flash) { ctx.fillStyle = `${COLORS[lane]}12`; ctx.globalAlpha = flash; ctx.fillRect(width * (.06 + lane * .22), 0, width * .22, height); ctx.globalAlpha = 1; } }
  }
}
function frame(stamp: number) {
  if (state === 'playing') {
    audio.tick(); time = audio.now();
    if (audio.countInRemaining <= 0) {
      if (isDemo) { while (autoIndex < judge.notes.length && judge.notes[autoIndex].time <= time) { const note = judge.notes[autoIndex++]; judge.press(note.lane, note.time); judge.release(note.lane, note.time); } }
      judge.update(time - (isDemo ? 0 : offset)); consumeEvents();
      const tailGrace = isDemo ? 0 : Math.max(0, offset) + .15;
      if (time >= Math.min(selectedEnd + tailGrace, audio.duration) - .001) end();
    }
  }
  const countdown = state === 'playing' ? audio.countInRemaining : 0; countIn.hidden = countdown <= 0; if (countdown > 0) countIn.textContent = String(Math.min(3, Math.ceil(countdown / (60 / chart.bpm))));
  drawStage(time, stamp);
  if (stamp > feedbackUntil) judgement.hidden = true;
  if (stamp - lastUI > 90) {
    const position = Math.max(selectedStart, Math.min(selectedEnd, time)); timeValue.textContent = `${clock(position)} / ${clock(selectedEnd)}`;
    cursor.style.left = `${Math.max(0, Math.min(100, position / chart.duration * 100))}%`; timeline.setAttribute('aria-valuenow', String(position));
    const currentSection = chart.sections.find(section => time >= section.start && time < section.end);
    if (currentSection?.id !== lastSection) { lastSection = currentSection?.id ?? ''; setText(sectionLabel, currentSection?.label ?? copy.introTag); }
    if (state === 'playing') { const stats = judge.stats; scoreValue.textContent = String(stats.score).padStart(7, '0'); accuracyValue.textContent = stats.judged ? `${stats.accuracy.toFixed(1)}%` : '—'; comboValue.textContent = String(stats.combo).padStart(3, '0'); }
    lastUI = stamp;
  }
  requestAnimationFrame(frame);
}
selection(); time = selectedStart; refreshUI(); requestAnimationFrame(frame);
