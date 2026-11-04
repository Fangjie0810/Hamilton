import { bi, type BiText } from '../../../src/i18n/text';

interface IntroVersion {
  label: BiText;
  treatment: BiText;
  era: BiText;
  title: BiText;
  subtitle: BiText;
  paragraphs: readonly BiText[];
  closing: BiText;
}

export const versions = {
  a: {
    label: bi('A · 清晰导读', 'A · A Clear Introduction'),
    treatment: bi('深色幕间 · 直接对玩家说话', 'Dark interlude · Addressing the player'),
    era: bi('北美 · 1776 年前后', 'NORTH AMERICA · AROUND 1776'),
    title: bi('走进革命中的纽约', 'Enter Revolutionary New York'),
    subtitle: bi('一个年轻人的前途，与一片大陆的争执。', 'One young man’s future. A continent in dispute.'),
    paragraphs: [
      bi('你是亚历山大·汉密尔顿，来自加勒比海的年轻写作者。你来到纽约求学，也想让自己的才能被看见。', 'You are Alexander Hamilton, a young writer from the Caribbean. You have come to New York to study—and to make your talents count.'),
      bi('英国与其北美十三殖民地，已因税收、贸易与自治权的争执陷入战争。有人要求独立，也有人相信王室仍能维护秩序与生计。', 'Britain and its thirteen American colonies are at war after years of disputes over taxes, trade, and self-government. Some demand independence; others still trust the Crown to preserve order and livelihoods.'),
      bi('你将从报纸与街头争论中认识这座城，在酒馆结识同伴。谨慎的阿伦·伯尔，劝你先观察，再表态。乔治·华盛顿正率领反抗英国的大陆军，而这里的每一次发声，都在为尚未确定的未来争取支持。', 'Newspapers and street arguments will introduce you to the city; a tavern will bring you companions. Cautious Aaron Burr urges you to observe before taking a stand. George Washington leads the Continental Army against Britain. Here, every public voice is seeking support for a future that remains uncertain.'),
    ],
    closing: bi('先走进这座城，听听每个人在争什么。', 'Step into the city. Hear what its people are arguing for.'),
  },
  b: {
    label: bi('B · 时代告示', 'B · A Period Broadside'),
    treatment: bi('旧纸与铅字 · 十八世纪告示文风', 'Paper and type · An eighteenth-century voice'),
    era: bi('北美 · 革命初期', 'NORTH AMERICA · THE REVOLUTIONARY YEARS'),
    title: bi('告纽约诸君', 'To the Inhabitants of New-York'),
    subtitle: bi('论自由、立身与一位远来的青年', 'On Liberty, Ambition, and a Young Arrival'),
    paragraphs: [
      bi('北美十三殖民地，久奉英王。今税赋、商贸与自治之争日炽，已至兵戎相见。效忠王室者，望秩序与生计得保；主张独立者，欲自定此地之前途。街巷有争声，印坊有文章，旧日安稳，已难照常。', 'These thirteen Colonies have long lived under the British Crown. Disputes over Taxes, Trade, and Self-Government have now come to arms. Some look to the Crown for order and livelihood; others seek Independence, to determine their own future. The streets resound with argument, and the presses are seldom still.'),
      bi('有青年亚历山大·汉密尔顿，自加勒比海而来，求学纽约，亦欲凭文章立身。彼于街头听众议，于酒馆会同伴。文章传于街巷，声名亦一日盛于一日。', 'Among those who seek a place in New-York is a young writer from the Caribbean, Alexander Hamilton. He comes to study, and to make his pen known. In the streets he hears the public temper; in the taverns, finds companions. His writings pass from street to street, and his name grows more widely known with each passing day.'),
      bi('华盛顿将军率大陆军与英军相抗，胜负未定。诸人所争，既是一地之命运，亦是各自明日的生活。', 'General Washington leads the Continental Army against Britain; the outcome remains uncertain. What they contend for is both the fate of these Colonies and the lives they shall lead.'),
    ],
    closing: bi('且随此人走入街头，看一个名字如何争得分量。', 'Come, then, into the streets—and see what weight a name may earn.'),
  },
} as const satisfies Record<string, IntroVersion>;

export const labels = {
  project: bi('汉密尔顿 · 背景介绍', 'HAMILTON · A HISTORICAL PRELUDE'),
  draft: bi('独立设计稿 · 未接入游戏', 'STANDALONE STUDY · NOT IN THE GAME'),
  version: bi('方案', 'Version'),
  language: bi('语言', 'Language'),
  continue: bi('走入故事', 'Enter the Story'),
  replay: bi('重看本稿', 'Read Again'),
  note: bi('本作将汉密尔顿早年的赴纽约求学，与 1776—1777 年的革命经历并置呈现。', 'This story brings Hamilton’s early arrival in New York to study together with his experiences of the Revolution in 1776–1777.'),
  playerRole: bi('你将扮演亚历山大·汉密尔顿。', 'You will play as Alexander Hamilton.'),
  stageLabel: bi('背景介绍画面', 'Historical introduction'),
  nextTitle: bi('海的另一边', 'Across the Sea'),
  nextEyebrow: bi('序幕', 'PROLOGUE'),
  previewNote: bi('此处仅预览衔接，未启动游戏。', 'This is a transition preview. The game has not been started.'),
  noAutoplay: bi('自主阅读 · 点击继续', 'READ AT YOUR PACE · CONTINUE WHEN READY'),
  original: bi('时代文风原创，非历史文献原文。', 'An original period-inspired text, not a historical document.'),
  print: bi('打印当前稿', 'Print This Version'),
};

export const languageOptions = [
  { value: 'dual', text: bi('双语 · 中文主字幕', 'Bilingual · Chinese first'), native: 'zh' },
  { value: 'dual-en', text: bi('双语 · 英文主字幕', 'Bilingual · English first'), native: 'en' },
  { value: 'zh', text: bi('中文', 'Chinese'), native: 'zh' },
  { value: 'en', text: bi('英文', 'English'), native: 'en' },
] as const;
