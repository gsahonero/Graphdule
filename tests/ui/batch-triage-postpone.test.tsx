import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MyDayView } from '../../src/ui/views/my-day/MyDayView';
import { Node, StandaloneTask, ProjectSummary } from '../../src/domain/models/types';
import * as AppContextModule from '../../src/ui/context/AppContext';

describe('MyDayView - Batch Triage & Postpone Integration', () => {
  const batchMoveDatesMock = vi.fn().mockResolvedValue(undefined);
  const moveNodeDateMock = vi.fn().mockResolvedValue(undefined);
  const refreshDataMock = vi.fn().mockResolvedValue(undefined);

  const lateNode1: Node = {
    id: 'node-late-1',
    projectId: 'proj-1',
    text: 'Overdue Project Task 1',
    dueDate: '2026-09-01',
    status: 'planned',
    position: { x: 0, y: 0 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const lateNode2: Node = {
    id: 'node-late-2',
    projectId: 'proj-1',
    text: 'Overdue Project Task 2',
    dueDate: '2026-09-02',
    status: 'planned',
    position: { x: 0, y: 0 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const lateStandalone: StandaloneTask = {
    id: 'st-late-1',
    text: 'Overdue Standalone Task',
    dueDate: '2026-09-03',
    status: 'planned',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const mockProject: ProjectSummary = {
    id: 'proj-1',
    name: 'Apollo Project',
    endGoalText: 'Reach the moon',
    deadline: '2026-12-31',
    tags: [],
    status: 'active',
    isArchived: false,
    isParked: false,
    isAttention: false,
    progressPercentage: 0,
    activeTaskCount: 2,
    totalTaskCount: 2,
    completedTaskCount: 0,
    abandonedTaskCount: 0,
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activeProjectDoc: null,
      projects: [mockProject],
      preferences: {
        myDayMode: 'today',
        attentionSystemEnabled: false,
        weeklyPlannedAU: 40,
        attentionUnitMinutes: 15,
        reviewDismissedUntil: null,
      } as any,
      updatePreferences: vi.fn(),
      moveNodeDate: moveNodeDateMock,
      batchMoveDates: batchMoveDatesMock,
      updateNodeStatus: vi.fn(),
      allNodesMap: new Map([
        ['node-late-1', lateNode1],
        ['node-late-2', lateNode2],
      ]),
      allActiveNodes: [lateNode1, lateNode2],
      projectsMap: new Map([['proj-1', mockProject]]),
      standaloneTasks: [lateStandalone],
      addStandaloneTask: vi.fn(),
      updateStandaloneTask: vi.fn(),
      updateStandaloneTaskStatus: vi.fn(),
      deleteStandaloneTask: vi.fn(),
      openProject: vi.fn(),
      refreshData: refreshDataMock,
      attentionUnitMinutes: 15,
      setIsSyncModalOpen: vi.fn(),
      gcalendarSyncConfig: { enabled: false } as any,
      activityLog: [],
      updateTaskEstimate: vi.fn(),
      openWorkSessionsModal: vi.fn(),
      activeWorkSession: null,
      formatDateDisplay: (d: string) => d,
    } as any);
  });

  it('opens triage modal and delegates batch reschedule via batchMoveDates without individual moveNodeDate calls', async () => {
    render(<MyDayView />);

    // Find and click the Triage Overdue button
    const triageBtn = screen.getByTitle(/Open triage modal to postpone overdue tasks/i);
    expect(triageBtn).toBeInTheDocument();
    fireEvent.click(triageBtn);

    // Modal should be visible
    expect(screen.getByText(/Triage 3 Overdue Tasks/i)).toBeInTheDocument();

    // Select Tomorrow preset (already default) and click Apply Reschedule
    const applyBtn = screen.getByText('Apply Reschedule');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(batchMoveDatesMock).toHaveBeenCalledTimes(1);
    });

    const [items, newDate, cascade] = batchMoveDatesMock.mock.calls[0];
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'node-late-1', isStandalone: false, projectId: 'proj-1' }),
        expect.objectContaining({ id: 'node-late-2', isStandalone: false, projectId: 'proj-1' }),
        expect.objectContaining({ id: 'st-late-1', isStandalone: true, projectId: 'standalone' }),
      ])
    );
    expect(newDate).toBeDefined();
    expect(cascade).toBe(true); // Checkbox defaults to true

    // Ensure moveNodeDate was NOT called directly (which caused sequential modals)
    expect(moveNodeDateMock).not.toHaveBeenCalled();
  });
});
