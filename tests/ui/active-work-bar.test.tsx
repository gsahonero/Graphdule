import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActiveWorkBar } from '../../src/ui/components/ActiveWorkBar';
import { AppContext } from '../../src/ui/context/AppContext';
import {
  requestPictureInPictureWindow,
  syncStylesToPipWindow,
} from '../../src/ui/components/PictureInPicturePortal';

describe('ActiveWorkBar and PictureInPicture', () => {
  const pauseWorkMock = vi.fn();
  const resumeWorkMock = vi.fn();
  const stopWorkMock = vi.fn();
  const completeAndStopWorkMock = vi.fn();
  const openProjectMock = vi.fn();
  const setCurrentViewMock = vi.fn();
  const openWorkSessionsModalMock = vi.fn();

  const baseContextValue: any = {
    activeWorkSession: {
      sessionId: 'sess-1',
      taskId: 'task-1',
      taskText: 'Refactor Graph Layout Engine',
      projectId: 'proj-1',
      projectName: 'Graph Engine',
      startedAt: new Date(Date.now() - 120000).toISOString(),
      isPaused: false,
    },
    activeWorkElapsedSeconds: 120, // 2 mins
    pauseWork: pauseWorkMock,
    resumeWork: resumeWorkMock,
    stopWork: stopWorkMock,
    completeAndStopWork: completeAndStopWorkMock,
    attentionUnitMinutes: 25,
    openProject: openProjectMock,
    setCurrentView: setCurrentViewMock,
    allActiveNodes: [
      {
        id: 'task-1',
        projectId: 'proj-1',
        text: 'Refactor Graph Layout Engine',
        dueDate: '2026-09-12',
        status: 'in_progress',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        estimatedAU: 2,
      },
    ],
    standaloneTasks: [],
    openWorkSessionsModal: openWorkSessionsModalMock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders nothing when activeWorkSession is null', () => {
    const { container } = render(
      <AppContext.Provider value={{ ...baseContextValue, activeWorkSession: null }}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders task name, timer, AU badge, project name and action controls', () => {
    render(
      <AppContext.Provider value={baseContextValue}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    expect(screen.getByText('Refactor Graph Layout Engine')).toBeInTheDocument();
    expect(screen.getByText('Graph Engine')).toBeInTheDocument();
    expect(screen.getByText('02:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByTitle('Mark task completed and stop work session')).toBeInTheDocument();
    expect(screen.getByTitle('Stop work clock without completing task')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open picture-in-picture/i })).toBeInTheDocument();
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });

  it('triggers pauseWork when Pause is clicked', () => {
    render(
      <AppContext.Provider value={baseContextValue}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(pauseWorkMock).toHaveBeenCalledTimes(1);
  });

  it('triggers resumeWork when session is paused and Resume is clicked', () => {
    const pausedContext = {
      ...baseContextValue,
      activeWorkSession: {
        ...baseContextValue.activeWorkSession,
        isPaused: true,
      },
    };

    render(
      <AppContext.Provider value={pausedContext}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    expect(resumeWorkMock).toHaveBeenCalledTimes(1);
  });

  it('triggers completeAndStopWork and stopWork', () => {
    render(
      <AppContext.Provider value={baseContextValue}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    fireEvent.click(screen.getByTitle('Mark task completed and stop work session'));
    expect(completeAndStopWorkMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Stop work clock without completing task'));
    expect(stopWorkMock).toHaveBeenCalledTimes(1);
  });

  it('handles drag and drop repositioning and double-click reset', () => {
    render(
      <AppContext.Provider value={baseContextValue}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    const bar = screen.getByRole('complementary', { name: /active focus work session/i });
    const dragHandle = screen.getByTestId('drag-handle');

    // Simulate pointer drag on the bar
    act(() => {
      fireEvent.pointerDown(bar, { clientX: 100, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(bar, { clientX: 150, clientY: 180, pointerId: 1 });
      fireEvent.pointerUp(bar, { clientX: 150, clientY: 180, pointerId: 1 });
    });

    // Should have saved the moved position
    const saved = localStorage.getItem('graphdule_active_bar_pos');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(typeof parsed.x).toBe('number');
    expect(typeof parsed.y).toBe('number');

    // Reset button should now be visible
    const resetBtn = screen.getByRole('button', { name: /reset bar position/i });
    expect(resetBtn).toBeInTheDocument();

    // Double clicking the drag handle resets position
    act(() => {
      fireEvent.doubleClick(dragHandle);
    });
    expect(localStorage.getItem('graphdule_active_bar_pos')).toBeNull();
  });

  it('supports Picture-in-Picture window opening and closing', async () => {
    // Mock window.open
    const mockClose = vi.fn();
    const mockPipWindow = {
      document: {
        title: '',
        head: { appendChild: vi.fn() },
        body: document.createElement('div'),
        documentElement: { className: '' },
      },
      close: mockClose,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const originalOpen = window.open;
    window.open = vi.fn().mockReturnValue(mockPipWindow);

    render(
      <AppContext.Provider value={baseContextValue}>
        <ActiveWorkBar />
      </AppContext.Provider>
    );

    const pipBtn = screen.getByRole('button', { name: /open picture-in-picture/i });
    await act(async () => {
      fireEvent.click(pipBtn);
    });

    // In-page docked status should now show
    expect(screen.getByText(/focusing in picture-in-picture/i)).toBeInTheDocument();

    // Bring Back button should be present
    const bringBackBtn = screen.getByRole('button', { name: /bring back/i });
    expect(bringBackBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(bringBackBtn);
    });

    expect(mockClose).toHaveBeenCalled();
    // Re-docked
    expect(screen.getByRole('button', { name: /open picture-in-picture/i })).toBeInTheDocument();

    window.open = originalOpen;
  });

  describe('PictureInPicturePortal helper functions', () => {
    it('requestPictureInPictureWindow uses documentPictureInPicture if available', async () => {
      const mockRequestWindow = vi.fn().mockResolvedValue({
        document: {
          title: '',
          head: { appendChild: vi.fn() },
          body: document.createElement('div'),
          documentElement: { className: '' },
        },
        addEventListener: vi.fn(),
      });

      (window as any).documentPictureInPicture = {
        requestWindow: mockRequestWindow,
      };

      const win = await requestPictureInPictureWindow({
        title: 'Test PiP',
        width: 440,
        height: 175,
      });
      expect(mockRequestWindow).toHaveBeenCalledWith({ width: 440, height: 175 });
      expect(win).toBeDefined();

      delete (window as any).documentPictureInPicture;
    });

    it('syncStylesToPipWindow copies stylesheets and theme classes', () => {
      const dummyDoc = document.implementation.createHTMLDocument('PiP Test');
      document.documentElement.className = 'dark custom-theme';

      syncStylesToPipWindow(dummyDoc);
      expect(dummyDoc.documentElement.className).toBe('dark custom-theme');
      expect(dummyDoc.body.className).toContain('bg-slate-950');
    });
  });
});
