import { describe, it, expect } from 'vitest';
import { getCompoundLayoutedElements } from '../../src/ui/views/graph/layout';
import { Node, Edge } from '../../src/domain/models/types';

describe('Compound Layout Engine (Whole Project View - Direction A)', () => {
  const createNode = (id: string, parentNodeId?: string | null, text?: string, estimatedAU?: number): Node => ({
    id,
    projectId: 'proj-1',
    parentNodeId: parentNodeId || null,
    text: text || `Task ${id}`,
    status: 'planned',
    dueDate: '2026-09-30',
    estimatedAU: estimatedAU ?? 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  });

  const createEdge = (id: string, from: string, to: string): Edge => ({
    id,
    projectId: 'proj-1',
    fromNodeId: from,
    toNodeId: to,
    createdAt: '2026-09-01T00:00:00.000Z',
  });

  it('falls back to clean flat layout when no hierarchy exists in project', () => {
    const nodes: Node[] = [
      createNode('n1'),
      createNode('n2'),
      createNode('n3'),
    ];
    const edges: Edge[] = [
      createEdge('e1', 'n1', 'n2'),
      createEdge('e2', 'n2', 'n3'),
    ];

    const res = getCompoundLayoutedElements(nodes, edges, { direction: 'LR' });
    expect(res.rfNodes.length).toBe(3);
    expect(res.rfNodes.every((n) => n.type === 'graphNode')).toBe(true);
    expect(res.rfNodes.every((n) => !n.parentId)).toBe(true);
    expect(res.rfEdges.length).toBe(2);
  });

  it('correctly creates compound group container for decomposed parent and relative child nodes', () => {
    // Parent: p1 (root level)
    // Children of p1: c1, c2, c3
    // Root task: r1 (connects to p1)
    const p1 = createNode('p1', null, 'Parent Decomposed Task', 3);
    const c1 = createNode('c1', 'p1', 'Subtask 1', 1);
    const c2 = createNode('c2', 'p1', 'Subtask 2', 1);
    const c3 = createNode('c3', 'p1', 'Subtask 3', 1);
    const r1 = createNode('r1', null, 'Initial Requirement', 1);

    const nodes: Node[] = [r1, p1, c1, c2, c3];
    const edges: Edge[] = [
      createEdge('e-r1-p1', 'r1', 'p1'),
      createEdge('e-c1-c2', 'c1', 'c2'),
      createEdge('e-c2-c3', 'c2', 'c3'),
    ];

    const res = getCompoundLayoutedElements(nodes, edges, { direction: 'LR' });

    // Verify parent is a groupNode
    const p1Node = res.rfNodes.find((n) => n.id === 'p1');
    expect(p1Node).toBeDefined();
    expect(p1Node?.type).toBe('groupNode');
    expect(p1Node?.width).toBeGreaterThanOrEqual(340);
    expect(p1Node?.height).toBeGreaterThanOrEqual(180);

    // Verify parent node appears BEFORE child nodes in rfNodes array (React Flow requirement)
    const p1Index = res.rfNodes.findIndex((n) => n.id === 'p1');
    const c1Index = res.rfNodes.findIndex((n) => n.id === 'c1');
    const c2Index = res.rfNodes.findIndex((n) => n.id === 'c2');
    const c3Index = res.rfNodes.findIndex((n) => n.id === 'c3');
    expect(p1Index).toBeLessThan(c1Index);
    expect(p1Index).toBeLessThan(c2Index);
    expect(p1Index).toBeLessThan(c3Index);

    // Verify children have parentId and extent set
    const c1Node = res.rfNodes.find((n) => n.id === 'c1')!;
    const c2Node = res.rfNodes.find((n) => n.id === 'c2')!;
    const c3Node = res.rfNodes.find((n) => n.id === 'c3')!;

    expect(c1Node.parentId).toBe('p1');
    expect(c1Node.extent).toBe('parent');
    expect(c2Node.parentId).toBe('p1');
    expect(c3Node.parentId).toBe('p1');

    // Verify child relative coordinates are within parent container bounds
    const containerW = p1Node!.width!;
    const containerH = p1Node!.height!;

    [c1Node, c2Node, c3Node].forEach((child) => {
      expect(child.position.x).toBeGreaterThanOrEqual(0);
      expect(child.position.y).toBeGreaterThanOrEqual(0);
      expect(child.position.x).toBeLessThan(containerW);
      expect(child.position.y).toBeLessThan(containerH);
    });

    // Verify groupNode metadata
    expect(p1Node?.data?.childCount).toBe(3);
    expect(p1Node?.data?.totalAU).toBe(3);

    // Verify root node r1 is a normal graphNode without parentId
    const r1Node = res.rfNodes.find((n) => n.id === 'r1');
    expect(r1Node).toBeDefined();
    expect(r1Node?.type).toBe('graphNode');
    expect(r1Node?.parentId).toBeUndefined();
  });

  it('correctly maps external edges to parent compound container in meta DAG layout', () => {
    // r1 -> subtask c1 (cross-boundary edge)
    // subtask c2 -> r2 (cross-boundary exit edge)
    const p1 = createNode('p1', null, 'Component X');
    const c1 = createNode('c1', 'p1', 'Subtask Alpha');
    const c2 = createNode('c2', 'p1', 'Subtask Beta');
    const r1 = createNode('r1', null, 'Setup Step');
    const r2 = createNode('r2', null, 'Ship Step');

    const nodes: Node[] = [r1, p1, c1, c2, r2];
    const edges: Edge[] = [
      createEdge('e1', 'r1', 'c1'), // into subtask
      createEdge('e2', 'c1', 'c2'), // internal
      createEdge('e3', 'c2', 'r2'), // out of subtask
    ];

    const res = getCompoundLayoutedElements(nodes, edges, { direction: 'LR' });

    // In LR layout, r1 (rank 0) should be positioned to the left of p1, and p1 to the left of r2
    const r1Pos = res.rfNodes.find((n) => n.id === 'r1')!.position;
    const p1Pos = res.rfNodes.find((n) => n.id === 'p1')!.position;
    const r2Pos = res.rfNodes.find((n) => n.id === 'r2')!.position;

    expect(r1Pos.x).toBeLessThan(p1Pos.x);
    expect(p1Pos.x).toBeLessThan(r2Pos.x);

    // Verify all original edges are preserved in rfEdges
    expect(res.rfEdges.length).toBe(3);
    expect(res.rfEdges.some((e) => e.source === 'r1' && e.target === 'c1')).toBe(true);
    expect(res.rfEdges.some((e) => e.source === 'c1' && e.target === 'c2')).toBe(true);
    expect(res.rfEdges.some((e) => e.source === 'c2' && e.target === 'r2')).toBe(true);
  });
});
