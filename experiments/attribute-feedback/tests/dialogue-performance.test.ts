import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/data/voiceover-catalog.json';
import { chapters, chapterOrder } from '../src/data/chapters';
import { discoveries, interactionEchoDefinitions } from '../src/data/discoveries';
import { smallTalk, newsboyThanks } from '../src/data/smallTalk';
import { debateArguments, responseTypes } from '../src/data/debate';
import { dispatches } from '../src/data/writing';
import { assaultCommands } from '../src/data/yorktown';
import { StoryProgress } from '../src/story3d/StoryProgress';
import { DIALOGUE_PERFORMANCE_AUDIT, SOURCE_DIALOGUE_PERFORMANCE_AUDIT, getActivityReaction, getDialoguePerformance } from '../src/data/dialoguePerformance';
import { MAIN_PIXEL_ART } from '../src/data/mainPixelArt';
import type { CharacterId, DialogueLine } from '../src/data/types';
import { bi, getLanguage, setLanguage, type LanguageMode } from '../src/i18n/text';

const cast = Object.keys(MAIN_PIXEL_ART) as CharacterId[];
type SpokenKind = 'dialogue' | 'player-option' | 'debate-speech' | 'dispatch-text' | 'battle-command';
interface AuthoredCue extends DialogueLine { id: string; kind: SpokenKind }

/** Enumerate actual playback inputs, not the recording/export manifest. That
 * derivative also includes unspoken UI, retired Demo text and expanded scores.
 * Every authored branch and selected option is visited without sampling a route.
 */
function authoredDialogue(): AuthoredCue[] {
  const result: AuthoredCue[] = [];
  const add = (id: string, line: DialogueLine, kind: SpokenKind = 'dialogue') => result.push({ id, ...line, kind });
  const lines = (prefix: string, values: readonly DialogueLine[]) => values.forEach((line, i) => add(`${prefix}-${i + 1}`, line));
  for (const chapter of chapterOrder) for (const interaction of chapters[chapter].interactions) {
    lines(`${interaction.id}-base`, interaction.lines);
    interaction.variants?.forEach((variant, i) => lines(`${interaction.id}-variant-${i + 1}`, variant.lines));
    for (const option of interaction.choice?.options ?? []) {
      add(`${option.id}-selected`, { speaker: 'hamilton', text: option.text }, 'player-option');
      lines(`${option.id}-reply`, option.reply);
    }
  }
  for (const discovery of discoveries) {
    const prefix = `discovery-${discovery.id}`;
    lines(`${prefix}-base`, discovery.lines);
    discovery.variants?.forEach((variant, i) => lines(`${prefix}-variant-${i + 1}`, variant.lines));
    lines(`${prefix}-repeat`, discovery.repeatLines);
    lines(`${prefix}-inactive`, discovery.inactiveLines ?? []);
    for (const option of discovery.choice?.options ?? []) {
      add(`${prefix}-${option.id}-selected`, { speaker: 'hamilton', text: option.text }, 'player-option');
      lines(`${prefix}-${option.id}-reply`, option.reply);
    }
  }
  for (const echo of interactionEchoDefinitions) add(`echo-${echo.id}`, echo.line);
  for (const line of Object.values(smallTalk)) add(`small-talk-${line.speaker}`, line);
  add('small-talk-newsboy-thanks', newsboyThanks);
  debateArguments.forEach((argument, i) => {
    add(`debate-round-${i + 1}-argument`, { speaker: 'loyalist', text: argument.text }, 'debate-speech');
    for (const type of responseTypes) add(`debate-round-${i + 1}-${type.toLowerCase()}`, { speaker: 'hamilton', text: argument.responses[type] }, 'debate-speech');
  });
  for (const dispatch of dispatches) for (const fragment of dispatch.fragments)
    add(`dispatch-${fragment.id}`, { speaker: 'hamilton', text: fragment.text }, 'dispatch-text');
  assaultCommands.forEach((command, i) => add(`yorktown-command-${i + 1}`, { speaker: 'hamilton', text: command.label }, 'battle-command'));

  // Timeout dialogue is constructed by the controller. Exercise that exact path
  // for each tavern character instead of copying its wording into this fixture.
  const progress = new StoryProgress();
  for (let guard = 0; progress.chapter.id !== 'Tavern'; guard++) {
    assert.ok(guard < 100, 'reach the tavern through the real pre-activity story');
    if (progress.phase === 'explore') assert.equal(progress.begin(progress.interaction!.id), true);
    else if (progress.phase === 'dialogue') assert.equal(progress.next(), true);
    else if (progress.phase === 'choice') assert.equal(progress.choose(0), true);
    else if (progress.phase === 'exit') assert.equal(progress.nextChapter(), true);
    else assert.fail(`Unexpected phase before tavern: ${progress.phase}`);
  }
  for (const interaction of chapters.Tavern.interactions) {
    assert.equal(progress.begin(interaction.id), true);
    while (progress.phase === 'dialogue') assert.equal(progress.next(), true);
    assert.equal(progress.phase, 'choice');
    for (let guard = 0; progress.phase === 'choice'; guard++) {
      assert.ok(guard < 1000, 'tavern response deadline is finite');
      progress.tick(100);
    }
    const timeout = progress.currentLine;
    assert.ok(timeout, `${interaction.id} produces its authored timeout reply`);
    assert.equal(timeout.speaker, interaction.character);
    add(`${interaction.id}-timeout`, timeout);
    while (progress.phase === 'dialogue') assert.equal(progress.next(), true);
  }
  return result;
}
const authored = authoredDialogue();
const sourceById = new Map(authored.map(cue => [cue.id, cue]));
const exactLineKey = (line: DialogueLine) => JSON.stringify([line.speaker, line.text.zh, line.text.en]);
function cue(id: string) {
  const line = catalog.find(entry => entry.id === id) ?? sourceById.get(id);
  assert.ok(line, `Current authored dialogue contains ${id}`);
  return line;
}

test('all current recorded and unrecorded dialogue cues have explicit audited performance assignments', () => {
  assert.equal(authored.length, 203, 'authored playback locations, including all branches and repeated uses');
  assert.equal(sourceById.size, authored.length, 'each playback location has a unique source cue id');
  assert.equal(new Set(authored.map(exactLineKey)).size, 200, 'distinct character and bilingual lines');
  assert.deepEqual(authored.reduce((counts, line) => {
    counts[line.kind] = (counts[line.kind] ?? 0) + 1; return counts;
  }, {} as Record<string, number>), {
    dialogue: 124, 'player-option': 22, 'debate-speech': 30, 'dispatch-text': 15, 'battle-command': 12,
  });
  // Recorded-only runtime catalogs must not fabricate files for pending speech.
  // Every authored cue still needs either its recorded audit or an exact source audit.
  for (const source of authored) {
    const recorded = catalog.find(line => line.id === source.id && line.speaker === source.speaker && line.text === source.text.en);
    const unrecorded = SOURCE_DIALOGUE_PERFORMANCE_AUDIT.find(item => item.line.speaker === source.speaker && item.line.text.zh === source.text.zh && item.line.text.en === source.text.en);
    assert.ok(recorded || unrecorded, `Explicit performance coverage for ${source.id}`);
    const performance = unrecorded?.performance ?? DIALOGUE_PERFORMANCE_AUDIT[recorded!.id];
    assert.ok(performance, `${source.id} has an authored performance, not merely an audio record`);
    assert.equal(getDialoguePerformance(source).speaking, performance.speaking, `${source.id} cannot pass through a default fallback`);
    assert.equal(getDialoguePerformance(source).settled, performance.settled, `${source.id} retains its authored reaction`);
  }
  assert.deepEqual(Object.keys(DIALOGUE_PERFORMANCE_AUDIT).sort(), catalog.map(line => line.id).sort());
  for (const line of catalog) {
    const entry = DIALOGUE_PERFORMANCE_AUDIT[line.id];
    assert.equal(entry.speaker, line.speaker, line.id);
    assert.equal(getDialoguePerformance(line).speaking, entry.speaking, `No disguised fallback: ${line.id}`);
    assert.ok(Object.hasOwn(MAIN_PIXEL_ART[entry.speaker].poses, entry.speaking), `${line.id}: speaking pose exists`);
    assert.ok(Object.hasOwn(MAIN_PIXEL_ART[entry.speaker].poses, entry.settled), `${line.id}: settled pose exists`);
  }
});

test('every authored cue uses existing speaker and listener poses for every possible dialogue pair', () => {
  for (const line of authored) {
    for (const partner of cast) {
      const result = getDialoguePerformance(line, partner);
      const sprite = MAIN_PIXEL_ART[line.speaker as CharacterId];
      assert.ok(Object.hasOwn(sprite.poses, result.speaking), `${line.id} speaking`);
      assert.ok(Object.hasOwn(sprite.poses, result.settled), `${line.id} settled`);
      assert.ok(Object.hasOwn(MAIN_PIXEL_ART[partner].poses, result.listener), `${line.id} listener ${partner}`);
    }
  }
});

test('four language modes, paired source, and both exact language strings preserve acting for all cues', () => {
  const previous = getLanguage();
  try {
    for (const line of authored) {
      const source = sourceById.get(line.id);
      assert.ok(source, line.id);
      const expected = getDialoguePerformance(line, 'hamilton');
      for (const mode of ['zh', 'en', 'dual', 'dual-en'] as LanguageMode[]) {
        setLanguage(mode);
        assert.deepEqual(getDialoguePerformance({ speaker: line.speaker, text: source.text }, 'hamilton'), expected, `${line.id}: ${mode}`);
      }
      assert.deepEqual(getDialoguePerformance({ speaker: line.speaker, text: source.text.zh }, 'hamilton'), expected, `${line.id}: exact Chinese alias`);
      assert.deepEqual(getDialoguePerformance({ speaker: line.speaker, text: source.text.en }, 'hamilton'), expected, `${line.id}: exact English alias`);
    }
  } finally { setLanguage(previous); }
});

test('Burr respect and rivalry branches produce distinct listener and settled attitudes', () => {
  assert.equal(getDialoguePerformance(cue('burr-observe-selected'), 'burr').listener, 'approve');
  assert.equal(getDialoguePerformance(cue('burr-revolution-selected'), 'burr').listener, 'concern');
  assert.equal(getDialoguePerformance(cue('discovery-burr-respect-base-2'), 'hamilton').settled, 'approve');
  assert.equal(getDialoguePerformance(cue('discovery-burr-rivalry-base-2'), 'hamilton').settled, 'challenge');
  assert.equal(getDialoguePerformance(cue('discovery-burr-rivalry-base-1'), 'burr').listener, 'challenge');
  assert.equal(getDialoguePerformance(cue('discovery-burr-rivalry-base-3'), 'burr').listener, 'challenge');
});

test('agreement is earned by the actual reply and opposing characters do not automatically endorse Hamilton', () => {
  assert.equal(getDialoguePerformance(cue('laurens-liberty-selected'), 'laurens').listener, 'approve');
  assert.equal(getDialoguePerformance(cue('laurens-stability-selected'), 'laurens').listener, 'concern');
  assert.equal(getDialoguePerformance(cue('washington-accept-selected'), 'washington').listener, 'approve');
  assert.equal(getDialoguePerformance(cue('washington-demand-selected'), 'washington').listener, 'concern');
  assert.equal(getDialoguePerformance(cue('washington-demand-reply-1'), 'hamilton').settled, 'concern');
  assert.equal(getDialoguePerformance(cue('yorktown-command-variant-1-2'), 'hamilton').settled, 'approve');
  for (const line of catalog.filter(entry => entry.speaker === 'hamilton')) {
    assert.notEqual(getDialoguePerformance(line, 'loyalist').listener, 'approve', line.id);
  }
  for (const line of catalog.filter(entry => entry.speaker === 'hamilton' && entry.id.startsWith('debate-round-'))) {
    assert.equal(getDialoguePerformance(line, 'loyalist').listener, 'challenge', line.id);
  }
});

test('subtle joy, military responsibility, and the hidden chronicler have bounded authored reactions', () => {
  assert.equal(getDialoguePerformance(cue('small-talk-lafayette'), 'hamilton').speaking, 'amused');
  assert.equal(getDialoguePerformance(cue('small-talk-lafayette'), 'hamilton').settled, 'amused', 'the distinct smile remains visible after the basic mouth cycle');
  assert.equal(getDialoguePerformance(cue('discovery-arrival-scattered-paper-base-2'), 'hamilton').settled, 'approve');
  assert.equal(getDialoguePerformance(cue('yorktown-surrender-base-3'), 'narrator').settled, 'reflect');
  for (const line of catalog.filter(entry => entry.speaker === 'narrator')) {
    const result = getDialoguePerformance(line, 'hamilton');
    assert.ok(['write', 'reflect', 'turn'].includes(result.speaking), line.id);
    assert.ok(['write', 'reflect', 'turn'].includes(result.settled), line.id);
    assert.equal(result.emphasis, false, line.id);
  }
});

test('newspaper recordings retain their exact bilingual source performances at all five playback locations', () => {
  assert.equal(SOURCE_DIALOGUE_PERFORMANCE_AUDIT.length, 3);
  const pending = authored.filter(source => !catalog.some(recorded => recorded.id === source.id && recorded.speaker === source.speaker && recorded.text === source.text.en));
  assert.deepEqual(pending, [], 'every authored playback location has its exact recording');
  const newspaper = authored.filter(source => SOURCE_DIALOGUE_PERFORMANCE_AUDIT.some(item => exactLineKey(item.line) === exactLineKey(source)));
  assert.deepEqual(newspaper.map(line => line.id).sort(), [
    'discovery-arrival-scattered-paper-base-1', 'discovery-arrival-scattered-paper-base-2',
    'discovery-arrival-scattered-paper-repeat-1', 'small-talk-newsboy', 'small-talk-newsboy-thanks',
  ].sort(), 'five playback locations reuse three independently audited source lines');
  assert.equal(new Set(newspaper.map(exactLineKey)).size, 3);
  assert.deepEqual(new Set(newspaper.map(exactLineKey)), new Set(SOURCE_DIALOGUE_PERFORMANCE_AUDIT.map(item => exactLineKey(item.line))), 'each recorded original retains exactly one explicit source performance');
  for (const { line, performance } of SOURCE_DIALOGUE_PERFORMANCE_AUDIT) {
    for (const text of [line.text, line.text.zh, line.text.en]) {
      const result = getDialoguePerformance({ speaker: line.speaker, text }, line.speaker === 'newsboy' ? 'hamilton' : 'newsboy');
      assert.equal(result.speaking, performance.speaking);
      assert.equal(result.settled, performance.settled);
      assert.equal(result.listener, performance.listener);
      assert.equal(result.emphasis, false);
    }
  }
});

test('command performances hold their distinct direction gesture after speech instead of hiding it during loading', () => {
  const commands = Object.values(DIALOGUE_PERFORMANCE_AUDIT).filter(entry => entry.speaking === 'command');
  assert.equal(commands.length, 23);
  for (const entry of commands) {
    assert.ok(entry.speaker === 'hamilton' || entry.speaker === 'washington');
    const performance = getDialoguePerformance(cue(entry.id), entry.speaker === 'hamilton' ? 'lafayette' : 'hamilton');
    assert.equal(performance.settled, 'command', `${entry.id}: hold the authored command until the next cue or real gameplay reaction`);
  }
  assert.equal(getDialoguePerformance(cue('opening-letter-base-3'), 'burr').settled, 'calm', 'ordinary assertion still lowers its hand after speech');
});

test('real gameplay failures differ from successful reactions without changing or guessing a spoken cue', () => {
  for (const activity of ['debate', 'writing', 'yorktown'] as const) {
    const missed = getActivityReaction(activity, 'miss');
    const succeeded = getActivityReaction(activity, 'success');
    assert.equal(missed.settled, 'concern');
    assert.equal(succeeded.settled, 'approve');
    assert.equal(missed.emphasis, false);
    assert.equal(succeeded.emphasis, false);
    const partner = activity === 'debate' ? 'loyalist' : activity === 'writing' ? 'washington' : 'lafayette';
    for (const outcome of ['success', 'miss', 'neutral'] as const) {
      const result = getActivityReaction(activity, outcome);
      assert.ok(Object.hasOwn(MAIN_PIXEL_ART.hamilton.poses, result.settled));
      assert.ok(Object.hasOwn(MAIN_PIXEL_ART[partner].poses, result.listener));
    }
  }
  assert.equal(getActivityReaction('debate', 'success').listener, 'challenge');
  assert.equal(getActivityReaction('debate', 'miss').listener, 'challenge');
  assert.equal(getActivityReaction('writing', 'miss').listener, 'reflect');
  assert.equal(getActivityReaction('writing', 'success').listener, 'approve');
});

test('future dialogue and unknown speakers use declared defaults without keyword mood guessing', () => {
  for (const speaker of cast) {
    const result = getDialoguePerformance({ speaker, text: bi('很好！我认可。我大笑。', 'Good! I agree. I laugh.') }, 'loyalist');
    assert.equal(result.speaking, MAIN_PIXEL_ART[speaker].defaultPose);
    assert.equal(result.settled, MAIN_PIXEL_ART[speaker].listenPose);
    assert.equal(result.listener, MAIN_PIXEL_ART.loyalist.listenPose);
    assert.equal(result.emphasis, false);
  }
  const unknown = getDialoguePerformance({ speaker: 'future-character', text: 'A new line.' }, 'hamilton');
  assert.equal(unknown.speaking, MAIN_PIXEL_ART.narrator.defaultPose);
  assert.equal(unknown.listener, MAIN_PIXEL_ART.hamilton.listenPose);
});
