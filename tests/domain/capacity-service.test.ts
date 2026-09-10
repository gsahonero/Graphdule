import { describe, it, expect } from 'vitest';
import {
  CapacityService,
  DEFAULT_WORK_SCHEDULE,
  DEFAULT_CAPACITY_CONFIG,
  DailyCapacitySnapshot,
} from '../../src/domain';

describe('CapacityService - Daily AU Capacity & Calendar Reality Check', () => {
  describe('calculateCalendarAvailability', () => {
    // 2026-09-07 is a Monday (day 1)
    const monday = '2026-09-07';
    // 2026-09-12 is a Saturday (day 6)
    const saturday = '2026-09-12';

    it('returns full work day capacity when calendar has no events', () => {
      // 9:00 to 17:00 is 8 hours = 480 minutes
      // 480 / 15 = 32 AU
      const res = CapacityService.calculateCalendarAvailability([], DEFAULT_WORK_SCHEDULE, 15, monday);

      expect(res.totalWorkMinutes).toBe(480);
      expect(res.occupiedMinutes).toBe(0);
      expect(res.remainingMinutes).toBe(480);
      expect(res.availableAU).toBe(32);
    });

    it('subtracts non-overlapping calendar events within work hours', () => {
      const events = [
        {
          start: '2026-09-07T10:00:00',
          end: '2026-09-07T11:00:00', // 60 min
        },
        {
          start: '2026-09-07T14:00:00',
          end: '2026-09-07T15:30:00', // 90 min
        },
      ];

      const res = CapacityService.calculateCalendarAvailability(events, DEFAULT_WORK_SCHEDULE, 15, monday);

      expect(res.totalWorkMinutes).toBe(480);
      expect(res.occupiedMinutes).toBe(150); // 60 + 90
      expect(res.remainingMinutes).toBe(330);
      // 330 / 15 = 22 AU
      expect(res.availableAU).toBe(22);
    });

    it('merges overlapping events so no time window is double-subtracted', () => {
      const events = [
        {
          start: '2026-09-07T10:00:00',
          end: '2026-09-07T11:30:00', // 10:00 - 11:30 (90 min)
        },
        {
          start: '2026-09-07T11:00:00',
          end: '2026-09-07T12:00:00', // 11:00 - 12:00 (overlaps by 30 min)
        },
      ];

      const res = CapacityService.calculateCalendarAvailability(events, DEFAULT_WORK_SCHEDULE, 15, monday);

      // Merged range: 10:00 - 12:00 = 120 minutes (not 150)
      expect(res.occupiedMinutes).toBe(120);
      expect(res.remainingMinutes).toBe(360);
      // 360 / 15 = 24 AU
      expect(res.availableAU).toBe(24);
    });

    it('clamps events that start before or end after work schedule hours', () => {
      const events = [
        {
          start: '2026-09-07T08:00:00', // 1 hour before 9:00 start
          end: '2026-09-07T10:00:00',   // ends at 10:00 -> 60 min inside work hours
        },
        {
          start: '2026-09-07T16:30:00', // ends at 18:00 (1 hour after 17:00 end)
          end: '2026-09-07T18:00:00',   // -> 30 min inside work hours
        },
      ];

      const res = CapacityService.calculateCalendarAvailability(events, DEFAULT_WORK_SCHEDULE, 15, monday);

      // Only 60 + 30 = 90 min count
      expect(res.occupiedMinutes).toBe(90);
      expect(res.remainingMinutes).toBe(390);
      expect(res.availableAU).toBe(26);
    });

    it('handles all-day events by occupying the entire workday', () => {
      const events = [
        {
          start: '2026-09-07',
          end: '2026-09-07',
          allDay: true,
        },
      ];

      const res = CapacityService.calculateCalendarAvailability(events, DEFAULT_WORK_SCHEDULE, 15, monday);

      expect(res.occupiedMinutes).toBe(480);
      expect(res.remainingMinutes).toBe(0);
      expect(res.availableAU).toBe(0);
    });

    it('returns 0 available AU and 0 work minutes on non-work days', () => {
      const res = CapacityService.calculateCalendarAvailability([], DEFAULT_WORK_SCHEDULE, 15, saturday);

      expect(res.totalWorkMinutes).toBe(0);
      expect(res.occupiedMinutes).toBe(0);
      expect(res.remainingMinutes).toBe(0);
      expect(res.availableAU).toBe(0);
    });

    it('supports custom minutesPerAU configuration (e.g. 25m Pomodoro)', () => {
      // 480 minutes total, 25 min/AU -> 19.2 AU
      const res = CapacityService.calculateCalendarAvailability([], DEFAULT_WORK_SCHEDULE, 25, monday);

      expect(res.totalWorkMinutes).toBe(480);
      expect(res.availableAU).toBe(19.2);
    });
  });

  describe('calculatePlannedAU and calculateRealizedAU', () => {
    const tasks = [
      { dueDate: '2026-09-07', status: 'pending', estimatedAU: 6 },
      { dueDate: '2026-09-07', status: 'in_progress', estimatedAU: 4.5 },
      { dueDate: '2026-09-07', status: 'completed', estimatedAU: 5.5 },
      { dueDate: '2026-09-07', status: 'abandoned', estimatedAU: 8 }, // should be ignored
      { dueDate: '2026-09-08', status: 'pending', estimatedAU: 10 },   // different date
    ];

    it('sums planned AU for all non-abandoned tasks on date', () => {
      const planned = CapacityService.calculatePlannedAU(tasks, '2026-09-07');
      // 6 + 4.5 + 5.5 = 16
      expect(planned).toBe(16);
    });

    it('sums realized AU only for completed tasks on date', () => {
      const realized = CapacityService.calculateRealizedAU(tasks, '2026-09-07');
      // only completed: 5.5
      expect(realized).toBe(5.5);
    });

    it('returns 0 when no tasks match date', () => {
      expect(CapacityService.calculatePlannedAU(tasks, '2026-09-10')).toBe(0);
      expect(CapacityService.calculateRealizedAU(tasks, '2026-09-10')).toBe(0);
    });
  });

  describe('estimateExpectedCapacity', () => {
    it('returns default capacity with 0 confidence when no historical snapshots exist', () => {
      const res = CapacityService.estimateExpectedCapacity([], 1, 20);

      expect(res.expectedAU).toBe(20);
      expect(res.confidence).toBe(0);
      expect(res.sampleCount).toBe(0);
    });

    it('calculates average realized AU and confidence based on historical snapshots for weekday', () => {
      const snapshots: DailyCapacitySnapshot[] = [
        // Monday snapshots with realizedAU
        {
          id: 's1',
          date: '2026-08-17', // Monday
          timestamp: '2026-08-17T18:00:00Z',
          expectedCapacityAU: 20,
          effectiveCapacityAU: 20,
          plannedAU: 18,
          realizedAU: 16,
          source: 'sync',
        },
        {
          id: 's2',
          date: '2026-08-24', // Monday
          timestamp: '2026-08-24T18:00:00Z',
          expectedCapacityAU: 20,
          effectiveCapacityAU: 20,
          plannedAU: 20,
          realizedAU: 18,
          source: 'sync',
        },
        {
          id: 's3',
          date: '2026-08-31', // Monday
          timestamp: '2026-08-31T18:00:00Z',
          expectedCapacityAU: 20,
          effectiveCapacityAU: 20,
          plannedAU: 15,
          realizedAU: 14,
          source: 'sync',
        },
        // Tuesday snapshot (should be ignored for Monday check)
        {
          id: 's4',
          date: '2026-08-25', // Tuesday
          timestamp: '2026-08-25T18:00:00Z',
          expectedCapacityAU: 20,
          effectiveCapacityAU: 20,
          plannedAU: 10,
          realizedAU: 8,
          source: 'sync',
        },
      ];

      // Monday is day 1
      const res = CapacityService.estimateExpectedCapacity(snapshots, 1, 20);

      // (16 + 18 + 14) / 3 = 48 / 3 = 16 AU
      expect(res.expectedAU).toBe(16);
      expect(res.sampleCount).toBe(3);
      // confidence is min(1, 3 / 5) = 0.6
      expect(res.confidence).toBe(0.6);
    });
  });

  describe('resolveDailyCapacity - Precedence Order', () => {
    const mondayDate = '2026-09-07';

    it('prioritizes manual override over calendar inference, history, and weekday default', () => {
      const config = {
        ...DEFAULT_CAPACITY_CONFIG,
        weekdayDefaults: { 1: 20 },
        calendarInference: { ...DEFAULT_CAPACITY_CONFIG.calendarInference, enabled: true },
        manualOverrides: { [mondayDate]: 12 },
      };

      const res = CapacityService.resolveDailyCapacity(mondayDate, config, {
        calendarAvailabilityAU: 28,
        historicalSnapshots: [
          {
            id: 'h1',
            date: '2026-08-31',
            timestamp: '2026-08-31T00:00:00Z',
            expectedCapacityAU: 20,
            effectiveCapacityAU: 20,
            plannedAU: 18,
            realizedAU: 17,
            source: 'sync',
          },
        ],
      });

      expect(res.effectiveCapacityAU).toBe(12);
      expect(res.source).toBe('manual');
      expect(res.isManualOverride).toBe(true);
      expect(res.confidence).toBe(1.0);
    });

    it('uses calendar inference when enabled and no manual override exists', () => {
      const config = {
        ...DEFAULT_CAPACITY_CONFIG,
        weekdayDefaults: { 1: 20 },
        calendarInference: { ...DEFAULT_CAPACITY_CONFIG.calendarInference, enabled: true },
        manualOverrides: {},
      };

      const res = CapacityService.resolveDailyCapacity(mondayDate, config, {
        calendarAvailabilityAU: 24,
      });

      expect(res.effectiveCapacityAU).toBe(24);
      expect(res.source).toBe('sync');
      expect(res.isManualOverride).toBe(false);
      expect(res.calendarAvailabilityAU).toBe(24);
    });

    it('falls back to historical expected capacity when calendar inference is disabled', () => {
      const config = {
        ...DEFAULT_CAPACITY_CONFIG,
        weekdayDefaults: { 1: 20 },
        calendarInference: { ...DEFAULT_CAPACITY_CONFIG.calendarInference, enabled: false },
        manualOverrides: {},
      };

      const res = CapacityService.resolveDailyCapacity(mondayDate, config, {
        historicalSnapshots: [
          {
            id: 'h1',
            date: '2026-08-31', // Monday
            timestamp: '2026-08-31T00:00:00Z',
            expectedCapacityAU: 20,
            effectiveCapacityAU: 20,
            plannedAU: 18,
            realizedAU: 15,
            source: 'sync',
          },
        ],
      });

      expect(res.effectiveCapacityAU).toBe(15);
      expect(res.source).toBe('sync');
      expect(res.isManualOverride).toBe(false);
    });

    it('falls back to weekday default when no overrides, no calendar, and no history exist', () => {
      const config = {
        ...DEFAULT_CAPACITY_CONFIG,
        weekdayDefaults: { 1: 22 },
        calendarInference: { ...DEFAULT_CAPACITY_CONFIG.calendarInference, enabled: false },
        manualOverrides: {},
      };

      const res = CapacityService.resolveDailyCapacity(mondayDate, config);

      expect(res.effectiveCapacityAU).toBe(22);
      expect(res.source).toBe('default');
      expect(res.isManualOverride).toBe(false);
    });
  });

  describe('evaluateTaskAssignmentImpact', () => {
    it('computes scheduling impact correctly when within capacity', () => {
      const impact = CapacityService.evaluateTaskAssignmentImpact(
        10, // current planned
        4,  // task AU
        20, // capacity AU
        '2026-09-07'
      );

      expect(impact.currentPlannedAU).toBe(10);
      expect(impact.taskAU).toBe(4);
      expect(impact.totalPlannedAU).toBe(14);
      expect(impact.capacityAU).toBe(20);
      expect(impact.remainingAU).toBe(6);
      expect(impact.percentageUsed).toBe(70);
      expect(impact.isOverCapacity).toBe(false);
      expect(impact.overCapacityDelta).toBe(0);
    });

    it('computes scheduling impact correctly when exceeding capacity', () => {
      const impact = CapacityService.evaluateTaskAssignmentImpact(
        16, // current planned
        6,  // task AU
        20, // capacity AU
        '2026-09-07'
      );

      expect(impact.totalPlannedAU).toBe(22);
      expect(impact.capacityAU).toBe(20);
      expect(impact.remainingAU).toBe(-2);
      expect(impact.percentageUsed).toBe(110);
      expect(impact.isOverCapacity).toBe(true);
      expect(impact.overCapacityDelta).toBe(2);
    });
  });

  describe('createCapacitySnapshot', () => {
    it('creates an immutable snapshot with generated ID and timestamp', () => {
      const snap = CapacityService.createCapacitySnapshot({
        date: '2026-09-07',
        expectedCapacityAU: 20,
        effectiveCapacityAU: 18,
        plannedAU: 14,
        calendarAvailabilityAU: 18,
        realizedAU: 12,
        source: 'sync',
      });

      expect(snap.id).toMatch(/^cap_snap_2026-09-07_/);
      expect(snap.date).toBe('2026-09-07');
      expect(snap.expectedCapacityAU).toBe(20);
      expect(snap.effectiveCapacityAU).toBe(18);
      expect(snap.plannedAU).toBe(14);
      expect(snap.realizedAU).toBe(12);
      expect(snap.source).toBe('sync');
      expect(typeof snap.timestamp).toBe('string');
    });
  });
});
