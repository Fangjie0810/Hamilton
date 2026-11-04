import { bi, getLanguage, getPrimaryLanguage, languageOptions, onLanguageChange, setLabel, setLanguage, setText, type LanguageMode, type Text } from '../i18n/text';
import './entry.css';
import { voiceoverSetting } from './voiceover';
import { OpeningFilm } from './OpeningFilm';
import { music, musicSetting } from './music';
import { showStartupError } from './startupError';
import { TitleRecord } from './TitleRecord';

const qualityKey = 'project-hamilton:3d-quality:v1';
const speedKey = 'project-hamilton:3d-text-speed:v1';

function saved(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Settings remain usable when storage is unavailable. */ } }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}
function button(text: Text, className: string, action: () => void) {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
function link(text: Text, className: string, href: string) {
  const node = el('a', className, text); node.href = href; return node;
}
function select(id: string, options: ReadonlyArray<readonly [string, Text]>, value: string) {
  const node = el('select'); node.id = id;
  for (const [key, text] of options) { const option = el('option', '', text); option.value = key; node.append(option); }
  node.value = value; return node;
}
function setting(label: Text, input: HTMLInputElement | HTMLSelectElement) {
  const row = el('label', 'entry-setting-row'); row.htmlFor = input.id; row.append(el('span', '', label), input); return row;
}

export function showEntryScreen() {
  const app = document.querySelector<HTMLElement>('#app')!;
  const screen = el('section', 'entry-screen'); screen.setAttribute('aria-labelledby', 'entry-title');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  screen.classList.toggle('entry-reduce-motion', reduced);

  const art = el('img', 'entry-art'); art.src = '/art/entry/harbor-arrival-v1.png'; art.alt = ''; art.fetchPriority = 'high'; art.draggable = false;
  const shade = el('div', 'entry-art-shade'), compass = el('div', 'entry-compass');
  shade.setAttribute('aria-hidden', 'true'); compass.setAttribute('aria-hidden', 'true');

  const header = el('header', 'entry-header'), brand = el('div', 'entry-brand');
  const emblem = el('span', 'entry-emblem', 'H'); emblem.setAttribute('aria-hidden', 'true');
  brand.append(emblem, el('span', 'entry-brand-name', bi('汉密尔顿计划', 'PROJECT HAMILTON')));
  const headerActions = el('div', 'entry-header-actions'), languages = el('div', 'entry-languages');
  languages.setAttribute('role', 'group'); setLabel(languages, 'aria-label', bi('选择语言', 'Choose language'));
  const languageButtons: { mode: LanguageMode; node: HTMLButtonElement }[] = [];
  for (const [mode, label] of languageOptions) {
    const node = button(label, 'entry-language', () => setLanguage(mode));
    node.lang = getPrimaryLanguage(mode) === 'en' ? 'en' : 'zh-CN';
    node.dataset.language = mode; languageButtons.push({ mode, node }); languages.append(node);
  }

  const settings = el('dialog', 'entry-settings entry-dialog'); settings.setAttribute('aria-labelledby', 'entry-settings-title');
  const settingsTitle = el('h2', 'entry-dialog-title', bi('启程之前', 'Before the journey')); settingsTitle.id = 'entry-settings-title';
  const settingsLanguage = select('entry-settings-language', languageOptions, getLanguage());
  for (const option of settingsLanguage.options) option.lang = getPrimaryLanguage(option.value as LanguageMode) === 'en' ? 'en' : 'zh-CN';
  settingsLanguage.addEventListener('change', () => setLanguage(settingsLanguage.value as LanguageMode));
  const qualityValue = saved(qualityKey);
  const quality = select('entry-settings-quality', [
    ['balanced', bi('均衡 · 柔和景深', 'Balanced · Soft depth of field')],
    ['high', bi('精细 · 更高分辨率', 'High · Higher resolution')],
    ['low', bi('流畅 · 关闭景深', 'Performance · No depth of field')],
  ], qualityValue === 'high' || qualityValue === 'low' ? qualityValue : 'balanced');
  quality.addEventListener('change', () => save(qualityKey, quality.value));
  const speedValue = saved(speedKey);
  const speed = select('entry-settings-speed', [
    ['0', bi('即时显示', 'Instant')], ['24', bi('正常', 'Normal')], ['45', bi('慢速', 'Slow')],
  ], speedValue === '0' || speedValue === '45' ? speedValue : '24');
  speed.addEventListener('change', () => save(speedKey, speed.value));
  settings.append(settingsTitle,
    setting(bi('语言', 'Language'), settingsLanguage),
    el('p', 'entry-settings-scope', bi('旅程设置', 'Journey settings')),
    setting(bi('画质', 'Graphics'), quality), setting(bi('文字速度', 'Text speed'), speed),
    voiceoverSetting('entry-voiceover', 'entry-setting-row'),
    musicSetting('entry-music', 'entry-setting-row'),
    el('p', 'entry-dialog-note', bi('这些偏好会保存在此浏览器，也可在旅程中随时调整。', 'These preferences are saved in this browser and can be adjusted during your journey.')),
    button(bi('准备好了', 'Ready'), 'entry-dialog-close', () => settings.close()));

  const help = el('dialog', 'entry-help-dialog entry-dialog'); help.setAttribute('aria-labelledby', 'entry-help-title');
  const helpTitle = el('h2', 'entry-dialog-title', bi('游玩须知', 'Before you begin')); helpTitle.id = 'entry-help-title';
  help.append(helpTitle,
    el('p', 'entry-dialog-copy', bi('扮演亚历山大·汉密尔顿，从纽约走向约克镇。走近人物与亮起的目标，选择你的立场，完成六幕故事。', 'Become Alexander Hamilton and travel from New York to Yorktown. Approach people and lit objectives, choose your stance, and follow a story in six chapters.')),
    el('p', 'entry-dialog-copy', bi('推荐使用桌面浏览器、键盘与鼠标。用方向键或 WASD 行走，E 互动，Esc 暂停；右键拖动与滚轮调整镜头。', 'Play in a desktop browser with a keyboard and mouse. Move with the arrow keys or WASD, interact with E, and pause with Esc. Right-drag and scroll to adjust the camera.')),
    el('p', 'entry-dialog-copy', bi('目前只保存完成后的成绩，没有中途存档。刷新或离开游戏会重新开始故事；游戏内重开本幕会恢复进入该幕时的状态。', 'Only completed results are saved; there are no mid-story saves. Reloading or leaving begins a new story. Restarting a chapter in-game restores its entry state.')),
    el('p', 'entry-dialog-note', bi('限时回应、节拍辩论、军令整理与战术指挥都会留下记录。即使失误，故事也会继续。', 'Timed choices, rhythmic debate, dispatch writing, and tactical command all leave a record. The story continues even when you make mistakes.')),
    button(bi('知道了', 'Understood'), 'entry-dialog-close', () => help.close()));

  let settingsTrigger: HTMLButtonElement, helpTrigger: HTMLButtonElement;
  settingsTrigger = button(bi('设置', 'Settings'), 'entry-settings-trigger', () => { if (!settings.open) settings.showModal(); });
  helpTrigger = button(bi('游玩须知', 'Before you begin'), 'entry-help', () => { if (!help.open) help.showModal(); });
  settings.addEventListener('close', () => settingsTrigger.focus({ preventScroll: true }));
  help.addEventListener('close', () => helpTrigger.focus({ preventScroll: true }));
  headerActions.append(languages, settingsTrigger); header.append(brand, headerActions);

  const content = el('div', 'entry-content');
  const title = el('h1', 'entry-title', 'HAMILTON'); title.id = 'entry-title';
  const date = el('div', 'entry-date');
  for (const className of ['entry-date-line', 'entry-year', 'entry-date-line']) date.append(el('span', className, className === 'entry-year' ? '1776' : ''));
  const actions = el('nav', 'entry-actions'); setLabel(actions, 'aria-label', bi('开始旅程', 'Start your journey'));
  const begin = link('', 'entry-begin', '/?story=3d');
  const arrow = el('span', 'entry-begin-arrow', '→'); arrow.setAttribute('aria-hidden', 'true');
  begin.append(el('span', 'entry-begin-label', bi('启程', 'Begin your story')), arrow);
  actions.append(begin);
  content.append(el('p', 'entry-kicker', bi('一场关于野心与革命的故事', 'A STORY OF AMBITION & REVOLUTION')),
    title, date, el('p', 'entry-subtitle', bi('此刻，无人知晓你的名字。', 'For now, no one knows your name.')),
    el('p', 'entry-description', bi('从一封信开始，走进一场革命。\n让你的选择，成为历史的回声。', 'Begin with a letter. Step into a revolution.\nLet your choices echo through history.')), actions);

  const location = el('p', 'entry-location', bi('纽约港 · 新世界的边缘', 'NEW YORK HARBOR · THE EDGE OF A NEW WORLD'));
  const footer = el('footer', 'entry-footer'), footerActions = el('div', 'entry-footer-actions');
  footerActions.append(el('span', 'entry-controls-hint', bi('键盘与鼠标游玩', 'Play with keyboard & mouse')), helpTrigger);
  footer.append(el('span', 'entry-footer-story', bi('六幕故事 · 一个未被写下的名字', 'Six chapters. One unwritten name.')), footerActions);

  const updateLanguage = () => {
    const current = getLanguage(); settingsLanguage.value = current;
    for (const { mode, node } of languageButtons) {
      const active = current === mode; node.setAttribute('aria-pressed', String(active)); node.classList.toggle('active', active);
    }
  };
  updateLanguage(); const stopLanguage = onLanguageChange(updateLanguage);
  const record = new TitleRecord();
  screen.append(art, shade, compass, header, content, location, record.root, footer, settings, help); app.replaceChildren(screen);
  music.enterTitle();
  let starting = false;
  begin.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (starting) return;
    starting = true;
    begin.classList.add('is-starting');
    begin.setAttribute('aria-disabled', 'true');
    record.destroy();
    music.beginJourney();
    const film = new OpeningFilm(reduced);
    void film.coverEntry().then(async () => {
      const url = new URL(window.location.href); url.searchParams.set('story', '3d');
      history.pushState(null, '', url);
      window.addEventListener('popstate', () => window.location.reload(), { once: true });
      stopLanguage();
      // Keep the same document and user-activated media element across all three parts.
      const { startDemo } = await import('../demo3d/Demo');
      await startDemo({ opening: () => film.presentChapter(), onStartupError: () => film.cancel() });
    }).catch(error => {
      film.cancel(); music.stop(); stopLanguage();
      showStartupError(error);
    });
  });
}
