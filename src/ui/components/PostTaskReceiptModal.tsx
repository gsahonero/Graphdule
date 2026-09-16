import React, { useEffect } from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { BonsaiService } from '../../domain/services/bonsai-service';

export interface PostTaskReceiptData {
  taskId: string;
  taskText: string;
  projectId?: string;
  predictedAU?: number;
  actualAU: number;
  actualMinutes: number;
  pointsEarned?: number;
  newStage?: number;
  didAdvanceStage?: boolean;
}

interface PostTaskReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PostTaskReceiptData | null;
  bonsaiEnabled?: boolean;
}

export const PostTaskReceiptModal: React.FC<PostTaskReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
  bonsaiEnabled = true,
}) => {
  // Keyboard shortcut: Enter or Escape to dismiss in 1-click
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const {
    taskText,
    predictedAU,
    actualAU,
    actualMinutes,
    pointsEarned = Math.max(1, Math.round(actualAU * 10)),
    newStage,
    didAdvanceStage,
  } = data;

  const hasPrediction = typeof predictedAU === 'number' && predictedAU > 0;
  const delta = hasPrediction ? Number((actualAU - predictedAU).toFixed(1)) : null;

  // Neutral, supportive feedback message
  let feedbackMessage = 'Focused progress tracked and added to your momentum.';
  let feedbackType: 'spot_on' | 'under' | 'over' | 'neutral' = 'neutral';

  if (hasPrediction && delta !== null) {
    if (Math.abs(delta) <= 0.25) {
      feedbackMessage = '🎯 Spot-on calibration! Your estimate was right on target.';
      feedbackType = 'spot_on';
    } else if (delta > 0.25) {
      feedbackMessage = '⚡ Deep focus stretch. This task demanded more attention than expected—great persistence seeing it through.';
      feedbackType = 'under';
    } else {
      feedbackMessage = '✨ Wrapped up faster than estimated! Crisp, efficient execution.';
      feedbackType = 'over';
    }
  }

  const stageName = typeof newStage === 'number' ? BonsaiService.getStageName(newStage) : 'Bonsai';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Top Celebration Accent Bar */}
        <div className="h-1.5 bg-linear-to-r from-emerald-500 via-teal-500 to-indigo-500" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Task Completed
                </span>
                <h3 id="receipt-title" className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {taskText}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
              title="Dismiss (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* AU Calibration Comparison Card */}
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              {/* Predicted AU */}
              <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Estimated
                </div>
                <div className="text-lg font-black text-slate-700 dark:text-slate-200 mt-0.5">
                  {hasPrediction ? `${predictedAU} AU` : '—'}
                </div>
              </div>

              {/* Actual AU */}
              <div className="bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Actual
                </div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {actualAU.toFixed(1)} AU
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  ({actualMinutes}m)
                </div>
              </div>
            </div>

            {/* Reflection Note */}
            <div
              className={`p-2.5 rounded-lg text-xs leading-relaxed font-medium border ${
                feedbackType === 'spot_on'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
                  : feedbackType === 'over'
                  ? 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/20'
                  : feedbackType === 'under'
                  ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                  : 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              {feedbackMessage}
            </div>
          </div>

          {/* Bonsai Reward Feedback (if enabled) */}
          {bonsaiEnabled && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    +{pointsEarned} Bonsai Growth Points
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    {didAdvanceStage ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-300">
                        🎉 Stage Evolved to {stageName}!
                      </span>
                    ) : (
                      'Nurturing sustained daily focus'
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1-Click Dismiss Action Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
          >
            <span>Continue</span>
            <span className="text-xs opacity-60 font-normal">(Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
