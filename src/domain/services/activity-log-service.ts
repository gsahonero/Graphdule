import { ActivityEvent, ActivityEventType } from '../models/types';
import { ActivityEventSchema } from '../models/schema';

export interface ActivityPatternMetrics {
  totalEvents: number;
  tasksCreated: number;
  tasksCompleted: number;
  datesMovedCount: number;
  averageCycleTimeHours?: number;
  attentionPromotions: number;
  attentionDemotions: number;
  tasksCompletedUnderAttention: number;
  tasksCompletedOutsideAttention: number;
  mostDeferredTasks: { entityId: string; entityText?: string; movesCount: number }[];
  dailyActivityDistribution: Record<string, number>;
}

export interface LLMPatternAnalysisPayload {
  generatedAt: string;
  periodStart?: string;
  periodEnd?: string;
  metrics: ActivityPatternMetrics;
  eventsSummary: {
    timestamp: string;
    type: ActivityEventType;
    entity: string;
    project?: string;
    details?: string;
  }[];
  markdownPrompt: string;
  // Convenience aliases
  totalEvents?: number;
  tasksCreated?: number;
  tasksCompleted?: number;
  tasksPostponed?: number;
  completionsInAttention?: number;
  completionsOutOfAttention?: number;
  llmPrompt?: string;
}

export class ActivityLogService {
  /**
   * Factory to create an ActivityEvent with a valid ISO timestamp and UUID
   */
  static createEvent(
    type: ActivityEventType,
    entityIdOrOptions:
      | string
      | {
          entityId?: string;
          taskId?: string;
          entityText?: string;
          taskText?: string;
          projectId?: string;
          projectName?: string;
          fromStatus?: string;
          toStatus?: string;
          oldDueDate?: string;
          previousDate?: string;
          newDueDate?: string;
          newDate?: string;
          isAttentionProject?: boolean;
          metadata?: Record<string, unknown>;
        },
    options?: {
      entityText?: string;
      projectId?: string;
      projectName?: string;
      fromStatus?: string;
      toStatus?: string;
      oldDueDate?: string;
      newDueDate?: string;
      metadata?: Record<string, unknown>;
    }
  ): ActivityEvent {
    let entityId: string;
    let entityText = options?.entityText;
    let projectId = options?.projectId;
    let projectName = options?.projectName;
    let fromStatus = options?.fromStatus;
    let toStatus = options?.toStatus;
    let oldDueDate = options?.oldDueDate;
    let newDueDate = options?.newDueDate;
    let metadata = options?.metadata ? { ...options.metadata } : undefined;

    if (typeof entityIdOrOptions === 'object' && entityIdOrOptions !== null) {
      entityId = entityIdOrOptions.entityId || entityIdOrOptions.taskId || `entity_${Date.now()}`;
      entityText = entityIdOrOptions.entityText || entityIdOrOptions.taskText || entityText;
      projectId = entityIdOrOptions.projectId || projectId;
      projectName = entityIdOrOptions.projectName || projectName;
      fromStatus = entityIdOrOptions.fromStatus || fromStatus;
      toStatus = entityIdOrOptions.toStatus || toStatus;
      oldDueDate = entityIdOrOptions.oldDueDate || entityIdOrOptions.previousDate || oldDueDate;
      newDueDate = entityIdOrOptions.newDueDate || entityIdOrOptions.newDate || newDueDate;
      if (entityIdOrOptions.isAttentionProject !== undefined) {
        metadata = { ...metadata, isAttentionProject: entityIdOrOptions.isAttentionProject };
      }
      if (entityIdOrOptions.metadata) {
        metadata = { ...metadata, ...entityIdOrOptions.metadata };
      }
    } else {
      entityId = entityIdOrOptions;
    }

    const raw: ActivityEvent = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      entityId,
      entityText,
      projectId,
      projectName,
      fromStatus,
      toStatus,
      oldDueDate,
      newDueDate,
      metadata,
    };

    return ActivityEventSchema.parse(raw);
  }

  /**
   * Computes productivity patterns and formats an LLM-ready prompt
   */
  static generatePatternAnalysis(
    events: readonly ActivityEvent[],
    daysBack?: number
  ): LLMPatternAnalysisPayload {
    let filteredEvents = [...events];
    if (daysBack !== undefined && daysBack > 0) {
      const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      filteredEvents = filteredEvents.filter((e) => e.timestamp >= cutoff);
    }

    const sorted = filteredEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const periodStart = sorted.length > 0 ? sorted[0].timestamp : undefined;
    const periodEnd = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : undefined;

    let tasksCreated = 0;
    let tasksCompleted = 0;
    let datesMovedCount = 0;
    let attentionPromotions = 0;
    let attentionDemotions = 0;
    let tasksCompletedUnderAttention = 0;
    let tasksCompletedOutsideAttention = 0;

    const taskCreatedTimes = new Map<string, number>();
    const taskMoveCounts = new Map<string, { text?: string; count: number }>();
    const cycleTimesHours: number[] = [];
    const dailyActivity: Record<string, number> = {};

    for (const ev of sorted) {
      const day = ev.timestamp.slice(0, 10);
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;

      switch (ev.type) {
        case 'task_created': {
          tasksCreated++;
          taskCreatedTimes.set(ev.entityId, new Date(ev.timestamp).getTime());
          break;
        }
        case 'task_completed': {
          tasksCompleted++;
          const createdTime = taskCreatedTimes.get(ev.entityId);
          if (createdTime) {
            const cycleHours = (new Date(ev.timestamp).getTime() - createdTime) / (1000 * 60 * 60);
            cycleTimesHours.push(cycleHours);
          }
          if (ev.metadata?.isAttentionProject === true) {
            tasksCompletedUnderAttention++;
          } else {
            tasksCompletedOutsideAttention++;
          }
          break;
        }
        case 'date_moved': {
          datesMovedCount++;
          const prev = taskMoveCounts.get(ev.entityId) || { text: ev.entityText, count: 0 };
          taskMoveCounts.set(ev.entityId, { text: ev.entityText || prev.text, count: prev.count + 1 });
          break;
        }
        case 'attention_promoted': {
          attentionPromotions++;
          break;
        }
        case 'attention_demoted': {
          attentionDemotions++;
          break;
        }
      }
    }

    const averageCycleTimeHours =
      cycleTimesHours.length > 0
        ? Math.round((cycleTimesHours.reduce((a, b) => a + b, 0) / cycleTimesHours.length) * 10) / 10
        : undefined;

    const mostDeferredTasks = Array.from(taskMoveCounts.entries())
      .map(([entityId, val]) => ({ entityId, entityText: val.text, movesCount: val.count }))
      .sort((a, b) => b.movesCount - a.movesCount)
      .slice(0, 5);

    const metrics: ActivityPatternMetrics = {
      totalEvents: events.length,
      tasksCreated,
      tasksCompleted,
      datesMovedCount,
      averageCycleTimeHours,
      attentionPromotions,
      attentionDemotions,
      tasksCompletedUnderAttention,
      tasksCompletedOutsideAttention,
      mostDeferredTasks,
      dailyActivityDistribution: dailyActivity,
    };

    // Construct events summary for prompt
    const eventsSummary = sorted.slice(-100).map((e) => {
      let details = '';
      if (e.type === 'status_changed') details = `${e.fromStatus} → ${e.toStatus}`;
      else if (e.type === 'date_moved') details = `${e.oldDueDate || 'none'} → ${e.newDueDate}`;
      return {
        timestamp: e.timestamp,
        type: e.type,
        entity: e.entityText || e.entityId,
        project: e.projectName,
        details: details || undefined,
      };
    });

    const markdownPrompt = [
      '# Productivity & Attention Telemetry Analysis Prompt',
      '',
      'You are an executive productivity coach and behavioral analytics expert analyzing execution telemetry from Graphdule.',
      'Graphdule is an attention-driven task and dependency management system based on the principle:',
      '> "Ideas are unlimited; projects are manageable; attention is limited."',
      '',
      '## Telemetry Summary',
      `- **Active Tracking Period:** ${periodStart ? new Date(periodStart).toLocaleDateString() : 'N/A'} to ${periodEnd ? new Date(periodEnd).toLocaleDateString() : 'N/A'}`,
      `- **Total Events Recorded:** ${metrics.totalEvents}`,
      `- **Tasks Created:** ${metrics.tasksCreated}`,
      `- **Tasks Completed:** ${metrics.tasksCompleted}`,
      `- **Average Cycle Time (Creation to Completion):** ${metrics.averageCycleTimeHours !== undefined ? `${metrics.averageCycleTimeHours} hours` : 'N/A'}`,
      `- **Due Date Postponements / Reschedules:** ${metrics.datesMovedCount}`,
      `- **Tasks Completed in Attention/Focus Projects:** ${metrics.tasksCompletedUnderAttention}`,
      `- **Tasks Completed outside Attention:** ${metrics.tasksCompletedOutsideAttention}`,
      `- **Attention Slot Swaps (Promotions/Demotions):** ${metrics.attentionPromotions} promoted, ${metrics.attentionDemotions} demoted`,
      '',
      '## Most Frequently Rescheduled Tasks (Postponement Hotspots)',
      mostDeferredTasks.length === 0
        ? '_No rescheduled tasks recorded._'
        : mostDeferredTasks.map((t) => `- **"${t.entityText || t.entityId}"**: rescheduled ${t.movesCount} time(s)`).join('\n'),
      '',
      '## Recent Activity Stream (Last 100 events)',
      '```json',
      JSON.stringify(eventsSummary, null, 2),
      '```',
      '',
      '## Your Mission',
      'Based on the telemetry above, provide an incisive diagnostic report covering:',
      '1. **Attention Adherence & Velocity:** Did focusing on capped attention projects correlate with faster task completions?',
      '2. **Friction & Bottleneck Detection:** What caused the most frequent date postponements?',
      '3. **Workload Rhythm:** Are tasks being batched, abandoned, or dragged out?',
      '4. **Actionable Recommendations:** Suggest 3 concrete adjustments to project capacity, scoping, or daily habits to maximize flow.',
    ].join('\n');

    return {
      generatedAt: new Date().toISOString(),
      periodStart,
      periodEnd,
      metrics,
      eventsSummary,
      markdownPrompt,
      totalEvents: metrics.totalEvents,
      tasksCreated: metrics.tasksCreated,
      tasksCompleted: metrics.tasksCompleted,
      tasksPostponed: metrics.datesMovedCount,
      completionsInAttention: metrics.tasksCompletedUnderAttention,
      completionsOutOfAttention: metrics.tasksCompletedOutsideAttention,
      llmPrompt: markdownPrompt,
    };
  }
}
