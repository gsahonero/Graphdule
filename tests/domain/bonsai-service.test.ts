import { describe, it, expect } from 'vitest';
import { BonsaiService, DEFAULT_BONSAI_STATE } from '../../src/domain/services/bonsai-service';
import { BonsaiState } from '../../src/domain/models/types';

describe('BonsaiService', () => {
  it('calculates correct stages based on growth points', () => {
    expect(BonsaiService.calculateStage(0)).toBe(0);
    expect(BonsaiService.calculateStage(49)).toBe(0);
    expect(BonsaiService.calculateStage(50)).toBe(1);
    expect(BonsaiService.calculateStage(149)).toBe(1);
    expect(BonsaiService.calculateStage(150)).toBe(2);
    expect(BonsaiService.calculateStage(349)).toBe(2);
    expect(BonsaiService.calculateStage(350)).toBe(3);
    expect(BonsaiService.calculateStage(749)).toBe(3);
    expect(BonsaiService.calculateStage(750)).toBe(4);
    expect(BonsaiService.calculateStage(10000)).toBe(4);
  });

  it('provides correct stage names', () => {
    expect(BonsaiService.getStageName(0)).toBe('Seedling');
    expect(BonsaiService.getStageName(1)).toBe('Sprout');
    expect(BonsaiService.getStageName(2)).toBe('Sapling');
    expect(BonsaiService.getStageName(3)).toBe('Cultivated');
    expect(BonsaiService.getStageName(4)).toBe('Ancient');
  });

  it('calculates progress percentage towards next stage correctly', () => {
    // Stage 0: 0 to 50
    const p0 = BonsaiService.getProgressToNextStage(25);
    expect(p0.currentStage).toBe(0);
    expect(p0.stageProgressPercent).toBe(50);
    expect(p0.pointsToNext).toBe(25);

    // Stage 1: 50 to 150 (range 100)
    const p1 = BonsaiService.getProgressToNextStage(100);
    expect(p1.currentStage).toBe(1);
    expect(p1.stageProgressPercent).toBe(50);
    expect(p1.pointsToNext).toBe(50);

    // Stage 4: Ancient (max stage)
    const p4 = BonsaiService.getProgressToNextStage(800);
    expect(p4.currentStage).toBe(4);
    expect(p4.stageProgressPercent).toBe(100);
    expect(p4.pointsToNext).toBe(0);
  });

  it('grows monotonically when completing tasks with AU', () => {
    const initial = DEFAULT_BONSAI_STATE;
    const { nextState, pointsEarned, didAdvanceStage } = BonsaiService.calculateGrowth(
      initial,
      2.5, // 2.5 AU = 25 points
      'emerald',
      '2026-09-15'
    );

    expect(pointsEarned).toBe(25);
    expect(nextState.growthPoints).toBe(25);
    expect(nextState.stage).toBe(0);
    expect(didAdvanceStage).toBe(false);
    expect(nextState.blossomCount).toBe(1);
    expect(nextState.recentProjectColors).toEqual(['emerald']);
    expect(nextState.lastWateredDate).toBe('2026-09-15');
  });

  it('advances stage when threshold is reached', () => {
    const stateNearThreshold: BonsaiState = {
      growthPoints: 45,
      stage: 0,
      leavesCount: 4,
      blossomCount: 2,
      lastWateredDate: '2026-09-10',
    };

    const { nextState, didAdvanceStage } = BonsaiService.calculateGrowth(
      stateNearThreshold,
      1.0, // 10 points -> total 55 >= 50 (Stage 1: Sprout)
      'sky'
    );

    expect(nextState.growthPoints).toBe(55);
    expect(nextState.stage).toBe(1);
    expect(didAdvanceStage).toBe(true);
    expect(nextState.blossomCount).toBe(3);
    expect(nextState.recentProjectColors).toContain('sky');
  });

  it('strictly preserves monotonicity even if input has low AU or simulated zero activity', () => {
    const highState: BonsaiState = {
      growthPoints: 500,
      stage: 3,
      leavesCount: 23,
      blossomCount: 15,
      lastWateredDate: '2026-01-01',
    };

    const { nextState } = BonsaiService.calculateGrowth(highState, 0, 'indigo');
    // Monotonic invariants
    expect(nextState.growthPoints).toBeGreaterThanOrEqual(highState.growthPoints);
    expect(nextState.stage).toBeGreaterThanOrEqual(highState.stage);
    expect(nextState.leavesCount).toBeGreaterThanOrEqual(highState.leavesCount);
    expect(nextState.blossomCount).toBeGreaterThanOrEqual(highState.blossomCount);
  });
});
