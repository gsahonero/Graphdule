import { ProjectDocument, Project, Node, Edge, Note } from '../models/types';

export interface ProjectHistorySnapshot {
  project: Project;
  nodes: Node[];
  edges: Edge[];
  notes: Note[];
}

export interface HistoryState {
  past: ProjectHistorySnapshot[];
  future: ProjectHistorySnapshot[];
}

export const MAX_HISTORY_SIZE = 100;

/**
 * Creates a lightweight snapshot of a project document, omitting heavy append-only activity logs.
 */
export function createHistorySnapshot(doc: ProjectDocument): ProjectHistorySnapshot {
  return {
    project: { ...doc.project },
    nodes: doc.nodes.map((n) => ({ ...n })),
    edges: doc.edges.map((e) => ({ ...e })),
    notes: doc.notes ? doc.notes.map((note) => ({ ...note })) : [],
  };
}

/**
 * Reconstructs a full ProjectDocument from a lightweight snapshot using the base document's metadata.
 */
export function applyHistorySnapshot(
  baseDoc: ProjectDocument,
  snapshot: ProjectHistorySnapshot
): ProjectDocument {
  const now = new Date().toISOString();
  return {
    ...baseDoc,
    project: {
      ...snapshot.project,
      updatedAt: now,
    },
    nodes: snapshot.nodes.map((n) => ({ ...n })),
    edges: snapshot.edges.map((e) => ({ ...e })),
    notes: snapshot.notes.map((note) => ({ ...note })),
    exportedAt: now,
  };
}

/**
 * Fast equality check to prevent recording identical snapshots (e.g. no-op clicks or redundant renders).
 */
export function isSnapshotEqual(
  a: ProjectHistorySnapshot | undefined,
  b: ProjectHistorySnapshot
): boolean {
  if (!a) return false;
  if (a.project.id !== b.project.id) return false;
  if (a.project.name !== b.project.name) return false;
  if (a.nodes.length !== b.nodes.length) return false;
  if (a.edges.length !== b.edges.length) return false;
  if ((a.notes?.length ?? 0) !== (b.notes?.length ?? 0)) return false;

  // Compare nodes: id, text, status, dueDate, position, parentNodeId
  for (let i = 0; i < a.nodes.length; i++) {
    const na = a.nodes[i];
    const nb = b.nodes[i];
    if (
      na.id !== nb.id ||
      na.text !== nb.text ||
      na.status !== nb.status ||
      na.dueDate !== nb.dueDate ||
      na.parentNodeId !== nb.parentNodeId ||
      na.position?.x !== nb.position?.x ||
      na.position?.y !== nb.position?.y
    ) {
      return false;
    }
  }

  // Compare edges: id, fromNodeId, toNodeId
  for (let i = 0; i < a.edges.length; i++) {
    const ea = a.edges[i];
    const eb = b.edges[i];
    if (ea.id !== eb.id || ea.fromNodeId !== eb.fromNodeId || ea.toNodeId !== eb.toNodeId) {
      return false;
    }
  }

  return true;
}

/**
 * Memory-efficient per-project UndoRedoManager for live user actions.
 */
export class UndoRedoManager {
  private histories = new Map<string, HistoryState>();
  private readonly maxSize: number;

  constructor(maxSize: number = MAX_HISTORY_SIZE) {
    this.maxSize = maxSize;
  }

  private getOrCreate(projectId: string): HistoryState {
    let state = this.histories.get(projectId);
    if (!state) {
      state = { past: [], future: [] };
      this.histories.set(projectId, state);
    }
    return state;
  }

  /**
   * Records a previous state into the undo stack before a mutation is applied.
   * If the snapshot is identical to the top of the stack, it is skipped to save memory.
   */
  public record(doc: ProjectDocument): void {
    const state = this.getOrCreate(doc.project.id);
    const snapshot = createHistorySnapshot(doc);

    // Suppress duplicate states
    const lastSnapshot = state.past[state.past.length - 1];
    if (isSnapshotEqual(lastSnapshot, snapshot)) {
      return;
    }

    state.past.push(snapshot);
    if (state.past.length > this.maxSize) {
      state.past.shift();
    }

    // New action invalidates redo future
    state.future = [];
  }

  /**
   * Reverts to the previous snapshot.
   * Returns the restored ProjectDocument, or null if undo is impossible.
   */
  public undo(currentDoc: ProjectDocument): ProjectDocument | null {
    const state = this.histories.get(currentDoc.project.id);
    if (!state || state.past.length === 0) return null;

    const previousSnapshot = state.past.pop()!;
    const currentSnapshot = createHistorySnapshot(currentDoc);
    state.future.push(currentSnapshot);
    if (state.future.length > this.maxSize) {
      state.future.shift();
    }

    return applyHistorySnapshot(currentDoc, previousSnapshot);
  }

  /**
   * Re-applies the next snapshot from future.
   * Returns the restored ProjectDocument, or null if redo is impossible.
   */
  public redo(currentDoc: ProjectDocument): ProjectDocument | null {
    const state = this.histories.get(currentDoc.project.id);
    if (!state || state.future.length === 0) return null;

    const nextSnapshot = state.future.pop()!;
    const currentSnapshot = createHistorySnapshot(currentDoc);
    state.past.push(currentSnapshot);
    if (state.past.length > this.maxSize) {
      state.past.shift();
    }

    return applyHistorySnapshot(currentDoc, nextSnapshot);
  }

  public canUndo(projectId: string): boolean {
    const state = this.histories.get(projectId);
    return Boolean(state && state.past.length > 0);
  }

  public canRedo(projectId: string): boolean {
    const state = this.histories.get(projectId);
    return Boolean(state && state.future.length > 0);
  }

  public getUndoCount(projectId: string): number {
    return this.histories.get(projectId)?.past.length ?? 0;
  }

  public getRedoCount(projectId: string): number {
    return this.histories.get(projectId)?.future.length ?? 0;
  }

  public clearProject(projectId: string): void {
    this.histories.delete(projectId);
  }

  public clearAll(): void {
    this.histories.clear();
  }
}
