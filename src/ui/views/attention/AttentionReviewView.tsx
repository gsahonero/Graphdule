import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AttentionService } from '../../../domain/services/attention-service';
import {
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Layers,
  CheckCircle2,
  Sliders,
  History,
  Trash2,
  Info,
  Check,
} from 'lucide-react';

export const AttentionReviewView: React.FC = () => {
  const {
    attentionSystemEnabled,
    toggleAttentionSystem,
    attentionUnitMinutes,
    setAttentionUnitMinutes,
    weeklyPlannedAU,
    setWeeklyPlannedAU,
    activityLog,
    allActiveNodes,
    standaloneTasks,
    projects,
    attentionReviews,
    triggerWeeklyReview,
    deleteAttentionReview,
    openProject,
  } = useApp();

  // Selected week offset (0 = current week, -1 = previous week, etc.)
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedHistoricalReviewId, setSelectedHistoricalReviewId] = useState<string | null>(null);
  const [userReflectionInput, setUserReflectionInput] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set());

  // Compute start (Monday) and end (Monday) dates for the target week
  const { weekStartDate, weekEndDate } = useMemo(() => {
    return AttentionService.getMondayToMondayWeekRange(new Date(), weekOffset);
  }, [weekOffset]);

  // If a historical review is selected, show that, otherwise compute live review for week
  const activeReviewData = useMemo(() => {
    if (selectedHistoricalReviewId) {
      const found = attentionReviews.find((r) => r.id === selectedHistoricalReviewId);
      if (found) return found.data;
    }

    return AttentionService.generateWeeklyAttentionReview({
      events: activityLog,
      tasks: [...allActiveNodes, ...standaloneTasks],
      projects,
      weekStartDate,
      weekEndDate,
      plannedAU: weeklyPlannedAU,
      auMinutes: attentionUnitMinutes,
    });
  }, [
    selectedHistoricalReviewId,
    attentionReviews,
    activityLog,
    allActiveNodes,
    standaloneTasks,
    projects,
    weekStartDate,
    weekEndDate,
    weeklyPlannedAU,
    attentionUnitMinutes,
  ]);

  const handleTriggerReview = async () => {
    setIsTriggering(true);
    try {
      const record = await triggerWeeklyReview(weekStartDate, weekEndDate, userReflectionInput.trim() || undefined);
      setSelectedHistoricalReviewId(record.id);
      setUserReflectionInput('');
    } finally {
      setIsTriggering(false);
    }
  };

  const toggleRuleExpand = (id: string) => {
    setExpandedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!attentionSystemEnabled) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center text-center bg-slate-950 text-slate-100">
        <div className="max-w-xl bg-slate-900/80 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-6">
            <Clock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100 mb-3">
            Attention Measurement System
          </h2>

          <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-6">
            Graphdule is built on the principle that ideas are unlimited, projects are manageable, but <strong className="text-amber-400 font-semibold">attention is limited</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left mb-8">
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs font-semibold text-amber-400 block mb-1">Attention Unit (AU)</span>
              <p className="text-xs text-slate-300">
                1 AU represents {attentionUnitMinutes} minutes of focused work. Fully customizable to fit your rhythm.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs font-semibold text-emerald-400 block mb-1">Work Clock</span>
              <p className="text-xs text-slate-300">
                Track explicitly when you work. Actual attention is never inferred from calendar days.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <span className="text-xs font-semibold text-cyan-400 block mb-1">Weekly Review</span>
              <p className="text-xs text-slate-300">
                Rule-based, interpretable reviews comparing estimated vs actual attention with zero judgment.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => toggleAttentionSystem(true)}
              className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Enable Attention Measurement</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-4">
            Optional feature. Normal task management and dependency scheduling remain fully functional at all times.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header & Toolbar */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Weekly Attention Review</span>
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              1 AU = {attentionUnitMinutes}m
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent, rule-based attention analytics comparing focused work against calendar time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Week Selector */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 text-xs">
            <button
              onClick={() => {
                setSelectedHistoricalReviewId(null);
                setWeekOffset((prev) => prev - 1);
              }}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-medium text-slate-200">
              {weekStartDate} → {weekEndDate}
            </span>
            <button
              onClick={() => {
                setSelectedHistoricalReviewId(null);
                setWeekOffset((prev) => Math.min(0, prev + 1));
              }}
              disabled={weekOffset >= 0}
              className="p-1.5 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-slate-300 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => {
                  setSelectedHistoricalReviewId(null);
                  setWeekOffset(0);
                }}
                className="ml-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-[11px] font-medium text-slate-200"
              >
                Current
              </button>
            )}
          </div>

          {/* Trigger Review Button */}
          <button
            onClick={handleTriggerReview}
            disabled={isTriggering}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-xs shadow-md shadow-amber-500/10 transition-all flex items-center gap-1.5"
            title="Save and archive this week's review snapshot to local & cloud storage"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isTriggering ? 'Archiving...' : 'Trigger Review Snapshot'}</span>
          </button>

          {/* Config Settings Button */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-slate-300 transition-colors"
            title="Attention system preferences"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preferences Slide-down Configuration Bar */}
      {showConfig && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-in slide-in-from-top-2 duration-150">
          <div>
            <label className="block text-slate-400 font-medium mb-1.5">
              AU Duration (Minutes per Unit)
            </label>
            <select
              value={attentionUnitMinutes}
              onChange={(e) => setAttentionUnitMinutes(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes (Standard Graphdule AU)</option>
              <option value={20}>20 minutes</option>
              <option value={25}>25 minutes (Pomodoro Block)</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes (1 Hour AU)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1.5">
              Weekly Planned Attention Goal (AU)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={weeklyPlannedAU ?? ''}
              onChange={(e) => setWeeklyPlannedAU(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 40 AU (10 hrs)"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => toggleAttentionSystem(false)}
              className="w-full py-2 bg-slate-800 hover:bg-rose-950/40 text-rose-400 border border-rose-900/40 rounded-lg font-medium transition-colors"
            >
              Disable Attention Tracking
            </button>
          </div>
        </div>
      )}

      {/* Main Review Dashboard Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Historical Archive Notice if viewing saved snapshot */}
        {selectedHistoricalReviewId && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 flex-shrink-0" />
              <span>
                Viewing archived review snapshot generated on{' '}
                <strong>
                  {new Date(
                    attentionReviews.find((r) => r.id === selectedHistoricalReviewId)?.generatedAt || ''
                  ).toLocaleString()}
                </strong>
              </span>
            </div>
            <button
              onClick={() => setSelectedHistoricalReviewId(null)}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg transition-colors font-medium"
            >
              Return to Live Calculation
            </button>
          </div>
        )}

        {/* 1. Core Summary Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Tracked Attention */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 mb-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">Tracked Attention</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-100 font-mono">
                {activeReviewData.trackedAU}
              </span>
              <span className="text-amber-400 font-bold text-sm">AU</span>
              <span className="text-xs text-slate-400 ml-1">
                ({AttentionService.formatAU(activeReviewData.trackedAU, attentionUnitMinutes).split('(')[1]?.replace(')', '') || '0m'})
              </span>
            </div>

            {/* Planned AU Progress */}
            {activeReviewData.plannedAU ? (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Planned: {Math.round(activeReviewData.plannedAU * 100) / 100} AU</span>
                  <span>
                    {Math.round((activeReviewData.trackedAU / activeReviewData.plannedAU) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((activeReviewData.trackedAU / activeReviewData.plannedAU) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-3">
                {activeReviewData.sessionCount} focused sessions logged this week.
              </p>
            )}
          </div>

          {/* Card 2: Attention Performance (Estimation Ratio) */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">Estimation Accuracy</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-100 font-mono">
                {activeReviewData.estimationCalibration.averageRatio !== null
                  ? `${activeReviewData.estimationCalibration.averageRatio.toFixed(2)}×`
                  : '—'}
              </span>
              <span className="text-xs text-slate-400">
                {activeReviewData.estimationCalibration.averageRatio !== null
                  ? activeReviewData.estimationCalibration.averageRatio >= 0.85 &&
                    activeReviewData.estimationCalibration.averageRatio <= 1.15
                    ? 'Accurate'
                    : activeReviewData.estimationCalibration.averageRatio < 0.85
                    ? 'Overestimated'
                    : 'Underestimated'
                  : 'No estimates set'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {activeReviewData.estimationCalibration.accurateCount} Accurate
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {activeReviewData.estimationCalibration.overestimatedCount} Over
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {activeReviewData.estimationCalibration.underestimatedCount} Under
              </span>
            </div>
          </div>

          {/* Card 3: Focused Attention vs Calendar Time */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">Focused vs Calendar</span>
              <Calendar className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-100 font-mono">
                {Math.round((activeReviewData.trackedSeconds / 3600) * 10) / 10}h
              </span>
              <span className="text-xs text-slate-400">focused</span>
              <span className="text-slate-500">•</span>
              <span className="text-lg font-bold text-slate-300">7d</span>
              <span className="text-xs text-slate-400">calendar span</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              AU measures pure focus. Elapsed calendar days include sleep, context switches, and meetings.
            </p>
          </div>
        </div>

        {/* 2. Attention Allocations by Project & Standalone */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Attention Allocation by Project</span>
            </h2>

            {activeReviewData.projectAllocations.length === 0 && activeReviewData.standaloneAllocations.au === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic">
                No focus work recorded in this weekly window.
              </p>
            ) : (
              <div className="space-y-3.5">
                {activeReviewData.projectAllocations.map((p) => (
                  <div key={p.projectId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openProject(p.projectId)}
                          className="font-medium text-slate-200 hover:text-amber-400 transition-colors text-left"
                        >
                          {p.projectName}
                        </button>
                        {p.isAttention && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                            Attention Focus
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-200 font-semibold">{Math.round(p.au * 100) / 100} AU</span>
                        <span className="text-slate-500">({p.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{p.tasksWorkedCount} tasks worked</span>
                      <span>{p.tasksCompletedCount} completed</span>
                    </div>
                  </div>
                ))}

                {activeReviewData.standaloneAllocations.au > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">Standalone Tasks</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-200 font-semibold">
                          {Math.round(activeReviewData.standaloneAllocations.au * 100) / 100} AU
                        </span>
                        <span className="text-slate-500">
                          ({activeReviewData.standaloneAllocations.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${activeReviewData.standaloneAllocations.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{activeReviewData.standaloneAllocations.tasksWorkedCount} tasks worked</span>
                      <span>{activeReviewData.standaloneAllocations.tasksCompletedCount} completed</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top Tasks by Attention */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Top Focus Tasks</span>
            </h2>

            {activeReviewData.topTasksByAttention.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic">
                No individual task focus recorded in this window.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeReviewData.topTasksByAttention.map((t, idx) => (
                  <div
                    key={t.taskId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-mono text-slate-500 font-bold text-[11px] w-4">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200 truncate">{t.taskText}</p>
                        {t.projectName && (
                          <p className="text-[10px] text-amber-300/70 truncate">{t.projectName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                      <span className="text-amber-400 font-semibold">{Math.round(t.au * 100) / 100} AU</span>
                      <span className="text-slate-500 text-[11px]">({t.sessions} sess)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Emerging Working & Estimation Patterns (Rule-Based & Interpretable) */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Interpretable Pattern Observations</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent rule-based detections. Click any observation to inspect the exact deterministic formula.
              </p>
            </div>
          </div>

          {activeReviewData.patternObservations.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center italic">
              No specific recurring pattern thresholds were triggered for this week.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {activeReviewData.patternObservations.map((obs) => {
                const isExpanded = expandedRuleIds.has(obs.id);
                return (
                  <div
                    key={obs.id}
                    onClick={() => toggleRuleExpand(obs.id)}
                    className="p-4 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/60 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>{obs.title}</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 underline decoration-slate-600">
                        {isExpanded ? 'Hide rule' : 'Show rule'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {obs.description}
                    </p>

                    {/* Evidence summary */}
                    <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-slate-700/40 text-[11px] text-slate-400">
                      {obs.evidence.map((ev, i) => (
                        <div key={i}>
                          <span className="text-slate-500">{ev.label}: </span>
                          <span className="font-semibold text-slate-300 font-mono">{ev.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Expandable Exact Formula */}
                    {isExpanded && (
                      <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-amber-300 font-mono">
                        <span className="text-slate-500 block mb-0.5 font-sans uppercase text-[9px] font-bold">
                          Computation Rule:
                        </span>
                        {obs.ruleExplanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Historical Review Archive & Reflections */}
        {attentionReviews.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Archived Weekly Reviews ({attentionReviews.length})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {attentionReviews.map((rev) => (
                <div
                  key={rev.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    selectedHistoricalReviewId === rev.id
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        {rev.weekStartDate} → {rev.weekEndDate}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAttentionReview(rev.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete archived review"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      <span>{Math.round(rev.data.trackedAU * 100) / 100} AU tracked</span> •{' '}
                      <span>{rev.data.sessionCount} sessions</span>
                    </div>
                    {rev.userNotes && (
                      <p className="text-[11px] text-slate-300 mt-1.5 italic line-clamp-2">
                        "{rev.userNotes}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedHistoricalReviewId(rev.id)}
                    className="mt-3 w-full py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                  >
                    Inspect Snapshot
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
