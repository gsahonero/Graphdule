import React from 'react';
import { useApp } from '../context/AppContext';
import { Play, Square, Pause, Check } from 'lucide-react';

interface WorkButtonProps {
  taskId: string;
  taskText: string;
  projectId?: string;
  projectName?: string;
  compact?: boolean;
  trackedAU?: number;
  showTrackedAU?: boolean;
}

export const WorkButton: React.FC<WorkButtonProps> = ({
  taskId,
  taskText,
  projectId,
  projectName,
  compact = false,
  trackedAU,
  showTrackedAU = false,
}) => {
  const {
    attentionSystemEnabled,
    activeWorkSession,
    activeWorkElapsedSeconds,
    startWork,
    pauseWork,
    resumeWork,
    stopWork,
    completeAndStopWork,
  } = useApp();

  if (!attentionSystemEnabled) {
    return null;
  }

  const isCurrentActive = activeWorkSession?.taskId === taskId;
  const isPaused = isCurrentActive && activeWorkSession.isPaused;

  const formatTimer = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentActive) {
      stopWork();
    } else {
      startWork(taskId, taskText, projectId, projectName);
    }
  };

  const handlePauseResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaused) {
      resumeWork();
    } else {
      pauseWork();
    }
  };

  if (isCurrentActive) {
    return (
      <div
        onDoubleClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/20 border border-amber-400/60 dark:border-amber-500/40 rounded-full px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-300 whitespace-nowrap shrink-0 select-none shadow-xs"
        title="Active focus work session in progress"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isPaused ? 'bg-amber-500 dark:bg-amber-400' : 'bg-emerald-500 dark:bg-emerald-400 animate-ping'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isPaused ? 'bg-amber-500 dark:bg-amber-400' : 'bg-emerald-600 dark:bg-emerald-500'
            }`}
          />
        </span>

        <span className="font-mono font-semibold text-[11px] text-amber-950 dark:text-amber-200 ml-0.5">
          {formatTimer(activeWorkElapsedSeconds)}
        </span>

        <button
          onClick={handlePauseResume}
          onDoubleClick={(e) => e.stopPropagation()}
          className="p-1 hover:text-slate-900 dark:hover:text-white rounded transition-colors text-slate-600 dark:text-slate-300 ml-0.5 cursor-pointer"
          title={isPaused ? 'Resume work' : 'Pause work'}
        >
          {isPaused ? (
            <Play className="w-3 h-3 fill-current text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Pause className="w-3 h-3 fill-current text-amber-700 dark:text-amber-300" />
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            completeAndStopWork();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="p-1 hover:text-emerald-700 dark:hover:text-emerald-300 rounded transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer"
          title="Complete task & stop work clock"
        >
          <Check className="w-3 h-3" />
        </button>

        <button
          onClick={handleToggle}
          onDoubleClick={(e) => e.stopPropagation()}
          className="p-1 hover:text-rose-700 dark:hover:text-rose-300 rounded transition-colors text-rose-600 dark:text-rose-400 cursor-pointer"
          title="Stop work clock without completing"
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`group inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-700/60 bg-slate-100 hover:bg-amber-50 dark:bg-slate-800/50 dark:hover:bg-amber-500/10 hover:border-amber-400 dark:hover:border-amber-500/40 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 transition-all font-medium whitespace-nowrap shrink-0 select-none cursor-pointer ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      title="Start measuring attention on this task"
    >
      <Play className="w-2.5 h-2.5 fill-current transition-transform group-hover:scale-110 text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-300" />
      <span>Work</span>
      {showTrackedAU && trackedAU !== undefined && trackedAU > 0 && (
        <span className="text-[10px] text-amber-700 dark:text-amber-400/90 font-mono ml-0.5">
          {trackedAU} AU
        </span>
      )}
    </button>
  );
};
