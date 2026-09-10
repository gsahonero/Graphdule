import React, { useState, useMemo } from 'react';
import { CalendarViewMode, CalendarTaskItem } from './types';
import { MonthCalendarView } from './MonthCalendarView';
import { WeekCalendarView } from './WeekCalendarView';
import { DayCalendarView } from './DayCalendarView';
import { CalendarTaskDetailModal } from './CalendarTaskDetailModal';
import { useApp } from '../../context/AppContext';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Search,
  X,
} from 'lucide-react';
import {
  addDays,
  formatDate,
  getMondayOfWeek,
  getTodayString,
  parseDate,
} from '../../../domain/utils/date';
import { CapacityService } from '../../../domain/services/capacity-service';
import { NodeStatus } from '../../../domain/models/types';

export const TaskCalendarView: React.FC = () => {
  const {
    allActiveNodes,
    activeProjectDoc,
    standaloneTasks,
    projects,
    moveNodeDate,
    updateNode,
    updateStandaloneTask,
    capacityConfig,
    capacitySnapshots,
    formatDateDisplay,
    addStandaloneTask,
  } = useApp();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<string>(getTodayString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<CalendarTaskItem | null>(null);

  const parsedCurrent = parseDate(currentDate);
  const viewYear = isNaN(parsedCurrent.getTime()) ? new Date().getFullYear() : parsedCurrent.getFullYear();
  const viewMonth = isNaN(parsedCurrent.getTime()) ? new Date().getMonth() : parsedCurrent.getMonth();

  // Project map lookup for names and styles
  const projectMap = useMemo(() => {
    const map = new Map<string, { name: string; style?: any }>();
    projects?.forEach((p) => {
      map.set(p.id, { name: p.name, style: p.style });
    });
    if (activeProjectDoc?.project) {
      map.set(activeProjectDoc.project.id, {
        name: activeProjectDoc.project.name,
        style: activeProjectDoc.project.style,
      });
    }
    return map;
  }, [projects, activeProjectDoc]);

  // Aggregate Graphdule Tasks by Due Date (STRICTLY NO Google Calendar Events)
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTaskItem[]>();

    // Gather project nodes
    const nodeMap = new Map<string, typeof allActiveNodes[number]>();
    allActiveNodes?.forEach((n) => nodeMap.set(n.id, n));
    activeProjectDoc?.nodes?.forEach((n) => nodeMap.set(n.id, n));

    nodeMap.forEach((node) => {
      if (node.dueDate && node.status !== 'abandoned') {
        const proj = node.projectId ? projectMap.get(node.projectId) : undefined;
        const item: CalendarTaskItem = {
          id: node.id,
          text: node.text,
          dueDate: node.dueDate,
          status: node.status,
          estimatedAU: node.estimatedAU,
          projectId: node.projectId || activeProjectDoc?.project.id,
          projectName: proj?.name || activeProjectDoc?.project.name || 'Project Task',
          projectStyle: proj?.style,
          isStandalone: false,
          parentNodeId: node.parentNodeId,
        };
        const list = map.get(node.dueDate);
        if (list) list.push(item);
        else map.set(node.dueDate, [item]);
      }
    });

    // Gather standalone tasks
    standaloneTasks?.forEach((st) => {
      if (st.dueDate && st.status !== 'abandoned') {
        const item: CalendarTaskItem = {
          id: st.id,
          text: st.text,
          dueDate: st.dueDate,
          status: st.status,
          estimatedAU: st.estimatedAU,
          projectName: 'Standalone',
          isStandalone: true,
        };
        const list = map.get(st.dueDate);
        if (list) list.push(item);
        else map.set(st.dueDate, [item]);
      }
    });

    // Filter by search query and project
    if (searchQuery.trim() || selectedProjectId !== 'all') {
      const q = searchQuery.toLowerCase().trim();
      const filteredMap = new Map<string, CalendarTaskItem[]>();

      map.forEach((items, dateKey) => {
        const filtered = items.filter((item) => {
          if (q && !item.text.toLowerCase().includes(q)) return false;
          if (selectedProjectId !== 'all') {
            if (selectedProjectId === 'standalone') return item.isStandalone;
            return item.projectId === selectedProjectId;
          }
          return true;
        });
        if (filtered.length > 0) {
          filteredMap.set(dateKey, filtered);
        }
      });
      return filteredMap;
    }

    return map;
  }, [allActiveNodes, activeProjectDoc, standaloneTasks, projectMap, searchQuery, selectedProjectId]);

  // Date Navigation Handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      const prev = new Date(viewYear, viewMonth - 1, 1);
      setCurrentDate(formatDate(prev));
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      const next = new Date(viewYear, viewMonth + 1, 1);
      setCurrentDate(formatDate(next));
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(getTodayString());
  };

  // Dynamic Header Title
  const periodTitle = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    if (viewMode === 'month') {
      return `${monthNames[viewMonth]} ${viewYear}`;
    }
    if (viewMode === 'week') {
      const monStr = getMondayOfWeek(currentDate);
      const sunStr = addDays(monStr, 6);
      const monObj = parseDate(monStr);
      const sunObj = parseDate(sunStr);
      const monMonth = monthNames[monObj.getMonth()].slice(0, 3);
      const sunMonth = monthNames[sunObj.getMonth()].slice(0, 3);
      if (monObj.getMonth() === sunObj.getMonth()) {
        return `${monMonth} ${monObj.getDate()} – ${sunObj.getDate()}, ${monObj.getFullYear()}`;
      }
      return `${monMonth} ${monObj.getDate()} – ${sunMonth} ${sunObj.getDate()}, ${sunObj.getFullYear()}`;
    }
    const dObj = parseDate(currentDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${dayNames[dObj.getDay()]}, ${monthNames[dObj.getMonth()]} ${dObj.getDate()}, ${dObj.getFullYear()}`;
  }, [viewMode, currentDate, viewYear, viewMonth]);

  // Overall Visible Period Workload Reality Summary
  const periodWorkloadSummary = useMemo(() => {
    let totalPlanned = 0;
    let totalCapacity = 0;

    if (viewMode === 'month') {
      const last = new Date(viewYear, viewMonth + 1, 0);
      for (let d = 1; d <= last.getDate(); d++) {
        const dStr = formatDate(new Date(viewYear, viewMonth, d));
        const tasks = tasksByDate.get(dStr) || [];
        const planned = tasks
          .filter((t) => t.status !== 'completed' && t.status !== 'abandoned')
          .reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
        totalPlanned += planned;
        const cap = CapacityService.resolveDailyCapacity(dStr, capacityConfig, {
          historicalSnapshots: capacitySnapshots,
        });
        totalCapacity += cap.effectiveCapacityAU;
      }
    } else if (viewMode === 'week') {
      const mon = getMondayOfWeek(currentDate);
      for (let i = 0; i < 7; i++) {
        const dStr = addDays(mon, i);
        const tasks = tasksByDate.get(dStr) || [];
        const planned = tasks
          .filter((t) => t.status !== 'completed' && t.status !== 'abandoned')
          .reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
        totalPlanned += planned;
        const cap = CapacityService.resolveDailyCapacity(dStr, capacityConfig, {
          historicalSnapshots: capacitySnapshots,
        });
        totalCapacity += cap.effectiveCapacityAU;
      }
    } else {
      const tasks = tasksByDate.get(currentDate) || [];
      totalPlanned = tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'abandoned')
        .reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
      const cap = CapacityService.resolveDailyCapacity(currentDate, capacityConfig, {
        historicalSnapshots: capacitySnapshots,
      });
      totalCapacity = cap.effectiveCapacityAU;
    }

    const percentage = totalCapacity > 0 ? Math.round((totalPlanned / totalCapacity) * 100) : 0;
    const isOverloaded = totalPlanned > totalCapacity;
    const delta = isOverloaded ? totalPlanned - totalCapacity : 0;
    return { totalPlanned, totalCapacity, percentage, isOverloaded, delta };
  }, [viewMode, currentDate, viewYear, viewMonth, tasksByDate, capacityConfig, capacitySnapshots]);

  // Move Task Handler (Immediate reactive update)
  const handleMoveTask = async (taskId: string, targetDate: string) => {
    try {
      await moveNodeDate(taskId, targetDate, true);
    } catch (err) {
      console.error('Failed to move task date:', err);
    }
  };

  // Toggle Completion Status
  const handleToggleComplete = async (task: CalendarTaskItem) => {
    const nextStatus: NodeStatus = task.status === 'completed' ? 'planned' : 'completed';
    try {
      if (task.isStandalone) {
        const existing = standaloneTasks.find((st) => st.id === task.id);
        if (existing) {
          await updateStandaloneTask({
            ...existing,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        const existingNode = allActiveNodes.find((n) => n.id === task.id);
        if (existingNode) {
          await updateNode({
            ...existingNode,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error('Failed to toggle task completion:', err);
    }
  };

  // Quick Add Task Prompt
  const handleQuickAddTask = async (dateStr: string) => {
    const title = window.prompt(`Add new task for ${formatDateDisplay(dateStr)}:`);
    if (title && title.trim()) {
      await addStandaloneTask(title.trim(), dateStr, undefined, 2);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 sm:px-6 sm:py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        {/* Navigation & Title */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="calendar-today-btn"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
            {periodTitle}
          </h1>

          {/* Period AU Workload Reality Check Badge */}
          <div
            title={`Period Workload: ${periodWorkloadSummary.totalPlanned} planned AU out of ${periodWorkloadSummary.totalCapacity} capacity AU (${periodWorkloadSummary.percentage}%)`}
            className={`hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              periodWorkloadSummary.isOverloaded
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : periodWorkloadSummary.percentage >= 85
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>
              {periodWorkloadSummary.totalPlanned} / {periodWorkloadSummary.totalCapacity} AU (
              {periodWorkloadSummary.percentage}%)
            </span>
            {periodWorkloadSummary.isOverloaded && (
              <span className="font-bold ml-0.5">⚠️ +{periodWorkloadSummary.delta} AU</span>
            )}
          </div>
        </div>

        {/* View Mode Switcher & Filters */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-32 sm:w-44 pl-8 pr-6 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All Projects</option>
            <option value="standalone">Standalone Tasks</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-testid={`view-mode-${mode}`}
                aria-label={`${mode} view`}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs border border-slate-200 dark:border-transparent'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar View Area */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'month' && (
          <MonthCalendarView
            viewYear={viewYear}
            viewMonth={viewMonth}
            tasksByDate={tasksByDate}
            onSelectDay={(dateStr) => {
              setCurrentDate(dateStr);
              setViewMode('day');
            }}
            onSelectTask={(task) => setSelectedTaskForModal(task)}
            onToggleComplete={handleToggleComplete}
            onMoveTask={handleMoveTask}
            onQuickAddTask={handleQuickAddTask}
          />
        )}

        {viewMode === 'week' && (
          <WeekCalendarView
            currentDate={currentDate}
            tasksByDate={tasksByDate}
            onSelectDay={(dateStr) => {
              setCurrentDate(dateStr);
              setViewMode('day');
            }}
            onSelectTask={(task) => setSelectedTaskForModal(task)}
            onToggleComplete={handleToggleComplete}
            onMoveTask={handleMoveTask}
            onQuickAddTask={handleQuickAddTask}
          />
        )}

        {viewMode === 'day' && (
          <DayCalendarView
            currentDate={currentDate}
            tasksByDate={tasksByDate}
            onChangeDate={(newDate) => setCurrentDate(newDate)}
            onSelectTask={(task) => setSelectedTaskForModal(task)}
            onToggleComplete={handleToggleComplete}
          />
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskForModal && (
        <CalendarTaskDetailModal
          task={selectedTaskForModal}
          onClose={() => setSelectedTaskForModal(null)}
        />
      )}
    </div>
  );
};
export default TaskCalendarView;
