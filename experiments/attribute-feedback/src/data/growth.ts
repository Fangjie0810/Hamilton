import { bi, type BiText } from '../i18n/text';

export const growthThresholds = {
  momentumRecovery: 55,
  influenceCrowd: 25,
  influenceCrowdHigh: 30,
  trustReference: 8,
  trustDeployment: 18,
  burrRespect: 25,
  burrRivalry: 15,
} as const;

export type GrowthAttributeId = 'momentum' | 'influence' | 'washingtonTrust' | 'burrRespect' | 'burrRivalry';
export interface GrowthAttribute { id: GrowthAttributeId; name: BiText; description: BiText; uses: BiText }

export const growthAttributes: readonly GrowthAttribute[] = [
  { id: 'momentum', name: bi('锐气', 'Momentum'), description: bi('主动争取机会的劲头。克制会降低锐气，不代表选择错误。', 'Your drive to seize opportunities. Restraint may lower Momentum without making a choice wrong.'), uses: bi('55：辩论中一次反击失拍免受反噬，仍记失误。也会改变出征前的表达与结局。', '55: Protects one missed attack from backlash in the debate; the miss still counts. Also changes your words before battle and your ending.') },
  { id: 'influence', name: bi('影响力', 'Influence'), description: bi('有多少人愿意听你说话、接力传播你的主张。', 'How many people will hear you out and carry your ideas onward.'), uses: bi('25：辩论初始支持 +5；30：改为 +10，并影响将军初见时对你的了解。', '25: Initial debate support +5; 30: +10 instead, and the general may already know your writing.') },
  { id: 'washingtonTrust', name: bi('华盛顿信任', 'Washington Trust'), description: bi('将军愿意把多少责任交给你。进入军营后开始积累。', 'How much responsibility the general entrusts to you. This begins to grow in camp.'), uses: bi('8：军令中可查阅一次片段分类；18：约克镇可核对一次单队部署，并获得更有分量的授命。', '8: Consult one fragment category during the dispatch activity; 18: Check one squad order at Yorktown and receive a more trusted commission.') },
  { id: 'burrRespect', name: bi('伯尔尊重', 'Burr Respect'), description: bi('伯尔对你判断力的认可，与竞争可以同时增长。', "Burr's regard for your judgment. Respect and Rivalry can grow together."), uses: bi('25：广场可追问他对你论据的看法；35：影响结局关系回顾。', '25: Ask for his assessment of your argument in the square; 35: Changes the ending relationship reflection.') },
  { id: 'burrRivalry', name: bi('伯尔竞争', 'Burr Rivalry'), description: bi('他开始把你当作必须认真面对的对手，并非好感扣分。', 'He begins to see you as an opponent worth taking seriously. This is not a loss of affection.'), uses: bi('15：广场可邀请下一次交锋；25：影响结局关系回顾。', '15: Invite another exchange in the square; 25: Changes the ending relationship reflection.') },
];

export interface DebateBenefits { crowdBonus: number; attackRecovery: number }
export interface WritingBenefits { referenceUses: number }
export interface YorktownBenefits { deploymentChecks: number }

export const noDebateBenefits: Readonly<DebateBenefits> = Object.freeze({ crowdBonus: 0, attackRecovery: 0 });
export const noWritingBenefits: Readonly<WritingBenefits> = Object.freeze({ referenceUses: 0 });
export const noYorktownBenefits: Readonly<YorktownBenefits> = Object.freeze({ deploymentChecks: 0 });
