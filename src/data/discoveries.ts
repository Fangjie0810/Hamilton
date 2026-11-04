import type { GameState, StateEffect } from '../core/GameState';
import { bi, type BiText } from '../i18n/text';
import type { ChapterId, CharacterId, DialogueLine, Interaction } from './types';
import { hasInventoryItem, type InventoryItemId } from './inventory';
import { newsboyThanks } from './smallTalk';

export interface DiscoveryVariant {
  condition: string;
  when: (state: GameState) => boolean;
  lines: DialogueLine[];
}

/** Optional scenes share the main dialogue format, but never count toward chapter completion. */
export interface Discovery {
  id: string;
  chapter: ChapterId;
  label: BiText;
  character: CharacterId;
  marker: 'side' | 'reaction';
  requiresCompleted?: readonly string[];
  closesOn?: string;
  requiresChoice?: string;
  requiresItem?: InventoryItemId;
  hideWhenCompleted?: boolean;
  requiresStat?: { stat: keyof Omit<GameState, 'choices'>; min: number };
  lines: DialogueLine[];
  variants?: DiscoveryVariant[];
  choice?: Interaction['choice'];
  reward: StateEffect;
  repeatLines: DialogueLine[];
  inactiveLines?: DialogueLine[];
}

export const discoveries: Discovery[] = [
  {
    id: 'letter-name', chapter: 'Opening', marker: 'side', character: 'hamilton',
    label: bi('信纸背面的名字', 'A Name on the Back'), requiresCompleted: ['opening-letter'],
    lines: [
      { speaker: 'narrator', text: bi('翻过信纸，背面留着几次试写的姓名。墨迹有深有浅，最后一次落笔格外清楚。', 'On the back of the letter, a name has been written several times. The ink varies in darkness; the final attempt is especially clear.') },
      { speaker: 'hamilton', text: bi('亚历山大·汉密尔顿。先把名字写稳，再让人记住它。', 'Alexander Hamilton. First, write the name with a steady hand. Then give people a reason to remember it.') },
    ], reward: { momentum: 3 },
    repeatLines: [{ speaker: 'hamilton', text: bi('这个名字已经写下。下一页，要写什么？', 'The name is on the page. What will go on the next one?') }],
  },
  {
    id: 'arrival-scattered-paper', chapter: 'Arrival', marker: 'side', character: 'newsboy',
    label: bi('交还报纸', 'Return the Newspaper'), requiresCompleted: ['arrival-newspaper'],
    requiresItem: 'scattered-newspaper', hideWhenCompleted: true,
    lines: [
      { speaker: 'hamilton', text: bi('我在酒馆后面找到了这些报纸。拿好，别再让风抢走了。', 'I found these pages behind the tavern. Hold them tight so the wind cannot snatch them again.') },
      newsboyThanks,
      { speaker: 'hamilton', text: bi('汉密尔顿。希望下次让你忙起来的，是值得传开的消息。', 'Hamilton. I hope next time it is news worth sharing that keeps you busy.') },
    ], reward: { influence: 2 },
    repeatLines: [newsboyThanks],
  },
  {
    id: 'arrival-burr-margin', chapter: 'Arrival', marker: 'side', character: 'burr',
    label: bi('伯尔的页边批注', "Burr's Margin Notes"), requiresCompleted: ['arrival-burr'],
    lines: [
      { speaker: 'hamilton', text: bi('你在这句旁边写了问号：谁来承担代价？', 'You put a question mark beside this sentence: who bears the cost?') },
      { speaker: 'burr', text: bi('一句话让自己满意很容易。试试让付出代价的人也愿意听下去。', 'It is easy to satisfy yourself with a sentence. Try keeping the attention of the people who must pay its price.') },
    ], reward: {},
    choice: { id: 'side:arrival-burr-margin', prompt: bi('你怎样回应伯尔的批注？', "How do you respond to Burr's note?"), options: [
      { id: 'ask', text: bi('请指出我还没有回答的部分。', 'Show me what I have not answered yet.'), effect: { burrRespect: 3 }, reply: [
        { speaker: 'burr', text: bi('从他们最具体的担忧开始。你愿意改进论据，我愿意继续听。', 'Begin with their most concrete worry. If you are willing to improve your argument, I am willing to keep listening.') },
      ] },
      { id: 'challenge', text: bi('下一次，把这个问题当面抛给我。', 'Next time, put that question to me in public.'), effect: { burrRivalry: 3 }, reply: [
        { speaker: 'burr', text: bi('好。我会认真准备。你最好也给答案留一点准备的时间。', 'Very well. I will prepare seriously. You would do well to give your answer some preparation too.') },
      ] },
    ] },
    repeatLines: [{ speaker: 'burr', text: bi('问号还在这里。写出答案之前，不必急着擦掉它。', 'The question mark is still here. There is no hurry to erase it before you have an answer.') }],
  },
  {
    id: 'tavern-unfinished-draft', chapter: 'Tavern', marker: 'side', character: 'hamilton',
    label: bi('未完成的演说草稿', 'An Unfinished Speech'),
    lines: [
      { speaker: 'narrator', text: bi('空桌上留着一张草稿，末行只有半句：如果我们的声音值得被听见……', 'A draft lies on an empty table. Its final line stops halfway: if our voices deserve to be heard...') },
      { speaker: 'hamilton', text: bi('这里还缺一句愿意公开承担的话。', 'It needs a sentence someone is willing to stand behind in public.') },
    ], reward: {},
    choice: { id: 'side:tavern-unfinished-draft', prompt: bi('补完草稿的最后一句。', 'Finish the last sentence.'), options: [
      { id: 'complete', text: bi('就把主张说清，也让人追问。', 'Then state our case clearly, and let people question it.'), effect: { momentum: 3 }, reply: [
        { speaker: 'hamilton', text: bi('写在纸上还不够。我会把这句话带到街上。', 'The page is only a beginning. I will take this sentence into the street.') },
      ] },
    ] },
    repeatLines: [{ speaker: 'hamilton', text: bi('最后一行写完了。到了广场，就没有纸张替我挡住目光。', 'The last line is finished. In the square, no sheet of paper will stand between me and their eyes.') }],
  },
  {
    id: 'square-bread-and-prices', chapter: 'Debate', marker: 'side', character: 'citizen',
    label: bi('面包与货价', 'Bread and Prices'), closesOn: 'debate-loyalist',
    lines: [
      { speaker: 'hamilton', text: bi('这张账单上的面包和运费，都被重新改过。你最担心哪一项？', 'The bread and freight prices on this bill have both been revised. Which worries you most?') },
      { speaker: 'citizen', text: bi('我担心付完今天的钱，明天又不够。你们谈未来时，也把这一餐算进去。', 'I worry that after paying today, I will not have enough tomorrow. When you speak about the future, count this meal too.') },
      { speaker: 'hamilton', text: bi('我记住了。你不该先放下自己的生活，才有资格谈自由。', 'I will remember. You should not have to set your life aside before you can speak about freedom.') },
    ], reward: { influence: 3 },
    repeatLines: [{ speaker: 'citizen', text: bi('账单还在，问题也是。谢谢你先问了我们的日子。', 'The bill is still here, and so is the question. Thank you for asking about our lives first.') }],
    inactiveLines: [{ speaker: 'citizen', text: bi('争论散了，明天还是要开门做生意。我会看你们怎样兑现说过的话。', 'The argument is over, but tomorrow we still have to open for business. I will watch how you follow through on what you said.') }],
  },
  {
    id: 'camp-misfiled-dispatch', chapter: 'Washington', marker: 'side', character: 'washington',
    label: bi('错置的军需便条', 'A Misfiled Supply Note'), requiresCompleted: ['washington-offer'], closesOn: 'washington-dispatch',
    lines: [
      { speaker: 'hamilton', text: bi('外封写着北侧驻地，正文却让车队往东。我得先核对，再送出去。', 'The cover says the northern camp, but the text sends the wagons east. I should check before this goes out.') },
      { speaker: 'washington', text: bi('正文才是这批补给的目的地。发现一处不一致，就先把它弄清楚。', 'The text gives the destination for this shipment. When you find a discrepancy, resolve it first.') },
    ], reward: {},
    choice: { id: 'side:camp-misfiled-dispatch', prompt: bi('按核对结果修正便条。', 'Correct the note after checking it.'), options: [
      { id: 'correct', text: bi('修正外封，标明核对后的目的地。', 'Correct the cover and mark the verified destination.'), effect: { washingtonTrust: 3 }, reply: [
        { speaker: 'hamilton', text: bi('现在内外一致了。收信人不必替我们猜测。', 'The cover and the text now agree. The recipient will not have to guess for us.') },
        { speaker: 'washington', text: bi('很好。可靠，常常从这种小处开始。', 'Good. Reliability often begins with details like this.') },
      ] },
    ] },
    repeatLines: [{ speaker: 'hamilton', text: bi('便条已经核对。下一封也要经得起同样的检查。', 'The note has been checked. The next one deserves the same care.') }],
    inactiveLines: [{ speaker: 'washington', text: bi('这一批便条已经归档。记住：地点和时间，都要让收信人看得明白。', 'These notes have been filed. Remember: the recipient must be able to read both the place and the time clearly.') }],
  },
  {
    id: 'burr-respect', chapter: 'Debate', marker: 'reaction', character: 'burr',
    label: bi('请伯尔评价论据', 'Ask Burr About Your Argument'), requiresCompleted: ['debate-loyalist'], requiresStat: { stat: 'burrRespect', min: 25 },
    lines: [
      { speaker: 'hamilton', text: bi('你认为我的论据站得住吗？我想听具体的。', 'Do you think my argument holds up? I want specifics.') },
      { speaker: 'burr', text: bi('你愿意让人追问，这一点站得住。接下来，把每项主张和承担它的人连起来。', 'Your willingness to be questioned holds up. Next, connect each claim to the people who must bear it.') },
      { speaker: 'hamilton', text: bi('我会继续补全。也请你继续指出空缺。', 'I will keep filling in the gaps. Keep pointing them out.') },
    ], variants: [{ condition: 'side:arrival-burr-margin = ask', when: state => state.choices['side:arrival-burr-margin'] === 'ask', lines: [
      { speaker: 'hamilton', text: bi('你在页边留下的问号，我一直记得。今天，我回答得更完整了吗？', 'I remembered the question mark in your margin. Was my answer more complete today?') },
      { speaker: 'burr', text: bi('你开始把听众的顾虑放进论证了。接下来，让每项主张都找到愿意承担它的人。', "You have begun to bring the audience's concerns into your argument. Next, find the people willing to carry each proposal through.") },
      { speaker: 'hamilton', text: bi('那么，把新的问号也留下吧。', 'Then leave me the next question mark.') },
    ] }], reward: {},
    repeatLines: [{ speaker: 'burr', text: bi('肯继续修正论据的人，值得继续听。', 'Someone willing to keep revising an argument is worth hearing again.') }],
  },
  {
    id: 'burr-rivalry', chapter: 'Debate', marker: 'reaction', character: 'burr',
    label: bi('向伯尔约下一场辩论', 'Challenge Burr to Another Debate'), requiresCompleted: ['debate-loyalist'], requiresStat: { stat: 'burrRivalry', min: 15 },
    lines: [
      { speaker: 'hamilton', text: bi('下一次，由你来回应我？你总不能一直站在场边。', 'Next time, will you answer me? You cannot stay at the edge of the square forever.') },
      { speaker: 'burr', text: bi('可以。但我会挑你最不愿停下来回答的问题。', 'I will. But I will choose the question you are least willing to stop and answer.') },
      { speaker: 'hamilton', text: bi('那就带着问题来。我会带着答案。', 'Then bring your question. I will bring an answer.') },
    ], variants: [{ condition: 'side:arrival-burr-margin = challenge', when: state => state.choices['side:arrival-burr-margin'] === 'challenge', lines: [
      { speaker: 'hamilton', text: bi('页边的挑战还算数。下一次，由你来回应我？', 'The challenge in the margin still stands. Next time, will you answer me?') },
      { speaker: 'burr', text: bi('我记得。也已经开始准备。别把我没有抢着开口，当成我无话可说。', 'I remember, and I have begun preparing. Do not mistake my waiting to speak for having nothing to say.') },
      { speaker: 'hamilton', text: bi('好。那我也不能停在今天的答案上。', 'Good. Then I cannot settle for the answers I gave today.') },
    ] }], reward: {},
    repeatLines: [{ speaker: 'burr', text: bi('约定还在。我们都还有准备的时间。', 'The challenge stands. We both still have time to prepare.') }],
  },
];

export const discoveryChoiceKey = (def: Discovery) => `${def.marker}:${def.id}`;
export const discoveryDone = (def: Discovery, state: GameState) => Object.hasOwn(state.choices, discoveryChoiceKey(def));

/** Available means visible, including ordinary descriptions after an event expires. */
export function discoveryAvailable(def: Discovery, state: GameState, completed: readonly string[]): boolean {
  if (!def.requiresCompleted?.every(id => completed.includes(id)) && def.requiresCompleted) return false;
  if (def.hideWhenCompleted && discoveryDone(def, state)) return false;
  if (def.requiresItem && !discoveryDone(def, state) && !hasInventoryItem(state, def.requiresItem)) return false;
  return discoveryDone(def, state) || !def.requiresStat || state[def.requiresStat.stat] >= def.requiresStat.min;
}

/** Evaluate once on opening; reward and marker must be committed together after the final reply. */
export function resolveDiscovery(def: Discovery, state: GameState, completed: readonly string[], started: readonly string[] = []) {
  const done = discoveryDone(def, state);
  const expired = !!def.closesOn && (completed.includes(def.closesOn) || started.includes(def.closesOn));
  const missingChoice = !!def.requiresChoice && !Object.hasOwn(state.choices, def.requiresChoice);
  const active = discoveryAvailable(def, state, completed) && !done && !expired && !missingChoice;
  return {
    lines: done ? def.repeatLines : !active ? (def.inactiveLines ?? def.repeatLines) : (def.variants?.find(variant => variant.when(state))?.lines ?? def.lines),
    choice: active ? def.choice : undefined,
    effect: active ? def.reward : {},
    choiceKey: discoveryChoiceKey(def),
    completed: done,
    active,
  };
}

export interface InteractionEcho {
  id: string;
  chapter: ChapterId;
  interactionId: string;
  condition: string;
  when: (state: GameState) => boolean;
  line: DialogueLine;
}
const did = (state: GameState, id: string) => Object.hasOwn(state.choices, `side:${id}`);

/** Conditions within each slot are exclusive, keeping every main dialogue to at most two additions. */
export const interactionEchoDefinitions: InteractionEcho[] = [
  { id: 'square-paper-recognition', chapter: 'Debate', interactionId: 'debate-loyalist', condition: 'side:arrival-scattered-paper completed', when: state => did(state, 'arrival-scattered-paper'), line: { speaker: 'citizen', text: bi('你就是帮报童收过纸的人吧？我记得你的名字。说吧，我们听着。', 'You helped the newsboy gather his papers, did you not? I remember your name. Go on. We are listening.') } },
  { id: 'square-influence-recognition', chapter: 'Debate', interactionId: 'debate-loyalist', condition: 'influence >= 25 and no scattered-paper discovery', when: state => state.influence >= 25 && !did(state, 'arrival-scattered-paper'), line: { speaker: 'citizen', text: bi('汉密尔顿？有人向我提起过你。我愿意先听听你的回答。', 'Hamilton? Someone mentioned you to me. I am willing to hear your answer.') } },
  { id: 'square-draft-courage', chapter: 'Debate', interactionId: 'debate-loyalist', condition: 'side:tavern-unfinished-draft completed', when: state => did(state, 'tavern-unfinished-draft'), line: { speaker: 'hamilton', text: bi('酒馆里那句写完的话，该拿出来接受追问了。', 'It is time to bring that sentence from the tavern into the open and let people question it.') } },
  { id: 'square-high-momentum', chapter: 'Debate', interactionId: 'debate-loyalist', condition: 'momentum >= 55 and no unfinished-draft discovery', when: state => state.momentum >= 55 && !did(state, 'tavern-unfinished-draft'), line: { speaker: 'hamilton', text: bi('我会走到人群面前，把主张说清楚。', 'I will step before the crowd and make my case clear.') } },
  { id: 'square-low-momentum', chapter: 'Debate', interactionId: 'debate-loyalist', condition: 'momentum < 55 and no unfinished-draft discovery', when: state => state.momentum < 55 && !did(state, 'tavern-unfinished-draft'), line: { speaker: 'hamilton', text: bi('先把他们的问题听完整。稳稳地回答，也是一种承担。', 'First, hear the whole question. A measured answer can carry responsibility too.') } },
  { id: 'square-bread-recall', chapter: 'Debate', interactionId: 'debate-round-1', condition: 'side:square-bread-and-prices completed; before first round only', when: state => did(state, 'square-bread-and-prices'), line: { speaker: 'citizen', text: bi('刚才账单上的那一餐，请记得放进你的答案里。', 'Remember to include the meal on that bill in your answer.') } },
  { id: 'camp-detail-recall', chapter: 'Washington', interactionId: 'washington-dispatch', condition: 'side:camp-misfiled-dispatch completed', when: state => did(state, 'camp-misfiled-dispatch'), line: { speaker: 'washington', text: bi('你核对过那张便条。现在，让每一份军令都经得起同样的检查。', 'You checked that supply note. Now give every dispatch the same care.') } },
  { id: 'camp-duty-trust', chapter: 'Washington', interactionId: 'washington-dispatch', condition: 'washingtonTrust >= 8 and no misfiled-dispatch discovery', when: state => state.washingtonTrust >= 8 && !did(state, 'camp-misfiled-dispatch'), line: { speaker: 'washington', text: bi('你愿意承担眼前的职责，我就从这几封军令开始相信你。', 'You have accepted the duty before you. These dispatches are where I begin to place my trust in you.') } },
  { id: 'yorktown-detail-recall', chapter: 'Yorktown', interactionId: 'yorktown-command', condition: 'side:camp-misfiled-dispatch completed', when: state => did(state, 'camp-misfiled-dispatch'), line: { speaker: 'washington', text: bi('你从核对一张便条开始证明可靠。今晚，同样的细心也要跟着队伍出发。', 'You began proving dependable by checking a supply note. Tonight, take that same care into the field.') } },
  { id: 'yorktown-high-momentum', chapter: 'Yorktown', interactionId: 'yorktown-command', condition: 'momentum >= 55', when: state => state.momentum >= 55, line: { speaker: 'hamilton', text: bi('我争取这一刻很久了。现在，我会让这份勇气带着责任一起向前。', 'I have worked for this moment for a long time. Now I will carry responsibility forward with my courage.') } },
  { id: 'yorktown-low-momentum', chapter: 'Yorktown', interactionId: 'yorktown-command', condition: 'momentum < 55', when: state => state.momentum < 55, line: { speaker: 'hamilton', text: bi('不必抢过每个人的脚步。我要把他们一起带到目标前。', 'I do not need to outrun everyone. I need to bring them to the objective together.') } },
];

export function interactionEchoes(interactionId: string, state: GameState): DialogueLine[] {
  return interactionEchoDefinitions.filter(echo => echo.interactionId === interactionId && echo.when(state)).slice(0, 2).map(echo => echo.line);
}

/** Exhaustive authored dialogue traversal: never samples one playthrough or scans rendered DOM. */
export function allDiscoveryDialogue(): DialogueLine[] {
  return [
    ...discoveries.flatMap(def => [...def.lines, ...(def.variants?.flatMap(variant => variant.lines) ?? []), ...def.repeatLines, ...(def.inactiveLines ?? []), ...(def.choice?.options.flatMap(option => option.reply) ?? [])]),
    ...interactionEchoDefinitions.map(echo => echo.line),
  ];
}
