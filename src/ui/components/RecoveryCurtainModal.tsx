import React, { useEffect, useState, useRef } from 'react';
import { Coffee, Play, Sparkles, X } from 'lucide-react';
import { playSynthesizedPreset } from '../../domain/health/sound';

interface RecoveryCurtainModalProps {
  isOpen: boolean;
  elapsedSeconds: number;
  targetMinutes?: number | null; // e.g. 15, 30, 60, or null/undefined for open-ended
  onEndRecovery: () => void;
  onMinimize?: () => void;
}

export const RecoveryCurtainModal: React.FC<RecoveryCurtainModalProps> = ({
  isOpen,
  elapsedSeconds,
  targetMinutes,
  onEndRecovery,
  onMinimize,
}) => {
  const hasPlayedChimeRef = useRef(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const targetSeconds = targetMinutes && targetMinutes > 0 ? targetMinutes * 60 : null;
  const remainingSeconds = targetSeconds !== null ? Math.max(0, targetSeconds - elapsedSeconds) : null;

  // Detect when target time has elapsed and play chime
  useEffect(() => {
    if (!isOpen) {
      hasPlayedChimeRef.current = false;
      setIsCompleted(false);
      return;
    }

    if (targetSeconds !== null && elapsedSeconds >= targetSeconds) {
      setIsCompleted(true);
      if (!hasPlayedChimeRef.current) {
        hasPlayedChimeRef.current = true;
        try {
          playSynthesizedPreset('meditation_bell', 0.4);
        } catch (_) {}
      }
    }
  }, [isOpen, elapsedSeconds, targetSeconds]);

  // Keyboard shortcut: Escape to close/minimize
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onMinimize) onMinimize();
        else onEndRecovery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onMinimize, onEndRecovery]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Intentional Recovery Screen"
      className="fixed inset-0 z-50 bg-slate-950/90 dark:bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300 select-none"
    >
      {/* Top Controls */}
      <div className="absolute top-6 right-6 flex items-center space-x-3">
        {onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Minimize Curtain to keep timer running in background"
          >
            Minimize
          </button>
        )}
        <button
          type="button"
          onClick={onEndRecovery}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="End Recovery (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-md w-full flex flex-col items-center text-center space-y-8">
        {/* Breathing Halo & Icon */}
        <div className="relative flex items-center justify-center">
          {/* Animated pulsing aura */}
          <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="w-24 h-24 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center shadow-2xl relative z-10">
            <Coffee className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Status Copy */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Intentional Recovery</span>
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">
            {isCompleted ? 'Break Complete' : 'Resting & Recharging'}
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isCompleted
              ? 'Your recovery window is complete. Take a deep breath and return to focus whenever you are ready.'
              : 'Step away from the screen, stretch, drink water, or close your eyes. Your workspace is peacefully paused.'}
          </p>
        </div>

        {/* Timer Display */}
        <div className="bg-slate-900/80 border border-slate-800 px-8 py-5 rounded-2xl shadow-inner flex flex-col items-center space-y-1">
          <div className="font-mono text-4xl font-extrabold tracking-wider text-slate-100">
            {remainingSeconds !== null ? formatTime(remainingSeconds) : formatTime(elapsedSeconds)}
          </div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            {remainingSeconds !== null ? 'Time Remaining' : 'Elapsed Rest Time'}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <button
            type="button"
            onClick={onEndRecovery}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isCompleted ? 'Return to Focus' : 'End Break Early'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
