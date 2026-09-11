import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyDayView } from '../../src/ui/views/my-day/MyDayView';
import { Node, StandaloneTask } from '../../src/domain/models/types';
import * as AppContextModule from '../../src/ui/context/AppContext';

describe('MyDayView Two-Column Layout and Mobile Panel Switching', () => {
  const addStandaloneTaskMock = vi.fn();
  const updateStandaloneTaskMock = vi.fn();
  const updateStandaloneTaskStatusMock = vi.fn();
  const deleteStandaloneTaskMock = vi.fn();
  const moveNodeDateMock = vi.fn();
  const updateNodeStatusMock = vi.fn();

  const mockProjectNodes: Node[] = [
    {
      id: 'node-1',
      projectId: 'proj-1',
      text: 'Design Two Column Layout',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      position: { x: 0, y: 0 },
      estimatedAU: 4,
    },
    {
      id: 'node-2',
      projectId: 'proj-1',
      text: 'Build Mobile Lateral Switch',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      position: { x: 100, y: 100 },
      estimatedAU: 2,
    },
  ];

  const mockStandaloneTasks: StandaloneTask[] = [
    {
      id: 'st-1',
      text: 'Review Graphdule Mobile UX',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      estimatedAU: 3,
    },
    {
      id: 'st-2',
      text: 'Dental appointment checkup',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      estimatedAU: 1,
    },
  ];

  const mockProjects = [
    {
      id: 'proj-1',
      name: 'Graphdule Core UI',
      isAttention: true,
      style: { color: 'emerald', icon: 'layers' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      activeProjectDoc: null,
      projects: mockProjects,
      preferences: {
        myDayMode: 'today',
        attentionSystemEnabled: true,
        weeklyPlannedAU: 40,
        attentionUnitMinutes: 15,
        reviewDismissedUntil: null,
      } as any,
      updatePreferences: vi.fn(),
      moveNodeDate: moveNodeDateMock,
      updateNodeStatus: updateNodeStatusMock,
      allNodesMap: new Map(mockProjectNodes.map((n) => [n.id, n])),
      allActiveNodes: mockProjectNodes,
      projectsMap: new Map(mockProjects.map((p) => [p.id, p as any])),
      standaloneTasks: mockStandaloneTasks,
      addStandaloneTask: addStandaloneTaskMock,
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

  it('renders the two-column container and both column elements', () => {
    render(<MyDayView />);

    const twoColumnContainer = screen.getByTestId('my-day-columns');
    expect(twoColumnContainer).toBeDefined();
    expect(twoColumnContainer.className).toContain('grid');
    expect(twoColumnContainer.className).toContain('lg:grid-cols-2');

    const projectsCol = screen.getByTestId('projects-column');
    const standaloneCol = screen.getByTestId('standalone-column');

    expect(projectsCol).toBeDefined();
    expect(standaloneCol).toBeDefined();

    // In default state (projects tab active):
    expect(projectsCol.className).toContain('block');
    expect(standaloneCol.className).toContain('hidden lg:block');
  });

  it('displays correct workload summary pills in the header', () => {
    render(<MyDayView />);

    expect(screen.getByText(/4 tasks/i)).toBeDefined();
    expect(screen.getByText(/2 Project tasks/i)).toBeDefined();
    expect(screen.getByText(/2 Standalone tasks/i)).toBeDefined();
  });

  it('switches between projects and standalone panels via mobile top segmented switcher', () => {
    render(<MyDayView />);

    const projectsCol = screen.getByTestId('projects-column');
    const standaloneCol = screen.getByTestId('standalone-column');

    // Initially Projects is active
    expect(projectsCol.className).toContain('block');
    expect(standaloneCol.className).toContain('hidden lg:block');

    // Click Mobile Standalone Tab
    const mobileStandaloneTab = screen.getByTestId('mobile-tab-standalone');
    fireEvent.click(mobileStandaloneTab);

    // Now Standalone is active, Projects is hidden on mobile
    expect(standaloneCol.className).toContain('block');
    expect(projectsCol.className).toContain('hidden lg:block');

    // Click Mobile Projects Tab
    const mobileProjectsTab = screen.getByTestId('mobile-tab-projects');
    fireEvent.click(mobileProjectsTab);

    // Back to Projects active
    expect(projectsCol.className).toContain('block');
    expect(standaloneCol.className).toContain('hidden lg:block');
  });

  it('toggles panels via the mobile lateral floating button', () => {
    render(<MyDayView />);

    const projectsCol = screen.getByTestId('projects-column');
    const standaloneCol = screen.getByTestId('standalone-column');
    const lateralBtn = screen.getByTestId('mobile-lateral-switch');

    // Initially Projects is active
    expect(projectsCol.className).toContain('block');
    expect(standaloneCol.className).toContain('hidden lg:block');

    // Tap lateral button: toggles from projects -> standalone
    fireEvent.click(lateralBtn);

    expect(standaloneCol.className).toContain('block');
    expect(projectsCol.className).toContain('hidden lg:block');

    // Tap lateral button again: toggles from standalone -> projects
    fireEvent.click(lateralBtn);

    expect(projectsCol.className).toContain('block');
    expect(standaloneCol.className).toContain('hidden lg:block');
  });

  it('allows adding a standalone task in the redesigned responsive form', async () => {
    render(<MyDayView />);

    const input = screen.getByPlaceholderText(/Add a standalone task/i);
    fireEvent.change(input, { target: { value: 'Fix mobile responsiveness' } });

    // Pick date
    const dateBtn = screen.getAllByTitle('Select due date (required)')[0];
    fireEvent.click(dateBtn);

    const todayQuickBtn = screen.getAllByText('Today')[0];
    fireEvent.click(todayQuickBtn);

    const addBtn = screen.getByTitle('Add task');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(addStandaloneTaskMock).toHaveBeenCalledWith(
      'Fix mobile responsiveness',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      undefined,
      undefined
    );
  });
});
