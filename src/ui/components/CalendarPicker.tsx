import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Circle, X, Edit2, AlertTriangle, Scale } from 'lucide-react';
import { getTodayString, addDays, parseDate, formatDate, formatDisplayDate } from '../../domain/utils/date';
import { AppContext } from '../context/AppContext';
import { NodeStatus } from '../../domain/models/types';
import { CapacityService } from '../../domain/services/capacity-service';

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
  taskEstimatedAU?: number;
  customTasks?: CalendarDayTask[];
  customCapacity?: number;
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
  taskEstimatedAU,
  customTasks,
  customCapacity,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse initial selected date or fallback to today
  const initialDate = value ? parseDate(value) : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Workload details panel state (opened on clicking a day balloon)
  const [activePanelDate, setActivePanelDate] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<'right' | 'left' | 'bottom'>(
    align === 'right' ? 'left' : 'right'
  );

  // Inline frictionless daily override state
  const [isEditingOverride, setIsEditingOverride] = useState<boolean>(false);
  const [overrideInput, setOverrideInput] = useState<string>('');

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
    };
  }, [onClose]);

  // Viewport- and container-aware smart placement of workload details panel
  useEffect(() => {
    if (!activePanelDate || !popoverRef.current) return;

    const updatePlacement = () => {
      if (!popoverRef.current) return;
      const rect = popoverRef.current.getBoundingClientRect();
      // In non-rendered or test environments without layout engine, maintain align-based placement
      if (rect.width === 0 && rect.height === 0) return;

      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const PANEL_WIDTH = 308; // 300px panel + 8px gap

      // Detect nearest clipping or scroll container bounds
      let clippingRight = screenW;
      let clippingLeft = 0;

      let el: HTMLElement | null = popoverRef.current.parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const isScrollOrClip =
          style.overflowX === 'hidden' ||
          style.overflowX === 'auto' ||
          style.overflowX === 'scroll' ||
          style.overflowY === 'hidden' ||
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll';

        if (isScrollOrClip) {
          const parentRect = el.getBoundingClientRect();
          if (parentRect.width > 0) {
            clippingRight = Math.min(clippingRight, parentRect.right);
            clippingLeft = Math.max(clippingLeft, parentRect.left);
          }
        }
        el = el.parentElement;
      }

      const spaceOnRight = clippingRight - rect.right;
      const spaceOnLeft = rect.left - clippingLeft;

      if (align === 'right') {
        // If picker is right-aligned, prefer placing workload panel to the left
        if (spaceOnLeft >= PANEL_WIDTH) {
          setPreviewPlacement('left');
        } else if (spaceOnRight >= PANEL_WIDTH) {
          setPreviewPlacement('right');
        } else {
          setPreviewPlacement('bottom');
        }
      } else {
        // Default (left- or center-aligned picker): prefer right
        if (spaceOnRight >= PANEL_WIDTH) {
          setPreviewPlacement('right');
        } else if (spaceOnLeft >= PANEL_WIDTH) {
          setPreviewPlacement('left');
        } else {
          setPreviewPlacement('bottom');
        }
      }
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    return () => window.removeEventListener('resize', updatePlacement);
  }, [activePanelDate, align]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePanelDate(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePanelDate(null);
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

  const panelTasks = activePanelDate ? tasksByDate.get(activePanelDate) || [] : [];
  const activeTasks = panelTasks.filter((t) => t.status !== 'completed');
  const completedTasks = panelTasks.filter((t) => t.status === 'completed');
  const pendingAU = activeTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
  const completedAU = completedTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);

  // Capacity & Reality Check Computation for activePanelDate
  const panelDateObj = activePanelDate ? parseDate(activePanelDate) : null;
  const panelWeekdayName = panelDateObj
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][panelDateObj.getDay()]
    : '';

  // Current task AU estimation resolution
  const resolvedCurrentTaskAU = useMemo(() => {
    if (taskEstimatedAU !== undefined) return taskEstimatedAU;
    if (!currentTaskId) return 0;
    const fromPanel = panelTasks.find((t) => t.id === currentTaskId);
    if (fromPanel?.estimatedAU !== undefined) return fromPanel.estimatedAU;
    const fromActive = appContext?.allActiveNodes?.find((n) => n.id === currentTaskId);
    if (fromActive?.estimatedAU !== undefined) return fromActive.estimatedAU;
    const fromDoc = appContext?.activeProjectDoc?.nodes?.find((n) => n.id === currentTaskId);
    if (fromDoc?.estimatedAU !== undefined) return fromDoc.estimatedAU;
    const fromStandalone = appContext?.standaloneTasks?.find((t) => t.id === currentTaskId);
    if (fromStandalone?.estimatedAU !== undefined) return fromStandalone.estimatedAU;
    return 0;
  }, [taskEstimatedAU, currentTaskId, panelTasks, appContext?.allActiveNodes, appContext?.activeProjectDoc?.nodes, appContext?.standaloneTasks]);

  // Capacity resolution for activePanelDate
  const resolvedCap = useMemo(() => {
    if (!activePanelDate) return { effectiveCapacityAU: 20, isManualOverride: false, calendarAvailabilityAU: undefined };
    if (customCapacity !== undefined) {
      return { effectiveCapacityAU: customCapacity, isManualOverride: false, calendarAvailabilityAU: undefined };
    }
    if (appContext?.capacityConfig) {
      return CapacityService.resolveDailyCapacity(activePanelDate, appContext.capacityConfig, {
        historicalSnapshots: appContext.capacitySnapshots,
      });
    }
    return { effectiveCapacityAU: 20, isManualOverride: false, calendarAvailabilityAU: undefined };
  }, [activePanelDate, customCapacity, appContext?.capacityConfig, appContext?.capacitySnapshots]);

  const dailyCapacityAU = resolvedCap.effectiveCapacityAU;

  // Consequence preview calculations
  const taskAlreadyInPanel = Boolean(currentTaskId && activeTasks.some((t) => t.id === currentTaskId));
  const basePlannedAU = taskAlreadyInPanel
    ? activeTasks.filter((t) => t.id !== currentTaskId).reduce((acc, t) => acc + (t.estimatedAU || 0), 0)
    : pendingAU;
  const hasTaskToSchedule = resolvedCurrentTaskAU > 0;
  const totalWithTaskAU = hasTaskToSchedule ? basePlannedAU + resolvedCurrentTaskAU : pendingAU;
  const remainingAU = Math.round((dailyCapacityAU - (hasTaskToSchedule ? totalWithTaskAU : pendingAU)) * 10) / 10;
  const committedPercentage = dailyCapacityAU > 0
    ? Math.round(((hasTaskToSchedule ? totalWithTaskAU : pendingAU) / dailyCapacityAU) * 100)
    : 100;
  const isOverCapacity = (hasTaskToSchedule ? totalWithTaskAU : pendingAU) > dailyCapacityAU;
  const overCapacityDelta = isOverCapacity
    ? Math.round(((hasTaskToSchedule ? totalWithTaskAU : pendingAU) - dailyCapacityAU) * 10) / 10
    : 0;

  const handleSaveOverride = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activePanelDate) return;
    const num = parseFloat(overrideInput);
    if (!isNaN(num) && num >= 0) {
      if (appContext?.setDailyCapacityOverride) {
        await appContext.setDailyCapacityOverride(activePanelDate, num);
      }
    }
    setIsEditingOverride(false);
  };

  const handleResetOverride = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activePanelDate) return;
    if (appContext?.setDailyCapacityOverride) {
      await appContext.setDailyCapacityOverride(activePanelDate, undefined);
    }
    setIsEditingOverride(false);
  };

  const renderTaskRow = (task: CalendarDayTask) => {
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
            : isCompleted
            ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/60 opacity-80'
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
              <span
                className={`shrink-0 font-mono font-semibold px-1 py-0.2 rounded text-[9.5px] ${
                  isCompleted
                    ? 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                    : 'text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/50'
                }`}
              >
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
  };

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
          const dayTasks = tasksByDate.get(cell.dateString) || [];
          const taskCount = dayTasks.length;
          const completedCount = dayTasks.filter((t) => t.status === 'completed').length;
          const pendingCount = taskCount - completedCount;
          const isAllCompleted = taskCount > 0 && pendingCount === 0;
          const isPanelOpen = activePanelDate === cell.dateString;

          return (
            <div
              key={`${cell.dateString}-${idx}`}
              className="relative flex items-center justify-center"
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

              {/* Workload Balloon Badge (Click to open workload panel) */}
              {taskCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanelDate((prev) => (prev === cell.dateString ? null : cell.dateString));
                  }}
                  title={
                    isAllCompleted
                      ? `${taskCount} tasks (all completed) • Click to view tasks`
                      : completedCount > 0
                      ? `${pendingCount} pending, ${completedCount} completed • Click to view tasks`
                      : `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} due • Click to view tasks`
                  }
                  data-testid={`task-balloon-${cell.dateString}`}
                  className={`absolute -top-1 -right-0.5 z-20 cursor-pointer select-none font-bold text-[9px] tracking-tight flex items-center justify-center shadow-sm transition-all duration-150 hover:scale-125 hover:shadow-md hover:ring-2 hover:ring-offset-1 ${
                    isPanelOpen ? 'scale-125 ring-2 ring-offset-1 ring-slate-800 dark:ring-white z-30' : ''
                  } ${
                    taskCount > 9 ? 'px-1 h-3.5 min-w-[14px] rounded-full' : 'w-3.5 h-3.5 rounded-full'
                  } ${
                    isAllCompleted
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-1 ring-white dark:ring-slate-900 shadow-emerald-500/30 hover:ring-emerald-400'
                      : pendingCount >= 6
                      ? 'bg-rose-500 hover:bg-rose-600 text-white ring-1 ring-white dark:ring-slate-900 shadow-rose-500/30 hover:ring-rose-400'
                      : pendingCount >= 3
                      ? 'bg-amber-500 hover:bg-amber-600 text-white ring-1 ring-white dark:ring-slate-900 shadow-amber-500/30 hover:ring-amber-400'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white ring-1 ring-white dark:ring-slate-900 shadow-indigo-500/30 hover:ring-indigo-400'
                  }`}
                >
                  {taskCount}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid={`day-capacity-trigger-${cell.dateString}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanelDate((prev) => (prev === cell.dateString ? null : cell.dateString));
                  }}
                  title="Inspect AU capacity and workload"
                  className={`absolute -top-1 -right-0.5 z-20 cursor-pointer select-none rounded-full w-3.5 h-3.5 transition-all flex items-center justify-center ${
                    isPanelOpen
                      ? 'scale-125 ring-2 ring-offset-1 ring-slate-800 dark:ring-white bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      : 'opacity-0 group-hover/day:opacity-100 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:scale-125'
                  }`}
                >
                  <Scale className="w-2 h-2" />
                </button>
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

      {/* Click-Triggered Workload Details Panel */}
      {activePanelDate && (
        <div
          data-testid="calendar-workload-preview"
          onClick={(e) => e.stopPropagation()}
          className={`nodrag nowheel nopan absolute ${
            previewPlacement === 'right'
              ? 'left-full ml-2 top-0 w-[300px]'
              : previewPlacement === 'left'
              ? 'right-full mr-2 top-0 w-[300px]'
              : 'top-full mt-2 left-0 right-0 w-full'
          } max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-[10000] select-none animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-950/10 text-left flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col min-w-0 pr-1">
              <div className="flex items-center space-x-1.5">
                {panelWeekdayName && (
                  <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    {panelWeekdayName}
                  </span>
                )}
                {resolvedCap.isManualOverride && (
                  <span className="text-[9px] font-bold px-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    Overridden
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {appContext?.formatDateDisplay
                  ? appContext.formatDateDisplay(activePanelDate)
                  : formatDisplayDate(activePanelDate, 'MMM_D_YYYY')}
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              {/* Frictionless Daily Override Toggle */}
              {!isEditingOverride ? (
                <button
                  type="button"
                  data-testid="edit-capacity-override"
                  onClick={() => {
                    setOverrideInput(String(dailyCapacityAU));
                    setIsEditingOverride(true);
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center space-x-0.5 cursor-pointer border border-emerald-500/20"
                  title="Override AU capacity for this day"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  <span>{resolvedCap.isManualOverride ? `${dailyCapacityAU} AU` : 'Override'}</span>
                </button>
              ) : null}
              <button
                type="button"
                data-testid="close-workload-panel"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePanelDate(null);
                  setIsEditingOverride(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Frictionless Override Edit Row */}
          {isEditingOverride && (
            <div className="p-2 mb-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-between text-xs animate-in fade-in duration-100">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Set day capacity:</span>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)}
                  className="w-14 px-1.5 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  data-testid="capacity-override-input"
                  autoFocus
                />
                <button
                  type="button"
                  data-testid="save-capacity-override"
                  onClick={handleSaveOverride}
                  className="px-2 py-0.5 text-[10.5px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  Save
                </button>
                {resolvedCap.isManualOverride && (
                  <button
                    type="button"
                    data-testid="reset-capacity-override"
                    onClick={handleResetOverride}
                    className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-rose-500 cursor-pointer"
                    title="Reset to weekday default"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Capacity Metrics Summary: Planned / Capacity / Available */}
          <div className="p-2 mb-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span data-testid="capacity-planned-metric" className="text-slate-800 dark:text-slate-100">
                {Math.round(pendingAU * 10) / 10} / {dailyCapacityAU} AU planned
              </span>
              <span
                data-testid="capacity-percentage-metric"
                className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                  isOverCapacity
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-100/70 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                }`}
              >
                {committedPercentage}% capacity
              </span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
              <span data-testid="capacity-available-metric" className={remainingAU >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                {remainingAU >= 0 ? `${remainingAU} AU available` : `${Math.abs(remainingAU)} AU over capacity`}
              </span>
              {resolvedCap.calendarAvailabilityAU !== undefined && (
                <span className="text-[9.5px] text-slate-400" title="Calendar free time inferred availability">
                  Cal: {resolvedCap.calendarAvailabilityAU} AU
                </span>
              )}
            </div>
          </div>

          {/* Consequence Preview Card (when scheduling an estimated task) */}
          {resolvedCurrentTaskAU > 0 && (
            <div
              data-testid="capacity-consequence-card"
              className={`p-2.5 rounded-xl border mb-2 text-xs transition-all ${
                isOverCapacity
                  ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
              }`}
            >
              <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Scheduling Consequence
                </span>
                {isOverCapacity ? (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white animate-pulse">
                    Over Capacity
                  </span>
                ) : (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                    Fits Capacity
                  </span>
                )}
              </div>

              <div className="space-y-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current:</span>
                  <span className="font-semibold">{Math.round(basePlannedAU * 10) / 10} / {dailyCapacityAU} AU</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">+ This task:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(resolvedCurrentTaskAU * 10) / 10} AU</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200/80 dark:border-slate-700/80 font-bold">
                  <span>= Total:</span>
                  <span className={isOverCapacity ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}>
                    {Math.round(totalWithTaskAU * 10) / 10} / {dailyCapacityAU} AU ({committedPercentage}%)
                  </span>
                </div>
              </div>

              {isOverCapacity && (
                <div
                  data-testid="overcapacity-alert"
                  className="mt-2 text-[10.5px] text-rose-700 dark:text-rose-300 font-medium flex items-start space-x-1.5 bg-rose-100/60 dark:bg-rose-900/30 p-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <span>
                    Overcommitted by {overCapacityDelta} AU ({committedPercentage}%). Reality check: You can still schedule this task.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Subheader Badges (Kept for backwards compatibility and task counters) */}
          <div className="flex items-center justify-between mb-2 px-0.5">
            <div className="flex items-center space-x-1">
              {activeTasks.length === 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  {completedTasks.length > 0 ? `All ${completedTasks.length} completed` : '0 tasks due'}
                </span>
              ) : completedTasks.length > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {activeTasks.length} pending • {completedTasks.length} done
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {pendingAU > 0 ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center space-x-1"
                  title="Pending Attention Units (UA/AU)"
                >
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span>{Math.round(pendingAU * 10) / 10} AU</span>
                </span>
              ) : completedAU > 0 ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center space-x-1"
                  title="Completed Attention Units (UA/AU)"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  <span>{Math.round(completedAU * 10) / 10} AU</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Scrollable Tasks List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {/* Active / Pending Tasks */}
            {activeTasks.length > 0 && (
              <>
                {completedTasks.length > 0 && (
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 pt-0.5">
                    Pending ({activeTasks.length})
                  </div>
                )}
                {activeTasks.map((task) => renderTaskRow(task))}
              </>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <>
                {activeTasks.length > 0 && (
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Completed ({completedTasks.length})
                  </div>
                )}
                {completedTasks.map((task) => renderTaskRow(task))}
              </>
            )}
          </div>

          {/* Footer Action: Set as deadline */}
          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              data-testid="select-panel-date"
              onClick={(e) => {
                e.stopPropagation();
                onChange(activePanelDate);
                onClose();
              }}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <span>Set as deadline</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
