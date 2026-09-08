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
}

export const WorkButton: React.FC<WorkButtonProps> = ({
  taskId,
  taskText,
  projectId,
  projectName,
  compact = false,
  trackedAU,
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
        className="inline-flex items-center gap-1 bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/40 rounded-full px-2 py-0.5 text-xs font-medium text-amber-300 whitespace-nowrap shrink-0 select-none"
        title="Active focus work session in progress"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isPaused ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
          />
        </span>

        <span className="font-mono font-medium text-[11px] text-amber-200 ml-0.5">
          {formatTimer(activeWorkElapsedSeconds)}
        </span>

        <button
          onClick={handlePauseResume}
          className="p-1 hover:text-white rounded transition-colors text-slate-300 ml-0.5"
          title={isPaused ? 'Resume work' : 'Pause work'}
        >
          {isPaused ? (
            <Play className="w-3 h-3 fill-current text-emerald-400" />
          ) : (
            <Pause className="w-3 h-3 fill-current text-amber-300" />
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            completeAndStopWork();
          }}
          className="p-1 hover:text-emerald-300 rounded transition-colors text-emerald-400"
          title="Complete task & stop work clock"
        >
          <Check className="w-3 h-3" />
        </button>

        <button
          onClick={handleToggle}
          className="p-1 hover:text-rose-300 rounded transition-colors text-rose-400"
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
      className={`group inline-flex items-center gap-1 rounded-full border border-slate-700/60 dark:border-slate-700/60 bg-slate-800/40 hover:bg-amber-500/10 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all font-medium whitespace-nowrap shrink-0 select-none ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      title="Start measuring attention on this task"
    >
      <Play className="w-2.5 h-2.5 fill-current transition-transform group-hover:scale-110" />
      <span>Work</span>
      {trackedAU !== undefined && trackedAU > 0 && (
        <span className="text-[10px] text-amber-400/80 font-mono ml-0.5">
          {trackedAU} AU
        </span>
      )}
    </button>
  );
};
