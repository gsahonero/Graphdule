import dagre from 'dagre';
import { Node as RFNode, Edge as RFEdge, MarkerType } from '@xyflow/react';
import { Node, Edge } from '../../../domain/models/types';

export const NODE_WIDTH = 270;
export const NODE_HEIGHT = 150;
export const COMPACT_NODE_SIZE = 112;

export function isValidCoordinate(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

export function getLayoutedElements(
  nodes: readonly Node[],
  edges: readonly Edge[],
  direction: 'LR' | 'TB' = 'LR',
  forceLayout = false,
  isCompact = false,
  nodeScale = 1.0
): { rfNodes: RFNode[]; rfEdges: RFEdge[] } {
  const count = nodes.length;
  const nodeW = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_WIDTH) * nodeScale);
  const nodeH = Math.round((isCompact ? COMPACT_NODE_SIZE : NODE_HEIGHT) * nodeScale);

  // Minimized spacing to keep distances between nodes minimal and compact
  const ranksep = direction === 'LR' ? Math.round((isCompact ? 45 : 55) * nodeScale) : Math.round((isCompact ? 40 : 45) * nodeScale);
  const nodesep = direction === 'LR' ? Math.round((isCompact ? 20 : 25) * nodeScale) : Math.round((isCompact ? 20 : 25) * nodeScale);

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep,
    nodesep,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeW, height: nodeH });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.fromNodeId, edge.toNodeId);
  });

  try {
    dagre.layout(dagreGraph);
  } catch (err) {
    console.warn('Dagre layout computation error:', err);
  }

  const rfNodes: RFNode[] = nodes.map((node, index) => {
    const nodeWithPos = dagreGraph.node(node.id);
    let position: { x: number; y: number };

    if (
      !forceLayout &&
      node.position &&
      isValidCoordinate(node.position.x) &&
      isValidCoordinate(node.position.y)
    ) {
      position = { x: node.position.x, y: node.position.y };
    } else if (
      nodeWithPos &&
      isValidCoordinate(nodeWithPos.x) &&
      isValidCoordinate(nodeWithPos.y)
    ) {
      position = {
        x: Math.round(nodeWithPos.x - nodeW / 2),
        y: Math.round(nodeWithPos.y - nodeH / 2),
      };
    } else {
      // Safe fallback for disconnected nodes or unexpected coordinates
      const cols = count <= 4 ? 2 : count <= 8 ? 4 : isCompact ? 6 : 4;
      position = {
        x: (index % cols) * (nodeW + Math.round(30 * nodeScale)) + 50,
        y: Math.floor(index / cols) * (nodeH + Math.round(30 * nodeScale)) + 100,
      };
    }

    return {
      id: node.id,
      type: 'graphNode',
      position,
      data: {
        node,
      },
    };
  });

  const arrowSize = Math.round(18 * nodeScale);
  const strokeWidth = Math.max(1.5, Math.round(2.5 * nodeScale * 10) / 10);
  const interactionWidth = Math.round(20 * nodeScale);

  const rfEdges: RFEdge[] = edges.map((edge) => ({
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

  return { rfNodes, rfEdges };
}
