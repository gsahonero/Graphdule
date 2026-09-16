import React, { useMemo } from 'react';
import { BonsaiState } from '../../domain/models/types';
import { BonsaiService, DEFAULT_BONSAI_STATE } from '../../domain/services/bonsai-service';
import { Sparkles } from 'lucide-react';

interface BonsaiCompanionProps {
  state?: BonsaiState;
  variant?: 'focusing' | 'resting' | 'blooming' | 'idle';
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export const BonsaiCompanion: React.FC<BonsaiCompanionProps> = ({
  state = DEFAULT_BONSAI_STATE,
  variant = 'idle',
  size = 'md',
  showDetails = true,
  className = '',
}) => {
  const currentStage = BonsaiService.calculateStage(state.growthPoints);
  const stageName = BonsaiService.getStageName(currentStage);
  const progressInfo = BonsaiService.getProgressToNextStage(state.growthPoints);

  const dimension = size === 'sm' ? 64 : size === 'lg' ? 160 : 100;

  // Project tint color for leaves if available
  const leafColor = useMemo(() => {
    const firstColor = state.recentProjectColors?.[0];
    if (firstColor === 'indigo') return '#6366f1';
    if (firstColor === 'sky') return '#0284c7';
    if (firstColor === 'purple') return '#a855f7';
    if (firstColor === 'amber') return '#d97706';
    if (firstColor === 'rose') return '#e11d48';
    return '#10b981'; // default emerald
  }, [state.recentProjectColors]);

  return (
    <div
      className={`flex flex-col items-center select-none ${className}`}
      data-testid="bonsai-companion"
    >
      {/* Container with gentle ambient glow */}
      <div
        className={`relative flex items-center justify-center transition-transform duration-300 ${
          variant === 'focusing'
            ? 'scale-105 animate-pulse'
            : variant === 'blooming'
            ? 'scale-110'
            : 'hover:scale-105'
        }`}
        style={{ width: dimension, height: dimension }}
      >
        <svg
          viewBox="0 0 120 120"
          width={dimension}
          height={dimension}
          className="overflow-visible drop-shadow-md"
        >
          <defs>
            <linearGradient id="potGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id="foliageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor={leafColor} />
            </linearGradient>
          </defs>

          {/* Pot Base & Soil */}
          <path
            d="M 35 98 L 85 98 L 80 112 L 40 112 Z"
            fill="url(#potGrad)"
            stroke="#334155"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <ellipse cx="60" cy="98" rx="26" ry="4" fill="#3f2e1e" />

          {/* Stage-dependent rendering */}
          {currentStage === 0 && (
            // Stage 0: Seedling
            <g className="animate-in fade-in zoom-in-75 duration-300">
              <path
                d="M 60 98 Q 61 82 58 72"
                stroke="url(#trunkGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 58 72 Q 44 68 47 60 Q 58 64 58 72"
                fill="url(#foliageGrad)"
                stroke="#059669"
                strokeWidth="0.8"
              />
              <path
                d="M 58 72 Q 72 70 70 62 Q 59 66 58 72"
                fill="url(#foliageGrad)"
                stroke="#059669"
                strokeWidth="0.8"
              />
            </g>
          )}

          {currentStage === 1 && (
            // Stage 1: Sprout
            <g className="animate-in fade-in zoom-in-75 duration-300">
              <path
                d="M 60 98 Q 63 80 54 62 Q 51 52 56 46"
                stroke="url(#trunkGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              {/* Branch */}
              <path
                d="M 58 72 Q 70 66 74 58"
                stroke="url(#trunkGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Leaves */}
              <ellipse cx="54" cy="46" rx="14" ry="9" fill="url(#foliageGrad)" />
              <ellipse cx="74" cy="58" rx="11" ry="7" fill="url(#foliageGrad)" />
            </g>
          )}

          {currentStage === 2 && (
            // Stage 2: Sapling
            <g className="animate-in fade-in zoom-in-75 duration-300">
              <path
                d="M 60 98 Q 65 78 52 60 Q 48 48 55 36"
                stroke="url(#trunkGrad)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 57 68 Q 72 62 78 52"
                stroke="url(#trunkGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 50 54 Q 38 50 34 44"
                stroke="url(#trunkGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Foliage Clusters */}
              <ellipse cx="54" cy="34" rx="18" ry="11" fill="url(#foliageGrad)" opacity="0.95" />
              <ellipse cx="78" cy="50" rx="14" ry="9" fill="url(#foliageGrad)" opacity="0.95" />
              <ellipse cx="34" cy="43" rx="12" ry="8" fill="url(#foliageGrad)" opacity="0.95" />
              {/* Blossom */}
              {state.blossomCount > 0 && (
                <circle cx="58" cy="30" r="3" fill="#f43f5e" className="animate-pulse" />
              )}
            </g>
          )}

          {currentStage >= 3 && (
            // Stage 3 & 4: Cultivated / Ancient
            <g className="animate-in fade-in zoom-in-75 duration-300">
              {/* Stately Gnarled Trunk */}
              <path
                d="M 60 98 Q 67 76 50 58 Q 44 44 56 28"
                stroke="url(#trunkGrad)"
                strokeWidth={currentStage === 4 ? 7 : 5.5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 56 68 Q 74 62 82 48"
                stroke="url(#trunkGrad)"
                strokeWidth={currentStage === 4 ? 4 : 3.2}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 48 52 Q 32 46 26 38"
                stroke="url(#trunkGrad)"
                strokeWidth={currentStage === 4 ? 3.5 : 2.8}
                strokeLinecap="round"
                fill="none"
              />

              {/* Cloud Foliage Pads */}
              <ellipse cx="55" cy="26" rx="22" ry="12" fill="url(#foliageGrad)" opacity="0.95" />
              <ellipse cx="82" cy="46" rx="16" ry="10" fill="url(#foliageGrad)" opacity="0.95" />
              <ellipse cx="26" cy="38" rx="15" ry="9" fill="url(#foliageGrad)" opacity="0.95" />
              <ellipse cx="64" cy="42" rx="14" ry="8" fill="url(#foliageGrad)" opacity="0.9" />

              {/* Blossoms */}
              <circle cx="54" cy="22" r="3.2" fill="#f43f5e" />
              <circle cx="78" cy="44" r="2.8" fill="#fb7185" />
              <circle cx="28" cy="35" r="2.8" fill="#fb7185" />
              {currentStage === 4 && (
                <>
                  <circle cx="62" cy="28" r="2.5" fill="#fda4af" />
                  <circle cx="86" cy="50" r="2.2" fill="#fda4af" />
                  {/* Subtle falling petal */}
                  <circle cx="40" cy="70" r="1.8" fill="#fda4af" opacity="0.7" />
                </>
              )}
            </g>
          )}

          {/* Rest Mode Indicator (Sleeping Zzz or gentle moon if resting) */}
          {variant === 'resting' && (
            <g className="animate-in fade-in duration-300">
              <text x="82" y="30" fill="#94a3b8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                z
              </text>
              <text x="90" y="24" fill="#64748b" fontSize="8" fontWeight="bold" fontFamily="monospace">
                z
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Companion Details (Stage, Points, Progress) */}
      {showDetails && (
        <div className="mt-2 text-center flex flex-col items-center space-y-1">
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
    </div>
  );
};
