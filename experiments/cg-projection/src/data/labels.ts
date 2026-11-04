import { bi, type BiText } from '../i18n/text';
import type { BeatGrade } from '../systems/TimingSystem';

export const beatGradeNames: Record<BeatGrade, BiText> = {
  PERFECT: bi('完美', 'PERFECT'),
  GOOD: bi('良好', 'GOOD'),
  MISS: bi('失拍', 'MISS'),
};
