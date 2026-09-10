import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarPicker, CalendarDayTask } from '../../src/ui/components/CalendarPicker';
import { AppContext } from '../../src/ui/context/AppContext';
import { DailyCapacityConfig } from '../../src/domain';

describe('CalendarPicker - AU Capacity & Reality Check Integration', () => {
  const onChangeMock = vi.fn();
  const onCloseMock = vi.fn();
  const setDailyCapacityOverrideMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTasks: CalendarDayTask[] = [
    {
      id: 'task-1',
      text: 'Build parser module',
      dueDate: '2026-09-07', // Monday
      status: 'planned',
      estimatedAU: 10,
      projectName: 'Compiler',
    },
    {
      id: 'task-2',
      text: 'Write documentation',
      dueDate: '2026-09-07',
      status: 'planned',
      estimatedAU: 6,
      projectName: 'Compiler',
    },
  ];

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

  const createMockContext = (overrides?: Partial<any>) => ({
    capacityConfig: mockCapacityConfig,
    capacitySnapshots: [],
    setDailyCapacityOverride: setDailyCapacityOverrideMock,
    formatDateDisplay: (d: string) => d,
    allActiveNodes: [],
    activeProjectDoc: null,
    standaloneTasks: [],
    ...overrides,
  });

  it('renders planned AU vs daily capacity metrics in the workload panel', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <CalendarPicker
          value="2026-09-01"
          onChange={onChangeMock}
          onClose={onCloseMock}
          customTasks={mockTasks}
        />
      </AppContext.Provider>
    );

    // Open panel for Monday Sept 7 (total planned: 10 + 6 = 16 AU, capacity: 20 AU)
    const balloon = screen.getByTestId('task-balloon-2026-09-07');
    fireEvent.click(balloon);

    expect(await screen.findByTestId('calendar-workload-preview')).toBeDefined();

    // Check capacity metrics
    const plannedMetric = screen.getByTestId('capacity-planned-metric');
    expect(plannedMetric.textContent).toContain('16 / 20 AU planned');

    const percentageMetric = screen.getByTestId('capacity-percentage-metric');
    expect(percentageMetric.textContent).toContain('80% capacity');

    const availableMetric = screen.getByTestId('capacity-available-metric');
    expect(availableMetric.textContent).toContain('4 AU available');
  });

  it('displays consequence preview when scheduling a task that fits within capacity', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <CalendarPicker
          value="2026-09-01"
          onChange={onChangeMock}
          onClose={onCloseMock}
          customTasks={mockTasks} // already has 16 AU
          currentTaskId="new-task-1"
          taskEstimatedAU={2} // 16 + 2 = 18 AU <= 20 AU
        />
      </AppContext.Provider>
    );

    const balloon = screen.getByTestId('task-balloon-2026-09-07');
    fireEvent.click(balloon);

    const consequenceCard = await screen.findByTestId('capacity-consequence-card');
    expect(consequenceCard).toBeDefined();
    expect(consequenceCard.textContent).toContain('Fits Capacity');
    expect(consequenceCard.textContent).toContain('Current:16 / 20 AU');
    expect(consequenceCard.textContent).toContain('+ This task:2 AU');
    expect(consequenceCard.textContent).toContain('= Total:18 / 20 AU (90%)');

    // Overcapacity alert must NOT be present
    expect(screen.queryByTestId('overcapacity-alert')).toBeNull();
  });

  it('displays prominent overcapacity alert without blocking task assignment when exceeding capacity', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <CalendarPicker
          value="2026-09-01"
          onChange={onChangeMock}
          onClose={onCloseMock}
          customTasks={mockTasks} // already has 16 AU
          currentTaskId="heavy-task-1"
          taskEstimatedAU={8} // 16 + 8 = 24 AU > 20 AU (overcapacity by 4 AU)
        />
      </AppContext.Provider>
    );

    const balloon = screen.getByTestId('task-balloon-2026-09-07');
    fireEvent.click(balloon);

    const consequenceCard = await screen.findByTestId('capacity-consequence-card');
    expect(consequenceCard.textContent).toContain('Over Capacity');
    expect(consequenceCard.textContent).toContain('= Total:24 / 20 AU (120%)');

    // Overcapacity alert banner is rendered prominently
    const alertBanner = await screen.findByTestId('overcapacity-alert');
    expect(alertBanner.textContent).toContain('Overcommitted by 4 AU (120%)');
    expect(alertBanner.textContent).toContain('Reality check: You can still schedule this task.');

    // The "Set as deadline" button must remain fully enabled (reality check, not a blocker)
    const setDeadlineBtn = screen.getByTestId('select-panel-date');
    expect((setDeadlineBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(setDeadlineBtn);
    expect(onChangeMock).toHaveBeenCalledWith('2026-09-07');
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('allows frictionless inline override of daily capacity', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <CalendarPicker
          value="2026-09-01"
          onChange={onChangeMock}
          onClose={onCloseMock}
          customTasks={mockTasks}
        />
      </AppContext.Provider>
    );

    const balloon = screen.getByTestId('task-balloon-2026-09-07');
    fireEvent.click(balloon);

    const editBtn = await screen.findByTestId('edit-capacity-override');
    fireEvent.click(editBtn);

    const input = await screen.findByTestId('capacity-override-input') as HTMLInputElement;
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: '30' } });

    const saveBtn = screen.getByTestId('save-capacity-override');
    fireEvent.click(saveBtn);

    expect(setDailyCapacityOverrideMock).toHaveBeenCalledWith('2026-09-07', 30);
  });

  it('allows opening capacity reality check on days with 0 tasks via day-capacity-trigger', async () => {
    render(
      <AppContext.Provider value={createMockContext() as any}>
        <CalendarPicker
          value="2026-09-01"
          onChange={onChangeMock}
          onClose={onCloseMock}
          customTasks={mockTasks}
          taskEstimatedAU={5}
          currentTaskId="task-on-empty-day"
        />
      </AppContext.Provider>
    );

    // 2026-09-10 has 0 tasks
    const trigger = screen.getByTestId('day-capacity-trigger-2026-09-10');
    expect(trigger).toBeDefined();
    fireEvent.click(trigger);

    // Panel opens and shows empty day capacity metrics
    const panel = await screen.findByTestId('calendar-workload-preview');
    expect(panel).toBeDefined();

    const plannedMetric = screen.getByTestId('capacity-planned-metric');
    expect(plannedMetric.textContent).toContain('0 / 20 AU planned');

    const consequenceCard = screen.getByTestId('capacity-consequence-card');
    expect(consequenceCard.textContent).toContain('+ This task:5 AU');
  });
});
