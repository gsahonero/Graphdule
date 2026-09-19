import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { PlanningInterceptionModal } from '../../src/ui/components/PlanningInterceptionModal';
import * as AppContextModule from '../../src/ui/context/AppContext';

describe('PlanningInterceptionModal - Mindful Speed Bump Guardrail', () => {
  const resolvePlanningInterceptionMock = vi.fn();

  const mockContext = {
    planningInterception: null as any,
    resolvePlanningInterception: resolvePlanningInterceptionMock,
    activeWorkSession: {
      taskId: 'task_1',
      taskText: 'Deep Focus Coding',
      sessionId: 'sess_1',
      sessionType: 'execution' as const,
      startedAt: new Date().toISOString(),
      accumulatedSecondsBeforeResume: 0,
      isPaused: false,
    },
    activeWorkElapsedSeconds: 300, // 5:00
    attentionUnitMinutes: 15,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue(mockContext as any);
  });

  it('renders nothing when planningInterception is null or not open', () => {
    mockContext.planningInterception = null;
    const { container } = render(<PlanningInterceptionModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders guardrail with active task and project context when open', () => {
    mockContext.planningInterception = {
      isOpen: true,
      projectId: 'proj_beta',
      projectName: 'Beta Project',
      reason: 'add_node',
    };

    render(<PlanningInterceptionModal />);

    expect(screen.getByText("You're In Deep Focus!")).toBeInTheDocument();
    expect(screen.getByText('Deep Focus Coding')).toBeInTheDocument();
    expect(screen.getByText(/Beta Project/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your thought/i)).toBeInTheDocument();
  });

  it('drops a thought into the pool and resolves with drop_thought', () => {
    mockContext.planningInterception = {
      isOpen: true,
      projectId: 'proj_beta',
      projectName: 'Beta Project',
    };

    render(<PlanningInterceptionModal />);

    const input = screen.getByPlaceholderText(/Type your thought/i);
    fireEvent.change(input, { target: { value: 'Need to add auth tests' } });

    const dropBtn = screen.getByRole('button', { name: /Drop & Keep Focus/i });
    fireEvent.click(dropBtn);

    expect(resolvePlanningInterceptionMock).toHaveBeenCalledWith('drop_thought', 'Need to add auth tests');
  });

  it('switches to planning mode on conscious user selection', () => {
    mockContext.planningInterception = {
      isOpen: true,
      projectId: 'proj_beta',
      projectName: 'Beta Project',
    };

    render(<PlanningInterceptionModal />);

    const switchBtn = screen.getByRole('button', { name: /Stop Task & Switch to Planning/i });
    fireEvent.click(switchBtn);

    expect(resolvePlanningInterceptionMock).toHaveBeenCalledWith('switch_to_planning');
  });

  it('cancels and returns to work on cancel selection', () => {
    mockContext.planningInterception = {
      isOpen: true,
      projectId: 'proj_beta',
      projectName: 'Beta Project',
    };

    render(<PlanningInterceptionModal />);

    const cancelBtn = screen.getByRole('button', { name: /Cancel \(Return to Work\)/i });
    fireEvent.click(cancelBtn);

    expect(resolvePlanningInterceptionMock).toHaveBeenCalledWith('cancel');
  });
});
