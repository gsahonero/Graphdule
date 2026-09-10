import React, { useState } from 'react';
import { CalendarTaskItem } from './types';
import { CalendarTaskCard } from './CalendarTaskCard';
import { AlertTriangle, Plus } from 'lucide-react';
import { formatDate, getTodayString } from '../../../domain/utils/date';
import { CapacityService } from '../../../domain/services/capacity-service';
import { useApp } from '../../context/AppContext';

interface MonthCalendarViewProps {
  viewYear: number;
  viewMonth: number; // 0-indexed
  tasksByDate: Map<string, CalendarTaskItem[]>;
  onSelectDay: (dateStr: string) => void;
  onSelectTask: (task: CalendarTaskItem) => void;
  onToggleComplete: (task: CalendarTaskItem) => void;
  onMoveTask: (taskId: string, targetDate: string) => Promise<void>;
  onQuickAddTask: (dateStr: string) => void;
}

export const MonthCalendarView: React.FC<MonthCalendarViewProps> = ({
  viewYear,
  viewMonth,
  tasksByDate,
  onSelectDay,
  onSelectTask,
  onToggleComplete,
  onMoveTask,
  onQuickAddTask,
}) => {
  const { capacityConfig, capacitySnapshots } = useApp();
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const todayStr = getTodayString();

  // Compute month cells (Monday - Sunday)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  // Monday-based offset: Mon = 0, Tue = 1, ... Sun = 6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  // Previous month trailing days
  const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
  const prevMonthDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const dateObj = new Date(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1, d);
    prevMonthDays.push({
      dateStr: formatDate(dateObj),
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Current month days
  const currentMonthDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    currentMonthDays.push({
      dateStr: formatDate(dateObj),
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete grid rows
  const totalDaysSoFar = prevMonthDays.length + currentMonthDays.length;
  const remainingCells = (7 - (totalDaysSoFar % 7)) % 7;
  const nextMonthDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
  for (let d = 1; d <= remainingCells; d++) {
    const dateObj = new Date(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, d);
    nextMonthDays.push({
      dateStr: formatDate(dateObj),
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  const allCells = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  const weekdayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, dateStr: string) => {
    if (dragOverDate === dateStr) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      await onMoveTask(taskId, dateStr);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden select-none">
      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
        {weekdayHeaders.map((day, idx) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-semibold uppercase tracking-wider ${
              idx >= 5
                ? 'text-slate-400 dark:text-slate-500'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 dark:bg-slate-800/80 p-px overflow-y-auto min-h-0">
        {allCells.map((cell) => {
          const { dateStr, dayNum, isCurrentMonth } = cell;
          const isToday = dateStr === todayStr;
          const dayTasks = tasksByDate.get(dateStr) || [];
          const activeTasks = dayTasks.filter((t) => t.status !== 'completed' && t.status !== 'abandoned');

          const plannedAU = activeTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);

          // Capacity calculation
          const capacityResult = CapacityService.resolveDailyCapacity(dateStr, capacityConfig, {
            historicalSnapshots: capacitySnapshots,
          });
          const dailyCapacityAU = capacityResult.effectiveCapacityAU;
          const isOverloaded = plannedAU > dailyCapacityAU;
          const overloadDelta = isOverloaded ? plannedAU - dailyCapacityAU : 0;
          const percentage = dailyCapacityAU > 0 ? Math.round((plannedAU / dailyCapacityAU) * 100) : 0;

          const isCellDragOver = dragOverDate === dateStr;

          // Max visible tasks in compact month cell
          const MAX_VISIBLE = 3;
          const visibleTasks = dayTasks.slice(0, MAX_VISIBLE);
          const hiddenCount = Math.max(0, dayTasks.length - MAX_VISIBLE);

          return (
            <div
              key={dateStr}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDragLeave={(e) => handleDragLeave(e, dateStr)}
              onDrop={(e) => handleDrop(e, dateStr)}
              className={`flex flex-col p-1.5 min-h-[95px] sm:min-h-[115px] transition-colors relative group/cell ${
                !isCurrentMonth
                  ? 'bg-slate-50/50 dark:bg-slate-950/30 text-slate-400 dark:text-slate-600'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
              } ${
                isCellDragOver
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 z-10'
                  : ''
              }`}
            >
              {/* Day Cell Header */}
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => onSelectDay(dateStr)}
                  className={`flex items-center justify-center text-xs font-semibold rounded-md w-6 h-6 transition-transform hover:scale-110 cursor-pointer ${
                    isToday
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                  title="Open Day View"
                >
                  {dayNum}
                </button>

                {/* AU Workload & Reality Check Ratio */}
                <div className="flex items-center space-x-1">
                  {isOverloaded ? (
                    <span
                      title={`Over capacity by ${overloadDelta} AU! Planned: ${plannedAU} AU, Capacity: ${dailyCapacityAU} AU (${percentage}%)`}
                      className="inline-flex items-center space-x-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse"
                    >
                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      <span>{plannedAU}/{dailyCapacityAU} AU</span>
                    </span>
                  ) : plannedAU > 0 ? (
                    <span
                      title={`Planned: ${plannedAU} AU, Capacity: ${dailyCapacityAU} AU (${percentage}%)`}
                      className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium ${
                        percentage >= 85
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {plannedAU}/{dailyCapacityAU} AU
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 dark:text-slate-600 opacity-60">
                      {dailyCapacityAU} AU
                    </span>
                  )}

                  {/* Quick Add Button (visible on hover) */}
                  <button
                    type="button"
                    onClick={() => onQuickAddTask(dateStr)}
                    className="opacity-0 group-hover/cell:opacity-100 p-0.5 rounded text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity cursor-pointer"
                    title={`Add task for ${dateStr}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Progress bar line under cell header */}
              {dailyCapacityAU > 0 && plannedAU > 0 && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mb-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverloaded
                        ? 'bg-rose-500'
                        : percentage >= 85
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              )}

              {/* Tasks List */}
              <div className="flex-1 space-y-1 overflow-hidden min-h-0">
                {visibleTasks.map((task) => (
                  <CalendarTaskCard
                    key={task.id}
                    task={task}
                    variant="compact"
                    onSelectTask={onSelectTask}
                    onToggleComplete={onToggleComplete}
                  />
                ))}

                {/* Overflow Pill */}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(dateStr)}
                    className="w-full text-center py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
