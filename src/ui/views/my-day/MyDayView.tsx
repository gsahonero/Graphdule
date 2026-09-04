import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MyDayService } from '../../../domain/services/my-day-service';
import { getTodayString, isBefore, isAfter } from '../../../domain/utils/date';
import { CalendarPicker } from '../../components/CalendarPicker';
import { RecurrencePicker } from '../../components/RecurrencePicker';
import {
  Sun,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Folder,
  Clock,
  ChevronRight,
  ChevronDown,
  Calendar,
  ListTodo,
  CalendarDays,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { NodeStatus, RecurrenceRule } from '../../../domain/models/types';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';

export const MyDayView: React.FC = () => {
  const {
    projects,
    allActiveNodes,
    standaloneTasks,
    preferences,
    updatePreferences,
    openProject,
    updateNodeStatus,
    addStandaloneTask,
    updateStandaloneTask,
    updateStandaloneTaskStatus,
    deleteStandaloneTask,
    formatDateDisplay,
    refreshData,
  } = useApp();

  const [newStandaloneText, setNewStandaloneText] = useState('');
  const [newStandaloneDueDate, setNewStandaloneDueDate] = useState(getTodayString());
  const [newStandaloneRecurrence, setNewStandaloneRecurrence] = useState<RecurrenceRule | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Collapsible & filter state for Other / All Standalone Tasks
  const [isAllStandaloneOpen, setIsAllStandaloneOpen] = useState(true);
  const [standaloneFilter, setStandaloneFilter] = useState<'all' | 'upcoming' | 'overdue'>('all');
  const [activeCalendarTaskId, setActiveCalendarTaskId] = useState<string | null>(null);

  // Map projectId -> project summary for quick label lookups
  const projectsMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  // Ensure data is freshly updated on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const today = getTodayString();
  const myDayData = MyDayService.getMyDayTasks(
    allActiveNodes,
    standaloneTasks,
    preferences.myDayMode,
    today
  );

  // Incomplete standalone tasks that are NOT in today's main list
  const otherStandaloneTasks = useMemo(() => {
    const currentListIds = new Set(myDayData.standaloneTasks.map((t) => t.id));
    return standaloneTasks
      .filter((t) => !currentListIds.has(t.id) && t.status !== 'completed')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [standaloneTasks, myDayData.standaloneTasks]);

  const upcomingStandaloneTasks = useMemo(() => {
    return otherStandaloneTasks.filter((t) => isAfter(t.dueDate, today));
  }, [otherStandaloneTasks, today]);

  const overdueStandaloneTasks = useMemo(() => {
    return otherStandaloneTasks.filter((t) => isBefore(t.dueDate, today));
  }, [otherStandaloneTasks, today]);

  const filteredOtherTasks = useMemo(() => {
    if (standaloneFilter === 'upcoming') return upcomingStandaloneTasks;
    if (standaloneFilter === 'overdue') return overdueStandaloneTasks;
    return otherStandaloneTasks;
  }, [standaloneFilter, otherStandaloneTasks, upcomingStandaloneTasks, overdueStandaloneTasks]);

  const handleAddStandalone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStandaloneText.trim()) return;
    await addStandaloneTask(newStandaloneText.trim(), newStandaloneDueDate, newStandaloneRecurrence);
    setNewStandaloneText('');
    setNewStandaloneRecurrence(undefined);
  };

  const handleToggleNodeStatus = async (nodeId: string, currentStatus: NodeStatus) => {
    const newStatus: NodeStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    await updateNodeStatus(nodeId, newStatus);
  };

  const handleToggleStandaloneStatus = (taskId: string, currentStatus: NodeStatus) => {
    const newStatus: NodeStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    updateStandaloneTaskStatus(taskId, newStatus);
  };

  const handleModeChange = async (mode: 'today' | 'current_tasks') => {
    await updatePreferences({ myDayMode: mode });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full space-y-8">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Sun className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              My Day
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Right Header Controls: Force Refresh & Mode Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            title="Force refresh tasks from all projects"
          >
            <RotateCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Force Update'}</span>
          </button>

          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => handleModeChange('today')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                preferences.myDayMode === 'today'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Today's Tasks
            </button>
            <button
              onClick={() => handleModeChange('current_tasks')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                preferences.myDayMode === 'current_tasks'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Current Tasks
            </button>
          </div>
        </div>
      </div>

      {/* Fallback Notice for Current Tasks */}
      {myDayData.isFallback && preferences.myDayMode === 'current_tasks' && (
        <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-300">
          <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>
            No incomplete tasks scheduled specifically for today. Showing your most recent active and overdue tasks.
          </span>
        </div>
      )}

      {/* 1. Project Tasks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Project Tasks
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {myDayData.projectTasks.length}
            </span>
          </div>
        </div>

        {myDayData.projectTasks.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500">
            No project tasks scheduled for today across your active projects.
          </div>
        ) : (
          <div className="space-y-2">
            {myDayData.projectTasks.map((task) => {
              const project = task.projectId ? projectsMap.get(task.projectId) : undefined;
              const projectTheme = getProjectColorTheme(project?.style?.color);
              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between group transition-all shadow-sm"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <button
                      onClick={() => handleToggleNodeStatus(task.id, task.status)}
                      className="text-slate-400 hover:text-emerald-500 transition-colors shrink-0 cursor-pointer"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <span
                      className={`text-xs font-medium text-slate-800 dark:text-slate-200 truncate ${
                        task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                      }`}
                    >
                      {task.text}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2.5 shrink-0 ml-4">
                    {/* Project Name Badge with Custom Icon & Color Theme */}
                    {task.projectId && (
                      <button
                        onClick={() => openProject(task.projectId!)}
                        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium ${projectTheme.badgeBg} hover:opacity-85 transition-all cursor-pointer max-w-[140px] truncate shadow-xs`}
                        title={`Open project "${project?.name || 'Project'}"`}
                      >
                        <ProjectIconDisplay icon={project?.style?.icon} emoji={project?.style?.emoji} className="w-3 h-3 shrink-0" />
                        <span className="truncate">{project?.name || 'Project'}</span>
                      </button>
                    )}

                    <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      {formatDateDisplay(task.dueDate)}
                    </span>

                    {task.projectId && (
                      <button
                        onClick={() => openProject(task.projectId!)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Open Project Graph"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Standalone Tasks Section */}
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-teal-500 dark:text-teal-400" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Standalone Tasks
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {myDayData.standaloneTasks.length}
            </span>
          </div>
        </div>

        {/* Inline Add Standalone Task */}
        <form onSubmit={handleAddStandalone} className="flex items-center space-x-2">
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              placeholder="Add a standalone task (e.g. Call dentist, buy printer paper)..."
              value={newStandaloneText}
              onChange={(e) => setNewStandaloneText(e.target.value)}
              className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg py-2.5 pl-3 pr-48 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              {/* Recurrence Selector */}
              <RecurrencePicker
                value={newStandaloneRecurrence}
                baseDate={newStandaloneDueDate}
                onChange={setNewStandaloneRecurrence}
                buttonVariant={newStandaloneRecurrence ? 'badge' : 'icon'}
                align="right"
              />

              {/* Due Date Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  className="flex items-center space-x-1 px-2 py-1 text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-md transition-colors cursor-pointer group/cal"
                  title="Click to select due date"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover/cal:text-emerald-500 transition-colors shrink-0" />
                  <span>{formatDateDisplay(newStandaloneDueDate)}</span>
                </button>

                {isCalendarOpen && (
                  <CalendarPicker
                    value={newStandaloneDueDate}
                    onChange={(newDate) => setNewStandaloneDueDate(newDate)}
                    onClose={() => setIsCalendarOpen(false)}
                    position="bottom"
                    align="right"
                  />
                )}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={!newStandaloneText.trim()}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors shrink-0 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {myDayData.standaloneTasks.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500">
            No active standalone tasks. Tasks created here exist outside project graphs.
          </div>
        ) : (
          <div className="space-y-2">
            {myDayData.standaloneTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between group transition-all shadow-sm"
              >
                <div className="flex items-center space-x-3 truncate">
                  <button
                    onClick={() => handleToggleStandaloneStatus(task.id, task.status)}
                    className="text-slate-400 hover:text-teal-500 transition-colors shrink-0 cursor-pointer"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <span
                    className={`text-xs font-medium text-slate-800 dark:text-slate-200 truncate ${
                      task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                    }`}
                  >
                    {task.text}
                  </span>
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  {/* Recurrence Badge / Picker */}
                  <RecurrencePicker
                    value={task.recurrence}
                    baseDate={task.dueDate}
                    onChange={(newRule) => updateStandaloneTask({ ...task, recurrence: newRule })}
                    buttonVariant={task.recurrence ? 'badge' : 'icon'}
                    align="right"
                  />

                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                    {formatDateDisplay(task.dueDate)}
                  </span>
                  <button
                    onClick={() => deleteStandaloneTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-opacity cursor-pointer"
                    title="Delete standalone task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. All Standalone Tasks (Other dates / Upcoming / Overdue) */}
      {otherStandaloneTasks.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <button
              onClick={() => setIsAllStandaloneOpen(!isAllStandaloneOpen)}
              className="flex items-center space-x-2 text-left group cursor-pointer"
            >
              <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
                {isAllStandaloneOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
              <div className="flex items-center space-x-2">
                <ListTodo className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  All Other Standalone Tasks
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  {otherStandaloneTasks.length}
                </span>
              </div>
            </button>

            {/* Filter Pills */}
            {isAllStandaloneOpen && (
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg text-xs self-start sm:self-auto">
                <button
                  onClick={() => setStandaloneFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    standaloneFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  All ({otherStandaloneTasks.length})
                </button>
                <button
                  onClick={() => setStandaloneFilter('upcoming')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center space-x-1 ${
                    standaloneFilter === 'upcoming'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3 h-3" />
                  <span>Upcoming ({upcomingStandaloneTasks.length})</span>
                </button>
                {overdueStandaloneTasks.length > 0 && (
                  <button
                    onClick={() => setStandaloneFilter('overdue')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center space-x-1 ${
                      standaloneFilter === 'overdue'
                        ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>Overdue ({overdueStandaloneTasks.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List of Tasks */}
          {isAllStandaloneOpen && (
            <div className="space-y-2 pt-1">
              {filteredOtherTasks.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 text-center text-xs text-slate-400">
                  No tasks match this filter.
                </div>
              ) : (
                filteredOtherTasks.map((task) => {
                  const isTaskOverdue = isBefore(task.dueDate, today);
                  return (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between group transition-all shadow-sm"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <button
                          onClick={() => handleToggleStandaloneStatus(task.id, task.status)}
                          className="text-slate-400 hover:text-teal-500 transition-colors shrink-0 cursor-pointer"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        <span
                          className={`text-xs font-medium text-slate-800 dark:text-slate-200 truncate ${
                            task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                          }`}
                        >
                          {task.text}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-4 relative">
                        {/* Recurrence Badge / Picker */}
                        <RecurrencePicker
                          value={task.recurrence}
                          baseDate={task.dueDate}
                          onChange={(newRule) => updateStandaloneTask({ ...task, recurrence: newRule })}
                          buttonVariant={task.recurrence ? 'badge' : 'icon'}
                          align="right"
                        />

                        {/* Interactive Date Pill with Calendar Picker */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCalendarTaskId((prev) => (prev === task.id ? null : task.id));
                            }}
                            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border transition-colors cursor-pointer group/date ${
                              isTaskOverdue
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 hover:bg-amber-100'
                                : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400'
                            }`}
                            title="Click to change date"
                          >
                            <Calendar className="w-3 h-3 opacity-70 group-hover/date:opacity-100 transition-opacity" />
                            <span>{formatDateDisplay(task.dueDate)}</span>
                            {isTaskOverdue && <span className="text-[9px] font-sans font-bold uppercase tracking-wider">Overdue</span>}
                          </button>

                          {activeCalendarTaskId === task.id && (
                            <CalendarPicker
                              value={task.dueDate}
                              onChange={(newDate) => {
                                updateStandaloneTask({ ...task, dueDate: newDate });
                                setActiveCalendarTaskId(null);
                              }}
                              onClose={() => setActiveCalendarTaskId(null)}
                              position="bottom"
                              align="right"
                            />
                          )}
                        </div>

                        <button
                          onClick={() => deleteStandaloneTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-opacity cursor-pointer"
                          title="Delete standalone task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed Today Toggle */}
      {(myDayData.completedTodayProjectTasks.length > 0 ||
        myDayData.completedTodayStandaloneTasks.length > 0) && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center space-x-1.5 cursor-pointer"
          >
            <span>
              {showCompleted ? 'Hide' : 'Show'} Completed Today (
              {myDayData.completedTodayProjectTasks.length +
                myDayData.completedTodayStandaloneTasks.length}
              )
            </span>
          </button>

          {showCompleted && (
            <div className="space-y-2 mt-3 opacity-75">
              {myDayData.completedTodayProjectTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="line-through text-slate-400">{task.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Project Task</span>
                </div>
              ))}
              {myDayData.completedTodayStandaloneTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="line-through text-slate-400">{task.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Standalone</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
