import { z } from 'zod';

export const TaskEnvironmentSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.toLowerCase() : val),
  z.enum(['computer', 'physical', 'mixed'])
);

export const HealthSoundTypeSchema = z.enum([
  'subtle_chime',
  'meditation_bell',
  'gentle_pulse',
  'digital_soft',
  'custom_url',
  'none',
]);

export const InterventionTriggerTypeSchema = z.enum([
  'continuous_duration',
  'interval',
  'workload',
  'custom',
]);

export const InterventionTriggerSchema = z.object({
  type: InterventionTriggerTypeSchema,
  thresholdSeconds: z.number().nonnegative().optional(),
  intervalSeconds: z.number().nonnegative().optional(),
  customCondition: z.string().optional(),
}).passthrough();

export const InterventionNotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  style: z.enum(['subtle', 'banner', 'modal']).optional().default('subtle'),
  title: z.string().optional(),
}).passthrough();

export const InterventionSoundConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: HealthSoundTypeSchema.optional().default('subtle_chime'),
  volume: z.number().min(0).max(1).optional().default(0.3),
  customAudioUrl: z.string().optional(),
}).passthrough();

export const HealthInterventionEnvironmentSchema = z.union([
  z.array(TaskEnvironmentSchema),
  TaskEnvironmentSchema,
  z.literal('all'),
]);

export const HealthInterventionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  environment: HealthInterventionEnvironmentSchema.default(['computer', 'mixed']),
  trigger: InterventionTriggerSchema,
  interval: z.number().positive(),
  duration: z.number().nonnegative().default(20),
  message: z.string().min(1),
  notification: InterventionNotificationConfigSchema.default({ enabled: true, style: 'subtle' }),
  sound: InterventionSoundConfigSchema.default({ enabled: true, type: 'subtle_chime', volume: 0.3 }),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

export const HealthConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  enabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
  globalVolume: z.number().min(0).max(1).optional().default(0.3),
  defaultSoundType: HealthSoundTypeSchema.optional().default('subtle_chime'),
  defaultEnvironment: TaskEnvironmentSchema.optional().default('computer'),
  interventions: z.array(HealthInterventionSchema).default([]),
}).passthrough();
