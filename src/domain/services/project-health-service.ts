import { Node, Edge, ActivityEvent } from '../models/types';
import { daysBetween, getTodayString, isBefore } from '../utils/date';

export type ProjectHealthStatus = 'flowing' | 'idle' | 'stalled';

export interface ProjectHealthSummary {
  readonly health: ProjectHealthStatus;
  readonly frontierNodes: Node[];
  readonly frontierCount: number;
  readonly overdueFrontierCount: number;
  readonly daysSinceLastActivity: number;
  readonly recommendation: string;
}

export class ProjectHealthService {
  /**
   * Identifies frontier nodes in a project DAG.
   * A frontier node is an uncompleted node whose predecessors are all completed.
   */
  public static getFrontierNodes(
    nodes: readonly Node[],
    edges: readonly Edge[]
  ): Node[] {
    const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));

    // Group incoming edges by destination
    const incomingEdgesMap = new Map<string, Edge[]>();
    for (const edge of edges) {
      const list = incomingEdgesMap.get(edge.toNodeId) || [];
      list.push(edge);
      incomingEdgesMap.set(edge.toNodeId, list);
    }

    return nodes.filter((node) => {
      // Must be an active, incomplete task
      if (node.status === 'completed' || node.status === 'abandoned') {
        return false;
      }

      const incoming = incomingEdgesMap.get(node.id) || [];
      // Root node (no predecessors) or all predecessors completed
      if (incoming.length === 0) {
        return true;
      }

      return incoming.every((edge) => {
        // If predecessor node exists in project, check if completed
        const pred = nodeMap.get(edge.fromNodeId);
        return !pred || pred.status === 'completed';
      });
    });
  }

  /**
   * Evaluates project health based on frontier movement and recency of activity.
   */
  public static evaluateProjectHealth(
    nodes: readonly Node[],
    edges: readonly Edge[],
    activityLog: readonly ActivityEvent[] = [],
    today: string = getTodayString(),
    projectId?: string
  ): ProjectHealthSummary {
    const activeNodes = nodes.filter((n) => n.status !== 'abandoned');
    const incompleteNodes = activeNodes.filter((n) => n.status !== 'completed');

    // If no incomplete nodes, project is 100% complete and flowing
    if (incompleteNodes.length === 0) {
      return {
        health: 'flowing',
        frontierNodes: [],
        frontierCount: 0,
        overdueFrontierCount: 0,
        daysSinceLastActivity: 0,
        recommendation: 'All milestone tasks completed! Project is in smooth maintenance.',
      };
    }

    const frontierNodes = this.getFrontierNodes(activeNodes, edges);
    const overdueFrontier = frontierNodes.filter(
      (n) => n.dueDate && isBefore(n.dueDate, today)
    );

    // Determine days since last activity in this project or general frontier
    let lastActivityDate: string | null = null;
    for (const event of activityLog) {
      if (projectId && event.projectId && event.projectId !== projectId) {
        continue;
      }
      if (!lastActivityDate || event.timestamp > lastActivityDate) {
        lastActivityDate = event.timestamp;
      }
    }

    let daysSinceLastActivity = 0;
    if (lastActivityDate) {
      const dateOnly = lastActivityDate.split('T')[0];
      daysSinceLastActivity = Math.max(0, daysBetween(dateOnly, today));
    } else {
      // If no activity log, fallback to most recently updated node
      const mostRecentNodeUpdate = nodes.reduce<string | null>((latest, n) => {
        const updateDate = (n.updatedAt || n.createdAt || '').split('T')[0];
        if (!latest || updateDate > latest) return updateDate;
        return latest;
      }, null);

      if (mostRecentNodeUpdate) {
        daysSinceLastActivity = Math.max(0, daysBetween(mostRecentNodeUpdate, today));
      }
    }

    // Health categorization logic
    let health: ProjectHealthStatus = 'flowing';
    let recommendation = 'Project is moving steadily. Keep the rhythm going!';

    if (daysSinceLastActivity > 10 || (daysSinceLastActivity >= 5 && overdueFrontier.length >= 2)) {
      health = 'stalled';
      recommendation =
        overdueFrontier.length > 0
          ? `${overdueFrontier.length} frontier tasks are overdue with no recent movement. Consider triaging dates or inserting a Spike exploration task.`
          : 'Frontier has been stagnant for over 10 days. Re-examine the first step or break it into smaller subtasks.';
    } else if (daysSinceLastActivity >= 5 || overdueFrontier.length === 1) {
      health = 'idle';
      recommendation =
        'No recent completions this week. Select one frontier task today to re-establish momentum.';
    }

    return {
      health,
      frontierNodes,
      frontierCount: frontierNodes.length,
      overdueFrontierCount: overdueFrontier.length,
      daysSinceLastActivity,
      recommendation,
    };
  }
}
