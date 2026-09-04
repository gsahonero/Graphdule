import {
  Project,
  ProjectDocument,
  Node,
  Edge,
  NodeStatus,
  ProjectSummary,
  ProjectStyle,
} from '../models/types';
import { getTodayString } from '../utils/date';
import { GraphService } from './graph-service';
import { TemporalService } from './temporal-service';

export class ProjectService {
  /**
   * Generates a unique ID with an optional prefix.
   */
  public static generateId(prefix = 'id'): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Normalizes an array of tags (trims whitespace, removes duplicates, excludes empty strings).
   */
  public static normalizeTags(tags?: readonly string[] | string[]): string[] {
    if (!tags || !Array.isArray(tags)) return [];
    const set = new Set<string>();
    for (const raw of tags) {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set);
  }

  /**
   * Creates a new Project and its mandatory End Goal Node (EGN).
   * Invariant: Every Project has exactly one EGN.
   */
  public static createProject(
    name: string,
    endGoalText: string,
    deadline: string,
    tags?: string[],
    style?: ProjectStyle
  ): { project: Project; egnNode: Node } {
    const now = new Date().toISOString();
    const projectId = ProjectService.generateId('proj');
    const egnId = ProjectService.generateId('egn');

    const egnNode: Node = {
      id: egnId,
      projectId,
      parentNodeId: null,
      text: endGoalText || name,
      dueDate: deadline || getTodayString(),
      status: 'planned',
      position: { x: 600, y: 200 },
      createdAt: now,
      updatedAt: now,
    };

    const project: Project = {
      id: projectId,
      name,
      endGoalNodeId: egnId,
      tags: ProjectService.normalizeTags(tags),
      status: 'active',
      style: style || { color: 'emerald', icon: 'target' },
      createdAt: now,
      updatedAt: now,
    };

    return { project, egnNode };
  }

  /**
   * Creates a new node within a project graph.
   */
  public static createNode(
    projectId: string,
    text: string,
    dueDate: string,
    parentNodeId: string | null = null,
    position?: { x: number; y: number }
  ): Node {
    const now = new Date().toISOString();
    return {
      id: ProjectService.generateId('node'),
      projectId,
      parentNodeId: parentNodeId || null,
      text,
      dueDate,
      status: 'planned',
      position,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Creates a directed edge from predecessor to successor, enforcing DAG and chronology invariants.
   */
  public static createEdge(
    projectId: string,
    fromNodeId: string,
    toNodeId: string,
    nodes: readonly Node[],
    existingEdges: readonly Edge[]
  ): { success: true; edge: Edge } | { success: false; error: string } {
    if (fromNodeId === toNodeId) {
      return { success: false, error: 'Cannot connect a node to itself.' };
    }

    const fromNode = nodes.find((n) => n.id === fromNodeId);
    const toNode = nodes.find((n) => n.id === toNodeId);

    if (!fromNode || !toNode) {
      return { success: false, error: 'One or both connected nodes do not exist.' };
    }

    // Check for duplicate edge
    const isDuplicate = existingEdges.some(
      (e) => e.fromNodeId === fromNodeId && e.toNodeId === toNodeId
    );
    if (isDuplicate) {
      return { success: false, error: 'Edge already exists between these nodes.' };
    }

    // Check DAG cycle
    if (GraphService.wouldCreateCycle(fromNodeId, toNodeId, existingEdges)) {
      return { success: false, error: 'Cannot create edge: would form a circular dependency.' };
    }

    // Check chronological order
    const chronoCheck = TemporalService.validateEdgeChronology(fromNode, toNode);
    if (!chronoCheck.isValid) {
      return { success: false, error: chronoCheck.error || 'Chronological violation.' };
    }

    const now = new Date().toISOString();
    const edge: Edge = {
      id: ProjectService.generateId('edge'),
      projectId,
      fromNodeId,
      toNodeId,
      createdAt: now,
    };

    return { success: true, edge };
  }

  /**
   * Decomposes a parent node into subtask children.
   */
  public static decomposeNode(
    parentNode: Node,
    subtasks: { text: string; dueDate?: string }[]
  ): Node[] {
    const now = new Date().toISOString();
    return subtasks.map((sub, idx) => {
      const dueDate = sub.dueDate || parentNode.dueDate;
      return {
        id: ProjectService.generateId('subnode'),
        projectId: parentNode.projectId,
        parentNodeId: parentNode.id,
        text: sub.text,
        dueDate,
        status: 'planned',
        position: parentNode.position
          ? { x: parentNode.position.x - 200, y: parentNode.position.y + (idx + 1) * 80 }
          : undefined,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  /**
   * Updates status of a node.
   */
  public static updateNodeStatus(node: Node, status: NodeStatus): Node {
    return {
      ...node,
      status,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Deletes a node and all its connected edges and child subtasks from a project document.
   * Invariant: Connections (edges) are erased first, then associated notes and child subtasks, and finally the node.
   */
  public static deleteNodeFromProject(
    doc: ProjectDocument,
    nodeId: string
  ): { success: true; document: ProjectDocument } | { success: false; error: string } {
    if (doc.project.endGoalNodeId === nodeId) {
      return { success: false, error: 'Cannot delete the Goal node. Every project must have a Goal.' };
    }

    // Collect all node IDs to delete (the target node and any recursive descendant subtasks)
    const nodesToDelete = new Set<string>([nodeId]);
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      for (const n of doc.nodes) {
        if (n.parentNodeId && nodesToDelete.has(n.parentNodeId) && !nodesToDelete.has(n.id)) {
          nodesToDelete.add(n.id);
          addedMore = true;
        }
      }
    }

    // Step 1: Erase all connecting edges first
    const updatedEdges = doc.edges.filter(
      (e) => !nodesToDelete.has(e.fromNodeId) && !nodesToDelete.has(e.toNodeId)
    );

    // Step 2: Erase associated notes
    const updatedNotes = doc.notes.filter((n) => !nodesToDelete.has(n.nodeId));

    // Step 3: Erase the nodes
    const updatedNodes = doc.nodes.filter((n) => !nodesToDelete.has(n.id));

    const updatedDoc: ProjectDocument = {
      ...doc,
      edges: updatedEdges,
      nodes: updatedNodes,
      notes: updatedNotes,
      exportedAt: new Date().toISOString(),
      project: {
        ...doc.project,
        updatedAt: new Date().toISOString(),
      },
    };

    return { success: true, document: updatedDoc };
  }

  /**
   * Calculates project progress based on leaf nodes, avoiding double counting decomposed parent tasks.
   * Progress = (completed_leaves / (total_leaves - abandoned_leaves)) * 100
   */
  public static calculateProgress(nodes: readonly Node[]): number {
    if (nodes.length === 0) return 0;

    // Identify parent node IDs
    const parentIds = new Set(
      nodes.filter((n) => n.parentNodeId).map((n) => n.parentNodeId!)
    );

    // Leaf nodes are nodes that are not parents of any other node
    const leafNodes = nodes.filter((n) => !parentIds.has(n.id));

    if (leafNodes.length === 0) return 0;

    const activeLeaves = leafNodes.filter((n) => n.status !== 'abandoned');
    if (activeLeaves.length === 0) {
      // If all leaves are abandoned or completed
      const anyCompleted = leafNodes.some((n) => n.status === 'completed');
      return anyCompleted ? 100 : 0;
    }

    const completedLeaves = activeLeaves.filter((n) => n.status === 'completed');
    return Math.round((completedLeaves.length / activeLeaves.length) * 100);
  }

  /**
   * Updates style (color accent, icon, emoji) for a project.
   */
  public static updateProjectStyle(project: Project, style: ProjectStyle): Project {
    return {
      ...project,
      style: {
        color: style.color || project.style?.color || 'emerald',
        icon: style.icon || project.style?.icon || 'target',
        emoji: style.emoji !== undefined ? style.emoji : project.style?.emoji,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates tags for a project.
   */
  public static updateProjectTags(project: Project, tags: string[]): Project {
    return {
      ...project,
      tags: ProjectService.normalizeTags(tags),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Archives a project with an optional reason ('archived', 'completed', or 'abandoned').
   */
  public static archiveProject(
    project: Project,
    status: 'archived' | 'completed' | 'abandoned' = 'archived'
  ): Project {
    const now = new Date().toISOString();
    return {
      ...project,
      status,
      archivedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Restores/unarchives an archived project back to active.
   */
  public static unarchiveProject(project: Project): Project {
    const now = new Date().toISOString();
    return {
      ...project,
      status: 'active',
      archivedAt: undefined,
      updatedAt: now,
    };
  }

  /**
   * Computes a high-level summary of a project for cards & dashboards.
   */
  public static getProjectSummary(project: Project, nodes: readonly Node[]): ProjectSummary {
    const projectNodes = nodes.filter((n) => n.projectId === project.id);
    const egnNode = projectNodes.find((n) => n.id === project.endGoalNodeId);

    const progressPercentage = ProjectService.calculateProgress(projectNodes);
    const activeTaskCount = projectNodes.filter(
      (n) => n.status === 'planned' || n.status === 'in_progress'
    ).length;
    const completedTaskCount = projectNodes.filter((n) => n.status === 'completed').length;
    const abandonedTaskCount = projectNodes.filter((n) => n.status === 'abandoned').length;

    // Determine status: explicit project.status or deduce from EGN / progress
    let status = project.status || 'active';
    if (!project.status || project.status === 'active') {
      if (egnNode?.status === 'completed' || (projectNodes.length > 0 && progressPercentage === 100)) {
        status = 'completed';
      } else if (egnNode?.status === 'abandoned') {
        status = 'abandoned';
      } else {
        status = 'active';
      }
    }

    const isArchived = status === 'archived' || status === 'completed' || status === 'abandoned';

    return {
      id: project.id,
      name: project.name,
      endGoalText: egnNode?.text || project.name,
      deadline: egnNode?.dueDate || getTodayString(),
      tags: project.tags ? [...project.tags] : [],
      status,
      isArchived,
      archivedAt: project.archivedAt,
      style: project.style || { color: 'emerald', icon: 'target' },
      progressPercentage,
      activeTaskCount,
      totalTaskCount: projectNodes.length,
      completedTaskCount,
      abandonedTaskCount,
      updatedAt: project.updatedAt,
    };
  }
}
