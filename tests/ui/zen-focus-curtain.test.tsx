import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ZenFocusCurtain } from '../../src/ui/components/ZenFocusCurtain';
import * as AppContextModule from '../../src/ui/context/AppContext';

describe('ZenFocusCurtain - Distraction-Free Focus Island', () => {
  const setZenCurtainEnabledMock = vi.fn();
  const addDroppedThoughtMock = vi.fn();
  const setIsThoughtsPoolOpenMock = vi.fn();

  const mockContext = {
    activeWorkSession: {
      taskId: 'task_1',
      taskText: 'Refactor Auth Middleware',
      sessionId: 'sess_1',
      sessionType: 'execution' as const,
      projectId: 'proj_auth',
      projectName: 'Security Project',
      startedAt: new Date().toISOString(),
      accumulatedSecondsBeforeResume: 0,
      isPaused: false,
    },
    activeWorkElapsedSeconds: 900, // 15:00 = 1.0 AU
    attentionUnitMinutes: 15,
    allActiveNodes: [
      {
        id: 'task_1',
        text: 'Refactor Auth Middleware',
        dueDate: '2026-09-20',
        status: 'in_progress',
        estimatedAU: 2,
        createdAt: '2026-09-18T00:00:00.000Z',
        updatedAt: '2026-09-18T00:00:00.000Z',
      },
    ],
    standaloneTasks: [],
    activeProjectDoc: null,
    preferences: {
      zenCurtainEnabled: true,
    },
    setZenCurtainEnabled: setZenCurtainEnabledMock,
    addDroppedThought: addDroppedThoughtMock,
    setIsThoughtsPoolOpen: setIsThoughtsPoolOpenMock,
    formatDateDisplay: (d: string) => d,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue(mockContext as any);
  });

  it('renders nothing when zenCurtainEnabled is false', () => {
    mockContext.preferences.zenCurtainEnabled = false;
    const { container } = render(<ZenFocusCurtain />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Focus Island by default when zenCurtainEnabled is undefined (defaults to true) and has z-40', () => {
    mockContext.preferences.zenCurtainEnabled = undefined as any;
    mockContext.activeWorkSession = {
      ...mockContext.activeWorkSession,
      sessionType: 'execution',
    };
    const { container } = render(<ZenFocusCurtain />);
    expect(screen.getByText('Zen Focus Mode')).toBeInTheDocument();
    const backdrop = container.firstChild as HTMLElement;
    expect(backdrop).toHaveClass('z-40');
  });

  it('renders nothing when activeWorkSession is not execution (e.g. planning or null)', () => {
    mockContext.preferences.zenCurtainEnabled = true;
    mockContext.activeWorkSession = {
      ...mockContext.activeWorkSession,
      sessionType: 'planning' as any,
    };
    const { container } = render(<ZenFocusCurtain />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Focus Island with task name, project context, and AU timer', () => {
    mockContext.preferences.zenCurtainEnabled = true;
    mockContext.activeWorkSession = {
      ...mockContext.activeWorkSession,
      sessionType: 'execution',
    };

    render(<ZenFocusCurtain />);

    expect(screen.getByText('Zen Focus Mode')).toBeInTheDocument();
    expect(screen.getByText('Refactor Auth Middleware')).toBeInTheDocument();
    expect(screen.getByText(/in Security Project/i)).toBeInTheDocument();
    expect(screen.getByText(/1 AU/i)).toBeInTheDocument();
    expect(screen.getByText(/Est: 2 AU/i)).toBeInTheDocument();
  });

  it('submits a quick thought directly to the pool from the focus island', () => {
    mockContext.preferences.zenCurtainEnabled = true;
    render(<ZenFocusCurtain />);

    const input = screen.getByPlaceholderText(/Type and press Enter to drop thought/i);
    fireEvent.change(input, { target: { value: 'Don’t forget refresh token expiry' } });

    const dropBtn = screen.getByRole('button', { name: /Drop/i });
    fireEvent.click(dropBtn);

    expect(addDroppedThoughtMock).toHaveBeenCalledWith(
      'Don’t forget refresh token expiry',
      expect.objectContaining({
        projectId: 'proj_auth',
        originTaskId: 'task_1',
      })
    );
  });

  it('allows holding or clicking peek button to reveal graph', () => {
    mockContext.preferences.zenCurtainEnabled = true;
    render(<ZenFocusCurtain />);

    const peekBtn = screen.getByTitle(/Hold or click to peek at the underlying graph/i);
    fireEvent.mouseDown(peekBtn);
    // When mousedown fires, peek state is entered
    fireEvent.mouseUp(peekBtn);
  });

  it('disables the curtain when minimize button is clicked', () => {
    mockContext.preferences.zenCurtainEnabled = true;
    render(<ZenFocusCurtain />);

    const minBtn = screen.getByTitle(/Disable Zen Curtain/i);
    fireEvent.click(minBtn);

    expect(setZenCurtainEnabledMock).toHaveBeenCalledWith(false);
  });
});
