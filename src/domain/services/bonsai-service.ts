import { BonsaiState, CompanionType } from '../models/types';
import { getTodayString } from '../utils/date';

export const BONSAI_STAGE_THRESHOLDS = [0, 50, 150, 350, 750] as const;

export const BONSAI_STAGE_NAMES: Record<number, string> = {
  0: 'Seedling',
  1: 'Sprout',
  2: 'Sapling',
  3: 'Cultivated',
  4: 'Ancient',
};

export interface CompanionMeta {
  id: CompanionType;
  name: string;
  species: string;
  emoji: string;
  tagline: string;
  stages: Record<number, string>;
}

export const COMPANIONS: Record<CompanionType, CompanionMeta> = {
  bonsai: {
    id: 'bonsai',
    name: 'Bonsai',
    species: 'Zen Tree',
    emoji: '🪴',
    tagline: 'Rooted patience and quiet strength. Blossoms with your focused work.',
    stages: {
      0: 'Seedling',
      1: 'Sprout',
      2: 'Sapling',
      3: 'Cultivated',
      4: 'Ancient',
    },
  },
  cat: {
    id: 'cat',
    name: 'Neko',
    species: 'Mindful Feline',
    emoji: '🐱',
    tagline: 'Warm purrs and relaxed focus. Loves deep stretches and cozy naps.',
    stages: {
      0: 'Sleepy Kitten',
      1: 'Playful Cat',
      2: 'Cozy Companion',
      3: 'Zen Feline',
      4: 'Guardian Spirit',
    },
  },
  owl: {
    id: 'owl',
    name: 'Strix',
    species: 'Scholar Owl',
    emoji: '🦉',
    tagline: 'Deep perception and nighttime calm. Sees clearly through complex graph webs.',
    stages: {
      0: 'Owlet',
      1: 'Fledgling',
      2: 'Keen Owl',
      3: 'Scholar Owl',
      4: 'Celestial Sage',
    },
  },
  fox: {
    id: 'fox',
    name: 'Kitsune',
    species: 'Swift Fox',
    emoji: '🦊',
    tagline: 'Agile explorer and clever sparks. Thrives on research spikes and bold trials.',
    stages: {
      0: 'Little Kit',
      1: 'Swift Fox',
      2: 'Clever Fox',
      3: 'Spirit Fox',
      4: 'Mystic Fox',
    },
  },
  turtle: {
    id: 'turtle',
    name: 'Kappa',
    species: 'Steadfast Tortoise',
    emoji: '🐢',
    tagline: 'Unstoppable consistency. Reminds you that slow is smooth, and smooth is fast.',
    stages: {
      0: 'Hatchling',
      1: 'Little Turtle',
      2: 'Shelled Wanderer',
      3: 'Ancient Tortoise',
      4: 'World Turtle',
    },
  },
};

export const DEFAULT_BONSAI_STATE: BonsaiState = {
  companionType: 'bonsai',
  growthPoints: 0,
  stage: 0,
  leavesCount: 3,
  blossomCount: 0,
  recentProjectColors: [],
  lastWateredDate: '',
};

export class BonsaiService {
  /**
   * Returns human-readable name of the companion stage.
   */
  public static getStageName(stage: number, companionType?: CompanionType): string {
    const type = companionType || 'bonsai';
    const comp = COMPANIONS[type];
    return comp?.stages[stage] ?? BONSAI_STAGE_NAMES[stage] ?? 'Bonsai';
  }

  /**
   * Returns metadata for a given companion type.
   */
  public static getCompanionMeta(companionType?: CompanionType): CompanionMeta {
    return COMPANIONS[companionType || 'bonsai'] ?? COMPANIONS.bonsai;
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
      companionType: prev.companionType || 'bonsai',
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
