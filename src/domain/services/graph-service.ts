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

  /**
   * Validates comprehensive graph invariants:
   * 1. No dangling edges (source and target nodes must exist)
   * 2. No self-loops (fromNodeId !== toNodeId)
   * 3. No duplicate edges (no multiple edges with the same source and target)
   * 4. DAG acyclicity (no directed cycles)
   */
  public static validateGraphInvariants(
    nodes: readonly Node[],
    edges: readonly Edge[]
  ): { isValid: boolean; error?: string } {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const seenEdges = new Set<string>();

    for (const edge of edges) {
      if (!nodeIds.has(edge.fromNodeId)) {
        return { isValid: false, error: `Edge ${edge.id} references non-existent source node: ${edge.fromNodeId}` };
      }
      if (!nodeIds.has(edge.toNodeId)) {
        return { isValid: false, error: `Edge ${edge.id} references non-existent target node: ${edge.toNodeId}` };
      }
      if (edge.fromNodeId === edge.toNodeId) {
        return { isValid: false, error: `Self-loop detected on node: ${edge.fromNodeId}` };
      }
      const pairKey = `${edge.fromNodeId}->${edge.toNodeId}`;
      if (seenEdges.has(pairKey)) {
        return { isValid: false, error: `Duplicate edge detected between ${edge.fromNodeId} and ${edge.toNodeId}` };
      }
      seenEdges.add(pairKey);
    }

    return GraphService.validateDAG(nodes, edges);
  }

  /**
   * Returns a sanitized, invariant-compliant edge set for the given nodes.
   * Removes dangling edges, self-loops, and duplicates deterministically.
   */
  public static sanitizeEdges(nodes: readonly Node[], edges: readonly Edge[]): Edge[] {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const seenEdges = new Set<string>();
    const sanitized: Edge[] = [];

    for (const edge of edges) {
      if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) continue;
      if (edge.fromNodeId === edge.toNodeId) continue;
      const pairKey = `${edge.fromNodeId}->${edge.toNodeId}`;
      if (seenEdges.has(pairKey)) continue;
      seenEdges.add(pairKey);
      sanitized.push(edge);
    }

    return sanitized;
  }

  /**
   * Checks if two line segments (p1-p2 and p3-p4) intersect strictly.
   */
  public static segmentsIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
  ): boolean {
    const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
      return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    };
    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  }

  /**
   * Counts edge crossings in a graph given node positions.
   */
  public static countEdgeCrossings(
    nodePositions: Map<string, { x: number; y: number }>,
    edges: readonly Edge[]
  ): number {
    let crossings = 0;
    const n = edges.length;
    for (let i = 0; i < n; i++) {
      const e1 = edges[i];
      const p1 = nodePositions.get(e1.fromNodeId);
      const p2 = nodePositions.get(e1.toNodeId);
      if (!p1 || !p2) continue;

      for (let j = i + 1; j < n; j++) {
        const e2 = edges[j];
        if (
          e1.fromNodeId === e2.fromNodeId ||
          e1.fromNodeId === e2.toNodeId ||
          e1.toNodeId === e2.fromNodeId ||
          e1.toNodeId === e2.toNodeId
        ) {
          continue;
        }
        const p3 = nodePositions.get(e2.fromNodeId);
        const p4 = nodePositions.get(e2.toNodeId);
        if (!p3 || !p4) continue;

        if (GraphService.segmentsIntersect(p1, p2, p3, p4)) {
          crossings++;
        }
      }
    }
    return crossings;
  }

  /**
   * Computes the critical path (longest path) to the End Goal Node in a DAG.
   * Path length is weighted by estimatedAU (defaults to 1 if not specified).
   * Returns sets of node IDs and edge IDs that constitute the critical path.
   */
  public static calculateCriticalPath(
    nodes: readonly Node[],
    edges: readonly Edge[],
    endGoalNodeId?: string
  ): {
    criticalPathNodeIds: Set<string>;
    criticalPathEdgeIds: Set<string>;
    nodeIds: string[];
    edgeIds: string[];
    totalAU: number;
  } {
    if (nodes.length === 0) {
      return {
        criticalPathNodeIds: new Set(),
        criticalPathEdgeIds: new Set(),
        nodeIds: [],
        edgeIds: [],
        totalAU: 0,
      };
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const validEdges = edges.filter((e) => nodeMap.has(e.fromNodeId) && nodeMap.has(e.toNodeId));
    const sortedNodes = GraphService.topologicalSort(nodes, validEdges);

    const dist = new Map<string, number>();
    const parentEdge = new Map<string, { fromNodeId: string; edgeId: string }>();

    for (const node of sortedNodes) {
      const weight = Math.max(0.25, node.estimatedAU || 1);
      dist.set(node.id, weight);
    }

    for (const u of sortedNodes) {
      const currentDist = dist.get(u.id) || 0;
      const outgoingEdges = validEdges.filter((e) => e.fromNodeId === u.id);

      for (const edge of outgoingEdges) {
        const v = nodeMap.get(edge.toNodeId);
        if (!v) continue;
        const vWeight = Math.max(0.25, v.estimatedAU || 1);
        const candidateDist = currentDist + vWeight;

        if (candidateDist > (dist.get(v.id) || 0)) {
          dist.set(v.id, candidateDist);
          parentEdge.set(v.id, { fromNodeId: u.id, edgeId: edge.id });
        }
      }
    }

    let targetId = endGoalNodeId;
    if (!targetId || !nodeMap.has(targetId)) {
      // Find terminal node (out-degree 0) with maximum cumulative distance
      const outDegrees = new Map<string, number>();
      nodes.forEach((n) => outDegrees.set(n.id, 0));
      validEdges.forEach((e) => outDegrees.set(e.fromNodeId, (outDegrees.get(e.fromNodeId) || 0) + 1));
      let maxDist = -1;
      let bestTerminal: string | undefined;
      for (const [id, deg] of outDegrees.entries()) {
        if (deg === 0) {
          const d = dist.get(id) || 0;
          if (d > maxDist) {
            maxDist = d;
            bestTerminal = id;
          }
        }
      }
      targetId = bestTerminal;
    }

    if (!targetId || !nodeMap.has(targetId)) {
      return {
        criticalPathNodeIds: new Set(),
        criticalPathEdgeIds: new Set(),
        nodeIds: [],
        edgeIds: [],
        totalAU: 0,
      };
    }

    const orderedNodeIds: string[] = [];
    const orderedEdgeIds: string[] = [];
    const criticalPathNodeIds = new Set<string>();
    const criticalPathEdgeIds = new Set<string>();

    let curr: string | undefined = targetId;
    orderedNodeIds.unshift(curr);
    criticalPathNodeIds.add(curr);

    while (curr && parentEdge.has(curr)) {
      const p: { fromNodeId: string; edgeId: string } = parentEdge.get(curr)!;
      orderedEdgeIds.unshift(p.edgeId);
      criticalPathEdgeIds.add(p.edgeId);
      orderedNodeIds.unshift(p.fromNodeId);
      criticalPathNodeIds.add(p.fromNodeId);
      curr = p.fromNodeId;
    }

    const totalAU = Math.round((dist.get(targetId) || 0) * 100) / 100;
    return {
      criticalPathNodeIds,
      criticalPathEdgeIds,
      nodeIds: orderedNodeIds,
      edgeIds: orderedEdgeIds,
      totalAU,
    };
  }
}
