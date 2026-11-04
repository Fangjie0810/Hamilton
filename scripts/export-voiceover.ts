/** Read the actual bilingual source; no runtime game changes and no network calls. */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { chapterOrder, chapters } from '../src/data/chapters';
import { characters } from '../src/data/characters';
import { newsboyThanks, smallTalk } from '../src/data/smallTalk';
import { debateArguments, responseTypes } from '../src/data/debate';
import { dispatches } from '../src/data/writing';
import { assaultCommands } from '../src/data/yorktown';
import { discoveries, discoveryChoiceKey, interactionEchoDefinitions } from '../src/data/discoveries';
import type { BiText } from '../src/i18n/text';
import type { CharacterId } from '../src/data/types';

type Source = { file: string; line: number; context: string; text: BiText };
type Cue = { id: string; chapter: string; kind: string; speaker: CharacterId; condition: string; text: BiText; dynamic: boolean; source: string; assetKey: string };
const sources: Source[] = [];
function scan(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { scan(file); continue; }
    if (!file.endsWith('.ts') || file === 'src/i18n/text.ts') continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'bi') {
        const [zh, en] = node.arguments;
        if (!zh || !en || !ts.isStringLiteralLike(zh) || !ts.isStringLiteralLike(en)) throw new Error(`Nonliteral bilingual text: ${file}`);
        const context: string[] = [];
        for (let p = node.parent; p; p = p.parent) {
          if (ts.isConditionalExpression(p)) context.push(`ternary: ${p.condition.getText(source)}`);
          if (ts.isIfStatement(p)) context.push(`if: ${p.expression.getText(source)}`);
          if (ts.isPropertyAssignment(p)) context.push(`field: ${p.name.getText(source)}`);
          if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) { context.push(`function: ${p.name?.getText(source)}`); break; }
        }
        sources.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, context: context.join(' / '), text: { zh: zh.text, en: en.text } });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan('src');
const cues: Cue[] = [];
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);
function add(id: string, chapter: string, kind: string, speaker: CharacterId, text: BiText, condition: string, file?: string) {
  if (!text.zh.trim() || !text.en.trim()) throw new Error(`Empty translation: ${id}`);
  const matches = (source: Source) => source.text.zh === text.zh && source.text.en === text.en;
  // Shared authored lines retain the location of their definition, even when another scene reuses them.
  const source = sources.find(s => (!file || s.file === file) && matches(s)) ?? sources.find(matches);
  if (!source) throw new Error(`Source not found: ${id}`);
  cues.push({ id, chapter, kind, speaker, condition, text, dynamic: /\{\d+\}/.test(text.zh + text.en), source: `${source.file}:${source.line}`, assetKey: `${speaker}-${digest(JSON.stringify(text))}` });
}
function selected(file: string, predicate: (s: Source) => boolean, chapter: string, kind: string, speaker: CharacterId) {
  sources.filter(s => s.file === file && predicate(s)).forEach(s => add(`${chapter.toLowerCase()}-${kind}-${digest(s.text.zh)}`, chapter, kind, speaker, s.text, s.context, file));
}
for (const chapter of chapterOrder) {
  const c = chapters[chapter];
  add(`${chapter.toLowerCase()}-title`, chapter, 'chapter-card', 'narrator', c.title, '幕间标题；可选朗读');
  add(`${chapter.toLowerCase()}-subtitle`, chapter, 'chapter-card', 'narrator', c.subtitle, '幕间副标题；可选朗读');
  for (const interaction of c.interactions) {
    const base = interaction.id;
    const condition = interaction.variants?.length ? `没有命中变体（${interaction.variants.map(v => `${v.stat} < ${v.min}`).join(' 且 ')}）` : '到达此互动';
    interaction.lines.forEach((line, i) => add(`${base}-base-${i + 1}`, chapter, 'dialogue', line.speaker, line.text, condition));
    interaction.variants?.forEach((v, vi) => v.lines.forEach((line, i) => add(`${base}-variant-${vi + 1}-${i + 1}`, chapter, 'dialogue', line.speaker, line.text, `${v.stat} >= ${v.min}；整段替换默认对话，采用第一个命中变体`)));
    if (interaction.choice) {
      const choice = interaction.choice;
      add(`${choice.id}-prompt`, chapter, 'choice-prompt', 'narrator', choice.prompt, '显示选项问题；可选朗读');
      for (const option of choice.options) {
        add(`${option.id}-selected`, chapter, 'player-option', 'hamilton', option.text, `选择 ${choice.id} = ${option.id}；当前为选项文字，若配音建议仅选中后播放`);
        option.reply.forEach((line, i) => add(`${option.id}-reply-${i + 1}`, chapter, 'dialogue', line.speaker, line.text, `选择 ${choice.id} = ${option.id}`));
      }
    }
    if (chapter === 'Tavern') {
      const timeout = sources.find(s => s.file === 'src/story3d/StoryProgress.ts' && s.text.zh.startsWith('你沉默了一会儿。'))!;
      add(`${base}-timeout`, chapter, 'dialogue', interaction.character, timeout.text, '问题读完后 10 秒未选择；三个角色分别生成，不能共享同一声音', timeout.file);
    }
    if (interaction.activity === 'debate') {
      debateArguments.forEach((argument, i) => {
        add(`debate-round-${i + 1}-argument`, chapter, 'debate-speech', 'loyalist', argument.text, `第 ${i + 1} 轮；辩论可提前结束，不是每局都会出现`);
        responseTypes.forEach(type => add(`debate-round-${i + 1}-${type.toLowerCase()}`, chapter, 'debate-speech', 'hamilton', argument.responses[type], `第 ${i + 1} 轮选择 ${type}；一次只播放所选回应`));
        add(`debate-round-${i + 1}-hint`, chapter, 'activity-hint', 'narrator', argument.opening, `第 ${i + 1} 轮策略提示；可选朗读`);
      });
      selected('src/ui/DebateActivity.ts', s => /[。！？]$/.test(s.text.zh), chapter, 'activity-feedback', 'narrator');
    }
    if (interaction.activity === 'writing') {
      dispatches.forEach((d, i) => d.fragments.forEach(fragment => add(`dispatch-${fragment.id}`, chapter, 'dispatch-text', 'hamilton', fragment.text, `军令 ${i + 1}：${d.title.zh} / ${fragment.bin}；纸面文本，朗读角色建议为 Hamilton；校对稿复用`)));
      selected('src/ui/WritingActivity.ts', s => /[。！？]$/.test(s.text.zh), chapter, 'activity-feedback', 'narrator');
    }
    if (interaction.activity === 'yorktown') {
      assaultCommands.forEach((command, i) => add(`yorktown-command-${i + 1}`, chapter, 'battle-command', 'hamilton', command.label, `第 ${i + 1} 道突击指令；英文含命令类别前缀，试听时需审核是否朗读前缀`));
      selected('src/ui/YorktownActivity.ts', s => /[。！？]$/.test(s.text.zh), chapter, 'activity-feedback', 'narrator');
      selected('src/systems/YorktownSystem.ts', () => true, chapter, 'activity-feedback', 'narrator');
    }
  }
}
// Optional scenes use authored data, including every reply, repeat and expired branch.
for (const discovery of discoveries) {
  const base = `discovery-${discovery.id}`;
  const key = discoveryChoiceKey(discovery);
  const requirements = [
    `${key} not yet completed`,
    ...(discovery.requiresCompleted?.map(id => `${id} completed`) ?? []),
    ...(discovery.requiresStat ? [`${discovery.requiresStat.stat} >= ${discovery.requiresStat.min}`] : []),
    ...(discovery.requiresChoice ? [`${discovery.requiresChoice} completed`] : []),
    ...(discovery.requiresItem ? [`carrying ${discovery.requiresItem}`] : []),
    ...(discovery.closesOn ? [`before ${discovery.closesOn} activity starts`] : []),
  ].join('; ');
  discovery.lines.forEach((line, i) => add(`${base}-base-${i + 1}`, discovery.chapter, 'dialogue', line.speaker, line.text, `${requirements}; no matching optional variant`, 'src/data/discoveries.ts'));
  discovery.variants?.forEach((variant, vi) => variant.lines.forEach((line, i) => add(`${base}-variant-${vi + 1}-${i + 1}`, discovery.chapter, 'dialogue', line.speaker, line.text, `${requirements}; ${variant.condition}`, 'src/data/discoveries.ts')));
  discovery.repeatLines.forEach((line, i) => add(`${base}-repeat-${i + 1}`, discovery.chapter, 'dialogue', line.speaker, line.text, `${key} completed; reread without rewards`, 'src/data/discoveries.ts'));
  discovery.inactiveLines?.forEach((line, i) => add(`${base}-inactive-${i + 1}`, discovery.chapter, 'dialogue', line.speaker, line.text, `Optional event expired or missing prerequisite ${discovery.requiresChoice ?? discovery.closesOn}; ordinary description without reward`, 'src/data/discoveries.ts'));
  if (discovery.choice) {
    add(`${base}-prompt`, discovery.chapter, 'choice-prompt', 'narrator', discovery.choice.prompt, `${requirements}; UI prompt, not spoken narration`, 'src/data/discoveries.ts');
    discovery.choice.options.forEach(option => {
      add(`${base}-${option.id}-selected`, discovery.chapter, 'player-option', 'hamilton', option.text, `Choose ${key} = ${option.id}; option label, not automatically spoken`, 'src/data/discoveries.ts');
      option.reply.forEach((line, i) => add(`${base}-${option.id}-reply-${i + 1}`, discovery.chapter, 'dialogue', line.speaker, line.text, `Choose ${key} = ${option.id}`, 'src/data/discoveries.ts'));
    });
  }
}
for (const echo of interactionEchoDefinitions) {
  add(`echo-${echo.id}`, echo.chapter, 'dialogue', echo.line.speaker, echo.line.text, `${echo.interactionId}; ${echo.condition}; append to the main passage, at most two echoes per opening`, 'src/data/discoveries.ts');
}
for (const line of Object.values(smallTalk)) {
  add(`small-talk-${line.speaker}`, 'SmallTalk', 'dialogue', line.speaker, line.text, '主线对话完成后二次交互；固定闲聊，不触发剧情、选项或奖励', 'src/data/smallTalk.ts');
}
add('small-talk-newsboy-thanks', 'SmallTalk', 'dialogue', newsboyThanks.speaker, newsboyThanks.text, '报纸已经归还；重复闲聊，不触发剧情、选项或奖励', 'src/data/smallTalk.ts');
selected('src/data/ending.ts', () => true, 'Ending', 'ending', 'narrator');
selected('src/story3d/StoryUI.ts', s => ['革命使他成名。野心将决定此后的路。', '而伯尔仍在注视。'].includes(s.text.zh), 'Ending', 'epilogue', 'narrator');
// The developer exploration route has additional content, separate from the main story.
selected('src/demo3d/SceneCatalog.ts', s => s.context.includes('field: body'), 'Demo', 'exploration', 'narrator');
selected('src/demo3d/Demo.ts', s => s.context.includes('function: renderDialogue') && /[。！？]$/.test(s.text.zh) && !s.text.zh.startsWith('我想') && !s.text.zh.startsWith('先带'), 'Demo', 'demo-dialogue', 'burr');
selected('src/demo3d/Demo.ts', s => ['我想让这座城听见我。', '先带我认识这座城。'].includes(s.text.zh), 'Demo', 'player-option', 'hamilton');
if (new Set(cues.map(c => c.id)).size !== cues.length) throw new Error('Duplicate cue IDs');
const core = cues.filter(c => ['dialogue', 'debate-speech'].includes(c.kind));
const count = (items: Cue[]) => ({ cues: items.length, assetsPerLanguage: new Set(items.map(c => c.assetKey)).size, zhCharacters: items.reduce((n,c) => n + [...c.text.zh].length, 0), enCharacters: items.reduce((n,c) => n + [...c.text.en].length, 0) });
const summary = { core: count(core), all: count(cues), dynamicTemplates: cues.filter(c => c.dynamic).length, byChapter: Object.fromEntries([...chapterOrder, 'SmallTalk', 'Ending', 'Demo'].map(ch => [ch, count(cues.filter(c => c.chapter === ch))])), bySpeaker: Object.fromEntries(Object.keys(characters).map(id => [id, { name: characters[id as CharacterId].name, core: count(core.filter(c => c.speaker === id)), all: count(cues.filter(c => c.speaker === id)) }])) };
const output = 'docs/voiceover';
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/manifest.json`, JSON.stringify({ schemaVersion: 1, summary, cues }, null, 2) + '\n');
writeFileSync(`${output}/all-bilingual-source.json`, JSON.stringify(sources, null, 2) + '\n');
const out = ['# Hamilton 全流程配音台本', '', '由 `node --import tsx scripts/export-voiceover.ts` 从当前源码导出。中英文保持原文，不含改写或表演标签。', '', '流程：序幕信件 → 纽约报童／街头争论／伯尔 → 酒馆三人（任意顺序）→ 六轮公开辩论（可提前结束）→ 华盛顿与三份军令 → 约克镇指挥／潜行／部署／突击／投降 → 个人侧写与尾声。', '', `核心对话及辩论 ${summary.core.cues} 条；含可选朗读、命令、结局及开发漫游共 ${cues.length} 条双语条目。这里统计所有分支，不能当作单次游玩句数。`, '', '界面问题、选项、纸面军令、战术命令、结局旁白的说话人是制作建议；现有角色对话的说话人来自源码。动态 {0} 等模板必须先填实值，不能原样提交 TTS。', '', '所有 src 中的 bi() 原文另存 all-bilingual-source.json，可检查按钮、HUD、教程和幕间元数据等未列为台词的文字。条件栏自动提取的 if/ternary 是定位上下文，完整分支方向以源文件为准。', '', '| 角色 | 核心台词 | 全部条目 |', '| --- | ---: | ---: |'];
for (const s of Object.values(summary.bySpeaker)) out.push(`| ${s.name.zh} / ${s.name.en} | ${s.core.cues} | ${s.all.cues} |`);
for (const chapter of [...chapterOrder, 'SmallTalk', 'Ending', 'Demo']) {
  out.push('', `## ${chapter in chapters ? chapters[chapter as keyof typeof chapters].title.zh : chapter === 'SmallTalk' ? '主线完成后的固定闲聊' : chapter === 'Ending' ? '个人侧写与尾声' : '附录：开发漫游（不属于主线）'}`, '');
  for (const c of cues.filter(c => c.chapter === chapter)) out.push(`### ${c.id} · ${characters[c.speaker].name.zh}`, '', `类型：${c.kind}；触发：${c.condition || '见源码'}${c.dynamic ? '；动态模板，需填入实值' : ''}。`, '', `中文：${c.text.zh}`, '', `English: ${c.text.en}`, '', `来源：${c.source}`, '');
}
writeFileSync(`${output}/全流程台本.md`, out.join('\n'));
writeFileSync(`${output}/voice-map.example.json`, JSON.stringify(Object.fromEntries(Object.entries(characters).map(([id, character]) => [id, { name: character.name, zh: null, en: null }])), null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
