import assert from 'node:assert/strict';
import test from 'node:test';
import { chapters } from '../src/data/chapters';
import { characters } from '../src/data/characters';
import { conversationPartner, DIALOGUE_CAST } from '../src/data/dialogueCast';
import { discoveries, interactionEchoDefinitions } from '../src/data/discoveries';
import { smallTalk } from '../src/data/smallTalk';
import { debateArguments } from '../src/data/debate';
import { dispatches } from '../src/data/writing';
import { assaultCommands } from '../src/data/yorktown';
import type { CharacterId, DialogueLine } from '../src/data/types';

test('portrait cast covers every authored speaker, including citizen and narrator', () => {
  assert.equal(new Set(DIALOGUE_CAST).size, DIALOGUE_CAST.length);
  assert.deepEqual([...DIALOGUE_CAST].sort(), Object.keys(characters).sort());
  const seen = new Set<CharacterId>();
  const sequence = (lines: DialogueLine[], context: CharacterId, name: string) => {
    lines.forEach((line, index) => {
      seen.add(line.speaker);
      const partner = conversationPartner(lines, index, context);
      assert.ok(DIALOGUE_CAST.includes(line.speaker), `${name}: missing ${line.speaker}`);
      assert.ok(DIALOGUE_CAST.includes(partner), `${name}: missing ${partner}`);
      assert.notEqual(partner, line.speaker, `${name}: a character cannot face a duplicate of themselves`);
    });
  };
  for (const chapter of Object.values(chapters)) for (const interaction of chapter.interactions) {
    sequence(interaction.lines, interaction.character, interaction.id);
    for (const variant of interaction.variants ?? []) sequence(variant.lines, interaction.character, `${interaction.id}/variant`);
    for (const option of interaction.choice?.options ?? [])
      sequence([{ speaker: 'hamilton', text: option.text }, ...option.reply], interaction.character, option.id);
  }
  for (const discovery of discoveries) {
    sequence(discovery.lines, discovery.character, discovery.id);
    sequence(discovery.repeatLines, discovery.character, `${discovery.id}/repeat`);
    sequence(discovery.inactiveLines ?? [], discovery.character, `${discovery.id}/inactive`);
    for (const variant of discovery.variants ?? []) sequence(variant.lines, discovery.character, `${discovery.id}/variant`);
    for (const option of discovery.choice?.options ?? [])
      sequence([{ speaker: 'hamilton', text: option.text }, ...option.reply], discovery.character, option.id);
  }
  for (const line of Object.values(smallTalk)) sequence([line], line.speaker, `small-talk/${line.speaker}`);
  for (const echo of interactionEchoDefinitions) sequence([echo.line], 'hamilton', echo.id);
  for (const argument of debateArguments) for (const response of Object.values(argument.responses))
    sequence([{ speaker: 'loyalist', text: argument.text }, { speaker: 'hamilton', text: response }], 'loyalist', 'debate');
  for (const dispatch of dispatches)
    sequence(dispatch.fragments.map(fragment => ({ speaker: 'hamilton', text: fragment.text })), 'washington', 'dispatch');
  sequence(assaultCommands.map(command => ({ speaker: 'hamilton', text: command.label })), 'lafayette', 'assault');
  assert.deepEqual([...seen].sort(), [...DIALOGUE_CAST].sort());
});

test('the street argument presents its two disputants before Hamilton responds', () => {
  const street = chapters.Arrival.interactions.find(interaction => interaction.id === 'arrival-street')!;
  assert.equal(conversationPartner(street.lines, 0, street.character), 'loyalist');
  assert.equal(conversationPartner(street.lines, 1, street.character), 'citizen');
  assert.equal(conversationPartner(street.lines, 2, street.character), 'loyalist');
});

test('narration and Hamilton monologues retain a distinct contextual listener', () => {
  const opening = chapters.Opening.interactions[0];
  assert.equal(conversationPartner(opening.lines, 0, opening.character), 'hamilton');
  const camp = discoveries.find(discovery => discovery.id === 'camp-misfiled-dispatch')!;
  assert.equal(conversationPartner(camp.repeatLines, 0, camp.character), 'washington');
  assert.equal(conversationPartner([smallTalk.burr], 0, 'burr'), 'hamilton');
});

test('an actual reply partner takes priority over the scene default', () => {
  const citizen = chapters.Arrival.interactions.find(interaction => interaction.id === 'arrival-street')!.lines[0];
  const hamilton = chapters.Arrival.interactions[0].lines[1];
  const narration = chapters.Opening.interactions[0].lines[0];
  const lines = [citizen, narration, hamilton];
  assert.equal(conversationPartner(lines, 0, 'burr'), 'hamilton');
  assert.equal(conversationPartner(lines, 2, 'burr'), 'citizen');
});
