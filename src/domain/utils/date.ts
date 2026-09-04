/**
 * Pure date helper functions working with YYYY-MM-DD string representations.
 */

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function daysBetween(startDateStr: string, endDateStr: string): number {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function isBefore(dateA: string, dateB: string): boolean {
  return dateA < dateB;
}

export function isBeforeOrEqual(dateA: string, dateB: string): boolean {
  return dateA <= dateB;
}

export function isAfter(dateA: string, dateB: string): boolean {
  return dateA > dateB;
}

export function minDate(dates: string[]): string {
  if (dates.length === 0) return getTodayString();
  return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
}

export function maxDate(dates: string[]): string {
  if (dates.length === 0) return getTodayString();
  return dates.reduce((max, d) => (d > max ? d : max), dates[0]);
}

export type DateDisplayFormat = 'DD/MM/YYYY' | 'MMM_D_YYYY';

export const MONTH_ABBREVIATIONS: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'June', // 4 letters tops
  7: 'July', // 4 letters tops
  8: 'Aug',
  9: 'Sept', // 4 letters tops
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

/**
 * Formats a YYYY-MM-DD canonical date string for user display.
 * - 'DD/MM/YYYY': e.g. 24/10/2026
 * - 'MMM_D_YYYY': e.g. Oct, 24 (2026) or Sept, 15 (2026) with max 4-letter month abbreviations
 */
export function formatDisplayDate(dateStr: string, format: DateDisplayFormat = 'DD/MM/YYYY'): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [yearStr, monthStr, dayStr] = parts;
  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);

  if (isNaN(monthNum) || isNaN(dayNum)) return dateStr;

  if (format === 'MMM_D_YYYY') {
    const monthName = MONTH_ABBREVIATIONS[monthNum] || monthStr;
    return `${monthName}, ${dayNum} (${yearStr})`;
  }

  // Default: DD/MM/YYYY
  const dd = String(dayNum).padStart(2, '0');
  const mm = String(monthNum).padStart(2, '0');
  return `${dd}/${mm}/${yearStr}`;
}

