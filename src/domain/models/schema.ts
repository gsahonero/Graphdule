import { z } from 'zod';

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
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  status: NodeStatusSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
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
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: NodeStatusSchema,
  recurrence: RecurrenceRuleSchema.optional(),
  recurrenceInstance: z.number().int().positive().optional(),
  parentRecurringTaskId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

export const ActivityEventTypeSchema = z.enum([
  'task_created',
  'status_changed',
  'task_completed',
  'date_moved',
  'attention_promoted',
  'attention_demoted',
  'project_parked',
  'project_unparked',
]);

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

