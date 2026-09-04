import { z } from 'zod';

export const NodeStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'abandoned']);

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  endGoalNodeId: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

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
});

export const EdgeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  createdAt: z.string(),
});

export const NoteSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SnapshotMetadataSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  message: z.string().optional(),
  timestamp: z.string(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
});

export const ProjectDocumentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  project: ProjectSchema,
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  notes: z.array(NoteSchema),
  history: z.array(SnapshotMetadataSchema).optional().default([]),
});

export const StandaloneTaskSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: NodeStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserPreferencesSchema = z.object({
  myDayMode: z.enum(['today', 'current_tasks']).default('today'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  onboardingCompleted: z.boolean().default(false),
  preferredStorageProvider: z.enum(['browser', 'local_file']).default('browser'),
});
