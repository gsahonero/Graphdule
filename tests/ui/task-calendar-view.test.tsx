import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCalendarView } from '../../src/ui/views/calendar/TaskCalendarView';
import { AppContext } from '../../src/ui/context/AppContext';
import { DailyCapacityConfig, Node, StandaloneTask, ProjectSummary } from '../../src/domain/models/types';

describe('TaskCalendarView - Dedicated Full Task Calendar', () => {
  const moveNodeDateMock = vi.fn();
  const updateNodeMock = vi.fn();
  const updateStandaloneTaskMock = vi.fn();
  const addStandaloneTaskMock = vi.fn();
  const deleteStandaloneTaskMock = vi.fn();
  const deleteNodeMock = vi.fn();
  const openProjectMock = vi.fn();
  const setDailyCapacityOverrideMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCapacityConfig: DailyCapacityConfig = {
    isConfigured: true,
    weekdayDefaults: {
      1: 20, // Monday: 20 AU
      2: 20,
      3: 20,
      4: 20,
      5: 20,
      6: 8,
      0: 8,
    },
    manualOverrides: {},
    calendarInference: {
      enabled: false,
      minutesPerAU: 15,
      workSchedule: {
        startHour: 9,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
        workDays: [1, 2, 3, 4, 5],
      },
    },
  };

  const mockProjects: ProjectSummary[] = [
    {
      id: 'proj-1',
      name: 'Alpha Project',
      status: 'active',
      style: { color: 'emerald', icon: 'rocket' },
    } as any,
    {
      id: 'proj-2',
      name: 'Beta Project',
      status: 'active',
      style: { color: 'teal', icon: 'code' },
    } as any,
  ];

  const mockActiveNodes: Node[] = [
    {
      id: 'node-1',
      text: 'Design database schema',
      dueDate: '2026-09-07', // Monday
      status: 'planned',
      estimatedAU: 10,
      projectId: 'proj-1',
      position: { x: 0, y: 0 },
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'node-2',
      text: 'Build backend API',
      dueDate: '2026-09-07', // Monday (10 + 6 = 16 AU total on Mon Sep 7)
      status: 'in_progress',
      estimatedAU: 6,
      projectId: 'proj-1',
      position: { x: 100, y: 0 },
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'node-3',
      text: 'Massive migration refactor',
      dueDate: '2026-09-08', // Tuesday (26 AU on 20 AU capacity -> Overloaded!)
      status: 'planned',
      estimatedAU: 26,
      projectId: 'proj-2',
      position: { x: 200, y: 0 },
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ];

  const mockStandaloneTasks: StandaloneTask[] = [
    {
      id: 'st-1',
      text: 'Submit tax reports',
      dueDate: '2026-09-09', // Wednesday
      status: 'planned',
      estimatedAU: 4,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ];

  const createMockContext = (overrides?: Partial<any>) => ({
    allActiveNodes: mockActiveNodes,
    activeProjectDoc: null,
    standaloneTasks: mockStandaloneTasks,
    projects: mockProjects,
    capacityConfig: mockCapacityConfig,
    capacitySnapshots: [],
    moveNodeDate: moveNodeDateMock,
    updateNode: updateNodeMock,
    updateStandaloneTask: updateStandaloneTaskMock,
    addStandaloneTask: addStandaloneTaskMock,
    deleteStandaloneTask: deleteStandaloneTaskMock,
    deleteNode: deleteNodeMock,
    openProject: openProjectMock,
    setDailyCapacityOverride: setDailyCapacityOverrideMock,
    formatDateDisplay: (d: string) => d,
    ...overrides,
  });

  it('renders Month view by default with weekday headers and task titles', () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Weekday headers
    expect(screen.getByText('Mon')).toBeDefined();
    expect(screen.getByText('Sun')).toBeDefined();

    // View mode switch buttons
    expect(screen.getByTestId('view-mode-month')).toBeDefined();
    expect(screen.getByTestId('view-mode-week')).toBeDefined();
    expect(screen.getByTestId('view-mode-day')).toBeDefined();

    // Verify Graphdule tasks are rendered
    expect(screen.getByText('Design database schema')).toBeDefined();
    expect(screen.getByText('Build backend API')).toBeDefined();
    expect(screen.getByText('Massive migration refactor')).toBeDefined();
    expect(screen.getByText('Submit tax reports')).toBeDefined();
  });

  it('strictly renders only Graphdule tasks and does not show external Google Calendar events', () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Make sure random Google calendar events are not present
    expect(screen.queryByText(/Google Meet/i)).toBeNull();
    expect(screen.queryByText(/Doctor Appointment/i)).toBeNull();

    // Standalone and project tasks are present
    expect(screen.getByText('Submit tax reports')).toBeDefined();
    expect(screen.getByText('Design database schema')).toBeDefined();
  });

  it('prominently displays AU Workload Reality Checks and overcapacity warning', () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Monday Sep 7: 16 / 20 AU planned (within capacity)
    expect(screen.getByText('16/20 AU')).toBeDefined();

    // Tuesday Sep 8: 26 / 20 AU planned -> Overloaded (+6 AU overcapacity)
    const overcapacityBadge = screen.getByText('26/20 AU');
    expect(overcapacityBadge).toBeDefined();
  });

  it('allows switching seamlessly between Month, Week, and Day views', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Switch to Week view
    const weekButton = screen.getByTestId('view-mode-week');
    fireEvent.click(weekButton);

    // In Week view, Monday, Tuesday, etc. column headers appear
    expect(await screen.findByText('Mon')).toBeDefined();
    expect(screen.getByText('Tue')).toBeDefined();
    expect(screen.getByText('Wed')).toBeDefined();

    // Switch to Day view
    const dayButton = screen.getByTestId('view-mode-day');
    fireEvent.click(dayButton);

    // In Day view, Daily AU Capacity & Reality Check dashboard appears
    expect(await screen.findByText(/Daily AU Capacity & Reality Check/i)).toBeDefined();
    expect(screen.getByText(/Scheduled Tasks/i)).toBeDefined();
  });

  it('navigates dates with Next, Previous, and Today buttons', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Switch to Day view
    fireEvent.click(screen.getByTestId('view-mode-day'));

    const nextBtn = screen.getByTitle('Next period');
    fireEvent.click(nextBtn);

    const todayBtn = screen.getByTestId('calendar-today-btn');
    fireEvent.click(todayBtn);

    expect(screen.getByText(/Daily AU Capacity & Reality Check/i)).toBeDefined();
  });

  it('allows toggling task completion status', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Find completion button for 'Design database schema'
    const toggleButtons = screen.getAllByRole('button', { name: /mark task complete/i });
    expect(toggleButtons.length).toBeGreaterThan(0);

    // Click the first one (node-1)
    fireEvent.click(toggleButtons[0]);

    expect(updateNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'node-1',
        status: 'completed',
      })
    );
  });

  it('supports drag-and-drop task rescheduling to another day cell', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Find draggable task
    const taskTitle = screen.getByText('Design database schema');
    const draggableCard = taskTitle.closest('[draggable="true"]');
    expect(draggableCard).toBeDefined();

    // Trigger dragstart
    const setDataMock = vi.fn();
    fireEvent.dragStart(draggableCard!, {
      dataTransfer: {
        setData: setDataMock,
        effectAllowed: 'move',
      },
    });

    expect(setDataMock).toHaveBeenCalledWith('text/plain', 'node-1');

    // Simulate drop on Sept 10 cell
    const targetCell = screen.getByText('10').closest('.group\\/cell');
    expect(targetCell).toBeDefined();

    fireEvent.drop(targetCell!, {
      dataTransfer: {
        getData: (format: string) => (format === 'text/plain' ? 'node-1' : ''),
      },
    });

    await waitFor(() => {
      expect(moveNodeDateMock).toHaveBeenCalledWith('node-1', '2026-09-10', true);
    });
  });

  it('opens task detail modal on task click and saves edits', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    // Click standalone task
    const standaloneTask = screen.getByText('Submit tax reports');
    fireEvent.click(standaloneTask);

    // Modal dialog opens
    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByLabelText(/task title/i)).toBeDefined();
    expect(screen.getByDisplayValue('Submit tax reports')).toBeDefined();

    // Edit task title
    const titleInput = screen.getByDisplayValue('Submit tax reports');
    fireEvent.change(titleInput, { target: { value: 'Submit updated tax reports' } });

    // Submit save
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateStandaloneTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'st-1',
          text: 'Submit updated tax reports',
        })
      );
    });
  });

  it('filters tasks by search text', () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    const searchInput = screen.getByPlaceholderText(/search tasks/i);
    fireEvent.change(searchInput, { target: { value: 'database' } });

    // Matching task is displayed
    expect(screen.getByText('Design database schema')).toBeDefined();

    // Non-matching tasks are filtered out
    expect(screen.queryByText('Submit tax reports')).toBeNull();
    expect(screen.queryByText('Build backend API')).toBeNull();
  });

  it('filters tasks by project dropdown', () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <TaskCalendarView />
      </AppContext.Provider>
    );

    const projectSelect = screen.getByRole('combobox');
    fireEvent.change(projectSelect, { target: { value: 'standalone' } });

    // Only standalone tasks displayed
    expect(screen.getByText('Submit tax reports')).toBeDefined();
    expect(screen.queryByText('Design database schema')).toBeNull();
    expect(screen.queryByText('Massive migration refactor')).toBeNull();
  });
});
