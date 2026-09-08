import React, { useState, useRef, useEffect } from 'react';
import { Repeat, Check, ChevronDown, ChevronRight, X, Sparkles, Calendar } from 'lucide-react';
import { RecurrenceRule, RecurrenceFrequency } from '../../domain/models/types';
import {
  RecurrenceService,
  DAY_NAMES,
  SHORT_DAY_NAMES,
} from '../../domain/services/recurrence-service';
import { parseDate, formatDisplayDate, getTodayString } from '../../domain/utils/date';
import { CalendarPicker } from './CalendarPicker';

interface RecurrencePickerProps {
  value?: RecurrenceRule;
  baseDate: string; // YYYY-MM-DD
  onChange: (rule: RecurrenceRule | undefined) => void;
  onClose?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  buttonVariant?: 'icon' | 'badge' | 'button';
  align?: 'left' | 'right';
  position?: 'bottom' | 'top';
}

export const RecurrencePicker: React.FC<RecurrencePickerProps> = ({
  value,
  baseDate,
  onChange,
  onClose,
  onOpenChange,
  buttonVariant = 'button',
  align = 'right',
  position = 'bottom',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);

  const handleSetIsOpen = (valOrFn: boolean | ((prev: boolean) => boolean)) => {
    setIsOpen((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      if (onOpenChange) onOpenChange(next);
      if (!next && onClose) onClose();
      return next;
    });
  };

  // Custom Form State
  const effectiveBaseDate = baseDate || getTodayString();
  const baseD = parseDate(effectiveBaseDate);
  const initialDow = baseD.getDay();
  const initialDayOfMonth = baseD.getDate();
  const initialNth = RecurrenceService.getNthWeekdayOfDate(effectiveBaseDate);

  const [frequency, setFrequency] = useState<RecurrenceFrequency>(value?.frequency || 'weekly');
  const [interval, setInterval] = useState<number>(value?.interval || 1);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>(
    value?.daysOfWeek ? [...value.daysOfWeek] : [initialDow]
  );
  const [monthlyMode, setMonthlyMode] = useState<'day_of_month' | 'nth_weekday'>(
    value?.nthWeekdayOfMonth ? 'nth_weekday' : 'day_of_month'
  );
  const [customDayOfMonth, setCustomDayOfMonth] = useState<number>(
    value?.dayOfMonth || initialDayOfMonth
  );
  const [customNth, setCustomNth] = useState<1 | 2 | 3 | 4 | -1>(
    value?.nthWeekdayOfMonth?.nth ?? initialNth.nth
  );
  const [customNthDow, setCustomNthDow] = useState<number>(
    value?.nthWeekdayOfMonth?.dayOfWeek ?? initialNth.dayOfWeek
  );
  const [customEndDate, setCustomEndDate] = useState<string>(value?.endDate || '');
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [customCount, setCustomCount] = useState<number | undefined>(value?.count);

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        handleSetIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Presets based on baseDate
  const presets = RecurrenceService.getQuickPresets(effectiveBaseDate);

  // Current preview rule in custom mode
  const currentCustomRule: RecurrenceRule = {
    frequency,
    interval: Math.max(1, interval),
    ...(frequency === 'weekly' ? { daysOfWeek: selectedDaysOfWeek.length > 0 ? selectedDaysOfWeek : [initialDow] } : {}),
    ...(frequency === 'monthly'
      ? monthlyMode === 'nth_weekday'
        ? { nthWeekdayOfMonth: { nth: customNth, dayOfWeek: customNthDow } }
        : { dayOfMonth: customDayOfMonth }
      : {}),
    ...(customEndDate ? { endDate: customEndDate } : {}),
    ...(customCount && customCount > 0 ? { count: customCount } : {}),
  };

  const handleApplyPreset = (rule: RecurrenceRule | null) => {
    onChange(rule || undefined);
    handleSetIsOpen(false);
  };

  const handleApplyCustom = () => {
    onChange(currentCustomRule);
    handleSetIsOpen(false);
  };

  const handleToggleDayOfWeek = (dayIndex: number) => {
    if (selectedDaysOfWeek.includes(dayIndex)) {
      if (selectedDaysOfWeek.length > 1) {
        setSelectedDaysOfWeek(selectedDaysOfWeek.filter((d) => d !== dayIndex));
      }
    } else {
      setSelectedDaysOfWeek([...selectedDaysOfWeek, dayIndex].sort((a, b) => a - b));
    }
  };

  const isRuleActive = (presetRule: RecurrenceRule | null) => {
    if (!value && !presetRule) return true;
    if (!value || !presetRule) return false;
    if (value.frequency !== presetRule.frequency) return false;
    if ((value.interval || 1) !== (presetRule.interval || 1)) return false;
    if (presetRule.daysOfWeek && value.daysOfWeek) {
      if (value.daysOfWeek.join(',') !== presetRule.daysOfWeek.join(',')) return false;
    }
    if (presetRule.dayOfMonth !== value.dayOfMonth) return false;
    if (presetRule.nthWeekdayOfMonth && value.nthWeekdayOfMonth) {
      if (
        presetRule.nthWeekdayOfMonth.nth !== value.nthWeekdayOfMonth.nth ||
        presetRule.nthWeekdayOfMonth.dayOfWeek !== value.nthWeekdayOfMonth.dayOfWeek
      ) {
        return false;
      }
    }
    return true;
  };

  const displayText = value ? RecurrenceService.formatRecurrenceRule(value) : 'Repeat';

  return (
    <div
      className={`relative inline-block text-left ${isOpen ? 'z-50' : ''}`}
      style={isOpen ? { zIndex: 50 } : undefined}
    >
      {/* Trigger Button Variants */}
      {buttonVariant === 'icon' && (
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSetIsOpen((prev) => !prev);
          }}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            value
              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30 hover:bg-teal-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800'
          }`}
          title={value ? `Repeats: ${displayText}` : 'Set recurrence pattern'}
        >
          <Repeat className={`w-3.5 h-3.5 ${value ? 'animate-pulse' : ''}`} />
        </button>
      )}

      {buttonVariant === 'badge' && (
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSetIsOpen((prev) => !prev);
          }}
          className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors cursor-pointer group/badge"
          title="Click to edit recurrence pattern"
        >
          <Repeat className="w-3 h-3 text-teal-500 shrink-0" />
          <span className="truncate max-w-[130px]">{displayText}</span>
        </button>
      )}

      {buttonVariant === 'button' && (
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSetIsOpen((prev) => !prev);
          }}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer shadow-xs ${
            value
              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800/60 hover:bg-teal-100'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
          title="Configure recurrence schedule"
        >
          <Repeat className={`w-3.5 h-3.5 ${value ? 'text-teal-500' : 'text-slate-400'}`} />
          <span className="truncate max-w-[140px]">{displayText}</span>
          <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />
        </button>
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={{ zIndex: 9999 }}
          className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${
            align === 'right' ? 'right-0' : 'left-0'
          } z-[9999] w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 text-slate-900 dark:text-slate-100 text-xs animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Repeat className="w-4 h-4" />
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {isCustomMode ? 'Custom Repetition' : 'Repeat Schedule'}
              </span>
            </div>
            <button
              onClick={() => {
                handleSetIsOpen(false);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!isCustomMode ? (
            /* Quick Presets List */
            <div className="space-y-1 max-h-[320px] overflow-y-auto pr-0.5">
              {presets.map((item, idx) => {
                const active = isRuleActive(item.rule);
                return (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(item.rule)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-medium'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
                  </button>
                );
              })}

              <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setIsCustomMode(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                    <span>Custom schedule...</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          ) : (
            /* Custom Recurrence Editor */
            <div className="space-y-3.5">
              {/* Frequency Selector */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Frequency
                </label>
                <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as RecurrenceFrequency[]).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequency(freq)}
                      className={`py-1 rounded-lg font-medium capitalize transition-all cursor-pointer ${
                        frequency === freq
                          ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {freq === 'daily' ? 'Day' : freq === 'weekly' ? 'Week' : freq === 'monthly' ? 'Month' : 'Year'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interval Stepper */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  Repeat every
                </span>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={interval}
                    onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 px-2 py-1 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    {frequency === 'daily'
                      ? interval === 1 ? 'day' : 'days'
                      : frequency === 'weekly'
                      ? interval === 1 ? 'week' : 'weeks'
                      : frequency === 'monthly'
                      ? interval === 1 ? 'month' : 'months'
                      : interval === 1 ? 'year' : 'years'}
                  </span>
                </div>
              </div>

              {/* Weekly: Day of Week Multi-select Pills */}
              {frequency === 'weekly' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Repeat on
                  </label>
                  <div className="flex items-center justify-between gap-1">
                    {SHORT_DAY_NAMES.map((shortName, dowIdx) => {
                      const isSelected = selectedDaysOfWeek.includes(dowIdx);
                      return (
                        <button
                          key={dowIdx}
                          type="button"
                          onClick={() => handleToggleDayOfWeek(dowIdx)}
                          className={`w-9 h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-teal-600 text-white shadow-xs scale-105'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title={DAY_NAMES[dowIdx]}
                        >
                          {shortName[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly: Day of Month vs Nth Weekday of Month */}
              {frequency === 'monthly' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Monthly Pattern
                  </label>

                  {/* Option 1: On specific day of month (e.g. 15th) */}
                  <label
                    onClick={() => setMonthlyMode('day_of_month')}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      monthlyMode === 'day_of_month'
                        ? 'border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={monthlyMode === 'day_of_month'}
                        onChange={() => setMonthlyMode('day_of_month')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>On day of the month</span>
                    </div>
                    <select
                      value={customDayOfMonth}
                      onChange={(e) => {
                        setCustomDayOfMonth(parseInt(e.target.value, 10));
                        setMonthlyMode('day_of_month');
                      }}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Day {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Option 2: On the Nth Weekday (1st Monday, 2nd Tuesday, last Friday...) */}
                  <label
                    onClick={() => setMonthlyMode('nth_weekday')}
                    className={`flex flex-col gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                      monthlyMode === 'nth_weekday'
                        ? 'border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={monthlyMode === 'nth_weekday'}
                        onChange={() => setMonthlyMode('nth_weekday')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>On the nth weekday</span>
                    </div>

                    <div className="flex items-center space-x-1.5 pl-6">
                      <select
                        value={customNth}
                        onChange={(e) => {
                          setCustomNth(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | -1);
                          setMonthlyMode('nth_weekday');
                        }}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                      >
                        <option value={1}>1st (First)</option>
                        <option value={2}>2nd (Second)</option>
                        <option value={3}>3rd (Third)</option>
                        <option value={4}>4th (Fourth)</option>
                        <option value={-1}>Last</option>
                      </select>

                      <select
                        value={customNthDow}
                        onChange={(e) => {
                          setCustomNthDow(parseInt(e.target.value, 10));
                          setMonthlyMode('nth_weekday');
                        }}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs flex-1"
                      >
                        {DAY_NAMES.map((name, idx) => (
                          <option key={idx} value={idx}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
              )}

              {/* Ends Limit Options */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Ends
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomEndDate('');
                      setCustomCount(undefined);
                    }}
                    className={`py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      !customEndDate && !customCount
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Never
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomEndDate(effectiveBaseDate);
                      setCustomCount(undefined);
                    }}
                    className={`py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      customEndDate
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    On date
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCount(customCount || 5);
                      setCustomEndDate('');
                    }}
                    className={`py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      customCount
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    After
                  </button>
                </div>

                {customEndDate && (
                  <div className="pt-1 relative">
                    <button
                      type="button"
                      onClick={() => setIsEndDatePickerOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-xs transition-colors cursor-pointer group/cal"
                    >
                      <span className="text-slate-500 font-medium">Until:</span>
                      <div className="flex items-center space-x-1.5 font-mono text-slate-800 dark:text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover/cal:text-teal-500 transition-colors" />
                        <span>{formatDisplayDate(customEndDate)}</span>
                      </div>
                    </button>

                    {isEndDatePickerOpen && (
                      <CalendarPicker
                        value={customEndDate}
                        onChange={(newDate) => {
                          setCustomEndDate(newDate);
                          setIsEndDatePickerOpen(false);
                        }}
                        onClose={() => setIsEndDatePickerOpen(false)}
                        position="bottom"
                        align="right"
                      />
                    )}
                  </div>
                )}

                {customCount !== undefined && (
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customCount}
                      onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 px-2 py-1 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                    />
                    <span className="text-xs text-slate-500 font-medium">occurrences</span>
                  </div>
                )}
              </div>

              {/* Summary Pill Preview */}
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-[11px] font-medium flex items-center space-x-2">
                <Repeat className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {RecurrenceService.formatRecurrenceRule(currentCustomRule)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
                >
                  Back to presets
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
