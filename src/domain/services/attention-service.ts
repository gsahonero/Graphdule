import {
  ActivityEvent,
  Node,
  NodeStatus,
  PatternObservation,
  ProjectSummary,
  StandaloneTask,
  TaskAttentionSummary,
  WeeklyAttentionReviewData,
  WorkSession,
} from '../models/types';

export class AttentionService {
  /**
   * Convert duration in seconds to Attention Units (AU) based on configurable auMinutes (default: 15).
   * Formula: seconds / (auMinutes * 60), rounded to 2 decimal places.
   */
  public static durationSecondsToAU(seconds: number, auMinutes: number = 15): number {
    if (!seconds || seconds <= 0) return 0;
    const minutes = auMinutes > 0 ? auMinutes : 15;
    const au = seconds / (minutes * 60);
    return Math.round(au * 100) / 100;
  }

  /**
   * Format AU into human-readable label with equivalent real time (e.g., '2 AU (30m)' or '4 AU (1h)').
   */
  public static formatAU(au: number, auMinutes: number = 15): string {
    const minutes = auMinutes > 0 ? auMinutes : 15;
    const totalMinutes = Math.round(au * minutes);

    if (totalMinutes <= 0) {
      return `${au} AU`;
    }

    let timeStr = '';
    if (totalMinutes < 60) {
      timeStr = `${totalMinutes}m`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      timeStr = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    return `${au} AU (${timeStr})`;
  }

  /**
   * Reconstructs completed work sessions deterministically from raw telemetry events.
   * Source of truth is the immutable activity events log.
   */
  public static reconstructWorkSessions(
    events: readonly ActivityEvent[],
    auMinutes: number = 15
  ): WorkSession[] {
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const sessions: WorkSession[] = [];
    const openSessions = new Map<string, { event: ActivityEvent; startedAt: string; accumulatedSeconds: number }>();

    for (const ev of sorted) {
      const type = ev.type;
      const taskId = ev.entityId;

      if (type === 'WORK_STARTED' || type === 'work_started') {
        openSessions.set(taskId, {
          event: ev,
          startedAt: ev.timestamp,
          accumulatedSeconds: 0,
        });
      } else if (type === 'WORK_PAUSED' || type === 'work_paused') {
        const current = openSessions.get(taskId);
        if (current) {
          const pauseElapsed = Math.max(
            0,
            (new Date(ev.timestamp).getTime() - new Date(current.startedAt).getTime()) / 1000
          );
          current.accumulatedSeconds += pauseElapsed;
        }
      } else if (type === 'WORK_RESUMED' || type === 'work_resumed') {
        const current = openSessions.get(taskId);
        if (current) {
          current.startedAt = ev.timestamp;
        } else {
          openSessions.set(taskId, {
            event: ev,
            startedAt: ev.timestamp,
            accumulatedSeconds: 0,
          });
        }
      } else if (type === 'WORK_STOPPED' || type === 'work_stopped') {
        const current = openSessions.get(taskId);
        let durationSeconds = 0;

        if (typeof ev.metadata?.durationSeconds === 'number') {
          durationSeconds = ev.metadata.durationSeconds;
        } else if (current) {
          const stopElapsed = Math.max(
            0,
            (new Date(ev.timestamp).getTime() - new Date(current.startedAt).getTime()) / 1000
          );
          durationSeconds = current.accumulatedSeconds + stopElapsed;
        }

        const startedAt = current ? current.event.timestamp : ev.timestamp;
        const au = AttentionService.durationSecondsToAU(durationSeconds, auMinutes);

        sessions.push({
          id: ev.id,
          taskId,
          projectId: ev.projectId || current?.event.projectId,
          taskText: ev.entityText || current?.event.entityText,
          startedAt,
          stoppedAt: ev.timestamp,
          durationSeconds: Math.round(durationSeconds),
          au,
        });

        openSessions.delete(taskId);
      }
    }

    return sessions;
  }

  /**
   * Calculates attention performance ratio (actual / estimated) and categorizes it.
   */
  public static calculateAttentionRatio(
    estimatedAU: number | undefined,
    actualAU: number
  ): {
    ratio: number | null;
    label: string;
    status: 'accurate' | 'overestimated' | 'underestimated' | 'no_estimate';
  } {
    if (estimatedAU === undefined || estimatedAU <= 0) {
      return { ratio: null, label: 'N/A (No estimate)', status: 'no_estimate' };
    }

    const ratio = Math.round((actualAU / estimatedAU) * 100) / 100;

    if (ratio >= 0.85 && ratio <= 1.15) {
      return { ratio, label: `${ratio.toFixed(2)}× (Accurate)`, status: 'accurate' };
    } else if (ratio < 0.85) {
      return { ratio, label: `${ratio.toFixed(2)}× (Overestimated)`, status: 'overestimated' };
    } else {
      return { ratio, label: `${ratio.toFixed(2)}× (Underestimated)`, status: 'underestimated' };
    }
  }

  /**
   * Aggregates attention and calendar measurements for an individual task.
   */
  public static getTaskAttentionSummary(
    taskId: string,
    events: readonly ActivityEvent[],
    taskDetails?: {
      estimatedAU?: number;
      createdAt?: string;
      completedAt?: string;
      status?: NodeStatus;
      text?: string;
      projectId?: string;
      projectName?: string;
    },
    auMinutes: number = 15
  ): TaskAttentionSummary {
    const allSessions = AttentionService.reconstructWorkSessions(events, auMinutes);
    const taskSessions = allSessions.filter((s) => s.taskId === taskId);

    const actualSeconds = taskSessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    const actualAU = AttentionService.durationSecondsToAU(actualSeconds, auMinutes);

    const firstWorkedAt = taskSessions.length > 0 ? taskSessions[0].startedAt : undefined;
    const lastWorkedAt =
      taskSessions.length > 0 ? taskSessions[taskSessions.length - 1].stoppedAt : undefined;

    // Distinct calendar time calculation
    let calendarDurationHours: number | undefined;
    let calendarSpanDays: number | undefined;

    const startTime = taskDetails?.createdAt
      ? new Date(taskDetails.createdAt).getTime()
      : firstWorkedAt
      ? new Date(firstWorkedAt).getTime()
      : undefined;

    const endTime = taskDetails?.completedAt
      ? new Date(taskDetails.completedAt).getTime()
      : lastWorkedAt
      ? new Date(lastWorkedAt).getTime()
      : undefined;

    if (startTime && endTime && endTime >= startTime) {
      const diffMs = endTime - startTime;
      calendarDurationHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      calendarSpanDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
    }

    const performance = AttentionService.calculateAttentionRatio(
      taskDetails?.estimatedAU,
      actualAU
    );

    return {
      taskId,
      taskText: taskDetails?.text,
      projectId: taskDetails?.projectId,
      projectName: taskDetails?.projectName,
      estimatedAU: taskDetails?.estimatedAU,
      actualSeconds,
      actualAU,
      sessionCount: taskSessions.length,
      calendarDurationHours,
      calendarSpanDays,
      firstWorkedAt,
      lastWorkedAt,
      estimationRatio: performance.ratio,
      estimationStatus: performance.status,
    };
  }

  /**
   * Generates a comprehensive, transparent, rule-based Weekly Attention Review.
   */
  public static generateWeeklyAttentionReview(params: {
    events: readonly ActivityEvent[];
    tasks: readonly (Node | StandaloneTask)[];
    projects: readonly ProjectSummary[];
    weekStartDate: string; // YYYY-MM-DD
    weekEndDate: string; // YYYY-MM-DD
    plannedAU?: number;
    auMinutes?: number;
  }): WeeklyAttentionReviewData {
    const {
      events,
      tasks,
      projects,
      weekStartDate,
      weekEndDate,
      plannedAU,
      auMinutes = 15,
    } = params;

    const weekStartMs = new Date(`${weekStartDate}T00:00:00`).getTime();
    const weekEndMs = new Date(`${weekEndDate}T23:59:59.999`).getTime();

    // 1. Reconstruct all sessions and filter for the week window
    const allSessions = AttentionService.reconstructWorkSessions(events, auMinutes);
    const weekSessions = allSessions.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= weekStartMs && t <= weekEndMs;
    });

    const trackedSeconds = weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    const trackedAU = AttentionService.durationSecondsToAU(trackedSeconds, auMinutes);

    const taskMap = new Map<string, Node | StandaloneTask>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    const projectMap = new Map<string, ProjectSummary>();
    projects.forEach((p) => projectMap.set(p.id, p));

    // 2. Project Allocations
    const projectAUs = new Map<string, { au: number; seconds: number; taskIds: Set<string> }>();
    let standaloneAU = 0;
    const standaloneTaskIds = new Set<string>();

    for (const session of weekSessions) {
      if (session.projectId && session.projectId !== 'standalone') {
        const existing = projectAUs.get(session.projectId) || {
          au: 0,
          seconds: 0,
          taskIds: new Set(),
        };
        existing.au = Math.round((existing.au + session.au) * 100) / 100;
        existing.seconds += session.durationSeconds;
        existing.taskIds.add(session.taskId);
        projectAUs.set(session.projectId, existing);
      } else {
        standaloneAU = Math.round((standaloneAU + session.au) * 100) / 100;
        standaloneTaskIds.add(session.taskId);
      }
    }

    const projectAllocations = Array.from(projectAUs.entries()).map(([projId, data]) => {
      const proj = projectMap.get(projId);
      const percentage = trackedAU > 0 ? Math.round((data.au / trackedAU) * 1000) / 10 : 0;
      let completedInPeriod = 0;
      data.taskIds.forEach((tId) => {
        const t = taskMap.get(tId);
        if (t && t.status === 'completed') completedInPeriod++;
      });

      return {
        projectId: projId,
        projectName: proj?.name || 'Project',
        isAttention: !!proj?.isAttention,
        au: data.au,
        percentage,
        tasksWorkedCount: data.taskIds.size,
        tasksCompletedCount: completedInPeriod,
      };
    }).sort((a, b) => b.au - a.au);

    let standaloneCompletedCount = 0;
    standaloneTaskIds.forEach((tId) => {
      const t = taskMap.get(tId);
      if (t && t.status === 'completed') standaloneCompletedCount++;
    });

    const standaloneAllocations = {
      au: standaloneAU,
      percentage: trackedAU > 0 ? Math.round((standaloneAU / trackedAU) * 1000) / 10 : 0,
      tasksWorkedCount: standaloneTaskIds.size,
      tasksCompletedCount: standaloneCompletedCount,
    };

    // 3. Top Tasks by Attention
    const taskSessionStats = new Map<string, { au: number; sessions: number; text: string; projectId?: string }>();
    for (const s of weekSessions) {
      const prev = taskSessionStats.get(s.taskId) || {
        au: 0,
        sessions: 0,
        text: s.taskText || 'Task',
        projectId: s.projectId,
      };
      prev.au = Math.round((prev.au + s.au) * 100) / 100;
      prev.sessions += 1;
      taskSessionStats.set(s.taskId, prev);
    }

    const topTasksByAttention = Array.from(taskSessionStats.entries())
      .map(([taskId, stats]) => {
        const task = taskMap.get(taskId);
        const proj = stats.projectId ? projectMap.get(stats.projectId) : undefined;
        return {
          taskId,
          taskText: task?.text || stats.text,
          projectId: stats.projectId,
          projectName: proj?.name,
          au: stats.au,
          sessions: stats.sessions,
          status: task?.status || 'planned',
        };
      })
      .sort((a, b) => b.au - a.au)
      .slice(0, 10);

    // 4. Task Summaries & Estimation Calibration
    const taskSummaries: TaskAttentionSummary[] = [];
    let tasksWithEstimate = 0;
    let accurateCount = 0;
    let overestimatedCount = 0;
    let underestimatedCount = 0;
    const ratios: number[] = [];

    taskSessionStats.forEach((_, taskId) => {
      const task = taskMap.get(taskId);
      const proj = task && 'projectId' in task && task.projectId ? projectMap.get(task.projectId) : undefined;
      const summary = AttentionService.getTaskAttentionSummary(
        taskId,
        weekSessions.map((s) => ({
          id: s.id,
          timestamp: s.startedAt,
          type: 'WORK_STOPPED',
          entityId: s.taskId,
          entityText: s.taskText,
          projectId: s.projectId,
          metadata: { durationSeconds: s.durationSeconds },
        })),
        {
          estimatedAU: task?.estimatedAU,
          text: task?.text,
          status: task?.status,
          projectId: proj?.id,
          projectName: proj?.name,
          createdAt: task?.createdAt,
        },
        auMinutes
      );

      taskSummaries.push(summary);

      if (summary.estimatedAU && summary.estimatedAU > 0) {
        tasksWithEstimate++;
        if (summary.estimationStatus === 'accurate') accurateCount++;
        else if (summary.estimationStatus === 'overestimated') overestimatedCount++;
        else if (summary.estimationStatus === 'underestimated') underestimatedCount++;
        if (summary.estimationRatio !== null && summary.estimationRatio !== undefined) {
          ratios.push(summary.estimationRatio);
        }
      }
    });

    const averageRatio =
      ratios.length > 0
        ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) / 100
        : null;

    // 5. Interpretable, Rule-Based Pattern Diagnostics
    const patternObservations: PatternObservation[] = [];

    // Rule 1: Postponement with Diverted Attention (Deferred >= 2 times while >= 4 AU logged elsewhere)
    const taskDeferralCounts = new Map<string, { count: number; text?: string }>();
    for (const ev of events) {
      const t = new Date(ev.timestamp).getTime();
      if (t >= weekStartMs && t <= weekEndMs) {
        if (ev.type === 'TASK_DEFERRED' || ev.type === 'task_deferred' || ev.type === 'date_moved') {
          const prev = taskDeferralCounts.get(ev.entityId) || { count: 0, text: ev.entityText };
          taskDeferralCounts.set(ev.entityId, { count: prev.count + 1, text: ev.entityText || prev.text });
        }
      }
    }

    taskDeferralCounts.forEach((def, defTaskId) => {
      if (def.count >= 2) {
        const taskAU = taskSessionStats.get(defTaskId)?.au || 0;
        const otherAU = Math.max(0, trackedAU - taskAU);
        if (otherAU >= 4.0) {
          patternObservations.push({
            id: `postponement_${defTaskId}`,
            title: 'Possible Procrastination Pattern: Repeated Postponement with Alternate Activity',
            description: `Task "${def.text || defTaskId}" was postponed ${def.count} times while ${otherAU} AU (${AttentionService.formatAU(otherAU, auMinutes)}) was spent on other work.`,
            ruleExplanation: 'Triggered when deferredCount >= 2 AND otherTasksTrackedAU >= 4.0 AU.',
            evidence: [
              { label: 'Postponements recorded', value: `${def.count} times` },
              { label: 'Attention on this task', value: `${taskAU} AU` },
              { label: 'Attention on other tasks', value: `${otherAU} AU` },
            ],
            tone: 'neutral',
          });
        }
      }
    });

    // Rule 2: Estimation Calibration Tendency
    if (tasksWithEstimate >= 3 && averageRatio !== null) {
      if (averageRatio > 1.25) {
        patternObservations.push({
          id: 'estimation_underestimation_trend',
          title: 'Estimation Tendency: Underestimating Task Scope',
          description: `Estimated tasks this week required an average of ${averageRatio}× of their planned attention. Tasks frequently took longer than anticipated.`,
          ruleExplanation: 'Triggered when average actual/estimated ratio > 1.25× across >= 3 estimated tasks.',
          evidence: [
            { label: 'Average ratio (actual / estimated)', value: `${averageRatio}×` },
            { label: 'Underestimated tasks', value: `${underestimatedCount} of ${tasksWithEstimate}` },
          ],
          tone: 'neutral',
        });
      } else if (averageRatio < 0.75) {
        patternObservations.push({
          id: 'estimation_overestimation_trend',
          title: 'Estimation Tendency: Overestimating Task Scope',
          description: `Estimated tasks this week finished in an average of ${averageRatio}× of their planned attention. Tasks were completed faster than expected.`,
          ruleExplanation: 'Triggered when average actual/estimated ratio < 0.75× across >= 3 estimated tasks.',
          evidence: [
            { label: 'Average ratio (actual / estimated)', value: `${averageRatio}×` },
            { label: 'Overestimated tasks', value: `${overestimatedCount} of ${tasksWithEstimate}` },
          ],
          tone: 'neutral',
        });
      }
    }

    // Rule 3: Session Depth Distribution
    if (weekSessions.length >= 3) {
      const deepSessions = weekSessions.filter((s) => s.au >= 2.0).length;
      const deepPct = Math.round((deepSessions / weekSessions.length) * 100);
      const shortSessions = weekSessions.filter((s) => s.au < 0.5).length;
      const shortPct = Math.round((shortSessions / weekSessions.length) * 100);

      if (deepPct >= 40) {
        patternObservations.push({
          id: 'deep_focus_pattern',
          title: 'Focus Depth: Sustained Focus Blocks',
          description: `${deepPct}% of your work sessions were sustained focus blocks (>= 2.0 AU / 30+ minutes).`,
          ruleExplanation: 'Triggered when >= 40% of recorded sessions last at least 2.0 AU uninterrupted.',
          evidence: [
            { label: 'Deep sessions (>= 2 AU)', value: `${deepSessions} of ${weekSessions.length} (${deepPct}%)` },
            { label: 'Short check-in sessions (< 0.5 AU)', value: `${shortSessions} (${shortPct}%)` },
          ],
          tone: 'info',
        });
      } else if (shortPct >= 60) {
        patternObservations.push({
          id: 'fragmented_focus_pattern',
          title: 'Focus Rhythm: High Context Switching',
          description: `${shortPct}% of your work sessions were under 0.5 AU (short intervals), indicating rapid switching or frequent interruptions.`,
          ruleExplanation: 'Triggered when >= 60% of recorded sessions are under 0.5 AU.',
          evidence: [
            { label: 'Short sessions (< 0.5 AU)', value: `${shortSessions} of ${weekSessions.length} (${shortPct}%)` },
          ],
          tone: 'neutral',
        });
      }
    }

    // Rule 4: Project Progress Alignment
    const topProject = projectAllocations.length > 0 ? projectAllocations[0] : null;
    if (topProject && topProject.percentage >= 40) {
      patternObservations.push({
        id: 'project_concentration',
        title: `Attention Concentration: ${topProject.projectName}`,
        description: `${topProject.percentage}% of all focused attention was invested in "${topProject.projectName}", resulting in ${topProject.tasksCompletedCount} completed tasks.`,
        ruleExplanation: 'Triggered when a single project receives >= 40% of weekly tracked attention.',
        evidence: [
          { label: 'Project attention', value: `${topProject.au} AU (${topProject.percentage}%)` },
          { label: 'Tasks completed in project', value: `${topProject.tasksCompletedCount}` },
        ],
        tone: 'info',
      });
    }

    return {
      weekStartDate,
      weekEndDate,
      generatedAt: new Date().toISOString(),
      attentionUnitMinutes: auMinutes,
      plannedAU,
      trackedAU,
      trackedSeconds,
      sessionCount: weekSessions.length,
      projectAllocations,
      standaloneAllocations,
      topTasksByAttention,
      estimationCalibration: {
        tasksWithEstimate,
        accurateCount,
        overestimatedCount,
        underestimatedCount,
        averageRatio,
      },
      taskSummaries,
      patternObservations,
    };
  }
}
