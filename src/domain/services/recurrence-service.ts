import { NthWeekdayOfMonth, RecurrenceRule } from '../models/types';
import { addDays, formatDate, isAfter, parseDate } from '../utils/date';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ORDINAL_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
  [-1]: 'last',
};

export class RecurrenceService {
  /**
   * Calculates the exact day of month (1-31) for an Nth weekday in a given month/year.
   * - nth: 1 (1st), 2 (2nd), 3 (3rd), 4 (4th), -1 (last)
   * - dayOfWeek: 0 = Sun, 1 = Mon, ..., 6 = Sat
   */
  public static getNthWeekdayOfMonth(
    year: number,
    monthIndex: number, // 0-11
    nth: 1 | 2 | 3 | 4 | -1,
    dayOfWeek: number
  ): number {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    if (nth === -1) {
      // Last occurrence in the month
      const lastDayDow = new Date(year, monthIndex, daysInMonth).getDay();
      const diff = (lastDayDow - dayOfWeek + 7) % 7;
      return daysInMonth - diff;
    }

    // 1st, 2nd, 3rd, 4th occurrence
    const firstDayDow = new Date(year, monthIndex, 1).getDay();
    const firstOccurrence = 1 + ((dayOfWeek - firstDayDow + 7) % 7);
    const targetDate = firstOccurrence + (nth - 1) * 7;

    if (targetDate > daysInMonth) {
      // If 4th/5th doesn't exist, fallback to last available
      return this.getNthWeekdayOfMonth(year, monthIndex, -1, dayOfWeek);
    }

    return targetDate;
  }

  /**
   * Determines the Nth weekday info for a specific date (e.g. whether Sept 15 is 3rd Tuesday or last Tuesday).
   */
  public static getNthWeekdayOfDate(dateStr: string): NthWeekdayOfMonth {
    const d = parseDate(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const dayOfWeek = d.getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const occurrenceNumber = Math.ceil(day / 7) as 1 | 2 | 3 | 4;

    // Check if it is also the last occurrence of that weekday in the month
    const isLast = day + 7 > daysInMonth;

    return {
      nth: isLast && occurrenceNumber >= 4 ? -1 : (Math.min(occurrenceNumber, 4) as 1 | 2 | 3 | 4),
      dayOfWeek,
    };
  }

  /**
   * Computes the next scheduled due date string (YYYY-MM-DD) for a recurring task.
   * Returns `null` if the recurrence has ended (e.g., passed endDate or exceeded count limit).
   */
  public static computeNextDueDate(
    currentDueDate: string,
    rule: RecurrenceRule,
    currentCount: number = 1
  ): string | null {
    if (!rule || !currentDueDate) return null;

    if (rule.count !== undefined && currentCount >= rule.count) {
      return null;
    }

    const interval = Math.max(1, rule.interval || 1);
    let nextDateStr: string | null = null;

    switch (rule.frequency) {
      case 'daily': {
        nextDateStr = addDays(currentDueDate, interval);
        break;
      }

      case 'weekdays': {
        let cur = parseDate(currentDueDate);
        for (let i = 0; i < interval; i++) {
          cur.setDate(cur.getDate() + 1);
          // If Saturday (6), jump to Monday
          if (cur.getDay() === 6) {
            cur.setDate(cur.getDate() + 2);
          } else if (cur.getDay() === 0) {
            // If Sunday (0), jump to Monday
            cur.setDate(cur.getDate() + 1);
          }
        }
        nextDateStr = formatDate(cur);
        break;
      }

      case 'weekly': {
        const currentDate = parseDate(currentDueDate);
        const currentDow = currentDate.getDay();
        const daysOfWeek =
          rule.daysOfWeek && rule.daysOfWeek.length > 0
            ? [...new Set(rule.daysOfWeek)].sort((a, b) => a - b)
            : [currentDow];

        // 1. Check if there are other matching days remaining in the SAME week
        const nextDayInSameWeek = daysOfWeek.find((d) => d > currentDow);

        if (nextDayInSameWeek !== undefined && interval === 1) {
          const diffDays = nextDayInSameWeek - currentDow;
          nextDateStr = addDays(currentDueDate, diffDays);
        } else {
          // 2. Jump forward by `interval` weeks to the first scheduled day of that target week
          const firstScheduledDow = daysOfWeek[0];
          // Calculate start of current week (Sunday = 0)
          const daysFromSunday = currentDow;
          const targetSunday = new Date(currentDate);
          targetSunday.setDate(currentDate.getDate() - daysFromSunday + interval * 7);

          // Add first scheduled day offset
          targetSunday.setDate(targetSunday.getDate() + firstScheduledDow);
          nextDateStr = formatDate(targetSunday);
        }
        break;
      }

      case 'monthly': {
        const curDate = parseDate(currentDueDate);
        const curYear = curDate.getFullYear();
        const curMonth = curDate.getMonth();

        const targetMonthTotal = curMonth + interval;
        const targetYear = curYear + Math.floor(targetMonthTotal / 12);
        const targetMonthIndex = ((targetMonthTotal % 12) + 12) % 12;

        if (rule.nthWeekdayOfMonth) {
          const targetDay = this.getNthWeekdayOfMonth(
            targetYear,
            targetMonthIndex,
            rule.nthWeekdayOfMonth.nth,
            rule.nthWeekdayOfMonth.dayOfWeek
          );
          nextDateStr = formatDate(new Date(targetYear, targetMonthIndex, targetDay));
        } else {
          const desiredDay = rule.dayOfMonth || curDate.getDate();
          const maxDaysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
          const clampedDay = Math.min(desiredDay, maxDaysInTargetMonth);
          nextDateStr = formatDate(new Date(targetYear, targetMonthIndex, clampedDay));
        }
        break;
      }

      case 'yearly': {
        const curDate = parseDate(currentDueDate);
        const targetYear = curDate.getFullYear() + interval;
        const targetMonth = curDate.getMonth();
        const desiredDay = curDate.getDate();

        const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const clampedDay = Math.min(desiredDay, maxDaysInTargetMonth);
        nextDateStr = formatDate(new Date(targetYear, targetMonth, clampedDay));
        break;
      }

      default:
        nextDateStr = addDays(currentDueDate, 1);
        break;
    }

    if (nextDateStr && rule.endDate && isAfter(nextDateStr, rule.endDate)) {
      return null;
    }

    return nextDateStr;
  }

  /**
   * Generates a readable description of the recurrence rule.
   */
  public static formatRecurrenceRule(rule?: RecurrenceRule): string {
    if (!rule) return 'Does not repeat';

    const interval = Math.max(1, rule.interval || 1);

    let baseText = '';

    switch (rule.frequency) {
      case 'daily':
        baseText = interval === 1 ? 'Daily' : `Every ${interval} days`;
        break;

      case 'weekdays':
        baseText = interval === 1 ? 'Every weekday (Mon–Fri)' : `Every ${interval} weekdays`;
        break;

      case 'weekly': {
        const days = rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [];
        const daysText =
          days.length > 0
            ? days.length === 7
              ? 'day'
              : days.map((d) => SHORT_DAY_NAMES[d] || DAY_NAMES[d]).join(', ')
            : 'week';

        if (interval === 1) {
          baseText = days.length > 0 ? `Weekly on ${daysText}` : 'Weekly';
        } else {
          baseText = days.length > 0 ? `Every ${interval} weeks on ${daysText}` : `Every ${interval} weeks`;
        }
        break;
      }

      case 'monthly': {
        if (rule.nthWeekdayOfMonth) {
          const ordinal = ORDINAL_LABELS[rule.nthWeekdayOfMonth.nth] || '1st';
          const dayName = DAY_NAMES[rule.nthWeekdayOfMonth.dayOfWeek] || 'day';
          baseText =
            interval === 1
              ? `Monthly on the ${ordinal} ${dayName}`
              : `Every ${interval} months on the ${ordinal} ${dayName}`;
        } else if (rule.dayOfMonth) {
          baseText = interval === 1 ? `Monthly on day ${rule.dayOfMonth}` : `Every ${interval} months on day ${rule.dayOfMonth}`;
        } else {
          baseText = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        }
        break;
      }

      case 'yearly':
        baseText = interval === 1 ? 'Yearly' : `Every ${interval} years`;
        break;

      default:
        baseText = 'Custom';
        break;
    }

    if (rule.count) {
      baseText += ` (${rule.count} times)`;
    } else if (rule.endDate) {
      baseText += ` until ${rule.endDate}`;
    }

    return baseText;
  }

  /**
   * Generates the list of standard quick presets relative to a base date.
   */
  public static getQuickPresets(baseDateStr: string): { label: string; rule: RecurrenceRule | null }[] {
    const baseDate = parseDate(baseDateStr);
    const dow = baseDate.getDay();
    const dayName = DAY_NAMES[dow];
    const dayOfMonth = baseDate.getDate();
    const nthWeekday = this.getNthWeekdayOfDate(baseDateStr);
    const ordinalLabel = ORDINAL_LABELS[nthWeekday.nth] || '1st';

    return [
      {
        label: 'Does not repeat',
        rule: null,
      },
      {
        label: 'Every day',
        rule: { frequency: 'daily', interval: 1 },
      },
      {
        label: 'Every weekday (Mon–Fri)',
        rule: { frequency: 'weekdays', interval: 1 },
      },
      {
        label: `Weekly on ${dayName}`,
        rule: { frequency: 'weekly', interval: 1, daysOfWeek: [dow] },
      },
      {
        label: `Every 2 weeks on ${dayName}`,
        rule: { frequency: 'weekly', interval: 2, daysOfWeek: [dow] },
      },
      {
        label: `Monthly on day ${dayOfMonth}`,
        rule: { frequency: 'monthly', interval: 1, dayOfMonth },
      },
      {
        label: `Monthly on the ${ordinalLabel} ${dayName}`,
        rule: {
          frequency: 'monthly',
          interval: 1,
          nthWeekdayOfMonth: nthWeekday,
        },
      },
      {
        label: 'Every year',
        rule: { frequency: 'yearly', interval: 1 },
      },
    ];
  }
}
