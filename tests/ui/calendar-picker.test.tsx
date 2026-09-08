import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarPicker, CalendarDayTask } from '../../src/ui/components/CalendarPicker';
import { AppContext } from '../../src/ui/context/AppContext';

describe('CalendarPicker - Deadline task counts, completed green balloon, and click panel', () => {
  const onChangeMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTasks: CalendarDayTask[] = [
    // 9 pending tasks on 2026-09-09 + 1 completed task (total 10, pending 9 -> Rose)
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
    // 14 tasks on 2026-09-08, ALL completed (should be GREEN)
    ...Array.from({ length: 14 }, (_, i) => ({
      id: `task-yesterday-${i + 1}`,
      text: `Completed yesterday task ${i + 1}`,
      dueDate: '2026-09-08',
      status: 'completed' as const,
      estimatedAU: 1,
      projectName: 'Daily Routine',
    })),
    // 1 task on 2026-09-15 (pending 1 -> Indigo)
    {
      id: 'task-11',
      text: 'Prepare slide deck for board meeting',
      dueDate: '2026-09-15',
      status: 'planned',
      estimatedAU: 4,
      projectName: 'Executive',
    },
    // 4 tasks on 2026-09-22 (pending 4 -> Amber)
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `task-amber-${i + 1}`,
      text: `Amber task ${i + 1}`,
      dueDate: '2026-09-22',
      status: 'planned' as const,
      estimatedAU: 0.5,
      projectName: 'Design',
    })),
  ];

  it('renders green balloon when all tasks are completed (e.g. 14 completed tasks on 2026-09-08)', () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        customTasks={mockTasks}
      />
    );

    const balloonSept8 = screen.getByTestId('task-balloon-2026-09-08');
    expect(balloonSept8).toBeDefined();
    expect(balloonSept8.textContent).toBe('14');
    // All completed must be green (bg-emerald-500)
    expect(balloonSept8.className).toContain('bg-emerald-500');
  });

  it('renders rose balloon for heavy pending workload (>=6) and amber for moderate (3-5)', () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        customTasks={mockTasks}
      />
    );

    // September 9th has 9 pending tasks -> rose
    const balloonSept9 = screen.getByTestId('task-balloon-2026-09-09');
    expect(balloonSept9.textContent).toBe('10');
    expect(balloonSept9.className).toContain('bg-rose-500');

    // September 22nd has 4 pending tasks -> amber
    const balloonSept22 = screen.getByTestId('task-balloon-2026-09-22');
    expect(balloonSept22.textContent).toBe('4');
    expect(balloonSept22.className).toContain('bg-amber-500');

    // September 15th has 1 pending task -> indigo
    const balloonSept15 = screen.getByTestId('task-balloon-2026-09-15');
    expect(balloonSept15.textContent).toBe('1');
    expect(balloonSept15.className).toContain('bg-indigo-500');
  });

  it('opens workload panel on clicking the balloon and keeps it open for scrolling until closed', async () => {
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

    // Preview should NOT be open yet
    expect(screen.queryByTestId('calendar-workload-preview')).toBeNull();

    // Click the balloon to open panel
    fireEvent.click(balloonSept9);

    // Panel is now open!
    const panel = await screen.findByTestId('calendar-workload-preview');
    expect(panel).toBeDefined();

    // Verify subheader: 9 pending • 1 done
    expect(screen.getByText('9 pending • 1 done')).toBeDefined();
    expect(screen.getByText('13.5 AU')).toBeDefined();

    // Verify task content with respective UAs
    expect(screen.getByText('Finalize quarterly financial report')).toBeDefined();
    expect(screen.getByText('Current')).toBeDefined();
    expect(screen.getByText('Order office ergonomic supplies')).toBeDefined();

    // Close button works
    const closeBtn = screen.getByTestId('close-workload-panel');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('calendar-workload-preview')).toBeNull();
  });

  it('allows clicking "Set as deadline" button inside the panel to select date and close calendar', async () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        customTasks={mockTasks}
      />
    );

    const balloonSept8 = screen.getByTestId('task-balloon-2026-09-08');
    fireEvent.click(balloonSept8);

    const setDeadlineBtn = await screen.findByTestId('select-panel-date');
    fireEvent.click(setDeadlineBtn);

    expect(onChangeMock).toHaveBeenCalledWith('2026-09-08');
    expect(onCloseMock).toHaveBeenCalled();
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

    // Click to open panel
    fireEvent.click(balloonSept20);

    const panel = await screen.findByTestId('calendar-workload-preview');
    expect(panel).toBeDefined();
    expect(screen.getByText('2 tasks')).toBeDefined();
    expect(screen.getByText('4 AU')).toBeDefined();
    expect(screen.getByText('Implement search algorithm')).toBeDefined();
    expect(screen.getByText('Buy groceries')).toBeDefined();
  });

  it('allows clicking the day number directly to select date and close calendar immediately', () => {
    render(
      <CalendarPicker
        value="2026-09-01"
        onChange={onChangeMock}
        onClose={onCloseMock}
        customTasks={mockTasks}
      />
    );

    // Click the day button for the 9th
    const dayBtn = screen.getByText('9');
    fireEvent.click(dayBtn);

    expect(onChangeMock).toHaveBeenCalledWith('2026-09-09');
    expect(onCloseMock).toHaveBeenCalled();
  });
});
