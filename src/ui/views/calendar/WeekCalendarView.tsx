import React, { useState } from 'react';
import { CalendarTaskItem } from './types';
import { CalendarTaskCard } from './CalendarTaskCard';
import { AlertTriangle, Plus, Check, Edit2 } from 'lucide-react';
import { addDays, getMondayOfWeek, getTodayString, parseDate } from '../../../domain/utils/date';
import { CapacityService } from '../../../domain/services/capacity-service';
import { useApp } from '../../context/AppContext';

interface WeekCalendarViewProps {
  currentDate: string;
  tasksByDate: Map<string, CalendarTaskItem[]>;
  onSelectDay: (dateStr: string) => void;
  onSelectTask: (task: CalendarTaskItem) => void;
  onToggleComplete: (task: CalendarTaskItem) => void;
  onMoveTask: (taskId: string, targetDate: string) => Promise<void>;
  onQuickAddTask: (dateStr: string) => void;
}

export const WeekCalendarView: React.FC<WeekCalendarViewProps> = ({
  currentDate,
  tasksByDate,
  onSelectDay,
  onSelectTask,
  onToggleComplete,
  onMoveTask,
  onQuickAddTask,
}) => {
  const { capacityConfig, capacitySnapshots, setDailyCapacityOverride } = useApp();
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [editingCapacityDate, setEditingCapacityDate] = useState<string | null>(null);
  const [overrideInputValue, setOverrideInputValue] = useState<string>('');

  const todayStr = getTodayString();
  const mondayStr = getMondayOfWeek(currentDate);

  // Generate 7 days (Mon-Sun)
  const weekDays: { dateStr: string; weekdayName: string; shortDate: string }[] = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (let i = 0; i < 7; i++) {
    const dStr = addDays(mondayStr, i);
    const dObj = parseDate(dStr);
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dObj.getMonth()];
    weekDays.push({
      dateStr: dStr,
      weekdayName: dayNames[i],
      shortDate: `${monthAbbr} ${dObj.getDate()}`,
    });
  }

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

  const startEditCapacity = (dateStr: string, currentCap: number) => {
    setEditingCapacityDate(dateStr);
    setOverrideInputValue(String(currentCap));
  };

  const saveCapacityOverride = async (dateStr: string) => {
    const num = parseInt(overrideInputValue, 10);
    if (!isNaN(num) && num >= 0) {
      await setDailyCapacityOverride(dateStr, num);
    }
    setEditingCapacityDate(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
      {/* 7 Day Columns Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-2 p-2 sm:p-3 overflow-x-auto overflow-y-auto min-h-0">
        {weekDays.map((day) => {
          const { dateStr, weekdayName, shortDate } = day;
          const isToday = dateStr === todayStr;
          const dayTasks = tasksByDate.get(dateStr) || [];
          const activeTasks = dayTasks.filter((t) => t.status !== 'completed' && t.status !== 'abandoned');
          const completedTasks = dayTasks.filter((t) => t.status === 'completed');

          const plannedAU = activeTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
          const completedAU = completedTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);

          // Capacity calculation
          const capacityResult = CapacityService.resolveDailyCapacity(dateStr, capacityConfig, {
            historicalSnapshots: capacitySnapshots,
          });
          const dailyCapacityAU = capacityResult.effectiveCapacityAU;
          const isOverloaded = plannedAU > dailyCapacityAU;
          const overloadDelta = isOverloaded ? plannedAU - dailyCapacityAU : 0;
          const remainingAU = Math.max(0, dailyCapacityAU - plannedAU);
          const percentage = dailyCapacityAU > 0 ? Math.round((plannedAU / dailyCapacityAU) * 100) : 0;

          const isCellDragOver = dragOverDate === dateStr;
          const isEditingThisCap = editingCapacityDate === dateStr;

          return (
            <div
              key={dateStr}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDragLeave={(e) => handleDragLeave(e, dateStr)}
              onDrop={(e) => handleDrop(e, dateStr)}
              className={`flex flex-col rounded-xl border transition-all min-h-[300px] md:min-h-0 overflow-hidden ${
                isToday
                  ? 'bg-white/95 dark:bg-slate-900 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30'
                  : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800'
              } ${
                isCellDragOver
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20'
                  : ''
              }`}
            >
              {/* Column Header Card */}
              <div
                className={`p-2.5 sm:p-3 border-b border-slate-200/80 dark:border-slate-800 transition-colors ${
                  isToday
                    ? 'bg-emerald-500/5 dark:bg-emerald-950/20'
                    : 'bg-slate-50/70 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectDay(dateStr)}
                    className="flex items-baseline space-x-1.5 text-left group/title cursor-pointer"
                  >
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover/title:text-emerald-600 dark:group-hover/title:text-emerald-400 transition-colors">
                      {weekdayName.slice(0, 3)}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {shortDate}
                    </span>
                  </button>

                  {isToday && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                      Today
                    </span>
                  )}
                </div>

                {/* AU Workload & Reality Check Metrics */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {plannedAU} / {dailyCapacityAU} AU
                    </span>

                    {/* Inline Capacity Override */}
                    {isEditingThisCap ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={overrideInputValue}
                          onChange={(e) => setOverrideInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCapacityOverride(dateStr);
                            if (e.key === 'Escape') setEditingCapacityDate(null);
                          }}
                          className="w-12 px-1 py-0.5 text-xs rounded border border-emerald-500 bg-white dark:bg-slate-900 text-center font-bold"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => saveCapacityOverride(dateStr)}
                          className="p-1 text-emerald-600 hover:text-emerald-500 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditCapacity(dateStr, dailyCapacityAU)}
                        className="inline-flex items-center space-x-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        title={`Source: ${capacityResult.source}. Click to override AU capacity`}
                      >
                        <span>{capacityResult.isManualOverride ? 'Custom' : `${dailyCapacityAU} Cap`}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
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

                  {/* Reality Check Status / Overcapacity Alert */}
                  <div className="flex items-center justify-between text-[10px]">
                    {isOverloaded ? (
                      <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-bold">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>+{overloadDelta} AU over ({percentage}%)</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {remainingAU} AU left ({percentage}%)
                      </span>
                    )}

                    {completedAU > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {completedAU} AU done
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasks List Drop Target */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0">
                {dayTasks.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-lg">
                    <p className="text-[11px]">No tasks</p>
                    <p className="text-[10px] opacity-75">Drag task here</p>
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <CalendarTaskCard
                      key={task.id}
                      task={task}
                      variant="standard"
                      onSelectTask={onSelectTask}
                      onToggleComplete={onToggleComplete}
                    />
                  ))
                )}
              </div>

              {/* Quick Add Task Button */}
              <div className="p-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30">
                <button
                  type="button"
                  onClick={() => onQuickAddTask(dateStr)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/20 transition-colors border border-dashed border-slate-300 dark:border-slate-700/80 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
