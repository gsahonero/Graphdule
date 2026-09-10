import React, { useState } from 'react';
import { CalendarTaskItem } from './types';
import { CalendarTaskCard } from './CalendarTaskCard';
import {
  AlertTriangle,
  Plus,
  Flame,
  ChevronLeft,
  ChevronRight,
  Edit2,
  CalendarDays,
} from 'lucide-react';
import { addDays, getTodayString, parseDate } from '../../../domain/utils/date';
import { CapacityService } from '../../../domain/services/capacity-service';
import { useApp } from '../../context/AppContext';

interface DayCalendarViewProps {
  currentDate: string;
  tasksByDate: Map<string, CalendarTaskItem[]>;
  onChangeDate: (newDate: string) => void;
  onSelectTask: (task: CalendarTaskItem) => void;
  onToggleComplete: (task: CalendarTaskItem) => void;
}

export const DayCalendarView: React.FC<DayCalendarViewProps> = ({
  currentDate,
  tasksByDate,
  onChangeDate,
  onSelectTask,
  onToggleComplete,
}) => {
  const {
    capacityConfig,
    capacitySnapshots,
    setDailyCapacityOverride,
    formatDateDisplay,
    addStandaloneTask,
  } = useApp();

  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAU, setNewTaskAU] = useState<number>(2);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState('');

  const todayStr = getTodayString();
  const isToday = currentDate === todayStr;

  const dateObj = parseDate(currentDate);
  const weekdayName = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][dateObj.getDay()];

  const dayTasks = tasksByDate.get(currentDate) || [];
  const activeTasks = dayTasks.filter((t) => t.status !== 'completed' && t.status !== 'abandoned');
  const inProgressTasks = dayTasks.filter((t) => t.status === 'in_progress');
  const completedTasks = dayTasks.filter((t) => t.status === 'completed');

  const plannedAU = activeTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
  const inProgressAU = inProgressTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
  const completedAU = completedTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);

  // Capacity calculation
  const capacityResult = CapacityService.resolveDailyCapacity(currentDate, capacityConfig, {
    historicalSnapshots: capacitySnapshots,
  });
  const dailyCapacityAU = capacityResult.effectiveCapacityAU;
  const isOverloaded = plannedAU > dailyCapacityAU;
  const overloadDelta = isOverloaded ? plannedAU - dailyCapacityAU : 0;
  const remainingAU = Math.max(0, dailyCapacityAU - plannedAU);
  const percentage = dailyCapacityAU > 0 ? Math.round((plannedAU / dailyCapacityAU) * 100) : 0;

  const filteredTasks = dayTasks.filter((t) => {
    if (filter === 'active') return t.status !== 'completed' && t.status !== 'abandoned';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const handleSaveCapacity = async () => {
    const val = parseInt(capacityInput, 10);
    if (!isNaN(val) && val >= 0) {
      await setDailyCapacityOverride(currentDate, val);
    }
    setIsEditingCapacity(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    await addStandaloneTask(newTaskText.trim(), currentDate, undefined, newTaskAU);
    setNewTaskText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto select-none p-3 sm:p-6 max-w-4xl mx-auto w-full">
      {/* Date Header & Quick Prev / Next Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onChangeDate(addDays(currentDate, -1))}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {weekdayName}
              </h2>
              {isToday && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                  Today
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {formatDateDisplay(currentDate)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onChangeDate(addDays(currentDate, 1))}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date Jump Button */}
        <div className="flex items-center space-x-2">
          {!isToday && (
            <button
              type="button"
              onClick={() => onChangeDate(todayStr)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs"
            >
              Jump to Today
            </button>
          )}
        </div>
      </div>

      {/* Prominent AU Workload & Reality Check Dashboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Daily AU Capacity & Reality Check
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Source:{' '}
              <strong className="text-slate-700 dark:text-slate-300 capitalize font-medium">
                {capacityResult.isManualOverride
                  ? 'Manual Day Override'
                  : capacityResult.calendarAvailabilityAU !== undefined
                  ? 'Google Calendar Availability'
                  : capacityResult.confidence && capacityResult.confidence > 0
                  ? 'Historical Observed Average'
                  : 'Weekday Default'}
              </strong>
            </p>
          </div>

          {/* Frictionless Daily Capacity Override */}
          <div className="flex items-center space-x-2">
            {isEditingCapacity ? (
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  className="w-16 px-2 py-1 text-xs rounded border border-emerald-500 bg-white dark:bg-slate-950 text-center font-bold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveCapacity}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-500 cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCapacity(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCapacityInput(String(dailyCapacityAU));
                  setIsEditingCapacity(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Edit2 className="w-3 h-3 text-slate-400" />
                <span>Adjust Capacity ({dailyCapacityAU} AU)</span>
              </button>
            )}
          </div>
        </div>

        {/* Gauge & Main Workload Stats */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {plannedAU}
                </span>
                <span className="text-lg font-bold text-slate-400 dark:text-slate-500">
                  / {dailyCapacityAU} AU Planned
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isOverloaded ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Over capacity by {overloadDelta} Attention Units ({percentage}% committed)</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {remainingAU} Attention Units available ({percentage}% committed)
                  </span>
                )}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${
                  isOverloaded
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : percentage >= 85
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {percentage}% Committed
              </span>
            </div>
          </div>

          {/* Large Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOverloaded
                  ? 'bg-rose-500'
                  : percentage >= 85
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>

          {/* Sub-metrics Breakdown Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                In Progress
              </span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {inProgressAU} AU
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Planned / Pending
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {plannedAU - inProgressAU} AU
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Completed
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {completedAU} AU
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Task Form */}
      <form
        onSubmit={handleCreateTask}
        className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl shadow-2xs mb-6"
      >
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder={`Add task for ${weekdayName}...`}
          className="flex-1 px-3 py-2 text-sm bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
        />

        <div className="flex items-center space-x-1.5 pr-1">
          <span className="text-xs font-semibold text-slate-400">AU:</span>
          <input
            type="number"
            min="1"
            max="20"
            value={newTaskAU}
            onChange={(e) => setNewTaskAU(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center font-bold"
          />
          <button
            type="submit"
            className="flex items-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
      </form>

      {/* Tasks Section Header & Filter Tabs */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Scheduled Tasks ({dayTasks.length})
        </h4>

        <div className="flex items-center space-x-1 bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-800">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p className="text-sm font-medium">No tasks found for this view</p>
            <p className="text-xs opacity-75 mt-1">
              {filter !== 'all' ? 'Try switching the filter above or' : 'Use the field above to'} add a task for this day.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <CalendarTaskCard
              key={task.id}
              task={task}
              variant="expanded"
              onSelectTask={onSelectTask}
              onToggleComplete={onToggleComplete}
            />
          ))
        )}
      </div>
    </div>
  );
};
