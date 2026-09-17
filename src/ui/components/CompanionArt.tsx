import React, { useMemo } from 'react';
import { CompanionType } from '../../domain/models/types';

export interface CompanionArtProps {
  type?: CompanionType;
  stage?: number;
  variant?: 'focusing' | 'resting' | 'blooming' | 'idle';
  size?: 'sm' | 'md' | 'lg';
  dimension?: number;
  projectColor?: string;
  className?: string;
}

export const CompanionArt: React.FC<CompanionArtProps> = ({
  type = 'bonsai',
  stage = 0,
  variant = 'idle',
  size = 'md',
  dimension: customDimension,
  projectColor,
  className = '',
}) => {
  const currentStage = Math.max(0, Math.min(4, stage));
  const dimension = customDimension ?? (size === 'sm' ? 64 : size === 'lg' ? 160 : 100);

  // Project tint color for accents (leaves, collars, ribbons, markings)
  const tintColor = useMemo(() => {
    if (projectColor === 'indigo') return '#6366f1';
    if (projectColor === 'sky') return '#0284c7';
    if (projectColor === 'purple') return '#a855f7';
    if (projectColor === 'amber') return '#d97706';
    if (projectColor === 'rose') return '#e11d48';
    if (projectColor === 'teal') return '#0d9488';
    return '#10b981'; // default emerald
  }, [projectColor]);

  return (
    <div
      className={`relative flex items-center justify-center transition-transform duration-300 ${
        variant === 'focusing'
          ? 'scale-105 animate-pulse'
          : variant === 'blooming'
          ? 'scale-110'
          : 'hover:scale-105'
      } ${className}`}
      style={{ width: dimension, height: dimension }}
      data-testid="companion-art"
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
            <stop offset="100%" stopColor={tintColor} />
          </linearGradient>
          <linearGradient id="catFurGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="foxFurGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="owlFeatherGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="turtleShellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* 1. BONSAI COMPANION */}
        {type === 'bonsai' && (
          <g>
            <path
              d="M 35 98 L 85 98 L 80 112 L 40 112 Z"
              fill="url(#potGrad)"
              stroke="#334155"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <ellipse cx="60" cy="98" rx="26" ry="4" fill="#3f2e1e" />

            {currentStage === 0 && (
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
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <path
                  d="M 60 98 Q 63 80 54 62 Q 51 52 56 46"
                  stroke="url(#trunkGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 58 72 Q 70 66 74 58"
                  stroke="url(#trunkGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse cx="54" cy="46" rx="14" ry="9" fill="url(#foliageGrad)" />
                <ellipse cx="74" cy="58" rx="11" ry="7" fill="url(#foliageGrad)" />
              </g>
            )}

            {currentStage === 2 && (
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
                <ellipse cx="54" cy="34" rx="18" ry="11" fill="url(#foliageGrad)" opacity="0.95" />
                <ellipse cx="78" cy="50" rx="14" ry="8" fill="url(#foliageGrad)" opacity="0.9" />
                <ellipse cx="32" cy="42" rx="12" ry="7" fill="url(#foliageGrad)" opacity="0.9" />
              </g>
            )}

            {currentStage >= 3 && (
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <path
                  d="M 57 98 Q 66 74 50 54 Q 45 42 56 26"
                  stroke="url(#trunkGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 55 64 Q 74 58 82 46"
                  stroke="url(#trunkGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 48 48 Q 32 44 26 36"
                  stroke="url(#trunkGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse cx="56" cy="24" rx="22" ry="13" fill="url(#foliageGrad)" />
                <ellipse cx="82" cy="44" rx="17" ry="10" fill="url(#foliageGrad)" opacity="0.95" />
                <ellipse cx="26" cy="36" rx="15" ry="9" fill="url(#foliageGrad)" opacity="0.95" />
                <ellipse cx="64" cy="42" rx="14" ry="8" fill="url(#foliageGrad)" opacity="0.9" />

                <circle cx="54" cy="22" r="3.2" fill="#f43f5e" />
                <circle cx="78" cy="44" r="2.8" fill="#fb7185" />
                <circle cx="28" cy="35" r="2.8" fill="#fb7185" />
                {currentStage === 4 && (
                  <>
                    <circle cx="62" cy="28" r="2.5" fill="#fda4af" />
                    <circle cx="86" cy="50" r="2.2" fill="#fda4af" />
                    <circle cx="40" cy="70" r="1.8" fill="#fda4af" opacity="0.7" />
                  </>
                )}
              </g>
            )}
          </g>
        )}

        {/* 2. CAT COMPANION */}
        {type === 'cat' && (
          <g>
            {/* Cushion Base */}
            <ellipse cx="60" cy="100" rx="34" ry="8" fill="#334155" opacity="0.3" />
            <ellipse cx="60" cy="98" rx="30" ry="6" fill={tintColor} opacity="0.25" />

            {currentStage === 0 && (
              // Sleepy Kitten
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="85" rx="19" ry="15" fill="url(#catFurGrad)" />
                {/* Ears */}
                <polygon points="46,75 51,64 57,74" fill="#cbd5e1" />
                <polygon points="48,74 51,66 55,73" fill="#fda4af" />
                <polygon points="63,74 69,64 74,75" fill="#cbd5e1" />
                <polygon points="65,73 69,66 72,74" fill="#fda4af" />
                {/* Sleeping eyes & nose */}
                <path d="M 52 83 Q 55 86 58 83" stroke="#475569" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M 62 83 Q 65 86 68 83" stroke="#475569" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <polygon points="59,86 61,86 60,88" fill="#f43f5e" />
                {/* Curled Tail */}
                <path d="M 42 88 Q 36 82 42 76" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" fill="none" />
              </g>
            )}

            {currentStage === 1 && (
              // Playful Cat
              <g className="animate-in fade-in zoom-in-75 duration-300">
                {/* Body */}
                <ellipse cx="60" cy="85" rx="16" ry="17" fill="url(#catFurGrad)" />
                {/* Head */}
                <circle cx="60" cy="65" r="14" fill="url(#catFurGrad)" />
                {/* Ears */}
                <polygon points="48,58 52,45 60,55" fill="#cbd5e1" />
                <polygon points="50,56 53,48 58,54" fill="#fda4af" />
                <polygon points="60,55 68,45 72,58" fill="#cbd5e1" />
                <polygon points="62,54 67,48 70,56" fill="#fda4af" />
                {/* Eyes */}
                <circle cx="55" cy="64" r="2.2" fill="#0f172a" />
                <circle cx="56" cy="63" r="0.7" fill="#ffffff" />
                <circle cx="65" cy="64" r="2.2" fill="#0f172a" />
                <circle cx="66" cy="63" r="0.7" fill="#ffffff" />
                {/* Nose & Mouth */}
                <polygon points="59,68 61,68 60,70" fill="#f43f5e" />
                <path d="M 58 71 Q 60 73 62 71" stroke="#64748b" strokeWidth="0.8" fill="none" />
                {/* Tail waving up */}
                <path d="M 74 88 Q 84 80 80 68" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {currentStage === 2 && (
              // Cozy Companion with tinted collar
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="84" rx="18" ry="18" fill="url(#catFurGrad)" />
                <circle cx="60" cy="60" r="15" fill="url(#catFurGrad)" />
                <polygon points="47,53 50,38 59,50" fill="#cbd5e1" />
                <polygon points="49,51 51,41 57,49" fill="#fda4af" />
                <polygon points="61,50 70,38 73,53" fill="#cbd5e1" />
                <polygon points="63,49 69,41 71,51" fill="#fda4af" />
                {/* Collar */}
                <path d="M 50 71 Q 60 75 70 71" stroke={tintColor} strokeWidth="3" strokeLinecap="round" fill="none" />
                <circle cx="60" cy="74" r="2.5" fill="#f59e0b" />
                {/* Eyes */}
                <ellipse cx="54" cy="59" rx="2.5" ry="3" fill="#0f172a" />
                <circle cx="55" cy="58" r="0.8" fill="#ffffff" />
                <ellipse cx="66" cy="59" rx="2.5" ry="3" fill="#0f172a" />
                <circle cx="67" cy="58" r="0.8" fill="#ffffff" />
                {/* Nose & Whiskers */}
                <polygon points="59,63 61,63 60,65" fill="#f43f5e" />
                <line x1="43" y1="62" x2="51" y2="63" stroke="#94a3b8" strokeWidth="0.8" />
                <line x1="69" y1="63" x2="77" y2="62" stroke="#94a3b8" strokeWidth="0.8" />
                {/* Tail */}
                <path d="M 76 86 Q 88 80 84 62 Q 80 56 86 52" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {currentStage >= 3 && (
              // Zen Feline / Guardian Spirit
              <g className="animate-in fade-in zoom-in-75 duration-300">
                {currentStage === 4 && (
                  <>
                    <circle cx="60" cy="56" r="32" stroke={tintColor} strokeWidth="1.2" strokeDasharray="3 3" fill="none" opacity="0.6" />
                    <circle cx="34" cy="40" r="2" fill="#fef08a" />
                    <circle cx="86" cy="40" r="2" fill="#fef08a" />
                    <circle cx="60" cy="20" r="2.5" fill="#f59e0b" />
                  </>
                )}
                {/* Body */}
                <ellipse cx="60" cy="82" rx="20" ry="19" fill="url(#catFurGrad)" />
                {/* Ornate Scarf */}
                <path d="M 47 70 Q 60 76 73 70 L 68 86 L 60 78 L 52 86 Z" fill={tintColor} />
                <circle cx="60" cy="74" r="3" fill="#fbbf24" />
                {/* Head */}
                <circle cx="60" cy="56" r="16" fill="url(#catFurGrad)" />
                <polygon points="46,48 50,32 60,45" fill="#cbd5e1" />
                <polygon points="48,46 51,35 58,44" fill="#fda4af" />
                <polygon points="60,45 70,32 74,48" fill="#cbd5e1" />
                <polygon points="62,44 69,35 72,46" fill="#fda4af" />
                {/* Crescent mark on forehead */}
                <path d="M 58 46 Q 60 49 62 46 Q 60 48 58 46" fill="#f59e0b" />
                {/* Serene eyes */}
                <path d="M 52 56 Q 55 59 58 56" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M 62 56 Q 65 59 68 56" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <polygon points="59,60 61,60 60,62" fill="#f43f5e" />
                {/* Double Spirit Tails */}
                <path d="M 78 84 Q 92 78 88 60 Q 84 52 90 46" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                {currentStage === 4 && (
                  <path d="M 42 84 Q 28 78 32 60 Q 36 52 30 46" stroke={tintColor} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />
                )}
              </g>
            )}
          </g>
        )}

        {/* 3. OWL COMPANION */}
        {type === 'owl' && (
          <g>
            {/* Wooden Perch */}
            <path d="M 18 100 Q 60 96 102 100" stroke="#78350f" strokeWidth="5" strokeLinecap="round" fill="none" />
            <ellipse cx="60" cy="104" rx="20" ry="2.5" fill="#334155" opacity="0.2" />
            <circle cx="28" cy="98" r="3" fill={tintColor} opacity="0.8" />

            {currentStage === 0 && (
              // Round Owlet
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="80" rx="18" ry="18" fill="url(#owlFeatherGrad)" />
                {/* Giant curious eyes */}
                <circle cx="53" cy="77" r="7" fill="#fef08a" stroke="#475569" strokeWidth="1" />
                <circle cx="53" cy="77" r="4" fill="#0f172a" />
                <circle cx="55" cy="75" r="1.5" fill="#ffffff" />
                <circle cx="67" cy="77" r="7" fill="#fef08a" stroke="#475569" strokeWidth="1" />
                <circle cx="67" cy="77" r="4" fill="#0f172a" />
                <circle cx="69" cy="75" r="1.5" fill="#ffffff" />
                <polygon points="58,82 62,82 60,87" fill="#f97316" />
                <line x1="53" y1="97" x2="53" y2="101" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
                <line x1="67" y1="97" x2="67" y2="101" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}

            {currentStage === 1 && (
              // Fledgling
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="78" rx="19" ry="20" fill="url(#owlFeatherGrad)" />
                <polygon points="46,62 42,50 52,58" fill="#475569" />
                <polygon points="68,58 78,50 74,62" fill="#475569" />
                <ellipse cx="44" cy="78" rx="5" ry="13" fill="#334155" />
                <ellipse cx="76" cy="78" rx="5" ry="13" fill="#334155" />
                <circle cx="53" cy="72" r="7.5" fill="#fde047" />
                <circle cx="53" cy="72" r="4.5" fill="#0f172a" />
                <circle cx="55" cy="70" r="1.5" fill="#ffffff" />
                <circle cx="67" cy="72" r="7.5" fill="#fde047" />
                <circle cx="67" cy="72" r="4.5" fill="#0f172a" />
                <circle cx="69" cy="70" r="1.5" fill="#ffffff" />
                <polygon points="58,78 62,78 60,84" fill="#ea580c" />
                <path d="M 54 86 Q 60 89 66 86" stroke="#94a3b8" strokeWidth="1" fill="none" />
                <path d="M 56 90 Q 60 93 64 90" stroke="#94a3b8" strokeWidth="1" fill="none" />
              </g>
            )}

            {currentStage === 2 && (
              // Keen Owl with ear tufts & tinted feathers
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="74" rx="20" ry="22" fill="url(#owlFeatherGrad)" />
                <polygon points="44,56 36,38 50,50" fill="#334155" />
                <polygon points="42,52 38,42 46,48" fill={tintColor} />
                <polygon points="70,50 84,38 76,56" fill="#334155" />
                <polygon points="74,48 82,42 78,52" fill={tintColor} />
                <path d="M 42 66 Q 36 78 40 90" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M 78 66 Q 84 78 80 90" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M 44 62 L 60 68 L 76 62" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="52" cy="70" r="7" fill="#fbbf24" />
                <circle cx="52" cy="70" r="4" fill="#0f172a" />
                <circle cx="54" cy="68" r="1.5" fill="#ffffff" />
                <circle cx="68" cy="70" r="7" fill="#fbbf24" />
                <circle cx="68" cy="70" r="4" fill="#0f172a" />
                <circle cx="70" cy="68" r="1.5" fill="#ffffff" />
                <polygon points="58,74 62,74 60,82" fill="#ea580c" />
                <path d="M 52 84 L 60 89 L 68 84" stroke={tintColor} strokeWidth="2" fill="none" strokeLinecap="round" />
              </g>
            )}

            {currentStage >= 3 && (
              // Scholar Owl / Celestial Sage
              <g className="animate-in fade-in zoom-in-75 duration-300">
                {currentStage === 4 && (
                  <>
                    <circle cx="60" cy="50" r="34" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" fill="none" opacity="0.6" />
                    <polygon points="60,18 62,24 68,24 63,28 65,34 60,30 55,34 57,28 52,24 58,24" fill="#f59e0b" />
                  </>
                )}
                <ellipse cx="60" cy="72" rx="22" ry="24" fill="url(#owlFeatherGrad)" />
                <polygon points="42,52 32,32 48,46" fill="#1e293b" />
                <polygon points="72,46 88,32 78,52" fill="#1e293b" />
                <circle cx="51" cy="66" r="8" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(254, 240, 138, 0.2)" />
                <circle cx="51" cy="66" r="4" fill="#0f172a" />
                <circle cx="53" cy="64" r="1.5" fill="#ffffff" />
                <circle cx="69" cy="66" r="8" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(254, 240, 138, 0.2)" />
                <circle cx="69" cy="66" r="4" fill="#0f172a" />
                <circle cx="71" cy="64" r="1.5" fill="#ffffff" />
                <line x1="59" y1="66" x2="61" y2="66" stroke="#f59e0b" strokeWidth="1.5" />
                <polygon points="58,72 62,72 60,80" fill="#ea580c" />
                <path d="M 40 62 Q 24 74 32 92" stroke={tintColor} strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M 80 62 Q 96 74 88 92" stroke={tintColor} strokeWidth="4" strokeLinecap="round" fill="none" />
              </g>
            )}
          </g>
        )}

        {/* 4. FOX COMPANION */}
        {type === 'fox' && (
          <g>
            {/* Grassy Stone Base */}
            <ellipse cx="60" cy="100" rx="34" ry="7" fill="#334155" opacity="0.3" />
            <ellipse cx="60" cy="98" rx="28" ry="5" fill="#065f46" opacity="0.4" />

            {currentStage === 0 && (
              // Little Kit curled
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="85" rx="18" ry="15" fill="url(#foxFurGrad)" />
                <polygon points="46,74 48,58 56,70" fill="#ea580c" />
                <polygon points="48,68 49,61 54,67" fill="#1e293b" />
                <polygon points="64,70 72,58 74,74" fill="#ea580c" />
                <polygon points="66,67 71,61 72,68" fill="#1e293b" />
                <ellipse cx="60" cy="86" rx="12" ry="8" fill="#ffffff" />
                <polygon points="59,85 61,85 60,87" fill="#0f172a" />
                <path d="M 40 88 Q 32 80 40 72" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" fill="none" />
                <circle cx="39" cy="73" r="3.5" fill="#ffffff" />
              </g>
            )}

            {currentStage === 1 && (
              // Swift Fox sitting
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="84" rx="16" ry="17" fill="url(#foxFurGrad)" />
                <polygon points="60,76 53,88 67,88" fill="#ffffff" />
                <circle cx="60" cy="62" r="14" fill="url(#foxFurGrad)" />
                <polygon points="48,54 50,38 58,50" fill="#ea580c" />
                <polygon points="50,48 51,41 55,47" fill="#0f172a" />
                <polygon points="62,50 70,38 72,54" fill="#ea580c" />
                <polygon points="65,47 69,41 70,48" fill="#0f172a" />
                <ellipse cx="60" cy="65" rx="7" ry="5" fill="#ffffff" />
                <polygon points="59,65 61,65 60,67" fill="#0f172a" />
                <ellipse cx="55" cy="60" rx="1.8" ry="2.2" fill="#0f172a" />
                <ellipse cx="65" cy="60" rx="1.8" ry="2.2" fill="#0f172a" />
                <path d="M 74 86 Q 88 78 84 64" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" fill="none" />
                <circle cx="83" cy="65" r="3.5" fill="#ffffff" />
              </g>
            )}

            {currentStage === 2 && (
              // Clever Fox with charm
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <ellipse cx="60" cy="82" rx="18" ry="19" fill="url(#foxFurGrad)" />
                <polygon points="60,72 52,86 68,86" fill="#ffffff" />
                <path d="M 50 72 Q 60 76 70 72" stroke={tintColor} strokeWidth="3" strokeLinecap="round" fill="none" />
                <circle cx="60" cy="76" r="2.5" fill="#fbbf24" />
                <circle cx="60" cy="56" r="15" fill="url(#foxFurGrad)" />
                <polygon points="46,48 48,32 58,45" fill="#ea580c" />
                <polygon points="48,43 49,35 55,42" fill="#0f172a" />
                <polygon points="62,45 72,32 74,48" fill="#ea580c" />
                <polygon points="65,42 71,35 72,43" fill="#0f172a" />
                <ellipse cx="60" cy="60" rx="8" ry="6" fill="#ffffff" />
                <polygon points="59,60 61,60 60,63" fill="#0f172a" />
                <path d="M 53 56 Q 56 54 58 56" stroke="#0f172a" strokeWidth="1.2" fill="none" />
                <path d="M 62 56 Q 64 54 67 56" stroke="#0f172a" strokeWidth="1.2" fill="none" />
                <path d="M 76 84 Q 92 76 86 58" stroke="#ea580c" strokeWidth="7" strokeLinecap="round" fill="none" />
                <circle cx="85" cy="59" r="4" fill="#ffffff" />
              </g>
            )}

            {currentStage >= 3 && (
              // Spirit Fox / Mystic Fox
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <circle cx="30" cy="50" r="4" fill="#38bdf8" opacity="0.8" />
                <circle cx="30" cy="50" r="2" fill="#ffffff" />
                <circle cx="90" cy="50" r="4" fill="#38bdf8" opacity="0.8" />
                <circle cx="90" cy="50" r="2" fill="#ffffff" />

                {currentStage === 4 && (
                  <>
                    <circle cx="60" cy="24" r="3" fill="#fbbf24" />
                    <path d="M 44 84 Q 24 74 26 56" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" fill="none" />
                    <circle cx="26" cy="56" r="3.5" fill="#ffffff" />
                  </>
                )}

                <ellipse cx="60" cy="80" rx="19" ry="20" fill="url(#foxFurGrad)" />
                <polygon points="60,70 50,86 70,86" fill="#ffffff" />
                <circle cx="60" cy="54" r="16" fill="url(#foxFurGrad)" />
                <polygon points="44,46 46,28 58,43" fill="#ea580c" />
                <polygon points="46,40 48,32 55,39" fill="#0f172a" />
                <polygon points="62,43 74,28 76,46" fill="#ea580c" />
                <polygon points="65,39 72,32 74,40" fill="#0f172a" />
                <polygon points="60,42 62,46 60,50 58,46" fill={tintColor} />
                <ellipse cx="60" cy="58" rx="8" ry="6" fill="#ffffff" />
                <polygon points="59,58 61,58 60,61" fill="#0f172a" />
                <path d="M 52 54 L 57 55" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 63 55 L 68 54" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 76 82 Q 96 72 88 50" stroke="#ea580c" strokeWidth="7" strokeLinecap="round" fill="none" />
                <circle cx="87" cy="51" r="4.5" fill="#ffffff" />
              </g>
            )}
          </g>
        )}

        {/* 5. TURTLE COMPANION */}
        {type === 'turtle' && (
          <g>
            {/* River Pebble Base */}
            <ellipse cx="60" cy="102" rx="36" ry="6" fill="#334155" opacity="0.3" />
            <ellipse cx="60" cy="100" rx="32" ry="5" fill="#475569" opacity="0.4" />

            {currentStage === 0 && (
              // Baby Turtle Hatchling in shell
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <circle cx="60" cy="85" r="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                <path d="M 45 84 Q 52 82 58 87 Q 66 81 75 86" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
                <circle cx="60" cy="74" r="9" fill="url(#turtleShellGrad)" />
                <circle cx="56" cy="73" r="1.8" fill="#0f172a" />
                <circle cx="64" cy="73" r="1.8" fill="#0f172a" />
                <ellipse cx="44" cy="88" rx="4" ry="2" fill="#34d399" />
                <ellipse cx="76" cy="88" rx="4" ry="2" fill="#34d399" />
              </g>
            )}

            {currentStage === 1 && (
              // Friendly Turtle on pebble
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <path d="M 38 90 Q 60 62 82 90 Z" fill="url(#turtleShellGrad)" stroke="#047857" strokeWidth="1" />
                <polygon points="60,72 52,80 56,88 64,88 68,80" stroke="#065f46" strokeWidth="0.8" fill="none" opacity="0.6" />
                <ellipse cx="84" cy="84" rx="8" ry="7" fill="#6ee7b7" />
                <circle cx="87" cy="82" r="1.5" fill="#0f172a" />
                <path d="M 85 86 Q 88 88 90 86" stroke="#047857" strokeWidth="0.8" fill="none" />
                <ellipse cx="46" cy="94" rx="5" ry="3" fill="#6ee7b7" />
                <ellipse cx="74" cy="94" rx="5" ry="3" fill="#6ee7b7" />
              </g>
            )}

            {currentStage === 2 && (
              // Sturdy Shelled Wanderer with tinted plates
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <path d="M 34 90 Q 60 56 86 90 Z" fill="url(#turtleShellGrad)" stroke="#047857" strokeWidth="1.5" />
                <circle cx="60" cy="70" r="5" fill={tintColor} opacity="0.8" />
                <circle cx="48" cy="78" r="4" fill={tintColor} opacity="0.8" />
                <circle cx="72" cy="78" r="4" fill={tintColor} opacity="0.8" />
                <ellipse cx="88" cy="82" rx="9" ry="8" fill="#6ee7b7" />
                <circle cx="92" cy="80" r="1.8" fill="#0f172a" />
                <circle cx="93" cy="79" r="0.6" fill="#ffffff" />
                <path d="M 89 84 Q 93 86 95 84" stroke="#047857" strokeWidth="1" fill="none" />
                <ellipse cx="44" cy="93" rx="6" ry="4" fill="#34d399" />
                <ellipse cx="76" cy="93" rx="6" ry="4" fill="#34d399" />
              </g>
            )}

            {currentStage >= 3 && (
              // Ancient Tortoise with sprout / World Turtle
              <g className="animate-in fade-in zoom-in-75 duration-300">
                <path d="M 32 90 Q 60 52 88 90 Z" fill="url(#turtleShellGrad)" stroke="#047857" strokeWidth="1.8" />
                <path d="M 60 62 Q 62 48 58 40" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <ellipse cx="56" cy="38" rx="8" ry="5" fill={tintColor} />
                <circle cx="58" cy="37" r="1.8" fill="#fb7185" />
                {currentStage === 4 && (
                  <>
                    <ellipse cx="64" cy="44" rx="6" ry="4" fill={tintColor} />
                    <polygon points="50,62 55,54 60,62" fill="#94a3b8" opacity="0.8" />
                    <circle cx="40" cy="34" r="1.5" fill="#fde047" />
                    <circle cx="80" cy="34" r="1.5" fill="#fde047" />
                  </>
                )}
                <ellipse cx="90" cy="80" rx="10" ry="9" fill="#6ee7b7" />
                <path d="M 90 78 Q 94 76 96 80" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                <path d="M 91 84 Q 95 86 98 83" stroke="#047857" strokeWidth="1" fill="none" />
                <ellipse cx="42" cy="92" rx="7" ry="4" fill="#34d399" />
                <ellipse cx="78" cy="92" rx="7" ry="4" fill="#34d399" />
              </g>
            )}
          </g>
        )}

        {/* Resting state "z z" */}
        {variant === 'resting' && (
          <g className="animate-in fade-in duration-300 select-none pointer-events-none">
            <text x="84" y="30" fill="#94a3b8" fontSize="11" fontWeight="bold" fontFamily="monospace">
              z
            </text>
            <text x="93" y="22" fill="#64748b" fontSize="9" fontWeight="bold" fontFamily="monospace">
              z
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
