import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyDayView } from '../../src/ui/views/my-day/MyDayView';
import { StandaloneTask } from '../../src/domain/models/types';
import * as AppContextModule from '../../src/ui/context/AppContext';

describe('Standalone Tasks Name Editing and Tooltip in MyDayView', () => {
  const updateStandaloneTaskMock = vi.fn();
  const updateStandaloneTaskStatusMock = vi.fn();
  const deleteStandaloneTaskMock = vi.fn();

  const mockStandaloneTasks: StandaloneTask[] = [
    {
      id: 'st-1',
      text: 'Super very long standalone task name that exceeds normal screen container space and must be truncated',
      dueDate: '2026-09-07',
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'st-2',
      text: 'Short task',
      dueDate: '2026-09-01', // Overdue task
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activeProjectDoc: null,
      projects: [],
      preferences: {
        myDayMode: 'today',
        attentionSystemEnabled: false,
        weeklyPlannedAU: 40,
        attentionUnitMinutes: 15,
        reviewDismissedUntil: null,
      } as any,
      updatePreferences: vi.fn(),
      moveNodeDate: vi.fn(),
      updateNodeStatus: vi.fn(),
      allNodesMap: new Map(),
      allActiveNodes: [],
      projectsMap: new Map(),
      standaloneTasks: mockStandaloneTasks,
      addStandaloneTask: vi.fn(),
      updateStandaloneTask: updateStandaloneTaskMock,
      updateStandaloneTaskStatus: updateStandaloneTaskStatusMock,
      deleteStandaloneTask: deleteStandaloneTaskMock,
      openProject: vi.fn(),
      refreshData: vi.fn(),
      attentionUnitMinutes: 15,
      setIsSyncModalOpen: vi.fn(),
      gcalendarSyncConfig: { enabled: false } as any,
      activityLog: [],
      updateTaskEstimate: vi.fn(),
      activeWorkSession: null,
      activeWorkElapsedSeconds: 0,
      startWork: vi.fn(),
      pauseWork: vi.fn(),
      resumeWork: vi.fn(),
      stopWork: vi.fn(),
      completeAndStopWork: vi.fn(),
      formatDateDisplay: (d: string) => d,
      currentView: 'my_day',
      setCurrentView: vi.fn(),
    } as any);
  });

  it('displays the full task name in title attribute for hovering tooltip', () => {
    render(<MyDayView />);

    const longTaskElement = screen.getByTitle(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    expect(longTaskElement).toBeDefined();
    expect(longTaskElement.tagName.toLowerCase()).toBe('span');
    expect(longTaskElement.className).toContain('truncate');
  });

  it('switches to inline edit mode when clicking on the standalone task name', () => {
    render(<MyDayView />);

    const longTaskElement = screen.getByTitle(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );

    // Click on task name to edit
    fireEvent.click(longTaskElement);

    // An input should now appear with current task text
    const input = screen.getByDisplayValue(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    expect(input).toBeDefined();
  });

  it('saves updated task name on Enter key press', async () => {
    render(<MyDayView />);

    const longTaskElement = screen.getByTitle(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    fireEvent.click(longTaskElement);

    const input = screen.getByDisplayValue(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    fireEvent.change(input, { target: { value: 'Renamed Standalone Task' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(updateStandaloneTaskMock).toHaveBeenCalledTimes(1);
    expect(updateStandaloneTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'st-1',
        text: 'Renamed Standalone Task',
      })
    );
  });

  it('saves updated task name when clicking Save checkmark button', async () => {
    render(<MyDayView />);

    const longTaskElement = screen.getByTitle(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    fireEvent.click(longTaskElement);

    const input = screen.getByDisplayValue(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    fireEvent.change(input, { target: { value: 'Updated via Button' } });

    const saveBtn = screen.getByTitle('Save');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(updateStandaloneTaskMock).toHaveBeenCalledTimes(1);
    expect(updateStandaloneTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'st-1',
        text: 'Updated via Button',
      })
    );
  });

  it('cancels edit without saving on Escape key press', () => {
    render(<MyDayView />);

    const longTaskElement = screen.getByTitle(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    fireEvent.click(longTaskElement);

    const input = screen.getByDisplayValue(
      'Super very long standalone task name that exceeds normal screen container space and must be truncated'
    );
    fireEvent.change(input, { target: { value: 'Abandoned Edit' } });
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    expect(updateStandaloneTaskMock).not.toHaveBeenCalled();
    expect(
      screen.getByTitle(
        'Super very long standalone task name that exceeds normal screen container space and must be truncated'
      )
    ).toBeDefined();
  });
});
