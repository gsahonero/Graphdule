import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getTodayString, addDays, getMondayOfWeek } from '../../domain/utils/date';
import { Clock, X } from 'lucide-react';

export interface TriageTaskItem {
  id: string;
  text: string;
  dueDate: string;
  projectId?: string;
  isNode?: boolean;
}

interface TaskTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TriageTaskItem[];
  onApplyDelay: (taskIds: string[], newDate: string, cascade: boolean) => Promise<void>;
}

export const TaskTriageModal: React.FC<TaskTriageModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onApplyDelay,
}) => {
  const { formatDateDisplay } = useApp();
  const today = getTodayString();
  const tomorrow = addDays(today, 1);
  const plusThreeDays = addDays(today, 3);
  const nextMonday = addDays(getMondayOfWeek(today), 7);

  const [selectedDate, setSelectedDate] = useState<string>(tomorrow);
  const [cascadeShift, setCascadeShift] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  if (!isOpen || tasks.length === 0) return null;

  const hasGraphNodes = tasks.some((t) => t.isNode || (t.projectId && t.projectId !== 'standalone'));

  const handleApply = async () => {
    if (!selectedDate) return;
    setIsApplying(true);
    try {
      await onApplyDelay(
        tasks.map((t) => t.id),
        selectedDate,
        cascadeShift
      );
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-5 h-5" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
              {tasks.length === 1 ? 'Postpone Task' : `Triage ${tasks.length} Overdue Tasks`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Tasks Summary */}
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {tasks.length === 1 ? 'Task to reschedule' : 'Tasks to reschedule'}
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs"
                >
                  <span className="truncate font-medium text-slate-800 dark:text-slate-200 mr-2">
                    {task.text}
                  </span>
                  <span className="text-[11px] font-mono text-rose-500 dark:text-rose-400 shrink-0">
                    {task.dueDate ? formatDateDisplay(task.dueDate) : 'No date'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Postpone until:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrow)}
                className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer text-center ${
                  selectedDate === tomorrow
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs ring-1 ring-indigo-500/30'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                Tomorrow
                <span className="block text-[10px] opacity-70 font-mono mt-0.5">
                  {formatDateDisplay(tomorrow)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(plusThreeDays)}
                className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer text-center ${
                  selectedDate === plusThreeDays
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs ring-1 ring-indigo-500/30'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                +3 Days
                <span className="block text-[10px] opacity-70 font-mono mt-0.5">
                  {formatDateDisplay(plusThreeDays)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(nextMonday)}
                className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer text-center ${
                  selectedDate === nextMonday
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs ring-1 ring-indigo-500/30'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                Next Monday
                <span className="block text-[10px] opacity-70 font-mono mt-0.5">
                  {formatDateDisplay(nextMonday)}
                </span>
              </button>
            </div>
          </div>

          {/* Custom Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Or pick specific date:
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
              />
            </div>
          </div>

          {/* Cascade Shift Checkbox (for Graph Nodes) */}
          {hasGraphNodes && (
            <div className="pt-1">
              <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cascadeShift}
                  onChange={(e) => setCascadeShift(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Shift dependent downstream tasks by same amount to preserve chronology
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedDate || isApplying}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {isApplying ? 'Postponing...' : 'Apply Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
