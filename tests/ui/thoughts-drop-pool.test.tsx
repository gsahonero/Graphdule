import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThoughtsDropPoolDrawer } from '../../src/ui/components/ThoughtsDropPoolDrawer';
import * as AppContextModule from '../../src/ui/context/AppContext';
import { DroppedThought } from '../../src/domain/models/types';

describe('ThoughtsDropPoolDrawer', () => {
  const addDroppedThoughtMock = vi.fn();
  const deleteDroppedThoughtMock = vi.fn();
  const convertDroppedThoughtMock = vi.fn();
  const updateDroppedThoughtMock = vi.fn();
  const setIsThoughtsPoolOpenMock = vi.fn();

  const sampleThoughts: DroppedThought[] = [
    {
      id: 'thought_1',
      text: 'Remember to run database migrations',
      createdAt: '2026-09-18T12:00:00.000Z',
      updatedAt: '2026-09-18T12:00:00.000Z',
      status: 'inbox',
      projectId: 'proj_1',
      projectName: 'Backend API',
    },
    {
      id: 'thought_2',
      text: 'Note about current task implementation',
      createdAt: '2026-09-18T12:30:00.000Z',
      updatedAt: '2026-09-18T12:30:00.000Z',
      status: 'inbox',
      originTaskId: 'task_xyz',
      originTaskText: 'Write unit tests',
    },
    {
      id: 'thought_3',
      text: 'Call accountant tomorrow',
      createdAt: '2026-09-18T13:00:00.000Z',
      updatedAt: '2026-09-18T13:00:00.000Z',
      status: 'inbox',
    },
    {
      id: 'thought_4',
      text: 'Old converted idea',
      createdAt: '2026-09-18T09:00:00.000Z',
      updatedAt: '2026-09-18T10:00:00.000Z',
      status: 'converted',
      convertedTarget: {
        type: 'standalone_task',
        entityId: 'task_old',
      },
    },
  ];

  const mockContext = {
    isThoughtsPoolOpen: true,
    setIsThoughtsPoolOpen: setIsThoughtsPoolOpenMock,
    droppedThoughts: sampleThoughts,
    addDroppedThought: addDroppedThoughtMock,
    deleteDroppedThought: deleteDroppedThoughtMock,
    convertDroppedThought: convertDroppedThoughtMock,
    updateDroppedThought: updateDroppedThoughtMock,
    activeProjectDoc: null,
    activeWorkSession: null,
    projects: [{ id: 'proj_1', name: 'Backend API' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue(mockContext as any);
  });

  it('renders nothing when isThoughtsPoolOpen is false', () => {
    mockContext.isThoughtsPoolOpen = false;
    const { container } = render(<ThoughtsDropPoolDrawer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders drawer header, active count badge, and inbox cards', () => {
    mockContext.isThoughtsPoolOpen = true;
    render(<ThoughtsDropPoolDrawer />);

    expect(screen.getByRole('dialog', { name: /Thoughts Drop Pool/i })).toBeInTheDocument();
    expect(screen.getByText('3 active')).toBeInTheDocument();
    expect(screen.getByText('Remember to run database migrations')).toBeInTheDocument();
    expect(screen.getByText('Call accountant tomorrow')).toBeInTheDocument();
  });

  it('adds a new thought via the quick drop composer', () => {
    mockContext.isThoughtsPoolOpen = true;
    render(<ThoughtsDropPoolDrawer />);

    const input = screen.getByPlaceholderText(/Drop a thought/i);
    fireEvent.change(input, { target: { value: 'New brilliant thought' } });

    const dropBtn = screen.getByRole('button', { name: /Drop/i });
    fireEvent.click(dropBtn);

    expect(addDroppedThoughtMock).toHaveBeenCalledWith('New brilliant thought', expect.any(Object));
  });

  it('triggers smart 1-click conversion to node when project context exists', () => {
    mockContext.isThoughtsPoolOpen = true;
    render(<ThoughtsDropPoolDrawer />);

    const addNodeBtn = screen.getByRole('button', { name: /\+ Add Node to "Backend API"/i });
    fireEvent.click(addNodeBtn);

    expect(convertDroppedThoughtMock).toHaveBeenCalledWith('thought_1', {
      type: 'node',
      targetId: 'proj_1',
      targetTitle: 'Backend API',
    });
  });

  it('triggers smart 1-click conversion to note when task context exists', () => {
    mockContext.isThoughtsPoolOpen = true;
    render(<ThoughtsDropPoolDrawer />);

    const noteBtn = screen.getByRole('button', { name: /Attach Note to Task/i });
    fireEvent.click(noteBtn);

    expect(convertDroppedThoughtMock).toHaveBeenCalledWith('thought_2', {
      type: 'note',
      targetId: 'task_xyz',
      targetTitle: 'Write unit tests',
    });
  });

  it('triggers smart 1-click conversion to standalone task when global', () => {
    mockContext.isThoughtsPoolOpen = true;
    render(<ThoughtsDropPoolDrawer />);

    const standaloneBtn = screen.getByRole('button', { name: /Make Standalone Task/i });
    fireEvent.click(standaloneBtn);

    expect(convertDroppedThoughtMock).toHaveBeenCalledWith('thought_3', {
      type: 'standalone_task',
    });
  });

  it('switches to processed tab and allows restoring a thought', () => {
    mockContext.isThoughtsPoolOpen = true;
    render(<ThoughtsDropPoolDrawer />);

    const processedTab = screen.getByRole('button', { name: /Processed/i });
    fireEvent.click(processedTab);

    expect(screen.getByText('Old converted idea')).toBeInTheDocument();
    expect(screen.getByText(/Converted to standalone task/i)).toBeInTheDocument();

    const restoreBtn = screen.getByRole('button', { name: /Restore/i });
    fireEvent.click(restoreBtn);

    expect(updateDroppedThoughtMock).toHaveBeenCalledWith('thought_4', {
      status: 'inbox',
      convertedTarget: undefined,
    });
  });
});
