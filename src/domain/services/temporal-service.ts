import { Edge, Node, DerivedTemporal, CascadeImpactPreview } from '../models/types';
import { addDays, daysBetween, isAfter, minDate, maxDate } from '../utils/date';

export class TemporalService {
  /**
   * Validates chronological edge invariant: for edge B -> C, dueDate(B) <= dueDate(C).
   */
  public static validateEdgeChronology(
    fromNode: Node,
    toNode: Node
  ): { isValid: boolean; error?: string } {
    if (!fromNode.dueDate || !toNode.dueDate) {
      return { isValid: true };
    }
    if (isAfter(fromNode.dueDate, toNode.dueDate)) {
      return {
        isValid: false,
        error: `Predecessor "${fromNode.text}" (due ${fromNode.dueDate}) cannot have a due date after successor "${toNode.text}" (due ${toNode.dueDate}).`,
      };
    }
    return { isValid: true };
  }

  /**
   * Calculates the cascading impact of changing a node's due date.
   * If shifting targetNode to newDueDate violates chronology for downstream successors,
   * this identifies all affected nodes, the minimum proposed shift, and the reason.
   */
  public static calculateCascadeImpact(
    targetNodeId: string,
    newDueDate: string,
    nodes: readonly Node[],
    edges: readonly Edge[],
    projectId?: string
  ): CascadeImpactPreview | null {
    const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
    const targetNode = nodeMap.get(targetNodeId);
    if (!targetNode) return null;

    const oldDueDate = targetNode.dueDate;
    if (!newDueDate) return null;
    const shiftDays = oldDueDate && newDueDate ? daysBetween(oldDueDate, newDueDate) : 0;

    // If no change or moving earlier, check if targetNode is now earlier than its predecessors or affects successors
    const affectedSuccessors: CascadeImpactPreview['affectedSuccessors'] = [];

    // Simulated date map
    const simulatedDates = new Map<string, string>();
    simulatedDates.set(targetNodeId, newDueDate);

    // Breadth-first propagation over successors
    const queue: string[] = [targetNodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      visited.add(currentId);
      const currentDate = simulatedDates.get(currentId)!;

      const directOutEdges = edges.filter((e) => e.fromNodeId === currentId);
      for (const edge of directOutEdges) {
        const succNode = nodeMap.get(edge.toNodeId);
        if (!succNode) continue;

        const currentSuccDate = simulatedDates.get(succNode.id) || succNode.dueDate;
        if (!currentDate || !currentSuccDate) continue;

        // If predecessor date is after successor date, we have a chronological conflict
        if (isAfter(currentDate, currentSuccDate)) {
          // Successor must move at least to match predecessor date or maintain original offset
          const originalOffset = Math.max(0, daysBetween(targetNode.dueDate, succNode.dueDate));
          const proposedDate = addDays(newDueDate, originalOffset);
          const effectiveProposed = isAfter(currentDate, proposedDate) ? currentDate : proposedDate;

          simulatedDates.set(succNode.id, effectiveProposed);

          // Record as affected
          if (!affectedSuccessors.some((a) => a.nodeId === succNode.id)) {
            affectedSuccessors.push({
              nodeId: succNode.id,
              nodeText: succNode.text,
              currentDueDate: succNode.dueDate,
              proposedDueDate: effectiveProposed,
              reason: `Chronological dependency: must not occur before "${nodeMap.get(currentId)?.text || 'predecessor'}" (${currentDate})`,
            });
          }

          if (!visited.has(succNode.id)) {
            queue.push(succNode.id);
          }
        }
      }
    }

    if (affectedSuccessors.length === 0) {
      return null; // No temporal conflict / cascading required
    }

    return {
      projectId: projectId || targetNode.projectId,
      targetNodeId,
      targetNodeText: targetNode.text,
      oldDueDate,
      newDueDate,
      shiftDays,
      affectedSuccessors,
    };
  }

  /**
   * Batch shifts multiple nodes in a project to a new due date,
   * optionally cascading shifts to downstream successors to preserve chronology.
   */
  public static batchShiftNodes(
    targetNodeIds: readonly string[],
    newDueDate: string,
    nodes: readonly Node[],
    edges: readonly Edge[],
    cascade: boolean
  ): Node[] {
    if (!newDueDate || targetNodeIds.length === 0 || nodes.length === 0) {
      return [...nodes];
    }

    const targetSet = new Set(targetNodeIds);

    if (!cascade) {
      const now = new Date().toISOString();
      const directUpdated = nodes.map((n) =>
        targetSet.has(n.id)
          ? { ...n, dueDate: newDueDate, updatedAt: now }
          : n
      );
      return TemporalService.syncParentDueDates(directUpdated);
    }

    // Topological ordering (predecessors before successors)
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }

    for (const edge of edges) {
      if (inDegree.has(edge.toNodeId) && adj.has(edge.fromNodeId)) {
        inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) || 0) + 1);
        adj.get(edge.fromNodeId)!.push(edge.toNodeId);
      }
    }

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);
      for (const v of adj.get(u) || []) {
        const nextDeg = (inDegree.get(v) || 1) - 1;
        inDegree.set(v, nextDeg);
        if (nextDeg === 0) {
          queue.push(v);
        }
      }
    }

    // Append any nodes not reached (e.g. cycles if any)
    for (const node of nodes) {
      if (!topoOrder.includes(node.id)) {
        topoOrder.push(node.id);
      }
    }

    let currentNodes = [...nodes];
    const now = new Date().toISOString();

    for (const nodeId of topoOrder) {
      if (!targetSet.has(nodeId)) continue;

      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) continue;

      // If already shifted by a predecessor cascade to >= newDueDate, keep the preserved offset
      if (node.dueDate && !isAfter(newDueDate, node.dueDate)) {
        continue;
      }

      const impact = TemporalService.calculateCascadeImpact(
        nodeId,
        newDueDate,
        currentNodes,
        edges,
        node.projectId
      );

      if (impact) {
        currentNodes = TemporalService.applyCascadeShift(impact, currentNodes);
      } else {
        currentNodes = currentNodes.map((n) =>
          n.id === nodeId ? { ...n, dueDate: newDueDate, updatedAt: now } : n
        );
      }
    }

    return TemporalService.syncParentDueDates(currentNodes);
  }

  /**
   * Applies the cascade shift to nodes returning the updated node list.
   */
  public static applyCascadeShift(
    impact: CascadeImpactPreview,
    nodes: readonly Node[]
  ): Node[] {
    const shiftMap = new Map<string, string>();
    shiftMap.set(impact.targetNodeId, impact.newDueDate);
    impact.affectedSuccessors.forEach((aff) => {
      shiftMap.set(aff.nodeId, aff.proposedDueDate);
    });

    const now = new Date().toISOString();
    return nodes.map((n) => {
      if (shiftMap.has(n.id)) {
        return {
          ...n,
          dueDate: shiftMap.get(n.id)!,
          updatedAt: now,
        };
      }
      return n;
    });
  }

  /**
   * Returns all descendants (direct and indirect subtasks) of a node.
   */
  public static getDescendants(nodeId: string, allNodes: readonly Node[]): Node[] {
    const directChildren = allNodes.filter((n) => n.parentNodeId === nodeId);
    return directChildren.flatMap((c) => [c, ...TemporalService.getDescendants(c.id, allNodes)]);
  }

  /**
   * Computes derived temporal parameters for a node based on atomic inheritance.
   * The length of a node is given by its atomic inheritance when it has children.
   */
  public static getDerivedTemporal(
    node: Node,
    allNodes: readonly Node[]
  ): DerivedTemporal {
    const descendants = TemporalService.getDescendants(node.id, allNodes);

    if (descendants.length === 0) {
      return {
        nodeId: node.id,
        explicitDueDate: node.dueDate,
        derivedStartDate: node.dueDate,
        derivedDurationDays: 1,
        isDerived: false,
      };
    }

    const descendantDueDates = descendants.map((d) => d.dueDate).filter(Boolean);
    if (descendantDueDates.length === 0) {
      return {
        nodeId: node.id,
        explicitDueDate: node.dueDate,
        derivedStartDate: node.dueDate,
        derivedDurationDays: 1,
        isDerived: false,
      };
    }

    const earliestStart = minDate(descendantDueDates);
    const latestDue = maxDate(descendantDueDates);
    const effectiveDue = isAfter(latestDue, node.dueDate) ? latestDue : (node.dueDate || latestDue);
    const durationDays = earliestStart && effectiveDue ? Math.max(1, daysBetween(earliestStart, effectiveDue)) : 1;

    return {
      nodeId: node.id,
      explicitDueDate: effectiveDue,
      derivedStartDate: earliestStart,
      derivedDurationDays: durationDays,
      isDerived: true,
    };
  }

  /**
   * Automatically synchronizes parent nodes' due dates to match their atomic inheritance.
   * The due date of a decomposed parent node is automatically computed as the latest due date among its children.
   */
  public static syncParentDueDates(nodes: readonly Node[]): Node[] {
    let currentNodes = [...nodes];
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 10) {
      changed = false;
      iterations++;

      currentNodes = currentNodes.map((node) => {
        const directChildren = currentNodes.filter((n) => n.parentNodeId === node.id);
        if (directChildren.length === 0) return node;

        const childDates = directChildren.map((c) => c.dueDate).filter(Boolean);
        if (childDates.length === 0) return node;

        const maxChildDueDate = maxDate(childDates);
        if (maxChildDueDate && maxChildDueDate !== node.dueDate) {
          changed = true;
          return {
            ...node,
            dueDate: maxChildDueDate,
            updatedAt: new Date().toISOString(),
          };
        }
        return node;
      });
    }

    return currentNodes;
  }
}
