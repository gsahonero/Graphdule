import React, { useEffect } from 'react';
import { BonsaiState, CompanionType } from '../../domain/models/types';
import { BonsaiService, COMPANIONS } from '../../domain/services/bonsai-service';
import { CompanionArt } from './CompanionArt';
import { Check, Sparkles, X, Heart } from 'lucide-react';

interface CompanionPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentType?: CompanionType;
  onSelectPet: (type: CompanionType) => void | Promise<void>;
  state?: BonsaiState;
}

export const CompanionPetModal: React.FC<CompanionPetModalProps> = ({
  isOpen,
  onClose,
  currentType = 'bonsai',
  onSelectPet,
  state,
}) => {
  const currentStage = state ? BonsaiService.calculateStage(state.growthPoints) : 0;
  const growthPoints = state?.growthPoints ?? 0;
  const recentColor = state?.recentProjectColors?.[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const companionList = Object.values(COMPANIONS);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="companion-pet-modal"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Choose Your Focus Companion
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Each companion has a unique personality and grows with your focused momentum
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Grid of Pets */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {companionList.map((comp) => {
              const isSelected = comp.id === currentType;
              const petStageName = comp.stages[currentStage] || 'Companion';

              return (
                <div
                  key={comp.id}
                  onClick={async () => {
                    onClose();
                    await onSelectPet(comp.id);
                  }}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-md'
                  }`}
                  data-testid={`pet-card-${comp.id}`}
                >
                  <div className="flex items-start space-x-3.5">
                    {/* SVG Artwork Preview */}
                    <div className="shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900/60 rounded-xl p-1 border border-slate-100 dark:border-slate-800/80">
                      <CompanionArt
                        type={comp.id}
                        stage={currentStage}
                        size="sm"
                        projectColor={recentColor}
                        variant={isSelected ? 'focusing' : 'idle'}
                      />
                    </div>

                    {/* Metadata & Tagline */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-base">{comp.emoji}</span>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {comp.name}
                          </h3>
                        </div>
                        {isSelected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white gap-1 shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {petStageName} · Stage {currentStage + 1}/5
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {comp.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Stage preview footer */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                      {comp.species}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {growthPoints} pts earned
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zero-Shame Continuity Banner */}
          <div className="rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center space-x-3 text-xs text-slate-600 dark:text-slate-300">
            <Heart className="w-4 h-4 text-rose-500 shrink-0" />
            <p className="leading-relaxed">
              <strong className="text-slate-800 dark:text-slate-200">Zero-Shame Continuity:</strong> Switching your companion carries over 100% of your growth points, evolutionary stage, and momentum. Your companions never wilt, regress, or judge you.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
