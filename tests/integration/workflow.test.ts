import { describe, it, expect } from 'vitest';
import {
  ProjectService,
  TemporalService,
  HistoryService,
  MigrationService,
  Node,
  Edge,
  ProjectDocument,
} from '../../src/domain';

describe('Graphdule Full Integration Workflow', () => {
  it('executes a complete end-to-end project lifecycle workflow', () => {
    // 1. Create project with EGN
    const { project, egnNode } = ProjectService.createProject(
      'Submit PhD Paper',
      'Submit Manuscript to Journal',
      '2026-10-30'
    );

    expect(project.id).toBeDefined();
    expect(egnNode.id).toBe(project.endGoalNodeId);

    // 2. Add nodes leading toward goal
    const prepPhantom = ProjectService.createNode(project.id, 'Prepare Phantom', '2026-09-05');
    const runExp = ProjectService.createNode(project.id, 'Run Experiment', '2026-09-15');
    const analyze = ProjectService.createNode(project.id, 'Analyze MRI', '2026-09-25');
    const writePaper = ProjectService.createNode(project.id, 'Write Manuscript', '2026-10-15');

    let nodes: Node[] = [egnNode, prepPhantom, runExp, analyze, writePaper];
    let edges: Edge[] = [];

    // 3. Connect nodes with DAG and chronological verification
    const e1 = ProjectService.createEdge(project.id, prepPhantom.id, runExp.id, nodes, edges);
    expect(e1.success).toBe(true);
    if (e1.success) edges.push(e1.edge);

    const e2 = ProjectService.createEdge(project.id, runExp.id, analyze.id, nodes, edges);
    expect(e2.success).toBe(true);
    if (e2.success) edges.push(e2.edge);

    const e3 = ProjectService.createEdge(project.id, analyze.id, writePaper.id, nodes, edges);
    expect(e3.success).toBe(true);
    if (e3.success) edges.push(e3.edge);

    const e4 = ProjectService.createEdge(project.id, writePaper.id, egnNode.id, nodes, edges);
    expect(e4.success).toBe(true);
    if (e4.success) edges.push(e4.edge);

    expect(edges).toHaveLength(4);

    // 4. Decompose "Write Manuscript" into subtasks
    const subtasks = ProjectService.decomposeNode(writePaper, [
      { text: 'Write Intro', dueDate: '2026-10-01' },
      { text: 'Write Methods', dueDate: '2026-10-05' },
      { text: 'Write Results', dueDate: '2026-10-10' },
    ]);
    nodes = [...nodes, ...subtasks];

    // Verify derived temporal start & duration on decomposed parent
    const derived = TemporalService.getDerivedTemporal(writePaper, nodes);
    expect(derived.isDerived).toBe(true);
    expect(derived.derivedStartDate).toBe('2026-10-01');
    expect(derived.explicitDueDate).toBe('2026-10-15');
    expect(derived.derivedDurationDays).toBe(14);

    // 5. Complete initial work
    nodes = nodes.map((n) =>
      n.id === prepPhantom.id ? ProjectService.updateNodeStatus(n, 'completed') : n
    );
    nodes = nodes.map((n) =>
      n.id === runExp.id ? ProjectService.updateNodeStatus(n, 'completed') : n
    );

    // 6. Add notes to completed task
    const notes = [
      {
        id: 'note_1',
        nodeId: runExp.id,
        text: 'Had to repeat acquisition because the first scan had corrupted gradients.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // 7. Abandon a subtask (Write Intro judged unnecessary)
    const introSubtask = subtasks[0];
    nodes = nodes.map((n) =>
      n.id === introSubtask.id ? ProjectService.updateNodeStatus(n, 'abandoned') : n
    );

    // Verify abandoned node is preserved in the graph
    const abandonedNode = nodes.find((n) => n.id === introSubtask.id);
    expect(abandonedNode?.status).toBe('abandoned');

    // 8. Trigger temporal conflict by moving Run Experiment past Analyze MRI
    const conflictImpact = TemporalService.calculateCascadeImpact(
      runExp.id,
      '2026-09-28',
      nodes,
      edges
    );
    expect(conflictImpact).not.toBeNull();
    expect(conflictImpact?.affectedSuccessors.some((a) => a.nodeId === analyze.id)).toBe(true);

    // Apply cascade shift
    nodes = TemporalService.applyCascadeShift(conflictImpact!, nodes);
    const shiftedAnalyze = nodes.find((n) => n.id === analyze.id);
    expect(shiftedAnalyze?.dueDate).toBe('2026-10-08');

    // 9. Snapshot state
    const docV1: ProjectDocument = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project,
      nodes,
      edges,
      notes,
      history: [],
    };

    const { snapshot } = HistoryService.createSnapshot(docV1, 'Milestone 1: Experiments done');
    expect(snapshot.id).toBeDefined();

    // 10. Canonical serialization & migration verification
    const serializedJson = JSON.stringify(docV1);
    const parsed = MigrationService.parseAndMigrate(JSON.parse(serializedJson));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.document.project.name).toBe('Submit PhD Paper');
      expect(parsed.document.nodes).toHaveLength(nodes.length);
      expect(parsed.document.edges).toHaveLength(edges.length);
    }
  });
});
