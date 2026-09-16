import { describe, it, expect } from 'vitest';
import { ProjectHealthService } from '../../src/domain/services/project-health-service';
import { Node, Edge, ActivityEvent } from '../../src/domain/models/types';

describe('ProjectHealthService', () => {
  const baseNode = (id: string, overrides: Partial<Node> = {}): Node => ({
    id,
    projectId: 'proj-1',
    text: `Task ${id}`,
    dueDate: '2026-09-20',
    status: 'planned',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });

  it('correctly identifies root nodes as frontier when no incoming edges exist', () => {
    const nodes: Node[] = [
      baseNode('root-1'),
      baseNode('root-2'),
      baseNode('child-1'),
    ];
    const edges: Edge[] = [
      { id: 'e1', projectId: 'proj-1', fromNodeId: 'root-1', toNodeId: 'child-1', createdAt: '2026-09-01T00:00:00.000Z' },
    ];

    const frontier = ProjectHealthService.getFrontierNodes(nodes, edges);
    const ids = frontier.map((n) => n.id);

    expect(ids).toContain('root-1');
    expect(ids).toContain('root-2');
    expect(ids).not.toContain('child-1'); // child-1 is blocked by uncompleted root-1
  });

  it('advances frontier to child once predecessor is completed', () => {
    const nodes: Node[] = [
      baseNode('root-1', { status: 'completed' }),
      baseNode('child-1', { status: 'planned' }),
    ];
    const edges: Edge[] = [
      { id: 'e1', projectId: 'proj-1', fromNodeId: 'root-1', toNodeId: 'child-1', createdAt: '2026-09-01T00:00:00.000Z' },
    ];

    const frontier = ProjectHealthService.getFrontierNodes(nodes, edges);
    expect(frontier.map((n) => n.id)).toEqual(['child-1']);
  });

  it('evaluates project as flowing when all tasks are complete', () => {
    const nodes: Node[] = [
      baseNode('n1', { status: 'completed' }),
      baseNode('n2', { status: 'completed' }),
    ];

    const summary = ProjectHealthService.evaluateProjectHealth(nodes, [], []);
    expect(summary.health).toBe('flowing');
    expect(summary.frontierCount).toBe(0);
  });

  it('evaluates project as flowing when frontier has recent activity', () => {
    const today = '2026-09-15';
    const nodes: Node[] = [baseNode('n1')];
    const activityLog: ActivityEvent[] = [
      {
        id: 'ev-1',
        type: 'task_completed',
        entityId: 'n0',
        projectId: 'proj-1',
        timestamp: '2026-09-14T10:00:00.000Z',
      },
    ];

    const summary = ProjectHealthService.evaluateProjectHealth(
      nodes,
      [],
      activityLog,
      today,
      'proj-1'
    );
    expect(summary.health).toBe('flowing');
    expect(summary.daysSinceLastActivity).toBe(1);
  });

  it('evaluates project as idle when inactive for 6 days', () => {
    const today = '2026-09-15';
    const nodes: Node[] = [baseNode('n1')];
    const activityLog: ActivityEvent[] = [
      {
        id: 'ev-1',
        type: 'task_completed',
        entityId: 'n0',
        projectId: 'proj-1',
        timestamp: '2026-09-09T10:00:00.000Z', // 6 days ago
      },
    ];

    const summary = ProjectHealthService.evaluateProjectHealth(
      nodes,
      [],
      activityLog,
      today,
      'proj-1'
    );
    expect(summary.health).toBe('idle');
    expect(summary.daysSinceLastActivity).toBe(6);
  });

  it('evaluates project as stalled when inactive for >10 days or overdue frontier', () => {
    const today = '2026-09-15';
    const nodes: Node[] = [
      baseNode('n1', { dueDate: '2026-09-05' }), // overdue
      baseNode('n2', { dueDate: '2026-09-07' }), // overdue
    ];
    const activityLog: ActivityEvent[] = [
      {
        id: 'ev-1',
        type: 'task_completed',
        entityId: 'n0',
        projectId: 'proj-1',
        timestamp: '2026-09-01T10:00:00.000Z', // 14 days ago
      },
    ];

    const summary = ProjectHealthService.evaluateProjectHealth(
      nodes,
      [],
      activityLog,
      today,
      'proj-1'
    );
    expect(summary.health).toBe('stalled');
    expect(summary.overdueFrontierCount).toBe(2);
    expect(summary.daysSinceLastActivity).toBe(14);
  });
});
