import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import type { GameState } from '../core/GameState';

export function endingTitle(state: GameState): BiText {
  if (state.momentum >= 75 && state.washingtonTrust >= 18) return bi("锋芒，开始承担重量。", "Your ambition begins to carry weight.");
  if (state.washingtonTrust >= 18) return bi("信任，在一次次承担之后。", "Trust, earned through responsibility.");
  if (state.momentum >= 75) return bi("你的脚步，比掌声更急。", "Your footsteps hurry ahead of the applause.");
  return bi("一个名字，刚刚开始。", "A name, just beginning.");
}

/** Report only activities with an actual committed result, including older narrative-only saves. */
export function endingSummary(state: GameState): BiText[] {
  const summary: BiText[] = [];
  const firstChoice = state.choices.burr_first_impression;
  if (firstChoice === 'burr-revolution') summary.push(bi("初到纽约，你就公开支持革命，让自己的立场与名字一起被听见。", "On arriving in New York, you publicly supported the revolution, making your name and your position heard together."));
  else if (firstChoice === 'burr-question') summary.push(bi("初到纽约，你先追问伯尔的信念，试着看清站在你面前的人。", "On arriving in New York, you asked what Burr believed, trying to understand the man before you."));
  else if (firstChoice === 'burr-observe') summary.push(bi("初到纽约，你选择先观察。克制，也是你亲手作出的决定。", "On arriving in New York, you chose to observe. Restraint, too, was a decision you made for yourself."));

  const debate: Record<string, BiText> = {
    'debate-fact': bi("面对公开质疑，你选择厘清事实，让争论落到可以回答的问题上。", "Under public challenge, you clarified the facts and brought the argument to questions that could be answered."),
    'debate-principle': bi("面对公开质疑，你把决定权放在中心，追问谁有资格选择未来。", "Under public challenge, you put the right to decide at the center and asked who could choose the future."),
    'debate-attack': bi("面对公开质疑，你强硬揭开对方论证的偏向，也让冲突更加鲜明。", "Under public challenge, you forcefully exposed the bias in your opponent's argument, sharpening the conflict."),
    'debate-crowd': bi("面对公开质疑，你让现场的人加入，让个人的声音成为众人的讨论。", "Under public challenge, you brought the audience into the discussion and turned one voice into many."),
  };
  const debateChoice = debate[state.choices.debate_approach];
  if (debateChoice) summary.push(debateChoice);
  if (state.choices.debate_result) summary.push(state.choices.debate_result === 'won'
    ? f(bi("你赢得了广场的辩论，节拍表现为 {0} / 100。", "You won the debate in the square with a rhythm score of {0} / 100."), state.debatePerformance)
    : f(bi("广场没有完全被你说服；这次辩论的节拍表现为 {0} / 100。", "The square was not fully convinced; your rhythm score in this debate was {0} / 100."), state.debatePerformance));
  if (state.choices.writing_result !== undefined) summary.push(f(bi("军令首次分类准确率为 {0} / 100。华盛顿看见了你处理细节的方式。", "Your first-pass dispatch accuracy was {0} / 100. Washington saw how you handled the details."), state.choices.writing_result));

  if (state.choices.washington_position) {
    summary.push(state.washingtonTrust >= 18
      ? bi("你的选择积累了华盛顿的信任。此刻，他对你承担责任的能力更有把握。", "Your decisions earned Washington's trust. He now has greater confidence in your ability to carry responsibility.")
      : bi("你争取到了指挥机会，但华盛顿的信任仍有限。机会与认可，还没有完全重合。", "You won a command, but Washington's trust remained limited. Opportunity and recognition had not yet become the same thing."));
  }

  const leadership: Record<string, BiText> = {
    'yorktown-coordinate': bi("第一次下令时，你先核对分工，把个人的速度放在共同节奏之后。", "When you first gave an order, you checked each squad's role and put a shared rhythm ahead of your own speed."),
    'yorktown-lead': bi("第一次下令时，你选择走在最前面，让自己的行动成为承诺。", "When you first gave an order, you chose to lead from the front, making your actions a promise."),
    'yorktown-rally': bi("第一次下令时，你先说明目标，希望每个人都知道自己为何出发。", "When you first gave an order, you explained the objective so everyone would know why they were setting out."),
  };
  const commandChoice = leadership[state.choices.yorktown_leadership];
  if (commandChoice) summary.push(commandChoice);
  if (state.choices.yorktown_result) summary.push(f(bi("约克镇的潜行、部署与突击留下了 {0} / 100 的战役表现。胜利属于整支队伍。", "Your stealth, deployment, and assault at Yorktown earned {0} / 100. Victory belongs to the whole company."), state.yorktownPerformance));

  if (state.burrRespect >= 35 && state.burrRivalry >= 25) summary.push(bi("伯尔对你的尊重与竞争心同时增长。他认真看待你的能力，也更在意你会走向哪里。", "Burr's respect and rivalry both grew. He takes your ability seriously and watches more closely where it may lead you."));
  else if (state.burrRivalry >= 25) summary.push(bi("你与伯尔的竞争感已更鲜明。你越急于向前，他越留意你留下的后果。", "Your rivalry with Burr became sharper. The faster you pressed forward, the more closely he watched what you left behind."));
  else if (state.burrRespect >= 35) summary.push(bi("伯尔对你的尊重有所积累。你们未必赞同彼此，却有了继续听下去的理由。", "Burr's respect for you grew. You do not always agree, but you have reasons to keep listening to each other."));
  else summary.push(bi("你与伯尔之间，欣赏和距离都还存在。这段关系尚未定型。", "Between you and Burr, admiration and distance both remain. The relationship has yet to settle into its final shape."));

  return summary;
}
