import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Brain,
  Eye,
  Sparkles,
  Minimize2,
  Calendar,
  Clock,
  Plus,
} from 'lucide-react';
import { AttentionService } from '../../domain/services/attention-service';

export const ZenFocusCurtain: React.FC = () => {
  const {
    activeWorkSession,
    activeWorkElapsedSeconds,
    attentionUnitMinutes,
    allActiveNodes,
    standaloneTasks,
    activeProjectDoc,
    preferences,
    setZenCurtainEnabled,
    addDroppedThought,
    setIsThoughtsPoolOpen,
    formatDateDisplay,
  } = useApp();

  const [isPeeking, setIsPeeking] = useState(false);
  const [quickThought, setQuickThought] = useState('');
  const [justDropped, setJustDropped] = useState(false);
  const peekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active only if user enabled Zen Curtain and an execution session is running
  const isCurtainActive =
    Boolean(preferences.zenCurtainEnabled) &&
    Boolean(activeWorkSession) &&
    activeWorkSession?.sessionType === 'execution';

  if (!isCurtainActive || !activeWorkSession) return null;

  const activeTask =
    allActiveNodes.find((n) => n.id === activeWorkSession.taskId) ||
    standaloneTasks.find((t) => t.id === activeWorkSession.taskId) ||
    null;

  const currentAU = AttentionService.durationSecondsToAU(activeWorkElapsedSeconds, attentionUnitMinutes);
  const formattedAU = AttentionService.formatAU(currentAU, attentionUnitMinutes);

  const taskNotes = activeProjectDoc?.notes.filter((n) => n.nodeId === activeWorkSession.taskId) || [];

  const handleDoubleClickBackdrop = (e: React.MouseEvent) => {
    // Only trigger if clicking backdrop itself, not the card
    if ((e.target as HTMLElement).closest('.focus-island-card')) return;
    setIsPeeking(true);
    if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
    peekTimeoutRef.current = setTimeout(() => {
      setIsPeeking(false);
    }, 2500);
  };

  const handleQuickDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickThought.trim()) return;

    await addDroppedThought(quickThought.trim(), {
      projectId: activeWorkSession.projectId,
      projectName: activeWorkSession.projectName,
      originTaskId: activeWorkSession.taskId,
      originTaskText: activeWorkSession.taskText,
    });

    setQuickThought('');
    setJustDropped(true);
    setTimeout(() => setJustDropped(false), 2000);
  };

  return (
    <div
      onDoubleClick={handleDoubleClickBackdrop}
      className={`fixed inset-0 z-25 flex items-center justify-center p-4 transition-all duration-300 select-none ${
        isPeeking
          ? 'bg-slate-950/5 backdrop-blur-[0px] pointer-events-none'
          : 'bg-slate-950/60 backdrop-blur-md pointer-events-auto'
      }`}
    >
      {/* Centered Active Task Focus Island */}
      <div
        className={`focus-island-card max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isPeeking ? 'opacity-10 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        {/* Card Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 dark:bg-brand-400/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-600 dark:text-brand-400">
                Zen Focus Mode
              </span>
              {activeWorkSession.projectName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                  in {activeWorkSession.projectName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Peek Button (Hold or Click) */}
            <button
              onMouseDown={() => setIsPeeking(true)}
              onMouseUp={() => setIsPeeking(false)}
              onTouchStart={() => setIsPeeking(true)}
              onTouchEnd={() => setIsPeeking(false)}
              onClick={() => {
                setIsPeeking(true);
                setTimeout(() => setIsPeeking(false), 2000);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center space-x-1 border border-slate-200 dark:border-slate-800"
              title="Hold or click to peek at the underlying graph"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hold to Peek</span>
            </button>

            {/* Minimize / Disable Curtain */}
            <button
              onClick={() => setZenCurtainEnabled(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Disable Zen Curtain"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task Details Body */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {activeWorkSession.taskText}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
              {activeTask?.dueDate && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Due {formatDateDisplay(activeTask.dueDate)}</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {formattedAU}
                </span>
                {activeTask?.estimatedAU && (
                  <span className="text-slate-400">/ Est: {activeTask.estimatedAU} AU</span>
                )}
              </div>
            </div>
          </div>

          {/* Task notes if present */}
          {taskNotes.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 max-h-28 overflow-y-auto space-y-1.5 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Task Context Notes:
              </span>
              {taskNotes.map((n) => (
                <p key={n.id} className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  • {n.text}
                </p>
              ))}
            </div>
          )}

          {/* Inline Quick-Drop to Thoughts Pool */}
          <form onSubmit={handleQuickDrop} className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600 dark:text-slate-300 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                <span>Distracting thought? Park it in the Pool:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsThoughtsPoolOpen(true)}
                className="text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Open Pool Drawer
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={quickThought}
                onChange={(e) => setQuickThought(e.target.value)}
                placeholder="Type and press Enter to drop thought..."
                className="flex-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-xs"
              />
              <button
                type="submit"
                disabled={!quickThought.trim()}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition-colors cursor-pointer shrink-0 shadow-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Drop</span>
              </button>
            </div>
            {justDropped && (
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium animate-in fade-in block">
                ✓ Dropped into Thoughts Pool! Stay focused.
              </span>
            )}
          </form>
        </div>

        {/* Footer info tip */}
        <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <span>💡 Double-click canvas or hold button to peek at graph.</span>
          <span className="font-mono">Active Work Bar below ↓</span>
        </div>
      </div>
    </div>
  );
};
