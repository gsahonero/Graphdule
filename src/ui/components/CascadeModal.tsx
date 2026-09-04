import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, ArrowRight, CheckCircle2, X } from 'lucide-react';

export const CascadeModal: React.FC = () => {
  const { pendingCascade, setPendingCascade, applyPendingCascade, moveNodeDate, formatDateDisplay } = useApp();

  if (!pendingCascade) return null;

  const handleMoveOnlyThis = () => {
    moveNodeDate(pendingCascade.targetNodeId, pendingCascade.newDueDate, true);
    setPendingCascade(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-amber-500 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
              Temporal Cascade Impact Detected
            </h3>
          </div>
          <button
            onClick={() => setPendingCascade(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Moving <strong className="text-slate-900 dark:text-slate-100 font-semibold">"{pendingCascade.targetNodeText}"</strong> to{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{formatDateDisplay(pendingCascade.newDueDate)}</span> affects{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">{pendingCascade.affectedSuccessors.length} connected tasks</span>.
          </p>

          <div className="bg-slate-50 dark:bg-slate-950/80 rounded-lg p-3 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Affected Connected Tasks
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pendingCascade.affectedSuccessors.map((aff) => (
                <div
                  key={aff.nodeId}
                  className="text-xs bg-white dark:bg-slate-900/90 p-2.5 rounded border border-slate-200 dark:border-slate-800 flex flex-col space-y-1 shadow-sm"
                >
                  <div className="flex items-center justify-between font-medium text-slate-800 dark:text-slate-200">
                    <span className="truncate">{aff.nodeText}</span>
                    <div className="flex items-center space-x-1.5 font-mono text-[11px] shrink-0 ml-2">
                      <span className="text-slate-400">{formatDateDisplay(aff.currentDueDate)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{formatDateDisplay(aff.proposedDueDate)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{aff.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
          <button
            onClick={() => setPendingCascade(null)}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleMoveOnlyThis}
            className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Move Only This
          </button>
          <button
            onClick={applyPendingCascade}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Move Connected Work</span>
          </button>
        </div>
      </div>
    </div>
  );
};
