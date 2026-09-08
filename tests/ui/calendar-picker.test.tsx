import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarPicker, CalendarDayTask } from '../../src/ui/components/CalendarPicker';
import { AppContext } from '../../src/ui/context/AppContext';

describe('CalendarPicker - Deadline task counts and hover preview balloon', () => {
  const onChangeMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTasks: CalendarDayTask[] = [
    {
      id: 'task-1',
      text: 'Finalize quarterly financial report',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 2,
      projectName: 'Q3 Finance',
    },
    {
      id: 'task-2',
      text: 'Audit vendor invoices',
      dueDate: '2026-09-09',
      status: 'in_progress',
      estimatedAU: 1.5,
      projectName: 'Q3 Finance',
    },
    {
      id: 'task-3',
      text: 'Review pull request #42',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 0.5,
      projectName: 'Core Platform',
    },
    {
      id: 'task-4',
      text: 'Deploy hotfix to staging',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 1,
      projectName: 'Core Platform',
    },
    {
      id: 'task-5',
      text: 'Draft architecture RFC for v2',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 3,
      projectName: 'Core Platform',
    },
    {
      id: 'task-6',
      text: 'Conduct sprint retrospective',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 1.5,
      projectName: 'Operations',
    },
    {
      id: 'task-7',
      text: 'Update security certificates',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 1,
      projectName: 'Operations',
    },
    {
      id: 'task-8',
      text: 'Customer onboarding kickoff call',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 2,
      projectName: 'Sales',
    },
    {
      id: 'task-9',
      text: 'Review contract terms with legal',
      dueDate: '2026-09-09',
      status: 'planned',
      estimatedAU: 1,
      projectName: 'Legal',
    },
    {
      id: 'task-10',
      text: 'Order office ergonomic supplies',
      dueDate: '2026-09-09',
      status: 'completed',
      estimatedAU: 0.5,
      isStandalone: true,
      projectName: 'Standalone',
    },
    {
      id: 'task-11',
      text: 'Prepare slide deck for board meeting',
      dueDate: '2026-09-15',
      status: 'planned',
      estimatedAU: 4,
      projectName: 'Executive',
    },
  ];

  it('renders a workload balloon badge with the exact number of tasks (e.g. 10) on a date', () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        customTasks={mockTasks}
      />
    );

    // Look for balloon on September 9th (10 tasks)
    const balloonSept9 = screen.getByTestId('task-balloon-2026-09-09');
    expect(balloonSept9).toBeDefined();
    expect(balloonSept9.textContent).toBe('10');

    // Look for balloon on September 15th (1 task)
    const balloonSept15 = screen.getByTestId('task-balloon-2026-09-15');
    expect(balloonSept15).toBeDefined();
    expect(balloonSept15.textContent).toBe('1');

    // Day without tasks (e.g. Sept 10) should not have a balloon
    expect(screen.queryByTestId('task-balloon-2026-09-10')).toBeNull();
  });

  it('displays hover preview with task titles, projects, and respective UAs when hovering the balloon', async () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        currentTaskId="task-1"
        customTasks={mockTasks}
      />
    );

    const balloonSept9 = screen.getByTestId('task-balloon-2026-09-09');

    // Hover over the balloon
    fireEvent.mouseEnter(balloonSept9);

    // Preview popover should appear
    const preview = await screen.findByTestId('calendar-workload-preview');
    expect(preview).toBeDefined();

    // Verify header contents (10 tasks, total AU = 14 AU)
    expect(screen.getByText('10 tasks')).toBeDefined();
    expect(screen.getByText('14 AU')).toBeDefined();

    // Verify task items with their respective UAs
    expect(screen.getByText('Finalize quarterly financial report')).toBeDefined();
    expect(screen.getAllByText('2 AU').length).toBe(2);
    expect(screen.getAllByText('Q3 Finance').length).toBe(2);

    // Verify "Current" indicator for currentTaskId
    expect(screen.getByText('Current')).toBeDefined();

    // Verify completed task
    expect(screen.getByText('Order office ergonomic supplies')).toBeDefined();
    expect(screen.getByText('Standalone')).toBeDefined();
  });

  it('consumes tasks from AppContext when customTasks is not provided', async () => {
    const mockAppContextValue = {
      projects: [{ id: 'p1', name: 'Project Alpha' }],
      allActiveNodes: [
        {
          id: 'node-1',
          text: 'Implement search algorithm',
          dueDate: '2026-09-20',
          status: 'planned',
          estimatedAU: 3,
          projectId: 'p1',
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
      ],
      activeProjectDoc: null,
      standaloneTasks: [
        {
          id: 'st-1',
          text: 'Buy groceries',
          dueDate: '2026-09-20',
          status: 'planned',
          estimatedAU: 1,
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        },
      ],
      formatDateDisplay: (d: string) => d,
    } as any;

    render(
      <AppContext.Provider value={mockAppContextValue}>
        <CalendarPicker
          value="2026-09-01"
          onChange={onChangeMock}
          onClose={onCloseMock}
        />
      </AppContext.Provider>
    );

    const balloonSept20 = screen.getByTestId('task-balloon-2026-09-20');
    expect(balloonSept20).toBeDefined();
    expect(balloonSept20.textContent).toBe('2');

    // Hover over balloon
    fireEvent.mouseEnter(balloonSept20);

    const preview = await screen.findByTestId('calendar-workload-preview');
    expect(preview).toBeDefined();
    expect(screen.getByText('2 tasks')).toBeDefined();
    expect(screen.getByText('4 AU')).toBeDefined();
    expect(screen.getByText('Implement search algorithm')).toBeDefined();
    expect(screen.getByText('Buy groceries')).toBeDefined();
  });

  it('allows clicking the day button or the balloon to select date and close calendar', () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        customTasks={mockTasks}
      />
    );

    const balloonSept9 = screen.getByTestId('task-balloon-2026-09-09');
    fireEvent.click(balloonSept9);

    expect(onChangeMock).toHaveBeenCalledWith('2026-09-09');
    expect(onCloseMock).toHaveBeenCalled();
  });
});
