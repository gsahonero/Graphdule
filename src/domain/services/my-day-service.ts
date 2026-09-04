import { Node, StandaloneTask } from '../models/types';
import { getTodayString, isBeforeOrEqual } from '../utils/date';

export interface MyDayResult {
  mode: 'today' | 'current_tasks';
  isFallback: boolean; // True if Current Tasks mode resolved to overdue/recent tasks because today had 0
  projectTasks: Node[];
  standaloneTasks: StandaloneTask[];
  completedTodayProjectTasks: Node[];
  completedTodayStandaloneTasks: StandaloneTask[];
}

export class MyDayService {
  /**
   * Evaluates My Day tasks based on user preference ('today' vs 'current_tasks').
   */
  public static getMyDayTasks(
    allProjectNodes: readonly Node[],
    allStandaloneTasks: readonly StandaloneTask[],
    mode: 'today' | 'current_tasks' = 'today',
    referenceDate: string = getTodayString()
  ): MyDayResult {
    const isTodayIncomplete = (item: { dueDate: string; status: string }) =>
      item.dueDate === referenceDate && (item.status === 'planned' || item.status === 'in_progress');

    const isTodayCompleted = (item: { dueDate: string; status: string }) =>
      item.dueDate === referenceDate && item.status === 'completed';

    const completedTodayProject = allProjectNodes.filter(isTodayCompleted);
    const completedTodayStandalone = allStandaloneTasks.filter(isTodayCompleted);

    const todayProjectIncomplete = allProjectNodes.filter(isTodayIncomplete);
    const todayStandaloneIncomplete = allStandaloneTasks.filter(isTodayIncomplete);

    if (mode === 'today') {
      return {
        mode: 'today',
        isFallback: false,
        projectTasks: todayProjectIncomplete,
        standaloneTasks: todayStandaloneIncomplete,
        completedTodayProjectTasks: completedTodayProject,
        completedTodayStandaloneTasks: completedTodayStandalone,
      };
    }

    // Mode is 'current_tasks'
    const hasTodayTasks = todayProjectIncomplete.length > 0 || todayStandaloneIncomplete.length > 0;

    if (hasTodayTasks) {
      return {
        mode: 'current_tasks',
        isFallback: false,
        projectTasks: todayProjectIncomplete,
        standaloneTasks: todayStandaloneIncomplete,
        completedTodayProjectTasks: completedTodayProject,
        completedTodayStandaloneTasks: completedTodayStandalone,
      };
    }

    // Fallback: Return most recent incomplete / overdue tasks (dueDate <= referenceDate)
    const overdueProject = allProjectNodes
      .filter(
        (n) =>
          isBeforeOrEqual(n.dueDate, referenceDate) &&
          (n.status === 'planned' || n.status === 'in_progress')
      )
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)); // Most recent first

    const overdueStandalone = allStandaloneTasks
      .filter(
        (t) =>
          isBeforeOrEqual(t.dueDate, referenceDate) &&
          (t.status === 'planned' || t.status === 'in_progress')
      )
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

    // If still empty, grab earliest upcoming incomplete tasks
    let finalProject = overdueProject;
    let finalStandalone = overdueStandalone;

    if (finalProject.length === 0 && finalStandalone.length === 0) {
      finalProject = allProjectNodes
        .filter((n) => n.status === 'planned' || n.status === 'in_progress')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5);

      finalStandalone = allStandaloneTasks
        .filter((t) => t.status === 'planned' || t.status === 'in_progress')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5);
    }

    return {
      mode: 'current_tasks',
      isFallback: true,
      projectTasks: finalProject,
      standaloneTasks: finalStandalone,
      completedTodayProjectTasks: completedTodayProject,
      completedTodayStandaloneTasks: completedTodayStandalone,
    };
  }

  /**
   * Helper to create a standalone task.
   */
  public static createStandaloneTask(
    text: string,
    dueDate?: string,
    recurrence?: import('../models/types').RecurrenceRule,
    parentRecurringTaskId?: string,
    recurrenceInstance?: number
  ): StandaloneTask {
    const now = new Date().toISOString();
    return {
      id: `task_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      dueDate: dueDate || getTodayString(),
      status: 'planned',
      ...(recurrence ? { recurrence } : {}),
      ...(parentRecurringTaskId ? { parentRecurringTaskId } : {}),
      ...(recurrenceInstance ? { recurrenceInstance } : {}),
      createdAt: now,
      updatedAt: now,
    };
  }
}
