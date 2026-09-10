import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Scale, X, Clock, Check, Trash2 } from 'lucide-react';
import { DEFAULT_CAPACITY_CONFIG } from '../../domain/services/capacity-service';
import { formatDisplayDate } from '../../domain/utils/date';

const WEEKDAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
];

export const CapacityConfigModal: React.FC = () => {
  const {
    isCapacityConfigModalOpen,
    setIsCapacityConfigModalOpen,
    capacityConfig,
    updateCapacityConfig,
    setDailyCapacityOverride,
  } = useApp();

  const [weekdayDefaults, setWeekdayDefaults] = useState<Record<number, number>>(
    capacityConfig.weekdayDefaults || DEFAULT_CAPACITY_CONFIG.weekdayDefaults
  );
  const [calendarEnabled, setCalendarEnabled] = useState<boolean>(
    capacityConfig.calendarInference?.enabled || false
  );
  const [minutesPerAU, setMinutesPerAU] = useState<number>(
    capacityConfig.calendarInference?.minutesPerAU || 15
  );
  const [startHour, setStartHour] = useState<number>(
    capacityConfig.calendarInference?.workSchedule?.startHour ?? 9
  );
  const [endHour, setEndHour] = useState<number>(
    capacityConfig.calendarInference?.workSchedule?.endHour ?? 17
  );
  const [workDays, setWorkDays] = useState<number[]>(
    capacityConfig.calendarInference?.workSchedule?.workDays
      ? [...capacityConfig.calendarInference.workSchedule.workDays]
      : [1, 2, 3, 4, 5]
  );
  const [activeTab, setActiveTab] = useState<'defaults' | 'calendar' | 'overrides'>('defaults');

  useEffect(() => {
    if (isCapacityConfigModalOpen) {
      setWeekdayDefaults(capacityConfig.weekdayDefaults || DEFAULT_CAPACITY_CONFIG.weekdayDefaults);
      setCalendarEnabled(capacityConfig.calendarInference?.enabled || false);
      setMinutesPerAU(capacityConfig.calendarInference?.minutesPerAU || 15);
      setStartHour(capacityConfig.calendarInference?.workSchedule?.startHour ?? 9);
      setEndHour(capacityConfig.calendarInference?.workSchedule?.endHour ?? 17);
      setWorkDays(
        capacityConfig.calendarInference?.workSchedule?.workDays
          ? [...capacityConfig.calendarInference.workSchedule.workDays]
          : [1, 2, 3, 4, 5]
      );
    }
  }, [isCapacityConfigModalOpen, capacityConfig]);

  if (!isCapacityConfigModalOpen) return null;

  const handleWeekdayChange = (day: number, val: number) => {
    setWeekdayDefaults((prev) => ({
      ...prev,
      [day]: Math.max(0, val),
    }));
  };

  const toggleWorkDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    await updateCapacityConfig({
      isConfigured: true,
      weekdayDefaults,
      calendarInference: {
        enabled: calendarEnabled,
        minutesPerAU: Math.max(1, minutesPerAU),
        workSchedule: {
          startHour: Math.max(0, Math.min(23, startHour)),
          startMinute: 0,
          endHour: Math.max(0, Math.min(23, endHour)),
          endMinute: 0,
          workDays,
        },
      },
    });
    setIsCapacityConfigModalOpen(false);
  };

  const overridesList = Object.entries(capacityConfig.manualOverrides || {})
    .filter(([_, au]) => au !== undefined)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

  return (
    <div
      data-testid="capacity-config-modal"
      className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Daily AU Capacity & Reality Check
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure realistic daily workloads and calendar inference
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-capacity-config-modal"
            onClick={() => setIsCapacityConfigModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-2 bg-slate-50/50 dark:bg-slate-950/30 text-xs font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            data-testid="tab-weekday-defaults"
            onClick={() => setActiveTab('defaults')}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'defaults'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Weekday Defaults
          </button>
          <button
            type="button"
            data-testid="tab-calendar-inference"
            onClick={() => setActiveTab('calendar')}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'calendar'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Calendar Inference
          </button>
          <button
            type="button"
            data-testid="tab-manual-overrides"
            onClick={() => setActiveTab('overrides')}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1 ${
              activeTab === 'overrides'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Overrides</span>
            {overridesList.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700">
                {overridesList.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: WEEKDAY DEFAULTS */}
          {activeTab === 'defaults' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Define the default AU capacity for each day of the week. This represents your baseline workload capacity before individual overrides or calendar realities.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {WEEKDAYS.map(({ day, label }) => (
                  <div
                    key={day}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {label}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        data-testid={`capacity-default-${day}`}
                        value={weekdayDefaults[day] ?? 20}
                        onChange={(e) => handleWeekdayChange(day, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-400 font-medium">AU</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CALENDAR INFERENCE */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Enable Calendar Inference
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Derive theoretical available AUs by subtracting calendar events from work hours
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="calendar-inference-toggle"
                    checked={calendarEnabled}
                    onChange={(e) => setCalendarEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
                </label>
              </div>

              {/* Work Schedule */}
              <div className="space-y-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Configured Work Schedule</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Start Time (24h)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      data-testid="schedule-start-hour"
                      value={startHour}
                      onChange={(e) => setStartHour(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      End Time (24h)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      data-testid="schedule-end-hour"
                      value={endHour}
                      onChange={(e) => setEndHour(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Work Days */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Active Work Days
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map(({ day, label }) => {
                      const active = workDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          data-testid={`workday-toggle-${day}`}
                          onClick={() => toggleWorkDay(day)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {label.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* AU / Time conversion */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    AU / Time Conversion
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    How many minutes of free time correspond to 1 Attention Unit
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    data-testid="minutes-per-au"
                    value={minutesPerAU}
                    onChange={(e) => setMinutesPerAU(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-xs text-slate-400">min/AU</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL OVERRIDES */}
          {activeTab === 'overrides' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Individual per-day overrides take top precedence. You can adjust capacity for any day directly here or from the due-date calendar picker.
              </div>

              {overridesList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No manual overrides configured. Daily capacities use your weekday defaults or calendar inference.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {overridesList.map(([dateStr, au]) => (
                    <div
                      key={dateStr}
                      data-testid={`override-row-${dateStr}`}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatDisplayDate(dateStr, 'MMM_D_YYYY')}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {au} AU
                        </span>
                        <button
                          type="button"
                          data-testid={`delete-override-${dateStr}`}
                          onClick={() => setDailyCapacityOverride(dateStr, undefined)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Remove override"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-end space-x-2 shrink-0">
          <button
            type="button"
            data-testid="cancel-capacity-config"
            onClick={() => setIsCapacityConfigModalOpen(false)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="save-capacity-config"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
