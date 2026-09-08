import { openDB, IDBPDatabase } from 'idb';
import { IStorageProvider, StorageProviderInfo } from '../base/storage-provider';
import {
  ProjectDocument,
  ProjectSnapshot,
  SnapshotMetadata,
  StandaloneTask,
  UserPreferences,
  ProjectSummary,
  IdeaSeed,
  ActivityEvent,
  WeeklyAttentionReviewRecord,
} from '../../domain/models/types';
import { ProjectService } from '../../domain/services/project-service';

const DB_NAME = 'graphdule_db';
const DB_VERSION = 3;

export class IndexedDBProvider implements IStorageProvider {
  private db: IDBPDatabase | null = null;

  public readonly info: StorageProviderInfo = {
    id: 'browser',
    name: 'Browser Local Storage (IndexedDB)',
    isConnected: true,
    isLocalOnly: true,
    statusMessage: 'Stored locally in browser',
  };

  public async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'project.id' });
        }
        if (!db.objectStoreNames.contains('standalone_tasks')) {
          db.createObjectStore('standalone_tasks');
        }
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences');
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapshotStore.createIndex('by_project', 'projectId');
        }
        if (!db.objectStoreNames.contains('idea_seeds')) {
          db.createObjectStore('idea_seeds', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('activity_log')) {
          db.createObjectStore('activity_log', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('attention_reviews')) {
          const reviewStore = db.createObjectStore('attention_reviews', { keyPath: 'id' });
          reviewStore.createIndex('by_week', 'weekStartDate');
        }
      },
    });
  }

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  public async listProjects(): Promise<ProjectSummary[]> {
    const db = await this.getDB();
    const allDocs: ProjectDocument[] = await db.getAll('projects');
    return allDocs.map((doc) => ProjectService.getProjectSummary(doc.project, doc.nodes));
  }

  public async readProject(projectId: string): Promise<ProjectDocument | null> {
    const db = await this.getDB();
    const doc = await db.get('projects', projectId);
    return doc || null;
  }

  public async writeProject(projectDoc: ProjectDocument): Promise<void> {
    const db = await this.getDB();
    await db.put('projects', projectDoc);
  }

  public async deleteProject(projectId: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('projects', projectId);

    // Also delete associated snapshots
    const tx = db.transaction('snapshots', 'readwrite');
    const index = tx.store.index('by_project');
    let cursor = await index.openCursor(projectId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  public async readStandaloneTasks(): Promise<StandaloneTask[]> {
    const db = await this.getDB();
    const tasks = await db.get('standalone_tasks', 'current');
    return tasks || [];
  }

  public async writeStandaloneTasks(tasks: StandaloneTask[]): Promise<void> {
    const db = await this.getDB();
    await db.put('standalone_tasks', tasks, 'current');
  }

  public async readPreferences(): Promise<UserPreferences> {
    const db = await this.getDB();
    const prefs = await db.get('preferences', 'current');
    return (
      prefs || {
        myDayMode: 'today',
        theme: 'dark',
        onboardingCompleted: false,
        preferredStorageProvider: 'browser',
      }
    );
  }

  public async writePreferences(prefs: UserPreferences): Promise<void> {
    const db = await this.getDB();
    await db.put('preferences', prefs, 'current');
  }

  public async listSnapshots(projectId: string): Promise<SnapshotMetadata[]> {
    const db = await this.getDB();
    const index = db.transaction('snapshots').store.index('by_project');
    const snapshots: ProjectSnapshot[] = await index.getAll(projectId);

    return snapshots
      .map((s) => ({
        id: s.id,
        projectId: s.projectId,
        message: s.message,
        timestamp: s.timestamp,
        nodeCount: s.document.nodes.length,
        edgeCount: s.document.edges.length,
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public async readSnapshot(
    _projectId: string,
    snapshotId: string
  ): Promise<ProjectSnapshot | null> {
    const db = await this.getDB();
    const snap = await db.get('snapshots', snapshotId);
    return snap || null;
  }

  public async writeSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    const db = await this.getDB();
    await db.put('snapshots', snapshot);
  }

  public async readIdeaSeeds(): Promise<IdeaSeed[]> {
    const db = await this.getDB();
    const seeds: IdeaSeed[] = await db.getAll('idea_seeds');
    return seeds.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async writeIdeaSeeds(seeds: IdeaSeed[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('idea_seeds', 'readwrite');
    await tx.store.clear();
    for (const s of seeds) {
      await tx.store.put(s);
    }
    await tx.done;
  }

  public async deleteIdeaSeed(seedId: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('idea_seeds', seedId);
  }

  public async readActivityLog(): Promise<ActivityEvent[]> {
    const db = await this.getDB();
    const events: ActivityEvent[] = await db.getAll('activity_log');
    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  public async appendActivityEvents(events: ActivityEvent[]): Promise<void> {
    if (events.length === 0) return;
    const db = await this.getDB();
    const tx = db.transaction('activity_log', 'readwrite');
    for (const e of events) {
      await tx.store.put(e);
    }
    await tx.done;
  }

  public async deleteActivityEvents(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const db = await this.getDB();
    const tx = db.transaction('activity_log', 'readwrite');
    for (const id of eventIds) {
      await tx.store.delete(id);
    }
    await tx.done;
  }

  public async updateActivityEvent(event: ActivityEvent): Promise<void> {
    const db = await this.getDB();
    await db.put('activity_log', event);
  }

  public async clearActivityLog(): Promise<void> {
    const db = await this.getDB();
    await db.clear('activity_log');
  }

  public async readAttentionReviews(): Promise<WeeklyAttentionReviewRecord[]> {
    const db = await this.getDB();
    const reviews: WeeklyAttentionReviewRecord[] = await db.getAll('attention_reviews');
    return reviews.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }

  public async writeAttentionReviews(reviews: WeeklyAttentionReviewRecord[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('attention_reviews', 'readwrite');
    for (const r of reviews) {
      await tx.store.put(r);
    }
    await tx.done;
  }

  public async deleteAttentionReview(reviewId: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('attention_reviews', reviewId);
  }
}
