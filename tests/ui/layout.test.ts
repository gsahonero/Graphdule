import { describe, it, expect } from 'vitest';
import { getLayoutedElements, NODE_WIDTH, NODE_HEIGHT, COMPACT_NODE_SIZE } from '../../src/ui/views/graph/layout';
import { Node, Edge } from '../../src/domain/models/types';

describe('Graph Layout (getLayoutedElements)', () => {
  const createTestNode = (id: string, position?: { x: number; y: number }): Node => ({
    id,
    projectId: 'test_proj',
    parentNodeId: null,
    text: `Task ${id}`,
    dueDate: '2026-09-30',
    status: 'planned',
    position,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  });

  it('preserves exact node positions without offsets when forceLayout is false', () => {
    const nodes: Node[] = [
      createTestNode('n1', { x: 10, y: 20 }),
      createTestNode('n2', { x: 300, y: 150 }),
      createTestNode('n3', { x: 600, y: 400 }),
    ];
    const edges: Edge[] = [];

    const { rfNodes } = getLayoutedElements(nodes, edges, 'LR', false);

    const rfN1 = rfNodes.find((n) => n.id === 'n1');
    const rfN2 = rfNodes.find((n) => n.id === 'n2');
    const rfN3 = rfNodes.find((n) => n.id === 'n3');

    expect(rfN1?.position).toEqual({ x: 10, y: 20 });
    expect(rfN2?.position).toEqual({ x: 300, y: 150 });
    expect(rfN3?.position).toEqual({ x: 600, y: 400 });
  });

  it('does NOT shift other nodes when one node is moved or placed at low/negative coordinates', () => {
    // Initial state: n1 at 200, n2 at 500
    const initialNodes: Node[] = [
      createTestNode('n1', { x: 200, y: 100 }),
      createTestNode('n2', { x: 500, y: 100 }),
    ];
    const initialResult = getLayoutedElements(initialNodes, [], 'LR', false);
    expect(initialResult.rfNodes.find((n) => n.id === 'n2')?.position.x).toBe(500);

    // User drags n1 to x: 15 (less than 50)
    const movedNodes: Node[] = [
      createTestNode('n1', { x: 15, y: 100 }),
      createTestNode('n2', { x: 500, y: 100 }),
    ];
    const movedResult = getLayoutedElements(movedNodes, [], 'LR', false);

    // n1 must stay at x: 15 (not shifted to 50)
    expect(movedResult.rfNodes.find((n) => n.id === 'n1')?.position).toEqual({ x: 15, y: 100 });
    // n2 must remain at x: 500 (not shifted by any bounding-box offset)
    expect(movedResult.rfNodes.find((n) => n.id === 'n2')?.position).toEqual({ x: 500, y: 100 });
  });

  it('preserves negative coordinates when user places a node in negative space', () => {
    const nodes: Node[] = [
      createTestNode('n1', { x: -80, y: -40 }),
      createTestNode('n2', { x: 250, y: 100 }),
    ];
    const { rfNodes } = getLayoutedElements(nodes, [], 'LR', false);

    expect(rfNodes.find((n) => n.id === 'n1')?.position).toEqual({ x: -80, y: -40 });
    expect(rfNodes.find((n) => n.id === 'n2')?.position).toEqual({ x: 250, y: 100 });
  });

  it('applies Dagre layout and normalizes coordinates with padding when forceLayout is true', () => {
    const nodes: Node[] = [
      createTestNode('n1'),
      createTestNode('n2'),
    ];
    const edges: Edge[] = [
      { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
    ];

    const { rfNodes } = getLayoutedElements(nodes, edges, 'LR', true);

    expect(rfNodes).toHaveLength(2);
    // All nodes in auto-layout should have positive coordinates >= 50 on X and >= 60 on Y
    for (const rfNode of rfNodes) {
      expect(rfNode.position.x).toBeGreaterThanOrEqual(50);
      expect(rfNode.position.y).toBeGreaterThanOrEqual(60);
    }
    // n1 should precede n2 in Left-to-Right layout
    const n1Pos = rfNodes.find((n) => n.id === 'n1')!.position;
    const n2Pos = rfNodes.find((n) => n.id === 'n2')!.position;
    expect(n2Pos.x).toBeGreaterThan(n1Pos.x);
  });

  it('adjusts node dimensions correctly based on compact mode and scale', () => {
    const nodes: Node[] = [createTestNode('n1', { x: 100, y: 100 })];

    // Standard mode (scale 1.0)
    const std = getLayoutedElements(nodes, [], 'LR', false, false, 1.0);
    expect(std.rfNodes[0].width).toBe(NODE_WIDTH);
    expect(std.rfNodes[0].height).toBe(NODE_HEIGHT);

    // Compact mode (scale 1.0)
    const compact = getLayoutedElements(nodes, [], 'LR', false, true, 1.0);
    expect(compact.rfNodes[0].width).toBe(COMPACT_NODE_SIZE);
    expect(compact.rfNodes[0].height).toBe(COMPACT_NODE_SIZE);

    // Scaled mode (scale 1.2)
    const scaled = getLayoutedElements(nodes, [], 'LR', false, false, 1.2);
    expect(scaled.rfNodes[0].width).toBe(Math.round(NODE_WIDTH * 1.2));
    expect(scaled.rfNodes[0].height).toBe(Math.round(NODE_HEIGHT * 1.2));
  });
});
