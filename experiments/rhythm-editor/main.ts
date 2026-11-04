import './style.css';
import assets from './assets.json';
import example from '../my-shot-rhythm/chart.json';
import { bi, f, setText, setLabel, primaryText, languageOptions, getLanguage, setLanguage, onLanguageChange, type BiText, type LanguageMode } from '../../src/i18n/text';
import { TRACKS, KEYS, createProject, History, parseProject, serializeProject, exportFileName, changeNote, snapTime, conflicts, endOf, uid, audioHash, decodeDataUrl, sortedNotes, ProjectError, type Project, type Note, type TrackId, type KeyMode, type NoteColor, type NoteKind, type AudioInfo } from './model';
import { EditorAudio, cachedAudio, cacheAudio } from './audio';
import { bundledAudio } from './bundledAudio';
import { layoutNotes, hitShape, timeToY, yToTime, type BoardGeometry } from './layout';

const t = {
 title: bi('谱面编辑器', 'Chart editor'), song: bi('歌曲', 'SONG'), layout: bi('键位', 'KEYS'), four: bi('四键 · S D / K L', '4 keys · S D / K L'), six: bi('六键 · S D F / J K L', '6 keys · S D F / J K L'),
 import: bi('导入工程', 'Import project'), export: bi('导出谱面 JSON', 'Export chart JSON'), include: bi('包含音频', 'Include audio'), saved: bi('已保存到本机', 'Saved on this device'), saving: bi('保存中…', 'Saving…'), unsaved: bi('本机保存失败，请导出工程', 'Local save failed. Export your project.'),
 audio: bi('音频', 'AUDIO'), replaceAudio: bi('更换音频', 'Choose audio'), loading: bi('正在载入音频…', 'Loading audio…'), missing: bi('请选择工程对应的音频', 'Choose this project’s audio'), audioReady: bi('音频已就绪', 'Audio ready'), audioError: bi('音频载入失败，可重新选择文件', 'Audio could not load. Choose a file to retry.'),
 example: bi('载入 My Shot 示例谱', 'Load My Shot example'), clear: bi('清空谱面', 'Clear chart'), tools: bi('编辑', 'EDIT'), select: bi('选择', 'Select'), tap: bi('单击', 'Tap'), hold: bi('长按', 'Hold'), erase: bi('擦除', 'Erase'), color: bi('颜色', 'COLOR'), undo: bi('撤销', 'Undo'), redo: bi('重做', 'Redo'),
 grid: bi('网格', 'GRID'), bpm: bi('网格 BPM', 'Grid BPM'), offset: bi('首拍偏移 (ms)', 'Beat offset (ms)'), snap: bi('吸附', 'Snap'), free: bi('自由', 'Off'), zoom: bi('视野', 'View'), seconds: bi('{0} 秒', '{0} sec'),
 inspector: bi('音符属性', 'NOTE'), empty: bi('选择一个音符', 'Select a note'), lane: bi('按键', 'KEY'), kind: bi('类型', 'TYPE'), at: bi('落点 (ms)', 'Hit time (ms)'), length: bi('长按时长 (ms)', 'Hold length (ms)'), tail: bi('结束时间 (ms)', 'End time (ms)'),
 nudgeHead: bi('微调落点', 'NUDGE HIT TIME'), nudgeLength: bi('微调时长', 'NUDGE LENGTH'), duplicate: bi('复制到下一拍', 'Duplicate next beat'), delete: bi('删除音符', 'Delete note'), jump: bi('试听此音符', 'Audition note'),
 noteCount: bi('{0} 个音符', '{0} notes'), holdCount: bi('{0} 个长按', '{0} holds'), list: bi('音符列表', 'NOTES'), conflicts: bi('{0} 个音符同轨重叠', '{0} notes overlap in a lane'), noConflicts: bi('无同轨重叠', 'No lane overlaps'),
 play: bi('试听', 'Play'), pause: bi('暂停', 'Pause'), start: bi('回到开头', 'Back to start'), position: bi('当前位置 (ms)', 'Position (ms)'), rate: bi('速度', 'Speed'), volume: bi('音量', 'Volume'), record: bi('键盘录入', 'Record keys'), recording: bi('录入中', 'RECORDING'),
 loop: bi('循环', 'Loop'), loopIn: bi('起点 (ms)', 'In (ms)'), loopOut: bi('终点 (ms)', 'Out (ms)'), follow: bi('跟随播放', 'Follow playback'), hint: bi('拖黄线定位 · 箭头中心为落点 · 密集音符自动错开 · 空格试听', 'Drag gold line to seek · Arrow center marks hit time · Dense notes spread automatically · Space to play'),
 recordingHint: bi('按 {0} 录入；短按生成单击，持续按住生成长按。', 'Use {0}. Short presses create taps; held keys create holds.'),
 time: bi('时间', 'TIME'), chart: bi('瀑布谱面', 'Waterfall chart'), waveform: bi('歌曲波形与播放位置', 'Song waveform and play position'), language: bi('语言', 'Language'),
 exportDone: bi('JSON 已导出，可发回制谱发起人', 'JSON exported. Send it back to the project organizer.'), importDone: bi('工程已导入', 'Project imported'), badFile: bi('无法读取工程，请检查文件格式', 'Could not read this project. Check the file format.'), version: bi('工程版本不受支持', 'This project version is not supported'),
 wrongKeys: bi('工程键位与音符轨道不一致', 'Project keys and note lanes do not match'), bounds: bi('有音符超出音频时长，未导入', 'Some notes exceed the audio length. Import cancelled.'), wrongAudio: bi('音频与工程校验值不符，未导入', 'Audio does not match the project checksum. Import cancelled.'),
 size: bi('文件过大，请使用 80 MB 以内的音频', 'Choose an audio file smaller than 80 MB'), invalidNotes: bi('音符数据无效，未导入', 'Invalid note data. Import cancelled.'), invalidGrid: bi('网格参数无效', 'Invalid grid settings'),
 projectName: bi('谱面名称', 'Chart name'), author: bi('制谱人（可选）', 'Charter (optional)'), addAtCursor: bi('在播放位置添加', 'Add at playhead'), audioTooShort: bi('音频短于现有谱面，请先调整超出的音符', 'This audio is shorter than the chart. Adjust the notes first.'),
 draftError: bi('已保留损坏草稿的备份，当前打开空白谱面', 'A backup of the unreadable draft was kept. Opened a blank chart.'),
 noAudioExport: bi('音频未就绪；可关闭“包含音频”导出谱面', 'Audio is not ready. Disable “Include audio” to export the chart.'),
 total: bi('{0} / {1}', '{0} / {1}'), blank: bi('空白谱面', 'Empty chart'), next: bi('下一页', 'Next'), prev: bi('上一页', 'Previous'), page: bi('{0} / {1}', '{0} / {1}'),
 help: bi('快捷键', 'Shortcuts'), shortHelp: bi('V 选择 · T 单击 · H 长按 · E 擦除 · A/B 颜色 · ↑↓ 10 ms（Shift 1 ms）· Delete 删除 · ⌘/Ctrl Z 撤销', 'V select · T tap · H hold · E erase · A/B color · ↑↓ 10 ms (Shift 1 ms) · Delete · ⌘/Ctrl Z undo'),
};
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: BiText | string) { const node = document.createElement(tag); node.className = cls; if (text !== undefined) setText(node, text); return node; }
function button(text: BiText | string, cls: string, fn: () => void) { const node = el('button', cls, text); node.type = 'button'; node.addEventListener('click', fn); return node; }
function select(items: [string, BiText | string][], text: BiText) { const node = el('select'); setLabel(node, 'aria-label', text); for (const [value, title] of items) { const option = el('option', '', title); option.value = value; node.append(option); } return node; }
function field(text: BiText, control: HTMLElement) { const node = el('label', 'field'); node.append(el('span', 'label', text), control); return node; }
function numeric(text: BiText, value: number, min: number, max: number, step: number) { const node = el('input'); node.type = 'number'; node.value = String(value); node.min = String(min); node.max = String(max); node.step = String(step); setLabel(node, 'aria-label', text); return node; }
function checkbox(text: BiText, checked = false) { const node = el('input'); node.type = 'checkbox'; node.checked = checked; const wrap = el('label', 'check'); wrap.append(node, el('span', '', text)); return {node, wrap}; }
function msClock(ms: number) { const n = Math.max(0, Math.round(ms)); return `${String(Math.floor(n / 60000)).padStart(2, '0')}:${String(Math.floor(n % 60000 / 1000)).padStart(2, '0')}.${String(n % 1000).padStart(3, '0')}`; }
const DRAFT = 'hamilton:chart-editor:v1:';
const histories = new Map<string, History>();
const bytesByHash = new Map<string, ArrayBuffer>();
const audio = new EditorAudio();
let trackId: TrackId = 'my-shot'; let keyMode: KeyMode = '4k'; let history: History;
let selectedId: string | null = null; let tool: 'select' | 'tap' | 'hold' | 'erase' = 'select'; let paintColor: NoteColor = 'A';
let viewStart = 0; let visibleMs = 8000; let followAnchor = .18; let cursorMs = 0; let loadToken = 0; let busy = false; let saveTimer = 0;
let listPage = 0; let cachedConflicts = new Set<string>(); let audioBytes: ArrayBuffer | undefined; let exportBusy = false;
const held = new Map<number, {time: number; color: NoteColor}>(); const pressed = new Set<number>();
const flashTimes = new Map<string, number>(); let previousTime = 0;
const p = () => history.current;
function assetInfo(id: TrackId): AudioInfo { const asset = assets[id]; return {fileName: asset.fileName, sha256: asset.sha256, mimeType: asset.mimeType, byteLength: asset.byteLength, durationMs: null}; }
function exampleNotes(mode: KeyMode): Note[] { const map = mode === '6k' ? [0, 1, 4, 5] : [0, 1, 2, 3]; return example.difficulties.normal.notes.map(n => ({id: uid(), lane: map[n.lane], color: n.lane < 2 ? 'A' : 'B', kind: 'tap', atMs: Math.round(n.time * 1000), durationMs: 0})); }
function historyFor(id: TrackId, mode: KeyMode) {
  const key = `${id}:${mode}`; if (histories.has(key)) return histories.get(key)!;
  let project = createProject(id, mode, assetInfo(id));
  try { const raw = localStorage.getItem(DRAFT + key); if (raw) project = parseProject(raw).project;
    else if (id === 'my-shot' && mode === '4k') { project.notes = exampleNotes(mode); project.grid.offsetMs = 325; }
  } catch { try { const raw = localStorage.getItem(DRAFT + key); if (raw) localStorage.setItem(DRAFT + key + ':backup:' + Date.now(), raw); } catch { /* Export remains available. */ } }
  const entry = new History(project); histories.set(key, entry); return entry;
}
history = historyFor(trackId, keyMode);
const app = el('div', 'editor'); document.querySelector('#app')!.append(app);
const header = el('header', 'header'); const brand = el('div', 'brand'); brand.append(el('span', 'star', '★'), el('span', '', bi('HAMILTON', 'HAMILTON')), el('span', 'slash', '/'), el('h1', '', t.title));
const fileActions = el('div', 'file-actions'); const saveStatus = el('span', 'save-state', t.saved);
const includeAudio = checkbox(t.include, false);
const importInput = el('input', 'hidden'); importInput.type = 'file'; importInput.accept = '.json,.hamchart';
const importButton = button(t.import, 'button', () => importInput.click());
const exportButton = button(t.export, 'button primary', () => void exportProject());
const language = el('select', 'language'); setLabel(language, 'aria-label', t.language);
for (const [value, title] of languageOptions) { const opt = el('option', '', title); opt.value = value; opt.lang = value === 'en' || value === 'dual-en' ? 'en' : 'zh-CN'; language.append(opt); } language.value = getLanguage(); language.addEventListener('change', () => setLanguage(language.value as LanguageMode));
fileActions.append(saveStatus, includeAudio.wrap, importButton, exportButton, language, importInput); header.append(brand, fileActions); app.append(header);
const workspace = el('main', 'workspace'); const left = el('aside', 'left-panel panel'); const center = el('section', 'center'); const right = el('aside', 'right-panel panel'); workspace.append(left, center, right); app.append(workspace);
const song = select(TRACKS.map(track => [track.id, track.title]), t.song); song.value = trackId;
const keysSelect = select([['4k', t.four], ['6k', t.six]], t.layout); keysSelect.value = keyMode;
const nameInput = el('input'); nameInput.maxLength = 200; setLabel(nameInput, 'aria-label', t.projectName);
const authorInput = el('input'); authorInput.maxLength = 80; setLabel(authorInput, 'aria-label', t.author);
left.append(field(t.song, song), field(t.layout, keysSelect), field(t.projectName, nameInput), field(t.author, authorInput));
const audioBox = el('div', 'audio-box'); const audioName = el('span', 'audio-name'); const audioStatus = el('span', 'audio-status');
const audioInput = el('input', 'hidden'); audioInput.type = 'file'; audioInput.accept = 'audio/*'; const audioButton = button(t.replaceAudio, 'text-button', () => audioInput.click()); audioBox.append(el('span', 'label', t.audio), audioName, audioStatus, audioButton, audioInput); left.append(audioBox);
const editHeading = el('div', 'section-heading', t.tools); left.append(editHeading);
const toolGrid = el('div', 'tool-grid'); const toolButtons = new Map<string, HTMLButtonElement>();
for (const [value, title, key] of [['select', t.select, 'V'], ['tap', t.tap, 'T'], ['hold', t.hold, 'H'], ['erase', t.erase, 'E']] as const) { const node = button(title, 'tool-button', () => setTool(value)); node.append(el('kbd', '', key)); toolButtons.set(value, node); toolGrid.append(node); } left.append(toolGrid);
const paintRow = el('div', 'color-row'); const paintButtons = (['A', 'B'] as NoteColor[]).map(color => { const node = button(color, `swatch color-${color}`, () => { paintColor = color; refreshTools(); }); setLabel(node, 'aria-label', f(bi('新音符颜色 {0}', 'New note color {0}'), color)); paintRow.append(node); return node; });
left.append(field(t.color, paintRow));
const addButton = button(t.addAtCursor, 'button full', () => addNote(cursorMs, 0, tool === 'hold' ? 'hold' : 'tap', tool === 'hold' ? 500 : 0)); left.append(addButton);
const historyRow = el('div', 'button-row'); const undoButton = button(t.undo, 'button', undo); const redoButton = button(t.redo, 'button', redo); historyRow.append(undoButton, redoButton); left.append(historyRow);
const exampleButton = button(t.example, 'text-button', () => { const next = structuredClone(p()); next.notes = exampleNotes(keyMode); next.grid = {bpm: 91, offsetMs: 325, division: 4}; commit(next); });
const clearButton = button(t.clear, 'text-button danger', () => { const next = structuredClone(p()); next.notes = []; selectedId = null; commit(next); }); left.append(exampleButton, clearButton);
const help = el('details', 'help'); help.append(el('summary', '', t.help), el('p', '', t.shortHelp)); left.append(help);

const topbar = el('div', 'topbar'); const counts = el('span', 'counts'); const warning = button(t.noConflicts, 'warning', () => { const id = [...cachedConflicts][0]; if (id) selectNote(id, true); }); topbar.append(counts, warning); center.append(topbar);
const gridbar = el('div', 'gridbar'); const bpm = numeric(t.bpm, 91, 20, 400, .001); const offset = numeric(t.offset, 0, -60000, 60000, 1);
const snap = select([['off', t.free], ['1', bi('1/1', '1/1')], ['2', bi('1/2', '1/2')], ['4', bi('1/4', '1/4')], ['8', bi('1/8', '1/8')], ['16', bi('1/16', '1/16')]], t.snap); snap.value = String(p().grid.division);
const zoom = select([['4000', f(t.seconds, 4)], ['8000', f(t.seconds, 8)], ['12000', f(t.seconds, 12)], ['20000', f(t.seconds, 20)]], t.zoom); zoom.value = '8000';
const follow = checkbox(t.follow, true); gridbar.append(field(t.bpm, bpm), field(t.offset, offset), field(t.snap, snap), field(t.zoom, zoom), follow.wrap); center.append(gridbar);
const boardWrap = el('div', 'board-wrap'); const board = el('canvas', 'board'); board.tabIndex = 0; setLabel(board, 'aria-label', t.chart); boardWrap.append(board); center.append(boardWrap); const ctx = board.getContext('2d')!;
const laneStrip = el('div', 'lane-strip'); center.append(laneStrip);
const transport = el('div', 'transport'); const home = button(t.start, 'icon-button', () => void seek(0)); const playButton = button(t.play, 'button primary', () => void togglePlay()); const record = checkbox(t.record); const timeLabel = el('strong', 'time-label');
const position = numeric(t.position, 0, 0, 3_600_000, 1); position.classList.add('position');
const rate = select([['.5', bi('0.5×', '0.5×')], ['.75', bi('0.75×', '0.75×')], ['1', bi('1×', '1×')]], t.rate); rate.value = '1';
const volume = el('input'); volume.type = 'range'; volume.min = '0'; volume.max = '100'; volume.value = '70'; setLabel(volume, 'aria-label', t.volume);
transport.append(home, playButton, record.wrap, timeLabel, position, rate, volume); center.append(transport);
const overview = el('canvas', 'overview'); setLabel(overview, 'aria-label', t.waveform); overview.tabIndex = 0; center.append(overview); const overviewCtx = overview.getContext('2d')!;
const loopRow = el('div', 'loop-row'); const loop = checkbox(t.loop); const loopIn = numeric(t.loopIn, 0, 0, 3_600_000, 1); const loopOut = numeric(t.loopOut, 10000, 1, 3_600_000, 1); loopRow.append(loop.wrap, field(t.loopIn, loopIn), field(t.loopOut, loopOut)); center.append(loopRow);
const hint = el('p', 'hint', t.hint); center.append(hint);

right.append(el('div', 'section-heading', t.inspector)); const empty = el('div', 'empty-selection', t.empty); const inspector = el('div', 'inspector'); right.append(empty, inspector);
const noteId = el('code', 'note-id'); inspector.append(noteId);
const noteLane = select(KEYS[keyMode].map((key, i) => [String(i), key]), t.lane);
const noteKind = select([['tap', t.tap], ['hold', t.hold]], t.kind);
const noteColor = select([['A', bi('A', 'A')], ['B', bi('B', 'B')]], t.color);
const propsRow = el('div', 'props-row'); propsRow.append(field(t.lane, noteLane), field(t.kind, noteKind), field(t.color, noteColor)); inspector.append(propsRow);
const noteAt = numeric(t.at, 0, 0, 3_600_000, 1); const noteLength = numeric(t.length, 0, 1, 3_600_000, 1); const noteEnd = numeric(t.tail, 0, 0, 3_600_000, 1);
inspector.append(field(t.at, noteAt));
function nudges(title: BiText, kind: 'atMs' | 'durationMs') { const wrap = el('div', 'nudges'); wrap.append(el('span', 'label', title)); const row = el('div', 'nudge-row'); for (const value of [-50, -10, -1, 1, 10, 50]) { const node = button(String(value), 'nudge', () => nudge(kind, value)); setText(node, `${value > 0 ? '+' : ''}${value}`); setLabel(node, 'aria-label', f(bi('{0} {1} 毫秒', '{0} {1} milliseconds'), title, value)); row.append(node); } wrap.append(row); return wrap; }
const headNudges = nudges(t.nudgeHead, 'atMs'); const lengthNudges = nudges(t.nudgeLength, 'durationMs');
const lengthField = field(t.length, noteLength); const endField = field(t.tail, noteEnd); inspector.append(headNudges, lengthField, endField, lengthNudges);
const audition = button(t.jump, 'button full', () => void auditionNote()); const duplicate = button(t.duplicate, 'button full', duplicateNote); const remove = button(t.delete, 'button full danger', deleteNote); inspector.append(audition, duplicate, remove);
const listHead = el('div', 'section-heading list-heading', t.list); const noteList = el('div', 'note-list'); const pager = el('div', 'pager'); const previous = button(t.prev, 'text-button', () => { listPage--; renderList(); }); const next = button(t.next, 'text-button', () => { listPage++; renderList(); }); const pageLabel = el('span'); pager.append(previous, pageLabel, next); right.append(listHead, noteList, pager);
const toast = el('div', 'toast'); toast.setAttribute('role', 'status'); toast.hidden = true; app.append(toast);
let toastTimer = 0;
function notify(text: BiText) { setText(toast, text); toast.hidden = false; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.hidden = true, 5000); }
function refreshTools() { for (const [key, node] of toolButtons) { node.classList.toggle('active', tool === key); node.setAttribute('aria-pressed', String(tool === key)); } paintButtons.forEach((node, i) => { node.classList.toggle('active', paintColor === (i ? 'B' : 'A')); node.setAttribute('aria-pressed', String(paintColor === (i ? 'B' : 'A'))); }); board.dataset.tool = tool; }
function setTool(value: typeof tool) { tool = value; refreshTools(); }
function persist() {
  clearTimeout(saveTimer); setText(saveStatus, t.saving);
  saveTimer = window.setTimeout(saveNow, 250);
}
function saveNow() {
  try { for (const [key, entry] of histories) localStorage.setItem(DRAFT + key, serializeProject(entry.current)); setText(saveStatus, t.saved); }
  catch { setText(saveStatus, t.unsaved); }
}
function commit(nextProject: Project) { if (history.commit(nextProject)) { persist(); refresh(); } }
function undo() { pause(); const hash = p().audio.sha256; if (history.undo()) { persist(); refresh(); if (hash !== p().audio.sha256) void loadCurrentAudio(); } }
function redo() { pause(); const hash = p().audio.sha256; if (history.redo()) { persist(); refresh(); if (hash !== p().audio.sha256) void loadCurrentAudio(); } }
function currentNote() { return p().notes.find(note => note.id === selectedId); }
function selectNote(id: string, reposition = false) { selectedId = id; refreshInspector(); renderList(); if (reposition) { const note = currentNote(); if (note) { viewStart = Math.max(0, note.atMs - visibleMs * .2); void seek(Math.max(0, note.atMs - 1000)); } } }
function updateNote(patch: Partial<Note>) { const old = currentNote(); if (!old) return; const next = structuredClone(p()); next.notes = next.notes.map(note => note.id === old.id ? changeNote(note, patch, next) : note); commit(next); }
function nudge(key: 'atMs' | 'durationMs', delta: number) { const note = currentNote(); if (note) updateNote({[key]: note[key] + delta}); }
function deleteNote() { if (!selectedId) return; const next = structuredClone(p()); next.notes = next.notes.filter(note => note.id !== selectedId); selectedId = null; commit(next); }
function duplicateNote() { const old = currentNote(); if (!old) return; const next = structuredClone(p()); const note = changeNote({...old, id: uid()}, {atMs: old.atMs + 60_000 / p().grid.bpm}, next); next.notes.push(note); selectedId = note.id; commit(next); }
function addNote(atMs: number, lane: number, kind: NoteKind, durationMs: number, color = paintColor, useSnap = true) {
  const at = useSnap ? snapped(atMs) : Math.round(atMs); const next = structuredClone(p());
  const note = changeNote({id: uid(), lane, color, kind, atMs: at, durationMs}, {}, next);
  const existing = next.notes.find(n => n.lane === note.lane && n.atMs === note.atMs);
  if (existing) { selectNote(existing.id); return; }
  next.notes.push(note); selectedId = note.id; commit(next);
}
function snapped(ms: number, bypass = false) { const enabled = snap.value !== 'off' && !bypass; return snapTime(ms, {...p().grid, division: Number(snap.value) || p().grid.division}, enabled); }
function refreshInspector() {
  const note = currentNote(); empty.hidden = !!note; inspector.hidden = !note;
  if (!note) return;
  noteId.textContent = note.id.slice(0, 8); noteLane.value = String(note.lane); noteKind.value = note.kind; noteColor.value = note.color;
  noteAt.value = String(note.atMs); noteLength.value = String(note.durationMs); noteEnd.value = String(endOf(note));
  lengthField.hidden = endField.hidden = lengthNudges.hidden = note.kind !== 'hold';
}
function renderList() {
  const notes = sortedNotes(p().notes); const pages = Math.max(1, Math.ceil(notes.length / 40)); listPage = Math.min(Math.max(0, listPage), pages - 1); noteList.replaceChildren();
  for (const note of notes.slice(listPage * 40, (listPage + 1) * 40)) {
    const item = button('', 'note-row', () => selectNote(note.id, true)); item.replaceChildren(); item.dataset.color = note.color; item.classList.toggle('selected', note.id === selectedId); item.classList.toggle('conflict', cachedConflicts.has(note.id));
    item.append(el('span', 'dot', note.color), el('span', 'row-key', p().keys[note.lane]), el('span', 'row-time', msClock(note.atMs)), el('span', 'row-type', note.kind === 'hold' ? f(bi('长按 {0}', 'Hold {0}'), note.durationMs) : t.tap));
    setLabel(item, 'aria-label', f(bi('{0} 键，{1}，{2} 色，{3}', '{0} key, {1}, color {2}, {3}'), p().keys[note.lane], msClock(note.atMs), note.color, note.kind === 'hold' ? t.hold : t.tap)); noteList.append(item);
  }
  if (!notes.length) noteList.append(el('p', 'empty-list', t.blank));
  previous.disabled = listPage === 0; next.disabled = listPage >= pages - 1; setText(pageLabel, f(t.page, listPage + 1, pages));
}
function refresh() {
  const project = p(); if (!currentNote()) selectedId = null;
  nameInput.value = project.name; authorInput.value = project.author ?? ''; bpm.value = String(project.grid.bpm); offset.value = String(project.grid.offsetMs);
  audioName.textContent = project.audio.fileName;
  setText(counts, f(t.noteCount, project.notes.length)); cachedConflicts = conflicts(project.notes);
  setText(warning, cachedConflicts.size ? f(t.conflicts, cachedConflicts.size) : t.noConflicts); warning.classList.toggle('has-conflict', cachedConflicts.size > 0);
  undoButton.disabled = !history.canUndo; redoButton.disabled = !history.canRedo; exampleButton.hidden = trackId !== 'my-shot';
  noteLane.replaceChildren(); project.keys.forEach((key, lane) => { const opt = el('option', '', key); opt.value = String(lane); noteLane.append(opt); });
  laneStrip.replaceChildren(); laneStrip.style.setProperty('--lanes', String(project.keys.length)); project.keys.forEach((key, lane) => { const node = el('button', 'lane-key', key); node.type = 'button'; node.addEventListener('pointerdown', event => { event.preventDefault(); node.setPointerCapture(event.pointerId); keyDown(lane); }); node.addEventListener('pointerup', () => keyUp(lane)); node.addEventListener('pointercancel', () => keyUp(lane)); laneStrip.append(node); });
  app.style.setProperty('--color-a', project.palette.A); app.style.setProperty('--color-b', project.palette.B);
  refreshInspector(); renderList(); refreshTools(); refreshTransport();
}
function refreshTransport() { setText(playButton, audio.playing ? t.pause : t.play); playButton.disabled = busy || !audio.loaded; home.disabled = busy; setText(hint, record.node.checked ? f(t.recordingHint, p().keys.join(' ')) : t.hint); record.wrap.classList.toggle('armed', record.node.checked); }
function errorText(error: unknown) { if (!(error instanceof ProjectError)) return t.badFile; return ({version: t.version, keys: t.wrongKeys, bounds: t.bounds, identity: t.wrongAudio, size: t.size, notes: t.invalidNotes, grid: t.invalidGrid, audio: t.wrongAudio, format: t.badFile, track: t.badFile})[error.code]; }

async function loadCurrentAudio() {
  pause(); audio.clear(); audioBytes = undefined;
  const token = ++loadToken; const project = p(); busy = true; setText(audioStatus, t.loading); refreshTransport();
  try {
    let data = bytesByHash.get(project.audio.sha256);
    if (!data) try { data = await cachedAudio(project.audio.sha256); } catch { /* Bundled files still work. */ }
    if (token !== loadToken) return;
    if (!data && assets[project.trackId].sha256 === project.audio.sha256) {
      data = bundledAudio(project.trackId);
      if (!data && location.protocol !== 'file:') { const response = await fetch(assets[project.trackId].asset); if (!response.ok) throw new Error('audio-http'); data = await response.arrayBuffer(); }
    }
    if (token !== loadToken) return;
    if (!data) { setText(audioStatus, t.missing); return; }
    if (data.byteLength !== project.audio.byteLength || await audioHash(data) !== project.audio.sha256) throw new ProjectError('identity');
    if (token !== loadToken) return;
    if (!await audio.load(data) || token !== loadToken) return;
    if (project.notes.some(note => endOf(note) > audio.durationMs)) { audio.clear(); throw new ProjectError('bounds'); }
    audioBytes = data; bytesByHash.set(project.audio.sha256, data);
    p().audio.durationMs = audio.durationMs; persist();
    cursorMs = 0; previousTime = 0; viewStart = 0; loop.node.checked = false; loopIn.value = '0'; loopOut.value = String(Math.min(10000, audio.durationMs));
    position.max = String(audio.durationMs); setText(audioStatus, t.audioReady);
  } catch (error) { if (token === loadToken) { audio.clear(); setText(audioStatus, t.audioError); if (error instanceof ProjectError) notify(errorText(error)); } }
  finally { if (token === loadToken) { busy = false; refreshTransport(); } }
}
function switchProject(id: TrackId, mode: KeyMode) {
  pause(); saveNow(); trackId = id; keyMode = mode; history = historyFor(id, mode); selectedId = null; listPage = 0;
  song.value = id; keysSelect.value = mode; snap.value = String(p().grid.division); refresh(); void loadCurrentAudio();
}
async function importProject(file: File) {
  try {
    if (file.size > 110_000_000) throw new ProjectError('size');
    const parsed = parseProject(await file.text());
    if (parsed.embeddedAudio) {
      const data = decodeDataUrl(parsed.embeddedAudio);
      if (data.byteLength !== parsed.project.audio.byteLength || await audioHash(data) !== parsed.project.audio.sha256) throw new ProjectError('identity');
      bytesByHash.set(parsed.project.audio.sha256, data); void cacheAudio(parsed.project.audio.sha256, data).catch(() => {});
    }
    pause(); saveNow(); historyFor(parsed.project.trackId, parsed.project.keyMode).commit(parsed.project);
    switchProject(parsed.project.trackId, parsed.project.keyMode); persist(); notify(t.importDone);
  } catch (error) { notify(errorText(error)); }
  finally { importInput.value = ''; }
}
function asDataUrl(data: ArrayBuffer, mime: string): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(new Blob([data], {type: mime})); });
}
async function exportProject() {
  if (exportBusy) return;
  const project = structuredClone(p()); const include = includeAudio.node.checked; const data = audioBytes;
  if (include && (!data || busy)) { notify(t.noAudioExport); return; }
  exportBusy = true; exportButton.disabled = true;
  try {
    const embedded = include && data ? await asDataUrl(data, project.audio.mimeType) : undefined;
    const text = serializeProject(project, embedded); const blob = new Blob([text], {type: 'application/json'}); const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = exportFileName(project); document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); notify(t.exportDone);
  } catch (error) { notify(errorText(error)); }
  finally { exportBusy = false; exportButton.disabled = false; }
}
async function replaceAudio(file: File) {
  if (file.size < 1 || file.size > 80_000_000) { notify(t.size); return; }
  pause(); const token = ++loadToken; busy = true; setText(audioStatus, t.loading); refreshTransport();
  try {
    const data = await file.arrayBuffer(); const hash = await audioHash(data); if (token !== loadToken) return;
    if (!await audio.load(data) || token !== loadToken) return;
    if (p().notes.some(note => endOf(note) > audio.durationMs)) { notify(t.audioTooShort); await loadCurrentAudio(); return; }
    const next = structuredClone(p()); next.audio = {fileName: file.name, sha256: hash, byteLength: data.byteLength, mimeType: /^audio\//.test(file.type) ? file.type : 'audio/mpeg', durationMs: audio.durationMs};
    audioBytes = data; bytesByHash.set(hash, data); void cacheAudio(hash, data).catch(() => {});
    cursorMs = 0; viewStart = 0; previousTime = 0; commit(next); setText(audioStatus, t.audioReady);
  } catch { if (token === loadToken) { notify(t.audioError); await loadCurrentAudio(); } }
  finally { if (token === loadToken) { busy = false; refreshTransport(); } audioInput.value = ''; }
}
function finishHeld() { for (const lane of [...held.keys()]) keyUp(lane); pressed.clear(); }
function pause() { finishHeld(); cursorMs = audio.pause(); refreshTransport(); }
async function seek(ms: number, keepPlaying = audio.playing, preserveView = false) {
  if (busy) return;
  finishHeld(); const limit = audio.durationMs || p().audio.durationMs || 3_600_000;
  cursorMs = Math.max(0, Math.min(limit, Math.round(ms))); previousTime = cursorMs; flashTimes.clear();
  if (document.activeElement !== position) position.value = String(cursorMs);
  await audio.seek(cursorMs, keepPlaying); if (!preserveView && (follow.node.checked || !keepPlaying)) viewStart = Math.max(0, cursorMs - visibleMs * followAnchor); refreshTransport();
}
async function togglePlay() { if (busy || !audio.loaded) return; if (audio.playing) pause(); else { await audio.play(); previousTime = audio.now(); refreshTransport(); } }
async function auditionNote() {
  const note = currentNote(); if (!note || !audio.loaded) return; pause();
  loopIn.value = String(Math.max(0, note.atMs - 900)); loopOut.value = String(Math.min(audio.durationMs, endOf(note) + 1200)); loop.node.checked = true;
  await seek(Number(loopIn.value), false); await togglePlay();
}
function keyDown(lane: number) {
  if (pressed.has(lane) || busy) return; pressed.add(lane);
  if (record.node.checked && audio.playing) held.set(lane, {time: audio.now(), color: paintColor});
}
function keyUp(lane: number) {
  pressed.delete(lane); const start = held.get(lane); held.delete(lane); if (!start) return;
  const end = audio.now(); const duration = end - start.time; const at = snapped(start.time);
  addNote(at, lane, duration >= 180 ? 'hold' : 'tap', duration >= 180 ? Math.max(1, snapped(end) - at) : 0, start.color, false);
}
function numberChange(node: HTMLInputElement, apply: (value: number) => void) {
  let timer = 0; let editingHistory = history; let editingNote = selectedId;
  const update = () => { clearTimeout(timer); if (editingHistory !== history || editingNote !== selectedId) return; if (node.value.trim() && Number.isFinite(node.valueAsNumber)) apply(Math.max(Number(node.min), Math.min(Number(node.max), node.valueAsNumber))); refresh(); };
  node.addEventListener('focus', () => { editingHistory = history; editingNote = selectedId; });
  node.addEventListener('change', update);
  node.addEventListener('input', () => { clearTimeout(timer); editingHistory = history; editingNote = selectedId; timer = window.setTimeout(update, 250); });
  node.addEventListener('keydown', event => { if (event.code === 'Enter') { event.preventDefault(); update(); node.blur(); } });
}
song.addEventListener('change', () => switchProject(song.value as TrackId, keyMode)); keysSelect.addEventListener('change', () => switchProject(trackId, keysSelect.value as KeyMode));
const saveName = () => { const next = structuredClone(p()); next.name = nameInput.value.trim() || TRACKS.find(track => track.id === trackId)!.title.en; commit(next); refresh(); };
nameInput.addEventListener('change', saveName); nameInput.addEventListener('blur', saveName); nameInput.addEventListener('keydown', event => { if (event.code === 'Enter') { saveName(); nameInput.blur(); } });
const saveAuthor = () => { const next = structuredClone(p()); const author = authorInput.value.trim(); if (author) next.author = author; else delete next.author; commit(next); refresh(); };
authorInput.addEventListener('change', saveAuthor); authorInput.addEventListener('blur', saveAuthor); authorInput.addEventListener('keydown', event => { if (event.code === 'Enter') { saveAuthor(); authorInput.blur(); } });
importInput.addEventListener('change', () => { if (importInput.files?.[0]) void importProject(importInput.files[0]); });
audioInput.addEventListener('change', () => { if (audioInput.files?.[0]) void replaceAudio(audioInput.files[0]); });
numberChange(bpm, value => { const next = structuredClone(p()); next.grid.bpm = value; commit(next); });
numberChange(offset, value => { const next = structuredClone(p()); next.grid.offsetMs = Math.round(value); commit(next); });
snap.addEventListener('change', () => { if (snap.value !== 'off') { const next = structuredClone(p()); next.grid.division = Number(snap.value); commit(next); } });
zoom.addEventListener('change', () => { visibleMs = Number(zoom.value); if (follow.node.checked) viewStart = Math.max(0, cursorMs - visibleMs * followAnchor); });
numberChange(noteAt, value => updateNote({atMs: value})); numberChange(noteLength, value => updateNote({durationMs: value})); numberChange(noteEnd, value => { const note = currentNote(); if (note) updateNote({durationMs: Math.max(1, value - note.atMs)}); });
noteLane.addEventListener('change', () => updateNote({lane: Number(noteLane.value)})); noteKind.addEventListener('change', () => updateNote({kind: noteKind.value as NoteKind})); noteColor.addEventListener('change', () => updateNote({color: noteColor.value as NoteColor}));
numberChange(position, value => void seek(value)); rate.addEventListener('change', () => { finishHeld(); void audio.setRate(Number(rate.value)); }); volume.addEventListener('input', () => audio.setVolume(Number(volume.value) / 100));
record.node.addEventListener('change', () => { finishHeld(); refreshTransport(); });
for (const node of [loopIn, loopOut]) numberChange(node, () => { const limit = audio.durationMs || 3_600_000; loopIn.value = String(Math.min(limit - 1, Math.max(0, Math.round(Number(loopIn.value))))); loopOut.value = String(Math.max(Number(loopIn.value) + 1, Math.min(limit, Math.round(Number(loopOut.value))))); });
function editingText() { const node = document.activeElement; return node instanceof HTMLElement && ((['TEXTAREA', 'SELECT'].includes(node.tagName) || node instanceof HTMLInputElement && !['checkbox', 'radio'].includes(node.type)) || node.isContentEditable); }
window.addEventListener('keydown', event => {
  if (editingText()) return;
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const lane = p().keys.indexOf(event.code.replace('Key', '')); if (lane >= 0) { event.preventDefault(); if (!event.repeat) keyDown(lane); return; }
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) void togglePlay(); }
  else if (event.code === 'Delete' || event.code === 'Backspace') { event.preventDefault(); deleteNote(); }
  else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') { event.preventDefault(); nudge('atMs', (event.code === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 1 : 10)); }
  else if (event.code === 'KeyA' || event.code === 'KeyB') { paintColor = event.code === 'KeyA' ? 'A' : 'B'; refreshTools(); }
  else if (event.code === 'KeyV') setTool('select'); else if (event.code === 'KeyT') setTool('tap'); else if (event.code === 'KeyH') setTool('hold'); else if (event.code === 'KeyE') setTool('erase');
});
window.addEventListener('keyup', event => { const lane = p().keys.indexOf(event.code.replace('Key', '')); if (lane >= 0) keyUp(lane); });
window.addEventListener('blur', () => { pause(); }); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('beforeunload', saveNow);
onLanguageChange(() => { language.value = getLanguage(); refresh(); });

// The vertical ruler and the audio transport share millisecond positions.
let boardW = 600, boardH = 510, overviewW = 600, overviewH = 66;
const leftMargin = 78, rightMargin = 16, topMargin = 24, bottomMargin = 30;
const laneWidth = () => (boardW - leftMargin - rightMargin) / p().keys.length;
const geometry = (): BoardGeometry => ({width: boardW, height: boardH, left: leftMargin, right: rightMargin, top: topMargin, bottom: bottomMargin, lanes: p().keys.length, startMs: viewStart, visibleMs});
const toY = (ms: number) => timeToY(ms, geometry());
const fromY = (y: number) => yToTime(y, geometry());
function canvasSize(node: HTMLCanvasElement, context: CanvasRenderingContext2D) { const rect = node.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); node.width = Math.round(rect.width * dpr); node.height = Math.round(rect.height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0); return [rect.width, rect.height]; }
const resize = new ResizeObserver(() => { [boardW, boardH] = canvasSize(board, ctx); [overviewW, overviewH] = canvasSize(overview, overviewCtx); }); resize.observe(board); resize.observe(overview);
type Drag = {mode: 'move' | 'tail' | 'new'; original: Note; note: Note; startMs: number; startX: number; moved: boolean};
let drag: Drag | undefined;
function pointer(event: PointerEvent) { const rect = board.getBoundingClientRect(); return {x: event.clientX - rect.left, y: event.clientY - rect.top}; }
let scrubbing = false;
function displayedNotes() { return drag ? p().notes.filter(note => note.id !== drag!.note.id).concat(drag.note) : p().notes; }
function hitNote(x: number, y: number) {
  const hit = hitShape(layoutNotes(displayedNotes(), geometry()), x, y, selectedId);
  return hit ? {note: hit.shape.note, tail: hit.tail} : undefined;
}
function overPlayhead(x: number, y: number) { return x < leftMargin || x <= boardW - rightMargin && Math.abs(y - toY(cursorMs)) <= 8; }
function scrubTo(y: number) {
  const target = Math.max(0, Math.min(audio.durationMs || p().audio.durationMs || 3_600_000, fromY(Math.max(topMargin, Math.min(boardH - bottomMargin, y)))));
  followAnchor = Math.max(0, Math.min(1, (target - viewStart) / visibleMs));
  void seek(target, false, true);
}
board.addEventListener('pointerdown', event => {
  if (event.button !== 0 || busy) return; event.preventDefault(); board.focus(); const pos = pointer(event);
  const hit = hitNote(pos.x, pos.y);
  if (pos.x < leftMargin || !hit && overPlayhead(pos.x, pos.y)) {
    pause(); scrubbing = true; drag = undefined; board.style.cursor = 'ns-resize'; board.setPointerCapture(event.pointerId); scrubTo(pos.y); return;
  }
  pause(); const lane = Math.max(0, Math.min(p().keys.length - 1, Math.floor((pos.x - leftMargin) / laneWidth()))); const at = snapped(fromY(pos.y), event.shiftKey);
  if (tool === 'erase') { if (hit) { selectedId = hit.note.id; deleteNote(); } return; }
  if (hit) { selectNote(hit.note.id); drag = {mode: hit.tail ? 'tail' : 'move', original: {...hit.note}, note: {...hit.note}, startMs: fromY(pos.y), startX: pos.x, moved: false}; }
  else if (tool === 'tap') { addNote(at, lane, 'tap', 0, paintColor, false); }
  else if (tool === 'hold') { const note = changeNote({id: uid(), lane, kind: 'hold', color: paintColor, atMs: at, durationMs: 500}, {}, p()); drag = {mode: 'new', original: {...note}, note, startMs: fromY(pos.y), startX: pos.x, moved: false}; }
  else { selectedId = null; refreshInspector(); renderList(); }
  if (drag) board.setPointerCapture(event.pointerId);
});
board.addEventListener('pointermove', event => {
  const pos = pointer(event);
  if (scrubbing) { scrubTo(pos.y); return; }
  if (!drag) { const hit = hitNote(pos.x, pos.y); board.style.cursor = hit ? (hit.tail ? 'ns-resize' : 'grab') : overPlayhead(pos.x, pos.y) ? 'ns-resize' : ''; return; }
  board.style.cursor = 'grabbing'; const delta = fromY(pos.y) - drag.startMs;
  drag.moved ||= Math.abs(delta) > 15 || Math.abs(pos.x - drag.startX) > 3;
  if (!drag.moved) return;
  if (drag.mode === 'tail' || drag.mode === 'new') { const end = snapped(fromY(pos.y), event.shiftKey); drag.note = changeNote(drag.original, {durationMs: Math.max(1, Math.min(audio.durationMs || 3_600_000, end) - drag.original.atMs)}, p()); }
  else { const lane = Math.max(0, Math.min(p().keys.length - 1, Math.floor((pos.x - leftMargin) / laneWidth()))); drag.note = changeNote(drag.original, {atMs: snapped(drag.original.atMs + delta, event.shiftKey), lane}, p()); }
});
board.addEventListener('pointerup', event => {
  if (scrubbing) { scrubTo(pointer(event).y); scrubbing = false; board.style.cursor = ''; return; }
  board.style.cursor = '';
  if (!drag) return; const changed = drag; drag = undefined;
  if (!changed.moved && changed.mode !== 'new') return;
  const next = structuredClone(p()); if (changed.mode === 'new') next.notes.push(changed.note); else next.notes = next.notes.map(note => note.id === changed.note.id ? changed.note : note); selectedId = changed.note.id; commit(next);
});
board.addEventListener('pointercancel', () => { drag = undefined; scrubbing = false; board.style.cursor = ''; });
board.addEventListener('pointerleave', () => { if (!drag && !scrubbing) board.style.cursor = ''; });
board.addEventListener('dblclick', event => { if (tool !== 'select') return; const rect = board.getBoundingClientRect(); const x = event.clientX - rect.left, y = event.clientY - rect.top; if (x >= leftMargin && !hitNote(x, y) && !overPlayhead(x, y)) addNote(fromY(y), Math.floor((x - leftMargin) / laneWidth()), 'tap', 0); });
board.addEventListener('wheel', event => { event.preventDefault(); if (scrubbing || drag) return; follow.node.checked = false; viewStart = Math.max(0, Math.min((audio.durationMs || p().audio.durationMs || 3_600_000) - 1, viewStart + event.deltaY * visibleMs / 800)); }, {passive: false});
overview.addEventListener('pointerdown', event => { const rect = overview.getBoundingClientRect(); void seek((event.clientX - rect.left) / rect.width * (audio.durationMs || p().audio.durationMs || 1)); });
overview.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.code)) { event.preventDefault(); void seek(cursorMs + (event.code === 'ArrowLeft' ? -1000 : 1000)); } });
function drawBoard(now: number, realTime: number) {
  ctx.clearRect(0, 0, boardW, boardH); ctx.fillStyle = '#101d20'; ctx.fillRect(0, 0, boardW, boardH);
  const width = laneWidth();
  for (let i = 0; i < p().keys.length; i++) { const x = leftMargin + i * width; ctx.fillStyle = pressed.has(i) ? '#274443' : i % 2 ? '#142326' : '#112023'; ctx.fillRect(x, 0, width - 1, boardH); }
  const step = 60_000 / p().grid.bpm * 4 / (Number(snap.value) || 4);
  const first = Math.ceil((viewStart - p().grid.offsetMs) / step);
  ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'right';
  for (let i = first; ; i++) { const ms = i * step + p().grid.offsetMs; const y = toY(ms); if (y < 0) break; if (y > boardH) continue;
    const beatIndex = (ms - p().grid.offsetMs) / (60_000 / p().grid.bpm);
    const beat = Math.abs(beatIndex - Math.round(beatIndex)) < .001;
    const labelEvery = Math.max(1, Math.ceil(18 * visibleMs / (boardH - topMargin - bottomMargin) / (60_000 / p().grid.bpm)));
    ctx.strokeStyle = beat ? '#334347' : '#213236'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(leftMargin, Math.round(y) + .5); ctx.lineTo(boardW - rightMargin, Math.round(y) + .5); ctx.stroke();
    if (beat && Math.round(beatIndex) % labelEvery === 0) { ctx.fillStyle = '#8b9e9e'; ctx.fillText((ms / 1000).toFixed(2), leftMargin - 30, y + 3); }
  }
  if (audio.loaded) { ctx.fillStyle = '#43605d'; for (let y = 0; y < boardH; y += 3) { const time = fromY(y); const peak = audio.waveform[Math.floor(time / audio.durationMs * audio.waveform.length)] || 0; ctx.fillRect(leftMargin - 24, y, peak * 19, 2); } }
  const shapes = layoutNotes(displayedNotes(), geometry()).filter(shape => shape.headY >= -12 && shape.tailY <= boardH + 12);
  // Paint hold bodies first so every tap/head remains visible and selectable.
  for (const {note, x, width: w, headY: y, tailY: tail} of shapes) {
    if (note.kind !== 'hold') continue;
    const crossed = audio.playing && now >= note.atMs && now < endOf(note);
    ctx.fillStyle = p().palette[note.color] + (crossed ? '99' : '36'); ctx.fillRect(x + w * .2, tail, w * .6, y - tail);
    ctx.fillStyle = p().palette[note.color]; ctx.fillRect(x + w * .2, tail - 3, w * .6, 6);
  }
  for (const {note, x, width: w, headY: y, tailY: tail, marker} of shapes) {
    const color = p().palette[note.color], chosen = note.id === selectedId || note.id === drag?.note.id;
    const flash = realTime - (flashTimes.get(note.id) ?? -10000) < 150;
    ctx.globalAlpha = !audio.playing || now <= endOf(note) + 160 ? 1 : .38;
    ctx.fillStyle = flash ? '#fff7da' : color; ctx.fillRect(x, y - 7, w, 14);
    // Arrow tip and timing tick are centered on the true timestamp, without visual time shifts.
    ctx.fillStyle = chosen ? '#fff4d2' : color; ctx.beginPath(); ctx.moveTo(x - marker, y - Math.min(4, marker)); ctx.lineTo(x - 1, y); ctx.lineTo(x - marker, y + Math.min(4, marker)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0a181a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.min(8, w * .22), y); ctx.stroke();
    if (w >= 10) { ctx.fillStyle = '#112023'; ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(note.color, x + w / 2, y + 3); }
    if (chosen || cachedConflicts.has(note.id)) { ctx.strokeStyle = chosen ? '#fff4d2' : '#ff6464'; ctx.lineWidth = chosen ? 2 : 1; ctx.strokeRect(x - 2, tail - 10, w + 4, y - tail + 20); if (note.kind === 'hold') { ctx.fillStyle = '#fff4d2'; ctx.fillRect(x + w * .3, tail - 2, w * .4, 4); } }
    ctx.globalAlpha = 1;
  }
  const y = toY(now);
  if (y >= 0 && y <= boardH) {
    ctx.strokeStyle = '#e3c686'; ctx.lineWidth = scrubbing ? 3 : 2; ctx.beginPath(); ctx.moveTo(leftMargin, y); ctx.lineTo(boardW - rightMargin, y); ctx.stroke();
    const handleY = Math.max(10, Math.min(boardH - 10, y)); ctx.fillStyle = '#e3c686'; ctx.fillRect(3, handleY - 10, leftMargin - 16, 20);
    ctx.beginPath(); ctx.moveTo(leftMargin - 13, y - 6); ctx.lineTo(leftMargin, y); ctx.lineTo(leftMargin - 13, y + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#182222'; ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(msClock(now), (leftMargin - 10) / 2, handleY + 3);
  }
  ctx.textAlign = 'left'; ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#90a7a7'; ctx.fillText('s', 16, 15);
  [...laneStrip.children].forEach((node, lane) => node.classList.toggle('pressed', pressed.has(lane)));
}
function drawOverview(now: number) {
  const duration = audio.durationMs || p().audio.durationMs || 1; const x = (ms: number) => ms / duration * overviewW;
  overviewCtx.clearRect(0, 0, overviewW, overviewH); overviewCtx.fillStyle = '#0d191c'; overviewCtx.fillRect(0, 0, overviewW, overviewH);
  if (loop.node.checked) { overviewCtx.fillStyle = '#e3c68620'; overviewCtx.fillRect(x(Number(loopIn.value)), 0, x(Number(loopOut.value) - Number(loopIn.value)), overviewH); }
  overviewCtx.fillStyle = '#718f88'; for (let i = 0; i < overviewW; i += 2) { const amplitude = audio.waveform[Math.floor(i / overviewW * audio.waveform.length)] || 0; overviewCtx.fillRect(i, overviewH / 2 - amplitude * 25, 1, amplitude * 50); }
  for (const note of p().notes) { overviewCtx.fillStyle = p().palette[note.color]; overviewCtx.fillRect(x(note.atMs), overviewH - 5, 1, 3); }
  overviewCtx.strokeStyle = '#91a8a45e'; overviewCtx.strokeRect(x(viewStart), 1, x(visibleMs), overviewH - 2);
  overviewCtx.fillStyle = '#e3c686'; overviewCtx.fillRect(x(now), 0, 2, overviewH);
}
let lastLabel = 0, looping = false;
function frame(realTime: number) {
  const now = audio.now(); cursorMs = now;
  if (audio.playing) {
    if (follow.node.checked && !drag && !scrubbing) viewStart = Math.max(0, now - visibleMs * followAnchor);
    for (const note of p().notes) if (note.atMs > previousTime && note.atMs <= now) flashTimes.set(note.id, realTime);
    if (loop.node.checked && now >= Number(loopOut.value) && !looping) { looping = true; void seek(Number(loopIn.value), true).finally(() => looping = false); }
    else if (now >= audio.durationMs) pause();
  }
  previousTime = now; for (const [id, time] of flashTimes) if (realTime - time > 200) flashTimes.delete(id);
  drawBoard(now, realTime); drawOverview(now);
  if (realTime - lastLabel > 90) { timeLabel.textContent = `${msClock(now)} / ${msClock(audio.durationMs || p().audio.durationMs || 0)}`; if (document.activeElement !== position) position.value = String(Math.round(now)); lastLabel = realTime; }
  requestAnimationFrame(frame);
}
refresh(); void loadCurrentAudio(); requestAnimationFrame(frame);
