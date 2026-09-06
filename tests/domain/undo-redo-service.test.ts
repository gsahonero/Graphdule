import { describe, it, expect, beforeEach } from 'vitest';
import { UndoRedoManager, MAX_HISTORY_SIZE } from '../../src/domain/services/undo-redo-service';
import { ProjectDocument } from '../../src/domain/models/types';

function createMockDoc(projectId: string, nodeCount: number, customText?: string): ProjectDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    project: {
      id: projectId,
      name: `Project ${projectId}`,
      endGoalNodeId: `${projectId}_egn`,
      tags: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `node_${i}`,
      projectId,
      parentNodeId: null,
      text: customText ? `${customText} ${i}` : `Task ${i}`,
      dueDate: '2026-10-01',
      status: 'planned',
      position: { x: i * 100, y: 100 },
      createdAt: now,
      updatedAt: now,
    })),
    edges: [],
    notes: [],
    exportedAt: now,
  };
}

describe('UndoRedoManager (Undo / Redo)', () => {
  let manager: UndoRedoManager;

  beforeEach(() => {
    manager = new UndoRedoManager(100);
  });

  it('starts with canUndo and canRedo as false', () => {
    expect(manager.canUndo('p1')).toBe(false);
    expect(manager.canRedo('p1')).toBe(false);
    expect(manager.getUndoCount('p1')).toBe(0);
    expect(manager.getRedoCount('p1')).toBe(0);
  });

  it('records state and allows undo', () => {
    const doc1 = createMockDoc('p1', 1);
    manager.record(doc1);

    expect(manager.canUndo('p1')).toBe(true);
    expect(manager.canRedo('p1')).toBe(false);
    expect(manager.getUndoCount('p1')).toBe(1);

    const doc2 = createMockDoc('p1', 2);
    const restored = manager.undo(doc2);

    expect(restored).not.toBeNull();
    expect(restored!.nodes.length).toBe(1);
    expect(manager.canUndo('p1')).toBe(false);
    expect(manager.canRedo('p1')).toBe(true);
  });

  it('allows redo after undo', () => {
    const doc1 = createMockDoc('p1', 1);
    manager.record(doc1);

    const doc2 = createMockDoc('p1', 2);
    const afterUndo = manager.undo(doc2);
    expect(afterUndo!.nodes.length).toBe(1);

    const afterRedo = manager.redo(afterUndo!);
    expect(afterRedo).not.toBeNull();
    expect(afterRedo!.nodes.length).toBe(2);
    expect(manager.canUndo('p1')).toBe(true);
    expect(manager.canRedo('p1')).toBe(false);
  });

  it('caps history size at maxSize (100) and shifts oldest', () => {
    for (let i = 0; i < 110; i++) {
      const doc = createMockDoc('p1', i + 1);
      manager.record(doc);
    }

    expect(manager.getUndoCount('p1')).toBe(MAX_HISTORY_SIZE);
  });

  it('suppresses duplicate identical snapshots to conserve memory', () => {
    const doc1 = createMockDoc('p1', 2);
    manager.record(doc1);
    manager.record(doc1); // Identical
    manager.record({ ...doc1 }); // Structurally identical

    expect(manager.getUndoCount('p1')).toBe(1);
  });

  it('invalidates redo future when a new action is recorded', () => {
    const doc1 = createMockDoc('p1', 1);
    manager.record(doc1);

    const doc2 = createMockDoc('p1', 2);
    const afterUndo = manager.undo(doc2);
    expect(afterUndo?.nodes.length).toBe(1);
    expect(manager.canRedo('p1')).toBe(true);

    // New action performed while redo was available
    const doc3 = createMockDoc('p1', 3);
    manager.record(doc3);

    expect(manager.canRedo('p1')).toBe(false);
    expect(manager.getRedoCount('p1')).toBe(0);
  });

  it('maintains independent histories per project', () => {
    const docA1 = createMockDoc('projA', 1);
    const docB1 = createMockDoc('projB', 5);

    manager.record(docA1);
    manager.record(docB1);

    expect(manager.getUndoCount('projA')).toBe(1);
    expect(manager.getUndoCount('projB')).toBe(1);

    const docA2 = createMockDoc('projA', 2);
    const restoredA = manager.undo(docA2);

    expect(restoredA!.nodes.length).toBe(1);
    expect(manager.canUndo('projA')).toBe(false);
    expect(manager.canUndo('projB')).toBe(true);
  });

  it('clears project history when requested', () => {
    const doc = createMockDoc('p1', 1);
    manager.record(doc);
    expect(manager.canUndo('p1')).toBe(true);

    manager.clearProject('p1');
    expect(manager.canUndo('p1')).toBe(false);
  });
});
