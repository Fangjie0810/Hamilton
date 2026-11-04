import { bi, f, getLanguage, onLanguageChange, setLabel, setLanguage, setText, type Text } from '../i18n/text';
import './projection-scene.css';

const scenes = [
  { id: 'crt', number: '01', title: bi('午夜录像室', 'The midnight broadcast'), short: bi('录像室', 'Tape room'), caption: bi('一段被时间遗忘的录像。', 'A recording that time forgot.'), detail: bi('木壳电视 · 磁带质感', 'Wooden CRT · Magnetic tape') },
  { id: 'projector', number: '02', title: bi('阁楼放映室', 'The attic screening'), short: bi('放映室', 'Screening room'), caption: bi('让一束光，把往事重新照亮。', 'A beam of light brings the past to life.'), detail: bi('胶片放映 · 尘埃与光', 'Celluloid · Dust and light') },
  { id: 'archive', number: '03', title: bi('记忆档案桌', 'The memory archive'), short: bi('档案桌', 'Archive desk'), caption: bi('打开一个人的过去。', 'Unspool a life before it became history.'), detail: bi('胶片检视机 · 私人档案', 'Film viewer · A private collection') },
] as const;
type Scene = typeof scenes[number]['id'];
function selected(): Scene {
  const value = new URLSearchParams(location.search).get('projection');
  return scenes.find(scene => scene.id === value)?.id ?? 'projector';
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}
function selectScene(id: Scene) {
  const url = new URL(location.href); url.searchParams.set('projection', id); history.replaceState(null, '', url);
}
function sceneButtons(action: (scene: Scene) => void) {
  const group = el('div', 'projection-options');
  group.setAttribute('role', 'group'); setLabel(group, 'aria-label', bi('选择放映场景', 'Choose a screening scene'));
  for (const scene of scenes) {
    const button = el('button', 'projection-option'); button.type = 'button'; button.dataset.scene = scene.id;
    button.append(el('span', 'projection-number', scene.number), el('span', '', scene.short));
    button.addEventListener('click', () => action(scene.id)); group.append(button);
  }
  return group;
}
function markSelected(group: HTMLElement, id: Scene) {
  group.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === id)));
}

/** Review-only title controls. This module exists solely in the isolated experiment. */
export function addProjectionPicker(screen: HTMLElement) {
  const panel = el('aside', 'projection-entry-picker');
  const group = sceneButtons(id => { selectScene(id); markSelected(group, id); });
  markSelected(group, selected());
  panel.append(el('p', 'projection-entry-label', bi('开场放映 · 三种想象', 'OPENING FILM · THREE INTERPRETATIONS')), group,
    el('p', 'projection-entry-hint', bi('选择场景，再点击「启程」观看。', 'Choose a scene, then begin your story.')));
  screen.append(panel);
}

/** One persistent video aperture: scene changes only affect styling, never media or game state. */
export function createProjectionScene(root: HTMLElement, picture: HTMLElement, video: HTMLVideoElement, reduced: boolean, signal: AbortSignal) {
  root.classList.add('projection-experiment'); root.classList.toggle('projection-reduced', reduced);
  const top = el('header', 'projection-top');
  const signature = el('div', 'projection-signature');
  signature.append(el('span', 'projection-monogram', 'H'), el('span', '', bi('往事放映馆', 'THE HAMILTON COLLECTION')));
  const options = sceneButtons(change);
  const languages = el('div', 'projection-languages');
  languages.setAttribute('role', 'group'); setLabel(languages, 'aria-label', bi('语言', 'Language'));
  for (const [mode, label] of [['zh', bi('中', 'ZH')], ['en', bi('英', 'EN')], ['dual', bi('双语', 'DUAL')]] as const) {
    const button = el('button', '', label); button.type = 'button'; button.dataset.language = mode;
    button.addEventListener('click', () => setLanguage(mode), { signal }); languages.append(button);
  }
  function languageLabels() {
    languages.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === getLanguage())));
  }
  const stopLanguage = onLanguageChange(languageLabels); languageLabels();
  top.append(signature, options, languages);

  const room = el('div', 'projection-room');
  const stage = el('div', 'projection-stage');
  // Decorative geometry carries no baked text. All readable labels use the shared bilingual binding.
  for (const name of ['window', 'shelf', 'table', 'beam', 'dust', 'ceiling', 'floor', 'backlight']) {
    const prop = el('div', `projection-${name}`); prop.setAttribute('aria-hidden', 'true'); stage.append(prop);
  }
  const lamp = el('div', 'projection-lamp'); lamp.setAttribute('aria-hidden', 'true');
  for (const name of ['shade', 'neck', 'base']) lamp.append(el('i', `lamp-${name}`)); stage.append(lamp);
  const books = el('div', 'projection-books'); books.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) books.append(el('i', '')); stage.append(books);
  const paper = el('div', 'projection-paper');
  paper.append(el('span', 'paper-index', bi('私人藏件 / 001', 'PRIVATE COLLECTION / 001')),
    el('h3', '', bi('海的另一边', 'Across the sea')),
    el('p', '', bi('一个名字，一段尚未写下的历史。', 'One name. A history yet to be written.')),
    el('div', 'paper-lines'), el('span', 'paper-year', '1776'));
  stage.append(paper);
  const tape = el('div', 'projection-tape');
  tape.append(el('span', '', bi('亚历山大 · 启程', 'ALEXANDER · DEPARTURE')), el('i', 'tape-wheels'));
  stage.append(tape);
  const filmstrip = el('div', 'projection-filmstrip'); filmstrip.setAttribute('aria-hidden', 'true'); stage.append(filmstrip);
  const machine = el('div', 'projection-machine'); machine.setAttribute('aria-hidden', 'true');
  for (const name of ['reel reel-one', 'reel reel-two', 'machine-body', 'machine-lens', 'machine-feet']) machine.append(el('div', name));
  stage.append(machine);

  const device = el('div', 'projection-device');
  const aperture = el('div', 'projection-aperture');
  const texture = el('div', 'projection-texture'); texture.setAttribute('aria-hidden', 'true');
  const reflection = el('div', 'projection-reflection'); reflection.setAttribute('aria-hidden', 'true');
  aperture.append(video, texture, reflection);
  const sidebar = el('div', 'projection-device-side'); sidebar.setAttribute('aria-hidden', 'true');
  sidebar.append(el('i', 'device-dial'), el('i', 'device-dial small'), el('i', 'device-speaker'));
  const badge = el('div', 'projection-device-badge', bi('往事 · 影像档案', 'HAMILTON · PICTURE ARCHIVE'));
  const power = el('span', 'projection-power'); power.setAttribute('aria-hidden', 'true');
  device.append(aperture, sidebar, badge, power, el('div', 'device-handle'), el('div', 'device-stand'));
  stage.append(device);
  const deck = el('div', 'projection-deck');
  deck.append(el('div', 'deck-slot'), el('span', 'deck-counter', '00:00'), el('div', 'deck-keys'));
  stage.append(deck); room.append(stage);
  const caption = el('footer', 'projection-caption');
  const index = el('span', 'projection-caption-index'); const title = el('h2', ''); const subtitle = el('p', '');
  caption.append(index, title, subtitle);
  const meta = el('div', 'projection-meta');
  const detail = el('span', ''); const timer = el('span', 'projection-timer', '00:00 / 00:57');
  meta.append(detail, timer);
  picture.append(top, room, caption, meta);

  function change(id: Scene) {
    root.dataset.scene = id; selectScene(id); markSelected(options, id);
    const scene = scenes.find(item => item.id === id)!;
    setText(index, f(bi('放映 {0} / 03', 'SCREENING {0} / 03'), scene.number));
    setText(title, scene.title); setText(subtitle, scene.caption); setText(detail, scene.detail);
  }
  const resize = () => {
    const compact = room.clientWidth <= 700;
    const width = compact ? 700 : 1440, height = compact ? 650 : 740;
    stage.style.setProperty('--stage-scale', String(Math.min(room.clientWidth / width, room.clientHeight / height)));
  };
  const observer = new ResizeObserver(resize); observer.observe(room);
  const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const playback = () => { root.classList.toggle('projection-running', !video.paused && !video.ended); };
  for (const event of ['playing', 'pause', 'ended']) video.addEventListener(event, playback, { signal });
  video.addEventListener('timeupdate', () => {
    setText(timer, `${clock(video.currentTime)} / ${clock(Number.isFinite(video.duration) ? video.duration : 57.2)}`);
    setText(deck.querySelector('.deck-counter')!, clock(video.currentTime));
  }, { signal });
  signal.addEventListener('abort', () => { observer.disconnect(); stopLanguage(); }, { once: true });
  change(selected()); resize();
}
