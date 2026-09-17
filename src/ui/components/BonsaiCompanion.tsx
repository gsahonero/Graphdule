import React, { useState, useContext, useRef } from 'react';
import { BonsaiState, CompanionType } from '../../domain/models/types';
import { BonsaiService, DEFAULT_BONSAI_STATE } from '../../domain/services/bonsai-service';
import { AppContext } from '../context/AppContext';
import { CompanionArt } from './CompanionArt';
import { CompanionPetModal } from './CompanionPetModal';
import { Sparkles, Heart } from 'lucide-react';

interface BonsaiCompanionProps {
  state?: BonsaiState;
  variant?: 'focusing' | 'resting' | 'blooming' | 'idle';
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  allowChangePet?: boolean;
  onPetChange?: (newPet: CompanionType) => void | Promise<void>;
  className?: string;
}

export const BonsaiCompanion: React.FC<BonsaiCompanionProps> = ({
  state = DEFAULT_BONSAI_STATE,
  variant = 'idle',
  size = 'md',
  showDetails = true,
  allowChangePet = true,
  onPetChange,
  className = '',
}) => {
  const appContext = useContext(AppContext);
  const companionType = state.companionType || 'bonsai';
  const companionMeta = BonsaiService.getCompanionMeta(companionType);
  const currentStage = BonsaiService.calculateStage(state.growthPoints);
  const stageName = BonsaiService.getStageName(currentStage, companionType);
  const nextStageName = currentStage < 4 ? BonsaiService.getStageName(currentStage + 1, companionType) : '';
  const progressInfo = BonsaiService.getProgressToNextStage(state.growthPoints);

  const [isHovered, setIsHovered] = useState(false);
  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (allowChangePet) {
      e.stopPropagation();
      setIsPetModalOpen(true);
    }
  };

  const handleSelectPet = async (newPet: CompanionType) => {
    if (onPetChange) {
      await onPetChange(newPet);
    }
    if (appContext?.updatePreferences) {
      await appContext.updatePreferences({
        bonsai: {
          ...(state || DEFAULT_BONSAI_STATE),
          companionType: newPet,
        },
      });
    }
  };

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${className}`}
      data-testid="bonsai-companion"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Clickable Companion Artwork Container */}
      <div
        onClick={handleClick}
        className={`group relative rounded-2xl p-1 transition-all duration-200 ${
          allowChangePet ? 'cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 active:scale-95' : ''
        }`}
        title={allowChangePet ? `Click to change pet (Current: ${companionMeta.name})` : undefined}
        role={allowChangePet ? 'button' : undefined}
        tabIndex={allowChangePet ? 0 : undefined}
        onKeyDown={(e) => {
          if (allowChangePet && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsPetModalOpen(true);
          }
        }}
      >
        <CompanionArt
          type={companionType}
          stage={currentStage}
          variant={variant}
          size={size}
          projectColor={state.recentProjectColors?.[0]}
        />
      </div>

      {/* Companion Details (Stage, Points, Progress) */}
      {showDetails && (
        <div className="mt-1 text-center flex flex-col items-center space-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {stageName}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800">
              {state.growthPoints} pts
            </span>
          </div>

          {currentStage < 4 ? (
            <div className="w-24 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressInfo.stageProgressPercent}%` }}
                title={`${progressInfo.pointsToNext} pts to next stage`}
              />
            </div>
          ) : (
            <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Mastery
            </span>
          )}
        </div>
      )}

      {/* Rich Growth Tooltip on Hover */}
      {isHovered && (
        <div
          role="tooltip"
          data-testid="bonsai-growth-tooltip"
          className="absolute top-full mt-2.5 z-50 w-72 sm:w-80 p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl text-left text-xs text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tooltip Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-xl">{companionMeta.emoji}</span>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>{companionMeta.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800">
                    {stageName}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {companionMeta.species} · Stage {currentStage + 1}/5
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {state.growthPoints} pts
              </span>
            </div>
          </div>

          {/* Stage Progress */}
          <div className="py-2 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>Progress to next stage</span>
              <span>
                {currentStage < 4
                  ? `${progressInfo.pointsToNext} pts to ${nextStageName}`
                  : 'Mastery reached'}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressInfo.stageProgressPercent}%` }}
              />
            </div>
          </div>

          {/* How to Grow Explanatory List */}
          <div className="py-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>How we make it grow:</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold shrink-0">🎯</span>
                <span><strong>Complete tasks & focus:</strong> Earn ~10 pts per 1 AU of completed work.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-teal-500 font-bold shrink-0">☕</span>
                <span><strong>Intentional recovery:</strong> Earn +5 pts when taking a mindful break.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold shrink-0">🎨</span>
                <span><strong>Adaptive colors:</strong> Accents absorb colors from your active projects.</span>
              </li>
            </ul>
          </div>

          {/* Zero-Shame Promise */}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <Heart className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
            <span><strong>Zero-Shame Promise:</strong> Your companion never wilts, starves, or loses points.</span>
          </div>

          {/* Click to change pet button */}
          {allowChangePet && (
            <button
              type="button"
              onClick={() => setIsPetModalOpen(true)}
              className="w-full mt-2.5 py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span>🐾 Click to change pet</span>
            </button>
          )}
        </div>
      )}

      {/* Companion Pet Selector Modal */}
      {allowChangePet && (
        <CompanionPetModal
          isOpen={isPetModalOpen}
          onClose={() => setIsPetModalOpen(false)}
          currentType={companionType}
          onSelectPet={handleSelectPet}
          state={state}
        />
      )}
    </div>
  );
};
