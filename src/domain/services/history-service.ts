import {
  ProjectDocument,
  ProjectSnapshot,
  SnapshotMetadata,
} from '../models/types';

export interface VersionDiff {
  nodeAdditions: string[];
  nodeDeletions: string[];
  nodeModifications: {
    nodeId: string;
    text: string;
    changes: string[];
  }[];
  edgeAdditions: string[];
  edgeDeletions: string[];
  statusChanges: {
    nodeId: string;
    text: string;
    fromStatus: string;
    toStatus: string;
  }[];
}

export class HistoryService {
  /**
   * Creates an immutable snapshot from the current project document state.
   */
  public static createSnapshot(
    doc: ProjectDocument,
    message?: string
  ): { snapshot: ProjectSnapshot; metadata: SnapshotMetadata } {
    const timestamp = new Date().toISOString();
    const snapshotId = `snap_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const snapshot: ProjectSnapshot = {
      id: snapshotId,
      projectId: doc.project.id,
      message: message || `Snapshot at ${new Date().toLocaleTimeString()}`,
      timestamp,
      document: JSON.parse(JSON.stringify(doc)), // Deep clone for immutability
    };

    const metadata: SnapshotMetadata = {
      id: snapshotId,
      projectId: doc.project.id,
      message: snapshot.message,
      timestamp,
      nodeCount: doc.nodes.length,
      edgeCount: doc.edges.length,
    };

    return { snapshot, metadata };
  }

  /**
   * Computes a structured difference between an older version and a newer version.
   */
  public static diffSnapshots(
    oldDoc: ProjectDocument,
    newDoc: ProjectDocument
  ): VersionDiff {
    const oldNodeMap = new Map(oldDoc.nodes.map((n) => [n.id, n]));
    const newNodeMap = new Map(newDoc.nodes.map((n) => [n.id, n]));

    const nodeAdditions: string[] = [];
    const nodeDeletions: string[] = [];
    const nodeModifications: VersionDiff['nodeModifications'] = [];
    const statusChanges: VersionDiff['statusChanges'] = [];

    // Check additions and modifications
    for (const [newId, newNode] of newNodeMap.entries()) {
      const oldNode = oldNodeMap.get(newId);
      if (!oldNode) {
        nodeAdditions.push(newNode.text);
      } else {
        const changes: string[] = [];
        if (oldNode.text !== newNode.text) {
          changes.push(`Renamed from "${oldNode.text}" to "${newNode.text}"`);
        }
        if (oldNode.dueDate !== newNode.dueDate) {
          changes.push(`Due date moved from ${oldNode.dueDate} to ${newNode.dueDate}`);
        }
        if (oldNode.status !== newNode.status) {
          statusChanges.push({
            nodeId: newNode.id,
            text: newNode.text,
            fromStatus: oldNode.status,
            toStatus: newNode.status,
          });
        }
        if (changes.length > 0) {
          nodeModifications.push({
            nodeId: newNode.id,
            text: newNode.text,
            changes,
          });
        }
      }
    }

    // Check deletions
    for (const [oldId, oldNode] of oldNodeMap.entries()) {
      if (!newNodeMap.has(oldId)) {
        nodeDeletions.push(oldNode.text);
      }
    }

    // Edge diffs
    const oldEdgeKeys = new Set(oldDoc.edges.map((e) => `${e.fromNodeId}->${e.toNodeId}`));
    const newEdgeKeys = new Set(newDoc.edges.map((e) => `${e.fromNodeId}->${e.toNodeId}`));

    const edgeAdditions = Array.from(newEdgeKeys).filter((k) => !oldEdgeKeys.has(k));
    const edgeDeletions = Array.from(oldEdgeKeys).filter((k) => !newEdgeKeys.has(k));

    return {
      nodeAdditions,
      nodeDeletions,
      nodeModifications,
      edgeAdditions,
      edgeDeletions,
      statusChanges,
    };
  }

  /**
   * Prepares a restoration document from a historical snapshot, updating timestamp while preserving graph structure.
   */
  public static restoreFromSnapshot(
    snapshot: ProjectSnapshot
  ): ProjectDocument {
    const restoredDoc = JSON.parse(JSON.stringify(snapshot.document)) as ProjectDocument;
    const now = new Date().toISOString();

    return {
      ...restoredDoc,
      exportedAt: now,
      project: {
        ...restoredDoc.project,
        updatedAt: now,
      },
    };
  }
}
