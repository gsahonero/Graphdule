import { Edge, Node } from '../models/types';

export class GraphService {
  /**
   * Checks if adding a directed edge from `fromNodeId` to `toNodeId` creates a cycle.
   */
  public static wouldCreateCycle(
    fromNodeId: string,
    toNodeId: string,
    existingEdges: readonly Edge[]
  ): boolean {
    if (fromNodeId === toNodeId) return true;

    // A cycle is formed if there is already a path from toNodeId to fromNodeId
    const visited = new Set<string>();
    const queue = [toNodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === fromNodeId) {
        return true;
      }
      visited.add(current);

      const nextNodes = existingEdges
        .filter((edge) => edge.fromNodeId === current)
        .map((edge) => edge.toNodeId)
        .filter((id) => !visited.has(id));

      queue.push(...nextNodes);
    }

    return false;
  }

  /**
   * Validates that all edges form a valid Directed Acyclic Graph.
   */
  public static validateDAG(nodes: readonly Node[], edges: readonly Edge[]): { isValid: boolean; error?: string } {
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Check edge node references
    for (const edge of edges) {
      if (!nodeIds.has(edge.fromNodeId)) {
        return { isValid: false, error: `Edge references non-existent fromNode: ${edge.fromNodeId}` };
      }
      if (!nodeIds.has(edge.toNodeId)) {
        return { isValid: false, error: `Edge references non-existent toNode: ${edge.toNodeId}` };
      }
      if (edge.fromNodeId === edge.toNodeId) {
        return { isValid: false, error: `Self-loop detected on node: ${edge.fromNodeId}` };
      }
    }

    // Cycle detection via Kahn's algorithm
    const inDegree = new Map<string, number>();
    nodes.forEach((n) => inDegree.set(n.id, 0));

    edges.forEach((e) => {
      inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    let visitedCount = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      visitedCount++;

      edges
        .filter((e) => e.fromNodeId === u)
        .forEach((e) => {
          const newDeg = (inDegree.get(e.toNodeId) || 1) - 1;
          inDegree.set(e.toNodeId, newDeg);
          if (newDeg === 0) {
            queue.push(e.toNodeId);
          }
        });
    }

    if (visitedCount !== nodes.length) {
      return { isValid: false, error: 'Cycle detected in project graph.' };
    }

    return { isValid: true };
  }

  /**
   * Returns all immediate predecessors (nodes pointing to `nodeId`).
   */
  public static getDirectPredecessors(nodeId: string, nodes: readonly Node[], edges: readonly Edge[]): Node[] {
    const predIds = new Set(edges.filter((e) => e.toNodeId === nodeId).map((e) => e.fromNodeId));
    return nodes.filter((n) => predIds.has(n.id));
  }

  /**
   * Returns all immediate successors (nodes pointed to by `nodeId`).
   */
  public static getDirectSuccessors(nodeId: string, nodes: readonly Node[], edges: readonly Edge[]): Node[] {
    const succIds = new Set(edges.filter((e) => e.fromNodeId === nodeId).map((e) => e.toNodeId));
    return nodes.filter((n) => succIds.has(n.id));
  }

  /**
   * Returns all transitive successors in topological order.
   */
  public static getTransitiveSuccessors(
    nodeId: string,
    nodes: readonly Node[],
    edges: readonly Edge[]
  ): Node[] {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const successors = edges.filter((e) => e.fromNodeId === current).map((e) => e.toNodeId);
      for (const succ of successors) {
        if (!visited.has(succ)) {
          visited.add(succ);
          queue.push(succ);
        }
      }
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return Array.from(visited)
      .map((id) => nodeMap.get(id))
      .filter((n): n is Node => n !== undefined);
  }

  /**
   * Returns all transitive predecessors in topological order.
   */
  public static getTransitivePredecessors(
    nodeId: string,
    nodes: readonly Node[],
    edges: readonly Edge[]
  ): Node[] {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const predecessors = edges.filter((e) => e.toNodeId === current).map((e) => e.fromNodeId);
      for (const pred of predecessors) {
        if (!visited.has(pred)) {
          visited.add(pred);
          queue.push(pred);
        }
      }
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return Array.from(visited)
      .map((id) => nodeMap.get(id))
      .filter((n): n is Node => n !== undefined);
  }

  /**
   * Performs topological sort on nodes.
   */
  public static topologicalSort(nodes: readonly Node[], edges: readonly Edge[]): Node[] {
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, Node>();
    nodes.forEach((n) => {
      inDegree.set(n.id, 0);
      nodeMap.set(n.id, n);
    });

    edges.forEach((e) => {
      inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const sorted: Node[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const node = nodeMap.get(u);
      if (node) sorted.push(node);

      edges
        .filter((e) => e.fromNodeId === u)
        .forEach((e) => {
          const newDeg = (inDegree.get(e.toNodeId) || 1) - 1;
          inDegree.set(e.toNodeId, newDeg);
          if (newDeg === 0) {
            queue.push(e.toNodeId);
          }
        });
    }

    return sorted;
  }
}
