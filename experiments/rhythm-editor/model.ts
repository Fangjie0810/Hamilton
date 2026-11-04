import { bi } from '../../src/i18n/text';

export const FORMAT = 'hamilton-rhythm-project';
export const VERSION = 1;
export const KEYS = { '4k': ['S', 'D', 'K', 'L'], '6k': ['S', 'D', 'F', 'J', 'K', 'L'] } as const;
export const TRACKS = [
  {id: 'alexander-hamilton', title: bi('Alexander Hamilton', 'Alexander Hamilton')},
  {id: 'my-shot', title: bi('My Shot', 'My Shot')},
  {id: 'helpless', title: bi('Helpless', 'Helpless')},
] as const;
export type TrackId = typeof TRACKS[number]['id'];
export type KeyMode = keyof typeof KEYS;
export type NoteColor = 'A' | 'B';
export type NoteKind = 'tap' | 'hold';
export interface Note { id: string; lane: number; color: NoteColor; kind: NoteKind; atMs: number; durationMs: number }
export interface AudioInfo { fileName: string; sha256: string; mimeType: string; byteLength: number; durationMs: number | null }
export interface Project {
  format: typeof FORMAT; version: typeof VERSION; id: string; name: string; author?: string;
  createdAt: string; modifiedAt: string; trackId: TrackId; keyMode: KeyMode;
  units: 'milliseconds'; laneIndexBase: 0; keys: string[];
  audio: AudioInfo; grid: {bpm: number; offsetMs: number; division: number};
  palette: {A: string; B: string}; notes: Note[];
}
export interface ParsedProject { project: Project; embeddedAudio?: string }
export type ProjectErrorCode = 'format' | 'version' | 'track' | 'keys' | 'audio' | 'grid' | 'notes' | 'bounds' | 'identity' | 'size';
export class ProjectError extends Error { constructor(public code: ProjectErrorCode) { super(code); } }
const fail = (code: ProjectErrorCode): never => { throw new ProjectError(code); };
const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : fail('format');
const text = (v: unknown, max = 200): string => typeof v === 'string' && v.trim() && v.length <= max ? v : fail('format');
const finite = (v: unknown, min: number, max: number, code: ProjectErrorCode, integer = false): number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v)) ? v : fail(code);
export const uid = () => crypto.randomUUID();
export const copyProject = (p: Project): Project => structuredClone(p);
export const endOf = (n: Note) => n.atMs + n.durationMs;
export const sortedNotes = (notes: Note[]) => [...notes].sort((a, b) => a.atMs - b.atMs || a.lane - b.lane || a.id.localeCompare(b.id));
export function createProject(trackId: TrackId, keyMode: KeyMode, audio: AudioInfo): Project {
  const at = new Date().toISOString();
  return {format: FORMAT, version: VERSION, id: uid(), name: TRACKS.find(t => t.id === trackId)!.title.en,
    createdAt: at, modifiedAt: at, trackId, keyMode, units: 'milliseconds', laneIndexBase: 0, keys: [...KEYS[keyMode]],
    audio: {...audio}, grid: {bpm: trackId === 'my-shot' ? 91 : 120, offsetMs: 0, division: 4},
    palette: {A: '#73d8d4', B: '#f1947c'}, notes: []};
}
export function parseProject(input: unknown): ParsedProject {
  const raw = obj(typeof input === 'string' ? (() => { try { return JSON.parse(input); } catch { return fail('format'); } })() : input);
  if (raw.format !== FORMAT) fail('format');
  if (raw.version !== VERSION) fail('version');
  if (!TRACKS.some(track => track.id === raw.trackId)) fail('track');
  if (!Object.hasOwn(KEYS, raw.keyMode) || JSON.stringify(raw.keys) !== JSON.stringify(KEYS[raw.keyMode as KeyMode])) fail('keys');
  if (raw.units !== 'milliseconds' || raw.laneIndexBase !== 0) fail('format');
  if (raw.author !== undefined && (typeof raw.author !== 'string' || raw.author.length > 80)) fail('format');
  const author = typeof raw.author === 'string' ? raw.author.trim() : '';
  const audio = obj(raw.audio); const grid = obj(raw.grid); const palette = obj(raw.palette);
  if (typeof audio.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(audio.sha256)) fail('audio');
  if (typeof audio.mimeType !== 'string' || !/^audio\/[a-zA-Z0-9.+-]+$/.test(audio.mimeType)) fail('audio');
  const audioInfo: AudioInfo = {fileName: text(audio.fileName, 255), sha256: audio.sha256, mimeType: audio.mimeType,
    byteLength: finite(audio.byteLength, 1, 80_000_000, 'audio', true), durationMs: audio.durationMs === null ? null : finite(audio.durationMs, 1, 3_600_000, 'audio', true)};
  if (![1, 2, 4, 8, 16].includes(grid.division)) fail('grid');
  const gridInfo = {bpm: finite(grid.bpm, 20, 400, 'grid'), offsetMs: finite(grid.offsetMs, -60_000, 60_000, 'grid', true), division: grid.division};
  if (![palette.A, palette.B].every(value => typeof value === 'string' && /^#[a-fA-F0-9]{6}$/.test(value))) fail('format');
  if (!Array.isArray(raw.notes) || raw.notes.length > 30_000) fail('notes');
  const ids = new Set<string>();
  const notes: Note[] = raw.notes.map((value: unknown) => {
    const n = obj(value); const id = text(n.id, 120);
    if (ids.has(id)) fail('notes'); ids.add(id);
    const lane = finite(n.lane, 0, raw.keys.length - 1, 'notes', true);
    if (n.key !== undefined && n.key !== raw.keys[lane]) fail('keys');
    if (!['A', 'B'].includes(n.color) || !['tap', 'hold'].includes(n.kind)) fail('notes');
    const atMs = finite(n.atMs, 0, 3_600_000, 'notes', true);
    const durationMs = finite(n.durationMs, n.kind === 'tap' ? 0 : 1, n.kind === 'tap' ? 0 : 3_600_000, 'notes', true);
    if (atMs + durationMs > (audioInfo.durationMs ?? 3_600_000)) fail('bounds');
    return {id, lane, color: n.color, kind: n.kind, atMs, durationMs};
  });
  for (const date of [raw.createdAt, raw.modifiedAt]) if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) fail('format');
  let embeddedAudio: string | undefined;
  if (audio.dataUrl !== undefined) {
    if (typeof audio.dataUrl !== 'string' || audio.dataUrl.length > 108_000_000) fail('size');
    if (!/^data:audio\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]*={0,2}$/.test(audio.dataUrl)) fail('audio');
    embeddedAudio = audio.dataUrl;
  }
  return {project: {format: FORMAT, version: VERSION, id: text(raw.id, 120), name: text(raw.name), createdAt: raw.createdAt, modifiedAt: raw.modifiedAt,
    ...(author ? {author} : {}), trackId: raw.trackId, keyMode: raw.keyMode, units: 'milliseconds', laneIndexBase: 0, keys: [...raw.keys], audio: audioInfo,
    grid: gridInfo, palette: {A: palette.A, B: palette.B}, notes: sortedNotes(notes)}, embeddedAudio};
}
export function serializeProject(project: Project, embeddedAudio?: string): string {
  const result = {...project, notes: sortedNotes(project.notes).map(note => ({...note, key: project.keys[note.lane]})),
    audio: {...project.audio, ...(embeddedAudio ? {dataUrl: embeddedAudio} : {})}};
  parseProject(result);
  return JSON.stringify(result, null, 2) + '\n';
}
export function exportFileName(project: Project): string {
  const safe = (value: string) => value.normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60);
  const author = safe(project.author ?? '');
  return `${safe(project.name) || project.trackId}-${project.keyMode}${author ? '-' + author : ''}.hamchart.json`;
}
export function snapTime(ms: number, grid: Project['grid'], enabled: boolean): number {
  if (!enabled) return Math.max(0, Math.round(ms));
  const step = 60_000 / grid.bpm * 4 / grid.division;
  return Math.max(0, Math.round(Math.round((ms - grid.offsetMs) / step) * step + grid.offsetMs));
}
export function changeNote(note: Note, patch: Partial<Note>, project: Project): Note {
  const next = {...note, ...patch, id: note.id};
  next.lane = Math.min(project.keys.length - 1, Math.max(0, Math.round(next.lane)));
  next.atMs = Math.max(0, Math.round(next.atMs));
  next.durationMs = next.kind === 'tap' ? 0 : Math.max(1, Math.round(next.durationMs || 250));
  const limit = project.audio.durationMs ?? 3_600_000;
  next.durationMs = Math.min(next.durationMs, limit);
  if (patch.atMs !== undefined && patch.durationMs === undefined) {
    next.atMs = Math.min(next.atMs, limit - next.durationMs);
  } else {
    next.atMs = Math.min(next.atMs, limit - (next.kind === 'hold' ? 1 : 0));
    next.durationMs = Math.min(next.durationMs, limit - next.atMs);
  }
  return next;
}
export function conflicts(notes: Note[]): Set<string> {
  const result = new Set<string>(); const lanes = new Map<number, Note[]>();
  for (const note of sortedNotes(notes)) {
    const active = (lanes.get(note.lane) ?? []).filter(other => Math.max(endOf(other), other.atMs + 1) > note.atMs);
    for (const other of active) { result.add(note.id); result.add(other.id); }
    active.push(note); lanes.set(note.lane, active);
  }
  return result;
}
export class History {
  private past: Project[] = []; private future: Project[] = [];
  constructor(public current: Project) { this.current = copyProject(current); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  commit(next: Project): boolean {
    if (JSON.stringify({...next, modifiedAt: ''}) === JSON.stringify({...this.current, modifiedAt: ''})) return false;
    this.past.push(copyProject(this.current)); if (this.past.length > 80) this.past.shift();
    this.current = {...copyProject(next), modifiedAt: new Date().toISOString()}; this.future = []; return true;
  }
  undo() { const prior = this.past.pop(); if (prior) { this.future.push(this.current); this.current = prior; } return !!prior; }
  redo() { const next = this.future.pop(); if (next) { this.past.push(this.current); this.current = next; } return !!next; }
}
export async function audioHash(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function decodeDataUrl(url: string): ArrayBuffer {
  try { const bytes = atob(url.slice(url.indexOf(',') + 1)); const data = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i); return data.buffer; }
  catch { return fail('audio'); }
}
