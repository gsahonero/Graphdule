import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

const { memoryStorage } = vi.hoisted(() => {
  class MockMemoryStorage {
    public info = {
      id: 'browser' as const,
      name: 'In-Memory Mock',
      isConnected: true,
      isLocalOnly: true,
      statusMessage: 'In Memory',
    };

    public projects = new Map<string, any>();
    public standaloneTasks: any[] = [];
    public preferences: any = {
      myDayMode: 'today',
      theme: 'dark',
      onboardingCompleted: false,
      preferredStorageProvider: 'browser',
      attentionSystemEnabled: true,
      attentionUnitMinutes: 15,
    };
    public snapshots: any[] = [];

    public async init(): Promise<void> {}
    public async listProjects(): Promise<any[]> {
      return Array.from(this.projects.values()).map((doc) => ({
        id: doc.project.id,
        name: doc.project.name,
        description: doc.project.description,
        endGoalNodeId: doc.project.endGoalNodeId,
        isAttention: doc.project.isAttention,
        isArchived: doc.project.isArchived,
        status: doc.project.status || 'active',
        tags: doc.project.tags,
        style: doc.project.style,
        createdAt: doc.project.createdAt,
        updatedAt: doc.project.updatedAt,
      }));
    }
    public async readProject(projectId: string): Promise<any | null> {
      return this.projects.get(projectId) || null;
    }
    public async writeProject(projectDoc: any): Promise<void> {
      this.projects.set(projectDoc.project.id, projectDoc);
    }
    public async deleteProject(projectId: string): Promise<void> {
      this.projects.delete(projectId);
    }
    public async readStandaloneTasks(): Promise<any[]> {
      return this.standaloneTasks;
    }
    public async writeStandaloneTasks(tasks: any[]): Promise<void> {
      this.standaloneTasks = tasks;
    }
    public async readPreferences(): Promise<any> {
      return this.preferences;
    }
    public async writePreferences(prefs: any): Promise<void> {
      this.preferences = prefs;
    }
    public async listSnapshots(projectId: string): Promise<any[]> {
      return this.snapshots.filter((s) => s.projectId === projectId).map((s) => ({
        id: s.id,
        projectId: s.projectId,
        timestamp: s.timestamp,
        message: s.message,
      }));
    }
    public async readSnapshot(_projectId: string, snapshotId: string): Promise<any | null> {
      return this.snapshots.find((s) => s.id === snapshotId) || null;
    }
    public async writeSnapshot(snapshot: any): Promise<void> {
      this.snapshots.push(snapshot);
    }
    public async deleteSnapshot(_projectId: string, snapshotId: string): Promise<void> {
      this.snapshots = this.snapshots.filter((s) => s.id !== snapshotId);
    }
  }

  return { memoryStorage: new MockMemoryStorage() };
});

vi.mock('../../src/storage', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    defaultStorageProvider: memoryStorage,
  };
});

import { AppProvider, useApp } from '../../src/ui/context/AppContext';

describe('Project Planning Mode Integration (Neuroscience-Backed Deliberation)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    memoryStorage.projects.clear();
    memoryStorage.standaloneTasks = [];
    memoryStorage.snapshots = [];
    memoryStorage.preferences = {
      myDayMode: 'today',
      theme: 'dark',
      onboardingCompleted: false,
      preferredStorageProvider: 'browser',
      attentionSystemEnabled: true,
      attentionUnitMinutes: 15,
    };
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider>{children}</AppProvider>
  );

  it('provides project planning state and whole project mode toggles', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    expect(result.current.isWholeProjectView).toBe(false);
    expect(result.current.activeWorkSession).toBeNull();
    expect(result.current.planningToast).toBeNull();

    act(() => {
      result.current.toggleWholeProjectView();
    });
    expect(result.current.isWholeProjectView).toBe(true);

    act(() => {
      result.current.setIsWholeProjectView(false);
    });
    expect(result.current.isWholeProjectView).toBe(false);
  });

  it('manually starts and stops project planning sessions', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    // Enable attention system for planning tracking
    await act(async () => {
      await result.current.updatePreferences({ attentionSystemEnabled: true });
    });

    // Create a project
    await act(async () => {
      await result.current.createProject('Test Alpha', 'End Goal Alpha', '2026-10-30');
    });

    const projectId = result.current.activeProjectDoc?.project.id;
    expect(projectId).toBeDefined();

    // Auto-triggered planning on project creation
    expect(result.current.activeWorkSession).toBeDefined();
    expect(result.current.activeWorkSession?.sessionType).toBe('planning');
    expect(result.current.activeWorkSession?.projectId).toBe(projectId);
    expect(result.current.planningToast).toBeDefined();

    // Stop project planning
    await act(async () => {
      await result.current.stopProjectPlanning();
    });

    expect(result.current.activeWorkSession).toBeNull();
    expect(result.current.planningToast).toBeNull();
  });

  it('discards active planning session without recording work or activity', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.updatePreferences({ attentionSystemEnabled: true });
    });

    await act(async () => {
      await result.current.createProject('Discard Alpha', 'End Goal', '2026-10-30');
    });

    expect(result.current.activeWorkSession?.sessionType).toBe('planning');

    // Discard active work session
    await act(async () => {
      await result.current.discardActiveWorkSession();
    });

    expect(result.current.activeWorkSession).toBeNull();
    expect(result.current.planningToast).toBeNull();

    // Verify activityLog has NO planning_stopped event
    const stoppedEvents = result.current.activityLog.filter(
      (e) => e.type === 'planning_stopped' || e.type === 'work_stopped'
    );
    expect(stoppedEvents).toHaveLength(0);
  });

  it('triggers planning mode on structural changes: adding a node, edge, and updating title', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.updatePreferences({ attentionSystemEnabled: true });
      await result.current.createProject('Structural Test', 'End Goal', '2026-10-30');
    });

    // Clear active session first
    await act(async () => {
      await result.current.discardActiveWorkSession();
    });
    expect(result.current.activeWorkSession).toBeNull();

    // 1. Add a node -> should trigger planning
    let newNode: any;
    await act(async () => {
      newNode = await result.current.addNode('Design System Module');
    });
    expect(result.current.activeWorkSession).toBeDefined();
    expect(result.current.activeWorkSession?.sessionType).toBe('planning');

    // Stop planning
    await act(async () => {
      await result.current.stopProjectPlanning();
    });
    expect(result.current.activeWorkSession).toBeNull();

    // 2. Add second node and an edge -> should trigger planning
    let secondNode: any;
    await act(async () => {
      secondNode = await result.current.addNode('Implement Backend');
    });
    // Discard again
    await act(async () => {
      await result.current.discardActiveWorkSession();
    });

    if (newNode && secondNode) {
      await act(async () => {
        await result.current.addEdge(newNode.id, secondNode.id);
      });
      expect(result.current.activeWorkSession).toBeDefined();
      expect(result.current.activeWorkSession?.sessionType).toBe('planning');
    }

    // Discard
    await act(async () => {
      await result.current.discardActiveWorkSession();
    });

    // 3. Rename node text -> should trigger planning
    if (newNode) {
      await act(async () => {
        await result.current.updateNode({ ...newNode, text: 'Design System Architecture (Renamed)' });
      });
      expect(result.current.activeWorkSession).toBeDefined();
      expect(result.current.activeWorkSession?.sessionType).toBe('planning');
    }
  });

  it('does NOT trigger planning mode on execution actions: status changes, date moves, or starting work', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.updatePreferences({ attentionSystemEnabled: true });
      await result.current.createProject('Execution Test', 'End Goal', '2026-10-30');
    });

    let node: any;
    await act(async () => {
      node = await result.current.addNode('Execution Task');
    });

    // Clear session
    await act(async () => {
      await result.current.discardActiveWorkSession();
    });
    expect(result.current.activeWorkSession).toBeNull();

    // 1. Status change (e.g. marking in_progress or completed) -> must NOT trigger planning
    await act(async () => {
      await result.current.updateNodeStatus(node.id, 'in_progress');
    });
    expect(result.current.activeWorkSession).toBeNull();

    await act(async () => {
      await result.current.updateNodeStatus(node.id, 'completed');
    });
    expect(result.current.activeWorkSession).toBeNull();

    // 2. Date move -> must NOT trigger planning
    await act(async () => {
      await result.current.moveNodeDate(node.id, '2026-10-25');
    });
    expect(result.current.activeWorkSession).toBeNull();

    // 3. Starting focus work on task -> must be execution, NOT planning
    await act(async () => {
      await result.current.startWork(node.id, node.text, 'proj-plan-test', 'Planning Test Project');
    });
    expect(result.current.activeWorkSession).toBeDefined();
    expect(result.current.activeWorkSession?.sessionType).toBe('execution');
  });
});
