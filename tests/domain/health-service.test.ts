import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthService } from '../../src/domain/health/health-service';
import { HealthSoundService } from '../../src/domain/health/sound';
import { defaultHealthConfig } from '../../src/config';
import {
  HealthConfig,
  HealthFocusContext,
  HealthIntervention,
  InterventionRuntimeState,
} from '../../src/domain/health/types';
import {
  HealthConfigSchema,
  HealthInterventionSchema,
  TaskEnvironmentSchema,
} from '../../src/domain/health/schema';

describe('HealthService Domain & Evaluator', () => {
  let config: HealthConfig;

  beforeEach(() => {
    config = HealthService.getDefaultConfig();
  });

  describe('Environment Applicability', () => {
    it('applies to computer environment for screen break interventions', () => {
      const screenBreak = config.interventions[0];
      expect(HealthService.isEnvironmentApplicable(screenBreak, 'computer')).toBe(true);
      expect(HealthService.isEnvironmentApplicable(screenBreak.environment, 'computer')).toBe(true);
    });

    it('suppresses screen break interventions for physical tasks', () => {
      const screenBreak = config.interventions[0];
      expect(HealthService.isEnvironmentApplicable(screenBreak, 'physical')).toBe(false);
      expect(HealthService.isEnvironmentApplicable(screenBreak.environment, 'physical')).toBe(false);
    });

    it('applies to mixed environment for screen break interventions', () => {
      const screenBreak = config.interventions[0];
      expect(HealthService.isEnvironmentApplicable(screenBreak, 'mixed')).toBe(true);
      expect(HealthService.isEnvironmentApplicable(screenBreak.environment, 'mixed')).toBe(true);
    });

    it('handles interventions configured for any/all environment', () => {
      const allEnvIntervention: HealthIntervention = {
        ...config.interventions[0],
        id: 'posture_check',
        environment: 'all',
      };
      expect(HealthService.isEnvironmentApplicable(allEnvIntervention, 'computer')).toBe(true);
      expect(HealthService.isEnvironmentApplicable(allEnvIntervention, 'physical')).toBe(true);
      expect(HealthService.isEnvironmentApplicable(allEnvIntervention, 'mixed')).toBe(true);
    });
  });

  describe('Continuous Duration Threshold & Triggering', () => {
    it('does not trigger before interval threshold is reached (e.g., 20 mins / 1200s)', () => {
      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Deep coding session',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1199, // 1 second before 20 minutes
        sessionElapsedSeconds: 3000,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(config, context, {});
      expect(decisions).toHaveLength(0);
    });

    it('triggers intervention and sound when interval threshold is reached in computer task', () => {
      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Deep coding session',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1200, // exact 20 minutes
        sessionElapsedSeconds: 1200,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(config, context, {});
      expect(decisions).toHaveLength(1);
      const triggered = decisions[0];
      expect(triggered.interventionId).toBe('screen_break_20_20_20');
      expect(triggered.durationSeconds).toBe(20);
      expect(triggered.soundConfig?.enabled).toBe(true);
      expect(triggered.soundConfig?.type).toBe('subtle_chime');
    });

    it('suppresses trigger when task is in physical environment even after 1200 seconds', () => {
      const context: HealthFocusContext = {
        taskId: 'physical-task-1',
        taskText: 'Running lab assays',
        taskEnvironment: 'physical',
        continuousDurationSeconds: 1500,
        sessionElapsedSeconds: 1500,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(config, context, {});
      expect(decisions).toHaveLength(0);
    });

    it('triggers in mixed environment after 1200 seconds', () => {
      const context: HealthFocusContext = {
        taskId: 'mixed-task-1',
        taskText: 'Whiteboarding and coding',
        taskEnvironment: 'mixed',
        continuousDurationSeconds: 1200,
        sessionElapsedSeconds: 1200,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(config, context, {});
      expect(decisions).toHaveLength(1);
      expect(decisions[0].interventionId).toBe('screen_break_20_20_20');
    });
  });

  describe('Cooldown, Acknowledgment, and Dismissal', () => {
    it('respects cooldown and does not re-trigger during cooldown period', () => {
      const runtime: Record<string, InterventionRuntimeState> = {
        screen_break_20_20_20: {
          interventionId: 'screen_break_20_20_20',
          status: 'acknowledged',
          lastTriggeredAtSeconds: 1200,
          acknowledgedAtSeconds: 1200,
        },
      };

      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Design doc review',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1300, // Only 100s after acknowledgment (< 1200s cooldown)
        sessionElapsedSeconds: 2000,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(config, context, runtime);
      expect(decisions).toHaveLength(0);
    });

    it('re-triggers after cooldown has elapsed and continuous focus remains high', () => {
      const runtime: Record<string, InterventionRuntimeState> = {
        screen_break_20_20_20: {
          interventionId: 'screen_break_20_20_20',
          status: 'idle',
          lastTriggeredAtSeconds: 1200,
          acknowledgedAtSeconds: 1200,
        },
      };

      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Design doc review',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 2405, // 1205s after previous acknowledgment (> 1200s)
        sessionElapsedSeconds: 3000,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(config, context, runtime);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].interventionId).toBe('screen_break_20_20_20');
    });

    it('creates acknowledged runtime state on acknowledgment', () => {
      const updatedRuntime = HealthService.acknowledgeIntervention(
        'screen_break_20_20_20',
        {},
        1200
      );

      expect(updatedRuntime['screen_break_20_20_20'].status).toBe('acknowledged');
      expect(updatedRuntime['screen_break_20_20_20'].acknowledgedAtSeconds).toBe(1200);
    });

    it('creates dismissed runtime state on dismissal', () => {
      const updatedRuntime = HealthService.dismissIntervention(
        'screen_break_20_20_20',
        {},
        1200
      );

      expect(updatedRuntime['screen_break_20_20_20'].status).toBe('dismissed');
      expect(updatedRuntime['screen_break_20_20_20'].dismissedAtSeconds).toBe(1200);
    });
  });

  describe('Global and Per-Intervention Enable Flags', () => {
    it('suppresses all interventions if global enabled is false', () => {
      const disabledConfig: HealthConfig = { ...config, enabled: false };
      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Coding',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 2000,
        sessionElapsedSeconds: 2000,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(disabledConfig, context, {});
      expect(decisions).toHaveLength(0);
    });

    it('suppresses intervention if individually disabled', () => {
      const disabledInterventionConfig = HealthService.toggleIntervention(
        config,
        'screen_break_20_20_20',
        false
      );
      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Coding',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 2000,
        sessionElapsedSeconds: 2000,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(disabledInterventionConfig, context, {});
      expect(decisions).toHaveLength(0);
    });

    it('suppresses sound if global soundEnabled is false', () => {
      const silentConfig: HealthConfig = { ...config, soundEnabled: false };
      const context: HealthFocusContext = {
        taskId: 'task-1',
        taskText: 'Coding',
        taskEnvironment: 'computer',
        continuousDurationSeconds: 1200,
        sessionElapsedSeconds: 1200,
        isPaused: false,
      };

      const decisions = HealthService.evaluateAll(silentConfig, context, {});
      expect(decisions).toHaveLength(1);
      expect(decisions[0].soundConfig?.enabled).toBe(false);
    });
  });

  describe('Modular CRUD for Interventions', () => {
    it('adds a new intervention cleanly', () => {
      const newIntervention: HealthIntervention = {
        id: 'hydration_reminder',
        name: 'Hydration Break',
        enabled: true,
        environment: 'all',
        trigger: {
          type: 'continuous_duration',
          thresholdSeconds: 2700,
        },
        interval: 2700, // 45 mins
        duration: 15,
        message: 'Drink a sip of water.',
        notification: { enabled: true, style: 'subtle' },
        sound: { enabled: true, type: 'gentle_pulse' },
      };

      const updated = HealthService.addIntervention(config, newIntervention);
      expect(updated.interventions).toHaveLength(2);
      expect(updated.interventions[1].id).toBe('hydration_reminder');
      expect(updated.interventions[1].name).toBe('Hydration Break');
    });

    it('updates an existing intervention', () => {
      const updated = HealthService.updateIntervention(config, 'screen_break_20_20_20', {
        interval: 1500, // 25 mins
        sound: { enabled: true, type: 'meditation_bell' },
      });

      const screenBreak = updated.interventions.find((i) => i.id === 'screen_break_20_20_20');
      expect(screenBreak?.interval).toBe(1500);
      expect(screenBreak?.sound.type).toBe('meditation_bell');
    });

    it('removes an intervention by id', () => {
      const updated = HealthService.removeIntervention(config, 'screen_break_20_20_20');
      expect(updated.interventions).toHaveLength(0);
    });

    it('resets configuration to default', () => {
      const modified = HealthService.removeIntervention(config, 'screen_break_20_20_20');
      expect(modified.interventions).toHaveLength(0);

      const restored = HealthService.resetToDefaults();
      expect(restored.interventions).toHaveLength(1);
      expect(restored.interventions[0].id).toBe('screen_break_20_20_20');
    });
  });

  describe('Sound Customization & Synthesis', () => {
    it('provides all expected sound presets', () => {
      const presets = HealthSoundService.getSoundPresets();
      expect(presets).toHaveLength(5);
      const ids = presets.map((p) => p.id);
      expect(ids).toContain('subtle_chime');
      expect(ids).toContain('meditation_bell');
      expect(ids).toContain('gentle_pulse');
      expect(ids).toContain('digital_soft');
      expect(ids).toContain('none');
    });

    it('does not throw when playTone is invoked in node/test environment', async () => {
      const mockOscillator = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      const mockContext = {
        currentTime: 0,
        state: 'running',
        resume: vi.fn().mockResolvedValue(undefined),
        createOscillator: vi.fn().mockReturnValue(mockOscillator),
        createGain: vi.fn().mockReturnValue(mockGain),
        destination: {},
      };

      // @ts-ignore
      globalThis.AudioContext = vi.fn().mockImplementation(() => mockContext);

      await expect(HealthSoundService.playTone('meditation_bell', 0.5)).resolves.not.toThrow();
      expect(mockContext.createOscillator).toHaveBeenCalled();
      expect(mockOscillator.start).toHaveBeenCalled();
    });

    it('resolves immediately for sound preset none', async () => {
      await expect(HealthSoundService.playTone('none', 0.5)).resolves.not.toThrow();
    });
  });

  describe('Zod Validation and Schema Normalization', () => {
    it('normalizes task environments regardless of case', () => {
      expect(TaskEnvironmentSchema.parse('Computer')).toBe('computer');
      expect(TaskEnvironmentSchema.parse('PHYSICAL')).toBe('physical');
      expect(TaskEnvironmentSchema.parse('Mixed')).toBe('mixed');
      expect(TaskEnvironmentSchema.parse('computer')).toBe('computer');
    });

    it('validates defaultHealthConfig matches HealthConfigSchema', () => {
      const parsed = HealthConfigSchema.parse(defaultHealthConfig);
      expect(parsed.version).toBe(1);
      expect(parsed.interventions[0].id).toBe('screen_break_20_20_20');
      expect(parsed.defaultSoundType).toBe('subtle_chime');
    });

    it('rejects invalid interval or negative values', () => {
      expect(() =>
        HealthInterventionSchema.parse({
          id: 'test',
          name: 'Test',
          enabled: true,
          environment: 'computer',
          trigger: { type: 'continuous_duration' },
          interval: -10, // Invalid negative value
          duration: 20,
          message: 'Test',
          notification: { enabled: true },
          sound: { enabled: true },
        })
      ).toThrow();
    });
  });
});
