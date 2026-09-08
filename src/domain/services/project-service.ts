import {
  Project,
  ProjectDocument,
  Node,
  Edge,
  NodeStatus,
  ProjectSummary,
  ProjectStyle,
  IdeaSeed,
  Note,
  ProjectNote,
} from '../models/types';
import { getTodayString } from '../utils/date';
import { GraphService } from './graph-service';
import { TemporalService } from './temporal-service';
import { AttentionService } from './attention-service';

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
    dueDate: string = '',
    parentNodeId: string | null = null,
    position?: { x: number; y: number },
    estimatedAU?: number
  ): Node {
    const now = new Date().toISOString();
    return {
      id: ProjectService.generateId('node'),
      projectId,
      parentNodeId: parentNodeId || null,
      text,
      dueDate: dueDate || '',
      status: 'planned',
      position,
      estimatedAU,
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
    subtasks: { text: string; dueDate?: string; estimatedAU?: number }[]
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
          ? { x: Math.max(50, parentNode.position.x - 200), y: Math.max(60, parentNode.position.y + (idx + 1) * 80) }
          : { x: 100, y: 100 + idx * 160 },
        estimatedAU: sub.estimatedAU,
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
   * Cascades completion up to parent node(s) when all subtask nodes inside a parent are completed.
   * Recursively bubbles up to grandparents if all of the parent's siblings are also completed.
   */
  public static cascadeParentCompletion(
    nodes: readonly Node[],
    completedNodeId: string
  ): { updatedNodes: Node[]; completedParentIds: string[] } {
    const updatedNodes = [...nodes];
    const completedParentIds: string[] = [];

    let currentChild = updatedNodes.find((n) => n.id === completedNodeId);

    while (currentChild && currentChild.parentNodeId) {
      const parentId = currentChild.parentNodeId;
      const subtasks = updatedNodes.filter((n) => n.parentNodeId === parentId);

      // If there are subtasks and all of them have status === 'completed'
      if (subtasks.length > 0 && subtasks.every((s) => s.status === 'completed')) {
        const parentIdx = updatedNodes.findIndex((n) => n.id === parentId);
        if (parentIdx !== -1) {
          const parentNode = updatedNodes[parentIdx];
          if (parentNode.status !== 'completed') {
            const updatedParent: Node = {
              ...parentNode,
              status: 'completed',
              updatedAt: new Date().toISOString(),
            };
            updatedNodes[parentIdx] = updatedParent;
            completedParentIds.push(parentId);
            currentChild = updatedParent; // Check next level up (grandparent)
            continue;
          }
        }
      }
      break;
    }

    return { updatedNodes, completedParentIds };
  }

  /**
   * Cascades in_progress status up to parent node(s) when any subtask node inside a parent is in progress.
   * Recursively bubbles up to grandparents and ancestors.
   * Invariant: When any child node is in progress, the parent node is also in progress.
   */
  public static cascadeParentInProgress(
    nodes: readonly Node[],
    inProgressNodeId: string
  ): { updatedNodes: Node[]; inProgressParentIds: string[] } {
    const updatedNodes = [...nodes];
    const inProgressParentIds: string[] = [];

    let currentChild = updatedNodes.find((n) => n.id === inProgressNodeId);

    while (currentChild && currentChild.parentNodeId) {
      const parentId = currentChild.parentNodeId;
      const parentIdx = updatedNodes.findIndex((n) => n.id === parentId);
      if (parentIdx !== -1) {
        const parentNode = updatedNodes[parentIdx];
        if (parentNode.status !== 'in_progress') {
          const updatedParent: Node = {
            ...parentNode,
            status: 'in_progress',
            updatedAt: new Date().toISOString(),
          };
          updatedNodes[parentIdx] = updatedParent;
          inProgressParentIds.push(parentId);
          currentChild = updatedParent; // Check next level up (grandparent)
          continue;
        } else {
          currentChild = parentNode; // Still check up the chain
          continue;
        }
      }
      break;
    }

    return { updatedNodes, inProgressParentIds };
  }

  /**
   * Checks whether a parent node has any direct child node that is currently in progress.
   */
  public static hasInProgressChild(nodes: readonly Node[], parentNodeId: string): boolean {
    return nodes.some((n) => n.parentNodeId === parentNodeId && n.status === 'in_progress');
  }

  /**
   * Checks whether a node's status can be modified.
   * Invariant: When any child node is in progress, the parent node is also in progress and cannot be modified away from in_progress.
   */
  public static canModifyNodeStatus(
    nodes: readonly Node[],
    nodeId: string,
    targetStatus: NodeStatus
  ): { allowed: boolean; reason?: string } {
    if (targetStatus !== 'in_progress' && this.hasInProgressChild(nodes, nodeId)) {
      return {
        allowed: false,
        reason: 'Cannot modify status: child node is in progress. Parent node must remain in progress.',
      };
    }
    return { allowed: true };
  }

  /**
   * Full hierarchy status synchronization: ensures that for all nodes in the document,
   * if any child node is in progress, the parent node is also in progress.
   */
  public static syncParentStatusHierarchy(nodes: readonly Node[]): {
    updatedNodes: Node[];
    affectedParentIds: string[];
  } {
    const updatedNodes = [...nodes];
    const affectedParentIds: string[] = [];
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = 0; i < updatedNodes.length; i++) {
        const parent = updatedNodes[i];
        const hasInProgress = updatedNodes.some(
          (n) => n.parentNodeId === parent.id && n.status === 'in_progress'
        );
        if (hasInProgress && parent.status !== 'in_progress') {
          updatedNodes[i] = {
            ...parent,
            status: 'in_progress',
            updatedAt: new Date().toISOString(),
          };
          if (!affectedParentIds.includes(parent.id)) {
            affectedParentIds.push(parent.id);
          }
          changed = true;
        }
      }
    }

    return { updatedNodes, affectedParentIds };
  }

  /**
   * Checks whether candidateId is a descendant of ancestorId in the parent-child hierarchy.
   */
  public static isDescendantOf(
    nodes: readonly Node[],
    candidateId: string,
    ancestorId: string
  ): boolean {
    if (candidateId === ancestorId) return true;
    let curr: string | null | undefined = candidateId;
    const visited = new Set<string>();
    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const node = nodes.find((n) => n.id === curr);
      if (!node) break;
      if (node.parentNodeId === ancestorId) return true;
      curr = node.parentNodeId;
    }
    return false;
  }

  /**
   * Nests a source node inside a target parent node, making sourceNode a child of targetParent.
   * If sourceNode has children/subtasks, their hierarchy under sourceNode is preserved recursively.
   * Edges connecting sourceNode at the previous scope level are gracefully re-routed to targetParent
   * without creating self-loops or DAG cycles.
   * Automatically re-synchronizes parent due dates, attention units (AU invariant), and status hierarchy.
   */
  public static nestNodeInParent(
    doc: ProjectDocument,
    sourceNodeId: string,
    targetParentId: string
  ): { success: true; document: ProjectDocument } | { success: false; error: string } {
    if (!doc) return { success: false, error: 'Document is required' };

    const sourceNode = doc.nodes.find((n) => n.id === sourceNodeId);
    const targetParent = doc.nodes.find((n) => n.id === targetParentId);
    if (!sourceNode || !targetParent) {
      return { success: false, error: 'Source or target node not found.' };
    }

    if (sourceNodeId === targetParentId) {
      return { success: false, error: 'Cannot nest a node into itself.' };
    }

    if (doc.project.endGoalNodeId === sourceNodeId) {
      return { success: false, error: 'Cannot nest the project Goal node.' };
    }

    // Cycle prevention: targetParent cannot be a descendant of sourceNode
    if (ProjectService.isDescendantOf(doc.nodes, targetParentId, sourceNodeId)) {
      return { success: false, error: 'Cannot nest a node into one of its own subtasks/descendants.' };
    }

    if (sourceNode.parentNodeId === targetParentId) {
      return { success: true, document: doc };
    }

    // Position sourceNode neatly inside targetParent
    const existingChildren = doc.nodes.filter(
      (n) => n.parentNodeId === targetParentId && n.id !== sourceNodeId
    );
    let newPos: { x: number; y: number };
    if (existingChildren.length > 0) {
      const maxY = existingChildren.reduce((max, c) => Math.max(max, c.position?.y ?? 100), 100);
      newPos = { x: 100, y: maxY + 160 };
    } else {
      newPos = { x: 100, y: 100 };
    }

    const updatedSourceNode: Node = {
      ...sourceNode,
      parentNodeId: targetParentId,
      position: newPos,
      updatedAt: new Date().toISOString(),
    };

    // Re-route connecting edges
    const updatedEdges: Edge[] = [];
    const existingEdgeKeys = new Set(doc.edges.map((e) => `${e.fromNodeId}->${e.toNodeId}`));

    for (const edge of doc.edges) {
      // Direct edge between source and targetParent: eliminate it
      if (
        (edge.fromNodeId === sourceNodeId && edge.toNodeId === targetParentId) ||
        (edge.fromNodeId === targetParentId && edge.toNodeId === sourceNodeId)
      ) {
        continue;
      }

      // Outgoing edge from sourceNode: re-route from targetParent
      if (edge.fromNodeId === sourceNodeId) {
        if (targetParentId !== edge.toNodeId) {
          const wouldCycle = GraphService.wouldCreateCycle(
            targetParentId,
            edge.toNodeId,
            doc.edges.filter((e) => e.id !== edge.id)
          );
          if (!wouldCycle) {
            const key = `${targetParentId}->${edge.toNodeId}`;
            if (!existingEdgeKeys.has(key)) {
              existingEdgeKeys.add(key);
              updatedEdges.push({
                ...edge,
                fromNodeId: targetParentId,
              });
            }
          }
        }
        continue;
      }

      // Incoming edge to sourceNode: re-route to targetParent
      if (edge.toNodeId === sourceNodeId) {
        if (edge.fromNodeId !== targetParentId) {
          const wouldCycle = GraphService.wouldCreateCycle(
            edge.fromNodeId,
            targetParentId,
            doc.edges.filter((e) => e.id !== edge.id)
          );
          if (!wouldCycle) {
            const key = `${edge.fromNodeId}->${targetParentId}`;
            if (!existingEdgeKeys.has(key)) {
              existingEdgeKeys.add(key);
              updatedEdges.push({
                ...edge,
                toNodeId: targetParentId,
              });
            }
          }
        }
        continue;
      }

      updatedEdges.push(edge);
    }

    let updatedNodes = doc.nodes.map((n) => (n.id === sourceNodeId ? updatedSourceNode : n));

    // Synchronize invariants: due dates, attention units, status hierarchy
    updatedNodes = TemporalService.syncParentDueDates(updatedNodes);
    updatedNodes = AttentionService.syncParentEstimatedAU(updatedNodes);
    const statusSync = ProjectService.syncParentStatusHierarchy(updatedNodes);
    updatedNodes = statusSync.updatedNodes;

    const updatedDoc: ProjectDocument = {
      ...doc,
      nodes: updatedNodes,
      edges: updatedEdges,
      exportedAt: new Date().toISOString(),
      project: {
        ...doc.project,
        updatedAt: new Date().toISOString(),
      },
    };

    return { success: true, document: updatedDoc };
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
   * Moves an active project to the Idea Parking Lot, removing attention.
   * Graph nodes and edges are 100% preserved.
   */
  public static parkProject(project: Project): Project {
    const now = new Date().toISOString();
    return {
      ...project,
      status: 'parked',
      isAttention: false,
      attentionPromotedAt: undefined,
      updatedAt: now,
    };
  }

  /**
   * Unparks a project from the Idea Parking Lot back into active status.
   */
  public static unparkProject(project: Project): Project {
    const now = new Date().toISOString();
    return {
      ...project,
      status: 'active',
      updatedAt: now,
    };
  }

  /**
   * Promotes or demotes a project to/from Priority Attention status.
   */
  public static setProjectAttention(project: Project, isAttention: boolean): Project {
    const now = new Date().toISOString();
    return {
      ...project,
      isAttention,
      attentionPromotedAt: isAttention ? now : undefined,
      // If promoting a parked project to attention, unpark it automatically
      status: isAttention && project.status === 'parked' ? 'active' : project.status,
      updatedAt: now,
    };
  }

  /**
   * Creates a lightweight Idea Seed (uncluttered, non-graph thought).
   */
  public static createIdeaSeed(
    title: string,
    rawNotesOrOptions?:
      | string
      | {
          rawNotes?: string;
          seedThoughts?: string[];
          tags?: string[];
        },
    seedThoughts?: string[],
    tags?: string[]
  ): IdeaSeed {
    const now = new Date().toISOString();
    let rawNotes: string | undefined;
    let thoughts: string[] = [];
    let initialTags: string[] = [];

    if (typeof rawNotesOrOptions === 'object' && rawNotesOrOptions !== null) {
      rawNotes = rawNotesOrOptions.rawNotes?.trim() || undefined;
      thoughts = rawNotesOrOptions.seedThoughts || [];
      initialTags = rawNotesOrOptions.tags || [];
    } else {
      rawNotes = typeof rawNotesOrOptions === 'string' ? rawNotesOrOptions.trim() || undefined : undefined;
      thoughts = seedThoughts || [];
      initialTags = tags || [];
    }

    return {
      id: ProjectService.generateId('seed'),
      title: title.trim(),
      rawNotes,
      seedThoughts: thoughts.map((t) => t.trim()).filter(Boolean),
      tags: ProjectService.normalizeTags(initialTags),
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Updates an existing Idea Seed.
   */
  public static updateIdeaSeed(
    seed: IdeaSeed,
    updates: Partial<Omit<IdeaSeed, 'id' | 'createdAt'>>
  ): IdeaSeed {
    const now = new Date().toISOString();
    return {
      ...seed,
      title: updates.title !== undefined ? updates.title.trim() : seed.title,
      rawNotes: updates.rawNotes !== undefined ? updates.rawNotes.trim() : seed.rawNotes,
      seedThoughts:
        updates.seedThoughts !== undefined
          ? updates.seedThoughts.map((t) => t.trim()).filter(Boolean)
          : seed.seedThoughts,
      tags: updates.tags !== undefined ? ProjectService.normalizeTags(updates.tags) : seed.tags,
      updatedAt: now,
    };
  }

  /**
   * Germinates a lightweight Idea Seed into a full Graphdule Project.
   * The seed's title becomes the Project Title & End Goal Node (EGN).
   * Any seedThoughts become initial predecessor nodes connected into the EGN.
   */
  public static germinateSeedToProject(
    seed: IdeaSeed,
    deadline?: string,
    style?: ProjectStyle
  ): {
    project: Project;
    egnNode: Node;
    nodes: Node[];
    predecessorNodes: Node[];
    edges: Edge[];
    note?: ProjectNote;
  } {
    const now = new Date().toISOString();
    const projectId = ProjectService.generateId('proj');
    const egnId = ProjectService.generateId('egn');
    const projectDeadline = deadline || getTodayString();

    const egnNode: Node = {
      id: egnId,
      projectId,
      parentNodeId: null,
      text: seed.title,
      dueDate: projectDeadline,
      status: 'planned',
      position: { x: 700, y: 250 },
      createdAt: now,
      updatedAt: now,
    };

    const nodes: Node[] = [egnNode];
    const predecessorNodes: Node[] = [];
    const edges: Edge[] = [];

    const thoughts = seed.seedThoughts || [];
    const stepY = 120;
    const startY = Math.max(100, 250 - Math.floor(thoughts.length / 2) * stepY);

    thoughts.forEach((thought, idx) => {
      const nodeId = ProjectService.generateId('node');
      const node: Node = {
        id: nodeId,
        projectId,
        parentNodeId: null,
        text: thought,
        dueDate: projectDeadline,
        status: 'planned',
        position: { x: 300, y: startY + idx * stepY },
        createdAt: now,
        updatedAt: now,
      };
      nodes.push(node);
      predecessorNodes.push(node);

      edges.push({
        id: ProjectService.generateId('edge'),
        projectId,
        fromNodeId: nodeId,
        toNodeId: egnId,
        createdAt: now,
      });
    });

    const project: Project = {
      id: projectId,
      name: seed.title,
      endGoalNodeId: egnId,
      tags: seed.tags ? [...seed.tags] : [],
      status: 'active',
      isAttention: false,
      style: style || { color: 'emerald', icon: 'sparkles' },
      createdAt: now,
      updatedAt: now,
    };

    const note: Note | undefined = seed.rawNotes
      ? {
          id: ProjectService.generateId('note'),
          nodeId: egnId,
          text: seed.rawNotes,
          createdAt: now,
          updatedAt: now,
        }
      : undefined;

    return { project, egnNode, nodes, predecessorNodes, edges, note };
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
    const isParked = status === 'parked';
    const isAttention = Boolean(project.isAttention && status === 'active');

    return {
      id: project.id,
      name: project.name,
      endGoalText: egnNode?.text || project.name,
      deadline: egnNode?.dueDate || getTodayString(),
      tags: project.tags ? [...project.tags] : [],
      status,
      isArchived,
      isParked,
      isAttention,
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

  /**
   * Sorts priority attention projects chronologically from nearest due date to furthest due date.
   * Earlier deadlines appear first (ascending order).
   */
  public static sortAttentionProjects(projects: readonly ProjectSummary[]): ProjectSummary[] {
    return [...projects].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }
}
