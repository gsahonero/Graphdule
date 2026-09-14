import defaultHealthConfigJson from '../../config/health.config.json';
import {
  HealthConfig,
  HealthIntervention,
  HealthFocusContext,
  InterventionRuntimeState,
  HealthInterventionDecision,
  TaskEnvironment,
} from './types';

export const DEFAULT_HEALTH_CONFIG: HealthConfig = defaultHealthConfigJson as unknown as HealthConfig;

export class HealthService {
  /**
   * Checks whether an intervention is applicable to the given task environment.
   * - 'physical': Suppresses screen/eye break reminders (user is away from computer).
   * - 'computer': Applies screen breaks and computer interventions.
   * - 'mixed': Allows computer-related interventions while retaining mixed environment.
   */
  public static isEnvironmentApplicable(
    target: HealthIntervention | TaskEnvironment[] | TaskEnvironment | 'all',
    taskEnv?: TaskEnvironment
  ): boolean {
    const resolvedTaskEnv: TaskEnvironment = taskEnv ? (taskEnv.toLowerCase() as TaskEnvironment) : 'computer';

    const interventionEnv =
      typeof target === 'object' && target !== null && !Array.isArray(target) && 'environment' in target
        ? target.environment
        : target;

    if (interventionEnv === 'all') {
      return true;
    }

    const envList: TaskEnvironment[] = Array.isArray(interventionEnv)
      ? interventionEnv.map((e) => e.toLowerCase() as TaskEnvironment)
      : [interventionEnv.toLowerCase() as TaskEnvironment];

    if (resolvedTaskEnv === 'physical') {
      // Physical tasks only apply interventions that explicitly target 'physical'
      return envList.includes('physical');
    }

    if (resolvedTaskEnv === 'mixed') {
      // Mixed tasks apply if intervention targets 'mixed' or 'computer'
      return envList.includes('mixed') || envList.includes('computer');
    }

    // Default 'computer'
    return envList.includes('computer');
  }

  /**
   * Evaluates an individual health intervention given focus context and runtime state.
   */
  public static evaluateIntervention(
    intervention: HealthIntervention,
    context: HealthFocusContext,
    state?: InterventionRuntimeState,
    soundEnabled: boolean = true
  ): HealthInterventionDecision {
    if (!intervention.enabled) {
      return { interventionId: intervention.id, shouldTrigger: false, reason: 'Intervention disabled' };
    }

    if (context.isPaused) {
      return { interventionId: intervention.id, shouldTrigger: false, reason: 'Session is paused' };
    }

    if (!this.isEnvironmentApplicable(intervention.environment, context.taskEnvironment)) {
      return {
        interventionId: intervention.id,
        shouldTrigger: false,
        reason: `Environment ${context.taskEnvironment || 'computer'} not applicable`,
      };
    }

    const triggerThreshold =
      intervention.trigger.thresholdSeconds ?? intervention.interval;

    // Check if current cycle has already been triggered or handled
    if (state) {
      if (state.status === 'triggered' || state.status === 'active') {
        return {
          interventionId: intervention.id,
          shouldTrigger: false,
          reason: 'Already triggered and awaiting action',
        };
      }

      const lastHandledSeconds = Math.max(
        state.acknowledgedAtSeconds ?? 0,
        state.dismissedAtSeconds ?? 0,
        state.lastTriggeredAtSeconds ?? 0
      );

      // If already triggered or handled, user needs another full interval of continuous duration
      if (lastHandledSeconds > 0) {
        const secondsSinceLastHandled = context.continuousDurationSeconds - lastHandledSeconds;
        if (secondsSinceLastHandled < triggerThreshold) {
          return {
            interventionId: intervention.id,
            shouldTrigger: false,
            reason: `Cooldown active: ${Math.round(triggerThreshold - secondsSinceLastHandled)}s remaining`,
          };
        }
      }
    }

    // Evaluate trigger condition
    if (context.continuousDurationSeconds >= triggerThreshold) {
      const effectiveSound = soundEnabled
        ? intervention.sound
        : { ...intervention.sound, enabled: false };

      return {
        interventionId: intervention.id,
        shouldTrigger: true,
        message: intervention.message,
        durationSeconds: intervention.duration,
        soundConfig: effectiveSound,
      };
    }

    return {
      interventionId: intervention.id,
      shouldTrigger: false,
      reason: `Threshold not reached (${context.continuousDurationSeconds}s < ${triggerThreshold}s)`,
    };
  }

  /**
   * Evaluates all enabled interventions for the active focus session.
   */
  public static evaluateAll(
    config: HealthConfig,
    context: HealthFocusContext,
    states: Record<string, InterventionRuntimeState> = {}
  ): HealthInterventionDecision[] {
    if (!config.enabled) {
      return [];
    }

    const decisions: HealthInterventionDecision[] = [];

    for (const intervention of config.interventions) {
      const state = states[intervention.id];
      const decision = this.evaluateIntervention(intervention, context, state, config.soundEnabled);
      if (decision.shouldTrigger) {
        decisions.push(decision);
      }
    }

    return decisions;
  }

  /**
   * Records acknowledgment for an intervention and returns updated states.
   */
  public static acknowledgeIntervention(
    interventionId: string,
    currentStates: Record<string, InterventionRuntimeState> = {},
    atSeconds: number = 0
  ): Record<string, InterventionRuntimeState> {
    const current = currentStates[interventionId];
    return {
      ...currentStates,
      [interventionId]: {
        interventionId,
        lastTriggeredAtSeconds: current?.lastTriggeredAtSeconds ?? atSeconds,
        acknowledgedAtSeconds: atSeconds,
        status: 'acknowledged',
      },
    };
  }

  /**
   * Records dismissal for an intervention and returns updated states.
   */
  public static dismissIntervention(
    interventionId: string,
    currentStates: Record<string, InterventionRuntimeState> = {},
    atSeconds: number = 0
  ): Record<string, InterventionRuntimeState> {
    const current = currentStates[interventionId];
    return {
      ...currentStates,
      [interventionId]: {
        interventionId,
        lastTriggeredAtSeconds: current?.lastTriggeredAtSeconds ?? atSeconds,
        dismissedAtSeconds: atSeconds,
        status: 'dismissed',
      },
    };
  }

  /**
   * Adds or registers a new intervention into the configuration.
   */
  public static registerIntervention(
    config: HealthConfig,
    intervention: HealthIntervention
  ): HealthConfig {
    const existingIndex = config.interventions.findIndex((i) => i.id === intervention.id);
    let updatedInterventions: HealthIntervention[];

    if (existingIndex >= 0) {
      updatedInterventions = config.interventions.map((item, idx) =>
        idx === existingIndex ? intervention : item
      );
    } else {
      updatedInterventions = [...config.interventions, intervention];
    }

    return {
      ...config,
      interventions: updatedInterventions,
    };
  }

  /**
   * Removes an intervention from the configuration.
   */
  public static removeIntervention(config: HealthConfig, interventionId: string): HealthConfig {
    return {
      ...config,
      interventions: config.interventions.filter((i) => i.id !== interventionId),
    };
  }

  /**
   * Updates fields of an existing intervention.
   */
  public static updateIntervention(
    config: HealthConfig,
    interventionId: string,
    updates: Partial<HealthIntervention>
  ): HealthConfig {
    return {
      ...config,
      interventions: config.interventions.map((item) =>
        item.id === interventionId ? { ...item, ...updates } : item
      ),
    };
  }

  /**
   * Toggles the enabled state of a specific intervention.
   */
  public static toggleIntervention(
    config: HealthConfig,
    interventionId: string,
    enabled: boolean
  ): HealthConfig {
    return this.updateIntervention(config, interventionId, { enabled });
  }

  /**
   * Returns a fresh copy of the default health configuration.
   */
  public static getDefaultConfig(): HealthConfig {
    return JSON.parse(JSON.stringify(DEFAULT_HEALTH_CONFIG));
  }

  /**
   * Alias for registerIntervention to cleanly add a new intervention.
   */
  public static addIntervention(config: HealthConfig, intervention: HealthIntervention): HealthConfig {
    return this.registerIntervention(config, intervention);
  }

  /**
   * Returns a fresh copy of the default health configuration.
   */
  public static resetToDefaults(): HealthConfig {
    return this.getDefaultConfig();
  }
}
