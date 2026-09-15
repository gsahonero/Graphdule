import { describe, it, expect } from 'vitest';
import { GraphService } from '../../src/domain/services/graph-service';
import { Node, Edge } from '../../src/domain/models/types';

describe('GraphService.calculateCriticalPath', () => {
  const createNode = (id: string, estimatedAU?: number): Node => ({
    id,
    projectId: 'proj-1',
    text: `Task ${id}`,
    status: 'planned',
    dueDate: '2026-09-20',
    estimatedAU,
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

  it('returns empty critical path when no nodes or target exists', () => {
    const res = GraphService.calculateCriticalPath([], []);
    expect(res.nodeIds).toEqual([]);
    expect(res.edgeIds).toEqual([]);
    expect(res.totalAU).toBe(0);
  });

  it('calculates linear critical path to End Goal Node', () => {
    // A (2 AU) -> B (3 AU) -> EGN (1 AU)
    const nodes = [
      createNode('A', 2),
      createNode('B', 3),
      createNode('EGN', 1),
    ];
    const edges = [
      createEdge('e1', 'A', 'B'),
      createEdge('e2', 'B', 'EGN'),
    ];

    const res = GraphService.calculateCriticalPath(nodes, edges, 'EGN');
    expect(res.nodeIds).toEqual(['A', 'B', 'EGN']);
    expect(res.edgeIds).toEqual(['e1', 'e2']);
    expect(res.totalAU).toBe(6); // 2 + 3 + 1
  });

  it('identifies the longest duration branch as the critical path', () => {
    // Branch 1: Start (1 AU) -> Short (1 AU) -> EGN (1 AU) [Total: 3 AU]
    // Branch 2: Start (1 AU) -> Long (5 AU)  -> EGN (1 AU) [Total: 7 AU]
    const nodes = [
      createNode('Start', 1),
      createNode('Short', 1),
      createNode('Long', 5),
      createNode('EGN', 1),
    ];
    const edges = [
      createEdge('e_start_short', 'Start', 'Short'),
      createEdge('e_short_egn', 'Short', 'EGN'),
      createEdge('e_start_long', 'Start', 'Long'),
      createEdge('e_long_egn', 'Long', 'EGN'),
    ];

    const res = GraphService.calculateCriticalPath(nodes, edges, 'EGN');
    expect(res.nodeIds).toEqual(['Start', 'Long', 'EGN']);
    expect(res.edgeIds).toEqual(['e_start_long', 'e_long_egn']);
    expect(res.totalAU).toBe(7);
  });

  it('falls back to hop count (1 AU per task) when estimatedAU is unspecified', () => {
    // Branch 1: N1 -> N2 -> EGN (3 hops)
    // Branch 2: N3 -> EGN (2 hops)
    const nodes = [
      createNode('N1'),
      createNode('N2'),
      createNode('N3'),
      createNode('EGN'),
    ];
    const edges = [
      createEdge('e1', 'N1', 'N2'),
      createEdge('e2', 'N2', 'EGN'),
      createEdge('e3', 'N3', 'EGN'),
    ];

    const res = GraphService.calculateCriticalPath(nodes, edges, 'EGN');
    expect(res.nodeIds).toEqual(['N1', 'N2', 'EGN']);
    expect(res.edgeIds).toEqual(['e1', 'e2']);
    expect(res.totalAU).toBe(3);
  });

  it('finds global terminal node when endGoalNodeId is not provided', () => {
    const nodes = [createNode('X', 2), createNode('Y', 4)];
    const edges = [createEdge('e_xy', 'X', 'Y')];

    const res = GraphService.calculateCriticalPath(nodes, edges);
    expect(res.nodeIds).toEqual(['X', 'Y']);
    expect(res.edgeIds).toEqual(['e_xy']);
    expect(res.totalAU).toBe(6);
  });
});
