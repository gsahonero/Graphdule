import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ProjectDocument,
  ProjectSummary,
  SnapshotMetadata,
  Node,
  Note,
  StandaloneTask,
  UserPreferences,
  NodeStatus,
  ProjectStatus,
  ProjectStyle,
  RecurrenceRule,
  CascadeImpactPreview,
} from '../../domain/models/types';
import { ProjectService } from '../../domain/services/project-service';
import { TemporalService } from '../../domain/services/temporal-service';
import { HistoryService } from '../../domain/services/history-service';
import { MyDayService } from '../../domain/services/my-day-service';
import { RecurrenceService } from '../../domain/services/recurrence-service';
import {
  defaultStorageProvider,
  IStorageProvider,
  SyncCoordinator,
  SyncState,
  GDriveAuth,
  OneDriveAuth,
} from '../../storage';
import { JsonFileProvider } from '../../storage/file/json-file-provider';
import { getTodayString, formatDisplayDate, DateDisplayFormat } from '../../domain/utils/date';
import { createDefaultSampleProject } from '../../config/sample-project';

interface AppContextType {
  storage: IStorageProvider;
  currentView: 'projects' | 'project_detail' | 'my_day';
  setCurrentView: (view: 'projects' | 'project_detail' | 'my_day') => void;
  activeProjectTab: 'graph' | 'timeline' | 'history';
  setActiveProjectTab: (tab: 'graph' | 'timeline' | 'history') => void;

  projects: ProjectSummary[];
  allActiveNodes: Node[];
  activeProjectDoc: ProjectDocument | null;
  standaloneTasks: StandaloneTask[];
  preferences: UserPreferences;
  formatDateDisplay: (dateStr: string) => string;
  toggleDateFormat: () => Promise<void>;
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
  isNotesDrawerOpen: boolean;
  setIsNotesDrawerOpen: (open: boolean) => void;

  // Modals & previews
  pendingCascade: CascadeImpactPreview | null;
  setPendingCascade: (cascade: CascadeImpactPreview | null) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;

  allAvailableTags: string[];

  // Actions
  refreshData: () => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  createProject: (name: string, endGoalText: string, deadline: string, tags?: string[], style?: ProjectStyle) => Promise<void>;
  updateProjectName: (name: string) => Promise<void>;
  updateProjectTags: (tags: string[]) => Promise<void>;
  updateProjectStyle: (style: ProjectStyle, projectId?: string) => Promise<void>;
  archiveProject: (projectId: string, reason?: ProjectStatus) => Promise<void>;
  unarchiveProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  addNode: (text: string, dueDate: string, parentNodeId?: string | null, position?: { x: number; y: number }) => Promise<Node | null>;
  updateNode: (node: Node) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  updateNodePositions: (positions: { id: string; position: { x: number; y: number } }[]) => Promise<void>;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => Promise<void>;
  moveNodeDate: (nodeId: string, newDueDate: string, force?: boolean) => Promise<void>;
  applyPendingCascade: () => Promise<void>;
  addEdge: (fromNodeId: string, toNodeId: string) => Promise<{ success: boolean; error?: string }>;
  deleteEdge: (edgeId: string) => Promise<void>;
  decomposeNode: (parentNodeId: string, subtasks: { text: string; dueDate?: string }[]) => Promise<void>;
  addNote: (nodeId: string, text: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  syncAtomicInheritance: () => Promise<void>;

  // History & Snapshots
  projectSnapshots: SnapshotMetadata[];
  createSnapshot: (message?: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;

  // Standalone Tasks
  addStandaloneTask: (text: string, dueDate?: string, recurrence?: RecurrenceRule) => Promise<void>;
  updateStandaloneTask: (task: StandaloneTask) => Promise<void>;
  updateStandaloneTaskStatus: (taskId: string, status: NodeStatus) => Promise<void>;
  deleteStandaloneTask: (taskId: string) => Promise<void>;

  // Cloud Sync & Cross-Device
  cloudSyncState: SyncState;
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (open: boolean) => void;
  connectGoogleDrive: (clientId?: string) => Promise<boolean>;
  connectOneDrive: (clientId?: string) => Promise<boolean>;
  disconnectCloud: () => Promise<void>;
  triggerCloudSync: () => Promise<void>;

  // Preferences & Import/Export
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  exportActiveProject: () => void;
  exportAllData: () => Promise<void>;
  importProjectJson: (jsonString: string) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storage] = useState<IStorageProvider>(defaultStorageProvider);
  const [currentView, setCurrentView] = useState<'projects' | 'project_detail' | 'my_day'>('projects');
  const [activeProjectTab, setActiveProjectTab] = useState<'graph' | 'timeline' | 'history'>('graph');

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [allActiveNodes, setAllActiveNodes] = useState<Node[]>([]);
  const [activeProjectDoc, setActiveProjectDoc] = useState<ProjectDocument | null>(null);
  const [projectSnapshots, setProjectSnapshots] = useState<SnapshotMetadata[]>([]);
  const [standaloneTasks, setStandaloneTasks] = useState<StandaloneTask[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const localTheme = typeof window !== 'undefined' ? (localStorage.getItem('graphdule_theme') as 'dark' | 'light' | null) : null;
    const localDateFormat = typeof window !== 'undefined' ? (localStorage.getItem('graphdule_date_format') as DateDisplayFormat | null) : null;
    return {
      myDayMode: 'today',
      theme: localTheme || 'dark',
      dateFormat: localDateFormat || 'DD/MM/YYYY',
      onboardingCompleted: false,
      preferredStorageProvider: 'browser',
    };
  });

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [pendingCascade, setPendingCascade] = useState<CascadeImpactPreview | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Cloud Sync state
  const [cloudSyncState, setCloudSyncState] = useState<SyncState>(() => SyncCoordinator.getState());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = SyncCoordinator.subscribe((state) => {
      setCloudSyncState(state);
    });
    return unsubscribe;
  }, []);

  // Compute all unique tags available across all projects for easy reuse & autocompletion
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      p.tags?.forEach((t) => {
        if (t && typeof t === 'string' && t.trim()) set.add(t.trim());
      });
    });
    if (activeProjectDoc?.project.tags) {
      activeProjectDoc.project.tags.forEach((t) => {
        if (t && typeof t === 'string' && t.trim()) set.add(t.trim());
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects, activeProjectDoc]);

  // Format any date according to user preference
  const formatDateDisplay = useCallback(
    (dateStr: string) => {
      return formatDisplayDate(dateStr, preferences.dateFormat || 'DD/MM/YYYY');
    },
    [preferences.dateFormat]
  );

  // Initialize storage and load initial state
  const refreshData = useCallback(async () => {
    await storage.init();
    let projList = await storage.listProjects();

    // Default sample project seed if no projects exist yet
    if (projList.length === 0) {
      const sampleDoc = createDefaultSampleProject();
      await storage.writeProject(sampleDoc);
      const { snapshot } = HistoryService.createSnapshot(sampleDoc, 'Sample Research Project with Default Tags');
      await storage.writeSnapshot(snapshot);
      projList = await storage.listProjects();
    }

    const standalones = await storage.readStandaloneTasks();
    const prefs = await storage.readPreferences();

    const localTheme = localStorage.getItem('graphdule_theme') as 'dark' | 'light' | null;
    const finalTheme = localTheme || prefs.theme || 'dark';
    const localDateFormat = localStorage.getItem('graphdule_date_format') as DateDisplayFormat | null;
    const finalDateFormat = localDateFormat || prefs.dateFormat || 'DD/MM/YYYY';

    const mergedPrefs: UserPreferences = {
      ...prefs,
      theme: finalTheme,
      dateFormat: finalDateFormat,
    };

    if (finalTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }

    setProjects(projList);
    setStandaloneTasks(standalones);
    setPreferences(mergedPrefs);

    // Read and combine nodes from ALL active (non-archived) projects
    const activeProjectSummaries = projList.filter((p) => !p.isArchived);
    const docs = await Promise.all(
      activeProjectSummaries.map(async (p) => {
        if (activeProjectDoc && activeProjectDoc.project.id === p.id) {
          return activeProjectDoc;
        }
        return storage.readProject(p.id);
      })
    );
    const combinedNodes: Node[] = [];
    docs.forEach((doc) => {
      if (doc && (!doc.project.status || doc.project.status === 'active')) {
        combinedNodes.push(...doc.nodes);
      }
    });
    setAllActiveNodes(combinedNodes);

    if (!prefs.onboardingCompleted && projList.length === 0) {
      setIsOnboardingOpen(true);
    }
  }, [storage, activeProjectDoc]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (preferences.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('graphdule_theme', preferences.theme);
  }, [preferences.theme]);

  const loadProjectSnapshots = useCallback(
    async (projectId: string) => {
      const snaps = await storage.listSnapshots(projectId);
      setProjectSnapshots(snaps);
    },
    [storage]
  );

  const openProject = useCallback(
    async (projectId: string) => {
      const doc = await storage.readProject(projectId);
      if (doc) {
        setActiveProjectDoc(doc);
        setCurrentView('project_detail');
        setSelectedNode(null);
        await loadProjectSnapshots(projectId);
      }
    },
    [storage, loadProjectSnapshots]
  );

  const createProject = useCallback(
    async (name: string, endGoalText: string, deadline: string, tags?: string[], style?: ProjectStyle) => {
      const { project, egnNode } = ProjectService.createProject(name, endGoalText, deadline, tags, style);
      const newDoc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        project,
        nodes: [egnNode],
        edges: [],
        notes: [],
        history: [],
      };

      await storage.writeProject(newDoc);
      // Create initial snapshot
      const { snapshot } = HistoryService.createSnapshot(newDoc, 'Initial project creation with EGN');
      await storage.writeSnapshot(snapshot);

      await refreshData();
      await openProject(project.id);
    },
    [storage, refreshData, openProject]
  );

  const saveProjectDoc = useCallback(
    async (updatedDoc: ProjectDocument) => {
      const syncedNodes = TemporalService.syncParentDueDates(updatedDoc.nodes);
      const now = new Date().toISOString();
      const docWithTimestamp: ProjectDocument = {
        ...updatedDoc,
        nodes: syncedNodes,
        exportedAt: now,
        project: {
          ...updatedDoc.project,
          updatedAt: now,
        },
      };
      await storage.writeProject(docWithTimestamp);
      setActiveProjectDoc(docWithTimestamp);

      // Refresh summaries
      const projList = await storage.listProjects();
      setProjects(projList);
    },
    [storage]
  );

  const updateProjectName = useCallback(
    async (newName: string) => {
      if (!activeProjectDoc) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === activeProjectDoc.project.name) return;

      const updatedProject = {
        ...activeProjectDoc.project,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      };

      await saveProjectDoc({
        ...activeProjectDoc,
        project: updatedProject,
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const updateProjectTags = useCallback(
    async (newTags: string[]) => {
      if (!activeProjectDoc) return;
      const updatedProject = ProjectService.updateProjectTags(activeProjectDoc.project, newTags);

      await saveProjectDoc({
        ...activeProjectDoc,
        project: updatedProject,
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const updateProjectStyle = useCallback(
    async (style: ProjectStyle, projectId?: string) => {
      const targetProjectId = projectId || activeProjectDoc?.project.id;
      if (!targetProjectId) return;

      if (activeProjectDoc && activeProjectDoc.project.id === targetProjectId) {
        const updatedProject = ProjectService.updateProjectStyle(activeProjectDoc.project, style);
        await saveProjectDoc({
          ...activeProjectDoc,
          project: updatedProject,
        });
        await refreshData();
        return;
      }

      // Read, update, and write for target project document
      const doc = await storage.readProject(targetProjectId);
      if (!doc) return;
      const updatedProject = ProjectService.updateProjectStyle(doc.project, style);
      const updatedDoc: ProjectDocument = {
        ...doc,
        project: updatedProject,
        exportedAt: new Date().toISOString(),
      };
      await storage.writeProject(updatedDoc);
      await refreshData();
    },
    [activeProjectDoc, saveProjectDoc, storage, refreshData]
  );

  const archiveProject = useCallback(
    async (projectId: string, reason: ProjectStatus = 'archived') => {
      const doc = await storage.readProject(projectId);
      if (!doc) return;
      const updatedProject = ProjectService.archiveProject(
        doc.project,
        reason === 'active' ? 'archived' : reason
      );
      const updatedDoc: ProjectDocument = {
        ...doc,
        project: updatedProject,
        exportedAt: new Date().toISOString(),
      };
      await storage.writeProject(updatedDoc);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(updatedDoc);
      }
      await refreshData();
    },
    [storage, activeProjectDoc, refreshData]
  );

  const unarchiveProject = useCallback(
    async (projectId: string) => {
      const doc = await storage.readProject(projectId);
      if (!doc) return;
      const updatedProject = ProjectService.unarchiveProject(doc.project);
      const updatedDoc: ProjectDocument = {
        ...doc,
        project: updatedProject,
        exportedAt: new Date().toISOString(),
      };
      await storage.writeProject(updatedDoc);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(updatedDoc);
      }
      await refreshData();
    },
    [storage, activeProjectDoc, refreshData]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await storage.deleteProject(projectId);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(null);
        setCurrentView('projects');
      }
      await refreshData();
    },
    [storage, activeProjectDoc, refreshData]
  );

  const addNode = useCallback(
    async (
      text: string,
      dueDate: string,
      parentNodeId?: string | null,
      position?: { x: number; y: number }
    ): Promise<Node | null> => {
      if (!activeProjectDoc) return null;
      const newNode = ProjectService.createNode(
        activeProjectDoc.project.id,
        text,
        dueDate,
        parentNodeId,
        position
      );
      const updatedDoc: ProjectDocument = {
        ...activeProjectDoc,
        nodes: [...activeProjectDoc.nodes, newNode],
      };
      await saveProjectDoc(updatedDoc);
      return newNode;
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const updateNode = useCallback(
    async (updatedNode: Node) => {
      if (!activeProjectDoc) return;
      const updatedNodes = activeProjectDoc.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));
      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: updatedNodes,
      });

      if (selectedNode?.id === updatedNode.id) {
        setSelectedNode(updatedNode);
      }
    },
    [activeProjectDoc, selectedNode, saveProjectDoc]
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      if (!activeProjectDoc) return;
      const res = ProjectService.deleteNodeFromProject(activeProjectDoc, nodeId);
      if (!res.success) {
        alert(res.error);
        return;
      }

      await saveProjectDoc(res.document);

      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [activeProjectDoc, selectedNode, saveProjectDoc]
  );

  const updateNodePositions = useCallback(
    async (positions: { id: string; position: { x: number; y: number } }[]) => {
      if (!activeProjectDoc) return;
      const posMap = new Map(positions.map((p) => [p.id, p.position]));
      const updatedNodes = activeProjectDoc.nodes.map((n) => {
        if (posMap.has(n.id)) {
          return { ...n, position: posMap.get(n.id) };
        }
        return n;
      });
      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: updatedNodes,
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const updateNodeStatus = useCallback(
    async (nodeId: string, status: NodeStatus) => {
      // 1. If in active project doc, update in memory & save
      if (activeProjectDoc) {
        const node = activeProjectDoc.nodes.find((n) => n.id === nodeId);
        if (node) {
          const updated = ProjectService.updateNodeStatus(node, status);
          await updateNode(updated);
          await refreshData();
          return;
        }
      }

      // 2. Search across all projects in storage
      const projs = await storage.listProjects();
      for (const p of projs) {
        const doc = await storage.readProject(p.id);
        if (doc) {
          const targetNode = doc.nodes.find((n) => n.id === nodeId);
          if (targetNode) {
            const updatedNode = ProjectService.updateNodeStatus(targetNode, status);
            const updatedNodes = doc.nodes.map((n) => (n.id === nodeId ? updatedNode : n));
            const updatedDoc: ProjectDocument = { ...doc, nodes: updatedNodes };
            await storage.writeProject(updatedDoc);
            if (activeProjectDoc && activeProjectDoc.project.id === p.id) {
              setActiveProjectDoc(updatedDoc);
            }
            await refreshData();
            return;
          }
        }
      }
    },
    [activeProjectDoc, updateNode, storage, refreshData]
  );

  const moveNodeDate = useCallback(
    async (nodeId: string, newDueDate: string, force = false) => {
      if (activeProjectDoc) {
        const node = activeProjectDoc.nodes.find((n) => n.id === nodeId);
        if (node) {
          if (!force) {
            const cascade = TemporalService.calculateCascadeImpact(
              nodeId,
              newDueDate,
              activeProjectDoc.nodes,
              activeProjectDoc.edges
            );

            if (cascade) {
              setPendingCascade(cascade);
              return;
            }
          }

          const updated = {
            ...node,
            dueDate: newDueDate,
            updatedAt: new Date().toISOString(),
          };
          await updateNode(updated);
          await refreshData();
          return;
        }
      }

      // Search across other projects
      const projs = await storage.listProjects();
      for (const p of projs) {
        const doc = await storage.readProject(p.id);
        if (doc) {
          const node = doc.nodes.find((n) => n.id === nodeId);
          if (node) {
            if (!force) {
              const cascade = TemporalService.calculateCascadeImpact(
                nodeId,
                newDueDate,
                doc.nodes,
                doc.edges
              );

              if (cascade) {
                setPendingCascade(cascade);
                return;
              }
            }

            const updatedNodes = doc.nodes.map((n) =>
              n.id === nodeId ? { ...n, dueDate: newDueDate, updatedAt: new Date().toISOString() } : n
            );
            const updatedDoc: ProjectDocument = { ...doc, nodes: updatedNodes };
            await storage.writeProject(updatedDoc);
            if (activeProjectDoc && activeProjectDoc.project.id === p.id) {
              setActiveProjectDoc(updatedDoc);
            }
            await refreshData();
            return;
          }
        }
      }
    },
    [activeProjectDoc, updateNode, storage, refreshData]
  );

  const applyPendingCascade = useCallback(async () => {
    if (!activeProjectDoc || !pendingCascade) return;
    const updatedNodes = TemporalService.applyCascadeShift(pendingCascade, activeProjectDoc.nodes);
    await saveProjectDoc({
      ...activeProjectDoc,
      nodes: updatedNodes,
    });
    setPendingCascade(null);
  }, [activeProjectDoc, pendingCascade, saveProjectDoc]);

  const addEdge = useCallback(
    async (fromNodeId: string, toNodeId: string): Promise<{ success: boolean; error?: string }> => {
      if (!activeProjectDoc) return { success: false, error: 'No active project' };

      const result = ProjectService.createEdge(
        activeProjectDoc.project.id,
        fromNodeId,
        toNodeId,
        activeProjectDoc.nodes,
        activeProjectDoc.edges
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      await saveProjectDoc({
        ...activeProjectDoc,
        edges: [...activeProjectDoc.edges, result.edge],
      });

      return { success: true };
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const deleteEdge = useCallback(
    async (edgeId: string) => {
      if (!activeProjectDoc) return;
      const updatedEdges = activeProjectDoc.edges.filter((e) => e.id !== edgeId);
      await saveProjectDoc({
        ...activeProjectDoc,
        edges: updatedEdges,
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const decomposeNode = useCallback(
    async (parentNodeId: string, subtasks: { text: string; dueDate?: string }[]) => {
      if (!activeProjectDoc) return;
      const parentNode = activeProjectDoc.nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;

      const newSubnodes = ProjectService.decomposeNode(parentNode, subtasks);
      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: [...activeProjectDoc.nodes, ...newSubnodes],
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const addNote = useCallback(
    async (nodeId: string, text: string) => {
      if (!activeProjectDoc) return;
      const now = new Date().toISOString();
      const newNote: Note = {
        id: `note_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        nodeId,
        text,
        createdAt: now,
        updatedAt: now,
      };

      await saveProjectDoc({
        ...activeProjectDoc,
        notes: [...activeProjectDoc.notes, newNote],
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!activeProjectDoc) return;
      await saveProjectDoc({
        ...activeProjectDoc,
        notes: activeProjectDoc.notes.filter((n) => n.id !== noteId),
      });
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const syncAtomicInheritance = useCallback(async () => {
    if (!activeProjectDoc) return;
    const syncedNodes = TemporalService.syncParentDueDates(activeProjectDoc.nodes);
    const hasChanges = syncedNodes.some((sn, idx) => sn.dueDate !== activeProjectDoc.nodes[idx]?.dueDate);
    if (hasChanges) {
      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: syncedNodes,
      });
    }
  }, [activeProjectDoc, saveProjectDoc]);

  const createSnapshot = useCallback(
    async (message?: string) => {
      if (!activeProjectDoc) return;
      const { snapshot } = HistoryService.createSnapshot(activeProjectDoc, message);
      await storage.writeSnapshot(snapshot);
      await loadProjectSnapshots(activeProjectDoc.project.id);
    },
    [activeProjectDoc, storage, loadProjectSnapshots]
  );

  const restoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!activeProjectDoc) return;
      const snapshot = await storage.readSnapshot(activeProjectDoc.project.id, snapshotId);
      if (!snapshot) return;

      const restoredDoc = HistoryService.restoreFromSnapshot(snapshot);
      await saveProjectDoc(restoredDoc);

      // Create a snapshot recording the restoration
      const { snapshot: recordSnap } = HistoryService.createSnapshot(
        restoredDoc,
        `Restored from snapshot: "${snapshot.message || snapshot.id}"`
      );
      await storage.writeSnapshot(recordSnap);
      await loadProjectSnapshots(activeProjectDoc.project.id);
    },
    [activeProjectDoc, storage, saveProjectDoc, loadProjectSnapshots]
  );

  const addStandaloneTask = useCallback(
    async (text: string, dueDate?: string, recurrence?: RecurrenceRule) => {
      const newTask = MyDayService.createStandaloneTask(text, dueDate || getTodayString(), recurrence);
      const updated = [...standaloneTasks, newTask];
      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
    },
    [standaloneTasks, storage]
  );

  const updateStandaloneTask = useCallback(
    async (task: StandaloneTask) => {
      const updated = standaloneTasks.map((t) =>
        t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t
      );
      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
    },
    [standaloneTasks, storage]
  );

  const updateStandaloneTaskStatus = useCallback(
    async (taskId: string, status: NodeStatus) => {
      const targetTask = standaloneTasks.find((t) => t.id === taskId);
      let updated = standaloneTasks.map((t) =>
        t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t
      );

      // If completing a recurring task, automatically generate the next occurrence!
      if (targetTask && status === 'completed' && targetTask.recurrence) {
        const nextDueDate = RecurrenceService.computeNextDueDate(
          targetTask.dueDate,
          targetTask.recurrence,
          targetTask.recurrenceInstance || 1
        );

        if (nextDueDate) {
          const parentId = targetTask.parentRecurringTaskId || targetTask.id;
          // Check if an upcoming instance for this parent already exists
          const alreadyExists = standaloneTasks.some(
            (t) =>
              (t.parentRecurringTaskId === parentId || t.id === parentId) &&
              t.dueDate === nextDueDate &&
              t.status !== 'completed' &&
              t.status !== 'abandoned'
          );

          if (!alreadyExists) {
            const nextInstanceNumber = (targetTask.recurrenceInstance || 1) + 1;
            const nextTask = MyDayService.createStandaloneTask(
              targetTask.text,
              nextDueDate,
              targetTask.recurrence,
              parentId,
              nextInstanceNumber
            );
            updated = [...updated, nextTask];
          }
        }
      }

      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
    },
    [standaloneTasks, storage]
  );

  const deleteStandaloneTask = useCallback(
    async (taskId: string) => {
      const updated = standaloneTasks.filter((t) => t.id !== taskId);
      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
    },
    [standaloneTasks, storage]
  );

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const updated = { ...preferences, ...partial };
      if (partial.theme) {
        localStorage.setItem('graphdule_theme', partial.theme);
        if (partial.theme === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
        }
      }
      if (partial.dateFormat) {
        localStorage.setItem('graphdule_date_format', partial.dateFormat);
      }
      setPreferences(updated);
      await storage.writePreferences(updated);
    },
    [preferences, storage]
  );

  const toggleDateFormat = useCallback(async () => {
    const nextFormat: DateDisplayFormat =
      preferences.dateFormat === 'MMM_D_YYYY' ? 'DD/MM/YYYY' : 'MMM_D_YYYY';
    await updatePreferences({ dateFormat: nextFormat });
  }, [preferences.dateFormat, updatePreferences]);

  const exportActiveProject = useCallback(() => {
    if (activeProjectDoc) {
      JsonFileProvider.exportProjectToFile(activeProjectDoc);
    }
  }, [activeProjectDoc]);

  const exportAllData = useCallback(async () => {
    const projList = await storage.listProjects();
    const allDocs: ProjectDocument[] = [];
    for (const p of projList) {
      const doc = await storage.readProject(p.id);
      if (doc) allDocs.push(doc);
    }
    const standalones = await storage.readStandaloneTasks();
    const prefs = await storage.readPreferences();

    JsonFileProvider.exportFullWorkspaceBackup({
      projects: allDocs,
      standaloneTasks: standalones,
      preferences: prefs,
    });
  }, [storage]);

  const importProjectJson = useCallback(
    async (jsonString: string): Promise<{ success: boolean; error?: string }> => {
      const parseResult = JsonFileProvider.parseProjectFileContent(jsonString);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      await storage.writeProject(parseResult.document);
      const { snapshot } = HistoryService.createSnapshot(
        parseResult.document,
        'Imported from canonical JSON file'
      );
      await storage.writeSnapshot(snapshot);

      await refreshData();
      await openProject(parseResult.document.project.id);
      return { success: true };
    },
    [storage, refreshData, openProject]
  );

  const triggerCloudSync = useCallback(async () => {
    const res = await SyncCoordinator.sync(storage);
    if (res.success) {
      await refreshData();
    }
  }, [storage, refreshData]);

  const connectGoogleDrive = useCallback(
    async (clientId?: string) => {
      const res = await GDriveAuth.login(clientId);
      if (res.success) {
        await SyncCoordinator.setCloudProvider('google_drive');
        await triggerCloudSync();
        return true;
      }
      return false;
    },
    [triggerCloudSync]
  );

  const connectOneDrive = useCallback(
    async (clientId?: string) => {
      const res = await OneDriveAuth.login(clientId);
      if (res.success) {
        await SyncCoordinator.setCloudProvider('onedrive');
        await triggerCloudSync();
        return true;
      }
      return false;
    },
    [triggerCloudSync]
  );

  const disconnectCloud = useCallback(async () => {
    SyncCoordinator.disconnect();
  }, []);

  // Background auto-sync on focus and network online
  useEffect(() => {
    const onFocus = () => {
      if (cloudSyncState.provider !== 'none') {
        triggerCloudSync();
      }
    };
    const onOnline = () => {
      if (cloudSyncState.provider !== 'none') {
        triggerCloudSync();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [cloudSyncState.provider, triggerCloudSync]);

  return (
    <AppContext.Provider
      value={{
        storage,
        currentView,
        setCurrentView,
        activeProjectTab,
        setActiveProjectTab,
        projects,
        allActiveNodes,
        activeProjectDoc,
        standaloneTasks,
        preferences,
        formatDateDisplay,
        toggleDateFormat,
        selectedNode,
        setSelectedNode,
        isNotesDrawerOpen,
        setIsNotesDrawerOpen,
        pendingCascade,
        setPendingCascade,
        isOnboardingOpen,
        setIsOnboardingOpen,
        allAvailableTags,
        refreshData,
        openProject,
        createProject,
        updateProjectName,
        updateProjectTags,
        updateProjectStyle,
        archiveProject,
        unarchiveProject,
        deleteProject,
        addNode,
        updateNode,
        deleteNode,
        updateNodePositions,
        updateNodeStatus,
        moveNodeDate,
        applyPendingCascade,
        addEdge,
        deleteEdge,
        decomposeNode,
        addNote,
        deleteNote,
        syncAtomicInheritance,
        projectSnapshots,
        createSnapshot,
        restoreSnapshot,
        addStandaloneTask,
        updateStandaloneTask,
        updateStandaloneTaskStatus,
        deleteStandaloneTask,
        cloudSyncState,
        isSyncModalOpen,
        setIsSyncModalOpen,
        connectGoogleDrive,
        connectOneDrive,
        disconnectCloud,
        triggerCloudSync,
        updatePreferences,
        exportActiveProject,
        exportAllData,
        importProjectJson,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
