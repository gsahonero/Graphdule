import { z } from 'zod';
import { ACTIVITY_EVENT_TYPES, ActivityEventType } from './types';

export const NodeStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'abandoned']);
export const ProjectStatusSchema = z.enum(['active', 'parked', 'archived', 'completed', 'abandoned']);

export const ProjectColorSchema = z.enum([
  'emerald',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'rose',
  'amber',
  'orange',
]);

export const ProjectIconSchema = z.enum([
  'target',
  'rocket',
  'sparkles',
  'graduation-cap',
  'briefcase',
  'code',
  'heart',
  'flame',
  'book-open',
  'compass',
  'zap',
  'layers',
  'trophy',
  'flask-conical',
  'shield-check',
]);

export const ProjectStyleSchema = z.object({
  color: ProjectColorSchema.optional().default('emerald'),
  icon: ProjectIconSchema.optional().default('target'),
  emoji: z.string().optional(),
}).passthrough();

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  endGoalNodeId: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  status: ProjectStatusSchema.optional().default('active'),
  isAttention: z.boolean().optional().default(false),
  attentionPromotedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  style: ProjectStyleSchema.optional(),
  lastActiveNodeId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const NodeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().optional(),
  parentNodeId: z.string().nullable().optional(),
  text: z.string().min(1),
  dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Due date must be in YYYY-MM-DD format or empty'),
  status: NodeStatusSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  estimatedAU: z.number().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const EdgeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  createdAt: z.string(),
}).passthrough();

export const NoteSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const SnapshotMetadataSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  message: z.string().optional(),
  timestamp: z.string(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
}).passthrough();

export const ProjectDocumentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  project: ProjectSchema,
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  notes: z.array(NoteSchema),
  history: z.array(SnapshotMetadataSchema).optional().default([]),
}).passthrough();

export const RecurrenceFrequencySchema = z.enum(['daily', 'weekdays', 'weekly', 'monthly', 'yearly']);

export const NthWeekdayOfMonthSchema = z.object({
  nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
  dayOfWeek: z.number().int().min(0).max(6),
});

export const RecurrenceRuleSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  interval: z.number().int().positive().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  nthWeekdayOfMonth: NthWeekdayOfMonthSchema.optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  count: z.number().int().positive().optional(),
}).passthrough();

export const StandaloneTaskSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Due date must be in YYYY-MM-DD format or empty'),
  status: NodeStatusSchema,
  recurrence: RecurrenceRuleSchema.optional(),
  recurrenceInstance: z.number().int().positive().optional(),
  parentRecurringTaskId: z.string().optional(),
  estimatedAU: z.number().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const ActiveWorkSessionSchema = z.object({
  sessionId: z.string().min(1),
  taskId: z.string().min(1),
  taskText: z.string(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  startedAt: z.string(),
  lastResumedAt: z.string().optional(),
  accumulatedSecondsBeforeResume: z.number().nonnegative().optional(),
  isPaused: z.boolean().optional(),
}).passthrough();

export const UserPreferencesSchema = z.object({
  myDayMode: z.enum(['today', 'current_tasks']).default('today'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  dateFormat: z.enum(['DD/MM/YYYY', 'MMM_D_YYYY']).optional().default('DD/MM/YYYY'),
  onboardingCompleted: z.boolean().default(false),
  preferredStorageProvider: z.enum(['browser', 'local_file']).default('browser'),
  maxAttentionProjects: z.number().int().positive().optional().default(3),
  lastActiveNodeId: z.string().optional(),
  lastActiveProjectId: z.string().optional(),
  lastActiveTimestamp: z.string().optional(),
  attentionSystemEnabled: z.boolean().optional().default(false),
  attentionUnitMinutes: z.number().int().positive().optional().default(15),
  weeklyPlannedAU: z.number().nonnegative().optional(),
  activeWorkSession: ActiveWorkSessionSchema.nullable().optional(),
  idleSyncIntervalMinutes: z.number().int().positive().optional().default(15),
  capacityConfig: z.lazy(() => DailyCapacityConfigSchema).optional(),
}).passthrough();

export const IdeaSeedSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  rawNotes: z.string().optional(),
  seedThoughts: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

/**
 * Normalizes any activity event type string to its canonical ActivityEventType.
 * - Converts casing to lowercase snake_case
 * - Normalizes aliases (e.g. TASK_DEFERRED, DEADLINE_CHANGED -> date_moved)
 */
export function normalizeEventType(raw: string): ActivityEventType {
  if (typeof raw !== 'string') {
    return 'status_changed';
  }
  const clean = raw.trim().toLowerCase();
  switch (clean) {
    case 'task_created':
      return 'task_created';
    case 'status_changed':
      return 'status_changed';
    case 'task_completed':
      return 'task_completed';
    case 'task_abandoned':
      return 'task_abandoned';
    case 'date_moved':
    case 'task_deferred':
    case 'deadline_changed':
      return 'date_moved';
    case 'estimate_changed':
      return 'estimate_changed';
    case 'node_nested':
      return 'node_nested';
    case 'attention_promoted':
      return 'attention_promoted';
    case 'attention_demoted':
      return 'attention_demoted';
    case 'attention_system_toggled':
      return 'attention_system_toggled';
    case 'project_parked':
      return 'project_parked';
    case 'project_unparked':
      return 'project_unparked';
    case 'work_started':
      return 'work_started';
    case 'work_stopped':
      return 'work_stopped';
    case 'work_paused':
      return 'work_paused';
    case 'work_resumed':
      return 'work_resumed';
    case 'weekly_goal_set':
      return 'weekly_goal_set';
    case 'weekly_review_triggered':
      return 'weekly_review_triggered';
    default:
      return clean as ActivityEventType;
  }
}

export const CanonicalActivityEventTypeSchema = z.enum(ACTIVITY_EVENT_TYPES);

export const ActivityEventTypeSchema = z.preprocess(
  (val) => (typeof val === 'string' ? normalizeEventType(val) : val),
  CanonicalActivityEventTypeSchema
);


export const ActivityEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  type: ActivityEventTypeSchema,
  entityId: z.string().min(1),
  entityText: z.string().optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  oldDueDate: z.string().optional(),
  newDueDate: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

export const WeeklyAttentionReviewRecordSchema = z.object({
  id: z.string().min(1),
  weekStartDate: z.string(),
  weekEndDate: z.string().optional(),
  generatedAt: z.string().optional(),
  createdAt: z.string().optional(),
  data: z.record(z.unknown()),
  userNotes: z.string().optional(),
}).passthrough();

export const WorkScheduleConfigSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  startMinute: z.number().int().min(0).max(59).optional().default(0),
  endHour: z.number().int().min(0).max(23),
  endMinute: z.number().int().min(0).max(59).optional().default(0),
  workDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
}).passthrough();

export const CalendarInferenceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  minutesPerAU: z.number().int().positive().default(15),
  workSchedule: WorkScheduleConfigSchema,
}).passthrough();

export const DailyCapacityConfigSchema = z.object({
  isConfigured: z.boolean().default(false),
  weekdayDefaults: z.record(z.coerce.number(), z.number().nonnegative()).default({
    1: 20,
    2: 20,
    3: 20,
    4: 20,
    5: 20,
    6: 8,
    0: 8,
  }),
  manualOverrides: z.record(z.string(), z.number().nonnegative()).default({}),
  calendarInference: CalendarInferenceConfigSchema.default({
    enabled: false,
    minutesPerAU: 15,
    workSchedule: {
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      workDays: [1, 2, 3, 4, 5],
    },
  }),
  lastWeeklyPromptWeek: z.string().optional(),
}).passthrough();

export const CapacitySnapshotSourceSchema = z.enum(['sync', 'manual', 'weekly_plan', 'default']);

export const DailyCapacitySnapshotSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.string(),
  calendarAvailabilityAU: z.number().nonnegative().optional(),
  expectedCapacityAU: z.number().nonnegative(),
  userOverrideAU: z.number().nonnegative().optional(),
  effectiveCapacityAU: z.number().nonnegative(),
  plannedAU: z.number().nonnegative(),
  realizedAU: z.number().nonnegative().optional(),
  occupiedMinutes: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: CapacitySnapshotSourceSchema,
}).passthrough();

