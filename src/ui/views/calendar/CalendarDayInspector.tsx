import React, { useState } from 'react';
import { CalendarTaskItem } from './types';
import { CalendarTaskCard } from './CalendarTaskCard';
import {
  AlertTriangle,
  Plus,
  Flame,
  X,
  Maximize2,
  Check,
  Edit2,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { getTodayString, parseDate } from '../../../domain/utils/date';
import { CapacityService } from '../../../domain/services/capacity-service';
import { useApp } from '../../context/AppContext';

interface CalendarDayInspectorProps {
  dateStr: string;
  tasks: CalendarTaskItem[];
  onClose: () => void;
  onOpenFullDay: (dateStr: string) => void;
  onSelectTask: (task: CalendarTaskItem) => void;
  onToggleComplete: (task: CalendarTaskItem) => void;
  onQuickAddTask: (dateStr: string, title: string, au: number) => Promise<void>;
}

export const CalendarDayInspector: React.FC<CalendarDayInspectorProps> = ({
  dateStr,
  tasks,
  onClose,
  onOpenFullDay,
  onSelectTask,
  onToggleComplete,
  onQuickAddTask,
}) => {
  const {
    capacityConfig,
    capacitySnapshots,
    setDailyCapacityOverride,
    formatDateDisplay,
  } = useApp();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAU, setNewTaskAU] = useState(2);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isEditingCap, setIsEditingCap] = useState(false);
  const [capInputValue, setCapInputValue] = useState('');

  const todayStr = getTodayString();
  const isToday = dateStr === todayStr;

  const dateObj = parseDate(dateStr);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayName = dayNames[dateObj.getDay()];

  // Task partitions
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'abandoned');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

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

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return t.status !== 'completed' && t.status !== 'abandoned';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const handleSaveCapacity = async () => {
    const val = parseInt(capInputValue, 10);
    if (!isNaN(val) && val >= 0) {
      await setDailyCapacityOverride(dateStr, val);
    }
    setIsEditingCap(false);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setIsAdding(true);
    try {
      await onQuickAddTask(dateStr, newTaskTitle.trim(), newTaskAU);
      setNewTaskTitle('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <aside
      data-testid="calendar-day-inspector"
      aria-label={`Day details for ${weekdayName}`}
      className="w-80 md:w-96 flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-lg shrink-0 overflow-hidden select-none animate-in slide-in-from-right duration-200"
    >
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {weekdayName}
            </h3>
            {isToday && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                Today
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {formatDateDisplay(dateStr)}
          </p>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => onOpenFullDay(dateStr)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Open in full Day View"
            aria-label="Open in full Day View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close inspector"
            aria-label="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Capacity Reality Check Summary Card */}
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Flame className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {plannedAU} / {dailyCapacityAU} AU
              </span>
            </div>

            {/* Inline Capacity Edit */}
            {isEditingCap ? (
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={capInputValue}
                  onChange={(e) => setCapInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCapacity();
                    if (e.key === 'Escape') setIsEditingCap(false);
                  }}
                  className="w-12 px-1 py-0.5 text-xs rounded border border-emerald-500 bg-white dark:bg-slate-900 text-center font-bold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveCapacity}
                  className="p-1 text-emerald-600 hover:text-emerald-500 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCapInputValue(String(dailyCapacityAU));
                  setIsEditingCap(true);
                }}
                className="inline-flex items-center space-x-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title="Click to adjust daily capacity"
              >
                <span>{capacityResult.isManualOverride ? 'Custom Cap' : `${dailyCapacityAU} AU Cap`}</span>
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
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>{completedAU} AU done</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Add Task Input */}
        <form onSubmit={handleQuickAdd} className="space-y-1.5">
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add task for this day..."
              className="flex-1 px-2 py-1 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
            />
            <div className="flex items-center space-x-1 shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold">AU</span>
              <input
                type="number"
                min="1"
                max="20"
                value={newTaskAU}
                onChange={(e) => setNewTaskAU(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-10 px-1 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold"
              />
              <button
                type="submit"
                disabled={isAdding || !newTaskTitle.trim()}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md transition-colors cursor-pointer"
                title="Add Task"
                aria-label="Add Task"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Tasks Section Header with Filter Tabs */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Scheduled Tasks ({tasks.length})
          </span>

          <div className="flex items-center space-x-0.5 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-md border border-slate-200 dark:border-slate-800">
            {(['all', 'active', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2 py-0.5 text-[10px] rounded capitalize transition-all cursor-pointer ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <CalendarDays className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-emerald-500" />
              <p className="text-xs font-medium">No tasks found</p>
              <p className="text-[10px] opacity-75 mt-0.5">
                {filter !== 'all' ? 'Try switching the filter above' : 'Use the field above to add a task'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
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
      </div>
    </aside>
  );
};
