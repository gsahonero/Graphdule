import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AttentionService } from '../../domain/services/attention-service';
import { Clock, Plus, Minus, X, Lock } from 'lucide-react';

interface AttentionUnitInputProps {
  value: number | undefined;
  onChange: (newAU: number | undefined) => void;
  disabled?: boolean;
  isParentDerived?: boolean;
  compact?: boolean;
  auMinutes?: number;
  className?: string;
  placeholder?: string;
}

const PRESET_AUS = [0.5, 1, 2, 3, 4];

export const AttentionUnitInput: React.FC<AttentionUnitInputProps> = ({
  value,
  onChange,
  disabled = false,
  isParentDerived = false,
  compact = false,
  auMinutes,
  className = '',
  placeholder = 'AU',
}) => {
  const { attentionUnitMinutes: contextAuMinutes } = useApp();
  const effectiveAuMinutes = auMinutes || contextAuMinutes || 15;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Derived display for parent nodes
  if (isParentDerived) {
    const totalMinutes = (value || 0) * effectiveAuMinutes;
    const formattedTime = AttentionService.formatMinutes(totalMinutes);
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 font-medium select-none cursor-default ${
          compact ? 'text-[10px]' : 'text-xs'
        } ${className}`}
        title={`Parent task estimated attention is automatically derived from the sum of its subtasks (${value || 0} AU = ${formattedTime}). Manual edit disabled.`}
      >
        <span className="font-serif font-bold text-amber-500 dark:text-amber-400">∑</span>
        <span className="font-mono font-semibold">
          {value !== undefined && value > 0 ? `${value} AU` : '0 AU'}
        </span>
        <span className="opacity-70 font-mono text-[10px]">· {formattedTime}</span>
        <Lock className="w-2.5 h-2.5 opacity-50 ml-0.5" />
      </div>
    );
  }

  const handleStep = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const current = value || 0;
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    if (next === 0) {
      onChange(undefined);
    } else {
      onChange(next);
    }
  };

  const handlePreset = (au: number) => {
    if (disabled) return;
    onChange(au);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    onChange(undefined);
    setIsOpen(false);
  };

  const currentMinutes = value !== undefined && value > 0 ? value * effectiveAuMinutes : 0;
  const formattedMinutes = currentMinutes > 0 ? AttentionService.formatMinutes(currentMinutes) : null;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger button / Input badge */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`group inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer select-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-slate-700/40 bg-slate-800/20 text-slate-500'
            : value !== undefined && value > 0
            ? 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:border-amber-500/70'
            : 'border-slate-300 dark:border-slate-700/60 bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:border-amber-500/40 hover:text-amber-500'
        } ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}
        title={
          value !== undefined && value > 0
            ? `${value} AU equals ${formattedMinutes} of focused attention (1 AU = ${effectiveAuMinutes}m). Click to edit.`
            : `Set estimated attention in AU (1 AU = ${effectiveAuMinutes}m)`
        }
      >
        <Clock className={`flex-shrink-0 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-500/80`} />

        {value !== undefined && value > 0 ? (
          <span className="inline-flex items-center gap-1 font-mono">
            <span className="font-semibold">{value} AU</span>
            <span className="text-[11px] opacity-75 font-normal">· {formattedMinutes}</span>
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        )}

        {/* Quick Stepper +/- controls directly visible when not compact or hovered */}
        {!disabled && (
          <div className="inline-flex items-center ml-0.5 border-l border-slate-300/40 dark:border-slate-700/60 pl-1 gap-0.5">
            <button
              type="button"
              onClick={(e) => handleStep(-0.5, e)}
              className="p-0.5 hover:text-amber-500 hover:bg-amber-500/20 rounded transition-colors"
              title="Decrease by 0.5 AU"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={(e) => handleStep(0.5, e)}
              className="p-0.5 hover:text-amber-500 hover:bg-amber-500/20 rounded transition-colors"
              title="Increase by 0.5 AU"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Popover selector with quick preset pills and direct value adjustment */}
      {isOpen && !disabled && (
        <div
          className="absolute z-50 mt-1.5 left-0 min-w-[210px] p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-black/20 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Attention Estimate</span>
            </span>
            <span className="text-[10px] text-slate-400">1 AU = {effectiveAuMinutes}m</span>
          </div>

          {/* Stepper display */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 rounded-lg p-1.5 mb-2.5 border border-slate-200/60 dark:border-slate-700/40">
            <button
              type="button"
              onClick={(e) => handleStep(-0.5, e)}
              className="p-1 rounded bg-white dark:bg-slate-700 hover:bg-amber-500 hover:text-white shadow-sm text-slate-700 dark:text-slate-200 transition-colors"
              title="-0.5 AU"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="text-center font-mono">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {value !== undefined && value > 0 ? `${value} AU` : '0 AU'}
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                {value !== undefined && value > 0 ? formattedMinutes : 'No estimate'}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => handleStep(0.5, e)}
              className="p-1 rounded bg-white dark:bg-slate-700 hover:bg-emerald-500 hover:text-white shadow-sm text-slate-700 dark:text-slate-200 transition-colors"
              title="+0.5 AU"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset buttons */}
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Presets
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2.5">
            {PRESET_AUS.map((au) => {
              const mins = AttentionService.formatMinutes(au * effectiveAuMinutes);
              const isSelected = value === au;
              return (
                <button
                  key={au}
                  type="button"
                  onClick={() => handlePreset(au)}
                  className={`px-2 py-1 rounded-md text-center transition-all flex flex-col items-center ${
                    isSelected
                      ? 'bg-amber-500 text-white font-bold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="font-mono text-xs">{au} AU</span>
                  <span className={`text-[9px] ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                    {mins}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleClear()}
              className="px-2 py-1 rounded-md text-center transition-all flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400"
              title="Clear estimate"
            >
              <X className="w-3 h-3 mb-0.5" />
              <span className="text-[9px]">Clear</span>
            </button>
          </div>

          <div className="flex justify-end pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
