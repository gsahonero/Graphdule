import { describe, it, expect } from 'vitest';
import { ProjectService } from '../../src/domain/services/project-service';
import { BonsaiService, DEFAULT_BONSAI_STATE } from '../../src/domain/services/bonsai-service';
import { ProjectHealthService } from '../../src/domain/services/project-health-service';
import { AttentionService } from '../../src/domain/services/attention-service';
import { Node, Edge, ActiveWorkSession } from '../../src/domain/models/types';

describe('Cognitive Support End-to-End Lifecycle', () => {
  it('orchestrates complete cycle: spike planning -> execution -> AU calibration -> Bonsai growth -> recovery', () => {
    // 1. Create a project document with a standard task and a spike exploration node
    const { project } = ProjectService.createProject('Autonomous Cognitive Engine', 'Deep research & prototype', '2026-10-01');
    const rootSpike = ProjectService.createNode(
      project.id,
      'Spike: Benchmark Attention Estimators',
      '2026-09-15',
      null,
      { x: 100, y: 100 },
      1.5,
      'computer',
      'high',
      'spike'
    );
    const downstreamTask = ProjectService.createNode(
      project.id,
      'Implement Production Dispatcher',
      '2026-09-20',
      null,
      { x: 400, y: 100 },
      3.0,
      'computer',
      'medium',
      'standard'
    );

    const edge: Edge = {
      id: 'e1',
      projectId: project.id,
      fromNodeId: rootSpike.id,
      toNodeId: downstreamTask.id,
      createdAt: '2026-09-15T00:00:00.000Z',
    };

    const nodes: Node[] = [rootSpike, downstreamTask];
    const edges: Edge[] = [edge];

    // 2. Frontier detection: rootSpike is the only frontier because downstreamTask is blocked
    const initialFrontier = ProjectHealthService.getFrontierNodes(nodes, edges);
    expect(initialFrontier.map((n) => n.id)).toEqual([rootSpike.id]);

    const initialHealth = ProjectHealthService.evaluateProjectHealth(
      nodes,
      edges,
      [],
      '2026-09-15',
      project.id
    );
    expect(initialHealth.health).toBe('flowing');

    // 3. Start work session on rootSpike
    const workSession: ActiveWorkSession = {
      sessionId: 'sess-spike-1',
      taskId: rootSpike.id,
      taskText: rootSpike.text,
      projectId: project.id,
      sessionType: 'execution',
      startedAt: '2026-09-15T10:00:00.000Z',
      accumulatedSecondsBeforeResume: 0,
      isPaused: false,
    };
    expect(workSession.sessionType).toBe('execution');

    // 4. Simulate completing task after 45 minutes of focus
    const elapsedMinutes = 45;
    const attentionUnitMinutes = 25; // 45m / 25m = 1.8 AU
    const actualAU = AttentionService.minutesToAU(elapsedMinutes, attentionUnitMinutes);
    expect(actualAU).toBe(1.8);

    // AU Calibration: Predicted 1.5 AU vs Actual 1.8 AU
    const predictedAU = rootSpike.estimatedAU;
    expect(predictedAU).toBe(1.5);
    const calibrationDelta = Number((actualAU - (predictedAU ?? 0)).toFixed(1));
    expect(calibrationDelta).toBe(0.3);

    // 5. Bonsai Growth Reflection
    const initialBonsai = DEFAULT_BONSAI_STATE;
    const { nextState: updatedBonsai, pointsEarned, didAdvanceStage } = BonsaiService.calculateGrowth(
      initialBonsai,
      actualAU,
      'emerald',
      '2026-09-15'
    );

    // 1.8 AU -> 18 points
    expect(pointsEarned).toBe(18);
    expect(updatedBonsai.growthPoints).toBe(18);
    expect(updatedBonsai.stage).toBe(0);
    expect(didAdvanceStage).toBe(false);
    expect(updatedBonsai.blossomCount).toBe(1);
    expect(updatedBonsai.recentProjectColors).toContain('emerald');

    // 6. Complete rootSpike and advance DAG frontier
    const completedSpike: Node = { ...rootSpike, status: 'completed' };
    const updatedNodes = [completedSpike, downstreamTask];

    const updatedFrontier = ProjectHealthService.getFrontierNodes(updatedNodes, edges);
    // Frontier automatically unblocked downstreamTask!
    expect(updatedFrontier.map((n) => n.id)).toEqual([downstreamTask.id]);

    // 7. Transition to Intentional Recovery session (30 min break)
    const recoverySession: ActiveWorkSession = {
      sessionId: 'rec-1',
      taskId: 'intentional-recovery',
      taskText: 'Recovery Break (30m)',
      sessionType: 'recovery',
      startedAt: '2026-09-15T10:45:00.000Z',
      accumulatedSecondsBeforeResume: 0,
      isPaused: false,
    };
    expect(recoverySession.sessionType).toBe('recovery');
  });
});
