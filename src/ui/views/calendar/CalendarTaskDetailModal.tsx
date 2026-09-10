import React, { useState, useEffect } from 'react';
import { CalendarTaskItem } from './types';
import { useApp } from '../../context/AppContext';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  ExternalLink,
  Flame,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { addDays, getTodayString } from '../../../domain/utils/date';
import { NodeStatus } from '../../../domain/models/types';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';

interface CalendarTaskDetailModalProps {
  task: CalendarTaskItem | null;
  onClose: () => void;
}

export const CalendarTaskDetailModal: React.FC<CalendarTaskDetailModalProps> = ({
  task,
  onClose,
}) => {
  const {
    allActiveNodes,
    standaloneTasks,
    updateNode,
    moveNodeDate,
    updateStandaloneTask,
    deleteStandaloneTask,
    deleteNode,
    openProject,
  } = useApp();

  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedAU, setEstimatedAU] = useState<number>(1);
  const [status, setStatus] = useState<NodeStatus>('planned');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setText(task.text);
      setDueDate(task.dueDate || getTodayString());
      setEstimatedAU(task.estimatedAU ?? 1);
      setStatus(task.status);
    }
  }, [task]);

  if (!task) return null;

  const theme = getProjectColorTheme(task.projectStyle?.color);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    setIsSaving(true);

    try {
      if (task.isStandalone) {
        const existing = standaloneTasks.find((st) => st.id === task.id);
        if (existing) {
          await updateStandaloneTask({
            ...existing,
            text: text.trim(),
            dueDate: dueDate || getTodayString(),
            estimatedAU: Number(estimatedAU) || 0,
            status,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        const existingNode = allActiveNodes.find((n) => n.id === task.id);
        if (existingNode) {
          await updateNode({
            ...existingNode,
            text: text.trim(),
            estimatedAU: Number(estimatedAU) || 0,
            status,
            updatedAt: new Date().toISOString(),
          });
          if (dueDate && dueDate !== existingNode.dueDate) {
            await moveNodeDate(task.id, dueDate, true);
          }
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to save task from calendar modal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoToProject = async () => {
    if (task.projectId) {
      onClose();
      await openProject(task.projectId, task.id);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${task.text}"?`)) {
      if (task.isStandalone) {
        await deleteStandaloneTask(task.id);
      } else {
        await deleteNode(task.id);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-task-detail-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${
                task.isStandalone
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  : theme.badgeBg || 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {!task.isStandalone && task.projectStyle?.icon && (
                <ProjectIconDisplay
                  icon={task.projectStyle.icon}
                  emoji={task.projectStyle.emoji}
                  className="w-3 h-3 shrink-0"
                />
              )}
              <span className="truncate max-w-[160px]">{task.projectName || 'Standalone Task'}</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {/* Task Title */}
          <div>
            <label
              htmlFor="calendar-task-detail-title"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5"
            >
              Task Title
            </label>
            <input
              type="text"
              id="calendar-task-detail-title"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              placeholder="What needs to be done?"
            />
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('planned')}
                className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  status === 'planned'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-400 dark:border-slate-600 shadow-xs'
                    : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <Circle className="w-3.5 h-3.5 text-slate-400" />
                <span>Planned</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('in_progress')}
                className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  status === 'in_progress'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500 shadow-xs font-semibold'
                    : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>In Progress</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500 shadow-xs font-semibold'
                    : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Completed</span>
              </button>
            </div>
          </div>

          {/* Attention Units (AU) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Estimated Workload (AU)</span>
              </label>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {estimatedAU} Attention Units
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="50"
                step="1"
                value={estimatedAU}
                onChange={(e) => setEstimatedAU(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="flex items-center space-x-1 flex-1">
                {[1, 2, 4, 8].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEstimatedAU(preset)}
                    className={`flex-1 py-1 px-1.5 text-xs rounded border transition-colors cursor-pointer ${
                      estimatedAU === preset
                        ? 'bg-emerald-500 text-white border-emerald-600 font-semibold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset} AU
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Due Date & Quick Adjustments */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Scheduled Due Date
            </label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>
            {/* Quick date presets */}
            <div className="flex items-center space-x-1.5 mt-2">
              <button
                type="button"
                onClick={() => setDueDate(getTodayString())}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDueDate(addDays(getTodayString(), 1))}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDueDate(addDays(dueDate || getTodayString(), -1))}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                -1 Day
              </button>
              <button
                type="button"
                onClick={() => setDueDate(addDays(dueDate || getTodayString(), 1))}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => setDueDate(addDays(dueDate || getTodayString(), 7))}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* Project Jump Link (if project task) */}
          {!task.isStandalone && task.projectId && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleGoToProject}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Node in Project Graph</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
