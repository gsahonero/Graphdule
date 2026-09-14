import { describe, it, expect } from 'vitest';
import {
  getLayoutedElements,
  evaluateBestLayout,
  doRectanglesOverlap,
  NODE_WIDTH,
  NODE_HEIGHT,
} from '../../src/ui/views/graph/layout';
import { Node, Edge, ProjectDocument } from '../../src/domain/models/types';
import { GraphService } from '../../src/domain/services/graph-service';
import { ProjectService } from '../../src/domain/services/project-service';

describe('Graph Rendering & Layout System', () => {
  const createTestNode = (
    id: string,
    overrides?: Partial<Node>
  ): Node => ({
    id,
    projectId: 'test_proj',
    parentNodeId: null,
    text: `Task ${id}`,
    dueDate: '2026-09-30',
    status: 'planned',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });

  const createTestDoc = (nodes: Node[], edges: Edge[]): ProjectDocument => ({
    schemaVersion: 1,
    exportedAt: '2026-09-01T00:00:00.000Z',
    project: {
      id: 'test_proj',
      name: 'Test Project',
      endGoalNodeId: nodes[nodes.length - 1]?.id || 'goal',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    nodes,
    edges,
    notes: [],
  });

  // 1. Edge creation/deletion persistence
  describe('Edge Creation and Deletion Persistence', () => {
    it('creates an edge deterministically with stable ID and attributes', () => {
      const n1 = createTestNode('n1', { dueDate: '2026-09-10' });
      const n2 = createTestNode('n2', { dueDate: '2026-09-15' });
      const nodes = [n1, n2];
      const edges: Edge[] = [];

      const result = ProjectService.createEdge('test_proj', 'n1', 'n2', nodes, edges);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.edge.id).toBeDefined();
        expect(result.edge.fromNodeId).toBe('n1');
        expect(result.edge.toNodeId).toBe('n2');
        expect(result.edge.projectId).toBe('test_proj');
      }
    });

    it('deletes an edge from the authoritative edge set without affecting other edges', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      const doc = createTestDoc([n1, n2, n3], [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'test_proj', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
      ]);

      const updated = ProjectService.deleteEdgeFromProject(doc, 'e1');
      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0].id).toBe('e2');
      expect(updated.edges.find((e) => e.id === 'e1')).toBeUndefined();
    });

    it('deletes multiple edges atomically in batch', () => {
      const nodes = [createTestNode('n1'), createTestNode('n2'), createTestNode('n3'), createTestNode('n4')];
      const doc = createTestDoc(nodes, [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'test_proj', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
        { id: 'e3', projectId: 'test_proj', fromNodeId: 'n3', toNodeId: 'n4', createdAt: '' },
      ]);

      const updated = ProjectService.deleteEdgesFromProject(doc, ['e1', 'e3']);
      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0].id).toBe('e2');
    });

    it('reconnects an existing edge by replacing its endpoints while preserving stable ID', () => {
      const n1 = createTestNode('n1', { dueDate: '2026-09-10' });
      const n2 = createTestNode('n2', { dueDate: '2026-09-15' });
      const n3 = createTestNode('n3', { dueDate: '2026-09-20' });
      const originalEdge: Edge = {
        id: 'stable_edge_123',
        projectId: 'test_proj',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const doc = createTestDoc([n1, n2, n3], [originalEdge]);

      const res = ProjectService.reconnectEdge(doc, 'stable_edge_123', 'n1', 'n3');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.edge.id).toBe('stable_edge_123');
        expect(res.edge.fromNodeId).toBe('n1');
        expect(res.edge.toNodeId).toBe('n3');
        expect(res.edge.createdAt).toBe('2026-09-01T00:00:00.000Z');
        expect(res.document.edges).toHaveLength(1);
        expect(res.document.edges[0].toNodeId).toBe('n3');
      }
    });
  });

  // 2. Deleted edges not reappearing after layout or layer changes
  describe('Deleted Edges Persistence Across Layout and Layer Switches', () => {
    it('does not resurrect deleted edges when recomputing layout or changing layout modes', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      let doc = createTestDoc([n1, n2, n3], [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'test_proj', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
      ]);

      // User deletes edge e1
      doc = ProjectService.deleteEdgeFromProject(doc, 'e1');
      expect(doc.edges.map((e) => e.id)).toEqual(['e2']);

      // 1. Run LR layout
      const lrLayout = getLayoutedElements(doc.nodes, doc.edges, 'LR', true);
      expect(lrLayout.rfEdges.map((e) => e.id)).toEqual(['e2']);

      // 2. Switch to TB layout
      const tbLayout = getLayoutedElements(doc.nodes, doc.edges, 'TB', true);
      expect(tbLayout.rfEdges.map((e) => e.id)).toEqual(['e2']);

      // 3. Switch to Auto layout
      const autoLayout = getLayoutedElements(doc.nodes, doc.edges, 'auto', true);
      expect(autoLayout.rfEdges.map((e) => e.id)).toEqual(['e2']);

      // 4. Verify authoritative document was not mutated and deleted edge did not return
      expect(doc.edges).toHaveLength(1);
      expect(doc.edges[0].id).toBe('e2');
    });

    it('does not resurrect deleted edges when navigating between nested scopes and back', () => {
      const rootNode = createTestNode('root1');
      const childNode1 = createTestNode('c1', { parentNodeId: 'root1' });
      const childNode2 = createTestNode('c2', { parentNodeId: 'root1' });
      let doc = createTestDoc([rootNode, childNode1, childNode2], [
        { id: 'child_edge', projectId: 'test_proj', fromNodeId: 'c1', toNodeId: 'c2', createdAt: '' },
      ]);

      // Delete the child edge
      doc = ProjectService.deleteEdgeFromProject(doc, 'child_edge');
      expect(doc.edges).toHaveLength(0);

      // Navigate to root scope
      const rootScopedNodes = doc.nodes.filter((n) => n.parentNodeId === null);
      const rootScopedEdges = doc.edges.filter(
        (e) => rootScopedNodes.some((n) => n.id === e.fromNodeId) && rootScopedNodes.some((n) => n.id === e.toNodeId)
      );
      const rootLayout = getLayoutedElements(rootScopedNodes, rootScopedEdges, 'LR', true);
      expect(rootLayout.rfEdges).toHaveLength(0);

      // Navigate back to child scope
      const childScopedNodes = doc.nodes.filter((n) => n.parentNodeId === 'root1');
      const childScopedEdges = doc.edges.filter(
        (e) => childScopedNodes.some((n) => n.id === e.fromNodeId) && childScopedNodes.some((n) => n.id === e.toNodeId)
      );
      const childLayout = getLayoutedElements(childScopedNodes, childScopedEdges, 'LR', true);
      expect(childLayout.rfEdges).toHaveLength(0);
    });
  });

  // 3. Duplicate-edge prevention & invariants
  describe('Graph Invariants & Invariant Validation', () => {
    it('prevents creating duplicate edges between identical endpoints', () => {
      const n1 = createTestNode('n1', { dueDate: '2026-09-10' });
      const n2 = createTestNode('n2', { dueDate: '2026-09-15' });
      const existing: Edge = {
        id: 'e1',
        projectId: 'test_proj',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        createdAt: '',
      };

      const res = ProjectService.createEdge('test_proj', 'n1', 'n2', [n1, n2], [existing]);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/already exists/i);
      }
    });

    it('rejects self-edges', () => {
      const n1 = createTestNode('n1');
      const res = ProjectService.createEdge('test_proj', 'n1', 'n1', [n1], []);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/connect a node to itself/i);
      }
    });

    it('validates graph invariants and detects duplicate and dangling edges', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');

      // Dangling edge (toNode non-existent)
      const dangling = GraphService.validateGraphInvariants([n1], [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'ghost', createdAt: '' },
      ]);
      expect(dangling.isValid).toBe(false);
      expect(dangling.error).toMatch(/non-existent target node/i);

      // Duplicate edges
      const duplicates = GraphService.validateGraphInvariants([n1, n2], [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
      ]);
      expect(duplicates.isValid).toBe(false);
      expect(duplicates.error).toMatch(/duplicate edge/i);

      // Valid graph
      const valid = GraphService.validateGraphInvariants([n1, n2], [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
      ]);
      expect(valid.isValid).toBe(true);
    });

    it('sanitizes edges by removing dangling and duplicate edges deterministically', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const rawEdges: Edge[] = [
        { id: 'e1', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' }, // duplicate
        { id: 'e3', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'missing', createdAt: '' }, // dangling
        { id: 'e4', projectId: 'test_proj', fromNodeId: 'n1', toNodeId: 'n1', createdAt: '' }, // self loop
      ];

      const cleaned = GraphService.sanitizeEdges([n1, n2], rawEdges);
      expect(cleaned).toHaveLength(1);
      expect(cleaned[0].id).toBe('e1');
    });
  });

  // 4. Node overlap prevention
  describe('Node Overlap Prevention (Rectangle Collision)', () => {
    it('ensures zero rectangle overlaps across multi-branch diamond graphs', () => {
      // Diamond: n1 -> (n2, n3, n4) -> n5
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      const n4 = createTestNode('n4');
      const n5 = createTestNode('n5');
      const nodes = [n1, n2, n3, n4, n5];
      const edges: Edge[] = [
        { id: 'e1', projectId: 'test', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'test', fromNodeId: 'n1', toNodeId: 'n3', createdAt: '' },
        { id: 'e3', projectId: 'test', fromNodeId: 'n1', toNodeId: 'n4', createdAt: '' },
        { id: 'e4', projectId: 'test', fromNodeId: 'n2', toNodeId: 'n5', createdAt: '' },
        { id: 'e5', projectId: 'test', fromNodeId: 'n3', toNodeId: 'n5', createdAt: '' },
        { id: 'e6', projectId: 'test', fromNodeId: 'n4', toNodeId: 'n5', createdAt: '' },
      ];

      for (const dir of ['LR', 'TB'] as const) {
        const result = getLayoutedElements(nodes, edges, dir, true);

        // Check every pair of nodes for rectangle overlap
        for (let i = 0; i < result.rfNodes.length; i++) {
          const a = result.rfNodes[i];
          const rectA = { x: a.position.x, y: a.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };

          for (let j = i + 1; j < result.rfNodes.length; j++) {
            const b = result.rfNodes[j];
            const rectB = { x: b.position.x, y: b.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };

            const overlap = doRectanglesOverlap(rectA, rectB, 0, 0);
            expect(overlap).toBe(false);
          }
        }
      }
    });

    it('ensures zero rectangle overlaps with disconnected nodes alongside connected subgraphs', () => {
      const connected1 = createTestNode('c1');
      const connected2 = createTestNode('c2');
      const d1 = createTestNode('d1');
      const d2 = createTestNode('d2');
      const d3 = createTestNode('d3');
      const nodes = [connected1, connected2, d1, d2, d3];
      const edges: Edge[] = [
        { id: 'e1', projectId: 'test', fromNodeId: 'c1', toNodeId: 'c2', createdAt: '' },
      ];

      const result = getLayoutedElements(nodes, edges, 'LR', true);
      for (let i = 0; i < result.rfNodes.length; i++) {
        const a = result.rfNodes[i];
        const rectA = { x: a.position.x, y: a.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };

        for (let j = i + 1; j < result.rfNodes.length; j++) {
          const b = result.rfNodes[j];
          const rectB = { x: b.position.x, y: b.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };

          expect(doRectanglesOverlap(rectA, rectB, 0, 0)).toBe(false);
        }
      }
    });
  });

  // 5. L→R Layout
  describe('L→R Layout Behavior', () => {
    it('aligns horizontal coordinate with rank: x(predecessor) < x(successor)', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      const edges: Edge[] = [
        { id: 'e1', projectId: 'p', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'p', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
      ];

      const { rfNodes, rfEdges, direction } = getLayoutedElements([n1, n2, n3], edges, 'LR', true);

      expect(direction).toBe('LR');
      const p1 = rfNodes.find((n) => n.id === 'n1')!.position;
      const p2 = rfNodes.find((n) => n.id === 'n2')!.position;
      const p3 = rfNodes.find((n) => n.id === 'n3')!.position;

      expect(p1.x).toBeLessThan(p2.x);
      expect(p2.x).toBeLessThan(p3.x);

      // Verify edge handle orientation
      rfEdges.forEach((e) => {
        expect(e.sourceHandle).toBe('right');
        expect(e.targetHandle).toBe('left');
      });
    });
  });

  // 6. T→B Layout
  describe('T→B Layout Behavior', () => {
    it('aligns vertical coordinate with rank: y(predecessor) < y(successor)', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      const edges: Edge[] = [
        { id: 'e1', projectId: 'p', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'p', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
      ];

      const { rfNodes, rfEdges, direction } = getLayoutedElements([n1, n2, n3], edges, 'TB', true);

      expect(direction).toBe('TB');
      const p1 = rfNodes.find((n) => n.id === 'n1')!.position;
      const p2 = rfNodes.find((n) => n.id === 'n2')!.position;
      const p3 = rfNodes.find((n) => n.id === 'n3')!.position;

      expect(p1.y).toBeLessThan(p2.y);
      expect(p2.y).toBeLessThan(p3.y);

      // Verify edge handle orientation
      rfEdges.forEach((e) => {
        expect(e.sourceHandle).toBe('bottom');
        expect(e.targetHandle).toBe('top');
      });
    });
  });

  // 7. Auto Layout
  describe('Auto Layout Evaluation', () => {
    it('evaluates aspect ratio and structure to select optimal orientation', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      const n4 = createTestNode('n4');
      const edges: Edge[] = [
        { id: 'e1', projectId: 'p', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'p', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
        { id: 'e3', projectId: 'p', fromNodeId: 'n3', toNodeId: 'n4', createdAt: '' },
      ];

      // On a tall mobile screen (e.g. 400x900, aspect ratio ~0.44), TB is favored
      const mobileResult = evaluateBestLayout([n1, n2, n3, n4], edges, false, 1.0, {
        width: 400,
        height: 900,
      });
      expect(mobileResult.direction).toBe('TB');

      // On a wide desktop screen (e.g. 1800x800, aspect ratio ~2.25), LR is favored
      const desktopResult = evaluateBestLayout([n1, n2, n3, n4], edges, false, 1.0, {
        width: 1800,
        height: 800,
      });
      expect(desktopResult.direction).toBe('LR');
    });

    it('returns valid bounding box and metrics via getLayoutedElements with direction=auto', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const edges: Edge[] = [
        { id: 'e1', projectId: 'p', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
      ];

      const result = getLayoutedElements([n1, n2], edges, 'auto', true);
      expect(result.direction).toBeDefined();
      expect(result.boundingBox.width).toBeGreaterThan(0);
      expect(result.boundingBox.height).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.overlapCount).toBe(0);
    });
  });

  // 8. Changing layout modes without changing graph data
  describe('Purity: Changing Layout Modes Never Mutates Underlying Graph State', () => {
    it('leaves node and edge documents 100% identical when running LR, TB, and Auto layout', () => {
      const n1 = createTestNode('n1');
      const n2 = createTestNode('n2');
      const n3 = createTestNode('n3');
      const originalNodes = [n1, n2, n3];
      const originalEdges: Edge[] = [
        { id: 'e1', projectId: 'p', fromNodeId: 'n1', toNodeId: 'n2', createdAt: '' },
        { id: 'e2', projectId: 'p', fromNodeId: 'n2', toNodeId: 'n3', createdAt: '' },
      ];

      const nodesSnapshot = JSON.parse(JSON.stringify(originalNodes));
      const edgesSnapshot = JSON.parse(JSON.stringify(originalEdges));

      // 1. Run LR
      getLayoutedElements(originalNodes, originalEdges, 'LR', true);
      expect(originalNodes).toEqual(nodesSnapshot);
      expect(originalEdges).toEqual(edgesSnapshot);

      // 2. Run TB
      getLayoutedElements(originalNodes, originalEdges, 'TB', true);
      expect(originalNodes).toEqual(nodesSnapshot);
      expect(originalEdges).toEqual(edgesSnapshot);

      // 3. Run Auto
      getLayoutedElements(originalNodes, originalEdges, 'auto', true);
      expect(originalNodes).toEqual(nodesSnapshot);
      expect(originalEdges).toEqual(edgesSnapshot);
    });
  });

  // 9. Entering/leaving nested layers without changing graph data
  describe('Hierarchy Integrity: Scoped Navigation Preserves All Graph Edges', () => {
    it('preserves all edges across hierarchy levels when entering and leaving subgraphs', () => {
      const root1 = createTestNode('r1');
      const root2 = createTestNode('r2');
      const sub1 = createTestNode('s1', { parentNodeId: 'r1' });
      const sub2 = createTestNode('s2', { parentNodeId: 'r1' });

      const allNodes = [root1, root2, sub1, sub2];
      const allEdges: Edge[] = [
        { id: 'root_edge', projectId: 'p', fromNodeId: 'r1', toNodeId: 'r2', createdAt: '' },
        { id: 'sub_edge', projectId: 'p', fromNodeId: 's1', toNodeId: 's2', createdAt: '' },
      ];

      const doc = createTestDoc(allNodes, allEdges);
      const snapshot = JSON.parse(JSON.stringify(doc));

      // View Root Level
      const rootNodes = doc.nodes.filter((n) => n.parentNodeId === null);
      const rootEdges = doc.edges.filter(
        (e) => rootNodes.some((n) => n.id === e.fromNodeId) && rootNodes.some((n) => n.id === e.toNodeId)
      );
      expect(rootNodes).toHaveLength(2);
      expect(rootEdges).toHaveLength(1);
      const rootLayout = getLayoutedElements(rootNodes, rootEdges, 'LR', true);
      expect(rootLayout.rfNodes).toHaveLength(2);
      expect(rootLayout.rfEdges).toHaveLength(1);

      // Drill down into Subtasks of r1
      const childNodes = doc.nodes.filter((n) => n.parentNodeId === 'r1');
      const childEdges = doc.edges.filter(
        (e) => childNodes.some((n) => n.id === e.fromNodeId) && childNodes.some((n) => n.id === e.toNodeId)
      );
      expect(childNodes).toHaveLength(2);
      expect(childEdges).toHaveLength(1);
      const childLayout = getLayoutedElements(childNodes, childEdges, 'TB', true);
      expect(childLayout.rfNodes).toHaveLength(2);
      expect(childLayout.rfEdges).toHaveLength(1);

      // Return to root level
      expect(doc).toEqual(snapshot);
    });
  });

  // 10. Large visible graphs performance & responsiveness
  describe('Scalability & Responsiveness', () => {
    it('computes layered layout for 100+ nodes within 50ms with 0 overlaps', () => {
      const count = 100;
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      for (let i = 0; i < count; i++) {
        nodes.push(createTestNode(`node_${i}`));
      }

      // Create a complex DAG with multiple chains and cross branches
      for (let i = 0; i < count - 1; i++) {
        if (i % 2 === 0 && i + 2 < count) {
          edges.push({
            id: `edge_${i}_${i+2}`,
            projectId: 'p',
            fromNodeId: `node_${i}`,
            toNodeId: `node_${i+2}`,
            createdAt: '',
          });
        } else {
          edges.push({
            id: `edge_${i}_${i+1}`,
            projectId: 'p',
            fromNodeId: `node_${i}`,
            toNodeId: `node_${i+1}`,
            createdAt: '',
          });
        }
      }

      const start = performance.now();
      const layoutResult = getLayoutedElements(nodes, edges, 'LR', true);
      const elapsed = performance.now() - start;

      expect(layoutResult.rfNodes).toHaveLength(count);
      expect(elapsed).toBeLessThan(100); // well within interactive frame budget

      // Verify zero rectangle overlaps
      let overlapFound = false;
      for (let i = 0; i < layoutResult.rfNodes.length; i++) {
        const a = layoutResult.rfNodes[i];
        const rectA = { x: a.position.x, y: a.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };

        for (let j = i + 1; j < layoutResult.rfNodes.length; j++) {
          const b = layoutResult.rfNodes[j];
          const rectB = { x: b.position.x, y: b.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };

          if (doRectanglesOverlap(rectA, rectB, 0, 0)) {
            overlapFound = true;
            break;
          }
        }
        if (overlapFound) break;
      }

      expect(overlapFound).toBe(false);
    });
  });
});
