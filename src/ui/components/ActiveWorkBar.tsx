import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AttentionService } from '../../domain/services/attention-service';
import { Play, Pause, Square, ExternalLink, Check } from 'lucide-react';

export const ActiveWorkBar: React.FC = () => {
  const {
    activeWorkSession,
    activeWorkElapsedSeconds,
    pauseWork,
    resumeWork,
    stopWork,
    completeAndStopWork,
    attentionUnitMinutes,
    openProject,
    setCurrentView,
    allActiveNodes,
    standaloneTasks,
    openWorkSessionsModal,
  } = useApp();

  const isRunaway = activeWorkElapsedSeconds > 7200; // > 2 hours continuous

  const activeTask = useMemo(() => {
    if (!activeWorkSession) return null;
    return (
      allActiveNodes.find((n) => n.id === activeWorkSession.taskId) ||
      standaloneTasks.find((t) => t.id === activeWorkSession.taskId) ||
      null
    );
  }, [activeWorkSession, allActiveNodes, standaloneTasks]);

  if (!activeWorkSession) {
    return null;
  }

  const formatTimer = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const currentAU = AttentionService.durationSecondsToAU(
    activeWorkElapsedSeconds,
    attentionUnitMinutes
  );

  const estimatedAU = activeTask?.estimatedAU;
  const progressRatio = estimatedAU && estimatedAU > 0 ? currentAU / estimatedAU : null;
  const progressPercent = progressRatio !== null ? Math.round(progressRatio * 100) : null;
  const clampedProgressWidth = progressPercent !== null ? Math.min(100, Math.max(0, progressPercent)) : null;
  const isOverEstimated = progressRatio !== null && progressRatio > 1.0;

  const handleNavigateToTask = () => {
    if (activeWorkSession.projectId && activeWorkSession.projectId !== 'standalone') {
      openProject(activeWorkSession.projectId, activeWorkSession.taskId);
    } else {
      setCurrentView('my_day');
    }
  };

  return (
    <aside
      aria-label="Active focus work session"
      className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-3 right-3 md:left-auto md:right-6 z-50 flex items-center justify-between gap-2.5 sm:gap-3.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-900/95 dark:bg-slate-900/95 border border-amber-500/40 dark:border-amber-500/40 backdrop-blur-md rounded-2xl shadow-2xl shadow-amber-950/20 text-slate-100 sm:max-w-md md:max-w-lg lg:max-w-xl animate-in fade-in slide-in-from-bottom-3 duration-200 overflow-hidden"
    >
      {/* Visual Attention Progress Track (at bottom edge of the bar) */}
      {clampedProgressWidth !== null && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80"
          title={`Attention Progress: ${progressPercent}% of ${estimatedAU !== undefined ? Math.round(estimatedAU * 100) / 100 : 0} AU estimated`}
        >
          <div
            className={`h-full transition-all duration-300 ${
              isOverEstimated ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${clampedProgressWidth}%` }}
          />
        </div>
      )}

      {/* Left: Status indicator & Task details */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Pulse Status Indicator */}
        <div
          className="relative flex items-center justify-center flex-shrink-0 cursor-pointer"
          onClick={handleNavigateToTask}
          title={activeWorkSession.isPaused ? 'Work session is paused. Click to jump to task.' : 'Focus work session in progress. Click to jump to task.'}
        >
          <span
            className={`h-3 w-3 rounded-full ${
              activeWorkSession.isPaused
                ? 'bg-amber-400'
                : 'bg-emerald-500 animate-ping opacity-75'
            }`}
          />
          <span
            className={`absolute h-2.5 w-2.5 rounded-full ${
              activeWorkSession.isPaused ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
          />
        </div>

        {/* Task & Project Information */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Task text */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={handleNavigateToTask}
              className="text-xs sm:text-sm font-semibold text-slate-100 truncate hover:text-amber-400 transition-colors flex items-center gap-1 text-left min-w-0"
              title={`Jump to task: "${activeWorkSession.taskText}"`}
            >
              <span className="truncate">{activeWorkSession.taskText}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Row 2: Context badges (Project + Timer + AU + Progress %) */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden">
            {activeWorkSession.projectName ? (
              <span
                className="truncate max-w-[80px] sm:max-w-[130px] text-amber-300/80 font-medium shrink-0"
                title={`Project: ${activeWorkSession.projectName}`}
              >
                {activeWorkSession.projectName}
              </span>
            ) : (
              <span className="text-slate-400 shrink-0">Standalone</span>
            )}

            <span className="text-slate-600 shrink-0">•</span>

            {/* Timer & AU Badge */}
            <button
              onClick={() => openWorkSessionsModal(activeWorkSession.taskId)}
              className="inline-flex items-center gap-1 font-mono text-slate-300 shrink-0 hover:text-white hover:bg-slate-800/80 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              title="Click to view and edit recorded work sessions for this task"
            >
              <span className="font-semibold text-slate-200">
                {formatTimer(activeWorkElapsedSeconds)}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400 font-bold">
                {Math.round(currentAU * 100) / 100} AU
              </span>
              {estimatedAU !== undefined && estimatedAU > 0 && (
                <span
                  className={`font-mono text-[9px] sm:text-[10px] px-1 py-0.2 rounded font-semibold ${
                    isOverEstimated
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                  title={`${progressPercent}% of ${Math.round(estimatedAU * 100) / 100} AU estimated (${Math.round(currentAU * 100) / 100}/${Math.round(estimatedAU * 100) / 100} AU)`}
                >
                  {progressPercent}%
                </span>
              )}
              {isRunaway && (
                <span
                  className="ml-1 px-1 py-0.2 rounded text-[9px] font-semibold bg-rose-500/30 text-rose-300 border border-rose-500/40"
                  title="Timer running > 2 hours. Click to manage or adjust."
                >
                  &gt;2h
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Responsive Action Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 pl-1.5 sm:pl-2.5 border-l border-slate-700/60">
        {/* Pause / Resume */}
        {activeWorkSession.isPaused ? (
          <button
            onClick={() => resumeWork()}
            className="p-1.5 sm:px-2.5 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-medium shadow-sm"
            title="Resume focus work session"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Resume</span>
          </button>
        ) : (
          <button
            onClick={() => pauseWork()}
            className="p-1.5 sm:px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg transition-all flex items-center gap-1 text-xs font-medium border border-slate-700/40 shadow-sm"
            title="Pause focus work session"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        )}

        {/* Complete & Stop */}
        <button
          onClick={() => completeAndStopWork()}
          className="p-1.5 sm:px-2.5 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-medium shadow-sm"
          title="Mark task completed and stop work session"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline md:hidden">Done</span>
          <span className="hidden md:inline">Complete & Stop</span>
        </button>

        {/* Stop Clock */}
        <button
          onClick={() => stopWork()}
          className="p-1.5 sm:px-2.5 bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-medium shadow-sm"
          title="Stop work clock without completing task"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Stop</span>
        </button>
      </div>
    </aside>
  );
};
