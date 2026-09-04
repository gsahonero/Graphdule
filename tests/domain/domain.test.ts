import { describe, it, expect } from 'vitest';
import {
  ProjectService,
  GraphService,
  TemporalService,
  MyDayService,
  RecurrenceService,
  HistoryService,
  MigrationService,
  formatDisplayDate,
  Node,
  Edge,
  ProjectDocument,
  RecurrenceRule,
} from '../../src/domain';

describe('Graphdule Domain Invariants and Services', () => {
  describe('Project and EGN Invariants', () => {
    it('enforces that every project is created with exactly one End Goal Node (EGN)', () => {
      const { project, egnNode } = ProjectService.createProject(
        'Submit PhD Paper',
        'Submit PhD Paper Manuscript',
        '2026-10-30'
      );

      expect(project.id).toBeDefined();
      expect(egnNode.id).toBe(project.endGoalNodeId);
      expect(egnNode.text).toBe('Submit PhD Paper Manuscript');
      expect(egnNode.dueDate).toBe('2026-10-30');
      expect(egnNode.parentNodeId).toBeNull();
      expect(egnNode.status).toBe('planned');
    });

    it('supports optional, normalized tags when creating and summarizing projects', () => {
      const { project, egnNode } = ProjectService.createProject(
        'Research Grant',
        'Submit Grant Proposal',
        '2026-11-15',
        ['  Research  ', 'Finance', 'Research', '  ', 'Grant']
      );

      expect(project.tags).toEqual(['Research', 'Finance', 'Grant']);

      const summary = ProjectService.getProjectSummary(project, [egnNode]);
      expect(summary.tags).toEqual(['Research', 'Finance', 'Grant']);

      const updated = ProjectService.updateProjectTags(project, ['Urgent', 'Finance']);
      expect(updated.tags).toEqual(['Urgent', 'Finance']);
    });

    it('supports custom project styles (colors, icons, emojis) and persists them in summaries', () => {
      const { project, egnNode } = ProjectService.createProject(
        'Product Launch',
        'Launch V1 App',
        '2026-12-01',
        ['Launch'],
        { color: 'rose', icon: 'rocket' }
      );

      expect(project.style).toEqual({ color: 'rose', icon: 'rocket' });

      // Summary includes style
      const summary = ProjectService.getProjectSummary(project, [egnNode]);
      expect(summary.style).toEqual({ color: 'rose', icon: 'rocket' });

      // Update style with custom emoji
      const restyled = ProjectService.updateProjectStyle(project, { color: 'cyan', icon: 'sparkles', emoji: '🚀' });
      expect(restyled.style).toEqual({ color: 'cyan', icon: 'sparkles', emoji: '🚀' });

      const updatedSummary = ProjectService.getProjectSummary(restyled, [egnNode]);
      expect(updatedSummary.style).toEqual({ color: 'cyan', icon: 'sparkles', emoji: '🚀' });
    });

    it('erases connected edges first when a node is deleted and preserves DAG validity', () => {
      const { project, egnNode } = ProjectService.createProject('Pipeline', 'Goal', '2026-12-31');
      const nodeA = ProjectService.createNode(project.id, 'Task A', '2026-10-01');
      const nodeB = ProjectService.createNode(project.id, 'Task B', '2026-11-01');
      const nodeC = ProjectService.createNode(project.id, 'Task C', '2026-11-15');

      const allNodes = [egnNode, nodeA, nodeB, nodeC];
      const edgeAB = ProjectService.createEdge(project.id, nodeA.id, nodeB.id, allNodes, []);
      expect(edgeAB.success).toBe(true);
      if (!edgeAB.success) return;

      const edgeBC = ProjectService.createEdge(project.id, nodeB.id, nodeC.id, allNodes, [edgeAB.edge]);
      expect(edgeBC.success).toBe(true);
      if (!edgeBC.success) return;

      const edgeCEGN = ProjectService.createEdge(project.id, nodeC.id, egnNode.id, allNodes, [edgeAB.edge, edgeBC.edge]);
      expect(edgeCEGN.success).toBe(true);
      if (!edgeCEGN.success) return;

      const doc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        project,
        nodes: allNodes,
        edges: [edgeAB.edge, edgeBC.edge, edgeCEGN.edge],
        notes: [],
        history: [],
      };

      // Delete intermediate node B (connected to A via incoming edge and C via outgoing edge)
      const res = ProjectService.deleteNodeFromProject(doc, nodeB.id);
      expect(res.success).toBe(true);
      if (!res.success) return;

      // Ensure node B is removed
      expect(res.document.nodes.find((n) => n.id === nodeB.id)).toBeUndefined();
      // Ensure edges connecting to node B (AB and BC) are erased first
      expect(res.document.edges.find((e) => e.fromNodeId === nodeB.id || e.toNodeId === nodeB.id)).toBeUndefined();
      // Ensure unaffected edge (C -> EGN) remains intact
      expect(res.document.edges.find((e) => e.id === edgeCEGN.edge.id)).toBeDefined();

      // Ensure remaining DAG is valid
      const dagValidation = GraphService.validateDAG(res.document.nodes, res.document.edges);
      expect(dagValidation.isValid).toBe(true);

      // Verify cannot delete EGN
      const egnDeleteRes = ProjectService.deleteNodeFromProject(doc, egnNode.id);
      expect(egnDeleteRes.success).toBe(false);
    });

    it('summarizes project progress accurately from leaf nodes', () => {
      const { project, egnNode } = ProjectService.createProject('Test Project', 'Goal', '2026-12-31');
      const nodeA = ProjectService.createNode(project.id, 'Task A', '2026-10-01');
      const nodeB = ProjectService.createNode(project.id, 'Task B', '2026-11-01');

      let nodes: Node[] = [egnNode, nodeA, nodeB];
      expect(ProjectService.calculateProgress(nodes)).toBe(0);

      // Complete Task A
      nodes = nodes.map((n) => (n.id === nodeA.id ? ProjectService.updateNodeStatus(n, 'completed') : n));
      // 1 completed out of 3 total leaves = 33%
      expect(ProjectService.calculateProgress(nodes)).toBe(33);

      // Abandon Task B (abandoned leaves are excluded from denominator)
      nodes = nodes.map((n) => (n.id === nodeB.id ? ProjectService.updateNodeStatus(n, 'abandoned') : n));
      // 1 completed out of 2 active leaves (Task A + Goal) = 50%
      expect(ProjectService.calculateProgress(nodes)).toBe(50);
    });

    it('avoids double-counting decomposed parents in progress calculation', () => {
      const { project, egnNode } = ProjectService.createProject('Project', 'Goal', '2026-12-31');
      const parentTask = ProjectService.createNode(project.id, 'Write Paper', '2026-11-15');
      const subtasks = ProjectService.decomposeNode(parentTask, [
        { text: 'Intro', dueDate: '2026-11-01' },
        { text: 'Methods', dueDate: '2026-11-05' },
      ]);

      let allNodes: Node[] = [egnNode, parentTask, ...subtasks];
      // Leaves are: egnNode, subtask 0, subtask 1 (parentTask is a parent, so ignored in leaf count)
      expect(ProjectService.calculateProgress(allNodes)).toBe(0);

      // Complete both subtasks
      allNodes = allNodes.map((n) =>
        subtasks.some((s) => s.id === n.id) ? ProjectService.updateNodeStatus(n, 'completed') : n
      );
      // 2 completed leaves out of 3 active leaves (2 subtasks + EGN) = 67%
      expect(ProjectService.calculateProgress(allNodes)).toBe(67);
    });

    it('handles project archiving, unarchiving, and automatic status deduction in summaries', () => {
      const { project, egnNode } = ProjectService.createProject('Archive Candidate', 'Terminal Objective', '2026-12-31');
      expect(project.status).toBe('active');
      expect(project.archivedAt).toBeUndefined();

      // Active project summary
      const activeSummary = ProjectService.getProjectSummary(project, [egnNode]);
      expect(activeSummary.isArchived).toBe(false);
      expect(activeSummary.status).toBe('active');

      // 1. Explicitly archive project
      const manuallyArchived = ProjectService.archiveProject(project, 'archived');
      expect(manuallyArchived.status).toBe('archived');
      expect(manuallyArchived.archivedAt).toBeDefined();

      const manualSummary = ProjectService.getProjectSummary(manuallyArchived, [egnNode]);
      expect(manualSummary.isArchived).toBe(true);
      expect(manualSummary.status).toBe('archived');

      // 2. Unarchive project
      const restored = ProjectService.unarchiveProject(manuallyArchived);
      expect(restored.status).toBe('active');
      expect(restored.archivedAt).toBeUndefined();

      const restoredSummary = ProjectService.getProjectSummary(restored, [egnNode]);
      expect(restoredSummary.isArchived).toBe(false);
      expect(restoredSummary.status).toBe('active');

      // 3. Completed project deduction (EGN completed)
      const completedEgn = ProjectService.updateNodeStatus(egnNode, 'completed');
      const completedSummary = ProjectService.getProjectSummary(restored, [completedEgn]);
      expect(completedSummary.isArchived).toBe(true);
      expect(completedSummary.status).toBe('completed');

      // 4. Abandoned project deduction (EGN abandoned)
      const abandonedEgn = ProjectService.updateNodeStatus(egnNode, 'abandoned');
      const abandonedSummary = ProjectService.getProjectSummary(restored, [abandonedEgn]);
      expect(abandonedSummary.isArchived).toBe(true);
      expect(abandonedSummary.status).toBe('abandoned');
    });
  });

  describe('DAG Cycle Detection and Graph Semantics', () => {
    it('prevents self-loops', () => {
      const { project, egnNode } = ProjectService.createProject('Test', 'Goal', '2026-10-30');
      const result = ProjectService.createEdge(project.id, egnNode.id, egnNode.id, [egnNode], []);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Cannot connect a node to itself');
      }
    });

    it('prevents direct 2-node cycles (A -> B, B -> A)', () => {
      const { project, egnNode } = ProjectService.createProject('Test', 'Goal', '2026-10-30');
      const nodeA = ProjectService.createNode(project.id, 'Node A', '2026-09-01');
      const nodes = [nodeA, egnNode];

      const edgeAtoEgn: Edge = {
        id: 'e1',
        projectId: project.id,
        fromNodeId: nodeA.id,
        toNodeId: egnNode.id,
        createdAt: new Date().toISOString(),
      };

      expect(GraphService.wouldCreateCycle(egnNode.id, nodeA.id, [edgeAtoEgn])).toBe(true);

      const result = ProjectService.createEdge(project.id, egnNode.id, nodeA.id, nodes, [edgeAtoEgn]);
      expect(result.success).toBe(false);
    });

    it('prevents multi-node circular cycles (A -> B -> C -> A)', () => {
      const { project } = ProjectService.createProject('Test', 'Goal', '2026-10-30');
      const nodeA = ProjectService.createNode(project.id, 'A', '2026-09-01');
      const nodeB = ProjectService.createNode(project.id, 'B', '2026-09-10');
      const nodeC = ProjectService.createNode(project.id, 'C', '2026-09-20');
      const nodes = [nodeA, nodeB, nodeC];

      const edges: Edge[] = [
        { id: 'e1', projectId: project.id, fromNodeId: nodeA.id, toNodeId: nodeB.id, createdAt: '' },
        { id: 'e2', projectId: project.id, fromNodeId: nodeB.id, toNodeId: nodeC.id, createdAt: '' },
      ];

      expect(GraphService.wouldCreateCycle(nodeC.id, nodeA.id, edges)).toBe(true);
      const result = ProjectService.createEdge(project.id, nodeC.id, nodeA.id, nodes, edges);
      expect(result.success).toBe(false);
    });

    it('topologically sorts DAG nodes in execution order', () => {
      const { project } = ProjectService.createProject('Test', 'Goal', '2026-10-30');
      const nodeA = ProjectService.createNode(project.id, 'A', '2026-09-01');
      const nodeB = ProjectService.createNode(project.id, 'B', '2026-09-10');
      const nodeC = ProjectService.createNode(project.id, 'C', '2026-09-20');
      const nodes = [nodeC, nodeA, nodeB];

      const edges: Edge[] = [
        { id: 'e1', projectId: project.id, fromNodeId: nodeA.id, toNodeId: nodeB.id, createdAt: '' },
        { id: 'e2', projectId: project.id, fromNodeId: nodeB.id, toNodeId: nodeC.id, createdAt: '' },
      ];

      const sorted = GraphService.topologicalSort(nodes, edges);
      expect(sorted.map((n) => n.id)).toEqual([nodeA.id, nodeB.id, nodeC.id]);
    });
  });

  describe('Chronological Invariants and Cascading Changes', () => {
    it('rejects edge creation if predecessor occurs after successor', () => {
      const { project } = ProjectService.createProject('Test', 'Goal', '2026-10-30');
      const nodeA = ProjectService.createNode(project.id, 'Late Task', '2026-10-20');
      const nodeB = ProjectService.createNode(project.id, 'Early Task', '2026-10-05');

      const result = ProjectService.createEdge(project.id, nodeA.id, nodeB.id, [nodeA, nodeB], []);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('cannot have a due date after');
      }
    });

    it('detects temporal cascade impact when moving a task past dependent successors', () => {
      const { project, egnNode } = ProjectService.createProject('Test', 'Final Submit', '2026-10-15');
      const nodeA = ProjectService.createNode(project.id, 'Experiment', '2026-09-01');
      const nodeB = ProjectService.createNode(project.id, 'Analysis', '2026-09-10');
      const nodeC = ProjectService.createNode(project.id, 'Write Draft', '2026-09-20');

      const nodes = [nodeA, nodeB, nodeC, egnNode];
      const edges: Edge[] = [
        { id: 'e1', projectId: project.id, fromNodeId: nodeA.id, toNodeId: nodeB.id, createdAt: '' },
        { id: 'e2', projectId: project.id, fromNodeId: nodeB.id, toNodeId: nodeC.id, createdAt: '' },
        { id: 'e3', projectId: project.id, fromNodeId: nodeC.id, toNodeId: egnNode.id, createdAt: '' },
      ];

      // Moving nodeA from Sept 1 to Sept 15 violates nodeB (Sept 10)
      const impact = TemporalService.calculateCascadeImpact(nodeA.id, '2026-09-15', nodes, edges);
      expect(impact).not.toBeNull();
      expect(impact?.affectedSuccessors.length).toBeGreaterThanOrEqual(1);

      // Verify nodeB is listed as affected
      const affectedNodeB = impact?.affectedSuccessors.find((a) => a.nodeId === nodeB.id);
      expect(affectedNodeB).toBeDefined();

      // When shift is applied explicitly:
      const updatedNodes = TemporalService.applyCascadeShift(impact!, nodes);
      const updatedNodeA = updatedNodes.find((n) => n.id === nodeA.id);
      const updatedNodeB = updatedNodes.find((n) => n.id === nodeB.id);

      expect(updatedNodeA?.dueDate).toBe('2026-09-15');
      expect(updatedNodeB?.dueDate).toBe('2026-09-24'); // Shifted proportionally
    });

    it('derives start dates and durations for decomposed parent nodes without altering explicit deadline', () => {
      const { project } = ProjectService.createProject('Test', 'Goal', '2026-12-31');
      const parentTask = ProjectService.createNode(project.id, 'Write Paper', '2026-10-30');
      const subtasks = ProjectService.decomposeNode(parentTask, [
        { text: 'Intro', dueDate: '2026-10-10' },
        { text: 'Methods', dueDate: '2026-10-15' },
        { text: 'Results', dueDate: '2026-10-20' },
      ]);

      const allNodes = [parentTask, ...subtasks];
      const derived = TemporalService.getDerivedTemporal(parentTask, allNodes);

      expect(derived.isDerived).toBe(true);
      expect(derived.derivedStartDate).toBe('2026-10-10'); // Earliest subtask date
      expect(derived.explicitDueDate).toBe('2026-10-30'); // Parent deadline unchanged
      expect(derived.derivedDurationDays).toBe(20);
    });

    it('automatically computes and synchronizes parent due date when subtask exceeds parent due date', () => {
      const { project } = ProjectService.createProject('Test', 'Goal', '2026-12-31');
      const parentTask = ProjectService.createNode(project.id, 'Phase 1', '2026-10-01');
      const subtask1 = ProjectService.createNode(project.id, 'Sub 1', '2026-09-15', parentTask.id);
      const subtask2 = ProjectService.createNode(project.id, 'Sub 2', '2026-10-25', parentTask.id);

      const allNodes = [parentTask, subtask1, subtask2];
      const syncedNodes = TemporalService.syncParentDueDates(allNodes);

      const updatedParent = syncedNodes.find((n) => n.id === parentTask.id);
      expect(updatedParent?.dueDate).toBe('2026-10-25'); // Automatically extended to latest atomic inheritance
    });
  });

  describe('My Day Task Filtering', () => {
    it('returns today incomplete tasks in Today mode', () => {
      const today = '2026-09-03';
      const nodeTodayPlanned = { ...ProjectService.createNode('p1', 'Today Task', today), status: 'planned' as const };
      const nodeTodayDone = { ...ProjectService.createNode('p1', 'Done Task', today), status: 'completed' as const };
      const nodeTomorrow = { ...ProjectService.createNode('p1', 'Future Task', '2026-09-04'), status: 'planned' as const };

      const standalone = MyDayService.createStandaloneTask('Buy Milk', today);

      const result = MyDayService.getMyDayTasks(
        [nodeTodayPlanned, nodeTodayDone, nodeTomorrow],
        [standalone],
        'today',
        today
      );

      expect(result.projectTasks).toHaveLength(1);
      expect(result.projectTasks[0].id).toBe(nodeTodayPlanned.id);
      expect(result.standaloneTasks).toHaveLength(1);
      expect(result.standaloneTasks[0].id).toBe(standalone.id);
      expect(result.completedTodayProjectTasks).toHaveLength(1);
    });

    it('falls back to overdue / most recent incomplete tasks in Current Tasks mode when today has no items', () => {
      const today = '2026-09-03';
      const nodeOverdue = { ...ProjectService.createNode('p1', 'Overdue Task', '2026-08-25'), status: 'planned' as const };
      const nodeFuture = { ...ProjectService.createNode('p1', 'Future Task', '2026-09-20'), status: 'planned' as const };

      const result = MyDayService.getMyDayTasks(
        [nodeOverdue, nodeFuture],
        [],
        'current_tasks',
        today
      );

      expect(result.isFallback).toBe(true);
      expect(result.projectTasks).toHaveLength(1);
      expect(result.projectTasks[0].id).toBe(nodeOverdue.id);
    });
  });

  describe('History Snapshots and Versioning', () => {
    it('creates immutable snapshots and detects diffs accurately', () => {
      const { project, egnNode } = ProjectService.createProject('Paper', 'Submit', '2026-10-30');
      const docV1: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        project,
        nodes: [egnNode],
        edges: [],
        notes: [],
        history: [],
      };

      const { snapshot: snapV1 } = HistoryService.createSnapshot(docV1, 'Initial Project');

      // V2: add a node and mark EGN completed
      const nodeExp = ProjectService.createNode(project.id, 'Run Experiment', '2026-09-15');
      const updatedEGN = ProjectService.updateNodeStatus(egnNode, 'completed');
      const docV2: ProjectDocument = {
        ...docV1,
        nodes: [updatedEGN, nodeExp],
      };

      const diff = HistoryService.diffSnapshots(docV1, docV2);
      expect(diff.nodeAdditions).toContain('Run Experiment');
      expect(diff.statusChanges).toHaveLength(1);
      expect(diff.statusChanges[0].fromStatus).toBe('planned');
      expect(diff.statusChanges[0].toStatus).toBe('completed');

      // Restoring V1
      const restored = HistoryService.restoreFromSnapshot(snapV1);
      expect(restored.nodes).toHaveLength(1);
      expect(restored.nodes[0].status).toBe('planned');
    });
  });

  describe('Migration and Schema Validation', () => {
    it('validates and parses valid Project Documents', () => {
      const { project, egnNode } = ProjectService.createProject('Test', 'Goal', '2026-12-31');
      const doc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        project,
        nodes: [egnNode],
        edges: [],
        notes: [],
        history: [],
      };

      const result = MigrationService.parseAndMigrate(doc);
      expect(result.success).toBe(true);
    });

    it('rejects malformed documents with missing required properties', () => {
      const malformed = {
        schemaVersion: 1,
        project: { id: 'p1' }, // Missing required fields
        nodes: [],
      };

      const result = MigrationService.parseAndMigrate(malformed);
      expect(result.success).toBe(false);
    });
  });

  describe('Date Formatting and Display Formats', () => {
    it('formats dates in default DD/MM/YYYY numeric format', () => {
      expect(formatDisplayDate('2026-10-24', 'DD/MM/YYYY')).toBe('24/10/2026');
      expect(formatDisplayDate('2026-01-05', 'DD/MM/YYYY')).toBe('05/01/2026');
      expect(formatDisplayDate('2026-09-15', 'DD/MM/YYYY')).toBe('15/09/2026');
    });

    it('formats dates in Month, Day (Year) format with max 4-letter abbreviations', () => {
      // Short months (<=4 letters)
      expect(formatDisplayDate('2026-01-05', 'MMM_D_YYYY')).toBe('Jan, 5 (2026)');
      expect(formatDisplayDate('2026-05-12', 'MMM_D_YYYY')).toBe('May, 12 (2026)');
      expect(formatDisplayDate('2026-06-20', 'MMM_D_YYYY')).toBe('June, 20 (2026)');
      expect(formatDisplayDate('2026-07-04', 'MMM_D_YYYY')).toBe('July, 4 (2026)');

      // Long months abbreviated to max 4 letters (e.g. Sept)
      expect(formatDisplayDate('2026-09-15', 'MMM_D_YYYY')).toBe('Sept, 15 (2026)');
      expect(formatDisplayDate('2026-10-24', 'MMM_D_YYYY')).toBe('Oct, 24 (2026)');
      expect(formatDisplayDate('2026-11-30', 'MMM_D_YYYY')).toBe('Nov, 30 (2026)');
      expect(formatDisplayDate('2026-12-25', 'MMM_D_YYYY')).toBe('Dec, 25 (2026)');
    });
  });

  describe('Standalone Tasks Recurrence and Repetition Patterns', () => {
    it('computes daily recurrence accurately for interval 1 and custom intervals', () => {
      const ruleDaily1: RecurrenceRule = { frequency: 'daily', interval: 1 };
      expect(RecurrenceService.computeNextDueDate('2026-09-03', ruleDaily1)).toBe('2026-09-04');

      const ruleDaily3: RecurrenceRule = { frequency: 'daily', interval: 3 };
      expect(RecurrenceService.computeNextDueDate('2026-09-03', ruleDaily3)).toBe('2026-09-06');
    });

    it('computes weekday recurrence skipping weekends (Friday -> Monday, weekend handling)', () => {
      const ruleWeekday: RecurrenceRule = { frequency: 'weekdays', interval: 1 };
      // Thursday -> Friday
      expect(RecurrenceService.computeNextDueDate('2026-09-03', ruleWeekday)).toBe('2026-09-04');
      // Friday (2026-09-04) -> Monday (2026-09-07)
      expect(RecurrenceService.computeNextDueDate('2026-09-04', ruleWeekday)).toBe('2026-09-07');
      // Saturday (2026-09-05) -> Monday (2026-09-07)
      expect(RecurrenceService.computeNextDueDate('2026-09-05', ruleWeekday)).toBe('2026-09-07');
    });

    it('computes weekly recurrence on single day and bi-weekly intervals', () => {
      // Monday (2026-09-07) + 1 week -> Monday (2026-09-14)
      const ruleWeeklyMon: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1] };
      expect(RecurrenceService.computeNextDueDate('2026-09-07', ruleWeeklyMon)).toBe('2026-09-14');

      // Monday (2026-09-07) + 2 weeks -> Monday (2026-09-21)
      const ruleBiWeeklyMon: RecurrenceRule = { frequency: 'weekly', interval: 2, daysOfWeek: [1] };
      expect(RecurrenceService.computeNextDueDate('2026-09-07', ruleBiWeeklyMon)).toBe('2026-09-21');
    });

    it('computes multi-day weekly recurrence (e.g. Mon, Wed, Fri)', () => {
      const ruleMWF: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] };
      // From Monday (2026-09-07) -> Wednesday (2026-09-09)
      expect(RecurrenceService.computeNextDueDate('2026-09-07', ruleMWF)).toBe('2026-09-09');
      // From Wednesday (2026-09-09) -> Friday (2026-09-11)
      expect(RecurrenceService.computeNextDueDate('2026-09-09', ruleMWF)).toBe('2026-09-11');
      // From Friday (2026-09-11) -> Next Monday (2026-09-14)
      expect(RecurrenceService.computeNextDueDate('2026-09-11', ruleMWF)).toBe('2026-09-14');
    });

    it('computes monthly recurrence by day of month with end-of-month clamping', () => {
      const ruleMonthly15: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 15 };
      expect(RecurrenceService.computeNextDueDate('2026-09-15', ruleMonthly15)).toBe('2026-10-15');

      // Clamping: Jan 31 + 1 month in non-leap year (2027) -> Feb 28
      const ruleMonthly31: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
      expect(RecurrenceService.computeNextDueDate('2027-01-31', ruleMonthly31)).toBe('2027-02-28');
    });

    it('computes monthly recurrence by Nth weekday of month (1st Mon, 2nd Tue, 3rd Wed, last Fri)', () => {
      // 1st Monday of October 2026: October 1 is Thursday, so 1st Monday is Oct 5
      const rule1stMon: RecurrenceRule = {
        frequency: 'monthly',
        interval: 1,
        nthWeekdayOfMonth: { nth: 1, dayOfWeek: 1 },
      };
      expect(RecurrenceService.computeNextDueDate('2026-09-07', rule1stMon)).toBe('2026-10-05');

      // 2nd Tuesday of October 2026: Oct 1 is Thu, 1st Tue is Oct 6, 2nd Tue is Oct 13
      const rule2ndTue: RecurrenceRule = {
        frequency: 'monthly',
        interval: 1,
        nthWeekdayOfMonth: { nth: 2, dayOfWeek: 2 },
      };
      expect(RecurrenceService.computeNextDueDate('2026-09-08', rule2ndTue)).toBe('2026-10-13');

      // Last Friday of October 2026: Oct 31 is Saturday, so last Friday is Oct 30
      const ruleLastFri: RecurrenceRule = {
        frequency: 'monthly',
        interval: 1,
        nthWeekdayOfMonth: { nth: -1, dayOfWeek: 5 },
      };
      expect(RecurrenceService.computeNextDueDate('2026-09-25', ruleLastFri)).toBe('2026-10-30');
    });

    it('computes yearly recurrence accurately', () => {
      const ruleYearly: RecurrenceRule = { frequency: 'yearly', interval: 1 };
      expect(RecurrenceService.computeNextDueDate('2026-09-03', ruleYearly)).toBe('2027-09-03');
    });

    it('enforces occurrence count limits and end dates', () => {
      const ruleWithCount: RecurrenceRule = { frequency: 'daily', interval: 1, count: 3 };
      // 1st occurrence -> gives next
      expect(RecurrenceService.computeNextDueDate('2026-09-03', ruleWithCount, 1)).toBe('2026-09-04');
      // 2nd occurrence -> gives next
      expect(RecurrenceService.computeNextDueDate('2026-09-04', ruleWithCount, 2)).toBe('2026-09-05');
      // 3rd occurrence (reached limit) -> returns null
      expect(RecurrenceService.computeNextDueDate('2026-09-05', ruleWithCount, 3)).toBeNull();

      // End date limit
      const ruleWithEndDate: RecurrenceRule = { frequency: 'daily', interval: 1, endDate: '2026-09-05' };
      expect(RecurrenceService.computeNextDueDate('2026-09-04', ruleWithEndDate)).toBe('2026-09-05');
      expect(RecurrenceService.computeNextDueDate('2026-09-05', ruleWithEndDate)).toBeNull();
    });

    it('formats human-readable recurrence descriptions', () => {
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'daily', interval: 1 })).toBe('Daily');
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'daily', interval: 3 })).toBe('Every 3 days');
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'weekdays', interval: 1 })).toBe('Every weekday (Mon–Fri)');
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'weekly', interval: 1, daysOfWeek: [1] })).toBe('Weekly on Mon');
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'weekly', interval: 2, daysOfWeek: [1] })).toBe('Every 2 weeks on Mon');
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'monthly', interval: 1, dayOfMonth: 15 })).toBe('Monthly on day 15');
      expect(
        RecurrenceService.formatRecurrenceRule({
          frequency: 'monthly',
          interval: 1,
          nthWeekdayOfMonth: { nth: 1, dayOfWeek: 1 },
        })
      ).toBe('Monthly on the 1st Monday');
      expect(
        RecurrenceService.formatRecurrenceRule({
          frequency: 'monthly',
          interval: 2,
          nthWeekdayOfMonth: { nth: -1, dayOfWeek: 5 },
        })
      ).toBe('Every 2 months on the last Friday');
      expect(RecurrenceService.formatRecurrenceRule({ frequency: 'yearly', interval: 1 })).toBe('Yearly');
    });

    it('creates standalone tasks with recurrence and serializes in storage models', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 2, daysOfWeek: [1] };
      const task = MyDayService.createStandaloneTask('Review weekly metrics', '2026-09-07', rule);

      expect(task.id).toBeDefined();
      expect(task.text).toBe('Review weekly metrics');
      expect(task.dueDate).toBe('2026-09-07');
      expect(task.recurrence).toEqual(rule);
      expect(task.status).toBe('planned');

      // JSON serialization integrity
      const serialized = JSON.stringify(task);
      const parsed = JSON.parse(serialized);
      expect(parsed.recurrence.frequency).toBe('weekly');
      expect(parsed.recurrence.interval).toBe(2);
      expect(parsed.recurrence.daysOfWeek).toEqual([1]);
    });
  });

  describe('Universal JSON Import and Backup Restoration', () => {
    it('successfully parses full workspace backup with projects, standalone tasks, and preferences', () => {
      const { project, egnNode } = ProjectService.createProject('Full Backup Proj', 'Reach Goal', '2026-12-31');
      const doc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-03T20:00:00.000Z',
        project,
        nodes: [egnNode],
        edges: [],
        notes: [],
        history: [],
      };

      const backupObj = {
        schemaVersion: 1,
        exportedAt: '2026-09-03T20:00:00.000Z',
        backupType: 'full_workspace',
        projects: [doc],
        standaloneTasks: [
          {
            id: 'st_1',
            text: 'Standalone Task',
            dueDate: '2026-09-05',
            status: 'planned',
            createdAt: '2026-09-03T20:00:00.000Z',
            updatedAt: '2026-09-03T20:00:00.000Z',
          },
        ],
        preferences: {
          myDayMode: 'today',
          theme: 'dark',
          onboardingCompleted: true,
          preferredStorageProvider: 'browser',
        },
      };

      const result = MigrationService.parseAnyJsonPayload(backupObj);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.type).toBe('workspace');
        if (result.payload.type === 'workspace') {
          expect(result.payload.projects).toHaveLength(1);
          expect(result.payload.projects[0].project.name).toBe('Full Backup Proj');
          expect(result.payload.standaloneTasks).toHaveLength(1);
          expect(result.payload.preferences?.theme).toBe('dark');
        }
      }
    });

    it('gracefully normalizes partial or relaxed project JSON structures', () => {
      // Partial format: missing notes, edges, nodes arrays
      const partialJson = {
        project: {
          id: 'proj_partial',
          name: 'Partial Project',
          endGoalNodeId: 'goal_1',
          createdAt: '2026-09-03T20:00:00.000Z',
          updatedAt: '2026-09-03T20:00:00.000Z',
        },
      };

      const result = MigrationService.parseAndMigrate(partialJson);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.nodes).toEqual([]);
        expect(result.document.edges).toEqual([]);
        expect(result.document.notes).toEqual([]);
      }
    });

    it('parses arrays of project documents', () => {
      const { project: p1, egnNode: e1 } = ProjectService.createProject('P1', 'G1', '2026-10-01');
      const { project: p2, egnNode: e2 } = ProjectService.createProject('P2', 'G2', '2026-11-01');

      const arrayJson = [
        {
          schemaVersion: 1,
          exportedAt: '2026-09-03T20:00:00.000Z',
          project: p1,
          nodes: [e1],
          edges: [],
          notes: [],
        },
        {
          schemaVersion: 1,
          exportedAt: '2026-09-03T20:00:00.000Z',
          project: p2,
          nodes: [e2],
          edges: [],
          notes: [],
        },
      ];

      const result = MigrationService.parseAnyJsonPayload(arrayJson);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.type).toBe('projects_array');
        if (result.payload.type === 'projects_array') {
          expect(result.payload.projects).toHaveLength(2);
        }
      }
    });
  });
});
