import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HealthConfigModal } from '../../src/ui/components/HealthConfigModal';
import { ActiveWorkBar } from '../../src/ui/components/ActiveWorkBar';
import { AppContext } from '../../src/ui/context/AppContext';
import { defaultHealthConfig } from '../../src/config';
import { HealthConfig, ActiveHealthNotification } from '../../src/domain/health/types';

describe('Health UI Components: HealthConfigModal & ActiveWorkBar', () => {
  const updateHealthConfigMock = vi.fn();
  const acknowledgeHealthInterventionMock = vi.fn();
  const dismissHealthInterventionMock = vi.fn();
  const setIsHealthConfigModalOpenMock = vi.fn();

  const mockHealthConfig: HealthConfig = { ...defaultHealthConfig };

  const baseContextValue: any = {
    healthConfig: mockHealthConfig,
    isHealthConfigModalOpen: true,
    setIsHealthConfigModalOpen: setIsHealthConfigModalOpenMock,
    updateHealthConfig: updateHealthConfigMock,
    activeHealthNotification: null,
    acknowledgeHealthIntervention: acknowledgeHealthInterventionMock,
    dismissHealthIntervention: dismissHealthInterventionMock,
    activeWorkSession: {
      sessionId: 'sess-1',
      taskId: 'task-1',
      taskText: 'Deep Focus Coding',
      projectId: 'proj-1',
      projectName: 'Core Engine',
      startedAt: new Date(Date.now() - 120000).toISOString(),
      isPaused: false,
    },
    activeWorkElapsedSeconds: 120,
    allActiveNodes: [
      {
        id: 'task-1',
        projectId: 'proj-1',
        text: 'Deep Focus Coding',
        dueDate: '2026-09-14',
        status: 'in_progress',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        environment: 'computer',
      },
    ],
    standaloneTasks: [],
    pauseWork: vi.fn(),
    resumeWork: vi.fn(),
    stopWork: vi.fn(),
    completeAndStopWork: vi.fn(),
    openWorkSessionsModal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HealthConfigModal', () => {
    it('renders modal with title, tabs, and interventions list', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      expect(screen.getByText('Health & Focus')).toBeInTheDocument();
      expect(screen.getByTestId('health-master-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('health-sound-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('tab-interventions')).toBeInTheDocument();
      expect(screen.getByTestId('tab-sound')).toBeInTheDocument();
      expect(screen.getByTestId('tab-add')).toBeInTheDocument();
      expect(screen.getByText('20-20-20 Screen Break')).toBeInTheDocument();
    });

    it('toggles global health system switch', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      const masterToggle = screen.getByTestId('health-master-toggle');
      fireEvent.click(masterToggle);

      expect(updateHealthConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('navigates to Sound tab and allows changing sound preset and volume slider', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      // Switch to Sound tab
      fireEvent.click(screen.getByTestId('tab-sound'));

      expect(screen.getByText('Audio & Synthesizer Settings')).toBeInTheDocument();

      // Change preset by clicking Meditation Bell option
      const meditationBellBtn = screen.getByText('Meditation Bell');
      fireEvent.click(meditationBellBtn);

      expect(updateHealthConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ defaultSoundType: 'meditation_bell' })
      );

      // Change volume slider
      const volumeSlider = screen.getByRole('slider');
      fireEvent.change(volumeSlider, { target: { value: '0.8' } });

      expect(updateHealthConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({ globalVolume: 0.8 })
      );
    });

    it('triggers sound preview on Test button click without error', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      // Switch to Sound tab
      fireEvent.click(screen.getByTestId('tab-sound'));

      const testBtn = screen.getByRole('button', { name: /test sound preview/i });
      expect(testBtn).toBeInTheDocument();

      act(() => {
        fireEvent.click(testBtn);
      });
    });

    it('toggles individual intervention enabled state in list', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      const toggleButtons = screen.getAllByRole('button');
      // Find the toggle button inside the intervention card
      const interventionToggle = toggleButtons.find((btn) =>
        btn.className.includes('rounded-full') && btn.getAttribute('data-testid') !== 'health-master-toggle'
      );
      expect(interventionToggle).toBeDefined();

      if (interventionToggle) {
        fireEvent.click(interventionToggle);
        expect(updateHealthConfigMock).toHaveBeenCalledWith(
          expect.objectContaining({
            interventions: expect.arrayContaining([
              expect.objectContaining({
                id: 'screen_break_20_20_20',
                enabled: false,
              }),
            ]),
          })
        );
      }
    });

    it('switches to New tab and populates from preset', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      fireEvent.click(screen.getByTestId('tab-add'));

      expect(screen.getByText('Quick Fill from Preset:')).toBeInTheDocument();

      // Quick preset fill: Posture Check
      const posturePresetBtn = screen.getByText('🪑 Posture Check');
      fireEvent.click(posturePresetBtn);

      expect(screen.getByDisplayValue('Posture & Shoulder Check')).toBeInTheDocument();
    });

    it('resets configuration to defaults on button click', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <HealthConfigModal />
        </AppContext.Provider>
      );

      const resetBtn = screen.getByTitle('Reset health settings to default');
      fireEvent.click(resetBtn);

      expect(updateHealthConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          interventions: expect.arrayContaining([
            expect.objectContaining({ id: 'screen_break_20_20_20' }),
          ]),
        })
      );
    });
  });

  describe('ActiveWorkBar Environment & Health Notification Integration', () => {
    it('displays computer environment badge for computer task', () => {
      render(
        <AppContext.Provider value={baseContextValue}>
          <ActiveWorkBar />
        </AppContext.Provider>
      );

      const badge = screen.getByTestId('workbar-environment-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', 'Task Environment: computer');
      expect(badge).toHaveTextContent('computer');
    });

    it('displays physical environment badge when task environment is physical', () => {
      const physicalContext = {
        ...baseContextValue,
        allActiveNodes: [
          {
            ...baseContextValue.allActiveNodes[0],
            environment: 'physical',
          },
        ],
      };

      render(
        <AppContext.Provider value={physicalContext}>
          <ActiveWorkBar />
        </AppContext.Provider>
      );

      const badge = screen.getByTestId('workbar-environment-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', 'Task Environment: physical');
      expect(badge).toHaveTextContent('physical');
    });

    it('displays mixed environment badge when task environment is mixed', () => {
      const mixedContext = {
        ...baseContextValue,
        allActiveNodes: [
          {
            ...baseContextValue.allActiveNodes[0],
            environment: 'mixed',
          },
        ],
      };

      render(
        <AppContext.Provider value={mixedContext}>
          <ActiveWorkBar />
        </AppContext.Provider>
      );

      const badge = screen.getByTestId('workbar-environment-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', 'Task Environment: mixed');
      expect(badge).toHaveTextContent('mixed');
    });

    it('displays health notification banner and triggers Rest acknowledgment or Dismiss', () => {
      const activeNotification: ActiveHealthNotification = {
        taskId: 'task-1',
        taskText: 'Deep Focus Coding',
        intervention: mockHealthConfig.interventions[0],
        decision: {
          interventionId: 'screen_break_20_20_20',
          shouldTrigger: true,
          message: 'Look at something 20 feet away for 20 seconds.',
          durationSeconds: 20,
        },
        triggeredAtEpochMs: Date.now(),
        remainingSeconds: 20,
      };

      const notificationContext = {
        ...baseContextValue,
        activeHealthNotification: activeNotification,
      };

      render(
        <AppContext.Provider value={notificationContext}>
          <ActiveWorkBar />
        </AppContext.Provider>
      );

      // Notification banner displayed
      const banner = screen.getByTestId('active-health-notification-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('20-20-20 Screen Break');
      expect(banner).toHaveTextContent('Look at something 20 feet away for 20 seconds');

      // Rest button displayed
      const restBtn = screen.getByTestId('health-acknowledge-btn');
      expect(restBtn).toBeInTheDocument();
      expect(restBtn).toHaveTextContent('Rest (20s)');

      fireEvent.click(restBtn);
      expect(acknowledgeHealthInterventionMock).toHaveBeenCalledWith('screen_break_20_20_20');

      // Dismiss button displayed
      const dismissBtn = screen.getByTestId('health-dismiss-btn');
      expect(dismissBtn).toBeInTheDocument();

      fireEvent.click(dismissBtn);
      expect(dismissHealthInterventionMock).toHaveBeenCalledWith('screen_break_20_20_20');
    });
  });
});
