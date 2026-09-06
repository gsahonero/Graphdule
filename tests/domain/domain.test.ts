import { describe, it, expect } from 'vitest';
import {
  ProjectService,
  GraphService,
  TemporalService,
  MyDayService,
  RecurrenceService,
  HistoryService,
  MigrationService,
  ActivityLogService,
  formatDisplayDate,
  getTodayString,
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

    it('saves and restores attention projects, parked status, idea seeds, and activity log in full workspace backup file format', () => {
      const { project, egnNode } = ProjectService.createProject('Attention Proj', 'EGN', '2026-12-31');
      const focused = ProjectService.setProjectAttention(project, true);
      const parkedProject = ProjectService.parkProject(
        ProjectService.createProject('Parked Proj', 'EGN 2', '2026-11-30').project
      );

      const seed = ProjectService.createIdeaSeed('Seed 1', 'Raw notes', ['Thought 1'], ['Tag 1']);
      const event = ActivityLogService.createEvent('task_completed', {
        taskId: 'task_1',
        taskText: 'Done task',
        isAttentionProject: true,
      });

      const backupObj = {
        schemaVersion: 1,
        exportedAt: '2026-09-04T12:00:00.000Z',
        backupType: 'full_workspace',
        projects: [
          {
            schemaVersion: 1,
            exportedAt: '2026-09-04T12:00:00.000Z',
            project: focused,
            nodes: [egnNode],
            edges: [],
            notes: [],
          },
          {
            schemaVersion: 1,
            exportedAt: '2026-09-04T12:00:00.000Z',
            project: parkedProject,
            nodes: [],
            edges: [],
            notes: [],
          },
        ],
        standaloneTasks: [],
        preferences: {
          myDayMode: 'today',
          theme: 'dark',
          onboardingCompleted: true,
          preferredStorageProvider: 'browser',
          maxAttentionProjects: 4,
        },
        ideaSeeds: [seed],
        activityLog: [event],
      };

      const result = MigrationService.parseAnyJsonPayload(backupObj);
      expect(result.success).toBe(true);
      if (result.success && result.payload.type === 'workspace') {
        expect(result.payload.projects).toHaveLength(2);
        const p1 = result.payload.projects.find((p) => p.project.id === focused.id);
        expect(p1?.project.isAttention).toBe(true);
        expect(p1?.project.attentionPromotedAt).toBeDefined();

        const p2 = result.payload.projects.find((p) => p.project.id === parkedProject.id);
        expect(p2?.project.status).toBe('parked');

        expect(result.payload.preferences?.maxAttentionProjects).toBe(4);

        expect(result.payload.ideaSeeds).toHaveLength(1);
        expect(result.payload.ideaSeeds?.[0].title).toBe('Seed 1');
        expect(result.payload.ideaSeeds?.[0].seedThoughts).toEqual(['Thought 1']);

        expect(result.payload.activityLog).toHaveLength(1);
        expect(result.payload.activityLog?.[0].type).toBe('task_completed');
        expect(result.payload.activityLog?.[0].entityId).toBe('task_1');
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

    it('preserves custom project styles (color, icon, emoji) during JSON serialization and import', () => {
      const { project, egnNode } = ProjectService.createProject(
        'Styled Project',
        'Custom Goal',
        '2026-12-31',
        ['important'],
        { color: 'indigo', icon: 'graduation-cap', emoji: '🎓' }
      );

      const doc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-03T20:00:00.000Z',
        project,
        nodes: [egnNode],
        edges: [],
        notes: [],
        history: [],
      };

      // 1. Serialize to JSON string
      const jsonString = JSON.stringify(doc);

      // 2. Parse and migrate back
      const parsed = MigrationService.parseAndMigrate(JSON.parse(jsonString));
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.document.project.style).toBeDefined();
        expect(parsed.document.project.style?.color).toBe('indigo');
        expect(parsed.document.project.style?.icon).toBe('graduation-cap');
        expect(parsed.document.project.style?.emoji).toBe('🎓');
      }

      // 3. Test through universal payload parser
      const universalParsed = MigrationService.parseAnyJsonPayload(JSON.parse(jsonString));
      expect(universalParsed.success).toBe(true);
      if (universalParsed.success && universalParsed.payload.type === 'project') {
        expect(universalParsed.payload.document.project.style?.color).toBe('indigo');
        expect(universalParsed.payload.document.project.style?.icon).toBe('graduation-cap');
        expect(universalParsed.payload.document.project.style?.emoji).toBe('🎓');
      }
    });
  });

  describe('Parent Completion Cascade & Default Today Date Invariants', () => {
    it('defaults new node due date to today if omitted or empty', () => {
      const node1 = ProjectService.createNode('proj_1', 'Task without date');
      expect(node1.dueDate).toBe(getTodayString());

      const node2 = ProjectService.createNode('proj_1', 'Task with empty string date', '');
      expect(node2.dueDate).toBe(getTodayString());
    });

    it('cascades completion to parent node when all child subtasks are completed', () => {
      const parentNode = ProjectService.createNode('proj_1', 'Parent Task');
      const child1 = ProjectService.createNode('proj_1', 'Child Task 1', getTodayString(), parentNode.id);
      const child2 = ProjectService.createNode('proj_1', 'Child Task 2', getTodayString(), parentNode.id);

      // Initially, parent and children are planned
      expect(parentNode.status).toBe('planned');
      expect(child1.status).toBe('planned');
      expect(child2.status).toBe('planned');

      // Mark child 1 as completed: parent should NOT complete yet
      const completedChild1 = ProjectService.updateNodeStatus(child1, 'completed');
      const step1Nodes = [parentNode, completedChild1, child2];
      const step1Result = ProjectService.cascadeParentCompletion(step1Nodes, completedChild1.id);
      expect(step1Result.completedParentIds).toHaveLength(0);
      expect(step1Result.updatedNodes.find((n) => n.id === parentNode.id)?.status).toBe('planned');

      // Mark child 2 as completed: all subtasks are now completed!
      const completedChild2 = ProjectService.updateNodeStatus(child2, 'completed');
      const step2Nodes = [parentNode, completedChild1, completedChild2];
      const step2Result = ProjectService.cascadeParentCompletion(step2Nodes, completedChild2.id);

      expect(step2Result.completedParentIds).toEqual([parentNode.id]);
      const updatedParent = step2Result.updatedNodes.find((n) => n.id === parentNode.id);
      expect(updatedParent?.status).toBe('completed');
    });

    it('cascades completion recursively to grandparents when all nested subtasks are completed', () => {
      const grandParent = ProjectService.createNode('proj_1', 'Grandparent Goal');
      const parent = ProjectService.createNode('proj_1', 'Parent Task', getTodayString(), grandParent.id);
      const child = ProjectService.createNode('proj_1', 'Child Subtask', getTodayString(), parent.id);

      // Mark child as completed
      const completedChild = ProjectService.updateNodeStatus(child, 'completed');
      const updatedList = [grandParent, parent, completedChild];
      const result = ProjectService.cascadeParentCompletion(updatedList, completedChild.id);

      // Both parent and grandparent should be completed
      expect(result.completedParentIds).toContain(parent.id);
      expect(result.completedParentIds).toContain(grandParent.id);

      expect(result.updatedNodes.find((n) => n.id === parent.id)?.status).toBe('completed');
      expect(result.updatedNodes.find((n) => n.id === grandParent.id)?.status).toBe('completed');
    });
  });

  describe('Attention Allocation & Project Parking Invariants', () => {
    it('sets and removes attention flags on projects with promotion timestamps', () => {
      const { project } = ProjectService.createProject('Attention Proj', 'EGN', '2026-12-31');
      expect(project.isAttention).toBeUndefined();

      const promoted = ProjectService.setProjectAttention(project, true);
      expect(promoted.isAttention).toBe(true);
      expect(promoted.attentionPromotedAt).toBeDefined();

      const demoted = ProjectService.setProjectAttention(promoted, false);
      expect(demoted.isAttention).toBe(false);
      expect(demoted.attentionPromotedAt).toBeUndefined();
    });

    it('parks an active project, preserving graph properties while removing attention', () => {
      const { project, egnNode } = ProjectService.createProject('To Park', 'EGN', '2026-12-31');
      const focused = ProjectService.setProjectAttention(project, true);

      const parked = ProjectService.parkProject(focused);
      expect(parked.status).toBe('parked');
      expect(parked.isAttention).toBe(false);
      expect(parked.endGoalNodeId).toBe(egnNode.id);

      const summary = ProjectService.getProjectSummary(parked, [egnNode]);
      expect(summary.isParked).toBe(true);
      expect(summary.isAttention).toBe(false);
    });

    it('unparks a parked project back to active status', () => {
      const { project, egnNode } = ProjectService.createProject('Parked Proj', 'EGN', '2026-12-31');
      const parked = ProjectService.parkProject(project);
      expect(parked.status).toBe('parked');

      const unparked = ProjectService.unparkProject(parked);
      expect(unparked.status).toBe('active');

      const summary = ProjectService.getProjectSummary(unparked, [egnNode]);
      expect(summary.isParked).toBe(false);
    });

    it('sorts priority attention projects chronologically from nearest due date to furthest due date', () => {
      const { project: pLate, egnNode: eLate } = ProjectService.createProject('Late Due', 'Goal Late', '2026-12-31');
      const { project: pSoon, egnNode: eSoon } = ProjectService.createProject('Soon Due', 'Goal Soon', '2026-09-10');
      const { project: pMid, egnNode: eMid } = ProjectService.createProject('Mid Due', 'Goal Mid', '2026-10-15');

      const sumLate = ProjectService.getProjectSummary(pLate, [eLate]);
      const sumSoon = ProjectService.getProjectSummary(pSoon, [eSoon]);
      const sumMid = ProjectService.getProjectSummary(pMid, [eMid]);

      // Unordered input: Late, Soon, Mid
      const sorted = ProjectService.sortAttentionProjects([sumLate, sumSoon, sumMid]);

      // Expected order: Soon (Sep 10), Mid (Oct 15), Late (Dec 31)
      expect(sorted.map((p) => p.name)).toEqual(['Soon Due', 'Mid Due', 'Late Due']);
      expect(sorted.map((p) => p.deadline)).toEqual(['2026-09-10', '2026-10-15', '2026-12-31']);
    });
  });

  describe('Idea Seeds & Organic Germination Invariants', () => {
    it('creates an idea seed with title, clean thoughts, and normalized tags', () => {
      const seed = ProjectService.createIdeaSeed(
        'AI Agent Workflow',
        'Consider building local first agents with sqlite',
        ['Define tool call protocol', 'Wire telemetry journal', '  '],
        ['  AI  ', 'Agent', 'AI']
      );

      expect(seed.id).toBeDefined();
      expect(seed.title).toBe('AI Agent Workflow');
      expect(seed.rawNotes).toBe('Consider building local first agents with sqlite');
      expect(seed.seedThoughts).toEqual(['Define tool call protocol', 'Wire telemetry journal']);
      expect(seed.tags).toEqual(['AI', 'Agent']);
      expect(seed.createdAt).toBeDefined();
    });

    it('updates an idea seed and refreshes updatedAt timestamp', () => {
      const seed = ProjectService.createIdeaSeed('Initial Seed');
      const updated = ProjectService.updateIdeaSeed(seed, {
        title: 'Updated Seed Title',
        seedThoughts: ['First thought', 'Second thought'],
      });

      expect(updated.id).toBe(seed.id);
      expect(updated.title).toBe('Updated Seed Title');
      expect(updated.seedThoughts).toEqual(['First thought', 'Second thought']);
    });

    it('supports incrementally adding thoughts, updating raw notes, and tags to an idea seed', () => {
      const seed = ProjectService.createIdeaSeed('Initial Seed', 'Initial notes', ['Thought 1']);
      // Add more thoughts and change notes
      const updated1 = ProjectService.updateIdeaSeed(seed, {
        seedThoughts: [...(seed.seedThoughts || []), 'Thought 2', 'Thought 3'],
        rawNotes: 'Expanded research notes and links',
        tags: ['strategy', 'ai'],
      });

      expect(updated1.seedThoughts).toEqual(['Thought 1', 'Thought 2', 'Thought 3']);
      expect(updated1.rawNotes).toBe('Expanded research notes and links');
      expect(updated1.tags).toEqual(['strategy', 'ai']);

      // Remove a thought and add another
      const updated2 = ProjectService.updateIdeaSeed(updated1, {
        seedThoughts: updated1.seedThoughts?.filter((t) => t !== 'Thought 2').concat('Thought 4'),
      });

      expect(updated2.seedThoughts).toEqual(['Thought 1', 'Thought 3', 'Thought 4']);
    });

    it('germinates an idea seed into a full DAG project with EGN, predecessor nodes, and note', () => {
      const seed = ProjectService.createIdeaSeed(
        'Launch Podcasting Show',
        'Need to buy a Shure SM7B microphone and record 3 pilot episodes.',
        ['Buy microphone', 'Record pilot episode', 'Distribute on RSS'],
        ['Podcast', 'Media']
      );

      const targetDueDate = '2026-11-30';
      const { project, egnNode, predecessorNodes, edges, note } = ProjectService.germinateSeedToProject(
        seed,
        targetDueDate
      );

      // Project invariants
      expect(project.name).toBe('Launch Podcasting Show');
      expect(project.status).toBe('active');
      expect(project.endGoalNodeId).toBe(egnNode.id);
      expect(project.tags).toEqual(['Podcast', 'Media']);

      // EGN invariants
      expect(egnNode.text).toBe('Launch Podcasting Show');
      expect(egnNode.dueDate).toBe(targetDueDate);

      // Predecessor nodes invariants
      expect(predecessorNodes).toHaveLength(3);
      expect(predecessorNodes.map((n) => n.text)).toEqual([
        'Buy microphone',
        'Record pilot episode',
        'Distribute on RSS',
      ]);

      // All predecessor nodes must be wired to the EGN
      expect(edges).toHaveLength(3);
      for (const edge of edges) {
        expect(edge.toNodeId).toBe(egnNode.id);
        expect(predecessorNodes.some((p) => p.id === edge.fromNodeId)).toBe(true);
      }

      // Notes invariant
      expect(note).toBeDefined();
      expect(note?.nodeId).toBe(egnNode.id);
      expect(note?.text).toContain('Shure SM7B');
    });
  });

  describe('Activity Telemetry Journal & Pattern Analysis Invariants', () => {
    it('creates structured activity events with timestamps and contextual metadata', () => {
      const event = ActivityLogService.createEvent('task_completed', {
        taskId: 'task_123',
        taskText: 'Ship v1.0',
        projectId: 'proj_456',
        projectName: 'Graphdule Release',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        isAttentionProject: true,
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('task_completed');
      expect(event.entityId).toBe('task_123');
      expect(event.metadata?.isAttentionProject).toBe(true);
      expect(event.toStatus).toBe('completed');
    });

    it('generates pattern analysis metrics and copy-ready LLM prompts', () => {
      const events = [
        ActivityLogService.createEvent('task_created', {
          taskId: 't1',
          taskText: 'Design wireframes',
          projectId: 'p1',
          isAttentionProject: true,
        }),
        ActivityLogService.createEvent('task_completed', {
          taskId: 't1',
          taskText: 'Design wireframes',
          projectId: 'p1',
          fromStatus: 'in_progress',
          toStatus: 'completed',
          isAttentionProject: true,
        }),
        ActivityLogService.createEvent('date_moved', {
          taskId: 't2',
          taskText: 'Write tests',
          projectId: 'p2',
          previousDate: '2026-09-01',
          newDate: '2026-09-05',
          isAttentionProject: false,
        }),
        ActivityLogService.createEvent('task_completed', {
          taskId: 't3',
          taskText: 'Fix typo',
          projectId: 'p2',
          fromStatus: 'planned',
          toStatus: 'completed',
          isAttentionProject: false,
        }),
      ];

      const analysis = ActivityLogService.generatePatternAnalysis(events, 30);
      expect(analysis.totalEvents).toBe(4);
      expect(analysis.tasksCreated).toBe(1);
      expect(analysis.tasksCompleted).toBe(2);
      expect(analysis.tasksPostponed).toBe(1);
      expect(analysis.completionsInAttention).toBe(1);
      expect(analysis.completionsOutOfAttention).toBe(1);

      // Prompt verification
      expect(analysis.llmPrompt).toContain('Productivity & Attention Telemetry Analysis Prompt');
      expect(analysis.llmPrompt).toContain('Tasks Completed:** 2');
      expect(analysis.llmPrompt).toContain('Due Date Postponements / Reschedules:** 1');
      expect(analysis.llmPrompt).toContain('Your Mission');
    });
  });

  describe('Parent-Child In Progress Invariant', () => {
    it('cascades in_progress status up to direct parent and recursive ancestors', () => {
      const { project, egnNode } = ProjectService.createProject('Pipeline', 'Goal', '2026-12-31');
      const rootTask = ProjectService.createNode(project.id, 'Root Task', '2026-11-01');
      const childTask = ProjectService.createNode(project.id, 'Child Task', '2026-11-15', rootTask.id);
      let grandChildTask = ProjectService.createNode(project.id, 'Grandchild Task', '2026-11-20', childTask.id);

      // Set grandchild to in_progress
      grandChildTask = ProjectService.updateNodeStatus(grandChildTask, 'in_progress');
      const allNodes = [egnNode, rootTask, childTask, grandChildTask];

      const { updatedNodes, inProgressParentIds } = ProjectService.cascadeParentInProgress(
        allNodes,
        grandChildTask.id
      );

      expect(inProgressParentIds).toEqual([childTask.id, rootTask.id]);
      const updatedChild = updatedNodes.find((n) => n.id === childTask.id);
      const updatedRoot = updatedNodes.find((n) => n.id === rootTask.id);
      const updatedEGN = updatedNodes.find((n) => n.id === egnNode.id);

      expect(updatedChild?.status).toBe('in_progress');
      expect(updatedRoot?.status).toBe('in_progress');
      expect(updatedEGN?.status).toBe('planned');
    });

    it('detects when a node has an in-progress child', () => {
      const parent = ProjectService.createNode('p1', 'Parent', '2026-11-01');
      let child1 = ProjectService.createNode('p1', 'Child 1', '2026-11-02', parent.id);
      let child2 = ProjectService.createNode('p1', 'Child 2', '2026-11-03', parent.id);

      expect(ProjectService.hasInProgressChild([parent, child1, child2], parent.id)).toBe(false);

      child1 = ProjectService.updateNodeStatus(child1, 'completed');
      expect(ProjectService.hasInProgressChild([parent, child1, child2], parent.id)).toBe(false);

      child2 = ProjectService.updateNodeStatus(child2, 'in_progress');
      expect(ProjectService.hasInProgressChild([parent, child1, child2], parent.id)).toBe(true);
    });

    it('prevents modifying parent node status away from in_progress when any child is in progress', () => {
      let parent = ProjectService.createNode('p1', 'Parent', '2026-11-01');
      parent = ProjectService.updateNodeStatus(parent, 'in_progress');
      let child = ProjectService.createNode('p1', 'Child', '2026-11-02', parent.id);
      child = ProjectService.updateNodeStatus(child, 'in_progress');

      const nodes = [parent, child];

      // Disallow planned, completed, abandoned
      const checkPlanned = ProjectService.canModifyNodeStatus(nodes, parent.id, 'planned');
      expect(checkPlanned.allowed).toBe(false);
      expect(checkPlanned.reason).toBeDefined();

      const checkCompleted = ProjectService.canModifyNodeStatus(nodes, parent.id, 'completed');
      expect(checkCompleted.allowed).toBe(false);

      const checkAbandoned = ProjectService.canModifyNodeStatus(nodes, parent.id, 'abandoned');
      expect(checkAbandoned.allowed).toBe(false);

      // In progress is allowed
      const checkInProgress = ProjectService.canModifyNodeStatus(nodes, parent.id, 'in_progress');
      expect(checkInProgress.allowed).toBe(true);

      // Child itself has no children, so its status can be modified
      const checkChild = ProjectService.canModifyNodeStatus(nodes, child.id, 'completed');
      expect(checkChild.allowed).toBe(true);
    });

    it('syncs parent status hierarchy document-wide', () => {
      const parent = ProjectService.createNode('p1', 'Parent', '2026-11-01');
      let child = ProjectService.createNode('p1', 'Child', '2026-11-02', parent.id);
      child = ProjectService.updateNodeStatus(child, 'in_progress');

      const { updatedNodes, affectedParentIds } = ProjectService.syncParentStatusHierarchy([
        parent,
        child,
      ]);

      expect(affectedParentIds).toContain(parent.id);
      const syncedParent = updatedNodes.find((n) => n.id === parent.id);
      expect(syncedParent?.status).toBe('in_progress');
    });
  });
});
