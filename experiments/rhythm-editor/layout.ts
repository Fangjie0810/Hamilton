import {endOf, type Note} from './model';

export interface BoardGeometry {
  width: number; height: number; left: number; right: number; top: number; bottom: number;
  lanes: number; startMs: number; visibleMs: number;
}
export interface NoteShape {
  note: Note; x: number; width: number; headY: number; tailY: number;
  column: number; columns: number; marker: number;
}
export const HEAD_HEIGHT = 14;
const HEAD_CLEARANCE = 22;
export const timeToY = (ms: number, board: BoardGeometry) => board.height - board.bottom - (ms - board.startMs) / board.visibleMs * (board.height - board.top - board.bottom);
export const yToTime = (y: number, board: BoardGeometry) => board.startMs + (board.height - board.bottom - y) / (board.height - board.top - board.bottom) * board.visibleMs;

/** Pack only display geometry. Times, lanes and note identities never change. */
export function layoutNotes(notes: readonly Note[], board: BoardGeometry): NoteShape[] {
  const laneWidth = (board.width - board.left - board.right) / board.lanes;
  const separationMs = HEAD_CLEARANCE * board.visibleMs / (board.height - board.top - board.bottom);
  const result: NoteShape[] = [];
  const lanes = new Map<number, Note[]>();
  for (const note of notes) { const lane = lanes.get(note.lane) ?? []; lane.push(note); lanes.set(note.lane, lane); }
  for (const [lane, laneNotes] of lanes) {
    laneNotes.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
    let group: {note: Note; column: number}[] = [];
    let release: number[] = [];
    const flush = () => {
      const columns = release.length;
      for (const {note, column} of group) {
        const cell = laneWidth * .84 / columns;
        const gap = Math.min(10, cell * .27);
        const x = board.left + lane * laneWidth + (columns === 1 ? laneWidth * .15 : laneWidth * .08 + column * cell + gap);
        const width = columns === 1 ? laneWidth * .7 : cell - gap;
        result.push({note, x, width, headY: timeToY(note.atMs, board), tailY: timeToY(endOf(note), board), column, columns, marker: columns === 1 ? Math.min(8, laneWidth * .1) : gap * .8});
      }
      group = []; release = [];
    };
    for (const note of laneNotes) {
      const last = group.at(-1)?.note;
      if (last && note.atMs - last.atMs >= separationMs) flush();
      let column = release.findIndex(time => note.atMs - time >= separationMs);
      if (column < 0) column = release.length;
      release[column] = note.atMs; group.push({note, column});
    }
    if (group.length) flush();
  }
  return result;
}

/** Use the same compressed bounds as painting; heads take precedence over hold bodies. */
export function hitShape(shapes: readonly NoteShape[], x: number, y: number, selectedId: string | null): {shape: NoteShape; tail: boolean} | undefined {
  const across = shapes.filter(shape => x >= shape.x - shape.marker && x <= shape.x + shape.width);
  const heads = across.filter(shape => Math.abs(y - shape.headY) <= HEAD_HEIGHT / 2 + 2);
  heads.sort((a, b) => Math.abs(y - a.headY) - Math.abs(y - b.headY) || Number(b.note.id === selectedId) - Number(a.note.id === selectedId));
  if (heads[0]) return {shape: heads[0], tail: false};
  const tails = across.filter(shape => shape.note.kind === 'hold' && Math.abs(y - shape.tailY) <= 7);
  tails.sort((a, b) => Math.abs(y - a.tailY) - Math.abs(y - b.tailY));
  if (tails[0]) return {shape: tails[0], tail: true};
  const bodies = across.filter(shape => shape.note.kind === 'hold' && y >= shape.tailY && y <= shape.headY);
  bodies.sort((a, b) => Number(b.note.id === selectedId) - Number(a.note.id === selectedId));
  if (bodies[0]) return {shape: bodies[0], tail: false};
}
