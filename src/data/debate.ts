import { bi, f, cat, type Text, type BiText } from '../i18n/text';
export const responseTypes = ['FACT', 'PRINCIPLE', 'ATTACK', 'CROWD'] as const;
export type ResponseType = typeof responseTypes[number];
export const responseNames: Record<ResponseType, BiText> = { FACT: bi("事实", "Facts"), PRINCIPLE: bi("原则", "Principle"), ATTACK: bi("反击", "Attack"), CROWD: bi("动员", "Rally") };
export const responseHints: Record<ResponseType, BiText> = {
  FACT: bi("稳定削弱可信度", "Steadily weaken credibility"), PRINCIPLE: bi("争取支持与锐气", "Build support and momentum"), ATTACK: bi("高收益；失拍反噬", "High reward; a missed beat backfires"), CROWD: bi("迅速聚拢人群；论证变弱", "Rally the crowd quickly; weaken the argument"),
};
export interface DebateArgument {
  topic: BiText;
  text: BiText;
  opening: BiText;
  emphasis: ResponseType;
  responses: Record<ResponseType, BiText>;
}
export const debateArguments: DebateArgument[] = [
  { topic: bi("贸易与生计", "Trade and Livelihood"), text: bi("脱离英国之后，商船由谁护送，货物卖给谁？你们让每个家庭用明天的面包支付自由。", "After leaving Britain, who will escort the ships and buy the cargo? You ask each family to pay for freedom with tomorrow's bread."), opening: bi("听众想知道具体的成本。事实更有分量。", "The audience wants concrete costs. Facts carry more weight here."), emphasis: 'FACT', responses: {
    FACT: bi("把税负与贸易限制也算进去。", "Count taxes and trade restrictions too."), PRINCIPLE: bi("承担代价的人应有决定权。", "Those who pay should have a say."), ATTACK: bi("你为何只计算改变的代价？", "Why count only the costs of change?"), CROWD: bi("让码头的人说说他们的账本。", "Let the dockworkers open their ledgers."),
  } },
  { topic: bi("谁来决定", "Who Decides?"), text: bi("帝国的议会已经替各地考虑过了。若每座港口都要求自己决定，法律还剩下什么？", "Parliament has already considered every region. If each port insists on deciding for itself, what is left of the law?"), opening: bi("争论落在代表权上。原则更有分量。", "The question is representation. Principle carries more weight here."), emphasis: 'PRINCIPLE', responses: {
    FACT: bi("把殖民地的代表席位列出来。", "List the colonies' seats in Parliament."), PRINCIPLE: bi("服从法律，也应参与制定。", "Those who obey laws should help make them."), ATTACK: bi("考虑过，不等于听过我们的声音。", "Considering us is not the same as hearing us."), CROWD: bi("谁愿意让别人决定自己的税？", "Who wants others to decide their taxes?"),
  } },
  { topic: bi("承诺与责任", "Promises and Responsibility"), text: bi("倡议革命的人只会写文章。等粮食短缺，他们会让穷人承担后果。", "The advocates of revolution only write essays. When food runs short, they will leave the poor to bear the consequences."), opening: bi("人群希望亲自说出处境。动员更有效。", "People want to speak for themselves. Rallying them works better here."), emphasis: 'CROWD', responses: {
    FACT: bi("补给方案与责任人必须公开。", "Publish the supply plan and those responsible."), PRINCIPLE: bi("自由不能只属于有余粮的人。", "Freedom cannot belong only to the well-fed."), ATTACK: bi("你也没给穷人留下别的出路。", "You have offered the poor no other path."), CROWD: bi("请工人和店主自己提出条件。", "Let workers and shopkeepers name their terms."),
  } },
  { topic: bi("秩序的代价", "The Price of Order"), text: bi("驻军只为保护秩序。既然你们没有做错什么，为何害怕更多巡逻？", "The garrison is only here to keep order. If you have done nothing wrong, why fear more patrols?"), opening: bi("对方把质疑等同于心虚。反击能揭开漏洞。", "Your opponent equates questioning with guilt. An attack can expose the flaw."), emphasis: 'ATTACK', responses: {
    FACT: bi("检查驻军的权限与费用。", "Examine the garrison's powers and costs."), PRINCIPLE: bi("权力仍需得到被治理者同意。", "Power still needs the consent of the governed."), ATTACK: bi("要求解释，何时成了认错？", "Since when is asking for an explanation a confession?"), CROWD: bi("请居民讲讲巡逻带来的变化。", "Let residents describe what patrols have changed."),
  } },
  { topic: bi("战争的风险", "The Risk of War"), text: bi("帝国拥有舰队和资金。你们连统一的军需账册都没有，却要把大家带进战争。", "The empire has fleets and money. You do not even have a common supply ledger, yet you would lead everyone into war."), opening: bi("此刻需要可执行的办法。事实更有分量。", "This calls for a workable plan. Facts carry more weight here."), emphasis: 'FACT', responses: {
    FACT: bi("统一账册，逐项落实补给。", "Unify the ledgers and secure supplies item by item."), PRINCIPLE: bi("危险不能取消选择的权利。", "Danger does not erase the right to choose."), ATTACK: bi("你的胜算只是让我们永远服从。", "Your only plan is that we obey forever."), CROWD: bi("把愿意承担的工作写在这里。", "Write down the work you are willing to do."),
  } },
  { topic: bi("未来属于谁", "Whose Future?"), text: bi("即使赢了，谁能保证新掌权的人更好？你们只是把一种不确定换成另一种。", "Even if you win, who guarantees the new rulers will be better? You are exchanging one uncertainty for another."), opening: bi("争论来到制度与约束。原则更有分量。", "The question is institutions and limits on power. Principle carries more weight here."), emphasis: 'PRINCIPLE', responses: {
    FACT: bi("将任期与问责写进制度。", "Put terms of office and accountability into law."), PRINCIPLE: bi("让人民保留更换掌权者的权利。", "Keep the people's right to replace their rulers."), ATTACK: bi("没有保证，不等于现状无需改变。", "No guarantee does not mean no need for change."), CROWD: bi("把你们不愿再接受的事说出来。", "Tell us what you will no longer accept."),
  } },
];
