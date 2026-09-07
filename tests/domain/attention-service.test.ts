import { describe, it, expect } from 'vitest';
import {
  AttentionService,
  ActivityEvent,
  Node,
  ProjectSummary,
} from '../../src/domain';

describe('AttentionService - Attention Measurement System', () => {
  describe('Attention Unit (AU) Conversions and Formatting', () => {
    it('correctly converts seconds to AU with default 15m (900s = 1 AU)', () => {
      expect(AttentionService.durationSecondsToAU(0)).toBe(0);
      expect(AttentionService.durationSecondsToAU(-50)).toBe(0);
      expect(AttentionService.durationSecondsToAU(900)).toBe(1.0);
      expect(AttentionService.durationSecondsToAU(1800)).toBe(2.0);
      expect(AttentionService.durationSecondsToAU(450)).toBe(0.5);
      expect(AttentionService.durationSecondsToAU(3600)).toBe(4.0);
      expect(AttentionService.durationSecondsToAU(1350)).toBe(1.5);
    });

    it('supports user-customized AU duration (e.g., 25m Pomodoro or 30m)', () => {
      // 25 minutes = 1500 seconds
      expect(AttentionService.durationSecondsToAU(1500, 25)).toBe(1.0);
      expect(AttentionService.durationSecondsToAU(3000, 25)).toBe(2.0);
      expect(AttentionService.durationSecondsToAU(750, 25)).toBe(0.5);

      // 30 minutes = 1800 seconds
      expect(AttentionService.durationSecondsToAU(1800, 30)).toBe(1.0);
      expect(AttentionService.durationSecondsToAU(900, 30)).toBe(0.5);
    });

    it('formats AU into human-readable label with equivalent time', () => {
      expect(AttentionService.formatAU(0)).toBe('0 AU');
      expect(AttentionService.formatAU(1.0, 15)).toBe('1 AU (15m)');
      expect(AttentionService.formatAU(2.0, 15)).toBe('2 AU (30m)');
      expect(AttentionService.formatAU(4.0, 15)).toBe('4 AU (1h)');
      expect(AttentionService.formatAU(5.5, 15)).toBe('5.5 AU (1h 23m)');
      expect(AttentionService.formatAU(1.0, 25)).toBe('1 AU (25m)');
    });
  });

  describe('Event-Based Telemetry Session Reconstruction', () => {
    it('reconstructs completed work sessions from WORK_STARTED and WORK_STOPPED events', () => {
      const events: ActivityEvent[] = [
        {
          id: 'ev1',
          timestamp: '2026-09-07T10:00:00.000Z',
          type: 'WORK_STARTED',
          entityId: 'task-1',
          entityText: 'Write compiler backend',
          projectId: 'proj-1',
        },
        {
          id: 'ev2',
          timestamp: '2026-09-07T10:30:00.000Z',
          type: 'WORK_STOPPED',
          entityId: 'task-1',
          entityText: 'Write compiler backend',
          projectId: 'proj-1',
          metadata: { durationSeconds: 1800 },
        },
        {
          id: 'ev3',
          timestamp: '2026-09-07T11:00:00.000Z',
          type: 'WORK_STARTED',
          entityId: 'task-2',
          entityText: 'Fix memory leak',
        },
        {
          id: 'ev4',
          timestamp: '2026-09-07T11:15:00.000Z',
          type: 'WORK_STOPPED',
          entityId: 'task-2',
          entityText: 'Fix memory leak',
          metadata: { durationSeconds: 900 },
        },
      ];

      const sessions = AttentionService.reconstructWorkSessions(events, 15);
      expect(sessions).toHaveLength(2);

      expect(sessions[0].taskId).toBe('task-1');
      expect(sessions[0].projectId).toBe('proj-1');
      expect(sessions[0].durationSeconds).toBe(1800);
      expect(sessions[0].au).toBe(2.0);

      expect(sessions[1].taskId).toBe('task-2');
      expect(sessions[1].durationSeconds).toBe(900);
      expect(sessions[1].au).toBe(1.0);
    });

    it('handles pause and resume events in work sessions', () => {
      const events: ActivityEvent[] = [
        {
          id: 'p1',
          timestamp: '2026-09-07T14:00:00.000Z',
          type: 'WORK_STARTED',
          entityId: 'task-pause',
          entityText: 'Review PR',
        },
        {
          id: 'p2',
          timestamp: '2026-09-07T14:15:00.000Z', // 15 min worked
          type: 'WORK_PAUSED',
          entityId: 'task-pause',
        },
        {
          id: 'p3',
          timestamp: '2026-09-07T14:30:00.000Z', // 15 min paused (idle)
          type: 'WORK_RESUMED',
          entityId: 'task-pause',
        },
        {
          id: 'p4',
          timestamp: '2026-09-07T14:45:00.000Z', // 15 min worked
          type: 'WORK_STOPPED',
          entityId: 'task-pause',
          metadata: { durationSeconds: 1800 }, // Total 30 min worked
        },
      ];

      const sessions = AttentionService.reconstructWorkSessions(events, 15);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].durationSeconds).toBe(1800);
      expect(sessions[0].au).toBe(2.0);
    });
  });

  describe('Attention Performance (Actual vs Estimated)', () => {
    it('calculates estimation accuracy ratio correctly', () => {
      // Accurate: 4 AU estimated, 4 AU actual -> 1.0x
      const acc = AttentionService.calculateAttentionRatio(4.0, 4.0);
      expect(acc.ratio).toBe(1.0);
      expect(acc.status).toBe('accurate');

      // Overestimated: 4 AU estimated, 2 AU actual -> 0.5x
      const over = AttentionService.calculateAttentionRatio(4.0, 2.0);
      expect(over.ratio).toBe(0.5);
      expect(over.status).toBe('overestimated');

      // Underestimated: 2 AU estimated, 4 AU actual -> 2.0x
      const under = AttentionService.calculateAttentionRatio(2.0, 4.0);
      expect(under.ratio).toBe(2.0);
      expect(under.status).toBe('underestimated');

      // No estimate
      const none = AttentionService.calculateAttentionRatio(undefined, 3.0);
      expect(none.ratio).toBeNull();
      expect(none.status).toBe('no_estimate');
    });

    it('strictly separates actual attention AU from elapsed calendar duration', () => {
      // Task created 7 days ago, but only worked on for 15 minutes (1.0 AU)
      const events: ActivityEvent[] = [
        {
          id: 'ev-start',
          timestamp: '2026-09-07T12:00:00.000Z',
          type: 'WORK_STARTED',
          entityId: 'task-long-span',
        },
        {
          id: 'ev-stop',
          timestamp: '2026-09-07T12:15:00.000Z',
          type: 'WORK_STOPPED',
          entityId: 'task-long-span',
          metadata: { durationSeconds: 900 },
        },
      ];

      const summary = AttentionService.getTaskAttentionSummary(
        'task-long-span',
        events,
        {
          createdAt: '2026-08-31T12:00:00.000Z', // 7 days prior
          completedAt: '2026-09-07T12:15:00.000Z',
          estimatedAU: 2.0,
          text: 'Long calendar task',
        },
        15
      );

      // Actual attention is only 1.0 AU (15 min)
      expect(summary.actualSeconds).toBe(900);
      expect(summary.actualAU).toBe(1.0);
      expect(summary.sessionCount).toBe(1);

      // Calendar duration is 7 days (~168.3 hours)
      expect(summary.calendarSpanDays).toBeCloseTo(7.0, 0);
      expect(summary.calendarDurationHours).toBeGreaterThan(160);

      // Performance ratio: 1.0 actual / 2.0 estimated = 0.5x (overestimated)
      expect(summary.estimationRatio).toBe(0.5);
      expect(summary.estimationStatus).toBe('overestimated');
    });
  });

  describe('Weekly Attention Review & Deterministic Pattern Engine', () => {
    const mockProjects: ProjectSummary[] = [
      {
        id: 'proj-alpha',
        name: 'Project Alpha',
        endGoalText: 'Deliver Alpha MVP',
        deadline: '2026-09-30',
        tags: ['core'],
        status: 'active',
        isArchived: false,
        isParked: false,
        isAttention: true,
        progressPercentage: 50,
        activeTaskCount: 2,
        totalTaskCount: 4,
        completedTaskCount: 2,
        abandonedTaskCount: 0,
        updatedAt: '2026-09-07T10:00:00.000Z',
      },
    ];

    const mockTasks: Node[] = [
      {
        id: 'task-a1',
        projectId: 'proj-alpha',
        text: 'Core architecture design',
        dueDate: '2026-09-05',
        status: 'completed',
        estimatedAU: 4.0,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-05T00:00:00.000Z',
      },
      {
        id: 'task-a2',
        projectId: 'proj-alpha',
        text: 'Write unit tests',
        dueDate: '2026-09-06',
        status: 'in_progress',
        estimatedAU: 2.0,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
      },
    ];

    it('aggregates project allocations and top tasks for a weekly window', () => {
      const events: ActivityEvent[] = [
        {
          id: 'e1',
          timestamp: '2026-09-02T10:00:00.000Z',
          type: 'WORK_STARTED',
          entityId: 'task-a1',
          projectId: 'proj-alpha',
        },
        {
          id: 'e2',
          timestamp: '2026-09-02T11:00:00.000Z',
          type: 'WORK_STOPPED',
          entityId: 'task-a1',
          projectId: 'proj-alpha',
          metadata: { durationSeconds: 3600 }, // 4 AU (60 min)
        },
      ];

      const review = AttentionService.generateWeeklyAttentionReview({
        events,
        tasks: mockTasks,
        projects: mockProjects,
        weekStartDate: '2026-09-01',
        weekEndDate: '2026-09-07',
        plannedAU: 20,
        auMinutes: 15,
      });

      expect(review.trackedAU).toBe(4.0);
      expect(review.plannedAU).toBe(20);
      expect(review.sessionCount).toBe(1);

      expect(review.projectAllocations).toHaveLength(1);
      expect(review.projectAllocations[0].projectId).toBe('proj-alpha');
      expect(review.projectAllocations[0].au).toBe(4.0);
      expect(review.projectAllocations[0].percentage).toBe(100);

      expect(review.topTasksByAttention).toHaveLength(1);
      expect(review.topTasksByAttention[0].taskId).toBe('task-a1');
      expect(review.topTasksByAttention[0].au).toBe(4.0);
    });

    it('detects repeated postponement with alternate activity using transparent rule', () => {
      const events: ActivityEvent[] = [
        // 2 deferrals on task-postponed
        {
          id: 'd1',
          timestamp: '2026-09-02T08:00:00.000Z',
          type: 'TASK_DEFERRED',
          entityId: 'task-postponed',
          entityText: 'Write tax report',
        },
        {
          id: 'd2',
          timestamp: '2026-09-04T08:00:00.000Z',
          type: 'TASK_DEFERRED',
          entityId: 'task-postponed',
          entityText: 'Write tax report',
        },
        // 6 AU logged on other task
        {
          id: 'w1',
          timestamp: '2026-09-03T10:00:00.000Z',
          type: 'WORK_STARTED',
          entityId: 'task-other',
          entityText: 'Build UI widgets',
        },
        {
          id: 'w2',
          timestamp: '2026-09-03T11:30:00.000Z',
          type: 'WORK_STOPPED',
          entityId: 'task-other',
          entityText: 'Build UI widgets',
          metadata: { durationSeconds: 5400 }, // 6 AU
        },
      ];

      const review = AttentionService.generateWeeklyAttentionReview({
        events,
        tasks: [
          {
            id: 'task-postponed',
            text: 'Write tax report',
            dueDate: '2026-09-06',
            status: 'planned',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-04T00:00:00.000Z',
          },
          {
            id: 'task-other',
            text: 'Build UI widgets',
            dueDate: '2026-09-03',
            status: 'completed',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-03T00:00:00.000Z',
          },
        ],
        projects: [],
        weekStartDate: '2026-09-01',
        weekEndDate: '2026-09-07',
        auMinutes: 15,
      });

      const postponementObs = review.patternObservations.find((p) =>
        p.id.startsWith('postponement_')
      );

      expect(postponementObs).toBeDefined();
      expect(postponementObs?.title).toContain('Possible Procrastination Pattern');
      expect(postponementObs?.description).toContain('postponed 2 times while 6 AU');
      expect(postponementObs?.ruleExplanation).toBe(
        'Triggered when deferredCount >= 2 AND otherTasksTrackedAU >= 4.0 AU.'
      );
      expect(postponementObs?.tone).toBe('neutral');
    });
  });

  describe('formatMinutes and Parent Node AU Invariant (syncParentEstimatedAU)', () => {
    it('formats minutes into human-readable strings', () => {
      expect(AttentionService.formatMinutes(0)).toBe('0m');
      expect(AttentionService.formatMinutes(-10)).toBe('0m');
      expect(AttentionService.formatMinutes(15)).toBe('15m');
      expect(AttentionService.formatMinutes(45)).toBe('45m');
      expect(AttentionService.formatMinutes(60)).toBe('1h');
      expect(AttentionService.formatMinutes(90)).toBe('1h 30m');
      expect(AttentionService.formatMinutes(150)).toBe('2h 30m');
    });

    it('enforces parent AU equals sum of direct children AU', () => {
      const parentNode: Node = {
        id: 'parent-1',
        projectId: 'proj-1',
        text: 'Parent Task',
        status: 'planned',
        dueDate: '2026-09-10',
        parentNodeId: null,
        position: { x: 0, y: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 999, // stale or invalid estimate
      };

      const child1: Node = {
        id: 'child-1',
        projectId: 'proj-1',
        text: 'Subtask 1',
        status: 'planned',
        dueDate: '2026-09-08',
        parentNodeId: 'parent-1',
        position: { x: 50, y: 50 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 2.0,
      };

      const child2: Node = {
        id: 'child-2',
        projectId: 'proj-1',
        text: 'Subtask 2',
        status: 'planned',
        dueDate: '2026-09-09',
        parentNodeId: 'parent-1',
        position: { x: 50, y: 100 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 1.5,
      };

      const synced = AttentionService.syncParentEstimatedAU([parentNode, child1, child2]);
      const syncedParent = synced.find((n) => n.id === 'parent-1');
      expect(syncedParent?.estimatedAU).toBe(3.5); // 2.0 + 1.5
    });

    it('handles recursive multi-level hierarchy (grandparent -> parent -> child)', () => {
      const grandParent: Node = {
        id: 'grandparent',
        projectId: 'proj-1',
        text: 'Epic Feature',
        status: 'planned',
        dueDate: '2026-09-15',
        parentNodeId: null,
        position: { x: 0, y: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      const parent1: Node = {
        id: 'p1',
        projectId: 'proj-1',
        text: 'Backend',
        status: 'planned',
        dueDate: '2026-09-12',
        parentNodeId: 'grandparent',
        position: { x: 0, y: 50 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      const sub1: Node = {
        id: 's1',
        projectId: 'proj-1',
        text: 'Database schema',
        status: 'planned',
        dueDate: '2026-09-10',
        parentNodeId: 'p1',
        position: { x: 0, y: 100 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 2.0,
      };

      const sub2: Node = {
        id: 's2',
        projectId: 'proj-1',
        text: 'API endpoints',
        status: 'planned',
        dueDate: '2026-09-11',
        parentNodeId: 'p1',
        position: { x: 0, y: 150 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 3.0,
      };

      const parent2: Node = {
        id: 'p2',
        projectId: 'proj-1',
        text: 'Frontend',
        status: 'planned',
        dueDate: '2026-09-14',
        parentNodeId: 'grandparent',
        position: { x: 50, y: 50 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 4.0, // direct leaf parent with no subtasks
      };

      const synced = AttentionService.syncParentEstimatedAU([grandParent, parent1, sub1, sub2, parent2]);
      const syncedP1 = synced.find((n) => n.id === 'p1');
      const syncedGrandparent = synced.find((n) => n.id === 'grandparent');

      expect(syncedP1?.estimatedAU).toBe(5.0); // 2.0 + 3.0
      expect(syncedGrandparent?.estimatedAU).toBe(9.0); // 5.0 (p1) + 4.0 (p2)
    });

    it('sets parent AU to undefined if all children have undefined AU', () => {
      const parentNode: Node = {
        id: 'parent-undef',
        projectId: 'proj-1',
        text: 'Parent Task',
        status: 'planned',
        dueDate: '2026-09-10',
        parentNodeId: null,
        position: { x: 0, y: 0 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 5.0, // should become undefined because no child has an AU
      };

      const child1: Node = {
        id: 'c1',
        projectId: 'proj-1',
        text: 'Subtask without estimate',
        status: 'planned',
        dueDate: '2026-09-09',
        parentNodeId: 'parent-undef',
        position: { x: 0, y: 50 },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };

      const synced = AttentionService.syncParentEstimatedAU([parentNode, child1]);
      const syncedParent = synced.find((n) => n.id === 'parent-undef');
      expect(syncedParent?.estimatedAU).toBeUndefined();
    });
  });
});
