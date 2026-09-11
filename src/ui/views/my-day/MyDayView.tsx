import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { MyDayService } from '../../../domain/services/my-day-service';
import { getTodayString, isBefore, isAfter, daysBetween } from '../../../domain/utils/date';
import { CalendarPicker } from '../../components/CalendarPicker';
import { RecurrencePicker } from '../../components/RecurrencePicker';
import {
  Sun,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Folder,
  Clock,
  ChevronRight,
  ChevronDown,
  Calendar,
  ListTodo,
  CalendarDays,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  CalendarCheck,
  Zap,
  Layers,
  List,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Node, NodeStatus, ProjectSummary, RecurrenceRule, StandaloneTask } from '../../../domain/models/types';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';
import { WorkButton } from '../../components/WorkButton';
import { AttentionUnitInput } from '../../components/AttentionUnitInput';
import { AttentionService } from '../../../domain/services/attention-service';

type LateTasksGroupMode = 'hierarchy' | 'attention' | 'time' | 'flat';
type TodayProjectTasksGroupMode = 'hierarchy' | 'attention' | 'flat';
type StandaloneTasksGroupMode = 'schedule' | 'recurrence' | 'flat';

interface ProjectLateHierarchyGroup {
  projectId: string;
  projectName: string;
  project?: ProjectSummary;
  isAttention: boolean;
  rootTasks: Node[];
  subtaskGroups: {
    key: string;
    breadcrumbs: Node[];
    tasks: Node[];
  }[];
  allTasks: Node[];
}

interface TodayProjectHierarchyGroup {
  projectId: string;
  projectName: string;
  project?: ProjectSummary;
  isAttention: boolean;
  rootTasks: Node[];
  subtaskGroups: {
    key: string;
    breadcrumbs: Node[];
    tasks: Node[];
  }[];
  allTasks: Node[];
}

export const MyDayView: React.FC = () => {
  const {
    projects,
    allActiveNodes,
    standaloneTasks,
    preferences,
    updatePreferences,
    openProject,
    updateNodeStatus,
    moveNodeDate,
    addStandaloneTask,
    updateStandaloneTask,
    updateStandaloneTaskStatus,
    deleteStandaloneTask,
    formatDateDisplay,
    refreshData,
    setIsSyncModalOpen,
    gcalendarSyncConfig,
    activityLog,
    updateTaskEstimate,
    openWorkSessionsModal,
  } = useApp();

  const [newStandaloneText, setNewStandaloneText] = useState('');
  const [newStandaloneDueDate, setNewStandaloneDueDate] = useState('');
  const [newStandaloneRecurrence, setNewStandaloneRecurrence] = useState<RecurrenceRule | undefined>(undefined);
  const [newStandaloneEstimatedAU, setNewStandaloneEstimatedAU] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [standaloneFilter, setStandaloneFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [activeCalendarTaskId, setActiveCalendarTaskId] = useState<string | null>(null);
  const [activeRecurrenceTaskId, setActiveRecurrenceTaskId] = useState<string | null>(null);
  const [activeAuTaskId, setActiveAuTaskId] = useState<string | null>(null);
  const [isNewRecurrenceOpen, setIsNewRecurrenceOpen] = useState(false);
  const [isNewAuOpen, setIsNewAuOpen] = useState(false);

  // Standalone task inline name editing
  const [editingStandaloneTaskId, setEditingStandaloneTaskId] = useState<string | null>(null);
  const [editingStandaloneText, setEditingStandaloneText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingStandaloneTaskId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingStandaloneTaskId]);

  // Collapsible & state for Late / Overdue Tasks section
  const [isLateTasksOpen, setIsLateTasksOpen] = useState(false);
  const [activeCalendarLateId, setActiveCalendarLateId] = useState<string | null>(null);
  const [activeCalendarTodayProjectId, setActiveCalendarTodayProjectId] = useState<string | null>(null);

  // Attention-only filter for project tasks
  const [attentionOnlyFilter, setAttentionOnlyFilter] = useState(false);

  // Mobile active panel tab ('projects' | 'standalone')
  const [activeMobileTab, setActiveMobileTab] = useState<'projects' | 'standalone'>('projects');

  // Map taskId -> accumulated actual AU from telemetry sessions
  const taskAttentionMap = useMemo(() => {
    if (!preferences.attentionSystemEnabled) return new Map<string, number>();
    const sessions = AttentionService.reconstructWorkSessions(
      activityLog,
      preferences.attentionUnitMinutes || 15
    );
    const map = new Map<string, number>();
    for (const s of sessions) {
      map.set(s.taskId, Math.round(((map.get(s.taskId) || 0) + s.au) * 100) / 100);
    }
    return map;
  }, [activityLog, preferences.attentionSystemEnabled, preferences.attentionUnitMinutes]);

  const renderAUControls = (
    task: { id: string; text: string; projectId?: string; estimatedAU?: number },
    isNode: boolean
  ) => {
    if (!preferences.attentionSystemEnabled) return null;
    const trackedAU = taskAttentionMap.get(task.id) || 0;
    const isParent = isNode && allActiveNodes.some((n) => n.parentNodeId === task.id);

    return (
      <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <WorkButton
          taskId={task.id}
          taskText={task.text}
          projectId={task.projectId}
        />
        <AttentionUnitInput
          value={task.estimatedAU}
          onChange={(newAU) => updateTaskEstimate(task.id, newAU, isNode)}
          isParentDerived={isParent}
          auMinutes={preferences.attentionUnitMinutes}
          compact={true}
          align="right"
          onOpenChange={(open) => setActiveAuTaskId(open ? task.id : null)}
        />
        {trackedAU > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openWorkSessionsModal(task.id);
            }}
            className="px-2 py-0.5 rounded-lg font-mono font-semibold text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 whitespace-nowrap hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer transition-colors"
            title={`Tracked attention: ${AttentionService.formatAU(trackedAU, preferences.attentionUnitMinutes)} - Click to inspect or edit work sessions`}
          >
            Active: {Math.round(trackedAU * 100) / 100} AU
          </button>
        )}
      </div>
    );
  };

  // Map projectId -> project summary for quick label lookups
  const projectsMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  // Map nodeId -> node for quick lookup of parent nodes / subtask hierarchy
  const allNodesMap = useMemo(() => {
    return new Map(allActiveNodes.map((n) => [n.id, n]));
  }, [allActiveNodes]);

  // Helper to retrieve the parent breadcrumb hierarchy for a subtask inside a node
  const getParentBreadcrumbs = (task: { parentNodeId?: string | null }): Node[] => {
    const chain: Node[] = [];
    let currentParentId = task.parentNodeId;
    const visited = new Set<string>();

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      const parentNode = allNodesMap.get(currentParentId);
      if (parentNode) {
        chain.unshift(parentNode);
        currentParentId = parentNode.parentNodeId;
      } else {
        break;
      }
    }
    return chain;
  };

  const handleOpenTaskInProject = (task: { id: string; projectId?: string }, targetNode?: Node | string) => {
    if (task.projectId) {
      const nodeToSelect = targetNode || allNodesMap.get(task.id) || task.id;
      openProject(task.projectId, nodeToSelect);
    }
  };

  // Ensure data is freshly updated on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const today = getTodayString();
  const myDayData = MyDayService.getMyDayTasks(
    allActiveNodes,
    standaloneTasks,
    preferences.myDayMode,
    today
  );

  // Late tasks across all active projects and standalone tasks
  const lateProjectTasks = useMemo(() => {
    return allActiveNodes
      .filter((n) => isBefore(n.dueDate, today) && (n.status === 'planned' || n.status === 'in_progress'))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [allActiveNodes, today]);

  const displayLateProjectTasks = useMemo(() => {
    if (!attentionOnlyFilter) return lateProjectTasks;
    return lateProjectTasks.filter((t) => t.projectId && projectsMap.get(t.projectId)?.isAttention);
  }, [lateProjectTasks, attentionOnlyFilter, projectsMap]);

  const displayProjectTasks = useMemo(() => {
    if (!attentionOnlyFilter) return myDayData.projectTasks;
    return myDayData.projectTasks.filter((t) => t.projectId && projectsMap.get(t.projectId)?.isAttention);
  }, [myDayData.projectTasks, attentionOnlyFilter, projectsMap]);

  const lateStandaloneTasks = useMemo(() => {
    return standaloneTasks
      .filter((t) => isBefore(t.dueDate, today) && (t.status === 'planned' || t.status === 'in_progress'))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [standaloneTasks, today]);

  const totalLateCount = lateProjectTasks.length + lateStandaloneTasks.length;

  const handleRescheduleAllLateToToday = async () => {
    for (const task of lateProjectTasks) {
      await moveNodeDate(task.id, today, true);
    }
    for (const st of lateStandaloneTasks) {
      await updateStandaloneTask({ ...st, dueDate: today });
    }
    await refreshData();
  };

  const [lateTasksGroupMode, setLateTasksGroupMode] = useState<LateTasksGroupMode>(() => {
    const saved = localStorage.getItem('graphdule_late_tasks_group_by');
    if (saved === 'hierarchy' || saved === 'attention' || saved === 'time' || saved === 'flat') {
      return saved;
    }
    return 'hierarchy';
  });
  const [collapsedLateProjects, setCollapsedLateProjects] = useState<Record<string, boolean>>({});

  const handleGroupModeChange = (mode: LateTasksGroupMode) => {
    setLateTasksGroupMode(mode);
    localStorage.setItem('graphdule_late_tasks_group_by', mode);
  };

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedLateProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  // Grouping state for Today's Project Tasks
  const [todayProjectTasksGroupMode, setTodayProjectTasksGroupMode] = useState<TodayProjectTasksGroupMode>(() => {
    const saved = localStorage.getItem('graphdule_today_project_tasks_group_by');
    if (saved === 'hierarchy' || saved === 'attention' || saved === 'flat') {
      return saved;
    }
    return 'hierarchy';
  });
  const [collapsedTodayProjects, setCollapsedTodayProjects] = useState<Record<string, boolean>>({});

  const handleTodayProjectGroupModeChange = (mode: TodayProjectTasksGroupMode) => {
    setTodayProjectTasksGroupMode(mode);
    localStorage.setItem('graphdule_today_project_tasks_group_by', mode);
  };

  const toggleTodayProjectCollapse = (projectId: string) => {
    setCollapsedTodayProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  // Grouping state for Standalone Tasks
  const [standaloneGroupMode, setStandaloneGroupMode] = useState<StandaloneTasksGroupMode>(() => {
    const saved = localStorage.getItem('graphdule_standalone_tasks_group_by');
    if (saved === 'schedule' || saved === 'recurrence' || saved === 'flat') {
      return saved;
    }
    return 'schedule';
  });
  const [collapsedStandaloneGroups, setCollapsedStandaloneGroups] = useState<Record<string, boolean>>({});

  const handleStandaloneGroupModeChange = (mode: StandaloneTasksGroupMode) => {
    setStandaloneGroupMode(mode);
    localStorage.setItem('graphdule_standalone_tasks_group_by', mode);
  };

  const toggleStandaloneGroupCollapse = (groupKey: string) => {
    setCollapsedStandaloneGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleRescheduleBatchToToday = async (tasks: (Node | StandaloneTask)[]) => {
    for (const task of tasks) {
      if ('projectId' in task && (task as Node).projectId) {
        await moveNodeDate(task.id, today, true);
      } else {
        await updateStandaloneTask({ ...(task as StandaloneTask), dueDate: today });
      }
    }
    await refreshData();
  };

  // Hierarchy grouping for late tasks: projects with root tasks & subtask chains
  const lateHierarchyGroups = useMemo<ProjectLateHierarchyGroup[]>(() => {
    const projectMap = new Map<
      string,
      {
        project: ProjectSummary | undefined;
        rootTasks: Node[];
        subtaskGroupsMap: Map<string, { breadcrumbs: Node[]; tasks: Node[] }>;
        allTasks: Node[];
      }
    >();

    for (const task of displayLateProjectTasks) {
      const pid = task.projectId || 'unknown';
      if (!projectMap.has(pid)) {
        projectMap.set(pid, {
          project: projectsMap.get(pid),
          rootTasks: [],
          subtaskGroupsMap: new Map(),
          allTasks: [],
        });
      }
      const pData = projectMap.get(pid)!;
      pData.allTasks.push(task);

      if (!task.parentNodeId) {
        pData.rootTasks.push(task);
      } else {
        const breadcrumbs = getParentBreadcrumbs(task);
        if (breadcrumbs.length === 0) {
          pData.rootTasks.push(task);
        } else {
          const key = breadcrumbs.map((b) => b.id).join('->');
          if (!pData.subtaskGroupsMap.has(key)) {
            pData.subtaskGroupsMap.set(key, {
              breadcrumbs,
              tasks: [],
            });
          }
          pData.subtaskGroupsMap.get(key)!.tasks.push(task);
        }
      }
    }

    const groups: ProjectLateHierarchyGroup[] = [];
    projectMap.forEach((pData, pid) => {
      const isAttention = !!pData.project?.isAttention;
      const projectName = pData.project?.name || 'Project';

      pData.rootTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const subtaskGroups = Array.from(pData.subtaskGroupsMap.values()).map((sg) => {
        sg.tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        return {
          key: sg.breadcrumbs.map((b) => b.id).join('->'),
          breadcrumbs: sg.breadcrumbs,
          tasks: sg.tasks,
        };
      });

      subtaskGroups.sort((a, b) => {
        const aName = a.breadcrumbs.map((n) => n.text).join(' / ');
        const bName = b.breadcrumbs.map((n) => n.text).join(' / ');
        return aName.localeCompare(bName);
      });

      groups.push({
        projectId: pid,
        projectName,
        project: pData.project,
        isAttention,
        rootTasks: pData.rootTasks,
        subtaskGroups,
        allTasks: pData.allTasks,
      });
    });

    groups.sort((a, b) => {
      if (a.isAttention && !b.isAttention) return -1;
      if (!a.isAttention && b.isAttention) return 1;
      return a.projectName.localeCompare(b.projectName);
    });

    return groups;
  }, [displayLateProjectTasks, projectsMap, allNodesMap]);

  // Attention grouping for late tasks: priority attention vs standard projects vs standalone
  const lateAttentionGroups = useMemo(() => {
    const attentionProjectTasks: Node[] = [];
    const regularProjectTasks: Node[] = [];

    for (const task of displayLateProjectTasks) {
      const isAttention = task.projectId && projectsMap.get(task.projectId)?.isAttention;
      if (isAttention) {
        attentionProjectTasks.push(task);
      } else {
        regularProjectTasks.push(task);
      }
    }

    return {
      attentionTasks: attentionProjectTasks,
      regularTasks: regularProjectTasks,
      standaloneTasks: lateStandaloneTasks,
    };
  }, [displayLateProjectTasks, lateStandaloneTasks, projectsMap]);

  // Time / Overdue duration grouping for late tasks
  const lateTimeGroups = useMemo(() => {
    const overWeek: (Node | StandaloneTask)[] = [];
    const midWeek: (Node | StandaloneTask)[] = [];
    const recent: (Node | StandaloneTask)[] = [];

    const allLate: (Node | StandaloneTask)[] = [
      ...displayLateProjectTasks,
      ...lateStandaloneTasks,
    ];

    for (const item of allLate) {
      const overdueDays = Math.max(1, daysBetween(item.dueDate, today));
      if (overdueDays > 7) {
        overWeek.push(item);
      } else if (overdueDays >= 3) {
        midWeek.push(item);
      } else {
        recent.push(item);
      }
    }

    overWeek.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    midWeek.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    recent.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return [
      {
        id: 'over-week',
        title: 'Over 1 Week Late',
        description: 'More than 7 days overdue',
        tasks: overWeek,
      },
      {
        id: '3-7-days',
        title: '3 to 7 Days Late',
        description: 'Overdue this past week',
        tasks: midWeek,
      },
      {
        id: '1-2-days',
        title: '1 to 2 Days Late',
        description: 'Due recently',
        tasks: recent,
      },
    ].filter((g) => g.tasks.length > 0);
  }, [displayLateProjectTasks, lateStandaloneTasks, today]);

  // Incomplete standalone tasks that are NOT in today's main list
  const otherStandaloneTasks = useMemo(() => {
    const currentListIds = new Set(myDayData.standaloneTasks.map((t) => t.id));
    return standaloneTasks
      .filter((t) => !currentListIds.has(t.id) && t.status !== 'completed')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [standaloneTasks, myDayData.standaloneTasks]);


  // Hierarchy grouping for Today's Project Tasks
  const todayHierarchyGroups = useMemo<TodayProjectHierarchyGroup[]>(() => {
    const projectMap = new Map<
      string,
      {
        project: ProjectSummary | undefined;
        rootTasks: Node[];
        subtaskGroupsMap: Map<string, { breadcrumbs: Node[]; tasks: Node[] }>;
        allTasks: Node[];
      }
    >();

    for (const task of displayProjectTasks) {
      const pid = task.projectId || 'unknown';
      if (!projectMap.has(pid)) {
        projectMap.set(pid, {
          project: projectsMap.get(pid),
          rootTasks: [],
          subtaskGroupsMap: new Map(),
          allTasks: [],
        });
      }
      const pData = projectMap.get(pid)!;
      pData.allTasks.push(task);

      if (!task.parentNodeId) {
        pData.rootTasks.push(task);
      } else {
        const breadcrumbs = getParentBreadcrumbs(task);
        if (breadcrumbs.length === 0) {
          pData.rootTasks.push(task);
        } else {
          const key = breadcrumbs.map((b) => b.id).join('->');
          if (!pData.subtaskGroupsMap.has(key)) {
            pData.subtaskGroupsMap.set(key, {
              breadcrumbs,
              tasks: [],
            });
          }
          pData.subtaskGroupsMap.get(key)!.tasks.push(task);
        }
      }
    }

    const groups: TodayProjectHierarchyGroup[] = [];
    projectMap.forEach((pData, pid) => {
      const isAttention = !!pData.project?.isAttention;
      const projectName = pData.project?.name || 'Project';

      const subtaskGroups = Array.from(pData.subtaskGroupsMap.values()).map((sg) => {
        return {
          key: sg.breadcrumbs.map((b) => b.id).join('->'),
          breadcrumbs: sg.breadcrumbs,
          tasks: sg.tasks,
        };
      });

      subtaskGroups.sort((a, b) => {
        const aName = a.breadcrumbs.map((n) => n.text).join(' / ');
        const bName = b.breadcrumbs.map((n) => n.text).join(' / ');
        return aName.localeCompare(bName);
      });

      groups.push({
        projectId: pid,
        projectName,
        project: pData.project,
        isAttention,
        rootTasks: pData.rootTasks,
        subtaskGroups,
        allTasks: pData.allTasks,
      });
    });

    groups.sort((a, b) => {
      if (a.isAttention && !b.isAttention) return -1;
      if (!a.isAttention && b.isAttention) return 1;
      return a.projectName.localeCompare(b.projectName);
    });

    return groups;
  }, [displayProjectTasks, projectsMap, allNodesMap]);

  // Attention grouping for Today's Project Tasks
  const todayAttentionGroups = useMemo(() => {
    const attentionTasks: Node[] = [];
    const regularTasks: Node[] = [];

    for (const task of displayProjectTasks) {
      const isAttention = task.projectId && projectsMap.get(task.projectId)?.isAttention;
      if (isAttention) {
        attentionTasks.push(task);
      } else {
        regularTasks.push(task);
      }
    }

    return {
      attentionTasks,
      regularTasks,
    };
  }, [displayProjectTasks, projectsMap]);

  // Unified list of standalone tasks for multi-mode display
  // Unified list of standalone tasks for multi-mode display:
  // Ordered: Overdue first (earliest due first), then Today's, then Upcoming (soonest due first)
  const allDisplayStandaloneTasks = useMemo(() => {
    const seen = new Set<string>();
    const list: StandaloneTask[] = [];
    for (const t of myDayData.standaloneTasks) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    }
    for (const t of otherStandaloneTasks) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    }

    list.sort((a, b) => {
      const aOverdue = isBefore(a.dueDate, today);
      const bOverdue = isBefore(b.dueDate, today);
      const aToday = a.dueDate === today;
      const bToday = b.dueDate === today;

      const aRank = aOverdue ? 0 : aToday ? 1 : 2;
      const bRank = bOverdue ? 0 : bToday ? 1 : 2;

      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.dueDate.localeCompare(b.dueDate);
    });

    return list;
  }, [myDayData.standaloneTasks, otherStandaloneTasks, today]);

  const overdueStandaloneTasks = useMemo(() => {
    return allDisplayStandaloneTasks.filter((t) => isBefore(t.dueDate, today));
  }, [allDisplayStandaloneTasks, today]);

  const todayStandaloneTasks = useMemo(() => {
    return allDisplayStandaloneTasks.filter((t) => t.dueDate === today);
  }, [allDisplayStandaloneTasks, today]);

  const upcomingStandaloneTasks = useMemo(() => {
    return allDisplayStandaloneTasks.filter((t) => isAfter(t.dueDate, today));
  }, [allDisplayStandaloneTasks, today]);

  // Schedule grouping for Standalone Tasks: Overdue first, then Today, then Upcoming
  const standaloneScheduleGroups = useMemo(() => {
    return [
      {
        id: 'overdue',
        title: 'Overdue Standalone Tasks',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800',
        tasks: overdueStandaloneTasks,
      },
      {
        id: 'today',
        title: "Today's Tasks",
        badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-200 border-teal-300 dark:border-teal-800',
        tasks: todayStandaloneTasks,
      },
      {
        id: 'upcoming',
        title: 'Upcoming Tasks',
        badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-800',
        tasks: upcomingStandaloneTasks,
      },
    ].filter((g) => g.tasks.length > 0 || g.id === 'today');
  }, [overdueStandaloneTasks, todayStandaloneTasks, upcomingStandaloneTasks]);

  // Recurrence grouping for Standalone Tasks
  const standaloneRecurrenceGroups = useMemo(() => {
    const recurring: StandaloneTask[] = [];
    const oneOff: StandaloneTask[] = [];

    for (const t of allDisplayStandaloneTasks) {
      if (t.recurrence) {
        recurring.push(t);
      } else {
        oneOff.push(t);
      }
    }

    recurring.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    oneOff.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return [
      {
        id: 'recurring',
        title: 'Recurring Standalone Tasks',
        tasks: recurring,
      },
      {
        id: 'one_off',
        title: 'One-Off Standalone Tasks',
        tasks: oneOff,
      },
    ].filter((g) => g.tasks.length > 0);
  }, [allDisplayStandaloneTasks]);

  const hasAttentionProjectTasks = useMemo(() => {
    return displayProjectTasks.some((t) => t.projectId && projectsMap.get(t.projectId)?.isAttention);
  }, [displayProjectTasks, projectsMap]);

  const projectTotalAU = useMemo(() => {
    if (!preferences.attentionSystemEnabled) return 0;
    return displayProjectTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
  }, [displayProjectTasks, preferences.attentionSystemEnabled]);

  const standaloneTotalAU = useMemo(() => {
    if (!preferences.attentionSystemEnabled) return 0;
    return allDisplayStandaloneTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
  }, [allDisplayStandaloneTasks, preferences.attentionSystemEnabled]);

  const handleAddStandalone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStandaloneText.trim() || !newStandaloneDueDate) return;
    const estAU = preferences.attentionSystemEnabled && newStandaloneEstimatedAU ? parseFloat(newStandaloneEstimatedAU) : undefined;
    await addStandaloneTask(newStandaloneText.trim(), newStandaloneDueDate, newStandaloneRecurrence, isNaN(estAU as number) ? undefined : estAU);
    setNewStandaloneText('');
    setNewStandaloneDueDate('');
    setNewStandaloneEstimatedAU('');
    setNewStandaloneRecurrence(undefined);
  };

  const handleToggleNodeStatus = async (nodeId: string, currentStatus: NodeStatus) => {
    if (allActiveNodes.some((n) => n.parentNodeId === nodeId && n.status === 'in_progress')) {
      return;
    }
    const newStatus: NodeStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    await updateNodeStatus(nodeId, newStatus);
  };

  const handleToggleStandaloneStatus = (taskId: string, currentStatus: NodeStatus) => {
    const newStatus: NodeStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    updateStandaloneTaskStatus(taskId, newStatus);
  };

  const handleStartEditStandaloneTask = (task: StandaloneTask) => {
    setEditingStandaloneTaskId(task.id);
    setEditingStandaloneText(task.text);
  };

  const handleCancelEditStandaloneTask = () => {
    setEditingStandaloneTaskId(null);
    setEditingStandaloneText('');
  };

  const handleSaveEditStandaloneTask = async (taskId: string) => {
    const targetTask = standaloneTasks.find((t) => t.id === taskId);
    if (!targetTask) {
      setEditingStandaloneTaskId(null);
      return;
    }
    const trimmed = editingStandaloneText.trim();
    if (trimmed && trimmed !== targetTask.text) {
      await updateStandaloneTask({ ...targetTask, text: trimmed });
    }
    setEditingStandaloneTaskId(null);
  };

  const renderStandaloneTaskName = (task: StandaloneTask) => {
    const isEditing = editingStandaloneTaskId === task.id;

    if (isEditing) {
      return (
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0 flex-1">
          <input
            ref={editInputRef}
            type="text"
            value={editingStandaloneText}
            onChange={(e) => setEditingStandaloneText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveEditStandaloneTask(task.id);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelEditStandaloneTask();
              }
            }}
            onBlur={() => handleSaveEditStandaloneTask(task.id)}
            className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-950 border border-emerald-500 rounded-md px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSaveEditStandaloneTask(task.id)}
            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors shrink-0 shadow-xs"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancelEditStandaloneTask}
            className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors shrink-0"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="min-w-0 flex-1 flex items-center space-x-1.5 group/name">
        <span
          onClick={() => handleStartEditStandaloneTask(task)}
          className={`text-sm font-medium text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors ${
            task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
          }`}
          title={task.text}
        >
          {task.text}
        </span>
        <button
          type="button"
          onClick={() => handleStartEditStandaloneTask(task)}
          className="opacity-0 group-hover/name:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5 transition-opacity cursor-pointer shrink-0"
          title="Edit task name"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const handleModeChange = async (mode: 'today' | 'current_tasks') => {
    await updatePreferences({ myDayMode: mode });
  };

  const renderLateProjectTaskRow = (
    task: Node,
    options?: {
      hideProjectBadge?: boolean;
      hideParentBreadcrumbs?: boolean;
    }
  ) => {
    const project = task.projectId ? projectsMap.get(task.projectId) : undefined;
    const projectTheme = getProjectColorTheme(project?.style?.color);
    const overdueDays = Math.max(1, daysBetween(task.dueDate, today));
    const parentBreadcrumbs = getParentBreadcrumbs(task);
    const parentNode = task.parentNodeId ? allNodesMap.get(task.parentNodeId) : undefined;
    const hasInProgressChild = allActiveNodes.some(
      (n) => n.parentNodeId === task.id && n.status === 'in_progress'
    );
    const isCalendarOpen = activeCalendarLateId === task.id;
    const isElevated = isCalendarOpen || activeAuTaskId === task.id;

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 group transition-all shadow-xs ${
          isElevated ? 'relative z-40' : ''
        }`}
      >
        <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1 sm:mr-2">
          <button
            onClick={() => handleToggleNodeStatus(task.id, task.status)}
            disabled={hasInProgressChild}
            className={`transition-colors shrink-0 mt-0.5 sm:mt-0 ${
              hasInProgressChild
                ? 'text-amber-500 cursor-not-allowed opacity-90'
                : 'text-slate-400 hover:text-emerald-500 cursor-pointer'
            }`}
            title={
              hasInProgressChild
                ? 'In Progress: subtasks are in progress (status cannot be modified)'
                : 'Mark complete'
            }
          >
            {hasInProgressChild ? (
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            ) : task.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              {!options?.hideParentBreadcrumbs && parentNode && (
                <button
                  type="button"
                  onClick={() => handleOpenTaskInProject(task)}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded shrink-0 shadow-2xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                  title={`Subtask inside "${parentNode.text}" - Click to open task in project`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Subtask</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenTaskInProject(task)}
                className={`text-sm font-medium text-slate-800 dark:text-slate-200 truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer text-left ${
                  task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                }`}
                title={`Open task "${task.text}" in project`}
              >
                {task.text}
              </button>
            </div>
            {!options?.hideParentBreadcrumbs && parentBreadcrumbs.length > 0 && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">↳</span>
                <span className="text-slate-400 dark:text-slate-500 shrink-0">Inside:</span>
                <div className="flex items-center space-x-1 truncate">
                  {parentBreadcrumbs.map((pNode, idx) => (
                    <React.Fragment key={pNode.id}>
                      {idx > 0 && <span className="text-slate-400 dark:text-slate-600">→</span>}
                      <button
                        type="button"
                        className="font-medium text-slate-600 dark:text-slate-300 truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer text-left"
                        onClick={() => handleOpenTaskInProject(task, pNode)}
                        title={`Go to parent node "${pNode.text}"`}
                      >
                        {pNode.text}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-8 sm:ml-auto flex-wrap sm:flex-nowrap gap-y-1">
          {renderAUControls(task, true)}
          {/* Project Badge if not hidden */}
          {!options?.hideProjectBadge && task.projectId && (
            <button
              onClick={() => handleOpenTaskInProject(task)}
              className={`hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${projectTheme.badgeBg} hover:opacity-85 transition-all cursor-pointer max-w-[140px] truncate shadow-xs`}
              title={`Open project "${project?.name || 'Project'}"`}
            >
              <ProjectIconDisplay icon={project?.style?.icon} emoji={project?.style?.emoji} className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project?.name || 'Project'}</span>
            </button>
          )}

          {/* Priority Attention Badge if not hidden */}
          {!options?.hideProjectBadge && project?.isAttention && (
            <span
              className="hidden xs:flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs shrink-0"
              title="Priority Attention Project"
            >
              <Zap className="w-3 h-3 fill-current text-amber-500" />
              <span>Attention</span>
            </span>
          )}

          {/* Overdue Badge */}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-1"
            title={`Due date: ${formatDateDisplay(task.dueDate)}`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            <span>{overdueDays}d late</span>
            <span className="hidden sm:inline text-rose-500/80 font-normal">({formatDateDisplay(task.dueDate)})</span>
          </span>

          {/* Quick Move to Today Button */}
          <button
            onClick={() => moveNodeDate(task.id, today, true)}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 transition-colors cursor-pointer"
            title="Move due date to Today"
          >
            <span className="hidden xs:inline">Move to Today</span>
            <span className="xs:hidden">Today</span>
          </button>

          {/* Custom Date Picker */}
          <div className={`relative ${isCalendarOpen ? 'z-50' : ''}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCalendarLateId((prev) => (prev === task.id ? null : task.id));
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reschedule to custom date"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

            {activeCalendarLateId === task.id && (
              <CalendarPicker
                value={task.dueDate}
                onChange={(newDate) => {
                  moveNodeDate(task.id, newDate, true);
                  setActiveCalendarLateId(null);
                }}
                onClose={() => setActiveCalendarLateId(null)}
                position="bottom"
                align="right"
                currentTaskId={task.id}
                taskEstimatedAU={task.estimatedAU}
              />
            )}
          </div>

          {task.projectId && (
            <button
              onClick={() => handleOpenTaskInProject(task)}
              className="p-1 rounded text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Open Project Graph"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderLateStandaloneTaskRow = (
    task: StandaloneTask,
    options?: { hideStandaloneBadge?: boolean }
  ) => {
    const overdueDays = Math.max(1, daysBetween(task.dueDate, today));
    const isCalendarOpen = activeCalendarLateId === task.id;
    const isElevated = isCalendarOpen || activeAuTaskId === task.id;

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 group transition-all shadow-xs ${
          isElevated ? 'relative z-40' : ''
        }`}
      >
        <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1 sm:mr-2">
          <button
            onClick={() => handleToggleStandaloneStatus(task.id, task.status)}
            className="text-slate-400 hover:text-teal-500 transition-colors shrink-0 cursor-pointer mt-0.5 sm:mt-0"
            title="Mark complete"
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          {renderStandaloneTaskName(task)}
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-8 sm:ml-auto flex-wrap sm:flex-nowrap gap-y-1">
          {renderAUControls(task, false)}
          {!options?.hideStandaloneBadge && (
            <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Standalone
            </span>
          )}

          {/* Overdue Badge */}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-1"
            title={`Due date: ${formatDateDisplay(task.dueDate)}`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            <span>{overdueDays}d late</span>
            <span className="hidden sm:inline text-rose-500/80 font-normal">({formatDateDisplay(task.dueDate)})</span>
          </span>

          {/* Quick Move to Today Button */}
          <button
            onClick={() => updateStandaloneTask({ ...task, dueDate: today })}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 transition-colors cursor-pointer"
            title="Move due date to Today"
          >
            <span className="hidden xs:inline">Move to Today</span>
            <span className="xs:hidden">Today</span>
          </button>

          {/* Custom Date Picker */}
          <div className={`relative ${isCalendarOpen ? 'z-50' : ''}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCalendarLateId((prev) => (prev === task.id ? null : task.id));
              }}
              className="p-1.5 sm:p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reschedule to custom date"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

            {activeCalendarLateId === task.id && (
              <CalendarPicker
                value={task.dueDate}
                onChange={(newDate) => {
                  updateStandaloneTask({ ...task, dueDate: newDate });
                  setActiveCalendarLateId(null);
                }}
                onClose={() => setActiveCalendarLateId(null)}
                position="bottom"
                align="right"
                currentTaskId={task.id}
                taskEstimatedAU={task.estimatedAU}
              />
            )}
          </div>

          <button
            onClick={() => deleteStandaloneTask(task.id)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 sm:p-1 transition-opacity cursor-pointer"
            title="Delete standalone task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderTodayProjectTaskRow = (
    task: Node,
    options?: {
      hideProjectBadge?: boolean;
      hideParentBreadcrumbs?: boolean;
    }
  ) => {
    const project = task.projectId ? projectsMap.get(task.projectId) : undefined;
    const projectTheme = getProjectColorTheme(project?.style?.color);
    const parentBreadcrumbs = getParentBreadcrumbs(task);
    const parentNode = task.parentNodeId ? allNodesMap.get(task.parentNodeId) : undefined;
    const hasInProgressChild = allActiveNodes.some(
      (n) => n.parentNodeId === task.id && n.status === 'in_progress'
    );
    const isCalendarOpen = activeCalendarTodayProjectId === task.id;
    const isElevated = isCalendarOpen || activeAuTaskId === task.id;

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 group transition-all shadow-xs ${
          isElevated ? 'relative z-40' : ''
        }`}
      >
        <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1 sm:mr-2">
          <button
            onClick={() => handleToggleNodeStatus(task.id, task.status)}
            disabled={hasInProgressChild}
            className={`transition-colors shrink-0 mt-0.5 sm:mt-0 ${
              hasInProgressChild
                ? 'text-amber-500 cursor-not-allowed opacity-90'
                : 'text-slate-400 hover:text-emerald-500 cursor-pointer'
            }`}
            title={
              hasInProgressChild
                ? 'In Progress: subtasks are in progress (status cannot be modified)'
                : task.status === 'completed'
                ? 'Mark incomplete'
                : 'Mark complete'
            }
          >
            {hasInProgressChild ? (
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            ) : task.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              {!options?.hideParentBreadcrumbs && parentNode && (
                <button
                  type="button"
                  onClick={() => handleOpenTaskInProject(task)}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded shrink-0 shadow-2xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                  title={`Subtask inside "${parentNode.text}" - Click to open task in project`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Subtask</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenTaskInProject(task)}
                className={`text-sm font-medium text-slate-800 dark:text-slate-200 truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer text-left ${
                  task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                }`}
                title={`Open task "${task.text}" in project`}
              >
                {task.text}
              </button>
            </div>

            {!options?.hideParentBreadcrumbs && parentBreadcrumbs.length > 0 && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">↳</span>
                <span className="text-slate-400 dark:text-slate-500 shrink-0">Inside:</span>
                <div className="flex items-center space-x-1 truncate">
                  {parentBreadcrumbs.map((pNode, idx) => (
                    <React.Fragment key={pNode.id}>
                      {idx > 0 && <span className="text-slate-400 dark:text-slate-600">→</span>}
                      <button
                        type="button"
                        className="font-medium text-slate-600 dark:text-slate-300 truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer text-left"
                        onClick={() => handleOpenTaskInProject(task, pNode)}
                        title={`Go to parent node "${pNode.text}"`}
                      >
                        {pNode.text}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-8 sm:ml-auto flex-wrap sm:flex-nowrap gap-y-1">
          {renderAUControls(task, true)}
          {/* Project Badge if not hidden */}
          {!options?.hideProjectBadge && task.projectId && (
            <button
              onClick={() => handleOpenTaskInProject(task)}
              className={`hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${projectTheme.badgeBg} hover:opacity-85 transition-all cursor-pointer max-w-[140px] truncate shadow-xs`}
              title={`Open project "${project?.name || 'Project'}"`}
            >
              <ProjectIconDisplay icon={project?.style?.icon} emoji={project?.style?.emoji} className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{project?.name || 'Project'}</span>
            </button>
          )}

          {/* Priority Attention Badge if not hidden */}
          {!options?.hideProjectBadge && project?.isAttention && (
            <span
              className="hidden xs:flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs shrink-0"
              title="Priority Attention Project"
            >
              <Zap className="w-3 h-3 fill-current text-amber-500" />
              <span>Attention</span>
            </span>
          )}

          {/* Reschedule Date Button with CalendarPicker */}
          <div className={`relative ${isCalendarOpen ? 'z-50' : ''}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCalendarTodayProjectId((prev) => (prev === task.id ? null : task.id));
              }}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium border bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-colors cursor-pointer group/date"
              title="Reschedule task to a different day"
            >
              <Calendar className="w-3.5 h-3.5 opacity-70 group-hover/date:opacity-100 transition-opacity" />
              <span>{formatDateDisplay(task.dueDate)}</span>
            </button>

            {activeCalendarTodayProjectId === task.id && (
              <CalendarPicker
                value={task.dueDate}
                onChange={(newDate) => {
                  moveNodeDate(task.id, newDate, true);
                  setActiveCalendarTodayProjectId(null);
                }}
                onClose={() => setActiveCalendarTodayProjectId(null)}
                position="bottom"
                align="right"
                currentTaskId={task.id}
                taskEstimatedAU={task.estimatedAU}
              />
            )}
          </div>

          {task.projectId && (
            <button
              onClick={() => handleOpenTaskInProject(task)}
              className="p-1 rounded text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Open Project Graph"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderStandaloneTaskRow = (task: StandaloneTask) => {
    const isElevated =
      activeCalendarTaskId === task.id ||
      activeRecurrenceTaskId === task.id ||
      activeAuTaskId === task.id;
    const isTaskOverdue = isBefore(task.dueDate, today);

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 group transition-all shadow-xs ${
          isElevated ? 'relative z-40' : ''
        }`}
      >
        <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1 sm:mr-2">
          <button
            onClick={() => handleToggleStandaloneStatus(task.id, task.status)}
            className="text-slate-400 hover:text-teal-500 transition-colors shrink-0 cursor-pointer mt-0.5 sm:mt-0"
            title={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
          >
            {task.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          {renderStandaloneTaskName(task)}
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-8 sm:ml-auto flex-wrap sm:flex-nowrap gap-y-1">
          {renderAUControls(task, false)}
          {/* Recurrence Badge / Picker */}
          <RecurrencePicker
            value={task.recurrence}
            baseDate={task.dueDate}
            onChange={(newRule) => updateStandaloneTask({ ...task, recurrence: newRule })}
            onOpenChange={(open) => setActiveRecurrenceTaskId(open ? task.id : null)}
            buttonVariant={task.recurrence ? 'badge' : 'icon'}
            align="right"
          />

          {/* Due Date Button & Picker */}
          <div className={`relative ${activeCalendarTaskId === task.id ? 'z-50' : ''}`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCalendarTaskId((prev) => (prev === task.id ? null : task.id));
              }}
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-colors cursor-pointer group/date ${
                isTaskOverdue
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 hover:bg-amber-100'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
              title="Reschedule standalone task"
            >
              <Calendar className="w-3.5 h-3.5 opacity-70 group-hover/date:opacity-100 transition-opacity" />
              <span>{formatDateDisplay(task.dueDate)}</span>
              {isTaskOverdue && (
                <span className="text-xs font-sans font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Overdue
                </span>
              )}
            </button>

            {activeCalendarTaskId === task.id && (
              <CalendarPicker
                value={task.dueDate}
                onChange={(newDate) => {
                  updateStandaloneTask({ ...task, dueDate: newDate });
                  setActiveCalendarTaskId(null);
                }}
                onClose={() => setActiveCalendarTaskId(null)}
                position="bottom"
                align="right"
                currentTaskId={task.id}
                taskEstimatedAU={task.estimatedAU}
              />
            )}
          </div>

          <button
            onClick={() => deleteStandaloneTask(task.id)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 sm:p-1 transition-opacity cursor-pointer"
            title="Delete standalone task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 max-w-[1550px] mx-auto w-full space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Sun className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                <span>My Day</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {displayProjectTasks.length + allDisplayStandaloneTasks.length} tasks
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Right Header Controls: G-Calendar, Force Refresh & Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Google Calendar Button */}
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-xs ${
                gcalendarSyncConfig.enabled
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
              title="Manage Google Calendar & Cloud Synchronization"
            >
              <CalendarDays className={`w-3.5 h-3.5 ${gcalendarSyncConfig.enabled ? 'text-teal-500' : 'text-slate-400'}`} />
              <span className="hidden xs:inline">{gcalendarSyncConfig.enabled ? 'Calendar Synced' : 'Sync Calendar'}</span>
              <span className="xs:hidden">{gcalendarSyncConfig.enabled ? 'Synced' : 'Calendar'}</span>
              {gcalendarSyncConfig.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={handleForceRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-xs disabled:opacity-60"
              title="Force refresh tasks from all projects"
            >
              <RotateCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isRefreshing ? 'Updating...' : 'Force Update'}</span>
              <span className="xs:hidden">{isRefreshing ? '...' : 'Refresh'}</span>
            </button>

            {/* Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
              <button
                onClick={() => handleModeChange('today')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  preferences.myDayMode === 'today'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Today's Tasks
              </button>
              <button
                onClick={() => handleModeChange('current_tasks')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  preferences.myDayMode === 'current_tasks'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Current Tasks
              </button>
            </div>
          </div>
        </div>

        {/* Quick Workload Summary Badges */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 pt-1 text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] uppercase tracking-wider">Plan:</span>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium">
            <Folder className="w-3 h-3 text-emerald-500" />
            <span>{displayProjectTasks.length} Project tasks</span>
            {projectTotalAU > 0 && <span className="font-mono font-bold">({Math.round(projectTotalAU * 10) / 10} AU)</span>}
          </span>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 font-medium">
            <CheckCircle2 className="w-3 h-3 text-teal-500" />
            <span>{allDisplayStandaloneTasks.length} Standalone tasks</span>
            {standaloneTotalAU > 0 && <span className="font-mono font-bold">({Math.round(standaloneTotalAU * 10) / 10} AU)</span>}
          </span>
          {(myDayData.completedTodayProjectTasks.length > 0 || myDayData.completedTodayStandaloneTasks.length > 0) && (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
              <Check className="w-3 h-3 text-slate-400" />
              <span>{myDayData.completedTodayProjectTasks.length + myDayData.completedTodayStandaloneTasks.length} Completed today</span>
            </span>
          )}
        </div>
      </div>

      {/* Mobile Segmented View Switcher (< lg) */}
      <div className="lg:hidden flex items-center bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-1 rounded-xl shadow-xs">
        <button
          type="button"
          data-testid="mobile-tab-projects"
          onClick={() => setActiveMobileTab('projects')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeMobileTab === 'projects'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Folder className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Projects</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            activeMobileTab === 'projects'
              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-300/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {displayProjectTasks.length}
          </span>
          {hasAttentionProjectTasks && (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" title="Attention tasks present" />
          )}
        </button>
        <button
          type="button"
          data-testid="mobile-tab-standalone"
          onClick={() => setActiveMobileTab('standalone')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeMobileTab === 'standalone'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
          <span>Standalone</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            activeMobileTab === 'standalone'
              ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
              : 'bg-slate-300/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {allDisplayStandaloneTasks.length}
          </span>
        </button>
      </div>

      {/* Mobile Lateral Quick-Switch Floating Pill (< lg) */}
      <div className="lg:hidden fixed bottom-20 right-3.5 z-30 pointer-events-auto">
        <button
          type="button"
          data-testid="mobile-lateral-switch"
          onClick={() => setActiveMobileTab(activeMobileTab === 'projects' ? 'standalone' : 'projects')}
          className="flex items-center space-x-2 pl-3 pr-3.5 py-2.5 rounded-full bg-slate-900/90 dark:bg-slate-800/95 text-white shadow-2xl backdrop-blur-md border border-slate-700/70 hover:bg-slate-800 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer group"
          title={activeMobileTab === 'projects' ? 'Switch to Standalone Tasks' : 'Switch to Project Tasks'}
          aria-label="Switch My Day Panel"
        >
          {activeMobileTab === 'projects' ? (
            <>
              <div className="p-1 rounded-full bg-teal-500/20 text-teal-400 group-hover:bg-teal-500/30 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold leading-tight flex items-center space-x-1">
                  <span>Standalone</span>
                  <span className="text-[10px] text-teal-400 font-mono font-normal">({allDisplayStandaloneTasks.length})</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30 transition-colors">
                <Folder className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold leading-tight flex items-center space-x-1">
                  <span>Projects</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-normal">({displayProjectTasks.length})</span>
                </div>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Fallback Notice for Current Tasks */}
      {myDayData.isFallback && preferences.myDayMode === 'current_tasks' && (
        <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center space-x-3 text-xs text-slate-700 dark:text-slate-300">
          <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>
            No incomplete tasks scheduled specifically for today. Showing your most recent active and overdue tasks.
          </span>
        </div>
      )}

      {/* Late Tasks Collapsed Section */}
      {totalLateCount > 0 && (
        <div className="rounded-2xl border border-rose-200/90 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 overflow-hidden shadow-xs">
          {/* Collapsible Header */}
          <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => setIsLateTasksOpen(!isLateTasksOpen)}
              className="flex items-center space-x-2.5 text-left group cursor-pointer"
            >
              <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-900/50 group-hover:bg-rose-200 dark:group-hover:bg-rose-800/60 transition-colors text-rose-600 dark:text-rose-400">
                {isLateTasksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200 tracking-tight">
                  Late Tasks
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 font-mono font-bold">
                  {totalLateCount}
                </span>
              </div>
            </button>

            <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
              {/* Grouping Mode Switcher */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 p-0.5 rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleGroupModeChange('hierarchy')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    lateTasksGroupMode === 'hierarchy'
                      ? 'bg-rose-600 text-white shadow-xs font-semibold'
                      : 'text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                  title="Group by Project & Subtask Hierarchy"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hierarchy</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGroupModeChange('attention')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    lateTasksGroupMode === 'attention'
                      ? 'bg-rose-600 text-white shadow-xs font-semibold'
                      : 'text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                  title="Group by Priority Attention"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Attention</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGroupModeChange('time')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    lateTasksGroupMode === 'time'
                      ? 'bg-rose-600 text-white shadow-xs font-semibold'
                      : 'text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                  title="Group by Overdue Time"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Time</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGroupModeChange('flat')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    lateTasksGroupMode === 'flat'
                      ? 'bg-rose-600 text-white shadow-xs font-semibold'
                      : 'text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                  title="Show all late tasks in a flat list"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Flat</span>
                </button>
              </div>

              {/* Reschedule All to Today */}
              <button
                onClick={handleRescheduleAllLateToToday}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                title="Reschedule all late tasks to today"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Reschedule All to Today</span>
                <span className="sm:hidden">All to Today</span>
              </button>
            </div>
          </div>

          {/* Expanded List of Late Tasks */}
          {isLateTasksOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-rose-100 dark:border-rose-900/40 pt-3">
              {/* 1. HIERARCHY MODE */}
              {lateTasksGroupMode === 'hierarchy' && (
                <div className="space-y-3">
                  {lateHierarchyGroups.map((group) => {
                    const isCollapsed = !!collapsedLateProjects[group.projectId];
                    const projectTheme = getProjectColorTheme(group.project?.style?.color);

                    return (
                      <div
                        key={group.projectId}
                        className="bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 space-y-3 shadow-xs"
                      >
                        {/* Project Group Header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-rose-100 dark:border-rose-900/30">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleProjectCollapse(group.projectId)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title={isCollapsed ? 'Expand project tasks' : 'Collapse project tasks'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => group.project && openProject(group.projectId)}
                              className="flex items-center space-x-2 group/title cursor-pointer hover:opacity-80 transition-opacity"
                              title={`Open project "${group.projectName}"`}
                            >
                              <div className={`p-1.5 rounded-lg ${projectTheme.badgeBg}`}>
                                <ProjectIconDisplay
                                  icon={group.project?.style?.icon}
                                  emoji={group.project?.style?.emoji}
                                  className="w-4 h-4"
                                />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover/title:text-indigo-600 dark:hover/title:text-indigo-400 transition-colors truncate">
                                {group.projectName}
                              </span>
                            </button>

                            {group.isAttention && (
                              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs shrink-0">
                                <Zap className="w-3 h-3 fill-current text-amber-500" />
                                <span>Attention</span>
                              </span>
                            )}

                            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold shrink-0">
                              {group.allTasks.length} {group.allTasks.length === 1 ? 'task' : 'tasks'}
                            </span>
                          </div>

                          {/* Batch Action: Reschedule Project to Today */}
                          <div className="flex items-center space-x-2 shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleRescheduleBatchToToday(group.allTasks)}
                              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shadow-2xs"
                              title={`Reschedule all ${group.allTasks.length} late tasks in "${group.projectName}" to Today`}
                            >
                              <CalendarCheck className="w-3.5 h-3.5 text-rose-500" />
                              <span className="hidden xs:inline">Move Project to Today</span>
                              <span className="xs:hidden">Move to Today</span>
                            </button>

                            {group.project && (
                              <button
                                type="button"
                                onClick={() => openProject(group.projectId)}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title={`Open project "${group.projectName}" graph`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Project Tasks Body (when not collapsed) */}
                        {!isCollapsed && (
                          <div className="space-y-2.5 pt-1">
                            {/* Root Tasks */}
                            {group.rootTasks.length > 0 && (
                              <div className="space-y-1.5">
                                {group.rootTasks.map((task) =>
                                  renderLateProjectTaskRow(task, { hideProjectBadge: true, hideParentBreadcrumbs: true })
                                )}
                              </div>
                            )}

                            {/* Subtask Hierarchical Groups */}
                            {group.subtaskGroups.map((subGroup) => (
                              <div
                                key={subGroup.key}
                                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70 rounded-lg p-2.5 space-y-1.5"
                              >
                                {/* Breadcrumbs trail header */}
                                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 px-1 pb-1">
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                      Inside:
                                    </span>
                                    <div className="flex items-center space-x-1 truncate font-medium">
                                      {subGroup.breadcrumbs.map((bNode, idx) => (
                                        <React.Fragment key={bNode.id}>
                                          {idx > 0 && <span className="text-slate-400">→</span>}
                                          <button
                                            type="button"
                                            onClick={() => openProject(group.projectId, bNode)}
                                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer truncate"
                                            title={`Open node "${bNode.text}" in project`}
                                          >
                                            {bNode.text}
                                          </button>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0 pl-2">
                                    {subGroup.tasks.length} {subGroup.tasks.length === 1 ? 'task' : 'tasks'}
                                  </span>
                                </div>

                                {/* Task Rows in Subtask Group */}
                                <div className="space-y-1.5">
                                  {subGroup.tasks.map((task) =>
                                    renderLateProjectTaskRow(task, { hideProjectBadge: true, hideParentBreadcrumbs: true })
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Standalone Tasks (Hierarchy mode bottom group) */}
                  {lateStandaloneTasks.length > 0 && (
                    <div className="bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                            <ListTodo className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Standalone Tasks
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                            {lateStandaloneTasks.length} {lateStandaloneTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRescheduleBatchToToday(lateStandaloneTasks)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shadow-2xs"
                          title="Reschedule all late standalone tasks to Today"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-rose-500" />
                          <span className="hidden xs:inline">Move Standalone to Today</span>
                          <span className="xs:hidden">Move to Today</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {lateStandaloneTasks.map((task) =>
                          renderLateStandaloneTaskRow(task, { hideStandaloneBadge: true })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. ATTENTION MODE */}
              {lateTasksGroupMode === 'attention' && (
                <div className="space-y-3">
                  {/* Priority Attention Tasks */}
                  {lateAttentionGroups.attentionTasks.length > 0 && (
                    <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                            <Zap className="w-4 h-4 fill-current text-amber-500" />
                          </div>
                          <span className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                            Priority Attention Tasks
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 font-semibold">
                            {lateAttentionGroups.attentionTasks.length}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRescheduleBatchToToday(lateAttentionGroups.attentionTasks)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-slate-800 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 transition-colors cursor-pointer shadow-2xs"
                          title="Reschedule all priority attention tasks to Today"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Move Attention to Today</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {lateAttentionGroups.attentionTasks.map((task) =>
                          renderLateProjectTaskRow(task, { hideProjectBadge: false, hideParentBreadcrumbs: false })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Regular Project Tasks */}
                  {lateAttentionGroups.regularTasks.length > 0 && (
                    <div className="bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <Folder className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Standard Projects
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                            {lateAttentionGroups.regularTasks.length}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRescheduleBatchToToday(lateAttentionGroups.regularTasks)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shadow-2xs"
                          title="Reschedule all standard project tasks to Today"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-rose-500" />
                          <span>Move Standard to Today</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {lateAttentionGroups.regularTasks.map((task) =>
                          renderLateProjectTaskRow(task, { hideProjectBadge: false, hideParentBreadcrumbs: false })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Standalone Tasks in Attention Mode */}
                  {lateAttentionGroups.standaloneTasks.length > 0 && (
                    <div className="bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                            <ListTodo className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Standalone Tasks
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                            {lateAttentionGroups.standaloneTasks.length}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRescheduleBatchToToday(lateAttentionGroups.standaloneTasks)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shadow-2xs"
                          title="Reschedule all standalone tasks to Today"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-rose-500" />
                          <span>Move Standalone to Today</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {lateAttentionGroups.standaloneTasks.map((task) =>
                          renderLateStandaloneTaskRow(task, { hideStandaloneBadge: true })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. TIME / OVERDUE DURATION MODE */}
              {lateTasksGroupMode === 'time' && (
                <div className="space-y-3">
                  {lateTimeGroups.map((tGroup) => (
                    <div
                      key={tGroup.id}
                      className="bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {tGroup.title}
                              </span>
                              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                                {tGroup.tasks.length}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {tGroup.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRescheduleBatchToToday(tGroup.tasks)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shadow-2xs"
                          title={`Reschedule all ${tGroup.tasks.length} tasks in "${tGroup.title}" to Today`}
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-rose-500" />
                          <span>Move Group to Today</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {tGroup.tasks.map((task) => {
                          if ('projectId' in task && (task as Node).projectId) {
                            return renderLateProjectTaskRow(task as Node, {
                              hideProjectBadge: false,
                              hideParentBreadcrumbs: false,
                            });
                          }
                          return renderLateStandaloneTaskRow(task as StandaloneTask, {
                            hideStandaloneBadge: false,
                          });
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. FLAT MODE */}
              {lateTasksGroupMode === 'flat' && (
                <div className="space-y-1.5">
                  {displayLateProjectTasks.map((task) =>
                    renderLateProjectTaskRow(task, { hideProjectBadge: false, hideParentBreadcrumbs: false })
                  )}
                  {lateStandaloneTasks.map((task) =>
                    renderLateStandaloneTaskRow(task, { hideStandaloneBadge: false })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Execution Surface: Two-Column Layout (Projects left, Standalone right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" data-testid="my-day-columns">
        {/* 1. Project Tasks Column (Left) */}
        <div
          className={`space-y-4 ${activeMobileTab === 'projects' ? 'block' : 'hidden lg:block'}`}
          data-testid="projects-column"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Project Tasks
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold">
                {displayProjectTasks.length}
              </span>
              {projectTotalAU > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-mono font-semibold border border-amber-200 dark:border-amber-800/60" title="Total Project Tasks Planned Attention Units">
                  {Math.round(projectTotalAU * 10) / 10} AU
                </span>
              )}
            </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Grouping Mode Switcher for Today's Project Tasks */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg shadow-2xs">
              <button
                type="button"
                onClick={() => handleTodayProjectGroupModeChange('hierarchy')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  todayProjectTasksGroupMode === 'hierarchy'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Group by Project & Subtask Hierarchy"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hierarchy</span>
              </button>
              <button
                type="button"
                onClick={() => handleTodayProjectGroupModeChange('attention')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  todayProjectTasksGroupMode === 'attention'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Group by Priority Attention"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Attention</span>
              </button>
              <button
                type="button"
                onClick={() => handleTodayProjectGroupModeChange('flat')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  todayProjectTasksGroupMode === 'flat'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Show all project tasks in a flat list"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Flat</span>
              </button>
            </div>

            {/* Attention Filter Toggle Pills */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setAttentionOnlyFilter(false)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  !attentionOnlyFilter
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                All Projects
              </button>
              <button
                onClick={() => setAttentionOnlyFilter(true)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  attentionOnlyFilter
                    ? 'bg-amber-500 text-white shadow-xs font-semibold'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                }`}
              >
                <Zap className="w-3 h-3 fill-current" />
                <span>Attention Only</span>
              </button>
            </div>
          </div>
        </div>

        {displayProjectTasks.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500">
            {attentionOnlyFilter
              ? 'No tasks scheduled for today from your priority attention projects.'
              : 'No project tasks scheduled for today across your active projects.'}
          </div>
        ) : (
          <div className="space-y-3">
            {/* 1. HIERARCHY MODE */}
            {todayProjectTasksGroupMode === 'hierarchy' && (
              <div className="space-y-3">
                {todayHierarchyGroups.map((group) => {
                  const isCollapsed = !!collapsedTodayProjects[group.projectId];
                  const projectTheme = getProjectColorTheme(group.project?.style?.color);

                  return (
                    <div
                      key={group.projectId}
                      className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-xs"
                    >
                      {/* Project Group Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleTodayProjectCollapse(group.projectId)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isCollapsed ? 'Expand project tasks' : 'Collapse project tasks'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => group.project && openProject(group.projectId)}
                            className="flex items-center space-x-2 group/title cursor-pointer hover:opacity-80 transition-opacity"
                            title={`Open project "${group.projectName}"`}
                          >
                            <div className={`p-1.5 rounded-lg ${projectTheme.badgeBg}`}>
                              <ProjectIconDisplay
                                icon={group.project?.style?.icon}
                                emoji={group.project?.style?.emoji}
                                className="w-4 h-4"
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover/title:text-indigo-600 dark:group-hover/title:text-indigo-400 transition-colors truncate">
                              {group.projectName}
                            </span>
                          </button>

                          {group.isAttention && (
                            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs shrink-0">
                              <Zap className="w-3 h-3 fill-current text-amber-500" />
                              <span>Attention</span>
                            </span>
                          )}

                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                            {group.allTasks.length} {group.allTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>

                        {group.project && (
                          <button
                            type="button"
                            onClick={() => openProject(group.projectId)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-auto"
                            title={`Open project "${group.projectName}" graph`}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Project Tasks Body */}
                      {!isCollapsed && (
                        <div className="space-y-2.5 pt-1">
                          {/* Root Tasks */}
                          {group.rootTasks.length > 0 && (
                            <div className="space-y-1.5">
                              {group.rootTasks.map((task) =>
                                renderTodayProjectTaskRow(task, { hideProjectBadge: true, hideParentBreadcrumbs: true })
                              )}
                            </div>
                          )}

                          {/* Subtask Hierarchical Groups */}
                          {group.subtaskGroups.map((subGroup) => (
                            <div
                              key={subGroup.key}
                              className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70 rounded-lg p-2.5 space-y-1.5"
                            >
                              {/* Breadcrumbs trail header */}
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 px-1 pb-1">
                                <div className="flex items-center space-x-1.5 truncate">
                                  <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                    Inside:
                                  </span>
                                  <div className="flex items-center space-x-1 truncate font-medium">
                                    {subGroup.breadcrumbs.map((bNode, idx) => (
                                      <React.Fragment key={bNode.id}>
                                        {idx > 0 && <span className="text-slate-400">→</span>}
                                        <button
                                          type="button"
                                          onClick={() => openProject(group.projectId, bNode)}
                                          className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer truncate"
                                          title={`Open node "${bNode.text}" in project`}
                                        >
                                          {bNode.text}
                                        </button>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0 pl-2">
                                  {subGroup.tasks.length} {subGroup.tasks.length === 1 ? 'task' : 'tasks'}
                                </span>
                              </div>

                              {/* Task Rows in Subtask Group */}
                              <div className="space-y-1.5">
                                {subGroup.tasks.map((task) =>
                                  renderTodayProjectTaskRow(task, { hideProjectBadge: true, hideParentBreadcrumbs: true })
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. ATTENTION MODE */}
            {todayProjectTasksGroupMode === 'attention' && (
              <div className="space-y-3">
                {/* Priority Attention Tasks */}
                {todayAttentionGroups.attentionTasks.length > 0 && (
                  <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                          <Zap className="w-4 h-4 fill-current text-amber-500" />
                        </div>
                        <span className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                          Priority Attention Tasks
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 font-semibold">
                          {todayAttentionGroups.attentionTasks.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {todayAttentionGroups.attentionTasks.map((task) =>
                        renderTodayProjectTaskRow(task, { hideProjectBadge: false, hideParentBreadcrumbs: false })
                      )}
                    </div>
                  </div>
                )}

                {/* Regular Tasks */}
                {todayAttentionGroups.regularTasks.length > 0 && (
                  <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Folder className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Standard Projects
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {todayAttentionGroups.regularTasks.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {todayAttentionGroups.regularTasks.map((task) =>
                        renderTodayProjectTaskRow(task, { hideProjectBadge: false, hideParentBreadcrumbs: false })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. FLAT MODE */}
            {todayProjectTasksGroupMode === 'flat' && (
              <div className="space-y-1.5">
                {displayProjectTasks.map((task) =>
                  renderTodayProjectTaskRow(task, { hideProjectBadge: false, hideParentBreadcrumbs: false })
                )}
              </div>
            )}
          </div>
        )}
        </div>

        {/* 2. Standalone Tasks Column (Right) */}
        <div
          className={`space-y-4 ${activeMobileTab === 'standalone' ? 'block' : 'hidden lg:block'}`}
          data-testid="standalone-column"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500 dark:text-teal-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Standalone Tasks
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold">
                {allDisplayStandaloneTasks.length}
              </span>
              {preferences.attentionSystemEnabled && (() => {
                const totalAU = allDisplayStandaloneTasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
                return totalAU > 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-mono font-semibold border border-amber-200 dark:border-amber-800/60" title="Total Standalone Tasks Planned Attention Units">
                    {Math.round(totalAU * 10) / 10} AU
                  </span>
                ) : null;
              })()}
            </div>

          {/* Grouping Mode Switcher for Standalone Tasks */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg shadow-2xs">
            <button
              type="button"
              onClick={() => handleStandaloneGroupModeChange('schedule')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                standaloneGroupMode === 'schedule'
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Group by Schedule (Overdue, Today, Upcoming)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">By Schedule</span>
              <span className="sm:hidden">Schedule</span>
            </button>
            <button
              type="button"
              onClick={() => handleStandaloneGroupModeChange('recurrence')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                standaloneGroupMode === 'recurrence'
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Group by Recurrence (Recurring vs One-Off)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">By Recurrence</span>
              <span className="sm:hidden">Recurrence</span>
            </button>
            <button
              type="button"
              onClick={() => handleStandaloneGroupModeChange('flat')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                standaloneGroupMode === 'flat'
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Show all standalone tasks in a flat list with filters"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flat</span>
            </button>
          </div>
        </div>

        {/* Inline Add Standalone Task */}
        <form
          onSubmit={handleAddStandalone}
          className={`flex flex-col gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs transition-all ${
            isCalendarOpen || isNewRecurrenceOpen || isNewAuOpen ? 'relative z-50 ring-2 ring-teal-500/20' : 'relative z-10'
          }`}
        >
          <input
            type="text"
            placeholder="Add a standalone task (e.g. Call dentist, buy printer paper)..."
            value={newStandaloneText}
            onChange={(e) => setNewStandaloneText(e.target.value)}
            className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-500 shadow-2xs transition-colors"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              {/* Due Date Selector */}
              <div className={`relative ${isCalendarOpen ? 'z-50' : ''}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer group/cal border ${
                    newStandaloneDueDate
                      ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 border-slate-200 dark:border-slate-700'
                      : 'bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 border-dashed border-amber-300 dark:border-amber-600/70'
                  }`}
                  title={newStandaloneDueDate ? 'Click to select due date' : 'Select due date (required)'}
                >
                  <Calendar className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    newStandaloneDueDate
                      ? 'text-slate-400 group-hover/cal:text-teal-500'
                      : 'text-amber-500 group-hover/cal:text-amber-600'
                  }`} />
                  <span>{newStandaloneDueDate ? formatDateDisplay(newStandaloneDueDate) : 'Pick date'}</span>
                </button>

                {isCalendarOpen && (
                  <CalendarPicker
                    value={newStandaloneDueDate}
                    onChange={(newDate) => setNewStandaloneDueDate(newDate)}
                    onClose={() => setIsCalendarOpen(false)}
                    position="bottom"
                    align="left"
                    taskEstimatedAU={newStandaloneEstimatedAU ? parseFloat(newStandaloneEstimatedAU) : undefined}
                  />
                )}
              </div>

              {/* Recurrence Selector */}
              <RecurrencePicker
                value={newStandaloneRecurrence}
                baseDate={newStandaloneDueDate || getTodayString()}
                onChange={setNewStandaloneRecurrence}
                onOpenChange={setIsNewRecurrenceOpen}
                buttonVariant={newStandaloneRecurrence ? 'badge' : 'icon'}
                align="left"
              />

              {/* Estimated AU Input (if attention system enabled) */}
              {preferences.attentionSystemEnabled && (
                <AttentionUnitInput
                  value={newStandaloneEstimatedAU ? parseFloat(newStandaloneEstimatedAU) : undefined}
                  onChange={(val) => setNewStandaloneEstimatedAU(val !== undefined ? String(val) : '')}
                  auMinutes={preferences.attentionUnitMinutes}
                  compact={true}
                  placeholder="+ AU"
                  align="left"
                  onOpenChange={setIsNewAuOpen}
                />
              )}
            </div>

            <button
              type="submit"
              disabled={!newStandaloneText.trim() || !newStandaloneDueDate}
              title={
                !newStandaloneText.trim()
                  ? 'Enter a task description'
                  : !newStandaloneDueDate
                  ? 'Please select a due date'
                  : 'Add task'
              }
              className="flex items-center space-x-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition-colors shrink-0 cursor-pointer shadow-xs disabled:cursor-not-allowed ml-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {allDisplayStandaloneTasks.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 text-center text-sm text-slate-500">
            No active standalone tasks. Tasks created here exist outside project graphs.
          </div>
        ) : (
          <div className="space-y-3">
            {/* 1. SCHEDULE MODE (Overdue, Today, Upcoming) */}
            {standaloneGroupMode === 'schedule' && (
              <div className="space-y-3">
                {standaloneScheduleGroups.map((sGroup) => {
                  const isCollapsed = !!collapsedStandaloneGroups[sGroup.id];

                  return (
                    <div
                      key={sGroup.id}
                      className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => toggleStandaloneGroupCollapse(sGroup.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {sGroup.title}
                          </span>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-semibold ${sGroup.badgeClass}`}>
                            {sGroup.tasks.length}
                          </span>
                          {preferences.attentionSystemEnabled && (() => {
                            const groupAU = sGroup.tasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
                            return groupAU > 0 ? (
                              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-semibold" title="Total Group Planned Attention Units">
                                {Math.round(groupAU * 10) / 10} AU
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-1.5">
                          {sGroup.tasks.map((task) => renderStandaloneTaskRow(task))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. RECURRENCE MODE */}
            {standaloneGroupMode === 'recurrence' && (
              <div className="space-y-3">
                {standaloneRecurrenceGroups.map((rGroup) => {
                  const isCollapsed = !!collapsedStandaloneGroups[rGroup.id];

                  return (
                    <div
                      key={rGroup.id}
                      className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => toggleStandaloneGroupCollapse(rGroup.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {rGroup.title}
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                            {rGroup.tasks.length}
                          </span>
                          {preferences.attentionSystemEnabled && (() => {
                            const groupAU = rGroup.tasks.reduce((acc, t) => acc + (t.estimatedAU || 0), 0);
                            return groupAU > 0 ? (
                              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-semibold" title="Total Group Planned Attention Units">
                                {Math.round(groupAU * 10) / 10} AU
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-1.5">
                          {rGroup.tasks.map((task) => renderStandaloneTaskRow(task))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. FLAT MODE WITH FILTER PILLS (Overdue first, then Today, then Upcoming) */}
            {standaloneGroupMode === 'flat' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg text-xs self-start">
                  <button
                    onClick={() => setStandaloneFilter('all')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      standaloneFilter === 'all'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    All ({allDisplayStandaloneTasks.length})
                  </button>
                  {overdueStandaloneTasks.length > 0 && (
                    <button
                      onClick={() => setStandaloneFilter('overdue')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 ${
                        standaloneFilter === 'overdue'
                          ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                          : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Overdue ({overdueStandaloneTasks.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setStandaloneFilter('today')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 ${
                      standaloneFilter === 'today'
                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Today ({todayStandaloneTasks.length})</span>
                  </button>
                  <button
                    onClick={() => setStandaloneFilter('upcoming')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 ${
                      standaloneFilter === 'upcoming'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Upcoming ({upcomingStandaloneTasks.length})</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  {(standaloneFilter === 'all'
                    ? allDisplayStandaloneTasks
                    : standaloneFilter === 'overdue'
                    ? overdueStandaloneTasks
                    : standaloneFilter === 'today'
                    ? todayStandaloneTasks
                    : upcomingStandaloneTasks
                  ).map((task) => renderStandaloneTaskRow(task))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Completed Today Toggle */}
      {(myDayData.completedTodayProjectTasks.length > 0 ||
        myDayData.completedTodayStandaloneTasks.length > 0) && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center space-x-1.5 cursor-pointer"
          >
            <span>
              {showCompleted ? 'Hide' : 'Show'} Completed Today (
              {myDayData.completedTodayProjectTasks.length +
                myDayData.completedTodayStandaloneTasks.length}
              )
            </span>
          </button>

          {showCompleted && (
            <div className="space-y-2 mt-3 opacity-75">
              {myDayData.completedTodayProjectTasks.map((task) => {
                const project = task.projectId ? projectsMap.get(task.projectId) : undefined;
                const parentNode = task.parentNodeId ? allNodesMap.get(task.parentNodeId) : undefined;
                const parentBreadcrumbs = getParentBreadcrumbs(task);

                return (
                  <div
                    key={task.id}
                    className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-sm group"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
                      <button
                        onClick={() => handleToggleNodeStatus(task.id, task.status)}
                        className="text-emerald-500 hover:text-slate-400 transition-colors shrink-0 cursor-pointer"
                        title="Mark uncompleted"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          {parentNode && (
                            <button
                              type="button"
                              onClick={() => handleOpenTaskInProject(task)}
                              className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                              title={`Subtask inside "${parentNode.text}" - Click to open task in project`}
                            >
                              <Layers className="w-3 h-3" />
                              <span>Subtask</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenTaskInProject(task)}
                            className="text-sm line-through text-slate-400 truncate hover:text-indigo-500 hover:underline transition-colors cursor-pointer text-left"
                            title={`Open task "${task.text}" in project`}
                          >
                            {task.text}
                          </button>
                        </div>
                        {parentBreadcrumbs.length > 0 && (
                          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">↳</span>
                            <span className="text-slate-400 dark:text-slate-500 shrink-0">Inside:</span>
                            <div className="flex items-center space-x-1 truncate">
                              {parentBreadcrumbs.map((pNode, idx) => (
                                <React.Fragment key={pNode.id}>
                                  {idx > 0 && <span className="text-slate-400 dark:text-slate-600">→</span>}
                                  <button
                                    type="button"
                                    className="font-medium text-slate-500 dark:text-slate-400 truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer text-left"
                                    onClick={() => handleOpenTaskInProject(task, pNode)}
                                    title={`Go to parent node "${pNode.text}"`}
                                  >
                                    {pNode.text}
                                  </button>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {parentNode && (
                        <button
                          type="button"
                          onClick={() => handleOpenTaskInProject(task, parentNode)}
                          className="hidden sm:flex items-center space-x-1 px-2 py-0.5 rounded text-xs bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 max-w-[130px] truncate hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                          title={`Subtask inside "${parentNode.text}" - Click to open parent node`}
                        >
                          <Layers className="w-3 h-3 shrink-0" />
                          <span className="truncate">{parentNode.text}</span>
                        </button>
                      )}
                      {project ? (
                        <button
                          onClick={() => handleOpenTaskInProject(task)}
                          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-mono flex items-center space-x-1 cursor-pointer"
                          title={`Open project "${project.name}"`}
                        >
                          <span className="truncate max-w-[110px]">{project.name}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">Project Task</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {myDayData.completedTodayStandaloneTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-sm group"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
                    <button
                      onClick={() => handleToggleStandaloneStatus(task.id, task.status)}
                      className="text-emerald-500 hover:text-slate-400 transition-colors shrink-0 cursor-pointer"
                      title="Mark incomplete"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </button>
                    {renderStandaloneTaskName(task)}
                  </div>
                  <span className="text-xs text-slate-500 font-mono shrink-0">Standalone</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
