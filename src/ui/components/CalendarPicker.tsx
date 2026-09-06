import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayString, addDays, parseDate, formatDate } from '../../domain/utils/date';

export interface CalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (newDate: string) => void;
  onClose: () => void;
  align?: 'left' | 'right' | 'center';
  position?: 'bottom' | 'top';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  value,
  onChange,
  onClose,
  align = 'left',
  position = 'bottom',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse initial selected date or fallback to today
  const initialDate = value ? parseDate(value) : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Keep view year/month synchronized if external value changes
  useEffect(() => {
    if (value) {
      const parsed = parseDate(value);
      if (!isNaN(parsed.getTime())) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as globalThis.Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dayNum: number, isOtherMonth: 'prev' | 'next' | 'current', e: React.MouseEvent) => {
    e.stopPropagation();
    let targetYear = viewYear;
    let targetMonth = viewMonth;

    if (isOtherMonth === 'prev') {
      if (viewMonth === 0) {
        targetMonth = 11;
        targetYear -= 1;
      } else {
        targetMonth -= 1;
      }
    } else if (isOtherMonth === 'next') {
      if (viewMonth === 11) {
        targetMonth = 0;
        targetYear += 1;
      } else {
        targetMonth += 1;
      }
    }

    const newDate = new Date(targetYear, targetMonth, dayNum);
    const dateStr = formatDate(newDate);
    onChange(dateStr);
    onClose();
  };

  // Quick preset shortcuts
  const handleSetQuickDate = (daysFromToday: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const today = getTodayString();
    const target = daysFromToday === 0 ? today : addDays(today, daysFromToday);
    onChange(target);
    onClose();
  };

  // Build Month Grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Day of week index (Monday = 0, Sunday = 6)
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  interface CalendarCell {
    dayNum: number;
    monthType: 'prev' | 'next' | 'current';
    dateString: string;
    isToday: boolean;
    isSelected: boolean;
  }

  const cells: CalendarCell[] = [];
  const todayStr = getTodayString();

  // 1. Previous month trailing days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthDate = new Date(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1, d);
    const dStr = formatDate(prevMonthDate);
    cells.push({
      dayNum: d,
      monthType: 'prev',
      dateString: dStr,
      isToday: dStr === todayStr,
      isSelected: dStr === value,
    });
  }

  // 2. Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(viewYear, viewMonth, d);
    const dStr = formatDate(curDate);
    cells.push({
      dayNum: d,
      monthType: 'current',
      dateString: dStr,
      isToday: dStr === todayStr,
      isSelected: dStr === value,
    });
  }

  // 3. Next month leading days (fill up to 35 or 42 grid cells)
  const targetTotalCells = cells.length > 35 ? 42 : 35;
  const nextMonthCount = targetTotalCells - cells.length;

  for (let d = 1; d <= nextMonthCount; d++) {
    const nextMonthDate = new Date(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, d);
    const dStr = formatDate(nextMonthDate);
    cells.push({
      dayNum: d,
      monthType: 'next',
      dateString: dStr,
      isToday: dStr === todayStr,
      isSelected: dStr === value,
    });
  }

  // Positional styling
  const alignClass =
    align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : align === 'right'
      ? 'right-0'
      : 'left-0';

  const positionClass =
    position === 'top'
      ? 'bottom-full mb-2'
      : 'top-full mt-2';

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ zIndex: 9999 }}
      className={`nodrag nowheel nopan absolute ${positionClass} ${alignClass} w-[270px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-[9999] select-none animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-950/5 text-left`}
    >
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 sm:p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-1 font-semibold text-xs text-slate-800 dark:text-slate-100">
          <span>{MONTH_NAMES[viewMonth]}</span>
          <span className="text-slate-400 font-normal">{viewYear}</span>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 sm:p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAYS_OF_WEEK.map((day) => (
          <span key={day} className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-0.5">
            {day}
          </span>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((cell, idx) => {
          const isCurrentMonth = cell.monthType === 'current';
          return (
            <button
              key={`${cell.dateString}-${idx}`}
              type="button"
              onClick={(e) => handleSelectDay(cell.dayNum, cell.monthType, e)}
              className={`h-8 w-8 sm:h-7 sm:w-7 mx-auto rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer relative ${
                cell.isSelected
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 scale-105'
                  : cell.isToday
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-400 dark:border-emerald-600/60 hover:bg-emerald-100'
                  : isCurrentMonth
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                  : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <span>{cell.dayNum}</span>
              {cell.isToday && !cell.isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Action Presets */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={(e) => handleSetQuickDate(0, e)}
          className="px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold transition-colors cursor-pointer"
        >
          Today
        </button>
        <button
          type="button"
          onClick={(e) => handleSetQuickDate(1, e)}
          className="px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={(e) => handleSetQuickDate(7, e)}
          className="px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          +1 Week
        </button>
      </div>
    </div>
  );
};
