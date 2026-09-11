import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { AttentionService } from '../../domain/services/attention-service';
import {
  Play,
  Pause,
  Square,
  ExternalLink,
  Check,
  GripVertical,
  PictureInPicture2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import {
  requestPictureInPictureWindow,
  PictureInPicturePortal,
} from './PictureInPicturePortal';

const STORAGE_KEY_POS = 'graphdule_active_bar_pos';

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

  // Position & Dragging State
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.x === 'number' &&
          !isNaN(parsed.x) &&
          typeof parsed.y === 'number' &&
          !isNaN(parsed.y)
        ) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });

  const currentPosRef = useRef<{ x: number; y: number } | null>(position);
  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

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

  // Keep saved position clamped within screen viewport on resize
  useEffect(() => {
    const handleResize = () => {
      if (!position) return;
      const barRect = barRef.current?.getBoundingClientRect();
      const width = barRect && barRect.width > 0 ? barRect.width : 380;
      const height = barRect && barRect.height > 0 ? barRect.height : 60;
      const viewWidth = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
      const viewHeight = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;

      const maxX = Math.max(8, viewWidth - width - 8);
      const maxY = Math.max(8, viewHeight - height - 8);

      const clampedX = Math.min(Math.max(8, position.x), maxX);
      const clampedY = Math.min(Math.max(8, position.y), maxY);

      if (clampedX !== position.x || clampedY !== position.y) {
        const updated = { x: Math.round(clampedX), y: Math.round(clampedY) };
        currentPosRef.current = updated;
        setPosition(updated);
        try {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(updated));
        } catch (_) {}
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // Drag Handlers using Pointer Events
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Do not initiate drag if clicking buttons, links or interactive elements
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }

    const rect = barRef.current?.getBoundingClientRect();
    const clientX = typeof e.clientX === 'number' && !isNaN(e.clientX) ? e.clientX : 0;
    const clientY = typeof e.clientY === 'number' && !isNaN(e.clientY) ? e.clientY : 0;
    const initialX = rect && typeof rect.left === 'number' && !isNaN(rect.left) ? rect.left : 0;
    const initialY = rect && typeof rect.top === 'number' && !isNaN(rect.top) ? rect.top : 0;

    dragStateRef.current = {
      startX: clientX,
      startY: clientY,
      initialX,
      initialY,
    };
    setIsDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch (_) {}
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    const { startX, startY, initialX, initialY } = dragStateRef.current;
    const clientX = typeof e.clientX === 'number' && !isNaN(e.clientX) ? e.clientX : 0;
    const clientY = typeof e.clientY === 'number' && !isNaN(e.clientY) ? e.clientY : 0;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    const barRect = barRef.current?.getBoundingClientRect();
    const width = barRect && barRect.width > 0 ? barRect.width : 380;
    const height = barRect && barRect.height > 0 ? barRect.height : 60;
    const viewWidth = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
    const viewHeight = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;

    const targetX = initialX + deltaX;
    const targetY = initialY + deltaY;

    const clampedX = Math.max(8, Math.min(viewWidth - width - 8, targetX));
    const clampedY = Math.max(8, Math.min(viewHeight - height - 8, targetY));

    const nextPos = { x: Math.round(clampedX), y: Math.round(clampedY) };
    currentPosRef.current = nextPos;
    setPosition(nextPos);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch (_) {}

      if (currentPosRef.current) {
        try {
          localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(currentPosRef.current));
        } catch (_) {}
      }
    }
  }, []);

  const handleResetPosition = () => {
    currentPosRef.current = null;
    setPosition(null);
    try {
      localStorage.removeItem(STORAGE_KEY_POS);
    } catch (_) {}
  };

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
    <div className="w-full h-full min-h-[160px] bg-slate-950 text-slate-100 flex flex-col justify-between p-3.5 box-border select-none overflow-hidden font-sans border-t-2 border-amber-500">
      {/* Top row: Task text + Project + Exit PiP */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                activeWorkSession.isPaused ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'
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
            <span className="text-amber-300 font-medium truncate">
              {activeWorkSession.projectName || 'Standalone'}
            </span>
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
            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
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
          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Complete</span>
        </button>

        <button
          onClick={() => stopWork()}
          className="py-1.5 px-2.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
          title="Stop clock"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );

  // When PiP is active, show docked placeholder pill in the main window
  if (isPiPActive) {
    return (
      <>
        <aside
          ref={barRef}
          aria-label="Active focus work session in Picture-in-Picture"
          style={
            position
              ? {
                  position: 'fixed',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  bottom: 'auto',
                  right: 'auto',
                  margin: 0,
                  zIndex: 50,
                }
              : undefined
          }
          className={`fixed ${
            !position
              ? 'bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-3 right-3 md:left-auto md:right-6'
              : ''
          } z-50 flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-900/95 border border-amber-500/50 backdrop-blur-md rounded-2xl shadow-2xl text-slate-100 text-xs sm:text-sm animate-in fade-in duration-150`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-slate-300 truncate">
              Focusing in Picture-in-Picture:{' '}
              <strong className="text-white font-semibold">
                {activeWorkSession.taskText}
              </strong>
            </span>
            <span className="font-mono text-amber-400 font-bold ml-1 shrink-0">
              {formatTimer(activeWorkElapsedSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleClosePiP}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
              title="Bring status bar back to main window"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Bring Back</span>
            </button>
          </div>
        </aside>

        {/* Portal into the OS PiP Window */}
        <PictureInPicturePortal pipWindow={pipWindow}>
          {pipContent}
        </PictureInPicturePortal>
      </>
    );
  }

  // Regular In-Page Movable Status Bar
  return (
    <>
      <aside
        ref={barRef}
        aria-label="Active focus work session"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={
          position
            ? {
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                bottom: 'auto',
                right: 'auto',
                margin: 0,
                zIndex: 50,
                userSelect: isDragging ? 'none' : undefined,
              }
            : undefined
        }
        className={`fixed ${
          !position
            ? 'bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-3 right-3 md:left-auto md:right-6'
            : ''
        } z-50 flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-900/95 dark:bg-slate-900/95 border ${
          isDragging
            ? 'border-amber-400 shadow-amber-500/20 shadow-2xl scale-[1.01]'
            : 'border-amber-500/40 dark:border-amber-500/40 shadow-2xl shadow-amber-950/20'
        } backdrop-blur-md rounded-2xl text-slate-100 sm:max-w-md md:max-w-lg lg:max-w-xl transition-shadow duration-150 overflow-hidden ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
      >
        {/* Visual Attention Progress Track (at bottom edge of the bar) */}
        {clampedProgressWidth !== null && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80"
            title={`Attention Progress: ${progressPercent}% of ${
              estimatedAU !== undefined ? Math.round(estimatedAU * 100) / 100 : 0
            } AU estimated`}
          >
            <div
              className={`h-full transition-all duration-300 ${
                isOverEstimated ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${clampedProgressWidth}%` }}
            />
          </div>
        )}

        {/* Drag Grip Handle */}
        <div
          className="flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-200 transition-colors px-1 py-1 -ml-1 touch-none"
          title="Drag to reposition status bar anywhere on page • Double-click to reset"
          onDoubleClick={handleResetPosition}
          data-testid="drag-handle"
        >
          <GripVertical className="w-4 h-4 shrink-0" />
        </div>

        {/* Left: Status indicator & Task details */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          {/* Pulse Status Indicator */}
          <div
            className="relative flex items-center justify-center flex-shrink-0 cursor-pointer"
            onClick={handleNavigateToTask}
            title={
              activeWorkSession.isPaused
                ? 'Work session is paused. Click to jump to task.'
                : 'Focus work session in progress. Click to jump to task.'
            }
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
                className="text-xs sm:text-sm font-semibold text-slate-100 truncate hover:text-amber-400 transition-colors flex items-center gap-1 text-left min-w-0 cursor-pointer"
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
                    title={`${progressPercent}% of ${
                      Math.round(estimatedAU * 100) / 100
                    } AU estimated`}
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
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 pl-1.5 sm:pl-2 border-l border-slate-700/60">
          {/* Pause / Resume */}
          {activeWorkSession.isPaused ? (
            <button
              onClick={() => resumeWork()}
              className="p-1.5 sm:px-2.5 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-medium shadow-sm cursor-pointer"
              title="Resume focus work session"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Resume</span>
            </button>
          ) : (
            <button
              onClick={() => pauseWork()}
              className="p-1.5 sm:px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg transition-all flex items-center gap-1 text-xs font-medium border border-slate-700/40 shadow-sm cursor-pointer"
              title="Pause focus work session"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Pause</span>
            </button>
          )}

          {/* Complete & Stop */}
          <button
            onClick={() => completeAndStopWork()}
            className="p-1.5 sm:px-2.5 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-medium shadow-sm cursor-pointer"
            title="Mark task completed and stop work session"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline md:hidden">Done</span>
            <span className="hidden md:inline">Complete & Stop</span>
          </button>

          {/* Stop Clock */}
          <button
            onClick={() => stopWork()}
            className="p-1.5 sm:px-2 bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-medium shadow-sm cursor-pointer"
            title="Stop work clock without completing task"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Stop</span>
          </button>

          {/* Picture-in-Picture Button */}
          <button
            onClick={handleOpenPiP}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 hover:text-amber-300 rounded-lg transition-all flex items-center justify-center border border-slate-700/40 shadow-sm cursor-pointer"
            title="Pop up into OS Picture-in-Picture floating window"
            aria-label="Open Picture-in-Picture"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
          </button>

          {/* Reset Position (visible only when moved) */}
          {position && (
            <button
              onClick={handleResetPosition}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all flex items-center justify-center cursor-pointer"
              title="Reset position to bottom right"
              aria-label="Reset bar position"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
