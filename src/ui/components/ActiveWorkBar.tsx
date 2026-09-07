import React from 'react';
import { useApp } from '../context/AppContext';
import { AttentionService } from '../../domain/services/attention-service';
import { Play, Pause, Square, ExternalLink } from 'lucide-react';

export const ActiveWorkBar: React.FC = () => {
  const {
    activeWorkSession,
    activeWorkElapsedSeconds,
    pauseWork,
    resumeWork,
    stopWork,
    attentionUnitMinutes,
    openProject,
    setCurrentView,
  } = useApp();

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
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 dark:bg-slate-900/95 border border-amber-500/40 dark:border-amber-500/40 backdrop-blur-md rounded-2xl shadow-2xl shadow-amber-950/20 text-slate-100 max-w-[calc(100vw-2rem)] md:max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Pulse Status Indicator */}
      <div className="relative flex items-center justify-center flex-shrink-0">
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
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleNavigateToTask}
            className="text-xs md:text-sm font-semibold text-slate-100 truncate hover:text-amber-400 transition-colors flex items-center gap-1 text-left"
            title={activeWorkSession.taskText}
          >
            <span className="truncate">{activeWorkSession.taskText}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
          {activeWorkSession.projectName ? (
            <span className="truncate max-w-[120px] text-amber-300/80 font-medium">
              {activeWorkSession.projectName}
            </span>
          ) : (
            <span className="text-slate-400">Standalone</span>
          )}
          <span>•</span>
          <span className="font-mono text-slate-300 font-medium">
            {formatTimer(activeWorkElapsedSeconds)}
          </span>
          <span>•</span>
          <span className="text-amber-400 font-semibold">
            {currentAU} AU
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1 border-l border-slate-700/60">
        {activeWorkSession.isPaused ? (
          <button
            onClick={() => resumeWork()}
            className="p-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-medium px-2.5"
            title="Resume work session"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Resume</span>
          </button>
        ) : (
          <button
            onClick={() => pauseWork()}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium px-2"
            title="Pause work session"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        )}

        <button
          onClick={() => stopWork()}
          className="p-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-medium px-2.5"
          title="Stop & log attention work session"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      </div>
    </aside>
  );
};
