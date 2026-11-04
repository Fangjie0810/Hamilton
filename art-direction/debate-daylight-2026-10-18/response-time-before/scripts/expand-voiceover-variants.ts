/** Enumerate actual game results, keeping the existing bilingual wording. */
import fs from 'node:fs';
import { DebateSystem } from '../src/systems/DebateSystem';
import { YorktownSystem } from '../src/systems/YorktownSystem';
import { WritingSystem } from '../src/systems/WritingSystem';
import { responseTypes } from '../src/data/debate';
import { assaultCommands, guards, orders } from '../src/data/yorktown';
import { dispatches } from '../src/data/writing';
import { gradeValue, type BeatGrade } from '../src/systems/TimingSystem';
import { f, type BiText } from '../src/i18n/text';

const dir = new URL('../docs/voiceover/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', dir), 'utf8'));
const won = new Set<number>(), held = new Set<number>();
let frontier = [new DebateSystem()];
let explored = 0;
while (frontier.length) {
  const next = new Map<string, DebateSystem>();
  for (const previous of frontier) {
    for (const response of [...responseTypes, null]) {
      for (const elapsed of response === null ? [0] : [1200, 1000, 0]) {
        const game = new DebateSystem();
        Object.assign(game, { round: previous.round, crowd: previous.crowd, credibility: previous.credibility, flow: previous.flow });
        game.history.push(...previous.history);
        game.ready();
        if (response === null) { game.elapsed = 2500; game.tick(0); }
        else { game.select(response); game.elapsed = elapsed; game.hit(); }
        game.next(); explored++;
        if (game.phase === 'result') (game.won ? won : held).add(game.performance);
        else {
          // History affects future scoring only through its sum and length. Keep
          // the exact JS sum, including floating-point order, in the state key.
          const sum = game.history.reduce((s, h) => s + gradeValue(h.grade), 0);
          next.set([game.round, game.crowd, game.credibility, game.flow, sum].join(':'), game);
        }
      }
    }
  }
  frontier = [...next.values()];
}

const writing = new Set<number>();
const fragmentCount = dispatches.reduce((s, d) => s + d.fragments.length, 0);
for (let correct = 0; correct <= fragmentCount; correct++) {
  const game = new WritingSystem();
  let remaining = correct;
  game.scores = dispatches.map(d => { const n = Math.min(remaining, d.fragments.length); remaining -= n; return n; });
  writing.add(game.performance);
}

// Preserve each attainable floating-point sum so rounding matches the game.
let gradePaths = new Map<number, BeatGrade[]>([[0, []]]);
for (let i = 0; i < assaultCommands.length; i++) {
  const next = new Map<number, BeatGrade[]>();
  for (const [sum, grades] of gradePaths) for (const grade of ['MISS', 'GOOD', 'PERFECT'] as BeatGrade[]) {
    next.set(sum + gradeValue(grade), [...grades, grade]);
  }
  gradePaths = next;
}
const yorktown = new Set<number>();
for (let detections = 0; detections <= guards.length; detections++) {
  for (const a of orders) for (const b of orders) for (const c of orders) {
    const game = new YorktownSystem();
    game.surprise = Math.max(0, 100 - detections * 20);
    game.phase = 'command'; game.deployment = [a, b, c]; game.deploy();
    for (const grades of gradePaths.values()) { game.grades = grades; yorktown.add(game.performance); }
  }
}
const values: Record<string, number[]> = {
  'washington-activity-feedback-5bcb794d52fded06': Array.from({ length: Math.max(...dispatches.map(d => d.fragments.length)) + 1 }, (_, i) => i),
  'yorktown-activity-feedback-b2db47ce7a5dae33': guards.map((_, i) => i + 1),
  'ending-ending-4fda0dc8320acefd': [...won],
  'ending-ending-7ce5bff747ae44f9': [...held],
  'ending-ending-6a2add261a5e005a': [...writing],
  'ending-ending-dfd1df62494ab108': [...yorktown],
};
const templates = manifest.cues.filter((c: { dynamic: boolean; chapter: string }) => c.dynamic && c.chapter !== 'Demo');
if (templates.length !== Object.keys(values).length) throw Error('Dynamic template inventory changed; review enumeration');
const cues = templates.flatMap((cue: {id: string; text: BiText}) => {
  if (!values[cue.id]?.length) throw Error(`No values: ${cue.id}`);
  return values[cue.id].sort((a, b) => a - b).map(value => ({ ...cue, id: `${cue.id}-value-${value}`, templateId: cue.id, parameters: [value], dynamic: false, text: f(cue.text, value) }));
});
fs.writeFileSync(new URL('dynamic-variants.json', dir), JSON.stringify({ schemaVersion: 1, derivation: 'Actual DebateSystem transitions and WritingSystem/YorktownSystem performance getters; no dialogue rewrite.', exploredDebateTransitions: explored, values, cues }, null, 2) + '\n');
console.log(JSON.stringify({ expandedCues: cues.length, exploredDebateTransitions: explored, counts: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.length])) }, null, 2));
