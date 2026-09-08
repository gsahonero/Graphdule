import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Circle } from 'lucide-react';
import { getTodayString, addDays, parseDate, formatDate, formatDisplayDate } from '../../domain/utils/date';
import { AppContext } from '../context/AppContext';
import { NodeStatus } from '../../domain/models/types';

export interface CalendarDayTask {
  id: string;
  text: string;
  dueDate: string;
  status: NodeStatus;
  estimatedAU?: number;
  projectId?: string;
  projectName?: string;
  isStandalone?: boolean;
}

export interface CalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (newDate: string) => void;
  onClose: () => void;
  align?: 'left' | 'right' | 'center';
  position?: 'bottom' | 'top';
  currentTaskId?: string;
  customTasks?: CalendarDayTask[];
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
  currentTaskId,
  customTasks,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse initial selected date or fallback to today
  const initialDate = value ? parseDate(value) : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Workload hover state
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<'right' | 'left' | 'bottom'>('right');

  // Safely consume AppContext (gracefully null if outside provider)
  const appContext = useContext(AppContext);

  // Group tasks efficiently into an O(1) hash map keyed by YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarDayTask[]>();

    if (customTasks) {
      for (const item of customTasks) {
        if (item.dueDate && item.status !== 'abandoned') {
          const list = map.get(item.dueDate);
          if (list) {
            list.push(item);
          } else {
            map.set(item.dueDate, [item]);
          }
        }
      }
      return map;
    }

    if (!appContext) return map;

    const projectMap = new Map<string, string>();
    appContext.projects?.forEach((p) => {
      projectMap.set(p.id, p.name);
    });
    if (appContext.activeProjectDoc?.project) {
      projectMap.set(appContext.activeProjectDoc.project.id, appContext.activeProjectDoc.project.name);
    }

    const nodesMap = new Map<string, typeof appContext.allActiveNodes[number]>();
    appContext.allActiveNodes?.forEach((n) => {
      nodesMap.set(n.id, n);
    });
    if (appContext.activeProjectDoc?.nodes) {
      appContext.activeProjectDoc.nodes.forEach((n) => {
        nodesMap.set(n.id, n);
      });
    }

    nodesMap.forEach((node) => {
      if (node.dueDate && node.status !== 'abandoned') {
        const pName =
          (node.projectId ? projectMap.get(node.projectId) : undefined) ||
          appContext.activeProjectDoc?.project.name ||
          'Project Task';
        const item: CalendarDayTask = {
          id: node.id,
          text: node.text,
          dueDate: node.dueDate,
          status: node.status,
          estimatedAU: node.estimatedAU,
          projectId: node.projectId || appContext.activeProjectDoc?.project.id,
          projectName: pName,
          isStandalone: false,
        };
        const list = map.get(node.dueDate);
        if (list) {
          list.push(item);
        } else {
          map.set(node.dueDate, [item]);
        }
      }
    });

    appContext.standaloneTasks?.forEach((st) => {
      if (st.dueDate && st.status !== 'abandoned') {
        const item: CalendarDayTask = {
          id: st.id,
          text: st.text,
          dueDate: st.dueDate,
          status: st.status,
          estimatedAU: st.estimatedAU,
          projectName: 'Standalone',
          isStandalone: true,
        };
        const list = map.get(st.dueDate);
        if (list) {
          list.push(item);
        } else {
          map.set(st.dueDate, [item]);
        }
      }
    });

    return map;
  }, [
    customTasks,
    appContext?.projects,
    appContext?.allActiveNodes,
    appContext?.activeProjectDoc,
    appContext?.standaloneTasks,
  ]);

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
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [onClose]);

  // Viewport-aware smart placement of hover preview card
  useEffect(() => {
    if (!hoveredDate || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1024;

    // Check if 280px preview card fits comfortably to the right
    if (rect.right + 285 <= screenW) {
      setPreviewPlacement('right');
    } else if (rect.left - 285 >= 0) {
      setPreviewPlacement('left');
    } else {
      setPreviewPlacement('bottom');
    }
  }, [hoveredDate]);

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

  // Hover handlers for day cell & balloon preview
  const handleMouseEnterDay = (dateStr: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const dayTasks = tasksByDate.get(dateStr);
    if (dayTasks && dayTasks.length > 0) {
      setHoveredDate(dateStr);
    } else {
      setHoveredDate(null);
    }
  };

  const handleMouseLeaveDay = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDate(null);
    }, 120);
  };

  const handleMouseEnterPreview = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseLeavePreview = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDate(null);
    }, 120);
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

  const hoveredTasks = hoveredDate ? tasksByDate.get(hoveredDate) || [] : [];
  const totalAU = hoveredTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ zIndex: 9999 }}
      className={`nodrag nowheel nopan absolute ${positionClass} ${alignClass} w-[280px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-[9999] select-none animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-950/5 text-left`}
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
          const tasks = tasksByDate.get(cell.dateString) || [];
          const taskCount = tasks.length;

          return (
            <div
              key={`${cell.dateString}-${idx}`}
              className="relative flex items-center justify-center"
              onMouseEnter={() => handleMouseEnterDay(cell.dateString)}
              onMouseLeave={handleMouseLeaveDay}
            >
              <button
                type="button"
                onClick={(e) => handleSelectDay(cell.dayNum, cell.monthType, e)}
                className={`h-8 w-8 sm:h-7 sm:w-7 mx-auto rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer relative group/day ${
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

              {/* Workload Balloon Badge */}
              {taskCount > 0 && (
                <div
                  onMouseEnter={() => handleMouseEnterDay(cell.dateString)}
                  onClick={(e) => {
                    handleSelectDay(cell.dayNum, cell.monthType, e);
                  }}
                  title={`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} due on this day (hover for details)`}
                  data-testid={`task-balloon-${cell.dateString}`}
                  className={`absolute -top-1 -right-0.5 z-20 cursor-pointer select-none font-bold text-[9px] tracking-tight flex items-center justify-center shadow-sm transition-transform hover:scale-125 ${
                    taskCount > 9 ? 'px-1 h-3.5 min-w-[14px] rounded-full' : 'w-3.5 h-3.5 rounded-full'
                  } ${
                    taskCount >= 6
                      ? 'bg-rose-500 text-white ring-1 ring-white dark:ring-slate-900 shadow-rose-500/30'
                      : taskCount >= 3
                      ? 'bg-amber-500 text-white ring-1 ring-white dark:ring-slate-900 shadow-amber-500/30'
                      : 'bg-indigo-500 text-white ring-1 ring-white dark:ring-slate-900 shadow-indigo-500/30'
                  }`}
                >
                  {taskCount}
                </div>
              )}
            </div>
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

      {/* Hover Preview Popover */}
      {hoveredDate && hoveredTasks.length > 0 && (
        <div
          data-testid="calendar-workload-preview"
          onMouseEnter={handleMouseEnterPreview}
          onMouseLeave={handleMouseLeavePreview}
          className={`nodrag nowheel nopan absolute ${
            previewPlacement === 'right'
              ? 'left-full ml-2 top-0'
              : previewPlacement === 'left'
              ? 'right-full mr-2 top-0'
              : 'top-full mt-2 left-0 right-0'
          } w-[280px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-[10000] select-none animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-950/10 text-left`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Deadline workload
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {appContext?.formatDateDisplay
                  ? appContext.formatDateDisplay(hoveredDate)
                  : formatDisplayDate(hoveredDate, 'MMM_D_YYYY')}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {hoveredTasks.length} {hoveredTasks.length === 1 ? 'task' : 'tasks'}
              </span>
              {totalAU > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center space-x-1"
                  title="Total Attention Units (UA/AU)"
                >
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span>{Math.round(totalAU * 10) / 10} AU</span>
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Tasks List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {hoveredTasks.map((task) => {
              const isCurrent = task.id === currentTaskId;
              const isCompleted = task.status === 'completed';
              const isInProgress = task.status === 'in_progress';

              return (
                <div
                  key={task.id}
                  data-testid={`preview-task-${task.id}`}
                  className={`p-1.5 rounded-lg border text-left transition-colors flex items-start space-x-2 ${
                    isCurrent
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 ring-1 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                  }`}
                >
                  {/* Status icon */}
                  <div className="pt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isInProgress ? (
                      <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1 mb-0.5">
                      <span
                        className={`text-xs leading-snug font-medium truncate block flex-1 ${
                          isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                        title={task.text}
                      >
                        {task.text}
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 text-[9px] font-bold px-1 rounded bg-emerald-500 text-white">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[130px] font-medium text-slate-600 dark:text-slate-300">
                        {task.projectName}
                      </span>
                      {task.estimatedAU !== undefined && task.estimatedAU > 0 ? (
                        <span className="shrink-0 font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/50 px-1 py-0.2 rounded text-[9.5px]">
                          {Math.round(task.estimatedAU * 10) / 10} AU
                        </span>
                      ) : (
                        <span className="shrink-0 text-slate-400 font-mono text-[9px]">
                          — AU
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
