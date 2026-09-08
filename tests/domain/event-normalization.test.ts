import { describe, it, expect } from 'vitest';
import {
  normalizeEventType,
  ActivityEventTypeSchema,
  ActivityEventSchema,
  CanonicalActivityEventTypeSchema,
} from '../../src/domain/models/schema';
import { ACTIVITY_EVENT_TYPES, ActivityEvent } from '../../src/domain/models/types';
import { ActivityLogService } from '../../src/domain/services/activity-log-service';
import { AttentionService } from '../../src/domain/services/attention-service';

describe('Event Type Normalization and Deduplication', () => {
  describe('normalizeEventType', () => {
    it('normalizes uppercase event names to lowercase snake_case', () => {
      expect(normalizeEventType('WORK_STARTED')).toBe('work_started');
      expect(normalizeEventType('WORK_STOPPED')).toBe('work_stopped');
      expect(normalizeEventType('WORK_PAUSED')).toBe('work_paused');
      expect(normalizeEventType('WORK_RESUMED')).toBe('work_resumed');
      expect(normalizeEventType('TASK_CREATED')).toBe('task_created');
      expect(normalizeEventType('TASK_COMPLETED')).toBe('task_completed');
      expect(normalizeEventType('TASK_ABANDONED')).toBe('task_abandoned');
      expect(normalizeEventType('ESTIMATE_CHANGED')).toBe('estimate_changed');
      expect(normalizeEventType('NODE_NESTED')).toBe('node_nested');
      expect(normalizeEventType('ATTENTION_SYSTEM_TOGGLED')).toBe('attention_system_toggled');
      expect(normalizeEventType('WEEKLY_GOAL_SET')).toBe('weekly_goal_set');
      expect(normalizeEventType('WEEKLY_REVIEW_TRIGGERED')).toBe('weekly_review_triggered');
    });

    it('normalizes legacy and alias deferral event types to date_moved', () => {
      expect(normalizeEventType('TASK_DEFERRED')).toBe('date_moved');
      expect(normalizeEventType('task_deferred')).toBe('date_moved');
      expect(normalizeEventType('DEADLINE_CHANGED')).toBe('date_moved');
      expect(normalizeEventType('deadline_changed')).toBe('date_moved');
      expect(normalizeEventType('date_moved')).toBe('date_moved');
    });

    it('handles extra whitespace cleanly', () => {
      expect(normalizeEventType('  WORK_STARTED  ')).toBe('work_started');
      expect(normalizeEventType(' task_created\n')).toBe('task_created');
    });

    it('preserves all canonical event types without change', () => {
      for (const type of ACTIVITY_EVENT_TYPES) {
        expect(normalizeEventType(type)).toBe(type);
      }
    });

    it('ensures ACTIVITY_EVENT_TYPES contains no duplicates', () => {
      const uniqueTypes = new Set(ACTIVITY_EVENT_TYPES);
      expect(uniqueTypes.size).toBe(ACTIVITY_EVENT_TYPES.length);
    });
  });

  describe('ActivityEventSchema Parsing & Normalization', () => {
    it('automatically normalizes uppercase type during schema parse', () => {
      const raw = {
        id: 'ev-test-1',
        timestamp: '2026-09-08T10:00:00.000Z',
        type: 'WORK_STARTED',
        entityId: 'node-1',
      };
      const parsed = ActivityEventSchema.parse(raw);
      expect(parsed.type).toBe('work_started');
    });

    it('automatically normalizes TASK_DEFERRED to date_moved during schema parse', () => {
      const raw = {
        id: 'ev-test-2',
        timestamp: '2026-09-08T10:00:00.000Z',
        type: 'TASK_DEFERRED',
        entityId: 'node-2',
      };
      const parsed = ActivityEventSchema.parse(raw);
      expect(parsed.type).toBe('date_moved');
    });

    it('normalizes via ActivityEventTypeSchema directly', () => {
      expect(ActivityEventTypeSchema.parse('WORK_STARTED')).toBe('work_started');
      expect(ActivityEventTypeSchema.parse('TASK_DEFERRED')).toBe('date_moved');
    });

    it('validates canonical types with CanonicalActivityEventTypeSchema', () => {
      expect(CanonicalActivityEventTypeSchema.options).toEqual(ACTIVITY_EVENT_TYPES);
    });

    it('rejects invalid unknown event types', () => {
      const raw = {
        id: 'ev-invalid',
        timestamp: '2026-09-08T10:00:00.000Z',
        type: 'something_completely_unknown',
        entityId: 'node-x',
      };
      expect(() => ActivityEventSchema.parse(raw)).toThrow();
    });
  });

  describe('ActivityLogService.createEvent', () => {
    it('creates event with normalized type even if passed uppercase or alias', () => {
      const ev1 = ActivityLogService.createEvent('WORK_STARTED', 'task-1');
      expect(ev1.type).toBe('work_started');

      const ev2 = ActivityLogService.createEvent('TASK_DEFERRED', 'task-2');
      expect(ev2.type).toBe('date_moved');

      const ev3 = ActivityLogService.createEvent('TASK_CREATED', {
        taskId: 'task-3',
        taskText: 'My Task',
      });
      expect(ev3.type).toBe('task_created');
    });
  });

  describe('ActivityLogService.deduplicateEvents', () => {
    it('eliminates events with identical IDs', () => {
      const ev: ActivityEvent = {
        id: 'dup-1',
        timestamp: '2026-09-08T10:00:00.000Z',
        type: 'task_created',
        entityId: 'task-1',
      };
      const deduped = ActivityLogService.deduplicateEvents([ev, ev, { ...ev }]);
      expect(deduped).toHaveLength(1);
    });

    it('eliminates near-simultaneous duplicate emissions and merges metadata', () => {
      // Scenario: old AppContext logging both task_created and TASK_CREATED at once
      const ev1: ActivityEvent = {
        id: 'act-1',
        timestamp: '2026-09-08T10:00:00.000Z',
        type: 'task_created',
        entityId: 'node-1',
        entityText: 'Important Feature',
        projectId: 'proj-1',
      };
      const ev2: ActivityEvent = {
        id: 'act-2',
        timestamp: '2026-09-08T10:00:00.005Z',
        type: 'TASK_CREATED' as any,
        entityId: 'node-1',
        entityText: 'Important Feature',
        projectId: 'proj-1',
        metadata: { estimatedAU: 3 },
      };

      const deduped = ActivityLogService.deduplicateEvents([ev1, ev2]);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].type).toBe('task_created');
      expect(deduped[0].entityId).toBe('node-1');
      expect(deduped[0].metadata).toEqual({ estimatedAU: 3 });
    });

    it('collapses simultaneous date_moved, TASK_DEFERRED, and DEADLINE_CHANGED into single date_moved', () => {
      const now = '2026-09-08T10:00:00.000Z';
      const ev1: ActivityEvent = {
        id: 'd1',
        timestamp: now,
        type: 'date_moved',
        entityId: 'node-10',
        oldDueDate: '2026-09-08',
        newDueDate: '2026-09-15',
      };
      const ev2: ActivityEvent = {
        id: 'd2',
        timestamp: '2026-09-08T10:00:00.002Z',
        type: 'TASK_DEFERRED' as any,
        entityId: 'node-10',
        oldDueDate: '2026-09-08',
        newDueDate: '2026-09-15',
      };
      const ev3: ActivityEvent = {
        id: 'd3',
        timestamp: '2026-09-08T10:00:00.004Z',
        type: 'DEADLINE_CHANGED' as any,
        entityId: 'node-10',
        oldDueDate: '2026-09-08',
        newDueDate: '2026-09-15',
      };

      const deduped = ActivityLogService.deduplicateEvents([ev1, ev2, ev3]);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].type).toBe('date_moved');
      expect(deduped[0].newDueDate).toBe('2026-09-15');
    });

    it('preserves distinct work sessions with different session IDs', () => {
      const ev1: ActivityEvent = {
        id: 'ws-1',
        timestamp: '2026-09-08T10:00:00.000Z',
        type: 'work_stopped',
        entityId: 'task-1',
        metadata: { sessionId: 'sess-A', durationSeconds: 600 },
      };
      const ev2: ActivityEvent = {
        id: 'ws-2',
        timestamp: '2026-09-08T10:00:01.000Z',
        type: 'work_stopped',
        entityId: 'task-1',
        metadata: { sessionId: 'sess-B', durationSeconds: 900 },
      };

      const deduped = ActivityLogService.deduplicateEvents([ev1, ev2]);
      expect(deduped).toHaveLength(2);
    });
  });

  describe('Backward Compatibility in AttentionService', () => {
    it('reconstructs work sessions even if raw events contain legacy uppercase types', () => {
      const legacyEvents: ActivityEvent[] = [
        {
          id: 'l1',
          timestamp: '2026-09-08T10:00:00.000Z',
          type: 'WORK_STARTED' as any,
          entityId: 'task-legacy',
        },
        {
          id: 'l2',
          timestamp: '2026-09-08T10:30:00.000Z',
          type: 'WORK_STOPPED' as any,
          entityId: 'task-legacy',
          metadata: { durationSeconds: 1800 },
        },
      ];

      const sessions = AttentionService.reconstructWorkSessions(legacyEvents, 15);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].durationSeconds).toBe(1800);
      expect(sessions[0].au).toBe(2.0);
    });
  });
});
