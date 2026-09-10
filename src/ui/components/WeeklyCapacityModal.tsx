import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Sparkles, Sliders, Check, X, ArrowRight } from 'lucide-react';
import { getMondayOfWeek, addDays, getISOWeekString, formatDisplayDate, parseDate } from '../../domain/utils/date';
import { DEFAULT_CAPACITY_CONFIG } from '../../domain/services/capacity-service';

export const WeeklyCapacityModal: React.FC = () => {
  const {
    isWeeklyCapacityModalOpen,
    setIsWeeklyCapacityModalOpen,
    capacityConfig,
    updateCapacityConfig,
    fillWeekFromCalendar,
  } = useApp();

  const [mode, setMode] = useState<'choose' | 'customize'>('choose');
  const [isProcessingCalendar, setIsProcessingCalendar] = useState(false);

  const mondayDate = getMondayOfWeek();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(mondayDate, i));

  const [dayValues, setDayValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isWeeklyCapacityModalOpen) {
      setMode('choose');
      const initial: Record<string, number> = {};
      weekDays.forEach((dateStr) => {
        const dayOfWeek = parseDate(dateStr).getDay();
        const existingOverride = capacityConfig.manualOverrides?.[dateStr];
        const defaultAU = capacityConfig.weekdayDefaults?.[dayOfWeek] ?? DEFAULT_CAPACITY_CONFIG.weekdayDefaults[dayOfWeek] ?? 20;
        initial[dateStr] = existingOverride ?? defaultAU;
      });
      setDayValues(initial);
    }
  }, [isWeeklyCapacityModalOpen, capacityConfig]);

  if (!isWeeklyCapacityModalOpen) return null;

  const currentWeek = getISOWeekString(mondayDate);

  const handleDismiss = async () => {
    // Mark as reviewed for this week so it won't prompt again until next Monday
    await updateCapacityConfig({
      lastWeeklyPromptWeek: currentWeek,
    });
    setIsWeeklyCapacityModalOpen(false);
  };

  const handleFillFromCalendar = async () => {
    setIsProcessingCalendar(true);
    try {
      await fillWeekFromCalendar(mondayDate);
      setIsWeeklyCapacityModalOpen(false);
    } finally {
      setIsProcessingCalendar(false);
    }
  };

  const handleSaveCustomWeek = async () => {
    const updatedOverrides = { ...(capacityConfig.manualOverrides || {}) };
    Object.entries(dayValues).forEach(([dateStr, au]) => {
      updatedOverrides[dateStr] = Math.max(0, au);
    });

    await updateCapacityConfig({
      isConfigured: true,
      manualOverrides: updatedOverrides,
      lastWeeklyPromptWeek: currentWeek,
    });
    setIsWeeklyCapacityModalOpen(false);
  };

  return (
    <div
      data-testid="weekly-capacity-modal"
      className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Gradient Banner */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Weekly Capacity Reality Check
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Monday Review
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Week of {formatDisplayDate(mondayDate, 'MMM_D_YYYY')}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-weekly-capacity-modal"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 pt-2 overflow-y-auto space-y-4 flex-1">
          {mode === 'choose' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Start your week with an intentional workload plan. Choose how you want to set your daily Attention Unit (AU) capacity for the upcoming days:
              </p>

              {/* Option A: Fill from Calendar */}
              <button
                type="button"
                data-testid="btn-fill-from-calendar"
                disabled={isProcessingCalendar}
                onClick={handleFillFromCalendar}
                className="w-full p-4 rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 transition-all text-left group cursor-pointer flex items-start space-x-3.5"
              >
                <div className="p-2 rounded-lg bg-emerald-500 text-white shrink-0 mt-0.5 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Fill Week from Calendar
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-500 transform group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    Automatically subtract calendar events from your configured work schedule to infer available AU capacity for each day.
                  </p>
                </div>
              </button>

              {/* Option B: Define in a personalized manner */}
              <button
                type="button"
                data-testid="btn-personalize-week"
                onClick={() => setMode('customize')}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer flex items-start space-x-3.5"
              >
                <div className="p-2 rounded-lg bg-slate-600 dark:bg-slate-700 text-white shrink-0 mt-0.5">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      Define in a Personalized Manner
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 transform group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    Inspect your upcoming week and review or manually tweak AU capacity for Monday through Sunday.
                  </p>
                </div>
              </button>
            </div>
          ) : (
            /* Mode 2: Customize individual days */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Adjust daily capacities for this week:</span>
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Back to options
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {weekDays.map((dateStr) => {
                  const dObj = parseDate(dateStr);
                  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dObj.getDay()];
                  return (
                    <div
                      key={dateStr}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100 mr-2">
                          {dayName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDisplayDate(dateStr, 'MMM_D_YYYY')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          data-testid={`custom-day-${dateStr}`}
                          value={dayValues[dateStr] ?? 20}
                          onChange={(e) =>
                            setDayValues((prev) => ({
                              ...prev,
                              [dateStr]: Number(e.target.value),
                            }))
                          }
                          className="w-16 px-2 py-1 text-xs text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        />
                        <span className="text-xs text-slate-400">AU</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between shrink-0">
          <button
            type="button"
            data-testid="skip-weekly-capacity"
            onClick={handleDismiss}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Skip for this week
          </button>

          {mode === 'customize' && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="save-custom-week"
                onClick={handleSaveCustomWeek}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Week Plan</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
