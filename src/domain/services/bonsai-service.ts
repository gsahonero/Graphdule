import { BonsaiState } from '../models/types';
import { getTodayString } from '../utils/date';

export const BONSAI_STAGE_THRESHOLDS = [0, 50, 150, 350, 750] as const;

export const BONSAI_STAGE_NAMES: Record<number, string> = {
  0: 'Seedling',
  1: 'Sprout',
  2: 'Sapling',
  3: 'Cultivated',
  4: 'Ancient',
};

export const DEFAULT_BONSAI_STATE: BonsaiState = {
  growthPoints: 0,
  stage: 0,
  leavesCount: 3,
  blossomCount: 0,
  recentProjectColors: [],
  lastWateredDate: '',
};

export class BonsaiService {
  /**
   * Returns human-readable name of the bonsai stage.
   */
  public static getStageName(stage: number): string {
    return BONSAI_STAGE_NAMES[stage] ?? 'Bonsai';
  }

  /**
   * Calculates the stage (0 to 4) corresponding to a given point total.
   */
  public static calculateStage(growthPoints: number): number {
    if (growthPoints >= BONSAI_STAGE_THRESHOLDS[4]) return 4;
    if (growthPoints >= BONSAI_STAGE_THRESHOLDS[3]) return 3;
    if (growthPoints >= BONSAI_STAGE_THRESHOLDS[2]) return 2;
    if (growthPoints >= BONSAI_STAGE_THRESHOLDS[1]) return 1;
    return 0;
  }

  /**
   * Calculates the progress percentage towards the next stage.
   */
  public static getProgressToNextStage(growthPoints: number): {
    currentStage: number;
    stageProgressPercent: number;
    pointsToNext: number;
  } {
    const stage = this.calculateStage(growthPoints);
    if (stage >= 4) {
      return {
        currentStage: 4,
        stageProgressPercent: 100,
        pointsToNext: 0,
      };
    }

    const currentMin = BONSAI_STAGE_THRESHOLDS[stage];
    const nextMin = BONSAI_STAGE_THRESHOLDS[stage + 1];
    const range = nextMin - currentMin;
    const progress = Math.max(0, growthPoints - currentMin);
    const percent = Math.min(100, Math.round((progress / range) * 100));

    return {
      currentStage: stage,
      stageProgressPercent: percent,
      pointsToNext: Math.max(0, nextMin - growthPoints),
    };
  }

  /**
   * Monotonically grows the Bonsai based on completed AU and project context.
   * Growth is strictly additive; inactivity never causes shrinkage or penalty.
   */
  public static calculateGrowth(
    current: BonsaiState | undefined,
    completedAU: number,
    projectColor?: string,
    today: string = getTodayString()
  ): { nextState: BonsaiState; pointsEarned: number; didAdvanceStage: boolean } {
    const prev: BonsaiState = current || DEFAULT_BONSAI_STATE;

    // 1 AU = 10 points. Minimum 1 point for any completed task.
    const au = Math.max(0, completedAU);
    const pointsEarned = Math.max(1, Math.round(au * 10));
    const nextPoints = prev.growthPoints + pointsEarned;

    // Strictly monotonic stage calculation
    const calculatedStage = this.calculateStage(nextPoints);
    const nextStage = Math.max(prev.stage, calculatedStage);
    const didAdvanceStage = nextStage > prev.stage;

    // Leaves scale with points: 3 base + 1 per 25 pts, up to 35
    const computedLeaves = Math.min(35, 3 + Math.floor(nextPoints / 25));
    const nextLeaves = Math.max(prev.leavesCount, computedLeaves);

    // Blossom count increments with each completed focused task
    const nextBlossoms = prev.blossomCount + 1;

    // Retain up to 5 unique recent project colors for foliage tinting
    let updatedColors = [...(prev.recentProjectColors || [])];
    if (projectColor && typeof projectColor === 'string') {
      updatedColors = [projectColor, ...updatedColors.filter((c) => c !== projectColor)].slice(0, 5);
    }

    const nextState: BonsaiState = {
      growthPoints: nextPoints,
      stage: nextStage,
      leavesCount: nextLeaves,
      blossomCount: nextBlossoms,
      recentProjectColors: updatedColors,
      lastWateredDate: today,
    };

    return { nextState, pointsEarned, didAdvanceStage };
  }
}
