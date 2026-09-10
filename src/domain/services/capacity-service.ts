import {
  DailyCapacityConfig,
  DailyCapacitySnapshot,
  SchedulingImpactPreview,
  WorkScheduleConfig,
  CapacitySnapshotSource,
} from '../models/types';
import { parseDate } from '../utils/date';

export interface CalendarEventInterval {
  start: string; // ISO dateTime or YYYY-MM-DD
  end: string;   // ISO dateTime or YYYY-MM-DD
  allDay?: boolean;
}

export const DEFAULT_WEEKDAY_CAPACITY: Record<number, number> = {
  1: 20, // Monday
  2: 20, // Tuesday
  3: 20, // Wednesday
  4: 20, // Thursday
  5: 20, // Friday
  6: 8,  // Saturday
  0: 8,  // Sunday
};

export const DEFAULT_WORK_SCHEDULE: WorkScheduleConfig = {
  startHour: 9,
  startMinute: 0,
  endHour: 17,
  endMinute: 0,
  workDays: [1, 2, 3, 4, 5],
};

export const DEFAULT_CAPACITY_CONFIG: DailyCapacityConfig = {
  isConfigured: false,
  weekdayDefaults: DEFAULT_WEEKDAY_CAPACITY,
  manualOverrides: {},
  calendarInference: {
    enabled: false,
    minutesPerAU: 15,
    workSchedule: DEFAULT_WORK_SCHEDULE,
  },
};

export class CapacityService {
  /**
   * Computes available work time in minutes and Attention Units (AU)
   * by subtracting calendar events overlapping the configured work schedule.
   * Merges overlapping events so no period is subtracted twice.
   */
  public static calculateCalendarAvailability(
    events: CalendarEventInterval[],
    workSchedule: WorkScheduleConfig = DEFAULT_WORK_SCHEDULE,
    minutesPerAU: number = 15,
    dateStr: string
  ): {
    availableAU: number;
    occupiedMinutes: number;
    totalWorkMinutes: number;
    remainingMinutes: number;
  } {
    const targetDate = parseDate(dateStr);
    const dayOfWeek = targetDate.getDay();

    const isWorkDay = (workSchedule.workDays || [1, 2, 3, 4, 5]).includes(dayOfWeek);
    if (!isWorkDay) {
      return {
        availableAU: 0,
        occupiedMinutes: 0,
        totalWorkMinutes: 0,
        remainingMinutes: 0,
      };
    }

    const workStartMinutes = workSchedule.startHour * 60 + (workSchedule.startMinute || 0);
    const workEndMinutes = workSchedule.endHour * 60 + (workSchedule.endMinute || 0);
    const totalWorkMinutes = Math.max(0, workEndMinutes - workStartMinutes);

    if (totalWorkMinutes <= 0) {
      return {
        availableAU: 0,
        occupiedMinutes: 0,
        totalWorkMinutes: 0,
        remainingMinutes: 0,
      };
    }

    // Filter and project events onto work minutes [workStartMinutes, workEndMinutes]
    const rawIntervals: [number, number][] = [];

    for (const ev of events) {
      // 1. All-day event
      if (ev.allDay || (!ev.start.includes('T') && !ev.end.includes('T'))) {
        const evStartDate = ev.start.slice(0, 10);
        const evEndDate = ev.end.slice(0, 10);
        if (dateStr >= evStartDate && dateStr <= evEndDate) {
          rawIntervals.push([workStartMinutes, workEndMinutes]);
        }
        continue;
      }

      // 2. Timed event
      const startDate = new Date(ev.start);
      const endDate = new Date(ev.end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

      const evDateStr = ev.start.slice(0, 10);
      const evEndDateStr = ev.end.slice(0, 10);

      // Check if event touches dateStr
      if (evDateStr !== dateStr && evEndDateStr !== dateStr && !(evDateStr < dateStr && evEndDateStr > dateStr)) {
        continue;
      }

      let evStartMinutes = workStartMinutes;
      let evEndMinutes = workEndMinutes;

      if (evDateStr === dateStr) {
        evStartMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      }

      if (evEndDateStr === dateStr) {
        evEndMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      }

      // Clamp interval to work hours
      const clampedStart = Math.max(workStartMinutes, evStartMinutes);
      const clampedEnd = Math.min(workEndMinutes, evEndMinutes);

      if (clampedEnd > clampedStart) {
        rawIntervals.push([clampedStart, clampedEnd]);
      }
    }

    // Merge overlapping intervals
    rawIntervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged: [number, number][] = [];

    for (const [start, end] of rawIntervals) {
      if (merged.length === 0) {
        merged.push([start, end]);
      } else {
        const last = merged[merged.length - 1];
        if (start <= last[1]) {
          last[1] = Math.max(last[1], end);
        } else {
          merged.push([start, end]);
        }
      }
    }

    const occupiedMinutes = merged.reduce((acc, [s, e]) => acc + (e - s), 0);
    const remainingMinutes = Math.max(0, totalWorkMinutes - occupiedMinutes);
    const mPerAU = minutesPerAU > 0 ? minutesPerAU : 15;
    const availableAU = Math.round((remainingMinutes / mPerAU) * 10) / 10;

    return {
      availableAU,
      occupiedMinutes,
      totalWorkMinutes,
      remainingMinutes,
    };
  }

  /**
   * Sums planned Attention Units for tasks scheduled for a date.
   */
  public static calculatePlannedAU(
    tasks: Array<{ dueDate?: string; status?: string; estimatedAU?: number }>,
    dateStr: string
  ): number {
    const relevantTasks = tasks.filter(
      (t) => t.dueDate === dateStr && t.status !== 'abandoned'
    );
    const sum = relevantTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
    return Math.round(sum * 10) / 10;
  }

  /**
   * Sums realized Attention Units for tasks completed on or scheduled for a date.
   */
  public static calculateRealizedAU(
    tasks: Array<{ dueDate?: string; status?: string; estimatedAU?: number }>,
    dateStr: string
  ): number {
    const completedTasks = tasks.filter(
      (t) => t.dueDate === dateStr && t.status === 'completed'
    );
    const sum = completedTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
    return Math.round(sum * 10) / 10;
  }

  /**
   * Estimates typical expected capacity for a given weekday from historical snapshots.
   */
  public static estimateExpectedCapacity(
    historicalSnapshots: DailyCapacitySnapshot[],
    dayOfWeek: number,
    defaultCapacity: number
  ): {
    expectedAU: number;
    confidence: number;
    sampleCount: number;
  } {
    const matches = historicalSnapshots.filter((s) => {
      const d = parseDate(s.date);
      return d.getDay() === dayOfWeek && s.realizedAU !== undefined && s.realizedAU > 0;
    });

    if (matches.length === 0) {
      return {
        expectedAU: defaultCapacity,
        confidence: 0,
        sampleCount: 0,
      };
    }

    const totalRealized = matches.reduce((acc, m) => acc + (m.realizedAU || 0), 0);
    const avg = totalRealized / matches.length;
    const expectedAU = Math.round(avg * 10) / 10;
    const confidence = Math.min(1, Math.round((matches.length / 5) * 100) / 100);

    return {
      expectedAU,
      confidence,
      sampleCount: matches.length,
    };
  }

  /**
   * Resolves the effective daily capacity and expected capacity following the precedence rules:
   * 1. Manual user override for dateStr (highest precedence)
   * 2. Calendar-derived availability (if enabled and provided)
   * 3. Learned/historical expected capacity (if samples exist)
   * 4. Weekday default capacity
   */
  public static resolveDailyCapacity(
    dateStr: string,
    config: DailyCapacityConfig = DEFAULT_CAPACITY_CONFIG,
    options?: {
      calendarAvailabilityAU?: number;
      historicalSnapshots?: DailyCapacitySnapshot[];
    }
  ): {
    effectiveCapacityAU: number;
    expectedCapacityAU: number;
    source: CapacitySnapshotSource;
    isManualOverride: boolean;
    calendarAvailabilityAU?: number;
    confidence?: number;
  } {
    const dayOfWeek = parseDate(dateStr).getDay();
    const defaultForDay = config.weekdayDefaults[dayOfWeek] ?? DEFAULT_WEEKDAY_CAPACITY[dayOfWeek] ?? 20;

    const historical = this.estimateExpectedCapacity(
      options?.historicalSnapshots || [],
      dayOfWeek,
      defaultForDay
    );
    const expectedCapacityAU = historical.sampleCount > 0 ? historical.expectedAU : defaultForDay;

    // Check manual override
    if (config.manualOverrides && config.manualOverrides[dateStr] !== undefined) {
      const userOverrideAU = config.manualOverrides[dateStr];
      return {
        effectiveCapacityAU: userOverrideAU,
        expectedCapacityAU,
        source: 'manual',
        isManualOverride: true,
        calendarAvailabilityAU: options?.calendarAvailabilityAU,
        confidence: 1.0,
      };
    }

    // Check calendar inference
    if (
      config.calendarInference.enabled &&
      options?.calendarAvailabilityAU !== undefined
    ) {
      return {
        effectiveCapacityAU: options.calendarAvailabilityAU,
        expectedCapacityAU,
        source: 'sync',
        isManualOverride: false,
        calendarAvailabilityAU: options.calendarAvailabilityAU,
        confidence: 0.8,
      };
    }

    // Fall back to expected capacity (historical or weekday default)
    return {
      effectiveCapacityAU: expectedCapacityAU,
      expectedCapacityAU,
      source: historical.sampleCount > 0 ? 'sync' : 'default',
      isManualOverride: false,
      calendarAvailabilityAU: options?.calendarAvailabilityAU,
      confidence: historical.confidence,
    };
  }

  /**
   * Evaluates the consequence of scheduling a task on a date before assigning it.
   */
  public static evaluateTaskAssignmentImpact(
    currentPlannedAU: number,
    taskAU: number,
    capacityAU: number,
    dateStr: string,
    isManualOverride = false,
    calendarAvailabilityAU?: number
  ): SchedulingImpactPreview {
    const safeCapacity = Math.max(0.1, capacityAU);
    const totalPlannedAU = Math.round((currentPlannedAU + Math.max(0, taskAU)) * 10) / 10;
    const remainingAU = Math.round((capacityAU - totalPlannedAU) * 10) / 10;
    const percentageUsed = Math.round((totalPlannedAU / safeCapacity) * 100);
    const isOverCapacity = totalPlannedAU > capacityAU;
    const overCapacityDelta = isOverCapacity
      ? Math.round((totalPlannedAU - capacityAU) * 10) / 10
      : 0;

    return {
      date: dateStr,
      currentPlannedAU,
      taskAU,
      totalPlannedAU,
      capacityAU,
      remainingAU,
      percentageUsed,
      isOverCapacity,
      overCapacityDelta,
      calendarAvailabilityAU,
      isManualOverride,
    };
  }

  /**
   * Creates an immutable DailyCapacitySnapshot record.
   */
  public static createCapacitySnapshot(params: {
    date: string;
    expectedCapacityAU: number;
    effectiveCapacityAU: number;
    plannedAU: number;
    calendarAvailabilityAU?: number;
    userOverrideAU?: number;
    realizedAU?: number;
    occupiedMinutes?: number;
    confidence?: number;
    source: CapacitySnapshotSource;
  }): DailyCapacitySnapshot {
    return {
      id: `cap_snap_${params.date}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: params.date,
      timestamp: new Date().toISOString(),
      expectedCapacityAU: params.expectedCapacityAU,
      effectiveCapacityAU: params.effectiveCapacityAU,
      plannedAU: params.plannedAU,
      calendarAvailabilityAU: params.calendarAvailabilityAU,
      userOverrideAU: params.userOverrideAU,
      realizedAU: params.realizedAU,
      occupiedMinutes: params.occupiedMinutes,
      confidence: params.confidence,
      source: params.source,
    };
  }
}
