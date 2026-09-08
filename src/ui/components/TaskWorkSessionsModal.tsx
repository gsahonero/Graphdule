import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AttentionService } from '../../domain/services/attention-service';
import { WorkSession } from '../../domain/models/types';
import {
  X,
  Clock,
  Trash2,
  Edit2,
  Plus,
  AlertTriangle,
  Check,
} from 'lucide-react';

export const TaskWorkSessionsModal: React.FC = () => {
  const {
    workSessionsModalTaskId,
    closeWorkSessionsModal,
    allActiveNodes,
    standaloneTasks,
    projects,
    activityLog,
    attentionUnitMinutes,
    deleteWorkSession,
    updateWorkSessionDuration,
    clearTaskWorkSessions,
    addManualWorkSession,
  } = useApp();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState<string>('');
  const [showAddManual, setShowAddManual] = useState<boolean>(false);
  const [manualMinutes, setManualMinutes] = useState<string>('15');
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showConfirmClearAll, setShowConfirmClearAll] = useState<boolean>(false);

  // Find target task
  const targetTask = useMemo(() => {
    if (!workSessionsModalTaskId) return null;
    const node = allActiveNodes.find((n) => n.id === workSessionsModalTaskId);
    if (node) return { ...node, isNode: true };
    const standalone = standaloneTasks.find((t) => t.id === workSessionsModalTaskId);
    if (standalone) return { ...standalone, isNode: false };
    return null;
  }, [workSessionsModalTaskId, allActiveNodes, standaloneTasks]);

  // Reconstruct all sessions for this specific task
  const taskSessions = useMemo(() => {
    if (!workSessionsModalTaskId) return [];
    const all = AttentionService.reconstructWorkSessions(activityLog, attentionUnitMinutes);
    return all
      .filter((s) => s.taskId === workSessionsModalTaskId)
      .sort(
        (a, b) =>
          AttentionService.parseSafeEpochMs(b.startedAt) - AttentionService.parseSafeEpochMs(a.startedAt)
      );
  }, [workSessionsModalTaskId, activityLog, attentionUnitMinutes]);

  if (!workSessionsModalTaskId) {
    return null;
  }

  const totalActualSeconds = taskSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalActualAU = AttentionService.durationSecondsToAU(totalActualSeconds, attentionUnitMinutes);
  const estimatedAU = targetTask?.estimatedAU;
  const taskName = targetTask?.text || taskSessions[0]?.taskText || 'Task';
  const projectId =
    targetTask && 'projectId' in targetTask && targetTask.projectId
      ? targetTask.projectId
      : taskSessions[0]?.projectId;
  const projectObj = projectId ? projects.find((p) => p.id === projectId) : null;
  const projectName = projectObj?.name || taskSessions[0]?.projectId;

  const handleStartEdit = (session: WorkSession) => {
    setEditingSessionId(session.id);
    const mins = Math.round(session.durationSeconds / 60);
    setEditMinutes(mins > 0 ? mins.toString() : '1');
  };

  const handleSaveEdit = async (session: WorkSession) => {
    const mins = parseFloat(editMinutes);
    if (!isNaN(mins) && mins >= 0) {
      const durationSeconds = Math.round(mins * 60);
      await updateWorkSessionDuration(session.id, durationSeconds);
    }
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteWorkSession(sessionId);
  };

  const handleClearAll = async () => {
    await clearTaskWorkSessions(workSessionsModalTaskId);
    setShowConfirmClearAll(false);
  };

  const handleAddManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(manualMinutes);
    if (isNaN(mins) || mins <= 0) return;
    const durationSeconds = Math.round(mins * 60);

    const nowTime = new Date().toISOString().substring(11);
    const stoppedAtIso = manualDate ? `${manualDate}T${nowTime}` : new Date().toISOString();

    await addManualWorkSession(workSessionsModalTaskId, durationSeconds, {
      stoppedAt: stoppedAtIso,
      entityText: taskName,
      projectId: projectId || undefined,
      projectName: projectName || undefined,
    });

    setShowAddManual(false);
    setManualMinutes('15');
  };

  const formatSessionTime = (isoString: string): string => {
    try {
      const ms = AttentionService.parseSafeEpochMs(isoString);
      if (!ms) return isoString;
      const d = new Date(ms);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatSessionDate = (isoString: string): string => {
    try {
      const ms = AttentionService.parseSafeEpochMs(isoString);
      if (!ms) return isoString;
      const d = new Date(ms);
      return d.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatDurationDetailed = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeWorkSessionsModal}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                <Clock className="w-4 h-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Recorded Work Sessions
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
              {projectName && (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-1.5">
                  [{projectName}]
                </span>
              )}
              {taskName}
            </p>
          </div>
          <button
            onClick={closeWorkSessionsModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Attention Summary Metrics Bar */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80 text-center">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Total Tracked Time
            </div>
            <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-300 mt-0.5">
              {AttentionService.formatAU(totalActualAU, attentionUnitMinutes)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {formatDurationDetailed(totalActualSeconds)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Estimated Attention
            </div>
            <div className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200 mt-0.5">
              {estimatedAU !== undefined
                ? AttentionService.formatAU(estimatedAU, attentionUnitMinutes)
                : 'None'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {taskSessions.length} {taskSessions.length === 1 ? 'session' : 'sessions'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Ratio / Progress
            </div>
            <div
              className={`text-sm font-bold font-mono mt-0.5 ${
                estimatedAU && totalActualAU > estimatedAU
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {estimatedAU && estimatedAU > 0
                ? `${Math.round((totalActualAU / estimatedAU) * 100)}%`
                : '100%'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {estimatedAU && totalActualAU > estimatedAU ? 'Overshot' : 'Within budget'}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {taskSessions.length === 0 ? (
            <div className="text-center py-8 px-4 text-slate-400 dark:text-slate-500 space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-medium">No recorded work sessions for this task yet.</p>
              <p className="text-xs">
                Use the Work button on the task or add a manual session below to record focus time.
              </p>
            </div>
          ) : (
            taskSessions.map((session, index) => {
              const isEditing = editingSessionId === session.id;
              const isRunaway = session.durationSeconds > 7200; // > 2 hours

              return (
                <div
                  key={session.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isRunaway
                      ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Session #{taskSessions.length - index}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatSessionDate(session.startedAt)}
                        </span>
                        {isRunaway && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                            title="This session was running for more than 2 hours. Did your timer run in the background?"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Over 2h
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                        <span>{formatSessionTime(session.startedAt)}</span>
                        <span>&rarr;</span>
                        <span>{formatSessionTime(session.stoppedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editMinutes}
                            onChange={(e) => setEditMinutes(e.target.value)}
                            className="w-16 px-2 py-1 text-xs font-mono rounded border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            placeholder="Mins"
                            autoFocus
                          />
                          <span className="text-xs text-slate-400 font-medium">min</span>
                          <button
                            onClick={() => handleSaveEdit(session)}
                            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
                            title="Save duration"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingSessionId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300">
                              {Math.round(session.au * 100) / 100} AU
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatDurationDetailed(session.durationSeconds)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                            <button
                              onClick={() => handleStartEdit(session)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors"
                              title="Edit duration"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Delete this session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Manual Session Form */}
          {showAddManual && (
            <form
              onSubmit={handleAddManualSession}
              className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3 animate-in fade-in"
            >
              <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Past or Offline Work Session
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Duration (Minutes)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="15"
                    />
                    <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                      {AttentionService.durationSecondsToAU(
                        (parseFloat(manualMinutes) || 0) * 60,
                        attentionUnitMinutes
                      )}{' '}
                      AU
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddManual(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                >
                  Add Session
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!showAddManual && (
              <button
                onClick={() => setShowAddManual(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
                Add Session
              </button>
            )}

            {taskSessions.length > 0 && !showConfirmClearAll && (
              <button
                onClick={() => setShowConfirmClearAll(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Remove all work sessions and reset tracked time to 0 AU"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}

            {showConfirmClearAll && (
              <div className="flex items-center gap-1.5 animate-in fade-in">
                <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  Reset to 0 AU?
                </span>
                <button
                  onClick={handleClearAll}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setShowConfirmClearAll(false)}
                  className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <button
            onClick={closeWorkSessionsModal}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};