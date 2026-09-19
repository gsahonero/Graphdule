import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AttentionService } from '../../domain/services/attention-service';
import {
  Play,
  Pause,
  Square,
  ExternalLink,
  Check,
  PictureInPicture2,
  Minimize2,
  Heart,
  Sparkles,
  Trash2,
  Coffee,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  requestPictureInPictureWindow,
  PictureInPicturePortal,
} from './PictureInPicturePortal';
import { TaskEnvironment } from '../../domain/health/types';

export interface ActiveWorkBarProps {
  mode?: 'desktop' | 'mobile';
}

export const ActiveWorkBar: React.FC<ActiveWorkBarProps> = ({ mode = 'desktop' }) => {
  const {
    activeWorkSession,
    activeWorkElapsedSeconds,
    pauseWork,
    resumeWork,
    stopWork,
    completeAndStopWork,
    stopProjectPlanning,
    discardActiveWorkSession,
    startRecoverySession,
    openRecoveryCurtain,
    planningToast,
    dismissPlanningToast,
    attentionUnitMinutes,
    openProject,
    setCurrentView,
    allActiveNodes,
    standaloneTasks,
    openWorkSessionsModal,
    healthConfig,
    activeHealthNotification,
    acknowledgeHealthIntervention,
    dismissHealthIntervention,
    addDroppedThought,
    zenCurtainEnabled,
    setZenCurtainEnabled,
  } = useApp();

  const [isBreakMenuOpen, setIsBreakMenuOpen] = useState(false);
  const [isQuickDropOpen, setIsQuickDropOpen] = useState(false);
  const [quickDropText, setQuickDropText] = useState('');
  const quickDropInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isQuickDropOpen) {
      setTimeout(() => quickDropInputRef.current?.focus(), 50);
    }
  }, [isQuickDropOpen]);

  // Picture-in-Picture State
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isPiPActive, setIsPiPActive] = useState(false);

  // Auto-close PiP when session ends
  useEffect(() => {
    if (!activeWorkSession && pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      setIsPiPActive(false);
    }
  }, [activeWorkSession, pipWindow]);

  // Picture-in-Picture toggle
  const handleOpenPiP = async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      setIsPiPActive(false);
      return;
    }

    const win = await requestPictureInPictureWindow({
      width: 440,
      height: 175,
      title: `Graphdule • ${activeWorkSession?.taskText || 'Focus Session'}`,
      onClose: () => {
        setPipWindow(null);
        setIsPiPActive(false);
      },
    });

    if (win) {
      setPipWindow(win);
      setIsPiPActive(true);
    }
  };

  const handleClosePiP = () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      setIsPiPActive(false);
    }
  };

  const activeTask = useMemo(() => {
    if (!activeWorkSession) return null;
    return (
      allActiveNodes.find((n) => n.id === activeWorkSession.taskId) ||
      standaloneTasks.find((t) => t.id === activeWorkSession.taskId) ||
      null
    );
  }, [activeWorkSession, allActiveNodes, standaloneTasks]);

  const taskEnvironment: TaskEnvironment =
    activeTask?.environment || healthConfig?.defaultEnvironment || 'computer';

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
  const isPlanning = activeWorkSession?.sessionType === 'planning';

  const handleNavigateToTask = () => {
    if (typeof window !== 'undefined' && window.focus) {
      window.focus();
    }
    if (activeWorkSession.projectId && activeWorkSession.projectId !== 'standalone') {
      openProject(activeWorkSession.projectId, activeWorkSession.taskId);
    } else {
      setCurrentView('my_day');
    }
  };

  // Content for the floating Picture-in-Picture window
  const pipContent = (
    <div className={`w-full h-full min-h-[160px] bg-slate-950 text-slate-100 flex flex-col justify-between p-3.5 box-border select-none overflow-hidden font-sans border-t-2 ${isPlanning ? 'border-indigo-500' : 'border-amber-500'}`}>
      {/* Top row: Task text + Project + Exit PiP */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                activeWorkSession.isPaused
                  ? isPlanning ? 'bg-indigo-400' : 'bg-amber-400'
                  : isPlanning ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500 animate-ping'
              }`}
            />
            <button
              onClick={handleNavigateToTask}
              className="text-sm font-bold text-slate-100 truncate hover:text-amber-400 transition-colors flex items-center gap-1 text-left min-w-0 cursor-pointer"
              title={`Jump to task: "${activeWorkSession.taskText}"`}
            >
              <span className="truncate">{activeWorkSession.taskText}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
            </button>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span className={`${isPlanning ? 'text-indigo-300' : 'text-amber-300'} font-medium truncate`}>
              {activeWorkSession.projectName || 'Standalone'}
            </span>
            <span className="text-slate-600">•</span>
            {isPlanning ? (
              <span
                data-testid="pip-planning-badge"
                className="px-1.5 py-0.2 rounded font-sans text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-700 font-medium"
              >
                🧠 Planning
              </span>
            ) : (
              <span
                data-testid="pip-environment-badge"
                className="px-1 py-0.2 rounded font-mono text-[9px] bg-slate-800 text-slate-300 border border-slate-700 capitalize"
              >
                {taskEnvironment === 'physical' ? '🏃 physical' : taskEnvironment === 'mixed' ? '🔄 mixed' : '💻 computer'}
              </span>
            )}
            <span className="text-slate-600">•</span>
            <span className="font-mono text-slate-300">
              {Math.round(currentAU * 100) / 100} AU
            </span>
            {estimatedAU !== undefined && estimatedAU > 0 && (
              <span
                className={`font-mono text-[10px] px-1 py-0.2 rounded font-semibold ${
                  isOverEstimated
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {progressPercent}%
              </span>
            )}
          </div>
        </div>

        {/* Restore / Bring Back to page */}
        <button
          onClick={handleClosePiP}
          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs shrink-0 cursor-pointer"
          title="Return to Graphdule main window"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Dock</span>
        </button>
      </div>

      {/* Subtle Health Intervention Banner in PiP */}
      {activeHealthNotification && activeHealthNotification.taskId === activeWorkSession.taskId && (
        <div
          data-testid="pip-health-notification-banner"
          className="bg-rose-950/90 border border-rose-500/40 rounded-lg px-2.5 py-1.5 my-1 flex items-center justify-between gap-2 text-xs text-rose-100 animate-in fade-in"
        >
          <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/40 shrink-0 animate-pulse" />
            <span className="truncate">
              {activeHealthNotification.decision.message || activeHealthNotification.intervention.message}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => acknowledgeHealthIntervention(activeHealthNotification.intervention.id)}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Rest ({activeHealthNotification.remainingSeconds}s)
            </button>
            <button
              onClick={() => dismissHealthIntervention(activeHealthNotification.intervention.id)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Middle row: Large Timer & Progress */}
      <div className="my-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-2xl font-bold tracking-tight text-white">
            {formatTimer(activeWorkElapsedSeconds)}
          </span>
          {activeWorkSession.isPaused && (
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Paused
            </span>
          )}
        </div>
        {clampedProgressWidth !== null && (
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isOverEstimated ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${clampedProgressWidth}%` }}
            />
          </div>
        )}
      </div>

      {/* Bottom row: Controls */}
      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
        {activeWorkSession.isPaused ? (
          <button
            onClick={() => resumeWork()}
            className={`flex-1 py-1.5 px-2 ${isPlanning ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            onClick={() => pauseWork()}
            className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all border border-slate-700/60 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
        )}

        <button
          onClick={() => completeAndStopWork()}
          title="Mark task completed and stop work session"
          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Complete</span>
        </button>

        <button
          onClick={() => stopWork()}
          title="Stop work clock without completing task"
          className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-xs flex items-center justify-center transition-all border border-slate-700/60 cursor-pointer"
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      </div>
    </div>
  );

  // Mobile View (< md screens): Compact bottom docked banner above BottomNav
  if (mode === 'mobile') {
    return (
      <aside
        role="complementary"
        aria-label="Active focus work session"
        data-testid="mobile-active-work-bar"
        className="md:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-2 right-2 z-40 bg-slate-900/95 border border-slate-700/60 rounded-xl px-3 py-2 shadow-xl backdrop-blur-md text-white flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2 duration-150 select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={handleNavigateToTask}>
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              activeWorkSession.isPaused
                ? 'bg-amber-400'
                : isPlanning
                ? 'bg-indigo-400 animate-pulse'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-100 truncate">{activeWorkSession.taskText}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="font-mono font-bold text-white">{formatTimer(activeWorkElapsedSeconds)}</span>
              <span>•</span>
              <span className="text-amber-400">{Math.round(currentAU * 100) / 100} AU</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isPlanning ? (
            <button
              onClick={() => stopProjectPlanning()}
              data-testid="mobile-finish-planning-btn"
              className="p-1.5 bg-indigo-600 text-white rounded-lg text-xs cursor-pointer"
              title="Finish Planning"
            >
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <>
              {activeWorkSession.isPaused ? (
                <button
                  onClick={() => resumeWork()}
                  aria-label="Resume"
                  className="p-1.5 bg-emerald-600 text-white rounded-lg cursor-pointer"
                  title="Resume"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => pauseWork()}
                  aria-label="Pause"
                  className="p-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg cursor-pointer"
                  title="Pause"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
              <button
                onClick={() => completeAndStopWork()}
                title="Mark task completed and stop work session"
                className="p-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => stopWork()}
                title="Stop work clock without completing task"
                className="p-1.5 bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </>
          )}
        </div>
      </aside>
    );
  }

  // Desktop View (Default): Minimalist cue docked on BottomBar with rich hover popover
  return (
    <>
      <span className="text-slate-300 dark:text-slate-700">|</span>

      <div
        role="complementary"
        aria-label="Active focus work session"
        data-testid="bottombar-focus-indicator"
        className="relative group flex items-center space-x-1.5 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        {/* Pulse Status Dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              activeWorkSession.isPaused
                ? 'bg-amber-400'
                : isPlanning
                ? 'bg-indigo-400'
                : 'bg-emerald-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              activeWorkSession.isPaused
                ? 'bg-amber-500'
                : isPlanning
                ? 'bg-indigo-500'
                : 'bg-emerald-500'
            }`}
          />
        </span>

        {/* Quick Play/Pause button on the bottom bar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            activeWorkSession.isPaused ? resumeWork() : pauseWork();
          }}
          title={activeWorkSession.isPaused ? 'Resume focus work session' : 'Pause focus work session'}
          aria-label={activeWorkSession.isPaused ? 'Resume' : 'Pause'}
          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
        >
          {activeWorkSession.isPaused ? (
            <Play className="w-3 h-3 fill-current text-amber-500" />
          ) : (
            <Pause className="w-3 h-3 fill-current text-emerald-500" />
          )}
        </button>

        {/* Minimal Label */}
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Focus
        </span>

        {/* Truncated Task Title */}
        <span
          className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] lg:max-w-[150px] truncate"
          title={activeWorkSession.taskText}
        >
          {activeWorkSession.taskText}
        </span>

        {/* Monospace Timer */}
        <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-100 shrink-0">
          {formatTimer(activeWorkElapsedSeconds)}
        </span>

        {/* AU mini progress track or badge */}
        {estimatedAU !== undefined && estimatedAU > 0 ? (
          <div
            className="w-12 sm:w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shrink-0"
            title={`${progressPercent}% of ${Math.round(estimatedAU * 100) / 100} AU`}
          >
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isOverEstimated ? 'bg-amber-500' : isPlanning ? 'bg-indigo-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${clampedProgressWidth}%` }}
            />
          </div>
        ) : (
          <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
            {Math.round(currentAU * 100) / 100} AU
          </span>
        )}

        {/* PiP indicator on the bottom bar */}
        {isPiPActive && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium truncate">
              Focusing in Picture-in-Picture...
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClosePiP();
              }}
              aria-label="Bring Back"
              title="Return to Graphdule main window"
              className="px-1.5 py-0.5 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
            >
              <Minimize2 className="w-2.5 h-2.5" />
              <span>Bring Back</span>
            </button>
          </div>
        )}

        {/* Full Detail Hover Popover (Similar behavior as the progress bar) */}
        <div
          data-testid="focus-hover-popover"
          className="absolute bottom-full left-0 mb-1.5 w-84 sm:w-96 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 hidden group-hover:flex flex-col gap-2.5 pointer-events-auto animate-in fade-in zoom-in-95 duration-150 text-left cursor-default before:content-[''] before:absolute before:top-full before:left-0 before:right-0 before:h-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Row: Task Name & Jump Link */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    activeWorkSession.isPaused
                      ? 'bg-amber-500'
                      : isPlanning
                      ? 'bg-indigo-500 animate-pulse'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <button
                  onClick={handleNavigateToTask}
                  className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center gap-1 text-left min-w-0 cursor-pointer"
                  title={`Jump to task: "${activeWorkSession.taskText}"`}
                >
                  <span className="truncate">{activeWorkSession.taskText}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                </button>
              </div>

              {/* Badges: Project, Planning, Environment */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                <span className="font-medium truncate max-w-[130px] text-brand-600 dark:text-brand-400">
                  {activeWorkSession.projectName || 'Standalone'}
                </span>
                <span>•</span>
                {isPlanning && (
                  <span
                    data-testid="workbar-planning-badge"
                    className="px-1.5 py-0.2 rounded font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400"
                  >
                    🧠 Planning
                  </span>
                )}
                <span
                  data-testid="workbar-environment-badge"
                  className="px-1.5 py-0.2 rounded font-medium border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 capitalize"
                  title={`Task Environment: ${taskEnvironment}`}
                >
                  {taskEnvironment === 'physical' ? '🏃 physical' : taskEnvironment === 'mixed' ? '🔄 mixed' : '💻 computer'}
                </span>
              </div>
            </div>

            {/* Quick Popover Tools: Zen Curtain & PiP */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setZenCurtainEnabled(!zenCurtainEnabled)}
                data-testid="zen-curtain-toggle-btn"
                title={zenCurtainEnabled ? 'Exit Zen Focus Curtain' : 'Enter Zen Focus Curtain (Distraction-Free Focus Island)'}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  zenCurtainEnabled
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {zenCurtainEnabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleOpenPiP}
                aria-label="Open Picture-in-Picture"
                title={isPiPActive ? 'Return to Graphdule main window' : 'Open Picture-in-Picture window'}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isPiPActive
                    ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/40'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Health Notification Banner in Popover */}
          {activeHealthNotification && activeHealthNotification.taskId === activeWorkSession.taskId && (
            <div
              data-testid="active-health-notification-banner"
              className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800/80 rounded-lg p-2 flex items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-200"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/30 shrink-0 animate-pulse" />
                <span className="font-semibold text-rose-700 dark:text-rose-300 shrink-0 text-[11px]">
                  {activeHealthNotification.intervention.name}:
                </span>
                <span className="truncate text-[11px]">
                  {activeHealthNotification.decision.message || activeHealthNotification.intervention.message}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => acknowledgeHealthIntervention(activeHealthNotification.intervention.id)}
                  data-testid="health-acknowledge-btn"
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  Rest ({activeHealthNotification.remainingSeconds}s)
                </button>
                <button
                  onClick={() => dismissHealthIntervention(activeHealthNotification.intervention.id)}
                  data-testid="health-dismiss-btn"
                  className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Planning Toast Banner in Popover */}
          {planningToast && isPlanning && (
            <div
              data-testid="planning-toast-banner"
              className="bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-800/80 rounded-lg p-2 flex items-center justify-between gap-2 text-xs text-indigo-800 dark:text-indigo-200"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[11px] shrink-0">🧠 Planning:</span>
                <span className="truncate text-[11px]">
                  {planningToast.projectName ? `Tracking planning on "${planningToast.projectName}"` : 'Tracking planning session'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => discardActiveWorkSession()}
                  data-testid="planning-toast-discard-btn"
                  className="px-2 py-0.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={() => dismissPlanningToast()}
                  data-testid="planning-toast-dismiss-btn"
                  className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

          {/* Timer & AU Detail */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatTimer(activeWorkElapsedSeconds)}
                </span>
                <button
                  onClick={() => openWorkSessionsModal(activeWorkSession.taskId)}
                  className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                  title="Click to view and edit recorded work sessions for this task"
                >
                  {Math.round(currentAU * 100) / 100} AU {estimatedAU !== undefined ? `/ ${estimatedAU} AU` : ''}
                </button>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  activeWorkSession.isPaused
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    : isPlanning
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {activeWorkSession.isPaused ? 'Paused' : isPlanning ? 'Planning' : 'Focusing'}
              </span>
            </div>

            {clampedProgressWidth !== null && (
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isOverEstimated ? 'bg-amber-500' : isPlanning ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${clampedProgressWidth}%` }}
                />
              </div>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {isPlanning ? (
              <>
                <button
                  onClick={() => stopProjectPlanning()}
                  data-testid="workbar-finish-planning-btn"
                  className="col-span-2 py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Finish Planning</span>
                </button>
                <button
                  onClick={() => discardActiveWorkSession()}
                  data-testid="workbar-discard-planning-btn"
                  className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>
              </>
            ) : (
              <>
                {activeWorkSession.isPaused ? (
                  <button
                    onClick={() => resumeWork()}
                    aria-label="Resume"
                    className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={() => pauseWork()}
                    aria-label="Pause"
                    className="py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={() => completeAndStopWork()}
                  title="Mark task completed and stop work session"
                  className="py-1.5 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Complete</span>
                </button>

                <button
                  onClick={() => stopWork()}
                  title="Stop work clock without completing task"
                  className="py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>

          {/* Secondary Actions: Quick Drop & Breaks */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setIsQuickDropOpen(!isQuickDropOpen)}
              className="flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
              title="Capture stray thought without losing focus"
            >
              <Sparkles className="w-3 h-3 text-teal-500" />
              <span>Drop Thought</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsBreakMenuOpen(!isBreakMenuOpen)}
                className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                title="Take a recovery break"
              >
                <Coffee className="w-3 h-3 text-amber-500" />
                <span>Break</span>
              </button>
              {isBreakMenuOpen && (
                <div className="absolute right-0 bottom-full mb-1.5 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 text-xs">
                  <button
                    onClick={() => {
                      startRecoverySession(2);
                      openRecoveryCurtain();
                      setIsBreakMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Micro Break (2m)
                  </button>
                  <button
                    onClick={() => {
                      startRecoverySession(5);
                      openRecoveryCurtain();
                      setIsBreakMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Short Rest (5m)
                  </button>
                  <button
                    onClick={() => {
                      startRecoverySession(15);
                      openRecoveryCurtain();
                      setIsBreakMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Full Reset (15m)
                  </button>
                </div>
              )}
            </div>

            {!isPlanning && (
              <button
                onClick={() => discardActiveWorkSession()}
                title="Discard this work session without saving telemetry"
                className="flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-500" />
                <span>Discard</span>
              </button>
            )}
          </div>

          {/* Quick Drop Composer Input */}
          {isQuickDropOpen && (
            <div className="pt-1 flex items-center gap-1.5">
              <input
                ref={quickDropInputRef}
                type="text"
                value={quickDropText}
                onChange={(e) => setQuickDropText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickDropText.trim()) {
                    e.preventDefault();
                    addDroppedThought(quickDropText.trim(), {
                      originTaskId: activeWorkSession.taskId,
                      projectId: activeWorkSession.projectId,
                      projectName: activeWorkSession.projectName,
                    });
                    setQuickDropText('');
                    setIsQuickDropOpen(false);
                  } else if (e.key === 'Escape') {
                    setIsQuickDropOpen(false);
                  }
                }}
                placeholder="Drop thought... (Enter to save)"
                className="flex-1 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
              <button
                onClick={() => {
                  if (quickDropText.trim()) {
                    addDroppedThought(quickDropText.trim(), {
                      originTaskId: activeWorkSession.taskId,
                      projectId: activeWorkSession.projectId,
                      projectName: activeWorkSession.projectName,
                    });
                    setQuickDropText('');
                    setIsQuickDropOpen(false);
                  }
                }}
                className="px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Drop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Picture in Picture Portal */}
      {isPiPActive && pipWindow && (
        <PictureInPicturePortal pipWindow={pipWindow}>
          {pipContent}
        </PictureInPicturePortal>
      )}
    </>
  );
};
