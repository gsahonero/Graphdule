import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPalette,
} from '../utils/palettes';
import { ColorPaletteId } from '../../domain/models/types';
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  X,
  Sparkles,
} from 'lucide-react';

export const AppearanceModal: React.FC = () => {
  const {
    isAppearanceModalOpen,
    setIsAppearanceModalOpen,
    preferences,
    updatePreferences,
    colorPalette,
    setColorPalette,
  } = useApp();

  const [selectedPaletteId, setSelectedPaletteId] = useState<ColorPaletteId>(colorPalette);

  // Sync internal state when preferences or colorPalette prop changes
  useEffect(() => {
    setSelectedPaletteId(colorPalette);
  }, [colorPalette]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isAppearanceModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAppearanceModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAppearanceModalOpen, setIsAppearanceModalOpen]);

  if (!isAppearanceModalOpen) return null;

  const currentTheme = preferences.theme || 'dark';
  const activePalette = getPalette(selectedPaletteId);

  const handlePaletteSelect = async (paletteId: ColorPaletteId) => {
    setSelectedPaletteId(paletteId);
    await setColorPalette(paletteId);
  };

  const handleThemeSelect = async (theme: 'dark' | 'light' | 'system') => {
    await updatePreferences({ theme });
  };

  const handleResetToDefault = async () => {
    setSelectedPaletteId(DEFAULT_PALETTE_ID);
    await setColorPalette(DEFAULT_PALETTE_ID);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0"
        onClick={() => setIsAppearanceModalOpen(false)}
      />

      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="appearance-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Appearance & Color Customization
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personalize your workspace palette and visual ergonomics
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAppearanceModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Theme Mode Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Display Mode
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleThemeSelect('light')}
                className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  currentTheme === 'light'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold ring-2 ring-brand-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/40 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeSelect('dark')}
                className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  currentTheme === 'dark'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold ring-2 ring-brand-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/40 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeSelect('system')}
                className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  currentTheme === 'system'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold ring-2 ring-brand-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/40 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Laptop className="w-4 h-4 text-slate-400" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* Science-Backed Palettes Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Color Palette
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Scientifically backed harmonies designed for cognitive performance, eye rest, and deep work
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetToDefault}
                title="Reset to Biophilic Emerald default"
                className="flex items-center space-x-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PALETTES.map((palette) => {
                const isSelected = selectedPaletteId === palette.id;
                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => handlePaletteSelect(palette.id)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/10 ring-2 ring-brand-500/30 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-4 h-4 rounded-full ${palette.previewDotClass} shadow-xs shrink-0`}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {palette.name}
                        </span>
                      </div>

                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <div
                          className={`w-8 h-2 rounded-full bg-gradient-to-r ${palette.previewGradient} opacity-70`}
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="inline-block text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 rounded">
                        {palette.scienceTitle}
                      </div>
                      <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 line-clamp-2">
                        {palette.scienceBasis}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Interactive Preview Card */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              <span>Live Palette Preview</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3 shadow-inner">
              {/* Mock Header Nav */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xs">
                    G
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Graphdule
                  </span>
                </div>

                <div className="flex items-center space-x-1 bg-slate-200/60 dark:bg-slate-900 p-0.5 rounded-lg text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 font-medium shadow-xs">
                    Projects
                  </span>
                  <span className="px-2 py-0.5 text-slate-500">My Day</span>
                </div>
              </div>

              {/* Sample Actions & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-xs transition-colors"
                  >
                    Primary Action
                  </button>

                  <button
                    type="button"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30 transition-colors"
                  >
                    Secondary Action
                  </button>
                </div>

                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                  {activePalette.name}
                </span>
              </div>

              {/* Sample Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Sprint Progress</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">75%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: '75%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => setIsAppearanceModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
