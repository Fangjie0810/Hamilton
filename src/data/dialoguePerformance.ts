import catalog from './voiceover-catalog.json';
import { chapters } from './chapters';
import { discoveries, interactionEchoDefinitions } from './discoveries';
import { smallTalk, newsboyThanks } from './smallTalk';
import { debateArguments } from './debate';
import { dispatches } from './writing';
import { assaultCommands } from './yorktown';
import { MAIN_PIXEL_ART, type PortraitPose, type DialoguePerformance } from './mainPixelArt';
import type { CharacterId, DialogueLine } from './types';
import { bi, type Text } from '../i18n/text';

/** Authored cue assignments audited against every branch on 2026-09-14.
 * These are explicit cue IDs, not text keywords or a sampled playthrough.
 * New cues deliberately fall back until their performance is authored.
 */
const poseCues: Partial<Record<PortraitPose, readonly string[]>> = {
  "reflect": [
    "opening-letter-base-1",
    "arrival-newspaper-base-2",
    "burr-observe-selected",
    "burr-question-selected",
    "burr-question-reply-1",
    "laurens-representation-selected",
    "lafayette-negotiate-selected",
    "lafayette-negotiate-reply-1",
    "lafayette-allies-reply-1",
    "debate-round-1-fact",
    "debate-round-2-fact",
    "debate-round-3-fact",
    "debate-round-4-fact",
    "debate-round-5-fact",
    "debate-round-6-fact",
    "washington-offer-base-1",
    "washington-dispatch-base-2",
    "dispatch-north-supplies",
    "dispatch-north-position",
    "dispatch-north-time",
    "dispatch-north-troops",
    "dispatch-north-objective",
    "dispatch-medical-position",
    "dispatch-medical-troops",
    "dispatch-medical-objective",
    "dispatch-medical-supplies",
    "dispatch-medical-time",
    "dispatch-muster-time",
    "dispatch-muster-objective",
    "dispatch-muster-position",
    "dispatch-muster-supplies",
    "dispatch-muster-troops",
    "discovery-letter-name-repeat-1",
    "discovery-arrival-burr-margin-base-1",
    "discovery-arrival-burr-margin-base-2",
    "discovery-arrival-burr-margin-repeat-1",
    "discovery-arrival-burr-margin-ask-selected",
    "discovery-tavern-unfinished-draft-base-1",
    "discovery-tavern-unfinished-draft-base-2",
    "discovery-camp-misfiled-dispatch-base-1",
    "discovery-camp-misfiled-dispatch-base-2",
    "discovery-camp-misfiled-dispatch-repeat-1",
    "discovery-camp-misfiled-dispatch-inactive-1",
    "discovery-camp-misfiled-dispatch-correct-selected",
    "discovery-letter-name-echo-base-1",
    "discovery-letter-name-echo-inactive-1",
    "discovery-burr-respect-base-1",
    "discovery-burr-respect-variant-1-1",
    "echo-square-low-momentum",
    "echo-camp-detail-recall",
    "echo-yorktown-low-momentum"
  ],
  "write": [
    "opening-letter-base-2",
    "yorktown-surrender-base-1",
    "discovery-letter-name-base-1"
  ],
  "assertive": [
    "opening-letter-base-3",
    "arrival-newspaper-base-1",
    "arrival-street-base-2",
    "arrival-burr-base-2",
    "burr-revolution-selected",
    "tavern-laurens-base-3",
    "laurens-representation-reply-1",
    "laurens-liberty-selected",
    "tavern-lafayette-base-1",
    "lafayette-independence-selected",
    "tavern-mulligan-base-1",
    "mulligan-print-selected",
    "mulligan-rally-selected",
    "debate-loyalist-base-1",
    "debate-round-1-argument",
    "debate-round-1-principle",
    "debate-round-1-attack",
    "debate-round-1-crowd",
    "debate-round-2-argument",
    "debate-round-2-principle",
    "debate-round-2-attack",
    "debate-round-2-crowd",
    "debate-round-3-argument",
    "debate-round-3-principle",
    "debate-round-3-attack",
    "debate-round-3-crowd",
    "debate-round-4-argument",
    "debate-round-4-principle",
    "debate-round-4-attack",
    "debate-round-4-crowd",
    "debate-round-5-argument",
    "debate-round-5-principle",
    "debate-round-5-attack",
    "debate-round-5-crowd",
    "debate-round-6-argument",
    "debate-round-6-principle",
    "debate-round-6-attack",
    "debate-round-6-crowd",
    "washington-offer-base-2",
    "washington-offer-variant-1-2",
    "washington-negotiate-selected",
    "washington-demand-selected",
    "discovery-letter-name-base-2",
    "discovery-arrival-burr-margin-challenge-selected",
    "discovery-tavern-unfinished-draft-repeat-1",
    "discovery-tavern-unfinished-draft-complete-selected",
    "discovery-tavern-unfinished-draft-complete-reply-1",
    "discovery-burr-rivalry-base-1",
    "discovery-burr-rivalry-base-3",
    "discovery-burr-rivalry-variant-1-1",
    "discovery-burr-rivalry-variant-1-3",
    "echo-square-draft-courage",
    "echo-square-high-momentum"
  ],
  "concern": [
    "arrival-street-base-1",
    "arrival-street-base-3",
    "arrival-burr-base-3",
    "burr-revolution-reply-1",
    "tavern-laurens-base-1",
    "tavern-laurens-base-2",
    "laurens-stability-selected",
    "laurens-stability-reply-1",
    "tavern-lafayette-base-2",
    "mulligan-rally-reply-1",
    "debate-loyalist-base-2",
    "debate-loyalist-base-3",
    "washington-offer-variant-1-1",
    "washington-demand-reply-1",
    "yorktown-command-base-2",
    "yorktown-command-base-3",
    "yorktown-command-variant-1-3",
    "yorktown-surrender-base-3",
    "discovery-square-bread-and-prices-base-1",
    "discovery-square-bread-and-prices-base-2",
    "discovery-letter-name-echo-base-2",
    "discovery-letter-name-echo-repeat-1",
    "echo-square-bread-recall"
  ],
  "calm": [
    "arrival-burr-base-1",
    "tavern-laurens-timeout",
    "tavern-lafayette-timeout",
    "tavern-mulligan-timeout",
    "discovery-square-bread-and-prices-inactive-1",
    "small-talk-newsboy",
    "small-talk-citizen",
    "small-talk-loyalist",
    "small-talk-burr",
    "small-talk-laurens",
    "small-talk-washington"
  ],
  "approve": [
    "burr-observe-reply-1",
    "laurens-liberty-reply-1",
    "lafayette-allies-selected",
    "lafayette-independence-reply-1",
    "tavern-mulligan-base-2",
    "mulligan-print-reply-1",
    "mulligan-supplies-selected",
    "mulligan-supplies-reply-1",
    "washington-accept-selected",
    "washington-accept-reply-1",
    "yorktown-command-variant-1-2",
    "discovery-arrival-scattered-paper-base-1",
    "discovery-arrival-scattered-paper-base-2",
    "discovery-arrival-scattered-paper-base-3",
    "discovery-arrival-scattered-paper-repeat-1",
    "discovery-arrival-burr-margin-ask-reply-1",
    "discovery-square-bread-and-prices-base-3",
    "discovery-square-bread-and-prices-repeat-1",
    "discovery-camp-misfiled-dispatch-correct-reply-1",
    "discovery-camp-misfiled-dispatch-correct-reply-2",
    "discovery-burr-respect-base-2",
    "discovery-burr-respect-base-3",
    "discovery-burr-respect-variant-1-2",
    "discovery-burr-respect-variant-1-3",
    "discovery-burr-respect-repeat-1",
    "echo-square-paper-recognition",
    "echo-square-influence-recognition",
    "echo-camp-duty-trust",
    "echo-yorktown-detail-recall",
    "small-talk-mulligan"
  ],
  "command": [
    "washington-offer-base-3",
    "washington-offer-variant-1-3",
    "washington-negotiate-reply-1",
    "washington-dispatch-base-1",
    "yorktown-coordinate-selected",
    "yorktown-coordinate-reply-1",
    "yorktown-lead-selected",
    "yorktown-lead-reply-1",
    "yorktown-rally-selected",
    "yorktown-rally-reply-1",
    "yorktown-command-1",
    "yorktown-command-2",
    "yorktown-command-3",
    "yorktown-command-4",
    "yorktown-command-5",
    "yorktown-command-6",
    "yorktown-command-7",
    "yorktown-command-8",
    "yorktown-command-9",
    "yorktown-command-10",
    "yorktown-command-11",
    "yorktown-command-12",
    "echo-yorktown-high-momentum"
  ],
  "turn": [
    "yorktown-command-base-1",
    "yorktown-command-variant-1-1",
    "yorktown-surrender-base-2"
  ],
  "challenge": [
    "discovery-arrival-burr-margin-challenge-reply-1",
    "discovery-burr-rivalry-base-2",
    "discovery-burr-rivalry-variant-1-2",
    "discovery-burr-rivalry-repeat-1"
  ],
  "amused": [
    "small-talk-lafayette"
  ]
};

interface AuditedPerformance extends DialoguePerformance {
  readonly id: string;
  readonly speaker: CharacterId;
  /** Relationship-specific listeners override the cue's general response. */
  readonly listeners?: Readonly<Partial<Record<CharacterId, PortraitPose>>>;
}

const settlePose: Partial<Record<PortraitPose, PortraitPose>> = {
  // Command gestures and amused expressions are separately drawn reaction frames.
  // Holding them after speech makes their attitude visible with the basic mouth set.
  assertive: 'calm', turn: 'reflect',
};
const listeningResponse: Partial<Record<PortraitPose, PortraitPose>> = {
  reflect: 'reflect', approve: 'approve', concern: 'concern',
  challenge: 'reflect', amused: 'approve', write: 'reflect', turn: 'reflect',
};
const overrides: Record<string, Partial<Pick<AuditedPerformance, 'settled' | 'listener' | 'listeners' | 'emphasis'>>> = {
  'burr-observe-selected': { listeners: { burr: 'approve' } },
  'burr-question-selected': { listeners: { burr: 'reflect' } },
  'burr-revolution-selected': { listeners: { burr: 'concern' }, emphasis: true },
  'burr-revolution-reply-1': { listeners: { hamilton: 'reflect' } },
  'laurens-stability-selected': { listeners: { laurens: 'concern' } },
  'laurens-representation-selected': { listeners: { laurens: 'concern' } },
  'laurens-liberty-selected': { listeners: { laurens: 'approve' } },
  'laurens-liberty-reply-1': { settled: 'approve', listeners: { hamilton: 'approve' } },
  'lafayette-negotiate-selected': { listeners: { lafayette: 'reflect' } },
  'lafayette-allies-selected': { listeners: { lafayette: 'approve' } },
  'lafayette-independence-selected': { listeners: { lafayette: 'approve' }, emphasis: true },
  'lafayette-independence-reply-1': { settled: 'approve', listeners: { hamilton: 'approve' } },
  'mulligan-print-selected': { listeners: { mulligan: 'approve' } },
  'mulligan-supplies-selected': { listeners: { mulligan: 'approve' } },
  'mulligan-rally-selected': { listeners: { mulligan: 'concern' }, emphasis: true },
  'mulligan-rally-reply-1': { listeners: { hamilton: 'reflect' } },
  'washington-accept-selected': { listeners: { washington: 'approve' } },
  'washington-negotiate-selected': { listeners: { washington: 'reflect' } },
  'washington-demand-selected': { listeners: { washington: 'concern' }, emphasis: true },
  'washington-demand-reply-1': { listeners: { hamilton: 'concern' }, emphasis: true },
  'washington-offer-variant-1-1': { listeners: { hamilton: 'reflect' } },
  'yorktown-command-base-2': { listeners: { hamilton: 'reflect' }, emphasis: true },
  'yorktown-command-variant-1-2': { listeners: { hamilton: 'concern' } },
  'yorktown-command-variant-1-3': { listeners: { washington: 'approve' } },
  'echo-yorktown-detail-recall': { listeners: { hamilton: 'concern' } },
  'yorktown-surrender-base-3': { settled: 'reflect', listener: 'reflect' },
  'discovery-letter-name-echo-base-2': { settled: 'reflect', listener: 'reflect' },
  'discovery-letter-name-echo-repeat-1': { settled: 'reflect', listener: 'reflect' },
  'discovery-arrival-burr-margin-challenge-selected': { listeners: { burr: 'challenge' } },
  'discovery-arrival-burr-margin-challenge-reply-1': { listeners: { hamilton: 'assertive' } },
  'discovery-burr-rivalry-base-1': { listeners: { burr: 'challenge' } },
  'discovery-burr-rivalry-base-3': { listeners: { burr: 'challenge' } },
  'discovery-burr-rivalry-variant-1-1': { listeners: { burr: 'challenge' } },
  'discovery-burr-rivalry-variant-1-3': { listeners: { burr: 'challenge' } },
  'discovery-burr-rivalry-base-2': { listeners: { hamilton: 'assertive' } },
  'discovery-burr-rivalry-variant-1-2': { listeners: { hamilton: 'assertive' } },
  'discovery-burr-rivalry-repeat-1': { listeners: { hamilton: 'assertive' } },
  'discovery-square-bread-and-prices-base-1': { listeners: { citizen: 'concern' } },
  'discovery-square-bread-and-prices-base-2': { listeners: { hamilton: 'reflect' } },
  'discovery-square-bread-and-prices-base-3': { listeners: { citizen: 'approve' } },
  'echo-square-paper-recognition': { listeners: { hamilton: 'approve' } },
  'echo-square-influence-recognition': { listeners: { hamilton: 'approve' } },
  'echo-square-bread-recall': { listeners: { hamilton: 'reflect' } },
  'small-talk-lafayette': { settled: 'amused', listeners: { hamilton: 'approve' } },
  'tavern-laurens-timeout': { listeners: { hamilton: 'calm' } },
  'tavern-lafayette-timeout': { listeners: { hamilton: 'calm' } },
  'tavern-mulligan-timeout': { listeners: { hamilton: 'calm' } },
};
const accentedCues = new Set([
  'opening-letter-base-3', 'tavern-laurens-base-1', 'tavern-laurens-base-3',
  'laurens-representation-reply-1', 'tavern-lafayette-base-1',
  'tavern-mulligan-base-1', 'arrival-newspaper-base-1',
]);

function isCharacter(speaker: string): speaker is CharacterId {
  return Object.hasOwn(MAIN_PIXEL_ART, speaker);
}
function available(character: CharacterId, pose: PortraitPose, fallback: PortraitPose): PortraitPose {
  return Object.hasOwn(MAIN_PIXEL_ART[character].poses, pose) ? pose : fallback;
}

/** Exact source performances survive both pending and completed audio generation. */
export const SOURCE_DIALOGUE_PERFORMANCE_AUDIT: ReadonlyArray<{ line: DialogueLine; performance: AuditedPerformance }> = [
  { line: smallTalk.newsboy, performance: { id: 'newsboy-missing-pages', speaker: 'newsboy', speaking: 'calm', settled: 'calm', listener: 'concern', emphasis: false } },
  { line: newsboyThanks, performance: { id: 'newsboy-returned-pages', speaker: 'newsboy', speaking: 'approve', settled: 'approve', listener: 'approve', emphasis: false } },
  { line: discoveries.find(def => def.id === 'arrival-scattered-paper')!.lines[0], performance: { id: 'hamilton-returns-pages', speaker: 'hamilton', speaking: 'approve', settled: 'approve', listener: 'approve', emphasis: false } },
];

const audited: Record<string, AuditedPerformance> = {};
for (const [pose, ids] of Object.entries(poseCues) as [PortraitPose, readonly string[]][]) {
  for (const id of ids) {
    const cue = catalog.find(entry => entry.id === id);
    // Removed cues need no runtime mapping; coverage tests flag stale audit entries.
    if (!cue || !isCharacter(cue.speaker)) continue;
    const sprite = MAIN_PIXEL_ART[cue.speaker];
    const debate = id.startsWith('debate-round-');
    const military = id.startsWith('yorktown-command-') && /^yorktown-command-\d+$/.test(id);
    const override = overrides[id];
    audited[id] = Object.freeze({
      id, speaker: cue.speaker, speaking: pose,
      settled: available(cue.speaker, settlePose[pose] ?? pose, sprite.listenPose),
      listener: listeningResponse[pose] ?? 'calm',
      emphasis: accentedCues.has(id) || military || (debate && (cue.speaker === 'loyalist' || id.endsWith('-attack') || id.endsWith('-crowd'))),
      ...(debate && cue.speaker === 'hamilton' ? { listeners: { loyalist: 'challenge' as const } } : {}),
      ...override,
    });
  }
}
for (const cue of catalog) {
  const source = SOURCE_DIALOGUE_PERFORMANCE_AUDIT.find(item => item.line.speaker === cue.speaker && item.line.text.en === cue.text);
  if (source) audited[cue.id] = Object.freeze({ ...source.performance, id: cue.id });
}
/** Complete inspectable assignment set, keyed by the same IDs as the voice catalog. */
export const DIALOGUE_PERFORMANCE_AUDIT: Readonly<Record<string, AuditedPerformance>> = Object.freeze(audited);

const exactText = new Map<string, AuditedPerformance>();
const cueKey = (speaker: string, text: string) => `${speaker}\u0000${text}`;
for (const cue of catalog) {
  const performance = audited[cue.id];
  if (performance) exactText.set(cueKey(cue.speaker, cue.text), performance);
}
// Existing bilingual source supplies exact Chinese aliases. Neither translated UI
// text nor the active language determines acting, and no production docs are loaded.
const chineseByEnglish = new Map<string, string>();
function indexSource(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if ('zh' in value && 'en' in value && typeof value.zh === 'string' && typeof value.en === 'string') {
    chineseByEnglish.set(value.en, value.zh); return;
  }
  for (const nested of Object.values(value)) indexSource(nested);
}
indexSource([chapters, discoveries, interactionEchoDefinitions, smallTalk, debateArguments, dispatches, assaultCommands]);
indexSource(bi('你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。', "You fall silent for a moment. That's all right. Listen to the others first; there will still be a place for you at this table."));
// Retained recordings keep their original exact aliases during the text revision.
// These aliases affect acting only; runtime voice lookup still requires exact text.
indexSource([
  bi('先别把报纸折起来，墨还没干呢。', "Don't fold the paper yet. The ink is still wet."),
  bi('等等，你还少了这几张。我替你压住它们。', 'Wait, these pages are yours too. Let me hold them down.'),
  bi('多谢！你就是刚才买报的先生。我会记得你的名字。', 'Thank you! You are the gentleman who just bought a paper. I will remember your name.'),
  bi('报纸都收好了，汉密尔顿先生！这一回，风抢不过我。', 'All the papers are safe, Mr. Hamilton! The wind will not get them this time.'),
]);
for (const cue of catalog) {
  const zh = chineseByEnglish.get(cue.text), performance = audited[cue.id];
  if (zh && performance) exactText.set(cueKey(cue.speaker, zh), performance);
}

for (const { line, performance } of SOURCE_DIALOGUE_PERFORMANCE_AUDIT) {
  exactText.set(cueKey(line.speaker, line.text.en), performance);
  exactText.set(cueKey(line.speaker, line.text.zh), performance);
}

/** Resolve a line without consulting its displayed language or inferring mood from keywords. */
export function getDialoguePerformance(line: { speaker: string; text: Text }, partner?: CharacterId): DialoguePerformance {
  const speaker = isCharacter(line.speaker) ? line.speaker : 'narrator';
  const sprite = MAIN_PIXEL_ART[speaker];
  const auditedLine = exactText.get(cueKey(line.speaker, typeof line.text === 'string' ? line.text : line.text.en));
  const fallbackListener = partner ? MAIN_PIXEL_ART[partner].listenPose : 'calm';
  const response = (partner && auditedLine?.listeners?.[partner]) ?? auditedLine?.listener ?? fallbackListener;
  // Being heard is not endorsement: this opponent remains skeptical while Hamilton speaks.
  const listeningPose = partner === 'loyalist' && speaker === 'hamilton' && response === 'approve' ? 'challenge' : response;
  return {
    speaking: available(speaker, auditedLine?.speaking ?? sprite.defaultPose, sprite.defaultPose),
    settled: available(speaker, auditedLine?.settled ?? sprite.listenPose, sprite.listenPose),
    listener: partner ? available(partner, listeningPose, fallbackListener) : listeningPose,
    emphasis: auditedLine?.emphasis ?? false,
  };
}

export type ActivityReactionOutcome = 'success' | 'miss' | 'neutral';
/** Results come from the game state, never from guessing the words in a voiced cue. */
export function getActivityReaction(activity: 'debate' | 'writing' | 'yorktown', outcome: ActivityReactionOutcome): DialoguePerformance {
  const partner: CharacterId = activity === 'debate' ? 'loyalist' : activity === 'writing' ? 'washington' : 'lafayette';
  const pose: PortraitPose = outcome === 'success' ? 'approve' : outcome === 'miss' ? 'concern' : 'calm';
  const listener: PortraitPose = activity === 'debate' ? 'challenge' : outcome === 'success' ? 'approve' : outcome === 'miss' ? 'reflect' : 'calm';
  return {
    speaking: pose, settled: pose,
    listener: available(partner, listener, MAIN_PIXEL_ART[partner].listenPose), emphasis: false,
  };
}
