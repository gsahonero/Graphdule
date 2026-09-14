export type TaskEnvironment = 'computer' | 'physical' | 'mixed';

export type HealthSoundType =
  | 'subtle_chime'
  | 'meditation_bell'
  | 'gentle_pulse'
  | 'digital_soft'
  | 'custom_url'
  | 'none';

export type InterventionTriggerType =
  | 'continuous_duration'
  | 'interval'
  | 'workload'
  | 'custom';

export interface InterventionTrigger {
  readonly type: InterventionTriggerType;
  readonly thresholdSeconds?: number;
  readonly intervalSeconds?: number;
  readonly customCondition?: string;
}

export interface InterventionNotificationConfig {
  readonly enabled: boolean;
  readonly style?: 'subtle' | 'banner' | 'modal';
  readonly title?: string;
}

export interface InterventionSoundConfig {
  readonly enabled: boolean;
  readonly type?: HealthSoundType;
  readonly volume?: number; // 0.0 - 1.0
  readonly customAudioUrl?: string;
}

export interface HealthIntervention {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly environment: TaskEnvironment[] | TaskEnvironment | 'all';
  readonly trigger: InterventionTrigger;
  readonly interval: number; // in seconds
  readonly duration: number; // in seconds (e.g. 20s for 20-20-20)
  readonly message: string;
  readonly notification: InterventionNotificationConfig;
  readonly sound: InterventionSoundConfig;
  readonly metadata?: Record<string, unknown>;
}

export interface HealthConfig {
  readonly version: number;
  readonly enabled: boolean;
  readonly soundEnabled: boolean;
  readonly globalVolume?: number; // 0.0 - 1.0, default 0.3
  readonly defaultSoundType?: HealthSoundType;
  readonly defaultEnvironment?: TaskEnvironment;
  readonly interventions: readonly HealthIntervention[];
}

export interface HealthFocusContext {
  readonly taskId: string;
  readonly taskText: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly taskEnvironment?: TaskEnvironment;
  readonly continuousDurationSeconds: number;
  readonly sessionElapsedSeconds: number;
  readonly isPaused: boolean;
  readonly currentAU?: number;
  readonly estimatedAU?: number;
}

export type InterventionRuntimeStatus =
  | 'idle'
  | 'triggered'
  | 'active'
  | 'acknowledged'
  | 'dismissed';

export interface InterventionRuntimeState {
  readonly interventionId: string;
  readonly lastTriggeredAtSeconds: number;
  readonly acknowledgedAtSeconds?: number;
  readonly dismissedAtSeconds?: number;
  readonly status: InterventionRuntimeStatus;
  readonly activeUntilEpochMs?: number;
}

export interface HealthInterventionDecision {
  readonly interventionId: string;
  readonly shouldTrigger: boolean;
  readonly reason?: string;
  readonly message?: string;
  readonly durationSeconds?: number;
  readonly soundConfig?: InterventionSoundConfig;
}

export interface ActiveHealthNotification {
  readonly intervention: HealthIntervention;
  readonly decision: HealthInterventionDecision;
  readonly triggeredAtEpochMs: number;
  readonly remainingSeconds: number;
  readonly taskId: string;
  readonly taskText: string;
  readonly projectName?: string;
}
