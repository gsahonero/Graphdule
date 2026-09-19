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
    public droppedThoughts: any[] = [];
    public preferences: any = {
      myDayMode: 'today',
      theme: 'dark',
      onboardingCompleted: false,
      preferredStorageProvider: 'browser',
      attentionSystemEnabled: true,
      attentionUnitMinutes: 15,
      zenCurtainEnabled: true,
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
    public async readDroppedThoughts(): Promise<any[]> {
      return this.droppedThoughts;
    }
    public async writeDroppedThoughts(thoughts: any[]): Promise<void> {
      this.droppedThoughts = thoughts;
    }
    public async deleteDroppedThought(id: string): Promise<void> {
      this.droppedThoughts = this.droppedThoughts.filter((t) => t.id !== id);
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

describe('Pre-Mutation Interception Guardrail & Thoughts Pool Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    memoryStorage.projects.clear();
    memoryStorage.standaloneTasks = [];
    memoryStorage.droppedThoughts = [];
    memoryStorage.snapshots = [];
    memoryStorage.preferences = {
      myDayMode: 'today',
      theme: 'dark',
      onboardingCompleted: false,
      preferredStorageProvider: 'browser',
      attentionSystemEnabled: true,
      attentionUnitMinutes: 15,
      zenCurtainEnabled: true,
    };
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider>{children}</AppProvider>
  );

  it('stops addNode before mutating the document when an execution task is active, and discards on cancel', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    // Create a test project with an initial node
    await act(async () => {
      await result.current.createProject('Guardrail Project', 'Initial Goal', '2026-10-30');
    });

    const projectId = result.current.activeProjectDoc!.project.id;
    const initialNodeCount = result.current.activeProjectDoc!.nodes.length;
    expect(initialNodeCount).toBeGreaterThan(0);

    const firstNode = result.current.activeProjectDoc!.nodes[0];

    // Transition session from auto-planning to execution on firstNode
    await act(async () => {
      await result.current.startWork(firstNode.id, firstNode.text, projectId, 'Guardrail Project');
    });

    expect(result.current.activeWorkSession).toBeDefined();
    expect(result.current.activeWorkSession?.sessionType).toBe('execution');

    // Attempt to add a new node (e.g. right-click on graph canvas)
    let addResult: any = 'not-called';
    await act(async () => {
      addResult = await result.current.addNode('Stray Idea Node', '2026-11-01');
    });

    // 1. Mutation must be stopped: addNode returns null immediately
    expect(addResult).toBeNull();

    // 2. Interception modal state must be open
    expect(result.current.planningInterception).not.toBeNull();
    expect(result.current.planningInterception?.isOpen).toBe(true);
    expect(result.current.planningInterception?.reason).toBe('add_node');

    // 3. Document must NOT be mutated in state or storage
    expect(result.current.activeProjectDoc!.nodes.length).toBe(initialNodeCount);
    const storedDoc = await memoryStorage.readProject(projectId);
    expect(storedDoc.nodes.length).toBe(initialNodeCount);

    // 4. User chooses to Cancel (stay in deep focus)
    await act(async () => {
      await result.current.resolvePlanningInterception('cancel');
    });

    // Interception closed, task session still active, document still untouched
    expect(result.current.planningInterception).toBeNull();
    expect(result.current.activeWorkSession?.sessionType).toBe('execution');
    expect(result.current.activeProjectDoc!.nodes.length).toBe(initialNodeCount);
  });

  it('stops addNode during execution task and adds to Thoughts Pool when user chooses drop_thought', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.createProject('Thoughts Pool Project', 'Main Goal', '2026-10-30');
    });

    const projectId = result.current.activeProjectDoc!.project.id;
    const initialNodeCount = result.current.activeProjectDoc!.nodes.length;
    const firstNode = result.current.activeProjectDoc!.nodes[0];

    await act(async () => {
      await result.current.startWork(firstNode.id, firstNode.text, projectId, 'Thoughts Pool Project');
    });

    // Attempt to add node
    await act(async () => {
      await result.current.addNode('Quick Distraction Idea');
    });

    expect(result.current.planningInterception?.isOpen).toBe(true);
    expect(result.current.activeProjectDoc!.nodes.length).toBe(initialNodeCount);

    // User chooses Drop Thought
    await act(async () => {
      await result.current.resolvePlanningInterception('drop_thought', 'Captured fleeting inspiration');
    });

    // Document was NOT modified with the node
    expect(result.current.activeProjectDoc!.nodes.length).toBe(initialNodeCount);
    // Fleeting thought was captured in thoughts pool!
    expect(result.current.droppedThoughts.length).toBe(1);
    expect(result.current.droppedThoughts[0].text).toBe('Captured fleeting inspiration');
    expect(result.current.droppedThoughts[0].status).toBe('inbox');
    // Task session continues running in execution mode!
    expect(result.current.activeWorkSession?.sessionType).toBe('execution');
  });

  it('executes staged mutation when user consciously chooses switch_to_planning', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.createProject('Switch Project', 'Main Goal', '2026-10-30');
    });

    const projectId = result.current.activeProjectDoc!.project.id;
    const initialNodeCount = result.current.activeProjectDoc!.nodes.length;
    const firstNode = result.current.activeProjectDoc!.nodes[0];

    await act(async () => {
      await result.current.startWork(firstNode.id, firstNode.text, projectId, 'Switch Project');
    });

    // Attempt to add node
    await act(async () => {
      await result.current.addNode('Planned Sub-Branch Node');
    });

    expect(result.current.planningInterception?.isOpen).toBe(true);
    expect(result.current.activeProjectDoc!.nodes.length).toBe(initialNodeCount);

    // User chooses Stop Task & Switch to Planning
    await act(async () => {
      await result.current.resolvePlanningInterception('switch_to_planning');
    });

    // Session successfully switched to planning!
    expect(result.current.activeWorkSession?.sessionType).toBe('planning');
    // And the deferred mutation was executed, adding the new node!
    expect(result.current.activeProjectDoc!.nodes.length).toBe(initialNodeCount + 1);
    expect(result.current.activeProjectDoc!.nodes.some((n) => n.text === 'Planned Sub-Branch Node')).toBe(true);
  });

  it('guards deleteNode during execution session and executes only on switch_to_planning', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    await act(async () => {
      await result.current.createProject('Delete Guardrail Proj', 'Main Goal', '2026-10-30');
    });

    // Stop initial auto-planning and add a second node while in planning mode
    const node2 = await act(async () => {
      return await result.current.addNode('Second Task');
    });
    expect(node2).not.toBeNull();

    const projectId = result.current.activeProjectDoc!.project.id;
    const firstNode = result.current.activeProjectDoc!.nodes[0];

    // Start execution session on firstNode
    await act(async () => {
      await result.current.startWork(firstNode.id, firstNode.text, projectId, 'Delete Guardrail Proj');
    });
    expect(result.current.activeWorkSession?.sessionType).toBe('execution');

    // Attempt to delete node2 while execution session is active
    await act(async () => {
      await result.current.deleteNode(node2!.id);
    });

    // Intercepted: node2 is NOT deleted yet
    expect(result.current.planningInterception?.isOpen).toBe(true);
    expect(result.current.planningInterception?.reason).toBe('delete_node');
    expect(result.current.activeProjectDoc!.nodes.some((n) => n.id === node2!.id)).toBe(true);

    // Cancel: node2 remains untouched
    await act(async () => {
      await result.current.resolvePlanningInterception('cancel');
    });
    expect(result.current.activeProjectDoc!.nodes.some((n) => n.id === node2!.id)).toBe(true);

    // Attempt delete again and switch to planning
    await act(async () => {
      await result.current.deleteNode(node2!.id);
    });
    await act(async () => {
      await result.current.resolvePlanningInterception('switch_to_planning');
    });

    // Node is deleted upon switching to planning!
    expect(result.current.activeWorkSession?.sessionType).toBe('planning');
    expect(result.current.activeProjectDoc!.nodes.some((n) => n.id === node2!.id)).toBe(false);
  });
});

