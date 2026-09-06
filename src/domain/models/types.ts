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

export type ActivityEventType =
  | 'task_created'
  | 'status_changed'
  | 'task_completed'
  | 'date_moved'
  | 'attention_promoted'
  | 'attention_demoted'
  | 'project_parked'
  | 'project_unparked';

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
