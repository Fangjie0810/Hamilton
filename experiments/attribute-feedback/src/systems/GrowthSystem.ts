import type { GameState } from '../core/GameState';
import { growthThresholds as threshold, type DebateBenefits, type WritingBenefits, type YorktownBenefits } from '../data/growth';

/** Copy these benefits when an activity begins; later rewards never feed back into that activity. */
export function growthBenefits(state: GameState): { debate: DebateBenefits; writing: WritingBenefits; yorktown: YorktownBenefits } {
  return {
    debate: {
      crowdBonus: state.influence >= threshold.influenceCrowdHigh ? 10 : state.influence >= threshold.influenceCrowd ? 5 : 0,
      attackRecovery: state.momentum >= threshold.momentumRecovery ? 1 : 0,
    },
    writing: { referenceUses: state.washingtonTrust >= threshold.trustReference ? 1 : 0 },
    yorktown: { deploymentChecks: state.washingtonTrust >= threshold.trustDeployment ? 1 : 0 },
  };
}
