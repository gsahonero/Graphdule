import React from 'react';
import { CalendarTaskItem } from './types';
import { CheckCircle2, Circle, Clock, GripVertical } from 'lucide-react';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';

interface CalendarTaskCardProps {
  task: CalendarTaskItem;
  variant?: 'compact' | 'standard' | 'expanded';
  onSelectTask?: (task: CalendarTaskItem) => void;
  onToggleComplete?: (task: CalendarTaskItem) => void;
  onDragStart?: (task: CalendarTaskItem, e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export const CalendarTaskCard: React.FC<CalendarTaskCardProps> = ({
  task,
  variant = 'standard',
  onSelectTask,
  onToggleComplete,
  onDragStart,
  onDragEnd,
}) => {
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';
  const theme = getProjectColorTheme(task.projectStyle?.color);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/json', JSON.stringify(task));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) {
      onDragStart(task, e);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(task);
    }
  };

  // Compact Variant for Month View cells
  if (variant === 'compact') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={() => onSelectTask?.(task)}
        title={`${task.text} (${task.estimatedAU ?? 0} AU) - ${task.projectName || 'Standalone'}`}
        className={`group flex items-center space-x-1.5 px-1.5 py-1 rounded text-xs cursor-pointer select-none transition-all border ${
          isCompleted
            ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-800 line-through'
            : isInProgress
            ? 'bg-amber-500/10 dark:bg-amber-950/30 text-slate-800 dark:text-slate-200 border-amber-500/30 shadow-2xs'
            : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-emerald-500/50 hover:shadow-xs'
        }`}
      >
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
          className="shrink-0 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
          ) : (
            <Circle className="w-3 h-3 shrink-0" />
          )}
        </button>

        {/* Project dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            task.isStandalone ? 'bg-slate-400' : theme.dotClass || 'bg-emerald-500'
          }`}
        />

        {/* Title */}
        <span className="truncate flex-1 font-medium text-[11px] leading-tight">
          {task.text}
        </span>

        {/* AU pill */}
        {task.estimatedAU !== undefined && task.estimatedAU > 0 && (
          <span
            className={`text-[9px] font-semibold px-1 py-0.2 rounded shrink-0 ${
              isCompleted
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                : isInProgress
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {task.estimatedAU} AU
          </span>
        )}
      </div>
    );
  }

  // Standard Variant for Week View columns
  if (variant === 'standard') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={() => onSelectTask?.(task)}
        className={`group p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all shadow-xs ${
          isCompleted
            ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-70'
            : isInProgress
            ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/30 hover:border-amber-500'
            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500/60 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start space-x-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
            className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
          >
            {isCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p
              className={`font-medium text-xs leading-snug line-clamp-2 ${
                isCompleted
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {task.text}
            </p>

            <div className="flex items-center flex-wrap gap-1 mt-1.5">
              {/* Project / Standalone Badge */}
              <span
                className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  task.isStandalone
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    : theme.badgeBg || 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {!task.isStandalone && task.projectStyle?.icon && (
                  <ProjectIconDisplay
                    icon={task.projectStyle.icon}
                    emoji={task.projectStyle.emoji}
                    className="w-2.5 h-2.5 shrink-0"
                  />
                )}
                <span className="truncate max-w-[100px]">
                  {task.projectName || 'Standalone'}
                </span>
              </span>

              {/* Status Badge */}
              {isInProgress && (
                <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span>In Progress</span>
                </span>
              )}

              {/* AU Badge */}
              {task.estimatedAU !== undefined && task.estimatedAU > 0 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isCompleted
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {task.estimatedAU} AU
                </span>
              )}
            </div>
          </div>

          <div
            className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 cursor-grab active:cursor-grabbing pt-0.5"
            title="Drag to reschedule"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  // Expanded Variant for Day View
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onSelectTask?.(task)}
      className={`group p-3 sm:p-3.5 rounded-xl border text-sm cursor-pointer select-none transition-all shadow-xs ${
        isCompleted
          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-75'
          : isInProgress
          ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40 hover:border-amber-500'
          : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500/60 hover:shadow-md'
      }`}
    >
      <div className="flex items-start space-x-3">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
          className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-sm leading-snug ${
              isCompleted
                ? 'text-slate-400 dark:text-slate-500 line-through'
                : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {task.text}
          </p>

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            {/* Project / Standalone Badge */}
            <span
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
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
              <span>{task.projectName || 'Standalone'}</span>
            </span>

            {/* Status Pill */}
            {isInProgress && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <Clock className="w-3 h-3 shrink-0" />
                <span>In Progress</span>
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Completed</span>
              </span>
            )}

            {/* AU Badge */}
            {task.estimatedAU !== undefined && task.estimatedAU > 0 && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                  isCompleted
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                }`}
              >
                {task.estimatedAU} Attention Units (AU)
              </span>
            )}
          </div>
        </div>

        <div
          className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 cursor-grab active:cursor-grabbing p-1"
          title="Drag to reschedule"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
