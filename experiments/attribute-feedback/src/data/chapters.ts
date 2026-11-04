import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import type { Chapter, ChapterId } from './types';
import { TAVERN_RESPONSE_MS } from './rules';

export const chapterOrder: ChapterId[] = ['Opening', 'Arrival', 'Tavern', 'Debate', 'Washington', 'Yorktown'];

export const chapters: Record<ChapterId, Chapter> = {
  Opening: {
    id: 'Opening', act: bi("序幕", "PROLOGUE"), title: bi("海的另一边", "Across the Sea"), place: bi("大西洋", "THE ATLANTIC"), year: bi("序幕", "Prologue"),
    subtitle: bi("一封信，把一个名字带离了海岛。", "A letter carries a name beyond the island."), objective: bi("走近信件，读完序幕。", "Approach the letter and read the prologue."), width: 1280,
    interactions: [{
      id: 'opening-letter', label: bi("一封漂洋过海的信", "A Letter Across the Atlantic"), character: 'narrator', x: 700,
      lines: [
        { speaker: 'narrator', text: bi("他来自加勒比海。商行的账本教会他计算，海上的风暴教会他：一个人的处境，可能在一夜之间被改写。", "He came from the Caribbean. A merchant's ledgers taught him to reckon; storms at sea taught him that a life could be rewritten overnight.") },
        { speaker: 'narrator', text: bi("他把所见写成文字。有人读了那篇文章，开始相信，这个年轻人应该得到继续求学的机会。", "He put what he had seen into words. People read them and began to believe this young man deserved the chance to continue his education.") },
        { speaker: 'hamilton', text: bi("我带不走那座岛。但我能带走纸上的每一个字。纽约有学校，有印刷机，也有人愿意争论未来。我要在那里找到我的位置。", "I cannot take the island with me. But I can carry every word on the page. New York has schools, printing presses, and people willing to argue about the future. I will find my place there.") },
      ],
    }],
    exitLabel: bi("踏上纽约街头", "Step into New York"), next: 'Arrival',
  },
  Arrival: {
    id: 'Arrival', act: bi("第一幕 · 第一场", "ACT I \u00b7 SCENE 01"), title: bi("纽约，没有空位", "New York Has No Empty Seats"), place: bi("纽约", "NEW YORK"), year: '1776',
    subtitle: bi("每条街都在争论。每个人都在选择。", "Every street is arguing. Everyone is choosing."), objective: bi("依次读新闻、听争论，最后与伯尔交谈。", "Read the news, hear the argument, then speak with Burr."), width: 2200,
    interactions: [
      {
        id: 'arrival-newspaper', label: bi('今日号外', "Today's Extra"), character: 'newsboy', x: 420,
        lines: [
          { speaker: 'newsboy', text: bi("港口的消息！英军动向、商船货价，还有一整版互相反驳的文章。先生，你想知道发生了什么，还是想让别人知道你是谁？", "News from the harbor! British troop movements, cargo prices, and a whole page of writers contradicting each other. Sir, do you want to know what is happening, or let people know who you are?") },
          { speaker: 'hamilton', text: bi("先给我一份。只有知道这座城在为什么争吵，我的文字才不会只是对着自己说话。", "Give me a copy first. Until I know what this city is arguing about, my writing will only be a conversation with myself.") },
        ], effect: { influence: 2 },
      },
      {
        id: 'arrival-street', label: bi("街头的争论", "An Argument in the Street"), character: 'citizen', x: 900,
        lines: [
          { speaker: 'citizen', text: bi("驻军越来越多。有人说军队保护生意，可我只想知道：他们保护的是谁作决定的权利？", "More troops arrive every day. They say the army protects trade. But whose right to decide are they protecting?") },
          { speaker: 'loyalist', text: bi("没有王室和海军，这座港口靠什么维持秩序？你们把眼前的生计，押给一个还不存在的国家。", "Without the Crown and its navy, what keeps order in this port? You would stake today's livelihood on a country that does not yet exist.") },
          { speaker: 'hamilton', text: bi("这两个人都害怕失去手里的生活。但他们还没问过，谁有资格替另一方下注。", "Both are afraid of losing the lives they have. Neither has asked who has the right to make that wager for the other.") },
        ], effect: { momentum: 2 },
      },
      {
        id: 'arrival-burr', label: bi("阿伦·伯尔", "Aaron Burr"), character: 'burr', x: 1450,
        lines: [
          { speaker: 'burr', text: bi("你听了很久。亚历山大·汉密尔顿，对吗？我读过你的文字。", "You have been listening for a while. Alexander Hamilton, isn't it? I have read your work.") },
          { speaker: 'hamilton', text: bi("那就省了介绍。你也听见了——他们谈论自由的时候，仿佛每个人说的是不同的东西。", "Then we can skip the introductions. You heard them too: when they speak of freedom, they seem to mean entirely different things.") },
          { speaker: 'burr', text: bi("先弄清楚谁在听，再决定说多少。局势会变；公开说过的话，会留下来。", "Learn who is listening before you decide how much to say. Circumstances change. Words spoken in public remain.") },
        ],
        choice: { id: 'burr_first_impression', prompt: bi("伯尔建议你暂缓表态。你如何回应？", "Burr advises you to wait before taking a side. How do you respond?"), options: [
          { id: 'burr-observe', text: bi("先观察，弄清各方的立场。", "Observe first and understand where each side stands."), hint: bi("克制 · 理解局势", "Restraint · Read the situation"), effect: { momentum: -5, burrRespect: 5 }, reply: [{ speaker: 'burr', text: bi("很好。耐心也能是一种行动。我们去酒馆，那里比街头容易听见真话。", "Good. Patience can be a form of action. Come to the tavern. It is easier to hear people speak plainly there.") }] },
          { id: 'burr-question', text: bi("那你呢？你自己相信什么？", "And you? What do you believe?"), hint: bi("追问 · 了解伯尔", "Ask further · Understand Burr"), effect: { influence: 2, burrRespect: 3 }, reply: [{ speaker: 'burr', text: bi("我相信，作决定之前应该把人看清楚。你这个问题，让我更想认识你了。走吧。", "I believe in knowing people before making decisions. That question makes me more interested in knowing you. Come along.") }] },
          { id: 'burr-revolution', text: bi("我支持革命。现在就可以写下我的名字。", "I support the revolution. You can put my name to it now."), hint: bi("公开表态 · 承担风险", "Take a public stand · Accept the risk"), effect: { momentum: 10, influence: 5, burrRivalry: 5 }, reply: [{ speaker: 'burr', text: bi("我听见了。整条街也听见了。希望你准备好了，为这么响亮的名字负责。", "I heard you. So did the whole street. I hope you are ready to answer for a name spoken that loudly.") }] },
        ] },
      },
    ], exitLabel: bi("进入酒馆", "Enter the Tavern"), next: 'Tavern',
    prototypeNote: bi("叙事时间压缩 · 汉密尔顿于 1772 年抵达纽约；本章将早年的抵达与 1776 年的革命局势合并呈现。", "Compressed chronology · Hamilton arrived in New York in 1772. This chapter combines his arrival with the revolutionary tensions of 1776."),
  },
  Tavern: {
    id: 'Tavern', act: bi("第一幕 · 第二场", "ACT I \u00b7 SCENE 02"), title: bi("同一张桌子", "At the Same Table"), place: bi("纽约 · 酒馆", "NEW YORK \u00b7 TAVERN"), year: '1776—1777',
    subtitle: bi("他们并不相信同一种未来。今晚，他们坐在一起。", "They do not imagine the same future. Tonight, they share a table."), objective: bi("自由选择顺序，与劳伦斯、拉法耶特和穆利根各谈一次。", "Speak once with Laurens, Lafayette, and Mulligan in any order."), width: 2000, interactionOrder: 'free',
    interactions: [
      {
        id: 'tavern-laurens', label: bi("劳伦斯的问题", "Laurens's Question"), character: 'laurens', x: 420,
        lines: [
          { speaker: 'laurens', text: bi("我们把自由写得那么大，却总把某些人留在句子外面。一个仍允许奴役的国家，准备怎样解释自己的自由？", "We write freedom in such large letters, yet always leave certain people outside the sentence. How will a country that still permits slavery explain its freedom?") },
          { speaker: 'hamilton', text: bi("你要的答案，恐怕会让这张桌子安静下来。", "The answer you want may bring this table to a silence.") },
          { speaker: 'laurens', text: bi("那就让它安静。你认为现在最重要的是什么？", "Then let it fall silent. What do you think matters most right now?") },
        ],
        choice: { id: 'laurens_question', prompt: bi("革命应该先回答哪一个问题？", "Which question should the revolution answer first?"), options: [
          { id: 'laurens-stability', text: bi("先维持秩序，让人们活过这场战争。", "Preserve order so people survive the war."), effect: { momentum: -3, burrRespect: 2 }, reply: [{ speaker: 'laurens', text: bi("活下来当然重要。可有些人一直在等“以后”，我们不能再轻易替他们说这个词。", "Surviving matters, of course. But some people have always been told to wait until later. We cannot keep saying that on their behalf.") }] },
          { id: 'laurens-representation', text: bi("谁来作决定，谁又有权提出反对？", "Who gets to decide, and who has the right to object?"), effect: { influence: 4 }, reply: [{ speaker: 'laurens', text: bi("那么，记得把被排除的人也算进去。换一个掌权的人，还不够。", "Then remember to include those who have been excluded. Replacing the people in power is not enough.") }] },
          { id: 'laurens-liberty', text: bi("自由的承诺，应当包含被奴役的人。", "The promise of freedom must include enslaved people."), effect: { momentum: 5, influence: 4 }, reply: [{ speaker: 'laurens', text: bi("我愿意和这样的人并肩。但当这个承诺开始让盟友不舒服时，你还得说下去。", "I would stand beside someone who believes that. But when that promise begins to trouble our allies, you must keep saying it.") }] },
        ] },
      },
      {
        id: 'tavern-lafayette', label: bi("拉法耶特的问题", "Lafayette's Question"), character: 'lafayette', x: 900,
        lines: [
          { speaker: 'lafayette', text: bi("我横渡大西洋，不是为了旁观。可勇气不能替士兵装满口粮。面对更强的军队，你准备把力气用在哪里？", "I did not cross the Atlantic to watch. But courage cannot fill a soldier's ration bag. Against a stronger army, where will you put your effort?") },
          { speaker: 'hamilton', text: bi("每一条路都要付代价。区别在于，我们愿不愿意自己选择。", "Every path has a price. The difference is whether we are willing to choose for ourselves.") },
        ],
        choice: { id: 'lafayette_question', prompt: bi("怎样让革命继续向前？", "How do we carry the revolution forward?"), options: [
          { id: 'lafayette-negotiate', text: bi("保持谈判，为居民争取喘息。", "Keep negotiating to give civilians room to breathe."), effect: { momentum: -2, burrRespect: 2 }, reply: [{ speaker: 'lafayette', text: bi("可以。但谈判桌也需要有人在外面守着。别把喘息误当成终点。", "Perhaps. But someone must stand guard outside the negotiating room. Do not mistake a breath of air for the end of the journey.") }] },
          { id: 'lafayette-allies', text: bi("建立联盟，把孤军变成共同事业。", "Build alliances and turn an isolated struggle into a shared cause."), effect: { influence: 5, momentum: 2 }, reply: [{ speaker: 'lafayette', text: bi("那你得学会听见盟友的需要。共同事业，不能只有一个人的声音。", "Then you must learn to hear what your allies need. A shared cause cannot speak in only one person's voice.") }] },
          { id: 'lafayette-independence', text: bi("公开争取独立，不再等待许可。", "Demand independence openly, without waiting for permission."), effect: { momentum: 8, influence: 3, burrRivalry: 2 }, reply: [{ speaker: 'lafayette', text: bi("够直接。我喜欢。但说完这句话，下一步就该准备行军了。", "Direct enough. I like it. But after those words, the next step is preparing to march.") }] },
        ] },
      },
      {
        id: 'tavern-mulligan', label: bi("穆利根的问题", "Mulligan's Question"), character: 'mulligan', x: 1450,
        lines: [
          { speaker: 'mulligan', text: bi("大道理我听够了。明早有十个人愿意帮忙，一家印刷铺肯赊账，还有一辆空车。汉密尔顿，你怎么用？", "I've heard enough grand ideas. Tomorrow, ten people will help, a printer will extend credit, and there's an empty wagon. Hamilton, how will you use them?") },
          { speaker: 'hamilton', text: bi("你给我的不是十个人，是十个人各自认识的那条街。", "You have given me more than ten people. You have given me every street they know.") },
        ],
        choice: { id: 'mulligan_question', prompt: bi("把今晚的话，变成明早的哪件事？", "What will tonight's words become tomorrow morning?"), options: [
          { id: 'mulligan-print', text: bi("印一份清楚的传单，让每条街接着讨论。", "Print a clear pamphlet to keep the conversation going in every street."), effect: { influence: 4, momentum: 1 }, reply: [{ speaker: 'mulligan', text: bi("行。少写几个漂亮词，多写几句他们能讲给邻居听的话。", "Good. Fewer elegant phrases, more lines they can repeat to their neighbors.") }] },
          { id: 'mulligan-supplies', text: bi("先送补给，让愿意加入的人吃上饭。", "Deliver supplies first so people willing to join us can eat."), effect: { influence: 3, burrRespect: 3 }, reply: [{ speaker: 'mulligan', text: bi("车我来找。愿意做这种不显眼的事，才有人下次还来找你。", "I'll find the wagon. Be willing to do the work no one notices, and people will come to you again.") }] },
          { id: 'mulligan-rally', text: bi("召集公开集会，今天就让更多人听见。", "Call a public meeting and make more people hear us today."), effect: { momentum: 7, influence: 3, burrRivalry: 3 }, reply: [{ speaker: 'mulligan', text: bi("场地可以有。巡逻队一来，你可不能只顾着自己的演说。", "We can find a place. But when the patrol arrives, you cannot think only of your speech.") }] },
        ] },
      },
    ], exitLabel: bi("走向公开辩论", "Go to the Public Debate"), next: 'Debate',
    prototypeNote: f(bi("读完问题后有 {0} 秒回应。三人可按任意顺序交谈；超时保持沉默，Esc 可暂停。", "You have {0} seconds to answer after the question. Speak to the three companions in any order; timeout means silence, and Esc pauses the game."), TAVERN_RESPONSE_MS / 1000),
  },
  Debate: {
    id: 'Debate', act: bi("第一幕 · 第三场", "ACT I \u00b7 SCENE 03"), title: bi("把声音放到街上", "Take Your Voice to the Street"), place: bi("纽约 · 公共广场", "NEW YORK \u00b7 PUBLIC SQUARE"), year: bi("革命初期", "Early Revolution"),
    subtitle: bi("纸上的争论，终于有了听众。", "The arguments on the page have found an audience."), objective: bi("争取群众支持，击破论点，观察伯尔的反应。", "Win public support, challenge the argument, and see how Burr responds."), width: 1280,
    interactions: [{
      id: 'debate-loyalist', label: bi("公开回应", "Answer in Public"), character: 'loyalist', x: 700,
      lines: [
        { speaker: 'loyalist', text: bi("脱离英国之后，商船由谁护送，货物卖给谁？你们用自由作保证，却要每一个家庭拿生计来冒险。", "Once you break from Britain, who escorts the ships, and who buys the cargo? You offer freedom as a guarantee, but ask every family to risk its livelihood.") },
        { speaker: 'citizen', text: bi("这也是我想问的。没有明天的面包，今天的口号有什么用？", "That is what I want to know. Without tomorrow's bread, what good are today's slogans?") },
        { speaker: 'burr', text: bi("他们在等你的回答。把问题听完。", "They are waiting for your answer. Hear the whole question.") },
      ],
      activity: 'debate',
    }], exitLabel: bi("带着名声走进军营", "Bring Your Reputation into Camp"), next: 'Washington',
  },
  Washington: {
    id: 'Washington', act: bi("第二幕 · 第一场", "ACT II \u00b7 SCENE 01"), title: bi("笔，比军刀更近", "The Pen Comes Before the Sword"), place: bi("大陆军 · 总部", "CONTINENTAL ARMY \u00b7 HEADQUARTERS"), year: '1777',
    subtitle: bi("他想要战场。将军先递来一叠信件。", "He wants the battlefield. The general hands him a stack of letters."), objective: bi("回应华盛顿，并决定怎样整理军令。", "Answer Washington, then organize his dispatches."), width: 1700,
    interactions: [
      {
        id: 'washington-offer', label: bi("总司令的提议", "The Commander's Offer"), character: 'washington', x: 500,
        lines: [
          { speaker: 'washington', text: bi("我看过你的文章。你能把事情写清楚。但军中需要的，还有把事情做完。", "I have read your essays. You make matters clear. But an army also needs people who finish the work.") },
          { speaker: 'hamilton', text: bi("我希望带兵。我的能力不该只留在信纸上。", "I want to lead troops. My ability should not stay on the page.") },
          { speaker: 'washington', text: bi("军令、情报、补给。写错一个地点，也会有人付出代价。我需要副官。你愿意从这里开始吗？", "Orders, intelligence, supplies. A wrong place name can cost lives. I need an aide. Are you willing to begin here?") },
        ],
        variants: [{ stat: 'influence', min: 30, lines: [
          { speaker: 'washington', text: bi("你的文章已经传进军营。我也听说了街上的争论。让别人注意你，你很擅长；让别人依靠你，是另一回事。", "Your essays have reached camp. So has news of the argument in the street. You are good at drawing attention. Making yourself dependable is another matter.") },
          { speaker: 'hamilton', text: bi("那么给我一支队伍。我愿意用行动证明。", "Then give me a company. I am willing to prove myself through action.") },
          { speaker: 'washington', text: bi("先做我的副官。军令、情报和补给，也决定着一支队伍能不能回来。你愿意承担吗？", "Serve as my aide first. Orders, intelligence, and supplies also decide whether a company comes home. Will you take that responsibility?") },
        ] }],
        choice: { id: 'washington_position', prompt: bi("你如何回应这份尚不是理想的职位？", "How do you respond to a position that is not yet the one you want?"), options: [
          { id: 'washington-accept', text: bi("接受副官职位，先完成眼前的责任。", "Accept the post and fulfill the responsibility at hand."), effect: { washingtonTrust: 15, momentum: -5 }, reply: [{ speaker: 'washington', text: bi("很好。今晚有几封信，不能等到明天。", "Good. Several letters tonight cannot wait until tomorrow.") }] },
          { id: 'washington-negotiate', text: bi("接受，同时明确争取未来的指挥机会。", "Accept, while making clear that you want a future command."), effect: { washingtonTrust: 8, momentum: 5 }, reply: [{ speaker: 'washington', text: bi("我听清了你的要求。你也要听清我的：用现在的职责，证明我能交给你下一份职责。", "I have heard your request. Hear mine as well: prove through your present duties that I can trust you with the next ones.") }] },
          { id: 'washington-demand', text: bi("我属于战场，应当立刻得到指挥权。", "I belong on the battlefield and should be given command now."), effect: { washingtonTrust: -8, momentum: 15 }, reply: [{ speaker: 'washington', text: bi("这里没有人只凭“应当”获得命令权。今晚你仍然从这些军令开始。", "No one here receives command merely because he thinks he should. Tonight, you will still begin with these dispatches.") }] },
        ] },
      },
      {
        id: 'washington-dispatch', label: bi("写下军令", "Write the Dispatch"), character: 'washington', x: 1120,
        lines: [
          { speaker: 'washington', text: bi("北线的部队需要补给。驻地、出发时间、目的地都在这些报告里。给军需官一份能够执行的命令。", "The northern troops need supplies. Their camp, the departure time, and the destination are in these reports. Give the quartermaster an order he can carry out.") },
          { speaker: 'hamilton', text: bi("一页纸。不能让收信人猜测，也不能让他在一段漂亮文字里寻找自己的任务。", "One page. The reader must not have to guess, or search through fine prose to find his task.") },
        ],
        activity: 'writing',
      },
    ], exitLabel: bi("翻过战争中的几年", "Turn the Pages of the War"), next: 'Yorktown',
  },
  Yorktown: {
    id: 'Yorktown', act: bi("第二幕 · 第二场", "ACT II \u00b7 SCENE 02"), title: bi("终于，轮到你下令", "At Last, the Order Is Yours"), place: bi("约克镇", "YORKTOWN"), year: '1781',
    subtitle: bi("多年信件之后，等待已久的命令终于抵达。", "After years of letters, the long-awaited order arrives."), objective: bi("接过指挥权，作出选择，见证约克镇的结局。", "Take command, make your choices, and witness Yorktown's outcome."), width: 1700,
    interactions: [
      {
        activity: 'yorktown', id: 'yorktown-command', label: bi("接过指挥权", "Take Command"), character: 'washington', x: 500,
        lines: [
          { speaker: 'narrator', text: bi("1781 年，法美联军围困约克镇。数年的行军、军令与争执，终于把汉密尔顿带到一座英军堡垒前。", "In 1781, French and American forces surrounded Yorktown. Years of marches, dispatches, and disputes brought Hamilton to the foot of a British redoubt.") },
          { speaker: 'washington', text: bi("你得到这次指挥机会。我要看到的，是一个能对整支队伍负责的军官。严格执行计划，别把它变成你一个人的证明。", "You have this command. What I expect is an officer responsible for his whole company. Follow the plan. Do not turn it into a private test of your worth.") },
          { speaker: 'hamilton', text: bi("我明白。等了这么久，我不能只想着自己如何被看见。", "I understand. After waiting so long, I cannot think only of how I will be seen.") },
        ],
        variants: [{ stat: 'washingtonTrust', min: 18, lines: [
          { speaker: 'narrator', text: bi("1781 年，法美联军围困约克镇。数年的行军与军令，把汉密尔顿带到一座英军堡垒前。", "In 1781, French and American forces surrounded Yorktown. Years of marches and dispatches brought Hamilton to the foot of a British redoubt.") },
          { speaker: 'washington', text: bi("你证明了自己能承担责任。这支队伍交给你。按计划行动；现场需要判断时，我相信你知道命令背后的目的。", "You have proved you can carry responsibility. These troops are yours. Follow the plan; when judgment is needed, I trust you to understand the purpose behind the order.") },
          { speaker: 'hamilton', text: bi("这一次，纸上的名字会和我一起向前。我会记住，他们要跟随的不是一句漂亮的话。", "This time, the names on the page will move forward beside me. I will remember that they need more than a fine sentence to follow.") },
        ] }],
        choice: { id: 'yorktown_leadership', prompt: bi("出发前，你给部下的第一道指令是？", "Before setting out, what is your first instruction to the troops?"), options: [
          { id: 'yorktown-coordinate', text: bi("核对各队的职责，等共同信号再推进。", "Confirm each squad's role and wait for the common signal."), effect: { washingtonTrust: 5, momentum: -3 }, reply: [{ speaker: 'hamilton', text: bi("每一队都要知道身旁的人在哪里。听到信号，一起前进。", "Every squad must know where the others are. When the signal comes, we move together.") }] },
          { id: 'yorktown-lead', text: bi("我走在最前面，你们跟紧。", "I will lead from the front. Stay close."), effect: { momentum: 9, washingtonTrust: 2 }, reply: [{ speaker: 'hamilton', text: bi("我会先走出去。但看清信号，别因为跟随我而忘了自己的位置。", "I will step out first. But watch the signal. Do not lose your own position by following mine.") }] },
          { id: 'yorktown-rally', text: bi("说明共同目标，让每个人知道为何出发。", "Explain the shared objective so everyone knows why we are going."), effect: { momentum: 5, influence: 4 }, reply: [{ speaker: 'hamilton', text: bi("我们要打开围城的一道缺口。记住身边的人，记住回来的路。现在，各就各位。", "We are opening a breach in the siege. Remember the person beside you, and remember the way back. Now, take your positions.") }] },
        ] },
      },
      {
        id: 'yorktown-surrender', label: bi("炮声之后", "After the Guns"), character: 'narrator', x: 1120,
        lines: [
          { speaker: 'narrator', text: bi("汉密尔顿率队攻下十号堡垒，法军攻下相邻的九号堡垒。围城继续收紧。", "Hamilton's troops took Redoubt No. 10, while French forces took the neighboring Redoubt No. 9. The siege tightened.") },
          { speaker: 'narrator', text: bi("数日后，英军在约克镇投降。胜利来自许多人的共同作战。战争尚未正式结束，但局势已经改变。", "Days later, British forces surrendered at Yorktown. Victory belonged to many people fighting together. The war had not formally ended, but its course had changed.") },
          { speaker: 'hamilton', text: bi("那些从前只能写进信里的愿望，现在终于有了重量。明天，还会有人问，我们准备拿这个胜利做什么。", "The hopes I once could only put in letters finally have weight. Tomorrow, someone will ask what we intend to do with this victory.") },
        ], effect: { influence: 6 },
      },
    ], exitLabel: bi("阅读你的革命侧写", "Read Your Revolutionary Portrait"), next: 'Ending',
  },
};
