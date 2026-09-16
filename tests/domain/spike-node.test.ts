import { describe, it, expect } from 'vitest';
import { ProjectService } from '../../src/domain/services/project-service';
import { MyDayService } from '../../src/domain/services/my-day-service';
import { NodeSchema, StandaloneTaskSchema, ProjectDocumentSchema } from '../../src/domain/models/schema';

describe('Spike Nodes and Cognitive Demand Domain Tests', () => {
  it('creates standard nodes by default with optional cognitiveDemand', () => {
    const node = ProjectService.createNode(
      'proj_test',
      'Regular Task',
      '2026-10-15',
      null,
      { x: 100, y: 100 },
      1.5,
      'computer',
      'medium',
      'standard'
    );

    expect(node.nodeType).toBe('standard');
    expect(node.cognitiveDemand).toBe('medium');
    expect(node.estimatedAU).toBe(1.5);
    expect(node.text).toBe('Regular Task');

    const validated = NodeSchema.safeParse(node);
    expect(validated.success).toBe(true);
  });

  it('creates spike exploration nodes with nodeType spike', () => {
    const spikeNode = ProjectService.createNode(
      'proj_test',
      'Explore WebAssembly memory models',
      '2026-10-20',
      null,
      { x: 200, y: 150 },
      2.0,
      'computer',
      'high',
      'spike'
    );

    expect(spikeNode.nodeType).toBe('spike');
    expect(spikeNode.cognitiveDemand).toBe('high');
    expect(spikeNode.text).toBe('Explore WebAssembly memory models');

    const validated = NodeSchema.safeParse(spikeNode);
    expect(validated.success).toBe(true);
  });

  it('validates standalone tasks with cognitiveDemand and spike nodeType', () => {
    const task = MyDayService.createStandaloneTask(
      'Read whitepaper on distributed consensus',
      '2026-10-18',
      undefined,
      undefined,
      undefined,
      1.0,
      'computer',
      'high',
      'spike'
    );

    expect(task.nodeType).toBe('spike');
    expect(task.cognitiveDemand).toBe('high');

    const validated = StandaloneTaskSchema.safeParse(task);
    expect(validated.success).toBe(true);
  });

  it('validates project document containing a mix of standard and spike nodes', () => {
    const { project, egnNode } = ProjectService.createProject(
      'Compiler Prototype',
      'Release v0.1',
      '2026-12-01'
    );

    const spike = ProjectService.createNode(
      project.id,
      'Evaluate AST parser libraries',
      '2026-10-01',
      null,
      { x: 100, y: 100 },
      2,
      'computer',
      'high',
      'spike'
    );

    const impl = ProjectService.createNode(
      project.id,
      'Implement Lexer',
      '2026-10-15',
      null,
      { x: 300, y: 100 },
      3,
      'computer',
      'medium',
      'standard'
    );

    const doc = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project,
      nodes: [egnNode, spike, impl],
      edges: [
        { id: 'e1', projectId: project.id, fromNodeId: spike.id, toNodeId: impl.id, createdAt: new Date().toISOString() },
        { id: 'e2', projectId: project.id, fromNodeId: impl.id, toNodeId: egnNode.id, createdAt: new Date().toISOString() },
      ],
      notes: [],
      history: [],
    };

    const validated = ProjectDocumentSchema.safeParse(doc);
    expect(validated.success).toBe(true);
  });
});
