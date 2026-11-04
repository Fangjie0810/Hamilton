import { cloneState, type GameState } from '../core/GameState';
import { growthThresholds } from '../data/growth';
import type { ChapterId } from '../data/types';
import { bi, f, type BiText } from '../i18n/text';

export type GrowthStat = 'momentum' | 'influence' | 'washingtonTrust' | 'burrRespect' | 'burrRivalry';
export interface GrowthNotice { id: string; stat: GrowthStat; text: BiText }
export interface GrowthTutorial { id: string; chapter: ChapterId; stats: readonly GrowthStat[] }

const tutorials: readonly GrowthTutorial[] = [
  { id: 'arrival-newspaper', chapter: 'Arrival', stats: ['influence'] },
  { id: 'arrival-street', chapter: 'Arrival', stats: ['momentum'] },
  { id: 'arrival-burr', chapter: 'Arrival', stats: ['burrRespect', 'burrRivalry'] },
  { id: 'washington-offer', chapter: 'Washington', stats: ['washingtonTrust'] },
];

const chapterIndex: Record<ChapterId, number> = { Opening: 0, Arrival: 1, Tavern: 2, Debate: 3, Washington: 4, Yorktown: 5 };

/** Tutorial memory belongs to this run's UI, independent of chapter checkpoints. */
export class GrowthGuide {
  private previous?: GameState;
  private chapter: ChapterId = 'Opening';
  private completed = new Set<string>();
  private seen = new Set<string>();
  private pendingTutorials: GrowthTutorial[] = [];
  private choiceSeen = false;

  reset() { this.previous = undefined; this.chapter = 'Opening'; this.completed.clear(); this.seen.clear(); this.pendingTutorials = []; this.choiceSeen = false; }
  get state() { return this.previous; }
  get knowsBurr() { return chapterIndex[this.chapter] > 1 || this.completed.has('arrival-burr') || !!this.previous?.choices.burr_first_impression; }

  /** Re-resolve queued notices when shown: the player may already have finished the activity. */
  noticeText(notice: GrowthNotice): BiText { return this.thresholdText(notice.id); }

  setContext(chapter: ChapterId, state: GameState, completed: Iterable<string>): GrowthNotice[] {
    const before = this.previous;
    this.chapter = chapter; this.completed = new Set(completed); this.previous = cloneState(state);
    // Pending explanations survive pauses, but an unread explanation does not leak into a restarted chapter.
    this.pendingTutorials = this.pendingTutorials.filter(item => item.chapter === chapter && this.completed.has(item.id));
    for (const tutorial of tutorials) {
      if (tutorial.chapter !== chapter || !this.completed.has(tutorial.id) || this.seen.has(tutorial.id)
        || this.pendingTutorials.some(item => item.id === tutorial.id)) continue;
      this.pendingTutorials.push(tutorial);
    }
    const notices: GrowthNotice[] = [];
    if (!before) return notices;
    const thresholds: { id: string; stat: GrowthStat; value: number }[] = [
      { id: 'momentum-recovery', stat: 'momentum', value: growthThresholds.momentumRecovery },
      { id: 'influence-crowd', stat: 'influence', value: growthThresholds.influenceCrowd },
      { id: 'influence-crowd-high', stat: 'influence', value: growthThresholds.influenceCrowdHigh },
      { id: 'trust-reference', stat: 'washingtonTrust', value: growthThresholds.trustReference },
      { id: 'trust-deployment', stat: 'washingtonTrust', value: growthThresholds.trustDeployment },
      { id: 'burr-respect', stat: 'burrRespect', value: growthThresholds.burrRespect },
      { id: 'burr-rivalry', stat: 'burrRivalry', value: growthThresholds.burrRivalry },
    ];
    for (const threshold of thresholds) {
      if (before[threshold.stat] >= threshold.value || state[threshold.stat] < threshold.value || this.seen.has(threshold.id)) continue;
      this.seen.add(threshold.id);
      // A jump over both tiers needs only the currently applicable explanation.
      if (threshold.id === 'influence-crowd' && state.influence >= growthThresholds.influenceCrowdHigh) continue;
      notices.push({ id: threshold.id, stat: threshold.stat, text: this.thresholdText(threshold.id) });
    }
    return notices;
  }

  /** Consume only once the UI can open the modal; observing context while paused is not reading it. */
  takeTutorial(): GrowthTutorial | undefined {
    const tutorial = this.pendingTutorials.shift();
    if (tutorial) this.seen.add(tutorial.id);
    return tutorial;
  }

  takeChoiceTip(choiceId: string, timed: boolean): BiText | undefined {
    if (this.choiceSeen || timed || choiceId.startsWith('side:') || choiceId.startsWith('side-') || choiceId.startsWith('reaction:')) return;
    this.choiceSeen = true;
    return bi('↑ / ↓ 表示数值的变化方向，不代表答案对错。锐气下降也可能是克制；伯尔的尊重与竞争可以同时增加。', '↑ / ↓ show which way a value changes, not whether an answer is right. Lower Momentum can mean restraint; Burr can respect you and compete with you at the same time.');
  }

  usage(stat: GrowthStat): BiText {
    const state = this.previous;
    if (!state) return bi('主线选择与可选发现都会留下成长。', 'Story choices and optional discoveries both shape your growth.');
    if ((stat === 'burrRespect' || stat === 'burrRivalry') && !this.knowsBurr)
      return bi('与伯尔相识后，可以查看关系门槛与额外交流。', 'Meet Burr to reveal relationship thresholds and optional conversations.');
    if (stat === 'momentum') {
      if (this.debateEnded) return bi('接下来：出征时体现你的态度，结局回顾你留下的锐气。辩论已结束，新的增长不会改变旧成绩。', 'Next: your stance shapes the words before battle and the ending. The debate is over; further growth does not change its result.');
      return state.momentum >= growthThresholds.momentumRecovery
        ? bi('已达门槛：辩论开始时可获得 1 次反击失拍保护，免除反噬；失误与断连击仍照实记录。', 'Threshold reached: start the debate with 1 recovery from a mistimed attack. It prevents the backlash; the miss and broken combo still count.')
        : f(bi('下一用途：锐气达到 {0}，辩论开始时获得 1 次反击失拍保护。克制的选择同样可以走完主线。', 'Next: reach {0} Momentum to start the debate with 1 recovery from a mistimed attack. A restrained path can complete the whole story too.'), growthThresholds.momentumRecovery);
    }
    if (stat === 'influence') {
      if (this.debateEnded) return chapterIndex[this.chapter] <= 4 && !state.choices.washington_position
        ? f(bi('下一用途：影响力达到 {0}，华盛顿初见时会提及你的文章。辩论已结束，新的影响力不会补加群众支持。', 'Next: at {0} Influence, Washington mentions your essays when you first meet. The debate is over; new Influence cannot add support to it.'), growthThresholds.influenceCrowdHigh)
        : bi('你的主张已被听见，人物回应与结局会回顾这段经历。已结束的辩论不会因后续增长重算支持或成绩。', 'Your ideas have been heard, shaping character responses and the ending. Later growth does not recalculate support or results from the finished debate.');
      return state.influence >= growthThresholds.influenceCrowdHigh
        ? bi('已达高档门槛：辩论开始时群众支持 +10。不会直接获得辩论成绩。', 'Higher threshold reached: start the debate with +10 crowd support. This does not award a debate score.')
        : state.influence >= growthThresholds.influenceCrowd
          ? f(bi('已达门槛：辩论开始时群众支持 +5。达到 {0} 时改为 +10，两档不叠加。', 'Threshold reached: start the debate with +5 crowd support. At {0}, this becomes +10; the two tiers do not stack.'), growthThresholds.influenceCrowdHigh)
          : f(bi('下一用途：影响力 {0} / {1}，分别让辩论初始群众支持增加 5 / 10。', 'Next: {0} / {1} Influence adds 5 / 10 initial crowd support in the debate.'), growthThresholds.influenceCrowd, growthThresholds.influenceCrowdHigh);
    }
    if (stat === 'washingtonTrust') {
      if (chapterIndex[this.chapter] < 4) return bi('进入军营后积累。将军的信任让你在军令和部署中获得有限提示，也改变他对你的托付。', 'Begins in camp. The general’s trust grants limited dispatch and deployment hints, and shapes the responsibility he gives you.');
      if (this.yorktownEnded) return bi('将军对你的托付与结局会回顾这份信任。已完成的军令与战役成绩保持原样。', 'The general’s trust is reflected in his words and the ending. Completed dispatch and campaign results stay as played.');
      if (!this.writingEnded) return state.washingtonTrust >= growthThresholds.trustReference
        ? f(bi('已达门槛：军令开始时获得 1 次单片段分类提示。达到 {0}，约克镇开始时还可核对 1 支队伍部署。', 'Threshold reached: start dispatch writing with 1 fragment classification hint. At {0}, begin Yorktown with 1 squad deployment check too.'), growthThresholds.trustDeployment)
        : f(bi('下一用途：信任 {0} 解锁 1 次军令分类提示；信任 {1} 解锁 1 次约克镇单队部署核对。', 'Next: {0} Trust unlocks 1 dispatch classification hint; {1} unlocks 1 squad deployment check at Yorktown.'), growthThresholds.trustReference, growthThresholds.trustDeployment);
      return state.washingtonTrust >= growthThresholds.trustDeployment
        ? bi('已达门槛：约克镇开始时获得 1 次单队部署核对。军令已完成，不会补发过去的提示。', 'Threshold reached: begin Yorktown with 1 squad deployment check. Dispatch writing is complete; its hints are not granted retroactively.')
        : f(bi('下一用途：信任达到 {0}，约克镇开始时获得 1 次单队部署核对；将军授命时也会体现信任。', 'Next: reach {0} Trust to begin Yorktown with 1 squad deployment check. His words of command also reflect that trust.'), growthThresholds.trustDeployment);
    }
    const respect = stat === 'burrRespect', threshold = respect ? growthThresholds.burrRespect : growthThresholds.burrRivalry;
    if (chapterIndex[this.chapter] > 3) return bi('广场交流阶段已结束；这项关系会继续影响结局。尊重与竞争彼此独立，可以同时存在。', 'The square’s conversations are behind you; this relationship still shapes the ending. Respect and rivalry are independent and can coexist.');
    return respect
      ? f(bi('达到 {0}，可在广场额外请伯尔评价你的论据。交流不再发放属性奖励。', 'At {0}, ask Burr to assess your argument in an optional square conversation. The conversation does not grant more attribute rewards.'), threshold)
      : f(bi('达到 {0}，可在广场向伯尔发出下一次辩论的挑战。竞争不是好感扣分，也不排斥尊重。', 'At {0}, challenge Burr to a future debate in an optional square conversation. Rivalry is not a loss of affection and does not exclude respect.'), threshold);
  }

  private get debateEnded() { return chapterIndex[this.chapter] > 3 || !!this.previous?.choices.debate_result; }
  private get writingEnded() { return chapterIndex[this.chapter] > 4 || !!this.previous?.choices.writing_result; }
  private get yorktownEnded() { return !!this.previous?.choices.yorktown_result; }
  private thresholdText(id: string): BiText {
    if (id === 'momentum-recovery') return this.debateEnded ? this.usage('momentum')
      : f(bi('锐气达到 {0}：辩论开始时可获得 1 次反击失拍保护。', 'Momentum reached {0}: the debate can start with 1 recovery from a mistimed attack.'), growthThresholds.momentumRecovery);
    if (id.startsWith('influence-crowd')) return this.debateEnded ? this.usage('influence')
      : id === 'influence-crowd-high'
        ? f(bi('影响力达到 {0}：辩论初始群众支持将增加 10。', 'Influence reached {0}: initial debate support will increase by 10.'), growthThresholds.influenceCrowdHigh)
        : f(bi('影响力达到 {0}：辩论初始群众支持将增加 5。', 'Influence reached {0}: initial debate support will increase by 5.'), growthThresholds.influenceCrowd);
    if (id === 'trust-reference') return this.writingEnded ? this.usage('washingtonTrust')
      : f(bi('信任达到 {0}：军令开始时可查阅 1 次片段分类提示。', 'Trust reached {0}: begin dispatch writing with 1 fragment classification hint.'), growthThresholds.trustReference);
    if (id === 'trust-deployment') return this.yorktownEnded ? this.usage('washingtonTrust')
      : f(bi('信任达到 {0}：约克镇开始时可核对 1 支队伍的部署。', 'Trust reached {0}: begin Yorktown with 1 squad deployment check.'), growthThresholds.trustDeployment);
    return this.usage(id === 'burr-respect' ? 'burrRespect' : 'burrRivalry');
  }
}
