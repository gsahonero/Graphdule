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
  align?: 'left' | 'right';
  onOpenChange?: (open: boolean) => void;
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
  align = 'left',
  onOpenChange,
}) => {
  const { attentionUnitMinutes: contextAuMinutes } = useApp();
  const effectiveAuMinutes = auMinutes || contextAuMinutes || 15;

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const numInputRef = useRef<HTMLInputElement>(null);

  const closePopover = () => {
    setIsOpen(false);
    onOpenChange?.(false);
  };

  const togglePopover = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      onOpenChange?.(next);
      return next;
    });
  };

  // Sync internal input string when popover opens or value changes
  useEffect(() => {
    if (isOpen) {
      setInputValue(value !== undefined && value > 0 ? String(value) : '');
      const timer = setTimeout(() => {
        numInputRef.current?.focus();
        numInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, value]);

  const commitValue = (overrideValue?: number) => {
    if (disabled) return;
    if (overrideValue !== undefined) {
      onChange(overrideValue > 0 ? Math.round(overrideValue * 100) / 100 : undefined);
      return;
    }
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      onChange(undefined);
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed) && parsed > 0) {
      const rounded = Math.round(parsed * 100) / 100;
      onChange(rounded);
    } else {
      onChange(undefined);
    }
  };

  // Close popover when clicking outside and commit current input
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitValue();
        closePopover();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, inputValue]);

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
    const parsed = parseFloat(inputValue);
    const base = !isNaN(parsed) && parsed >= 0 ? parsed : (value || 0);
    const next = Math.max(0, Math.round((base + delta) * 100) / 100);
    setInputValue(next > 0 ? String(next) : '');
    commitValue(next);
  };

  const handlePreset = (au: number) => {
    if (disabled) return;
    setInputValue(String(au));
    commitValue(au);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    setInputValue('');
    commitValue(0);
    closePopover();
  };

  const handleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    commitValue();
    closePopover();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitValue();
      closePopover();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopover();
    }
  };

  // Preview calculations for display
  const parsedForPreview = parseFloat(inputValue);
  const activePreviewAU =
    isOpen && inputValue.trim() !== ''
      ? !isNaN(parsedForPreview) && parsedForPreview >= 0
        ? parsedForPreview
        : 0
      : value !== undefined && value > 0
      ? value
      : 0;

  const previewMinutes = activePreviewAU > 0 ? activePreviewAU * effectiveAuMinutes : 0;
  const formattedMinutes = previewMinutes > 0 ? AttentionService.formatMinutes(previewMinutes) : null;

  return (
    <div ref={containerRef} className={`relative inline-block ${isOpen ? 'z-50' : ''} ${className}`}>
      {/* Trigger button / Input badge */}
      <div
        onClick={togglePopover}
        className={`group inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer select-none whitespace-nowrap shrink-0 ${
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
          <span className="inline-flex items-center gap-1 font-mono whitespace-nowrap">
            <span className="font-semibold">{value} AU</span>
            <span className="text-[11px] opacity-75 font-normal">· {formattedMinutes}</span>
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">{placeholder}</span>
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

      {/* Popover selector with quick preset pills and direct arbitrary value adjustment */}
      {isOpen && !disabled && (
        <div
          className={`nodrag nowheel nopan absolute z-50 mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } min-w-[240px] p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl shadow-black/50 text-xs animate-in fade-in zoom-in-95 duration-150`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Attention Estimate</span>
            </span>
            <span className="text-[10px] text-slate-400">1 AU = {effectiveAuMinutes}m</span>
          </div>

          {/* Direct arbitrary AU number input + Stepper controls */}
          <div className="bg-slate-100 dark:bg-slate-800/70 rounded-xl p-2 mb-2.5 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={(e) => handleStep(-0.5, e)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 hover:bg-amber-500 hover:text-white shadow-xs text-slate-700 dark:text-slate-200 transition-colors"
                title="-0.5 AU"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 flex items-center justify-center gap-1.5">
                <input
                  ref={numInputRef}
                  type="number"
                  min="0"
                  step="any"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="0"
                  className="w-20 px-2 py-1 text-center font-mono font-bold text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 dark:text-slate-100 shadow-inner"
                />
                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
                  AU
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => handleStep(0.5, e)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-500 hover:text-white shadow-xs text-slate-700 dark:text-slate-200 transition-colors"
                title="+0.5 AU"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-1.5 text-center">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10">
                <Clock className="w-3 h-3" />
                <span>{formattedMinutes ? formattedMinutes : 'No estimate'}</span>
              </span>
            </div>
          </div>

          {/* Preset buttons */}
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Presets
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2.5">
            {PRESET_AUS.map((au) => {
              const mins = AttentionService.formatMinutes(au * effectiveAuMinutes);
              const isSelected = activePreviewAU === au;
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
              onClick={handleDone}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
