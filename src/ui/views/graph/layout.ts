import { Node as RFNode, Edge as RFEdge, MarkerType } from '@xyflow/react';
import { Node, Edge } from '../../../domain/models/types';
import { GraphService } from '../../../domain/services/graph-service';

export const NODE_WIDTH = 320;
export const NODE_HEIGHT = 150;
export const COMPACT_NODE_SIZE = 112;

export type LayoutDirection = 'LR' | 'TB';
export type LayoutMode = 'LR' | 'TB' | 'auto';

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutMetrics {
  readonly crossings: number;
  readonly totalEdgeLength: number;
  readonly edgeBends: number;
  readonly overlapCount: number;
  readonly boundingBox: BoundingBox;
  readonly score: number;
}

export interface LayoutResult {
  readonly rfNodes: RFNode[];
  readonly rfEdges: RFEdge[];
  readonly boundingBox: BoundingBox;
  readonly direction: LayoutDirection;
  readonly metrics?: LayoutMetrics;
}

export interface ViewportDimensions {
  readonly width: number;
  readonly height: number;
}

export function isValidCoordinate(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

/**
 * Checks if two axis-aligned rectangles overlap (including minimum clearance).
 */
export function doRectanglesOverlap(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number },
  minGapX = 0,
  minGapY = 0
): boolean {
  return (
    r1.x < r2.x + r2.width + minGapX &&
    r1.x + r1.width + minGapX > r2.x &&
    r1.y < r2.y + r2.height + minGapY &&
    r1.y + r1.height + minGapY > r2.y
  );
}

/**
 * Core Layered Graph Layout implementation.
 * Treats nodes as full rectangles and uses a unified (U, V) coordinate system:
 * - In LR: U is horizontal (rank), V is vertical (layer ordering)
 * - In TB: U is vertical (rank), V is horizontal (layer ordering)
 */
class LayeredGraphLayout {
  private readonly nodes: readonly Node[];
  private readonly validEdges: readonly Edge[];
  private readonly direction: LayoutDirection;
  private readonly nodeW: number;
  private readonly nodeH: number;
  private readonly customDimensions?: Map<string, { width: number; height: number }>;

  // Spacing parameters in (U, V) space
  private readonly spacingU: number;
  private readonly spacingV: number;

  constructor(
    nodes: readonly Node[],
    validEdges: readonly Edge[],
    direction: LayoutDirection,
    isCompact: boolean,
    nodeScale: number,
    customDimensions?: Map<string, { width: number; height: number }>
  ) {
    this.nodes = nodes;
    this.validEdges = validEdges;
    this.direction = direction;
    this.customDimensions = customDimensions;

    this.nodeW = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_WIDTH) * nodeScale);
    this.nodeH = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_HEIGHT) * nodeScale);

    if (direction === 'LR') {
      this.spacingU = Math.round((isCompact ? 50 : 70) * nodeScale);
      this.spacingV = Math.round((isCompact ? 25 : 35) * nodeScale);
    } else {
      this.spacingU = Math.round((isCompact ? 50 : 65) * nodeScale);
      this.spacingV = Math.round((isCompact ? 25 : 35) * nodeScale);
    }
  }

  public getNodeW(nodeId?: string): number {
    if (nodeId && this.customDimensions?.has(nodeId)) {
      return this.customDimensions.get(nodeId)!.width;
    }
    return this.nodeW;
  }

  public getNodeH(nodeId?: string): number {
    if (nodeId && this.customDimensions?.has(nodeId)) {
      return this.customDimensions.get(nodeId)!.height;
    }
    return this.nodeH;
  }

  private getNodeDimU(nodeId?: string): number {
    return this.direction === 'LR' ? this.getNodeW(nodeId) : this.getNodeH(nodeId);
  }

  private getNodeDimV(nodeId?: string): number {
    return this.direction === 'LR' ? this.getNodeH(nodeId) : this.getNodeW(nodeId);
  }

  /**
   * Executes the layered layout and returns final (x, y) coordinates for all nodes.
   */
  public computeLayout(): {
    positions: Map<string, { x: number; y: number }>;
    boundingBox: BoundingBox;
    metrics: LayoutMetrics;
  } {
    const nodeCount = this.nodes.length;
    const positions = new Map<string, { x: number; y: number }>();

    if (nodeCount === 0) {
      const emptyBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
      return {
        positions,
        boundingBox: emptyBox,
        metrics: {
          crossings: 0,
          totalEdgeLength: 0,
          edgeBends: 0,
          overlapCount: 0,
          boundingBox: emptyBox,
          score: 0,
        },
      };
    }

    if (nodeCount === 1) {
      const node = this.nodes[0];
      const posX = 60;
      const posY = 60;
      positions.set(node.id, { x: posX, y: posY });
      const box: BoundingBox = { x: posX, y: posY, width: this.nodeW, height: this.nodeH };
      return {
        positions,
        boundingBox: box,
        metrics: {
          crossings: 0,
          totalEdgeLength: 0,
          edgeBends: 0,
          overlapCount: 0,
          boundingBox: box,
          score: 0,
        },
      };
    }

    // 1. Assign Ranks (Layers) using directed DAG relationships
    const ranks = this.assignRanks();

    // 2. Order nodes within each layer to minimize edge crossings
    const orderedLayers = this.orderLayers(ranks);

    // 3. Assign coordinates in (U, V) space
    const uvCoords = this.assignUVCoordinates(orderedLayers);

    // 4. Transform (U, V) to (X, Y)
    const rawCoords = new Map<string, { x: number; y: number }>();
    uvCoords.forEach((uv, id) => {
      if (this.direction === 'LR') {
        rawCoords.set(id, { x: uv.u, y: uv.v });
      } else {
        rawCoords.set(id, { x: uv.v, y: uv.u });
      }
    });

    // 5. Detect and resolve any rectangle overlaps
    const resolvedCoords = this.resolveRectangleOverlaps(rawCoords);

    // 6. Normalize coordinates with clean positive padding (minX >= 60, minY >= 60)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    resolvedCoords.forEach((pos, id) => {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      const w = this.getNodeW(id);
      const h = this.getNodeH(id);
      if (pos.x + w > maxX) maxX = pos.x + w;
      if (pos.y + h > maxY) maxY = pos.y + h;
    });

    const targetMinX = 60;
    const targetMinY = 60;
    const shiftX = targetMinX - minX;
    const shiftY = targetMinY - minY;

    const finalPositions = new Map<string, { x: number; y: number }>();
    resolvedCoords.forEach((pos, id) => {
      finalPositions.set(id, {
        x: Math.round(pos.x + shiftX),
        y: Math.round(pos.y + shiftY),
      });
    });

    const finalBoundingBox: BoundingBox = {
      x: targetMinX,
      y: targetMinY,
      width: Math.max(this.nodeW, maxX - minX),
      height: Math.max(this.nodeH, maxY - minY),
    };

    // Calculate layout metrics
    const metrics = this.evaluateMetrics(finalPositions, finalBoundingBox);

    return {
      positions: finalPositions,
      boundingBox: finalBoundingBox,
      metrics,
    };
  }

  /**
   * Stage 1: Assign each node a topological rank based on directed edges.
   */
  private assignRanks(): Map<string, number> {
    const ranks = new Map<string, number>();
    const inEdges = new Map<string, string[]>();
    const outEdges = new Map<string, string[]>();

    this.nodes.forEach((n) => {
      inEdges.set(n.id, []);
      outEdges.set(n.id, []);
    });

    this.validEdges.forEach((e) => {
      inEdges.get(e.toNodeId)?.push(e.fromNodeId);
      outEdges.get(e.fromNodeId)?.push(e.toNodeId);
    });

    // Kahn's algorithm topological traversal for ranking
    const inDegree = new Map<string, number>();
    this.nodes.forEach((n) => {
      inDegree.set(n.id, inEdges.get(n.id)?.length || 0);
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) {
        queue.push(id);
        ranks.set(id, 0);
      }
    });

    let visitedCount = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      visitedCount++;
      const currentRank = ranks.get(u) || 0;

      const successors = outEdges.get(u) || [];
      for (const v of successors) {
        const nextRankCandidate = currentRank + 1;
        const prevRank = ranks.get(v) || 0;
        if (nextRankCandidate > prevRank) {
          ranks.set(v, nextRankCandidate);
        }

        const newDeg = (inDegree.get(v) || 1) - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) {
          queue.push(v);
        }
      }
    }

    // Handle any unranked nodes (e.g. disconnected cycles if any exist)
    if (visitedCount < this.nodes.length) {
      let maxRank = 0;
      ranks.forEach((r) => {
        if (r > maxRank) maxRank = r;
      });
      this.nodes.forEach((n) => {
        if (!ranks.has(n.id)) {
          ranks.set(n.id, maxRank + 1);
        }
      });
    }

    return ranks;
  }

  /**
   * Stage 2: Order nodes within each layer using two-pass barycentric crossing reduction.
   */
  private orderLayers(ranks: Map<string, number>): string[][] {
    let maxRank = 0;
    ranks.forEach((r) => {
      if (r > maxRank) maxRank = r;
    });

    const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
    ranks.forEach((rank, id) => {
      layers[rank].push(id);
    });

    // Build fast lookup adjacency
    const predsMap = new Map<string, string[]>();
    const succsMap = new Map<string, string[]>();
    this.nodes.forEach((n) => {
      predsMap.set(n.id, []);
      succsMap.set(n.id, []);
    });
    this.validEdges.forEach((e) => {
      predsMap.get(e.toNodeId)?.push(e.fromNodeId);
      succsMap.get(e.fromNodeId)?.push(e.toNodeId);
    });

    const positionInLayer = new Map<string, number>();
    const updatePositions = () => {
      layers.forEach((layer) => {
        layer.forEach((id, idx) => {
          positionInLayer.set(id, idx);
        });
      });
    };
    updatePositions();

    // Perform multiple alternating sweeps
    const sweepIterations = 4;
    for (let iter = 0; iter < sweepIterations; iter++) {
      // Downward sweep: layer 1 to maxRank
      for (let r = 1; r <= maxRank; r++) {
        const layer = layers[r];
        const barycenters = new Map<string, number>();

        layer.forEach((id) => {
          const preds = predsMap.get(id) || [];
          if (preds.length === 0) {
            barycenters.set(id, positionInLayer.get(id) || 0);
          } else {
            const sum = preds.reduce((acc, p) => acc + (positionInLayer.get(p) ?? 0), 0);
            barycenters.set(id, sum / preds.length);
          }
        });

        layer.sort((a, b) => (barycenters.get(a) || 0) - (barycenters.get(b) || 0));
        updatePositions();
      }

      // Upward sweep: layer maxRank - 1 down to 0
      for (let r = maxRank - 1; r >= 0; r--) {
        const layer = layers[r];
        const barycenters = new Map<string, number>();

        layer.forEach((id) => {
          const succs = succsMap.get(id) || [];
          if (succs.length === 0) {
            barycenters.set(id, positionInLayer.get(id) || 0);
          } else {
            const sum = succs.reduce((acc, s) => acc + (positionInLayer.get(s) ?? 0), 0);
            barycenters.set(id, sum / succs.length);
          }
        });

        layer.sort((a, b) => (barycenters.get(a) || 0) - (barycenters.get(b) || 0));
        updatePositions();
      }
    }

    return layers;
  }

  /**
   * Stage 3: Assign coordinates in abstract (U, V) space.
   */
  private assignUVCoordinates(layers: string[][]): Map<string, { u: number; v: number }> {
    const coords = new Map<string, { u: number; v: number }>();

    // Calculate maximum V span across all layers to center smaller layers
    let maxTotalVLength = 0;
    layers.forEach((layer) => {
      let layerV = 0;
      layer.forEach((id, idx) => {
        layerV += this.getNodeDimV(id) + (idx > 0 ? this.spacingV : 0);
      });
      if (layerV > maxTotalVLength) maxTotalVLength = layerV;
    });

    // Track predecessors and successors for barycenter secondary alignment
    const predsMap = new Map<string, string[]>();
    this.nodes.forEach((n) => predsMap.set(n.id, []));
    this.validEdges.forEach((e) => predsMap.get(e.toNodeId)?.push(e.fromNodeId));

    let currentU = 0;
    layers.forEach((layer) => {
      if (layer.length === 0) return;

      let layerVLength = 0;
      let maxLayerDimU = 0;
      layer.forEach((id, idx) => {
        const dimU = this.getNodeDimU(id);
        const dimV = this.getNodeDimV(id);
        if (dimU > maxLayerDimU) maxLayerDimU = dimU;
        layerVLength += dimV + (idx > 0 ? this.spacingV : 0);
      });

      const layerOffsetV = Math.max(0, (maxTotalVLength - layerVLength) / 2);

      let runningV = layerOffsetV;
      layer.forEach((id, indexInLayer) => {
        const dimV = this.getNodeDimV(id);
        let targetV = runningV;

        // Barycentric alignment with predecessor if single predecessor exists
        const preds = predsMap.get(id) || [];
        if (preds.length === 1 && coords.has(preds[0])) {
          const predV = coords.get(preds[0])!.v;
          const prevId = indexInLayer > 0 ? layer[indexInLayer - 1] : null;
          const minAllowedV = prevId
            ? (coords.get(prevId)!.v + this.getNodeDimV(prevId) + this.spacingV)
            : 0;
          if (predV >= minAllowedV) {
            targetV = predV;
          }
        }

        coords.set(id, {
          u: currentU,
          v: targetV,
        });

        runningV = targetV + dimV + this.spacingV;
      });

      // Forward sweep: ensure minimum separation
      for (let i = 1; i < layer.length; i++) {
        const prevId = layer[i - 1];
        const currId = layer[i];
        const prevV = coords.get(prevId)!.v;
        const prevDimV = this.getNodeDimV(prevId);
        const currCoord = coords.get(currId)!;
        const minV = prevV + prevDimV + this.spacingV;
        if (currCoord.v < minV) {
          coords.set(currId, { u: currCoord.u, v: minV });
        }
      }

      currentU += maxLayerDimU + this.spacingU;
    });

    return coords;
  }

  /**
   * Stage 4: Detect and resolve any rectangle overlap strictly.
   */
  private resolveRectangleOverlaps(
    positions: Map<string, { x: number; y: number }>
  ): Map<string, { x: number; y: number }> {
    const resolved = new Map<string, { x: number; y: number }>();
    positions.forEach((pos, id) => resolved.set(id, { ...pos }));

    const nodeIds = Array.from(positions.keys());
    const minGapX = Math.round(this.spacingV * 0.5);
    const minGapY = Math.round(this.spacingV * 0.5);

    let hadOverlap = true;
    let iteration = 0;
    const maxIterations = 20;

    while (hadOverlap && iteration < maxIterations) {
      hadOverlap = false;
      iteration++;

      for (let i = 0; i < nodeIds.length; i++) {
        const id1 = nodeIds[i];
        const pos1 = resolved.get(id1)!;
        const rect1 = { x: pos1.x, y: pos1.y, width: this.getNodeW(id1), height: this.getNodeH(id1) };

        for (let j = i + 1; j < nodeIds.length; j++) {
          const id2 = nodeIds[j];
          const pos2 = resolved.get(id2)!;
          const rect2 = { x: pos2.x, y: pos2.y, width: this.getNodeW(id2), height: this.getNodeH(id2) };

          if (doRectanglesOverlap(rect1, rect2, minGapX, minGapY)) {
            hadOverlap = true;

            // Push apart along the secondary axis based on orientation
            if (this.direction === 'LR') {
              // Push along Y
              const overlapY = rect1.y <= rect2.y
                ? (rect1.y + rect1.height + minGapY) - rect2.y
                : (rect2.y + rect2.height + minGapY) - rect1.y;

              const shift = Math.ceil(overlapY / 2) + 2;
              if (rect1.y <= rect2.y) {
                resolved.set(id1, { x: pos1.x, y: pos1.y - shift });
                resolved.set(id2, { x: pos2.x, y: pos2.y + shift });
              } else {
                resolved.set(id1, { x: pos1.x, y: pos1.y + shift });
                resolved.set(id2, { x: pos2.x, y: pos2.y - shift });
              }
            } else {
              // Push along X
              const overlapX = rect1.x <= rect2.x
                ? (rect1.x + rect1.width + minGapX) - rect2.x
                : (rect2.x + rect2.width + minGapX) - rect1.x;

              const shift = Math.ceil(overlapX / 2) + 2;
              if (rect1.x <= rect2.x) {
                resolved.set(id1, { x: pos1.x - shift, y: pos1.y });
                resolved.set(id2, { x: pos2.x + shift, y: pos2.y });
              } else {
                resolved.set(id1, { x: pos1.x + shift, y: pos1.y });
                resolved.set(id2, { x: pos2.x - shift, y: pos2.y });
              }
            }
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Evaluates layout quality metrics: edge crossings, total length, bends, overlaps.
   */
  private evaluateMetrics(
    positions: Map<string, { x: number; y: number }>,
    boundingBox: BoundingBox
  ): LayoutMetrics {
    // 1. Crossings
    const crossings = GraphService.countEdgeCrossings(positions, this.validEdges);

    // 2. Total edge length and bends
    let totalEdgeLength = 0;
    let edgeBends = 0;

    for (const edge of this.validEdges) {
      const p1 = positions.get(edge.fromNodeId);
      const p2 = positions.get(edge.toNodeId);
      if (!p1 || !p2) continue;

      let sx: number, sy: number, tx: number, ty: number;
      if (this.direction === 'LR') {
        sx = p1.x + this.getNodeW(edge.fromNodeId);
        sy = p1.y + this.getNodeH(edge.fromNodeId) / 2;
        tx = p2.x;
        ty = p2.y + this.getNodeH(edge.toNodeId) / 2;
        edgeBends += Math.abs(ty - sy);
      } else {
        sx = p1.x + this.getNodeW(edge.fromNodeId) / 2;
        sy = p1.y + this.getNodeH(edge.fromNodeId);
        tx = p2.x + this.getNodeW(edge.toNodeId) / 2;
        ty = p2.y;
        edgeBends += Math.abs(tx - sx);
      }

      const dx = tx - sx;
      const dy = ty - sy;
      totalEdgeLength += Math.sqrt(dx * dx + dy * dy);
    }

    // 3. Overlap count
    let overlapCount = 0;
    const nodeIds = Array.from(positions.keys());
    for (let i = 0; i < nodeIds.length; i++) {
      const pos1 = positions.get(nodeIds[i])!;
      const r1 = { x: pos1.x, y: pos1.y, width: this.getNodeW(nodeIds[i]), height: this.getNodeH(nodeIds[i]) };
      for (let j = i + 1; j < nodeIds.length; j++) {
        const pos2 = positions.get(nodeIds[j])!;
        const r2 = { x: pos2.x, y: pos2.y, width: this.getNodeW(nodeIds[j]), height: this.getNodeH(nodeIds[j]) };
        if (doRectanglesOverlap(r1, r2, 0, 0)) {
          overlapCount++;
        }
      }
    }

    return {
      crossings,
      totalEdgeLength: Math.round(totalEdgeLength),
      edgeBends: Math.round(edgeBends),
      overlapCount,
      boundingBox,
      score: 0,
    };
  }
}

/**
 * Auto Layout Evaluator:
 * Compares LR and TB layered layouts against the canvas viewport and chooses
 * the orientation that produces the most readable, usable result.
 */
export function evaluateBestLayout(
  nodes: readonly Node[],
  edges: readonly Edge[],
  isCompact: boolean,
  nodeScale: number,
  viewport?: ViewportDimensions
): {
  direction: LayoutDirection;
  positions: Map<string, { x: number; y: number }>;
  boundingBox: BoundingBox;
  metrics: LayoutMetrics;
} {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId) && e.fromNodeId !== e.toNodeId
  );

  const lrLayout = new LayeredGraphLayout(nodes, validEdges, 'LR', isCompact, nodeScale);
  const tbLayout = new LayeredGraphLayout(nodes, validEdges, 'TB', isCompact, nodeScale);

  const lrRes = lrLayout.computeLayout();
  const tbRes = tbLayout.computeLayout();

  // Determine viewport aspect ratio (defaulting to 1.6 for desktop landscape if unspecified)
  const vpWidth = viewport?.width && viewport.width > 0 ? viewport.width : 1200;
  const vpHeight = viewport?.height && viewport.height > 0 ? viewport.height : 750;
  const viewportAspect = vpWidth / vpHeight;

  const scoreCandidate = (
    metrics: LayoutMetrics,
    box: BoundingBox
  ): number => {
    // 1. Edge crossings penalty (heavily weighted: crossings are visual noise)
    const crossingCost = metrics.crossings * 1000;

    // 2. Overlap penalty (strictly prohibited)
    const overlapCost = metrics.overlapCount * 50000;

    // 3. Aspect ratio mismatch penalty
    const graphAspect = box.height > 0 ? box.width / box.height : 1;
    const aspectMismatch = Math.abs(Math.log(graphAspect) - Math.log(viewportAspect));
    const aspectCost = aspectMismatch * 300;

    // 4. Edge length and bends penalty
    const lengthCost = metrics.totalEdgeLength * 0.1;
    const bendsCost = metrics.edgeBends * 0.5;

    // 5. Area footprint cost
    const areaCost = (box.width * box.height) / 10000;

    return crossingCost + overlapCost + aspectCost + lengthCost + bendsCost + areaCost;
  };

  const lrScore = scoreCandidate(lrRes.metrics, lrRes.boundingBox);
  const tbScore = scoreCandidate(tbRes.metrics, tbRes.boundingBox);

  if (tbScore < lrScore) {
    return {
      direction: 'TB',
      positions: tbRes.positions,
      boundingBox: tbRes.boundingBox,
      metrics: { ...tbRes.metrics, score: tbScore },
    };
  }

  return {
    direction: 'LR',
    positions: lrRes.positions,
    boundingBox: lrRes.boundingBox,
    metrics: { ...lrRes.metrics, score: lrScore },
  };
}

/**
 * Primary layout entry point used by GraphView and tests.
 * Fully backwards-compatible while supporting 'auto', bounding box return, and deterministic edge routing.
 */
export function getLayoutedElements(
  nodes: readonly Node[],
  edges: readonly Edge[],
  direction: LayoutMode = 'LR',
  forceLayout = false,
  isCompact = false,
  nodeScale = 1.0,
  viewport?: ViewportDimensions
): LayoutResult {
  const nodeW = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_WIDTH) * nodeScale);
  const nodeH = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_HEIGHT) * nodeScale);

  // 1. Sanitize edges: ensure both endpoints exist in nodes and ignore self-loops
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId) && e.fromNodeId !== e.toNodeId
  );

  // 2. Check if all nodes already have valid positions and forceLayout is false
  const hasUserPositions =
    !forceLayout &&
    nodes.length > 0 &&
    nodes.every((n) => n.position && isValidCoordinate(n.position.x) && isValidCoordinate(n.position.y));

  let finalPositions = new Map<string, { x: number; y: number }>();
  let chosenDir: LayoutDirection = direction === 'TB' ? 'TB' : 'LR';
  let layoutMetrics: LayoutMetrics | undefined;
  let boundingBox: BoundingBox;

  if (hasUserPositions) {
    // Preserve existing manual positions exactly as placed
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const pos = { x: n.position!.x, y: n.position!.y };
      finalPositions.set(n.id, pos);
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + nodeW > maxX) maxX = pos.x + nodeW;
      if (pos.y + nodeH > maxY) maxY = pos.y + nodeH;
    });

    boundingBox = {
      x: minX,
      y: minY,
      width: Math.max(nodeW, maxX - minX),
      height: Math.max(nodeH, maxY - minY),
    };
  } else {
    // Derive layout dynamically using the layered layout engine
    if (direction === 'auto') {
      const evaluated = evaluateBestLayout(nodes, validEdges, isCompact, nodeScale, viewport);
      finalPositions = evaluated.positions;
      chosenDir = evaluated.direction;
      boundingBox = evaluated.boundingBox;
      layoutMetrics = evaluated.metrics;
    } else {
      chosenDir = direction === 'TB' ? 'TB' : 'LR';
      const layout = new LayeredGraphLayout(nodes, validEdges, chosenDir, isCompact, nodeScale);
      const computed = layout.computeLayout();
      finalPositions = computed.positions;
      boundingBox = computed.boundingBox;
      layoutMetrics = computed.metrics;
    }

    // If some nodes had manual positions but not forceLayout, respect existing manual ones
    if (!forceLayout) {
      nodes.forEach((n) => {
        if (n.position && isValidCoordinate(n.position.x) && isValidCoordinate(n.position.y)) {
          finalPositions.set(n.id, { x: n.position.x, y: n.position.y });
        }
      });
    }
  }

  // 3. Build React Flow nodes
  const rfNodes: RFNode[] = nodes.map((node) => {
    const pos = finalPositions.get(node.id) || { x: 60, y: 60 };
    return {
      id: node.id,
      type: 'graphNode',
      position: pos,
      width: nodeW,
      height: nodeH,
      initialWidth: nodeW,
      initialHeight: nodeH,
      measured: {
        width: nodeW,
        height: nodeH,
      },
      data: {
        node,
      },
    };
  });

  // 4. Build React Flow edges with appropriate orientation handles
  const arrowSize = Math.round(18 * nodeScale);
  const strokeWidth = Math.max(1.5, Math.round(2.5 * nodeScale * 10) / 10);
  const interactionWidth = Math.round(20 * nodeScale);

  const rfEdges: RFEdge[] = validEdges.map((edge) => ({
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    type: 'smoothstep',
    animated: false,
    selectable: true,
    focusable: true,
    interactionWidth,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: arrowSize,
      height: arrowSize,
    },
    style: { strokeWidth },
  }));

  return {
    rfNodes,
    rfEdges,
    boundingBox,
    direction: chosenDir,
    metrics: layoutMetrics,
  };
}

export interface CompoundLayoutOptions {
  direction?: LayoutMode;
  forceLayout?: boolean;
  isCompact?: boolean;
  nodeScale?: number;
  viewport?: ViewportDimensions;
  endGoalNodeId?: string;
  criticalPathNodeIds?: Set<string>;
}

/**
 * Compound Hierarchical Layout Engine for Whole Project View (Direction A).
 * Automatically detects decomposed parent tasks and arranges their subtasks
 * into spacious, non-overlapping compound group containers with relative coordinates.
 */
export function getCompoundLayoutedElements(
  nodes: readonly Node[],
  edges: readonly Edge[],
  options: CompoundLayoutOptions = {}
): LayoutResult {
  const direction = options.direction || 'LR';
  const isCompact = options.isCompact ?? false;
  const nodeScale = options.nodeScale ?? 1.0;
  const viewport = options.viewport;
  const endGoalNodeId = options.endGoalNodeId;
  const criticalPathNodeIds = options.criticalPathNodeIds;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeW = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_WIDTH) * nodeScale);
  const nodeH = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_HEIGHT) * nodeScale);

  // 1. Group child nodes by parentNodeId
  const childrenByParent = new Map<string, Node[]>();
  nodes.forEach((n) => {
    if (n.parentNodeId && nodeMap.has(n.parentNodeId)) {
      if (!childrenByParent.has(n.parentNodeId)) {
        childrenByParent.set(n.parentNodeId, []);
      }
      childrenByParent.get(n.parentNodeId)!.push(n);
    }
  });

  // If no hierarchy exists, fall back to standard layout with forced clean positioning
  if (childrenByParent.size === 0) {
    return getLayoutedElements(nodes, edges, direction, true, isCompact, nodeScale, viewport);
  }

  const parentIdSet = new Set(childrenByParent.keys());
  const customDimensions = new Map<string, { width: number; height: number }>();
  const childRelativePos = new Map<string, { x: number; y: number; parentId: string }>();

  // 2. Lay out each sub-DAG inside its compound parent container
  const PAD_X = Math.round(28 * nodeScale);
  const HEADER_H = Math.round(56 * nodeScale);
  const PAD_Y = Math.round(20 * nodeScale);
  const PAD_BOTTOM = Math.round(24 * nodeScale);

  for (const [parentId, children] of childrenByParent.entries()) {
    const childIdSet = new Set(children.map((c) => c.id));
    const internalEdges = edges.filter(
      (e) => childIdSet.has(e.fromNodeId) && childIdSet.has(e.toNodeId) && e.fromNodeId !== e.toNodeId
    );

    // Compute internal layout of children
    const childLayout = getLayoutedElements(
      children,
      internalEdges,
      direction === 'auto' ? 'LR' : direction,
      true,
      isCompact,
      nodeScale
    );

    const childBox = childLayout.boundingBox;
    const containerW = Math.max(340, Math.round(childBox.width + PAD_X * 2));
    const containerH = Math.max(180, Math.round(childBox.height + HEADER_H + PAD_Y + PAD_BOTTOM));

    customDimensions.set(parentId, { width: containerW, height: containerH });

    children.forEach((c) => {
      const rawPos = childLayout.rfNodes.find((n) => n.id === c.id)?.position || { x: 0, y: 0 };
      const relX = Math.round(rawPos.x - childBox.x + PAD_X);
      const relY = Math.round(rawPos.y - childBox.y + HEADER_H + PAD_Y);
      childRelativePos.set(c.id, { x: relX, y: relY, parentId });
    });
  }

  // 3. Construct the meta-graph (Root nodes and parent compound nodes)
  const metaNodes = nodes.filter((n) => !n.parentNodeId || !parentIdSet.has(n.parentNodeId));
  const metaNodeIds = new Set(metaNodes.map((n) => n.id));

  const getMetaAncestorId = (id: string): string => {
    let curr = id;
    const visited = new Set<string>();
    while (nodeMap.get(curr)?.parentNodeId && parentIdSet.has(nodeMap.get(curr)!.parentNodeId!) && !visited.has(curr)) {
      visited.add(curr);
      curr = nodeMap.get(curr)!.parentNodeId!;
    }
    return curr;
  };

  const metaEdges: Edge[] = [];
  const metaEdgeKeySet = new Set<string>();
  edges.forEach((e) => {
    const fromMeta = getMetaAncestorId(e.fromNodeId);
    const toMeta = getMetaAncestorId(e.toNodeId);
    if (fromMeta !== toMeta && metaNodeIds.has(fromMeta) && metaNodeIds.has(toMeta)) {
      const key = `${fromMeta}->${toMeta}`;
      if (!metaEdgeKeySet.has(key)) {
        metaEdgeKeySet.add(key);
        metaEdges.push({
          id: `meta-${key}`,
          projectId: e.projectId,
          fromNodeId: fromMeta,
          toNodeId: toMeta,
          createdAt: e.createdAt,
        });
      }
    }
  });

  // 4. Lay out the meta-graph
  let chosenDir: LayoutDirection = direction === 'TB' ? 'TB' : 'LR';
  let metaPositions = new Map<string, { x: number; y: number }>();
  let finalBoundingBox: BoundingBox;

  if (direction === 'auto') {
    const lrLayout = new LayeredGraphLayout(metaNodes, metaEdges, 'LR', isCompact, nodeScale, customDimensions);
    const tbLayout = new LayeredGraphLayout(metaNodes, metaEdges, 'TB', isCompact, nodeScale, customDimensions);
    const lrRes = lrLayout.computeLayout();
    const tbRes = tbLayout.computeLayout();
    const vp = viewport || { width: 1400, height: 900 };
    const vpAspect = vp.width / vp.height;
    const lrAspect = lrRes.boundingBox.width / Math.max(1, lrRes.boundingBox.height);
    const tbAspect = tbRes.boundingBox.width / Math.max(1, tbRes.boundingBox.height);
    if (Math.abs(tbAspect - vpAspect) < Math.abs(lrAspect - vpAspect) * 0.7) {
      chosenDir = 'TB';
      metaPositions = tbRes.positions;
      finalBoundingBox = tbRes.boundingBox;
    } else {
      chosenDir = 'LR';
      metaPositions = lrRes.positions;
      finalBoundingBox = lrRes.boundingBox;
    }
  } else {
    chosenDir = direction === 'TB' ? 'TB' : 'LR';
    const layout = new LayeredGraphLayout(metaNodes, metaEdges, chosenDir, isCompact, nodeScale, customDimensions);
    const res = layout.computeLayout();
    metaPositions = res.positions;
    finalBoundingBox = res.boundingBox;
  }

  // 5. Build React Flow elements
  // IMPORTANT: In React Flow, parent nodes MUST precede child nodes!
  const rfNodes: RFNode[] = [];

  // Top-level meta nodes first
  metaNodes.forEach((node) => {
    const pos = metaPositions.get(node.id) || { x: 60, y: 60 };
    if (parentIdSet.has(node.id)) {
      const dim = customDimensions.get(node.id)!;
      const children = childrenByParent.get(node.id) || [];
      const completedCount = children.filter((c) => c.status === 'completed').length;
      const totalAU = Math.round(children.reduce((acc, c) => acc + (c.estimatedAU || 0), 0) * 100) / 100;

      rfNodes.push({
        id: node.id,
        type: 'groupNode',
        position: pos,
        width: dim.width,
        height: dim.height,
        style: {
          width: dim.width,
          height: dim.height,
        },
        data: {
          node,
          childCount: children.length,
          completedCount,
          totalAU,
          width: dim.width,
          height: dim.height,
          isOnCriticalPath: criticalPathNodeIds?.has(node.id),
          isEGN: node.id === endGoalNodeId,
          layoutDir: chosenDir,
        },
      });
    } else {
      rfNodes.push({
        id: node.id,
        type: 'graphNode',
        position: pos,
        width: nodeW,
        height: nodeH,
        data: {
          node,
          isEGN: node.id === endGoalNodeId,
          isOnCriticalPath: criticalPathNodeIds?.has(node.id),
          isWholeProjectView: true,
        },
      });
    }
  });

  // Then append child nodes (with parentId and relative coords)
  for (const [parentId, children] of childrenByParent.entries()) {
    children.forEach((child) => {
      const rel = childRelativePos.get(child.id) || { x: PAD_X, y: HEADER_H + PAD_Y };
      rfNodes.push({
        id: child.id,
        type: 'graphNode',
        parentId,
        extent: 'parent',
        position: { x: rel.x, y: rel.y },
        width: nodeW,
        height: nodeH,
        data: {
          node: child,
          isEGN: child.id === endGoalNodeId,
          isOnCriticalPath: criticalPathNodeIds?.has(child.id),
          isWholeProjectView: true,
        },
      });
    });
  }

  // 6. Build rfEdges
  const arrowSize = Math.round(18 * nodeScale);
  const strokeWidth = Math.max(1.5, Math.round(2.5 * nodeScale * 10) / 10);
  const interactionWidth = Math.round(20 * nodeScale);

  const allNodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => allNodeIds.has(e.fromNodeId) && allNodeIds.has(e.toNodeId) && e.fromNodeId !== e.toNodeId
  );

  const rfEdges: RFEdge[] = validEdges.map((edge) => ({
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    type: 'smoothstep',
    animated: false,
    selectable: true,
    focusable: true,
    interactionWidth,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: arrowSize,
      height: arrowSize,
    },
    style: { strokeWidth },
  }));

  return {
    rfNodes,
    rfEdges,
    boundingBox: finalBoundingBox,
    direction: chosenDir,
  };
}

