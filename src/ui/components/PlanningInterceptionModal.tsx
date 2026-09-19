import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Droplet, Brain, Clock, ArrowRight, X } from 'lucide-react';

export const PlanningInterceptionModal: React.FC = () => {
  const {
    planningInterception,
    resolvePlanningInterception,
    activeWorkSession,
    activeWorkElapsedSeconds,
  } = useApp();

  const [thoughtInput, setThoughtInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (planningInterception?.isOpen) {
      setThoughtInput('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [planningInterception?.isOpen]);

  if (!planningInterception?.isOpen) return null;

  const activeTaskName = activeWorkSession?.taskText || 'Active Task';
  const targetProjectName = planningInterception.projectName || 'Project';

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDropThought = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    resolvePlanningInterception('drop_thought', thoughtInput.trim() || undefined);
  };

  const handleSwitchToPlanning = () => {
    resolvePlanningInterception('switch_to_planning');
  };

  const handleCancel = () => {
    resolvePlanningInterception('cancel');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="interception-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header with gentle attention icon */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-400/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 id="interception-modal-title" className="font-bold text-base text-slate-900 dark:text-slate-100">
                You're In Deep Focus!
              </h3>
              <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px] sm:max-w-[260px]">
                  {activeTaskName}
                </span>
                <span>•</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatElapsed(activeWorkElapsedSeconds)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close and continue focus"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Restructuring <strong className="text-slate-900 dark:text-white font-semibold">"{targetProjectName}"</strong> requires switching to <strong>Project Planning mode</strong>, which will stop your active task execution timer.
          </p>

          {/* Quick thought drop box */}
          <form onSubmit={handleDropThought} className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              💡 Just wanted to capture a quick thought or idea?
            </label>
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={thoughtInput}
                onChange={(e) => setThoughtInput(e.target.value)}
                placeholder="Type your thought... (e.g. need tests for auth token)"
                className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 shadow-xs"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer shrink-0 shadow-xs flex items-center space-x-1"
              >
                <Droplet className="w-3.5 h-3.5" />
                <span>Drop & Keep Focus</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
              Parks this thought in the Thoughts Drop Pool so you can review or turn it into a task later.
            </span>
          </form>

          {/* Conscious alternate action */}
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              onClick={handleSwitchToPlanning}
              className="w-full sm:w-auto px-3.5 py-2 rounded-lg font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <span>Stop Task & Switch to Planning</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleCancel}
              className="w-full sm:w-auto px-3 py-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel (Return to Work)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
