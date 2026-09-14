import { describe, it, expect, beforeEach } from 'vitest';
import { HealthService } from '../../src/domain/health/health-service';
import { AttentionService } from '../../src/domain/services/attention-service';
import { defaultHealthConfig } from '../../src/config';
import {
  HealthConfig,
  HealthFocusContext,
  InterventionRuntimeState,
} from '../../src/domain/health/types';
import { UserPreferencesSchema } from '../../src/domain/models/schema';
import { UserPreferences } from '../../src/domain/models/types';

describe('Health & Focus System Integration', () => {
  let config: HealthConfig;

  beforeEach(() => {
    config = HealthService.getDefaultConfig();
  });

  describe('Focus Session State Transitions & Timer Behavior', () => {
    it('suppresses health interventions when focus session is paused', () => {
      const activeContext: HealthFocusContext = {
        taskId: 'node-1',
        taskText: 'Refactor database schema',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1250, // exceeded 20 mins
        sessionElapsedSeconds: 1250,
        isPaused: true, // Paused!
      };

      const decisions = HealthService.evaluateAll(config, activeContext, {});
      expect(decisions).toHaveLength(0);
    });

    it('triggers immediately when focus session is resumed if threshold is met', () => {
      const activeContext: HealthFocusContext = {
        taskId: 'node-1',
        taskText: 'Refactor database schema',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1250,
        sessionElapsedSeconds: 1250,
        isPaused: false, // Resumed!
      };

      const decisions = HealthService.evaluateAll(config, activeContext, {});
      expect(decisions).toHaveLength(1);
      expect(decisions[0].interventionId).toBe('screen_break_20_20_20');
      expect(decisions[0].shouldTrigger).toBe(true);
    });

    it('switches task environment dynamically from computer to physical', () => {
      // 1. Working on computer task -> triggers at 1200s
      const computerContext: HealthFocusContext = {
        taskId: 'computer-task-1',
        taskText: 'Writing code',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1200,
        sessionElapsedSeconds: 1200,
        isPaused: false,
      };

      let decisions = HealthService.evaluateAll(config, computerContext, {});
      expect(decisions).toHaveLength(1);
      expect(decisions[0].interventionId).toBe('screen_break_20_20_20');

      // 2. User switches to physical task -> screen break is immediately suppressed
      const physicalContext: HealthFocusContext = {
        taskId: 'physical-task-1',
        taskText: 'Lab equipment inspection',
        taskEnvironment: 'physical',
        continuousDurationSeconds: 1200,
        sessionElapsedSeconds: 60,
        isPaused: false,
      };

      decisions = HealthService.evaluateAll(config, physicalContext, {});
      expect(decisions).toHaveLength(0);

      // 3. User switches to mixed task -> screen break is applicable
      const mixedContext: HealthFocusContext = {
        taskId: 'mixed-task-1',
        taskText: 'Hardware prototyping with IDE',
        taskEnvironment: 'mixed',
        continuousDurationSeconds: 1200,
        sessionElapsedSeconds: 60,
        isPaused: false,
      };

      decisions = HealthService.evaluateAll(config, mixedContext, {});
      expect(decisions).toHaveLength(1);
      expect(decisions[0].interventionId).toBe('screen_break_20_20_20');
    });

    it('simulates full rest break cycle: trigger -> rest acknowledgment -> continuous focus reset', () => {
      let continuousSeconds = 1200;
      const context: HealthFocusContext = {
        taskId: 'node-1',
        taskText: 'Writing documentation',
        taskEnvironment: 'computer',
        continuousDurationSeconds: continuousSeconds,
        sessionElapsedSeconds: 1200,
        isPaused: false,
      };

      let runtimeStates: Record<string, InterventionRuntimeState> = {};

      // 1. Timer hits 1200s -> triggers
      const decisions = HealthService.evaluateAll(config, context, runtimeStates);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].interventionId).toBe('screen_break_20_20_20');

      // 2. User takes 20s rest and acknowledges
      runtimeStates = HealthService.acknowledgeIntervention(
        'screen_break_20_20_20',
        runtimeStates,
        continuousSeconds
      );
      expect(runtimeStates['screen_break_20_20_20'].status).toBe('acknowledged');

      // 3. Continuous focus resets to 0 upon taking the rest break
      continuousSeconds = 0;
      const resetContext: HealthFocusContext = {
        ...context,
        continuousDurationSeconds: continuousSeconds,
        sessionElapsedSeconds: 1220,
      };

      const postBreakDecisions = HealthService.evaluateAll(config, resetContext, runtimeStates);
      expect(postBreakDecisions).toHaveLength(0);
    });
  });

  describe('Attention Unit (AU) Model Integrity & Independence', () => {
    it('ensures AU calculation is strictly dependent on work session duration and auMinutes only', () => {
      const auMinutes = 15;

      // 15 mins = 1.0 AU
      expect(AttentionService.durationSecondsToAU(15 * 60, auMinutes)).toBe(1.0);
      // 30 mins = 2.0 AU
      expect(AttentionService.durationSecondsToAU(30 * 60, auMinutes)).toBe(2.0);
      // 20 mins = 1.33 AU
      expect(AttentionService.durationSecondsToAU(20 * 60, auMinutes)).toBe(1.33);
    });

    it('proves that health interventions and rest breaks do not alter or inflate AU metrics', () => {
      const auMinutes = 15;
      const initialDurationSeconds = 1800; // 30 minutes of focus = 2.0 AU
      const expectedAU = AttentionService.durationSecondsToAU(initialDurationSeconds, auMinutes);
      expect(expectedAU).toBe(2.0);

      // Trigger health intervention
      const context: HealthFocusContext = {
        taskId: 'node-1',
        taskText: 'Core Architecture',
        taskEnvironment: 'computer',
        continuousDurationSeconds: initialDurationSeconds,
        sessionElapsedSeconds: initialDurationSeconds,
        isPaused: false,
        currentAU: expectedAU,
      };

      const decisions = HealthService.evaluateAll(config, context, {});
      expect(decisions).toHaveLength(1);

      // Acknowledging or taking a 20s health break operates on isolated health state:
      const updatedRuntime = HealthService.acknowledgeIntervention(
        'screen_break_20_20_20',
        {},
        initialDurationSeconds
      );

      // Verify AU metrics remain strictly 2.0 AU
      const recheckedAU = AttentionService.durationSecondsToAU(initialDurationSeconds, auMinutes);
      expect(recheckedAU).toBe(expectedAU);
      expect(recheckedAU).toBe(2.0);

      // Format AU produces consistent output regardless of health state
      expect(AttentionService.formatAU(expectedAU, auMinutes)).toBe('2 AU (30m)');
      expect(updatedRuntime['screen_break_20_20_20'].status).toBe('acknowledged');
    });
  });

  describe('Preferences Persistence & Schema Compatibility', () => {
    it('round-trips custom healthConfig through UserPreferencesSchema', () => {
      const customConfig: HealthConfig = {
        version: 1,
        enabled: true,
        soundEnabled: true,
        globalVolume: 0.6,
        defaultSoundType: 'meditation_bell',
        defaultEnvironment: 'mixed',
        interventions: [
          {
            id: 'posture_alert',
            name: 'Posture Reset',
            enabled: true,
            environment: 'all',
            trigger: { type: 'continuous_duration', thresholdSeconds: 1800 },
            interval: 1800,
            duration: 30,
            message: 'Sit up straight and roll your shoulders.',
            notification: { enabled: true, style: 'banner' },
            sound: { enabled: true, type: 'meditation_bell', volume: 0.6 },
          },
        ],
      };

      const mockPreferences: UserPreferences = {
        theme: 'dark',
        dateFormat: 'DD/MM/YYYY',
        attentionSystemEnabled: true,
        attentionUnitMinutes: 15,
        myDayMode: 'today',
        onboardingCompleted: true,
        preferredStorageProvider: 'browser',
        healthConfig: customConfig,
      };

      const parsed = UserPreferencesSchema.parse(mockPreferences);
      expect(parsed.healthConfig).toBeDefined();
      expect(parsed.healthConfig?.globalVolume).toBe(0.6);
      expect(parsed.healthConfig?.defaultSoundType).toBe('meditation_bell');
      expect(parsed.healthConfig?.defaultEnvironment).toBe('mixed');
      expect(parsed.healthConfig?.interventions[0].id).toBe('posture_alert');
      expect(parsed.healthConfig?.interventions[0].duration).toBe(30);
    });

    it('defaults gracefully when preferences do not yet have healthConfig', () => {
      const legacyPreferences = {
        theme: 'light',
        dateFormat: 'DD/MM/YYYY',
        attentionSystemEnabled: false,
        attentionUnitMinutes: 15,
      };

      const parsed = UserPreferencesSchema.parse(legacyPreferences);
      expect(parsed.healthConfig).toBeUndefined();

      // Application falls back to defaultHealthConfig
      const resolvedConfig = parsed.healthConfig || defaultHealthConfig;
      expect(resolvedConfig.interventions[0].id).toBe('screen_break_20_20_20');
      expect(resolvedConfig.enabled).toBe(true);
    });
  });
});
