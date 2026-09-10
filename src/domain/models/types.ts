export type NodeStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';
export type ProjectStatus = 'active' | 'parked' | 'archived' | 'completed' | 'abandoned';

export type ProjectColor =
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'rose'
  | 'amber'
  | 'orange';

export type ProjectIcon =
  | 'target'
  | 'rocket'
  | 'sparkles'
  | 'graduation-cap'
  | 'briefcase'
  | 'code'
  | 'heart'
  | 'flame'
  | 'book-open'
  | 'compass'
  | 'zap'
  | 'layers'
  | 'trophy'
  | 'flask-conical'
  | 'shield-check';

export interface ProjectStyle {
  readonly color?: ProjectColor;
  readonly icon?: ProjectIcon;
  readonly emoji?: string;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly endGoalNodeId: string;
  readonly tags?: readonly string[];
  readonly status?: ProjectStatus;
  readonly isAttention?: boolean;
  readonly attentionPromotedAt?: string;
  readonly archivedAt?: string;
  readonly style?: ProjectStyle;
  readonly lastActiveNodeId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Node {
  readonly id: string;
  readonly projectId?: string;
  readonly parentNodeId?: string | null;
  readonly text: string;
  readonly dueDate: string; // YYYY-MM-DD
  readonly status: NodeStatus;
  readonly position?: { readonly x: number; readonly y: number };
  readonly estimatedAU?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Edge {
  readonly id: string;
  readonly projectId: string;
  readonly fromNodeId: string; // Predecessor
  readonly toNodeId: string;   // Successor
  readonly createdAt: string;
}

export interface Note {
  readonly id: string;
  readonly nodeId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProjectNote = Note;

export interface SnapshotMetadata {
  readonly id: string;
  readonly projectId: string;
  readonly message?: string;
  readonly timestamp: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface ProjectSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly message?: string;
  readonly timestamp: string;
  readonly document: ProjectDocument;
}

export interface ProjectDocument {
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly project: Project;
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly notes: readonly Note[];
  readonly history?: readonly SnapshotMetadata[];
}

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface NthWeekdayOfMonth {
  readonly nth: 1 | 2 | 3 | 4 | -1; // 1 = 1st, 2 = 2nd, 3 = 3rd, 4 = 4th, -1 = Last
  readonly dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency;
  readonly interval?: number; // e.g. 1 (default), 2 for "every 2 weeks", 3 for "every 3 months"
  readonly daysOfWeek?: readonly number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat (used for weekly)
  readonly dayOfMonth?: number; // 1-31 (used for monthly by day)
  readonly nthWeekdayOfMonth?: NthWeekdayOfMonth; // for "1st Monday of the month", "last Friday", etc.
  readonly endDate?: string; // optional ISO date YYYY-MM-DD
  readonly count?: number; // optional occurrence count limit
}

export interface StandaloneTask {
  readonly id: string;
  readonly text: string;
  readonly dueDate: string; // YYYY-MM-DD
  readonly status: NodeStatus;
  readonly recurrence?: RecurrenceRule;
  readonly recurrenceInstance?: number;
  readonly parentRecurringTaskId?: string;
  readonly estimatedAU?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IdeaSeed {
  readonly id: string;
  readonly title: string;
  readonly rawNotes?: string;
  readonly seedThoughts?: readonly string[];
  readonly tags?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const ACTIVITY_EVENT_TYPES = [
  'task_created',
  'status_changed',
  'task_completed',
  'task_abandoned',
  'date_moved',
  'estimate_changed',
  'node_nested',
  'attention_promoted',
  'attention_demoted',
  'attention_system_toggled',
  'project_parked',
  'project_unparked',
  'work_started',
  'work_stopped',
  'work_paused',
  'work_resumed',
  'weekly_goal_set',
  'weekly_review_triggered',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];


export interface ActivityEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type: ActivityEventType;
  readonly entityId: string;
  readonly entityText?: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly fromStatus?: string;
  readonly toStatus?: string;
  readonly oldDueDate?: string;
  readonly newDueDate?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ActiveWorkSession {
  readonly sessionId: string;
  readonly taskId: string;
  readonly taskText: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly startedAt: string;
  readonly lastResumedAt?: string;
  readonly accumulatedSecondsBeforeResume?: number;
  readonly isPaused?: boolean;
}

export interface WorkSession {
  readonly id: string;
  readonly taskId: string;
  readonly projectId?: string;
  readonly taskText?: string;
  readonly startedAt: string;
  readonly stoppedAt: string;
  readonly durationSeconds: number;
  readonly au: number;
}

export interface TaskAttentionSummary {
  readonly taskId: string;
  readonly taskText?: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly estimatedAU?: number;
  readonly actualSeconds: number;
  readonly actualAU: number;
  readonly sessionCount: number;
  readonly calendarDurationHours?: number;
  readonly calendarSpanDays?: number;
  readonly firstWorkedAt?: string;
  readonly lastWorkedAt?: string;
  readonly estimationRatio?: number | null;
  readonly estimationStatus: 'accurate' | 'overestimated' | 'underestimated' | 'no_estimate';
}

export interface PatternObservation {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ruleExplanation: string;
  readonly evidence: readonly { readonly label: string; readonly value: string }[];
  readonly tone: 'neutral' | 'info';
}

export interface WeeklyAttentionReviewData {
  readonly weekStartDate: string;
  readonly weekEndDate: string;
  readonly generatedAt: string;
  readonly attentionUnitMinutes: number;
  readonly plannedAU?: number;
  readonly trackedAU: number;
  readonly trackedSeconds: number;
  readonly sessionCount: number;
  readonly projectAllocations: readonly {
    readonly projectId: string;
    readonly projectName: string;
    readonly isAttention: boolean;
    readonly au: number;
    readonly percentage: number;
    readonly tasksWorkedCount: number;
    readonly tasksCompletedCount: number;
  }[];
  readonly standaloneAllocations: {
    readonly au: number;
    readonly percentage: number;
    readonly tasksWorkedCount: number;
    readonly tasksCompletedCount: number;
  };
  readonly topTasksByAttention: readonly {
    readonly taskId: string;
    readonly taskText: string;
    readonly projectId?: string;
    readonly projectName?: string;
    readonly au: number;
    readonly sessions: number;
    readonly status: NodeStatus;
  }[];
  readonly estimationCalibration: {
    readonly tasksWithEstimate: number;
    readonly accurateCount: number;
    readonly overestimatedCount: number;
    readonly underestimatedCount: number;
    readonly averageRatio: number | null;
  };
  readonly taskSummaries: readonly TaskAttentionSummary[];
  readonly patternObservations: readonly PatternObservation[];
}

export interface WeeklyAttentionReviewRecord {
  readonly id: string;
  readonly weekStartDate: string;
  readonly weekEndDate?: string;
  readonly generatedAt?: string;
  readonly createdAt?: string;
  readonly data: WeeklyAttentionReviewData;
  readonly userNotes?: string;
}

export interface UserPreferences {
  readonly myDayMode: 'today' | 'current_tasks';
  readonly theme: 'dark' | 'light' | 'system';
  readonly dateFormat?: 'DD/MM/YYYY' | 'MMM_D_YYYY';
  readonly onboardingCompleted: boolean;
  readonly preferredStorageProvider: 'browser' | 'local_file';
  readonly maxAttentionProjects?: number;
  readonly lastActiveNodeId?: string;
  readonly lastActiveProjectId?: string;
  readonly lastActiveTimestamp?: string;
  readonly attentionSystemEnabled?: boolean;
  readonly attentionUnitMinutes?: number;
  readonly weeklyPlannedAU?: number;
  readonly activeWorkSession?: ActiveWorkSession | null;
  readonly idleSyncIntervalMinutes?: number;
  readonly capacityConfig?: DailyCapacityConfig;
}

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly endGoalText: string;
  readonly deadline: string;
  readonly tags: readonly string[];
  readonly status: ProjectStatus;
  readonly isArchived: boolean;
  readonly isParked: boolean;
  readonly isAttention: boolean;
  readonly archivedAt?: string;
  readonly style?: ProjectStyle;
  readonly progressPercentage: number;
  readonly activeTaskCount: number;
  readonly totalTaskCount: number;
  readonly completedTaskCount: number;
  readonly abandonedTaskCount: number;
  readonly updatedAt: string;
}

export interface DerivedTemporal {
  readonly nodeId: string;
  readonly explicitDueDate: string;
  readonly derivedStartDate: string;
  readonly derivedDurationDays: number;
  readonly isDerived: boolean;
}

export interface CascadeImpactPreview {
  readonly targetNodeId: string;
  readonly targetNodeText: string;
  readonly oldDueDate: string;
  readonly newDueDate: string;
  readonly shiftDays: number;
  readonly affectedSuccessors: {
    readonly nodeId: string;
    readonly nodeText: string;
    readonly currentDueDate: string;
    readonly proposedDueDate: string;
    readonly reason: string;
  }[];
}

export interface WorkScheduleConfig {
  readonly startHour: number; // 0-23, e.g. 9 for 09:00
  readonly startMinute?: number; // 0-59, e.g. 0
  readonly endHour: number; // 0-23, e.g. 17 for 17:00
  readonly endMinute?: number; // 0-59, e.g. 0
  readonly workDays: readonly number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

export interface CalendarInferenceConfig {
  readonly enabled: boolean;
  readonly minutesPerAU: number; // e.g. 15, 30, 60 minutes per 1 AU
  readonly workSchedule: WorkScheduleConfig;
}

export interface DailyCapacityConfig {
  readonly isConfigured: boolean;
  readonly weekdayDefaults: Record<number, number>; // day of week (0-6) -> default AU capacity
  readonly manualOverrides: Record<string, number>; // YYYY-MM-DD -> overridden AU capacity
  readonly calendarInference: CalendarInferenceConfig;
  readonly lastWeeklyPromptWeek?: string; // e.g. "2026-W37"
}

export type CapacitySnapshotSource = 'sync' | 'manual' | 'weekly_plan' | 'default';

export interface DailyCapacitySnapshot {
  readonly id: string;
  readonly date: string; // YYYY-MM-DD
  readonly timestamp: string; // ISO timestamp of snapshot creation
  readonly calendarAvailabilityAU?: number; // Theoretical available AU from work hours minus calendar events
  readonly expectedCapacityAU: number; // Baseline or learned expected capacity
  readonly userOverrideAU?: number; // Manual override if one was set
  readonly effectiveCapacityAU: number; // Resolved effective capacity
  readonly plannedAU: number; // Total planned AU due on this date at time of snapshot
  readonly realizedAU?: number; // Realized / completed AU on this date
  readonly occupiedMinutes?: number; // Minutes occupied by calendar events during work hours
  readonly confidence?: number; // 0.0 - 1.0 confidence in learned estimate
  readonly source: CapacitySnapshotSource;
}

export interface SchedulingImpactPreview {
  readonly date: string;
  readonly currentPlannedAU: number;
  readonly taskAU: number;
  readonly totalPlannedAU: number;
  readonly capacityAU: number;
  readonly remainingAU: number; // capacityAU - totalPlannedAU
  readonly percentageUsed: number; // (totalPlannedAU / capacityAU) * 100
  readonly isOverCapacity: boolean;
  readonly overCapacityDelta: number; // Math.max(0, totalPlannedAU - capacityAU)
  readonly calendarAvailabilityAU?: number;
  readonly isManualOverride: boolean;
}
