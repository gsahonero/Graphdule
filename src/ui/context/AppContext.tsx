import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  IdeaSeed,
  ActivityEvent,
  ActivityEventType,
  ActiveWorkSession,
  WeeklyAttentionReviewRecord,
} from '../../domain/models/types';
import { ProjectService } from '../../domain/services/project-service';
import { TemporalService } from '../../domain/services/temporal-service';
import { GraphService } from '../../domain/services/graph-service';
import { HistoryService } from '../../domain/services/history-service';
import { UndoRedoManager, MAX_HISTORY_SIZE } from '../../domain/services/undo-redo-service';
import { MyDayService } from '../../domain/services/my-day-service';
import { RecurrenceService } from '../../domain/services/recurrence-service';
import { ActivityLogService } from '../../domain/services/activity-log-service';
import { AttentionService } from '../../domain/services/attention-service';
import {
  defaultStorageProvider,
  IStorageProvider,
  SyncCoordinator,
  SyncState,
  GDriveAuth,
  OneDriveAuth,
  GCalendarClient,
  GCalendarSync,
  GCalendarSyncConfig,
  GCalSyncSummary,
  GCalendarItem,
} from '../../storage';
import { JsonFileProvider } from '../../storage/file/json-file-provider';
import { getTodayString, formatDisplayDate, DateDisplayFormat, isAfter } from '../../domain/utils/date';
import { createDefaultSampleProject, DEFAULT_SAMPLE_PROJECT_ID } from '../../config/sample-project';

interface AppContextType {
  storage: IStorageProvider;
  currentView: 'projects' | 'project_detail' | 'my_day' | 'attention_review';
  setCurrentView: (view: 'projects' | 'project_detail' | 'my_day' | 'attention_review') => void;
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
  lastActiveNode: { node: Node; project: ProjectSummary } | null;
  goToLastActivityNode: () => Promise<boolean>;
  recordActiveNode: (node: Node, projectId?: string) => Promise<void>;
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
  openProject: (projectId: string, nodeToSelect?: Node | string | null) => Promise<void>;
  createProject: (name: string, endGoalText: string, deadline: string, tags?: string[], style?: ProjectStyle) => Promise<void>;
  updateProjectName: (name: string) => Promise<void>;
  updateProjectTags: (tags: string[]) => Promise<void>;
  updateProjectStyle: (style: ProjectStyle, projectId?: string) => Promise<void>;
  archiveProject: (projectId: string, reason?: ProjectStatus) => Promise<void>;
  unarchiveProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  addNode: (text: string, dueDate?: string, parentNodeId?: string | null, position?: { x: number; y: number }, estimatedAU?: number) => Promise<Node | null>;
  updateNode: (node: Node) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  updateNodePositions: (positions: { id: string; position: { x: number; y: number } }[]) => Promise<void>;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => Promise<void>;
  moveNodeDate: (nodeId: string, newDueDate: string, force?: boolean) => Promise<void>;
  applyPendingCascade: () => Promise<void>;
  addEdge: (fromNodeId: string, toNodeId: string) => Promise<{ success: boolean; error?: string }>;
  deleteEdge: (edgeId: string) => Promise<void>;
  spliceNodeIntoEdge: (nodeId: string, edgeId: string, newPosition?: { x: number; y: number }) => Promise<{ success: boolean; error?: string }>;
  nestNode: (sourceNodeId: string, targetParentId: string) => Promise<{ success: boolean; error?: string }>;
  decomposeNode: (parentNodeId: string, subtasks: { text: string; dueDate?: string; estimatedAU?: number }[]) => Promise<void>;
  addNote: (nodeId: string, text: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  syncAtomicInheritance: () => Promise<void>;

  // History & Snapshots
  projectSnapshots: SnapshotMetadata[];
  createSnapshot: (message?: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;

  // Undo & Redo System (100 actions queue)
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // Standalone Tasks
  addStandaloneTask: (text: string, dueDate?: string, recurrence?: RecurrenceRule, estimatedAU?: number) => Promise<void>;
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

  // Google Calendar Sync
  gcalendarSyncConfig: GCalendarSyncConfig;
  setGCalendarSyncConfig: (config: Partial<GCalendarSyncConfig>) => Promise<void>;
  triggerGCalendarSync: () => Promise<GCalSyncSummary>;
  clearAllGCalendarEvents: () => Promise<{ success: boolean; count: number; error?: string }>;
  availableGCalendars: GCalendarItem[];
  fetchAvailableGCalendars: () => Promise<GCalendarItem[]>;

  // Preferences & Import/Export
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  exportActiveProject: () => void;
  exportAllData: () => Promise<void>;
  importProjectJson: (jsonString: string) => Promise<{ success: boolean; error?: string }>;

  // Idea Parking Lot & Seeds
  ideaSeeds: IdeaSeed[];
  addIdeaSeed: (title: string, options?: { rawNotes?: string; seedThoughts?: string[]; tags?: string[] }) => Promise<IdeaSeed>;
  updateIdeaSeed: (id: string, updates: Partial<Omit<IdeaSeed, 'id' | 'createdAt'>>) => Promise<void>;
  deleteIdeaSeed: (id: string) => Promise<void>;
  germinateIdeaSeed: (id: string, deadline?: string, style?: ProjectStyle) => Promise<string>;
  parkProject: (projectId: string) => Promise<void>;
  unparkProject: (projectId: string) => Promise<void>;

  // Priority Attention Management
  maxAttentionProjects: number;
  attentionProjects: ProjectSummary[];
  toggleProjectAttention: (projectId: string) => Promise<{ success: boolean; requiresDemotion?: boolean }>;
  swapProjectAttention: (promoteProjectId: string, demoteProjectId: string) => Promise<void>;

  // Activity Telemetry & LLM Prompt
  activityLog: ActivityEvent[];
  logActivityEvent: (type: ActivityEventType, entityId: string, options?: { entityText?: string; projectId?: string; projectName?: string; fromStatus?: string; toStatus?: string; oldDueDate?: string; newDueDate?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  exportActivityLogPrompt: () => string;
  clearActivityLog: () => Promise<void>;

  // Attention Measurement System & Work Clock
  attentionSystemEnabled: boolean;
  attentionUnitMinutes: number;
  weeklyPlannedAU?: number;
  activeWorkSession: ActiveWorkSession | null;
  activeWorkElapsedSeconds: number;
  startWork: (taskId: string, taskText: string, projectId?: string, projectName?: string) => Promise<void>;
  pauseWork: () => Promise<void>;
  resumeWork: () => Promise<void>;
  stopWork: () => Promise<void>;
  completeAndStopWork: () => Promise<void>;
  updateTaskEstimate: (taskId: string, estimatedAU: number | undefined, projectIdOrIsNode?: string | boolean) => Promise<void>;
  toggleAttentionSystem: (enabled: boolean) => Promise<void>;
  setAttentionUnitMinutes: (minutes: number) => Promise<void>;
  setWeeklyPlannedAU: (au: number | undefined) => Promise<void>;
  attentionReviews: WeeklyAttentionReviewRecord[];
  triggerWeeklyReview: (weekStartDate: string, weekEndDate: string, userNotes?: string) => Promise<WeeklyAttentionReviewRecord>;
  deleteAttentionReview: (reviewId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storage] = useState<IStorageProvider>(defaultStorageProvider);
  const [currentView, setCurrentView] = useState<'projects' | 'project_detail' | 'my_day' | 'attention_review'>('projects');
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
      attentionSystemEnabled: false,
      attentionUnitMinutes: 15,
    };
  });

  const [selectedNode, setSelectedNodeState] = useState<Node | null>(null);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [pendingCascade, setPendingCascade] = useState<CascadeImpactPreview | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Idea Seeds and Activity Log states
  const [ideaSeeds, setIdeaSeeds] = useState<IdeaSeed[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);

  // Attention Measurement & Active Work Session state
  const [activeWorkSession, setActiveWorkSession] = useState<ActiveWorkSession | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('graphdule_active_work_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [activeWorkElapsedSeconds, setActiveWorkElapsedSeconds] = useState<number>(0);
  const [attentionReviews, setAttentionReviews] = useState<WeeklyAttentionReviewRecord[]>([]);

  // Live second-by-second ticker for running work clock
  useEffect(() => {
    if (!activeWorkSession) {
      setActiveWorkElapsedSeconds(0);
      return;
    }

    const computeElapsed = () => {
      const baseAccum = activeWorkSession.accumulatedSecondsBeforeResume || 0;
      if (activeWorkSession.isPaused) {
        return Math.floor(baseAccum);
      }
      const ref = activeWorkSession.lastResumedAt || activeWorkSession.startedAt;
      const running = Math.max(0, (Date.now() - new Date(ref).getTime()) / 1000);
      return Math.floor(baseAccum + running);
    };

    setActiveWorkElapsedSeconds(computeElapsed());
    const interval = setInterval(() => {
      setActiveWorkElapsedSeconds(computeElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkSession]);

  // Cloud Sync state
  const [cloudSyncState, setCloudSyncState] = useState<SyncState>(() => SyncCoordinator.getState());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Google Calendar state
  const [gcalendarSyncConfig, setGcalendarSyncConfigState] = useState<GCalendarSyncConfig>(() => GCalendarSync.getConfig());
  const [availableGCalendars, setAvailableGCalendars] = useState<GCalendarItem[]>([]);

  // Undo & Redo state and manager (100 actions cap)
  const undoRedoManagerRef = useRef<UndoRedoManager>(new UndoRedoManager(MAX_HISTORY_SIZE));
  const isPerformingUndoRedoRef = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const activeProjectDocRef = useRef<ProjectDocument | null>(activeProjectDoc);

  useEffect(() => {
    activeProjectDocRef.current = activeProjectDoc;
    if (activeProjectDoc) {
      setCanUndo(undoRedoManagerRef.current.canUndo(activeProjectDoc.project.id));
      setCanRedo(undoRedoManagerRef.current.canRedo(activeProjectDoc.project.id));
    } else {
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [activeProjectDoc]);

  useEffect(() => {
    const unsubscribe = SyncCoordinator.subscribe((state) => {
      setCloudSyncState(state);
    });
    return unsubscribe;
  }, []);

  const syncDebounceTimerRef = useRef<any>(null);
  const triggerCloudSyncRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const debouncedCloudSync = useCallback(() => {
    if (SyncCoordinator.getState().provider === 'none') return;
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
    }
    syncDebounceTimerRef.current = setTimeout(() => {
      triggerCloudSyncRef.current().catch(() => {});
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
    };
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
      debouncedCloudSync();
    },
    [preferences, storage, debouncedCloudSync]
  );

  const toggleDateFormat = useCallback(async () => {
    const nextFormat: DateDisplayFormat =
      preferences.dateFormat === 'MMM_D_YYYY' ? 'DD/MM/YYYY' : 'MMM_D_YYYY';
    await updatePreferences({ dateFormat: nextFormat });
  }, [preferences.dateFormat, updatePreferences]);

  const recordActiveNode = useCallback(
    async (node: Node, projectId?: string) => {
      const pId = projectId || node.projectId || activeProjectDoc?.project.id;
      const timestamp = new Date().toISOString();
      try {
        localStorage.setItem(
          'graphdule_last_active_node',
          JSON.stringify({
            nodeId: node.id,
            projectId: pId,
            timestamp,
          })
        );
        updatePreferences({
          lastActiveNodeId: node.id,
          lastActiveProjectId: pId,
          lastActiveTimestamp: timestamp,
        });
      } catch {
        // ignore localStorage errors
      }

      // 1. Update preferences (synchronized via preferences.json)
      await updatePreferences({
        lastActiveNodeId: node.id,
        lastActiveProjectId: pId,
        lastActiveTimestamp: timestamp,
      });

      // 2. Update in-memory activeProjectDoc state functionally
      setActiveProjectDoc((prev) => {
        if (!prev || prev.project.id !== pId) return prev;
        if (prev.project.lastActiveNodeId === node.id) return prev;
        return {
          ...prev,
          project: {
            ...prev.project,
            lastActiveNodeId: node.id,
          },
          exportedAt: timestamp,
        };
      });

      // 3. Update project JSON on storage (synchronized via project_{id}.json)
      if (activeProjectDoc && pId === activeProjectDoc.project.id) {
        const doc = await storage.readProject(activeProjectDoc.project.id);
        if (doc && doc.project.lastActiveNodeId !== node.id) {
          const updatedDoc: ProjectDocument = {
            ...doc,
            project: {
              ...doc.project,
              lastActiveNodeId: node.id,
            },
            exportedAt: timestamp,
          };
          await storage.writeProject(updatedDoc);
        }
      }
    },
    [activeProjectDoc, storage, updatePreferences]
  );

  const setSelectedNode = useCallback(
    (node: Node | null) => {
      setSelectedNodeState(node);
      if (node) {
        recordActiveNode(node).catch(() => {});
      }
    },
    [recordActiveNode]
  );

  // Initialize storage and load initial state
  const refreshData = useCallback(async () => {
    await storage.init();
    let projList = await storage.listProjects();

    // Default sample project seed if no projects exist yet and never deleted/imported
    if (projList.length === 0 && localStorage.getItem('graphdule_sample_deleted') !== 'true') {
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

    if (storage.readIdeaSeeds) {
      const seeds = await storage.readIdeaSeeds();
      setIdeaSeeds(seeds);
    }
    if (storage.readActivityLog) {
      const events = await storage.readActivityLog();
      setActivityLog(events);
    }
    if (storage.readAttentionReviews) {
      const reviews = await storage.readAttentionReviews();
      setAttentionReviews(reviews);
    }

    if (prefs.activeWorkSession && !activeWorkSession) {
      setActiveWorkSession(prefs.activeWorkSession);
      try {
        localStorage.setItem('graphdule_active_work_session', JSON.stringify(prefs.activeWorkSession));
      } catch {
        // ignore
      }
    }

    // Check if activeProjectDoc was updated externally in storage (e.g. from cloud sync or merge)
    if (activeProjectDoc) {
      const freshActiveDoc = await storage.readProject(activeProjectDoc.project.id);
      if (freshActiveDoc) {
        const freshTime = new Date(freshActiveDoc.project.updatedAt || freshActiveDoc.exportedAt || 0).getTime();
        const currTime = new Date(activeProjectDoc.project.updatedAt || activeProjectDoc.exportedAt || 0).getTime();
        if (freshTime > currTime) {
          setActiveProjectDoc(freshActiveDoc);
        }
      }
    }

    // Read and combine nodes from ALL active (non-archived, non-parked) projects
    const activeProjectSummaries = projList.filter((p) => !p.isArchived && !p.isParked);
    const docs = await Promise.all(
      activeProjectSummaries.map(async (p) => {
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

    if (activeProjectDoc && !projList.some((p) => p.id === activeProjectDoc.project.id)) {
      setActiveProjectDoc(null);
    }

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
    async (projectId: string, nodeToSelect?: Node | string | null) => {
      const doc = await storage.readProject(projectId);
      if (doc) {
        setActiveProjectDoc(doc);
        setCurrentView('project_detail');
        if (nodeToSelect !== undefined) {
          if (typeof nodeToSelect === 'string') {
            const found = doc.nodes.find((n) => n.id === nodeToSelect) || null;
            setSelectedNode(found);
          } else if (nodeToSelect) {
            const found = doc.nodes.find((n) => n.id === nodeToSelect.id) || nodeToSelect;
            setSelectedNode(found);
          } else {
            setSelectedNode(null);
          }
        } else {
          setSelectedNode(null);
        }
        await loadProjectSnapshots(projectId);
        setCanUndo(undoRedoManagerRef.current.canUndo(projectId));
        setCanRedo(undoRedoManagerRef.current.canRedo(projectId));
      }
    },
    [storage, loadProjectSnapshots, setSelectedNode]
  );

  const lastActiveNode = useMemo((): { node: Node; project: ProjectSummary } | null => {
    if (projects.length === 0) return null;
    const activeProjectsMap = new Map(
      projects.filter((p) => !p.isArchived && !p.isParked).map((p) => [p.id, p])
    );
    if (activeProjectsMap.size === 0) return null;

    const allNodesMap = new Map(allActiveNodes.map((n) => [n.id, n]));

    // Priority 1: Check preferences.lastActiveNodeId (synchronized JSON via preferences.json)
    const targetNodeId = preferences.lastActiveNodeId;
    const targetProjectId = preferences.lastActiveProjectId;
    if (targetNodeId) {
      const node = allNodesMap.get(targetNodeId);
      if (node) {
        const pId = node.projectId || targetProjectId;
        if (pId && activeProjectsMap.has(pId)) {
          return { node, project: activeProjectsMap.get(pId)! };
        }
      }
    }

    // Priority 2: Check localStorage
    try {
      const stored = localStorage.getItem('graphdule_last_active_node');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.nodeId) {
          const node = allNodesMap.get(parsed.nodeId);
          if (node) {
            const pId = node.projectId || parsed.projectId;
            if (pId && activeProjectsMap.has(pId)) {
              return { node, project: activeProjectsMap.get(pId)! };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Priority 3: Check activityLog (most recent node event in an active project)
    for (let i = activityLog.length - 1; i >= 0; i--) {
      const ev = activityLog[i];
      if (ev.entityId && allNodesMap.has(ev.entityId)) {
        const node = allNodesMap.get(ev.entityId)!;
        const pId = node.projectId || ev.projectId;
        if (pId && activeProjectsMap.has(pId)) {
          return { node, project: activeProjectsMap.get(pId)! };
        }
      }
    }

    // Priority 4: Fallback to the node with latest updatedAt / createdAt across all active nodes
    if (allActiveNodes.length > 0) {
      const eligibleNodes = allActiveNodes.filter(
        (n) => n.projectId && activeProjectsMap.has(n.projectId)
      );
      if (eligibleNodes.length > 0) {
        const sorted = [...eligibleNodes].sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        const latest = sorted[0];
        return { node: latest, project: activeProjectsMap.get(latest.projectId!)! };
      }
    }

    return null;
  }, [preferences.lastActiveNodeId, preferences.lastActiveProjectId, projects, allActiveNodes, activityLog]);

  const goToLastActivityNode = useCallback(async (): Promise<boolean> => {
    if (!lastActiveNode) return false;
    const { node, project } = lastActiveNode;

    await openProject(project.id, node);
    setCurrentView('project_detail');
    setActiveProjectTab('graph');
    return true;
  }, [lastActiveNode, openProject]);


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
      const prevDoc = activeProjectDocRef.current;
      // Record previous state into UndoRedoManager before applying changes
      if (
        !isPerformingUndoRedoRef.current &&
        prevDoc &&
        prevDoc.project.id === updatedDoc.project.id
      ) {
        undoRedoManagerRef.current.record(prevDoc);
        setCanUndo(undoRedoManagerRef.current.canUndo(updatedDoc.project.id));
        setCanRedo(undoRedoManagerRef.current.canRedo(updatedDoc.project.id));
      }

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
      debouncedCloudSync();
    },
    [storage, debouncedCloudSync]
  );

  const undo = useCallback(async () => {
    const currentDoc = activeProjectDocRef.current;
    if (!currentDoc) return;
    const projectId = currentDoc.project.id;
    if (!undoRedoManagerRef.current.canUndo(projectId)) return;

    isPerformingUndoRedoRef.current = true;
    try {
      const restored = undoRedoManagerRef.current.undo(currentDoc);
      if (restored) {
        await storage.writeProject(restored);
        setActiveProjectDoc(restored);

        const projList = await storage.listProjects();
        setProjects(projList);

        // Keep selectedNode in sync
        setSelectedNodeState((prev) => {
          if (!prev) return null;
          return restored.nodes.find((n) => n.id === prev.id) || null;
        });

        setCanUndo(undoRedoManagerRef.current.canUndo(projectId));
        setCanRedo(undoRedoManagerRef.current.canRedo(projectId));
      }
    } finally {
      isPerformingUndoRedoRef.current = false;
    }
  }, [storage]);

  const redo = useCallback(async () => {
    const currentDoc = activeProjectDocRef.current;
    if (!currentDoc) return;
    const projectId = currentDoc.project.id;
    if (!undoRedoManagerRef.current.canRedo(projectId)) return;

    isPerformingUndoRedoRef.current = true;
    try {
      const restored = undoRedoManagerRef.current.redo(currentDoc);
      if (restored) {
        await storage.writeProject(restored);
        setActiveProjectDoc(restored);

        const projList = await storage.listProjects();
        setProjects(projList);

        setSelectedNodeState((prev) => {
          if (!prev) return null;
          return restored.nodes.find((n) => n.id === prev.id) || null;
        });

        setCanUndo(undoRedoManagerRef.current.canUndo(projectId));
        setCanRedo(undoRedoManagerRef.current.canRedo(projectId));
      }
    } finally {
      isPerformingUndoRedoRef.current = false;
    }
  }, [storage]);

  // Global Keyboard Shortcuts for Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      if (!isModifier) return;

      // Bypass when typing inside native inputs, textareas, or contentEditable elements
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isInput) return;

      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z (Cmd+Z) without Shift
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo().catch((err) => console.warn('[UndoRedo] Undo error:', err));
        return;
      }

      // Redo: Ctrl+Y (Cmd+Y) OR Ctrl+Shift+Z (Cmd+Shift+Z)
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo().catch((err) => console.warn('[UndoRedo] Redo error:', err));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
      const archiveStatus = reason === 'completed' || reason === 'abandoned' ? reason : 'archived';
      const updatedProject = ProjectService.archiveProject(
        doc.project,
        archiveStatus
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
      undoRedoManagerRef.current.clearProject(projectId);
      if (projectId === DEFAULT_SAMPLE_PROJECT_ID) {
        localStorage.setItem('graphdule_sample_deleted', 'true');
      }
      SyncCoordinator.recordProjectDeletion(projectId);
      await storage.deleteProject(projectId);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(null);
        setCurrentView('projects');
      }
      await refreshData();
      debouncedCloudSync();
    },
    [storage, activeProjectDoc, refreshData, debouncedCloudSync]
  );

  // Priority Attention Management
  const maxAttentionProjects = preferences.maxAttentionProjects || 3;

  const attentionProjects = useMemo(() => {
    const activeAttention = projects.filter((p) => p.isAttention && !p.isArchived && !p.isParked);
    return ProjectService.sortAttentionProjects(activeAttention);
  }, [projects]);

  const logActivityEvent = useCallback(
    async (
      type: ActivityEventType,
      entityId: string,
      options?: {
        entityText?: string;
        projectId?: string;
        projectName?: string;
        fromStatus?: string;
        toStatus?: string;
        oldDueDate?: string;
        newDueDate?: string;
        metadata?: Record<string, unknown>;
      }
    ) => {
      try {
        const event = ActivityLogService.createEvent(type, entityId, options);
        if (storage.appendActivityEvents) {
          await storage.appendActivityEvents([event]);
        }
        setActivityLog((prev) => [...prev, event]);
      } catch (e) {
        console.warn('[AppContext] Failed to log activity event:', e);
      }
    },
    [storage]
  );

  const exportActivityLogPrompt = useCallback(() => {
    const analysis = ActivityLogService.generatePatternAnalysis(activityLog);
    return analysis.markdownPrompt;
  }, [activityLog]);

  const clearActivityLog = useCallback(async () => {
    if (storage.clearActivityLog) {
      await storage.clearActivityLog();
    }
    setActivityLog([]);
  }, [storage]);

  // Attention Measurement & Work Clock Actions
  const attentionSystemEnabled = !!preferences.attentionSystemEnabled;
  const attentionUnitMinutes = preferences.attentionUnitMinutes || 15;
  const weeklyPlannedAU = preferences.weeklyPlannedAU;

  const toggleAttentionSystem = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({ attentionSystemEnabled: enabled });
      await logActivityEvent(enabled ? 'ATTENTION_SYSTEM_TOGGLED' : 'attention_system_toggled', 'system', {
        entityText: `Attention measurement system ${enabled ? 'enabled' : 'disabled'}`,
        metadata: { enabled },
      });
      debouncedCloudSync();
    },
    [updatePreferences, logActivityEvent, debouncedCloudSync]
  );

  const setAttentionUnitMinutes = useCallback(
    async (minutes: number) => {
      const valid = minutes > 0 ? minutes : 15;
      await updatePreferences({ attentionUnitMinutes: valid });
      debouncedCloudSync();
    },
    [updatePreferences, debouncedCloudSync]
  );

  const setWeeklyPlannedAU = useCallback(
    async (au: number | undefined) => {
      await updatePreferences({ weeklyPlannedAU: au });
      await logActivityEvent('WEEKLY_GOAL_SET', 'system', {
        entityText: `Weekly planned attention set to ${au !== undefined ? `${au} AU` : 'none'}`,
        metadata: { plannedAU: au },
      });
      debouncedCloudSync();
    },
    [updatePreferences, logActivityEvent, debouncedCloudSync]
  );

  const stopWork = useCallback(async () => {
    if (!activeWorkSession) return;
    const sessionToStop = activeWorkSession;

    const baseAccum = sessionToStop.accumulatedSecondsBeforeResume || 0;
    let additional = 0;
    if (!sessionToStop.isPaused) {
      const ref = sessionToStop.lastResumedAt || sessionToStop.startedAt;
      additional = Math.max(0, (Date.now() - new Date(ref).getTime()) / 1000);
    }
    const totalDurationSeconds = Math.round(baseAccum + additional);
    const au = AttentionService.durationSecondsToAU(totalDurationSeconds, attentionUnitMinutes);
    const stoppedAt = new Date().toISOString();

    await logActivityEvent('WORK_STOPPED', sessionToStop.taskId, {
      entityText: sessionToStop.taskText,
      projectId: sessionToStop.projectId,
      projectName: sessionToStop.projectName,
      metadata: {
        sessionId: sessionToStop.sessionId,
        durationSeconds: totalDurationSeconds,
        au,
        startedAt: sessionToStop.startedAt,
        stoppedAt,
      },
    });

    setActiveWorkSession(null);
    try {
      localStorage.removeItem('graphdule_active_work_session');
    } catch {
      // ignore
    }
    await updatePreferences({ activeWorkSession: null });
    debouncedCloudSync();
  }, [activeWorkSession, attentionUnitMinutes, logActivityEvent, updatePreferences, debouncedCloudSync]);

  const pauseWork = useCallback(async () => {
    if (!activeWorkSession || activeWorkSession.isPaused) return;

    const now = Date.now();
    const ref = activeWorkSession.lastResumedAt || activeWorkSession.startedAt;
    const segment = Math.max(0, (now - new Date(ref).getTime()) / 1000);
    const totalAccum = (activeWorkSession.accumulatedSecondsBeforeResume || 0) + segment;

    const updatedSession: ActiveWorkSession = {
      ...activeWorkSession,
      accumulatedSecondsBeforeResume: totalAccum,
      isPaused: true,
      lastResumedAt: undefined,
    };

    await logActivityEvent('WORK_PAUSED', activeWorkSession.taskId, {
      entityText: activeWorkSession.taskText,
      projectId: activeWorkSession.projectId,
      projectName: activeWorkSession.projectName,
      metadata: {
        sessionId: activeWorkSession.sessionId,
        durationSeconds: Math.round(totalAccum),
      },
    });

    setActiveWorkSession(updatedSession);
    try {
      localStorage.setItem('graphdule_active_work_session', JSON.stringify(updatedSession));
    } catch {
      // ignore
    }
    await updatePreferences({ activeWorkSession: updatedSession });
    debouncedCloudSync();
  }, [activeWorkSession, logActivityEvent, updatePreferences, debouncedCloudSync]);

  const resumeWork = useCallback(async () => {
    if (!activeWorkSession || !activeWorkSession.isPaused) return;

    const resumedAt = new Date().toISOString();
    const updatedSession: ActiveWorkSession = {
      ...activeWorkSession,
      isPaused: false,
      lastResumedAt: resumedAt,
    };

    await logActivityEvent('WORK_RESUMED', activeWorkSession.taskId, {
      entityText: activeWorkSession.taskText,
      projectId: activeWorkSession.projectId,
      projectName: activeWorkSession.projectName,
      metadata: {
        sessionId: activeWorkSession.sessionId,
      },
    });

    setActiveWorkSession(updatedSession);
    try {
      localStorage.setItem('graphdule_active_work_session', JSON.stringify(updatedSession));
    } catch {
      // ignore
    }
    await updatePreferences({ activeWorkSession: updatedSession });
    debouncedCloudSync();
  }, [activeWorkSession, logActivityEvent, updatePreferences, debouncedCloudSync]);

  const startWork = useCallback(
    async (taskId: string, taskText: string, projectId?: string, projectName?: string) => {
      if (activeWorkSession && activeWorkSession.taskId === taskId) {
        if (activeWorkSession.isPaused) {
          await resumeWork();
        }
        return;
      }

      if (activeWorkSession) {
        await stopWork();
      }

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const startedAt = new Date().toISOString();

      await logActivityEvent('WORK_STARTED', taskId, {
        entityText: taskText,
        projectId,
        projectName,
        metadata: { sessionId },
      });

      const newSession: ActiveWorkSession = {
        sessionId,
        taskId,
        taskText,
        projectId,
        projectName,
        startedAt,
        accumulatedSecondsBeforeResume: 0,
        isPaused: false,
      };

      setActiveWorkSession(newSession);
      try {
        localStorage.setItem('graphdule_active_work_session', JSON.stringify(newSession));
      } catch {
        // ignore
      }
      await updatePreferences({ activeWorkSession: newSession });
      debouncedCloudSync();
    },
    [activeWorkSession, resumeWork, stopWork, logActivityEvent, updatePreferences, debouncedCloudSync]
  );

  const updateTaskEstimate = useCallback(
    async (taskId: string, estimatedAU: number | undefined, projectIdOrIsNode?: string | boolean) => {
      const isExplicitNode = projectIdOrIsNode === true || (typeof projectIdOrIsNode === 'string' && projectIdOrIsNode !== 'standalone');
      if (!isExplicitNode) {
        const standaloneTarget = standaloneTasks.find((t) => t.id === taskId);
        if (standaloneTarget) {
          const oldEstimate = standaloneTarget.estimatedAU;
          const updated = standaloneTasks.map((t) =>
            t.id === taskId ? { ...t, estimatedAU, updatedAt: new Date().toISOString() } : t
          );
          await storage.writeStandaloneTasks(updated);
          setStandaloneTasks(updated);
          await logActivityEvent('ESTIMATE_CHANGED', taskId, {
            entityText: standaloneTarget.text,
            metadata: { oldEstimateAU: oldEstimate, newEstimateAU: estimatedAU },
          });
          debouncedCloudSync();
          return;
        }
      }

      if (activeProjectDoc) {
        const node = activeProjectDoc.nodes.find((n) => n.id === taskId);
        if (node) {
          const hasChildren = activeProjectDoc.nodes.some((n) => n.parentNodeId === taskId);
          if (hasChildren) {
            console.warn(`[AppContext] Cannot directly overwrite estimated AU on parent node ${taskId}. Parent AU is derived from children.`);
            return;
          }
          const oldEstimate = node.estimatedAU;
          const updatedNodes = activeProjectDoc.nodes.map((n) =>
            n.id === taskId ? { ...n, estimatedAU, updatedAt: new Date().toISOString() } : n
          );
          const syncedNodes = AttentionService.syncParentEstimatedAU(updatedNodes);
          await saveProjectDoc({
            ...activeProjectDoc,
            nodes: syncedNodes,
          });
          await logActivityEvent('ESTIMATE_CHANGED', taskId, {
            entityText: node.text,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
            metadata: { oldEstimateAU: oldEstimate, newEstimateAU: estimatedAU },
          });
          debouncedCloudSync();
          return;
        }
      }

      const explicitProjId = typeof projectIdOrIsNode === 'string' && projectIdOrIsNode !== 'standalone' ? projectIdOrIsNode : undefined;
      const projs = await storage.listProjects();
      const searchProjs = explicitProjId ? projs.filter((p) => p.id === explicitProjId) : projs;
      for (const p of searchProjs) {
        const doc = await storage.readProject(p.id);
        if (doc) {
          const node = doc.nodes.find((n) => n.id === taskId);
          if (node) {
            const hasChildren = doc.nodes.some((n) => n.parentNodeId === taskId);
            if (hasChildren) {
              console.warn(`[AppContext] Cannot directly overwrite estimated AU on parent node ${taskId}. Parent AU is derived from children.`);
              return;
            }
            const oldEstimate = node.estimatedAU;
            const updatedNodes = doc.nodes.map((n) =>
              n.id === taskId ? { ...n, estimatedAU, updatedAt: new Date().toISOString() } : n
            );
            const syncedNodes = AttentionService.syncParentEstimatedAU(updatedNodes);
            const updatedDoc: ProjectDocument = { ...doc, nodes: syncedNodes };
            await storage.writeProject(updatedDoc);
            await logActivityEvent('ESTIMATE_CHANGED', taskId, {
              entityText: node.text,
              projectId: doc.project.id,
              projectName: doc.project.name,
              metadata: { oldEstimateAU: oldEstimate, newEstimateAU: estimatedAU },
            });
            await refreshData();
            debouncedCloudSync();
            return;
          }
        }
      }
    },
    [standaloneTasks, activeProjectDoc, storage, logActivityEvent, saveProjectDoc, refreshData, debouncedCloudSync]
  );

  const triggerWeeklyReview = useCallback(
    async (weekStartDate: string, weekEndDate: string, userNotes?: string): Promise<WeeklyAttentionReviewRecord> => {
      const reviewData = AttentionService.generateWeeklyAttentionReview({
        events: activityLog,
        tasks: [...allActiveNodes, ...standaloneTasks],
        projects,
        weekStartDate,
        weekEndDate,
        plannedAU: preferences.weeklyPlannedAU,
        auMinutes: attentionUnitMinutes,
      });

      const record: WeeklyAttentionReviewRecord = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        weekStartDate,
        weekEndDate,
        generatedAt: new Date().toISOString(),
        data: reviewData,
        userNotes,
      };

      const updatedReviews = [record, ...attentionReviews.filter((r) => r.id !== record.id)];
      if (storage.writeAttentionReviews) {
        await storage.writeAttentionReviews(updatedReviews);
      }
      setAttentionReviews(updatedReviews);

      await logActivityEvent('WEEKLY_REVIEW_TRIGGERED', record.id, {
        entityText: `Weekly review triggered for ${weekStartDate} - ${weekEndDate}`,
        metadata: {
          reviewId: record.id,
          weekStartDate,
          weekEndDate,
          trackedAU: reviewData.trackedAU,
        },
      });

      debouncedCloudSync();
      return record;
    },
    [activityLog, allActiveNodes, standaloneTasks, projects, preferences.weeklyPlannedAU, attentionUnitMinutes, attentionReviews, storage, logActivityEvent, debouncedCloudSync]
  );

  const deleteAttentionReview = useCallback(
    async (reviewId: string) => {
      const updated = attentionReviews.filter((r) => r.id !== reviewId);
      if (storage.deleteAttentionReview) {
        await storage.deleteAttentionReview(reviewId);
      } else if (storage.writeAttentionReviews) {
        await storage.writeAttentionReviews(updated);
      }
      setAttentionReviews(updated);
      debouncedCloudSync();
    },
    [attentionReviews, storage, debouncedCloudSync]
  );

  // Idea Parking Lot & Seeds
  const addIdeaSeed = useCallback(
    async (title: string, options?: { rawNotes?: string; seedThoughts?: string[]; tags?: string[] }) => {
      const newSeed = ProjectService.createIdeaSeed(title, options);
      const updated = [newSeed, ...ideaSeeds];
      setIdeaSeeds(updated);
      if (storage.writeIdeaSeeds) {
        await storage.writeIdeaSeeds(updated);
      }
      return newSeed;
    },
    [ideaSeeds, storage]
  );

  const updateIdeaSeed = useCallback(
    async (id: string, updates: Partial<Omit<IdeaSeed, 'id' | 'createdAt'>>) => {
      const existing = ideaSeeds.find((s) => s.id === id);
      if (!existing) return;
      const updatedSeed = ProjectService.updateIdeaSeed(existing, updates);
      const updated = ideaSeeds.map((s) => (s.id === id ? updatedSeed : s));
      setIdeaSeeds(updated);
      if (storage.writeIdeaSeeds) {
        await storage.writeIdeaSeeds(updated);
      }
    },
    [ideaSeeds, storage]
  );

  const deleteIdeaSeed = useCallback(
    async (id: string) => {
      const updated = ideaSeeds.filter((s) => s.id !== id);
      setIdeaSeeds(updated);
      if (storage.deleteIdeaSeed) {
        await storage.deleteIdeaSeed(id);
      } else if (storage.writeIdeaSeeds) {
        await storage.writeIdeaSeeds(updated);
      }
    },
    [ideaSeeds, storage]
  );

  const germinateIdeaSeed = useCallback(
    async (id: string, deadline?: string, style?: ProjectStyle) => {
      const seed = ideaSeeds.find((s) => s.id === id);
      if (!seed) throw new Error('Idea seed not found');

      const { project, egnNode, nodes, edges } = ProjectService.germinateSeedToProject(seed, deadline, style);
      const newDoc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        project,
        nodes,
        edges,
        notes: seed.rawNotes
          ? [
              {
                id: ProjectService.generateId('note'),
                nodeId: egnNode.id,
                text: seed.rawNotes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]
          : [],
        history: [],
      };

      await storage.writeProject(newDoc);
      const { snapshot } = HistoryService.createSnapshot(newDoc, `Germinated from idea seed: ${seed.title}`);
      await storage.writeSnapshot(snapshot);

      await deleteIdeaSeed(id);

      await logActivityEvent('task_created', egnNode.id, {
        entityText: egnNode.text,
        projectId: project.id,
        projectName: project.name,
        metadata: { germinatedFromSeedId: id },
      });

      await refreshData();
      await openProject(project.id);
      return project.id;
    },
    [ideaSeeds, storage, deleteIdeaSeed, logActivityEvent, refreshData, openProject]
  );

  const parkProject = useCallback(
    async (projectId: string) => {
      const doc = await storage.readProject(projectId);
      if (!doc) return;
      const updatedProject = ProjectService.parkProject(doc.project);
      const updatedDoc: ProjectDocument = {
        ...doc,
        project: updatedProject,
        exportedAt: new Date().toISOString(),
      };
      await storage.writeProject(updatedDoc);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(updatedDoc);
      }
      await logActivityEvent('project_parked', projectId, {
        entityText: doc.project.name,
        projectId,
        projectName: doc.project.name,
      });
      await refreshData();
    },
    [storage, activeProjectDoc, logActivityEvent, refreshData]
  );

  const unparkProject = useCallback(
    async (projectId: string) => {
      const doc = await storage.readProject(projectId);
      if (!doc) return;
      const updatedProject = ProjectService.unparkProject(doc.project);
      const updatedDoc: ProjectDocument = {
        ...doc,
        project: updatedProject,
        exportedAt: new Date().toISOString(),
      };
      await storage.writeProject(updatedDoc);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(updatedDoc);
      }
      await logActivityEvent('project_unparked', projectId, {
        entityText: doc.project.name,
        projectId,
        projectName: doc.project.name,
      });
      await refreshData();
    },
    [storage, activeProjectDoc, logActivityEvent, refreshData]
  );

  const toggleProjectAttention = useCallback(
    async (projectId: string) => {
      const doc = await storage.readProject(projectId);
      if (!doc) return { success: false };

      const willBeAttention = !doc.project.isAttention;

      if (willBeAttention) {
        const currentAttentionCount = projects.filter(
          (p) => p.isAttention && !p.isArchived && !p.isParked && p.id !== projectId
        ).length;
        if (currentAttentionCount >= maxAttentionProjects) {
          return { success: false, requiresDemotion: true };
        }
      }

      const updatedProject = ProjectService.setProjectAttention(doc.project, willBeAttention);
      const updatedDoc: ProjectDocument = {
        ...doc,
        project: updatedProject,
        exportedAt: new Date().toISOString(),
      };
      await storage.writeProject(updatedDoc);
      if (activeProjectDoc?.project.id === projectId) {
        setActiveProjectDoc(updatedDoc);
      }

      await logActivityEvent(
        willBeAttention ? 'attention_promoted' : 'attention_demoted',
        projectId,
        {
          entityText: doc.project.name,
          projectId,
          projectName: doc.project.name,
        }
      );

      await refreshData();
      return { success: true };
    },
    [storage, projects, maxAttentionProjects, activeProjectDoc, logActivityEvent, refreshData]
  );

  const swapProjectAttention = useCallback(
    async (promoteProjectId: string, demoteProjectId: string) => {
      const promoteDoc = await storage.readProject(promoteProjectId);
      const demoteDoc = await storage.readProject(demoteProjectId);
      if (!promoteDoc || !demoteDoc) return;

      const demotedProject = ProjectService.setProjectAttention(demoteDoc.project, false);
      await storage.writeProject({
        ...demoteDoc,
        project: demotedProject,
        exportedAt: new Date().toISOString(),
      });
      await logActivityEvent('attention_demoted', demoteProjectId, {
        entityText: demoteDoc.project.name,
        projectId: demoteProjectId,
        projectName: demoteDoc.project.name,
      });

      const promotedProject = ProjectService.setProjectAttention(promoteDoc.project, true);
      await storage.writeProject({
        ...promoteDoc,
        project: promotedProject,
        exportedAt: new Date().toISOString(),
      });
      await logActivityEvent('attention_promoted', promoteProjectId, {
        entityText: promoteDoc.project.name,
        projectId: promoteProjectId,
        projectName: promoteDoc.project.name,
      });

      if (activeProjectDoc?.project.id === promoteProjectId) {
        setActiveProjectDoc({ ...promoteDoc, project: promotedProject });
      } else if (activeProjectDoc?.project.id === demoteProjectId) {
        setActiveProjectDoc({ ...demoteDoc, project: demotedProject });
      }

      await refreshData();
    },
    [storage, activeProjectDoc, logActivityEvent, refreshData]
  );

  const addNode = useCallback(
    async (
      text: string,
      dueDate: string = getTodayString(),
      parentNodeId?: string | null,
      position?: { x: number; y: number },
      estimatedAU?: number
    ): Promise<Node | null> => {
      if (!activeProjectDoc) return null;
      const effectiveDueDate = dueDate || getTodayString();
      const newNode = ProjectService.createNode(
        activeProjectDoc.project.id,
        text,
        effectiveDueDate,
        parentNodeId,
        position,
        estimatedAU
      );
      const updatedDoc: ProjectDocument = {
        ...activeProjectDoc,
        project: {
          ...activeProjectDoc.project,
          lastActiveNodeId: newNode.id,
        },
        nodes: [...activeProjectDoc.nodes, newNode],
      };
      await saveProjectDoc(updatedDoc);

      logActivityEvent('task_created', newNode.id, {
        entityText: newNode.text,
        projectId: activeProjectDoc.project.id,
        projectName: activeProjectDoc.project.name,
      }).catch(() => {});
      logActivityEvent('TASK_CREATED', newNode.id, {
        entityText: newNode.text,
        projectId: activeProjectDoc.project.id,
        projectName: activeProjectDoc.project.name,
        metadata: { estimatedAU },
      }).catch(() => {});
      if (estimatedAU !== undefined && estimatedAU > 0) {
        logActivityEvent('ESTIMATE_CHANGED', newNode.id, {
          entityText: newNode.text,
          projectId: activeProjectDoc.project.id,
          metadata: { newAU: estimatedAU },
        }).catch(() => {});
      }

      recordActiveNode(newNode, activeProjectDoc.project.id).catch(() => {});

      if (newNode.dueDate) {
        GCalendarSync.syncTaskDateChange({
          taskId: newNode.id,
          newDueDate: newNode.dueDate,
          taskText: newNode.text,
          status: newNode.status,
          projectId: activeProjectDoc.project.id,
          projectName: activeProjectDoc.project.name,
        }).catch((err) => console.warn('[AppContext] Calendar sync on addNode failed:', err));
      }
      return newNode;
    },
    [activeProjectDoc, saveProjectDoc, logActivityEvent, recordActiveNode]
  );

  const updateNode = useCallback(
    async (updatedNode: Node) => {
      if (!activeProjectDoc) return;

      // Invariant: When any child node is in progress, the parent node is also in progress, this behavior cannot be modified
      if (updatedNode.status !== 'in_progress') {
        const canModify = ProjectService.canModifyNodeStatus(activeProjectDoc.nodes, updatedNode.id, updatedNode.status);
        if (!canModify.allowed) {
          console.warn(canModify.reason);
          return;
        }
      }

      const prevNode = activeProjectDoc.nodes.find((n) => n.id === updatedNode.id);
      let updatedNodes = activeProjectDoc.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));

      let affectedParentIds: string[] = [];
      if (updatedNode.status === 'in_progress') {
        const inProgressCascade = ProjectService.cascadeParentInProgress(updatedNodes, updatedNode.id);
        updatedNodes = inProgressCascade.updatedNodes;
        affectedParentIds = inProgressCascade.inProgressParentIds;
      } else if (updatedNode.status === 'completed') {
        const cascadeResult = ProjectService.cascadeParentCompletion(updatedNodes, updatedNode.id);
        updatedNodes = cascadeResult.updatedNodes;
        affectedParentIds = cascadeResult.completedParentIds;
      }

      const hierarchySync = ProjectService.syncParentStatusHierarchy(updatedNodes);
      updatedNodes = hierarchySync.updatedNodes;
      for (const id of hierarchySync.affectedParentIds) {
        if (!affectedParentIds.includes(id)) {
          affectedParentIds.push(id);
        }
      }

      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: updatedNodes,
      });

      if (selectedNode?.id === updatedNode.id) {
        setSelectedNode(updatedNode);
      } else {
        recordActiveNode(updatedNode, activeProjectDoc.project.id).catch(() => {});
      }

      if (prevNode) {
        if (prevNode.dueDate !== updatedNode.dueDate) {
          logActivityEvent('date_moved', updatedNode.id, {
            entityText: updatedNode.text,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
            oldDueDate: prevNode.dueDate,
            newDueDate: updatedNode.dueDate,
          }).catch(() => {});
          logActivityEvent('TASK_DEFERRED', updatedNode.id, {
            entityText: updatedNode.text,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
            oldDueDate: prevNode.dueDate,
            newDueDate: updatedNode.dueDate,
          }).catch(() => {});
          logActivityEvent('DEADLINE_CHANGED', updatedNode.id, {
            entityText: updatedNode.text,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
            oldDueDate: prevNode.dueDate,
            newDueDate: updatedNode.dueDate,
          }).catch(() => {});

          GCalendarSync.syncTaskDateChange({
            taskId: updatedNode.id,
            newDueDate: updatedNode.dueDate,
            taskText: updatedNode.text,
            status: updatedNode.status,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
          }).catch((err) => console.warn('[AppContext] Calendar sync on updateNode date change failed:', err));
        } else if (prevNode.text !== updatedNode.text || prevNode.status !== updatedNode.status) {
          if (prevNode.status !== updatedNode.status) {
            logActivityEvent('status_changed', updatedNode.id, {
              entityText: updatedNode.text,
              projectId: activeProjectDoc.project.id,
              projectName: activeProjectDoc.project.name,
              fromStatus: prevNode.status,
              toStatus: updatedNode.status,
            }).catch(() => {});

            if (updatedNode.status === 'completed') {
              logActivityEvent('task_completed', updatedNode.id, {
                entityText: updatedNode.text,
                projectId: activeProjectDoc.project.id,
                projectName: activeProjectDoc.project.name,
                metadata: { isAttentionProject: activeProjectDoc.project.isAttention },
              }).catch(() => {});
              logActivityEvent('TASK_COMPLETED', updatedNode.id, {
                entityText: updatedNode.text,
                projectId: activeProjectDoc.project.id,
                projectName: activeProjectDoc.project.name,
                metadata: { isAttentionProject: activeProjectDoc.project.isAttention },
              }).catch(() => {});
              if (activeWorkSession?.taskId === updatedNode.id) {
                stopWork().catch(() => {});
              }
            } else if (updatedNode.status === 'abandoned') {
              logActivityEvent('TASK_ABANDONED', updatedNode.id, {
                entityText: updatedNode.text,
                projectId: activeProjectDoc.project.id,
                projectName: activeProjectDoc.project.name,
              }).catch(() => {});
              if (activeWorkSession?.taskId === updatedNode.id) {
                stopWork().catch(() => {});
              }
            }
          }

          GCalendarSync.syncTaskStatusOrTextChange({
            taskId: updatedNode.id,
            taskText: updatedNode.text,
            status: updatedNode.status,
            dueDate: updatedNode.dueDate,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
          }).catch((err) => console.warn('[AppContext] Calendar sync on updateNode status/text change failed:', err));
        }
      }

      for (const parentId of affectedParentIds) {
        const pNode = updatedNodes.find((n) => n.id === parentId);
        if (pNode) {
          if (pNode.status === 'completed') {
            logActivityEvent('task_completed', pNode.id, {
              entityText: pNode.text,
              projectId: activeProjectDoc.project.id,
              projectName: activeProjectDoc.project.name,
              metadata: { isAttentionProject: activeProjectDoc.project.isAttention, cascaded: true },
            }).catch(() => {});
          } else if (pNode.status === 'in_progress') {
            logActivityEvent('status_changed', pNode.id, {
              entityText: pNode.text,
              projectId: activeProjectDoc.project.id,
              projectName: activeProjectDoc.project.name,
              toStatus: 'in_progress',
              metadata: { isAttentionProject: activeProjectDoc.project.isAttention, cascaded: true },
            }).catch(() => {});
          }

          GCalendarSync.syncTaskStatusOrTextChange({
            taskId: pNode.id,
            taskText: pNode.text,
            status: pNode.status,
            dueDate: pNode.dueDate,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
          }).catch((err) => console.warn('[AppContext] Calendar sync on parent cascade failed:', err));
        }
      }
    },
    [activeProjectDoc, selectedNode, saveProjectDoc, logActivityEvent, setSelectedNode, recordActiveNode]
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      if (!activeProjectDoc) return;
      const res = ProjectService.deleteNodeFromProject(activeProjectDoc, nodeId);
      if (!res.success) {
        alert(res.error);
        return;
      }

      const syncedNodes = AttentionService.syncParentEstimatedAU(res.document.nodes);
      await saveProjectDoc({
        ...res.document,
        nodes: syncedNodes,
      });
      GCalendarSync.syncTaskDelete(nodeId).catch(() => {});

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
          // Invariant check: cannot modify status away from in_progress if any child is in progress
          const canModify = ProjectService.canModifyNodeStatus(activeProjectDoc.nodes, nodeId, status);
          if (!canModify.allowed) {
            console.warn(canModify.reason);
            return;
          }

          const updated = ProjectService.updateNodeStatus(node, status);
          await updateNode(updated);
          GCalendarSync.syncTaskStatusOrTextChange({
            taskId: nodeId,
            taskText: node.text,
            status,
            dueDate: node.dueDate,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
          }).catch(() => {});
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
            // Invariant check: cannot modify status away from in_progress if any child is in progress
            const canModify = ProjectService.canModifyNodeStatus(doc.nodes, nodeId, status);
            if (!canModify.allowed) {
              console.warn(canModify.reason);
              return;
            }

            const updatedNode = ProjectService.updateNodeStatus(targetNode, status);
            let updatedNodes = doc.nodes.map((n) => (n.id === nodeId ? updatedNode : n));
            let affectedParentIds: string[] = [];

            if (status === 'in_progress') {
              const inProgressCascade = ProjectService.cascadeParentInProgress(updatedNodes, nodeId);
              updatedNodes = inProgressCascade.updatedNodes;
              affectedParentIds = inProgressCascade.inProgressParentIds;
            } else if (status === 'completed') {
              const cascadeResult = ProjectService.cascadeParentCompletion(updatedNodes, nodeId);
              updatedNodes = cascadeResult.updatedNodes;
              affectedParentIds = cascadeResult.completedParentIds;
            }

            const hierarchySync = ProjectService.syncParentStatusHierarchy(updatedNodes);
            updatedNodes = hierarchySync.updatedNodes;
            for (const id of hierarchySync.affectedParentIds) {
              if (!affectedParentIds.includes(id)) {
                affectedParentIds.push(id);
              }
            }

            const updatedDoc: ProjectDocument = { ...doc, nodes: updatedNodes };
            await storage.writeProject(updatedDoc);
            if (activeProjectDoc && activeProjectDoc.project.id === p.id) {
              setActiveProjectDoc(updatedDoc);
            }
            recordActiveNode(updatedNode, doc.project.id).catch(() => {});
            GCalendarSync.syncTaskStatusOrTextChange({
              taskId: nodeId,
              taskText: targetNode.text,
              status,
              dueDate: targetNode.dueDate,
              projectId: doc.project.id,
              projectName: doc.project.name,
            }).catch(() => {});
            for (const parentId of affectedParentIds) {
              const pNode = updatedNodes.find((n) => n.id === parentId);
              if (pNode) {
                GCalendarSync.syncTaskStatusOrTextChange({
                  taskId: pNode.id,
                  taskText: pNode.text,
                  status: pNode.status,
                  dueDate: pNode.dueDate,
                  projectId: doc.project.id,
                  projectName: doc.project.name,
                }).catch(() => {});
              }
            }
            await refreshData();
            return;
          }
        }
      }
    },
    [activeProjectDoc, updateNode, storage, refreshData, recordActiveNode]
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
          GCalendarSync.syncTaskDateChange({
            taskId: nodeId,
            newDueDate,
            taskText: node.text,
            status: node.status,
            projectId: activeProjectDoc.project.id,
            projectName: activeProjectDoc.project.name,
          }).catch((err) => console.warn('[AppContext] Calendar sync on moveNodeDate failed:', err));
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
            GCalendarSync.syncTaskDateChange({
              taskId: nodeId,
              newDueDate,
              taskText: node.text,
              status: node.status,
              projectId: doc.project.id,
              projectName: doc.project.name,
            }).catch((err) => console.warn('[AppContext] Calendar sync on moveNodeDate failed:', err));
            await refreshData();
            return;
          }
        }
      }

      // Search across standalone tasks
      const standalones = await storage.readStandaloneTasks();
      const stIdx = standalones.findIndex((s) => s.id === nodeId);
      if (stIdx >= 0) {
        const st = standalones[stIdx];
        const updatedStandalones = [...standalones];
        updatedStandalones[stIdx] = {
          ...st,
          dueDate: newDueDate,
          updatedAt: new Date().toISOString(),
        };
        await storage.writeStandaloneTasks(updatedStandalones);
        setStandaloneTasks(updatedStandalones);
        GCalendarSync.syncTaskDateChange({
          taskId: nodeId,
          newDueDate,
          taskText: st.text,
          status: st.status,
          projectId: 'standalone',
          projectName: 'Standalone Tasks',
        }).catch((err) => console.warn('[AppContext] Calendar sync on moveNodeDate standalone failed:', err));
        await refreshData();
        return;
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
    for (const node of updatedNodes) {
      if (node.dueDate) {
        GCalendarSync.syncTaskDateChange({
          taskId: node.id,
          newDueDate: node.dueDate,
          taskText: node.text,
          status: node.status,
          projectId: activeProjectDoc.project.id,
          projectName: activeProjectDoc.project.name,
        }).catch(() => {});
      }
    }
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

  const spliceNodeIntoEdge = useCallback(
    async (
      nodeId: string,
      edgeId: string,
      newPosition?: { x: number; y: number }
    ): Promise<{ success: boolean; error?: string }> => {
      if (!activeProjectDoc) return { success: false, error: 'No active project' };

      const edge = activeProjectDoc.edges.find((e) => e.id === edgeId);
      if (!edge) return { success: false, error: 'Edge not found' };

      const node = activeProjectDoc.nodes.find((n) => n.id === nodeId);
      const fromNode = activeProjectDoc.nodes.find((n) => n.id === edge.fromNodeId);
      const toNode = activeProjectDoc.nodes.find((n) => n.id === edge.toNodeId);
      if (!node || !fromNode || !toNode) {
        return { success: false, error: 'One or more connected nodes do not exist.' };
      }

      if (node.id === fromNode.id || node.id === toNode.id) {
        return { success: false, error: 'Cannot insert node into its own edge.' };
      }

      // Check cycles without the old edge
      const remainingEdges = activeProjectDoc.edges.filter((e) => e.id !== edgeId);
      if (
        GraphService.wouldCreateCycle(fromNode.id, node.id, remainingEdges) ||
        GraphService.wouldCreateCycle(node.id, toNode.id, remainingEdges)
      ) {
        return { success: false, error: 'Connecting this node would create a circular dependency.' };
      }

      // Ensure chronological validity: clamp node.dueDate to [fromNode.dueDate, toNode.dueDate]
      let updatedNode = node;
      let newDueDate = node.dueDate;
      if (isAfter(fromNode.dueDate, newDueDate)) {
        newDueDate = fromNode.dueDate;
      }
      if (isAfter(newDueDate, toNode.dueDate)) {
        newDueDate = toNode.dueDate;
      }
      if (newDueDate !== node.dueDate || newPosition) {
        updatedNode = {
          ...node,
          ...(newPosition ? { position: newPosition } : {}),
          dueDate: newDueDate,
          updatedAt: new Date().toISOString(),
        };
      }

      const updatedNodes = activeProjectDoc.nodes.map((n) =>
        n.id === updatedNode.id ? updatedNode : n
      );

      const edge1Result = ProjectService.createEdge(
        activeProjectDoc.project.id,
        fromNode.id,
        node.id,
        updatedNodes,
        remainingEdges
      );
      if (!edge1Result.success) {
        return { success: false, error: edge1Result.error };
      }

      const edgesWithFirst = [...remainingEdges, edge1Result.edge];
      const edge2Result = ProjectService.createEdge(
        activeProjectDoc.project.id,
        node.id,
        toNode.id,
        updatedNodes,
        edgesWithFirst
      );
      if (!edge2Result.success) {
        return { success: false, error: edge2Result.error };
      }

      const newEdges = [...edgesWithFirst, edge2Result.edge];

      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: updatedNodes,
        edges: newEdges,
      });

      if (newDueDate !== node.dueDate) {
        GCalendarSync.syncTaskDateChange({
          taskId: node.id,
          newDueDate,
          taskText: node.text,
          status: node.status,
          projectId: activeProjectDoc.project.id,
          projectName: activeProjectDoc.project.name,
        }).catch((err) => console.warn('[AppContext] Calendar sync on spliceNodeIntoEdge failed:', err));
      }

      return { success: true };
    },
    [activeProjectDoc, saveProjectDoc]
  );

  const nestNode = useCallback(
    async (
      sourceNodeId: string,
      targetParentId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!activeProjectDoc) return { success: false, error: 'No active project' };

      const sourceNode = activeProjectDoc.nodes.find((n) => n.id === sourceNodeId);
      const targetParent = activeProjectDoc.nodes.find((n) => n.id === targetParentId);

      const result = ProjectService.nestNodeInParent(activeProjectDoc, sourceNodeId, targetParentId);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      await saveProjectDoc(result.document);

      if (sourceNode && targetParent) {
        await logActivityEvent('NODE_NESTED', sourceNodeId, {
          entityText: sourceNode.text,
          projectId: activeProjectDoc.project.id,
          projectName: activeProjectDoc.project.name,
          metadata: {
            targetParentId,
            targetParentText: targetParent.text,
          },
        });
      }

      debouncedCloudSync();
      return { success: true };
    },
    [activeProjectDoc, saveProjectDoc, logActivityEvent, debouncedCloudSync]
  );

  const decomposeNode = useCallback(
    async (parentNodeId: string, subtasks: { text: string; dueDate?: string; estimatedAU?: number }[]) => {
      if (!activeProjectDoc) return;
      const parentNode = activeProjectDoc.nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;

      const newSubnodes = ProjectService.decomposeNode(parentNode, subtasks);
      const combinedNodes = [...activeProjectDoc.nodes, ...newSubnodes];
      const syncedNodes = AttentionService.syncParentEstimatedAU(combinedNodes);
      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: syncedNodes,
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
    const syncedDueDates = TemporalService.syncParentDueDates(activeProjectDoc.nodes);
    const fullySyncedNodes = AttentionService.syncParentEstimatedAU(syncedDueDates);
    const hasChanges = fullySyncedNodes.some(
      (sn, idx) =>
        sn.dueDate !== activeProjectDoc.nodes[idx]?.dueDate ||
        sn.estimatedAU !== activeProjectDoc.nodes[idx]?.estimatedAU
    );
    if (hasChanges) {
      await saveProjectDoc({
        ...activeProjectDoc,
        nodes: fullySyncedNodes,
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
    async (text: string, dueDate?: string, recurrence?: RecurrenceRule, estimatedAU?: number) => {
      const targetDate = dueDate || getTodayString();
      const newTask = MyDayService.createStandaloneTask(text, targetDate, recurrence, estimatedAU);
      const updated = [...standaloneTasks, newTask];
      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);

      logActivityEvent('task_created', newTask.id, {
        entityText: newTask.text,
      }).catch(() => {});
      logActivityEvent('TASK_CREATED', newTask.id, {
        entityText: newTask.text,
        metadata: { estimatedAU },
      }).catch(() => {});
      if (estimatedAU !== undefined && estimatedAU > 0) {
        logActivityEvent('ESTIMATE_CHANGED', newTask.id, {
          entityText: newTask.text,
          metadata: { newAU: estimatedAU },
        }).catch(() => {});
      }

      if (targetDate) {
        GCalendarSync.syncTaskStatusOrTextChange({
          taskId: newTask.id,
          taskText: newTask.text,
          status: newTask.status,
          dueDate: targetDate,
          projectId: 'standalone',
          projectName: 'Standalone Tasks',
        }).catch(() => {});
      }
      debouncedCloudSync();
    },
    [standaloneTasks, storage, logActivityEvent, debouncedCloudSync]
  );

  const updateStandaloneTask = useCallback(
    async (task: StandaloneTask) => {
      const updated = standaloneTasks.map((t) =>
        t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t
      );
      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
      if (activeWorkSession?.taskId === task.id && activeWorkSession.taskText !== task.text) {
        const updatedSession = { ...activeWorkSession, taskText: task.text };
        setActiveWorkSession(updatedSession);
        updatePreferences({ activeWorkSession: updatedSession }).catch(() => {});
      }
      if (task.dueDate) {
        GCalendarSync.syncTaskDateChange({
          taskId: task.id,
          newDueDate: task.dueDate,
          taskText: task.text,
          status: task.status,
          projectId: 'standalone',
          projectName: 'Standalone Tasks',
        }).catch(() => {});
      }
      debouncedCloudSync();
    },
    [standaloneTasks, storage, debouncedCloudSync, activeWorkSession, updatePreferences]
  );

  const updateStandaloneTaskStatus = useCallback(
    async (taskId: string, status: NodeStatus) => {
      const targetTask = standaloneTasks.find((t) => t.id === taskId);
      let updated = standaloneTasks.map((t) =>
        t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t
      );

      if (targetTask && targetTask.status !== status) {
        logActivityEvent('status_changed', taskId, {
          entityText: targetTask.text,
          fromStatus: targetTask.status,
          toStatus: status,
        }).catch(() => {});

        if (status === 'completed') {
          logActivityEvent('task_completed', taskId, {
            entityText: targetTask.text,
          }).catch(() => {});
          logActivityEvent('TASK_COMPLETED', taskId, {
            entityText: targetTask.text,
          }).catch(() => {});
          if (activeWorkSession?.taskId === taskId) {
            stopWork().catch(() => {});
          }
        } else if (status === 'abandoned') {
          logActivityEvent('TASK_ABANDONED', taskId, {
            entityText: targetTask.text,
          }).catch(() => {});
          if (activeWorkSession?.taskId === taskId) {
            stopWork().catch(() => {});
          }
        }
      }

      if (targetTask) {
        GCalendarSync.syncTaskStatusOrTextChange({
          taskId: targetTask.id,
          taskText: targetTask.text,
          status,
          dueDate: targetTask.dueDate,
          projectId: 'standalone',
          projectName: 'Standalone Tasks',
        }).catch(() => {});
      }

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
            if (nextDueDate) {
              GCalendarSync.syncTaskStatusOrTextChange({
                taskId: nextTask.id,
                taskText: nextTask.text,
                status: nextTask.status,
                dueDate: nextDueDate,
                projectId: 'standalone',
                projectName: 'Standalone Tasks',
              }).catch(() => {});
            }
          }
        }
      }

      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
      debouncedCloudSync();
    },
    [standaloneTasks, storage, debouncedCloudSync]
  );

  const deleteStandaloneTask = useCallback(
    async (taskId: string) => {
      SyncCoordinator.recordTaskDeletion(taskId);
      const updated = standaloneTasks.filter((t) => t.id !== taskId);
      await storage.writeStandaloneTasks(updated);
      setStandaloneTasks(updated);
      GCalendarSync.syncTaskDelete(taskId).catch(() => {});
      debouncedCloudSync();
    },
    [standaloneTasks, storage, debouncedCloudSync]
  );

  const completeAndStopWork = useCallback(async () => {
    if (!activeWorkSession) return;
    const { taskId, projectId } = activeWorkSession;
    await stopWork();
    if (projectId === 'standalone' || standaloneTasks.some((t) => t.id === taskId)) {
      await updateStandaloneTaskStatus(taskId, 'completed');
    } else {
      await updateNodeStatus(taskId, 'completed');
    }
  }, [activeWorkSession, stopWork, standaloneTasks, updateStandaloneTaskStatus, updateNodeStatus]);

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
    const seeds = storage.readIdeaSeeds ? await storage.readIdeaSeeds() : [];
    const log = storage.readActivityLog ? await storage.readActivityLog() : [];
    const reviews = storage.readAttentionReviews ? await storage.readAttentionReviews() : [];

    JsonFileProvider.exportFullWorkspaceBackup({
      projects: allDocs,
      standaloneTasks: standalones,
      preferences: prefs,
      ideaSeeds: seeds,
      activityLog: log,
      attentionReviews: reviews,
    });
  }, [storage]);

  const importProjectJson = useCallback(
    async (jsonString: string): Promise<{ success: boolean; error?: string; count?: number }> => {
      const parseResult = JsonFileProvider.parseAnyImportFileContent(jsonString);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      const { payload } = parseResult;

      // When importing projects from a file, remove the initial default sample project if present
      const existingProjects = await storage.listProjects();
      const hasSampleProject = existingProjects.some((p) => p.id === DEFAULT_SAMPLE_PROJECT_ID);
      const importingSampleDirectly =
        (payload.type === 'project' && payload.document.project.id === DEFAULT_SAMPLE_PROJECT_ID) ||
        (payload.type !== 'project' && payload.projects.some((p) => p.project.id === DEFAULT_SAMPLE_PROJECT_ID));

      if (hasSampleProject && !importingSampleDirectly) {
        await storage.deleteProject(DEFAULT_SAMPLE_PROJECT_ID);
        localStorage.setItem('graphdule_sample_deleted', 'true');
        if (activeProjectDoc?.project.id === DEFAULT_SAMPLE_PROJECT_ID) {
          setActiveProjectDoc(null);
        }
      }

      if (payload.type === 'workspace') {
        for (const doc of payload.projects) {
          await storage.writeProject(doc);
          const { snapshot } = HistoryService.createSnapshot(doc, 'Restored from full workspace backup');
          await storage.writeSnapshot(snapshot);
        }

        if (payload.standaloneTasks && payload.standaloneTasks.length > 0) {
          const currentStandalones = await storage.readStandaloneTasks();
          const mergedIds = new Set(payload.standaloneTasks.map((t) => t.id));
          const existingFiltered = currentStandalones.filter((t) => !mergedIds.has(t.id));
          const combined = [...existingFiltered, ...payload.standaloneTasks];
          await storage.writeStandaloneTasks(combined);
          setStandaloneTasks(combined);
        }

        if (payload.ideaSeeds && payload.ideaSeeds.length > 0 && storage.writeIdeaSeeds) {
          const currentSeeds = storage.readIdeaSeeds ? await storage.readIdeaSeeds() : [];
          const mergedIds = new Set(payload.ideaSeeds.map((s) => s.id));
          const existingFiltered = currentSeeds.filter((s) => !mergedIds.has(s.id));
          const combined = [...existingFiltered, ...payload.ideaSeeds];
          await storage.writeIdeaSeeds(combined);
          setIdeaSeeds(combined);
        }

        if (payload.activityLog && payload.activityLog.length > 0 && storage.appendActivityEvents) {
          const currentLog = storage.readActivityLog ? await storage.readActivityLog() : [];
          const currentLogIds = new Set(currentLog.map((e) => e.id));
          const newEvents = payload.activityLog.filter((e) => !currentLogIds.has(e.id));
          if (newEvents.length > 0) {
            await storage.appendActivityEvents(newEvents);
            setActivityLog((prev) => [...prev, ...newEvents]);
          }
        }

        if (payload.attentionReviews && payload.attentionReviews.length > 0 && storage.writeAttentionReviews) {
          const currentReviews = storage.readAttentionReviews ? await storage.readAttentionReviews() : [];
          const currentReviewIds = new Set(currentReviews.map((r) => r.id));
          const newReviews = payload.attentionReviews.filter((r) => !currentReviewIds.has(r.id));
          if (newReviews.length > 0) {
            const combined = [...newReviews, ...currentReviews];
            await storage.writeAttentionReviews(combined);
            setAttentionReviews(combined);
          }
        }

        if (payload.preferences) {
          await updatePreferences(payload.preferences);
        }

        await refreshData();
        if (payload.projects.length > 0) {
          await openProject(payload.projects[0].project.id);
        }
        return { success: true, count: payload.projects.length };
      }

      if (payload.type === 'projects_array') {
        for (const doc of payload.projects) {
          await storage.writeProject(doc);
          const { snapshot } = HistoryService.createSnapshot(doc, 'Imported from project bundle');
          await storage.writeSnapshot(snapshot);
        }
        await refreshData();
        if (payload.projects.length > 0) {
          await openProject(payload.projects[0].project.id);
        }
        return { success: true, count: payload.projects.length };
      }

      // Single project document
      await storage.writeProject(payload.document);
      const { snapshot } = HistoryService.createSnapshot(
        payload.document,
        'Imported from canonical JSON file'
      );
      await storage.writeSnapshot(snapshot);

      await refreshData();
      await openProject(payload.document.project.id);
      return { success: true, count: 1 };
    },
    [storage, refreshData, openProject, updatePreferences, activeProjectDoc]
  );

  const triggerCloudSync = useCallback(async () => {
    const res = await SyncCoordinator.sync(storage);
    if (res.success) {
      await refreshData();
    }
  }, [storage, refreshData]);

  useEffect(() => {
    triggerCloudSyncRef.current = triggerCloudSync;
  }, [triggerCloudSync]);

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

  const setGCalendarSyncConfig = useCallback(async (partial: Partial<GCalendarSyncConfig>) => {
    const updated = GCalendarSync.setConfig(partial);
    setGcalendarSyncConfigState(updated);
  }, []);

  const fetchAvailableGCalendars = useCallback(async () => {
    if (!GDriveAuth.isAuthenticated()) return [];
    try {
      const list = await GCalendarClient.listCalendars();
      setAvailableGCalendars(list);
      return list;
    } catch (err) {
      console.warn('[AppContext] Failed to fetch available Google calendars:', err);
      throw err;
    }
  }, []);

  const triggerGCalendarSync = useCallback(async () => {
    const result = await GCalendarSync.syncAll(storage);
    setGcalendarSyncConfigState(GCalendarSync.getConfig());
    if (result.pulledFromCalendar > 0) {
      await refreshData();
    }
    return result;
  }, [storage, refreshData]);

  const clearAllGCalendarEvents = useCallback(async () => {
    const result = await GCalendarSync.clearAllEventsFromCalendar();
    return result;
  }, []);

  // Background auto-sync on focus, network online, and recurring 60s interval while page is open
  useEffect(() => {
    if (cloudSyncState.provider === 'none') return;

    const onFocus = () => {
      triggerCloudSync();
    };
    const onOnline = () => {
      triggerCloudSync();
    };

    // Periodic idle background sync while webpage is open (default 15m, configurable)
    const idleSyncMinutes = preferences.idleSyncIntervalMinutes ?? 15;
    const intervalMs = Math.max(1, idleSyncMinutes) * 60 * 1000;
    const intervalId = window.setInterval(() => {
      triggerCloudSync();
    }, intervalMs);

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [cloudSyncState.provider, triggerCloudSync, preferences.idleSyncIntervalMinutes]);

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
        lastActiveNode,
        goToLastActivityNode,
        recordActiveNode,
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
        spliceNodeIntoEdge,
        nestNode,
        decomposeNode,
        addNote,
        deleteNote,
        syncAtomicInheritance,
        projectSnapshots,
        createSnapshot,
        restoreSnapshot,
        canUndo,
        canRedo,
        undo,
        redo,
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
        gcalendarSyncConfig,
        setGCalendarSyncConfig,
        triggerGCalendarSync,
        clearAllGCalendarEvents,
        availableGCalendars,
        fetchAvailableGCalendars,
        updatePreferences,
        exportActiveProject,
        exportAllData,
        importProjectJson,
        ideaSeeds,
        addIdeaSeed,
        updateIdeaSeed,
        deleteIdeaSeed,
        germinateIdeaSeed,
        parkProject,
        unparkProject,
        maxAttentionProjects,
        attentionProjects,
        toggleProjectAttention,
        swapProjectAttention,
        activityLog,
        logActivityEvent,
        exportActivityLogPrompt,
        clearActivityLog,
        attentionSystemEnabled,
        attentionUnitMinutes,
        weeklyPlannedAU,
        activeWorkSession,
        activeWorkElapsedSeconds,
        startWork,
        pauseWork,
        resumeWork,
        stopWork,
        completeAndStopWork,
        updateTaskEstimate,
        toggleAttentionSystem,
        setAttentionUnitMinutes,
        setWeeklyPlannedAU,
        attentionReviews,
        triggerWeeklyReview,
        deleteAttentionReview,
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
