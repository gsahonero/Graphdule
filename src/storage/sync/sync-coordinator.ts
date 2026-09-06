import {
  ProjectDocument,
  StandaloneTask,
  UserPreferences,
  IdeaSeed,
  ActivityEvent,
} from '../../domain/models/types';
import { IStorageProvider, CloudSyncStatus, CloudUserInfo } from '../base/storage-provider';
import { GDriveAuth } from '../gdrive/gdrive-auth';
import { GDriveClient } from '../gdrive/gdrive-client';
import { OneDriveAuth } from '../onedrive/onedrive-auth';
import { OneDriveClient } from '../onedrive/onedrive-client';
import { DEFAULT_SAMPLE_PROJECT_ID } from '../../config/sample-project';

const LAST_SYNC_KEY = 'graphdule_last_sync_time';
const ACTIVE_CLOUD_PROVIDER_KEY = 'graphdule_active_cloud_provider';

export type ActiveCloudProvider = 'none' | 'google_drive' | 'onedrive';

export interface SyncState {
  provider: ActiveCloudProvider;
  status: CloudSyncStatus;
  user: CloudUserInfo | null;
  lastSyncedAt: string | null;
  error: string | null;
}

export type SyncStateListener = (state: SyncState) => void;

export class SyncCoordinator {
  private static listeners: Set<SyncStateListener> = new Set();
  private static isSyncInProgress = false;

  private static state: SyncState = {
    provider: (localStorage.getItem(ACTIVE_CLOUD_PROVIDER_KEY) as ActiveCloudProvider) || 'none',
    status: 'idle',
    user: null,
    lastSyncedAt: localStorage.getItem(LAST_SYNC_KEY),
    error: null,
  };

  public static getState(): SyncState {
    this.refreshAuthStatus();
    return { ...this.state };
  }

  public static subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((fn) => fn(currentState));
  }

  public static refreshAuthStatus(): void {
    const savedProvider = (localStorage.getItem(ACTIVE_CLOUD_PROVIDER_KEY) as ActiveCloudProvider) || 'none';

    if (savedProvider === 'google_drive' && GDriveAuth.isAuthenticated()) {
      this.state.provider = 'google_drive';
      this.state.user = GDriveAuth.getUser();
    } else if (savedProvider === 'onedrive' && OneDriveAuth.isAuthenticated()) {
      this.state.provider = 'onedrive';
      this.state.user = OneDriveAuth.getUser();
    } else if (savedProvider !== 'none') {
      this.state.provider = 'none';
      this.state.user = null;
      localStorage.setItem(ACTIVE_CLOUD_PROVIDER_KEY, 'none');
    }
  }

  public static async setCloudProvider(provider: ActiveCloudProvider): Promise<void> {
    this.state.provider = provider;
    localStorage.setItem(ACTIVE_CLOUD_PROVIDER_KEY, provider);
    this.refreshAuthStatus();
    this.notifyListeners();
  }

  public static disconnect(): void {
    if (this.state.provider === 'google_drive') {
      GDriveAuth.logout();
    } else if (this.state.provider === 'onedrive') {
      OneDriveAuth.logout();
    }
    this.state.provider = 'none';
    this.state.user = null;
    this.state.status = 'idle';
    this.state.error = null;
    localStorage.setItem(ACTIVE_CLOUD_PROVIDER_KEY, 'none');
    this.notifyListeners();
  }

  /**
   * Main bidirectional sync execution between local IndexedDB and cloud.
   */
  public static async sync(localProvider: IStorageProvider): Promise<{ success: boolean; error?: string }> {
    this.refreshAuthStatus();

    if (this.state.provider === 'none') {
      this.state.status = 'idle';
      this.notifyListeners();
      return { success: true };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.state.status = 'offline';
      this.state.error = 'Device is currently offline.';
      this.notifyListeners();
      return { success: false, error: 'Offline' };
    }

    if (this.isSyncInProgress) {
      return { success: true };
    }

    this.isSyncInProgress = true;
    this.state.status = 'syncing';
    this.state.error = null;
    this.notifyListeners();

    try {
      if (this.state.provider === 'google_drive') {
        await this.syncWithGoogleDrive(localProvider);
      } else if (this.state.provider === 'onedrive') {
        await this.syncWithOneDrive(localProvider);
      }

      const nowIso = new Date().toISOString();
      this.state.lastSyncedAt = nowIso;
      this.state.status = 'synced';
      this.state.error = null;
      localStorage.setItem(LAST_SYNC_KEY, nowIso);
      this.notifyListeners();

      return { success: true };
    } catch (err: any) {
      console.error('Cloud Sync Error:', err);
      this.state.status = 'error';
      this.state.error = err.message || 'Synchronization failed.';
      this.notifyListeners();
      return { success: false, error: this.state.error || undefined };
    } finally {
      this.isSyncInProgress = false;
    }
  }

  // --- Google Drive Sync Implementation ---
  private static async syncWithGoogleDrive(localProvider: IStorageProvider): Promise<void> {
    const folderId = await GDriveClient.getOrCreateAppFolder();
    const cloudFiles = await GDriveClient.listFiles(folderId);

    // 1. Sync Projects
    const localSummaries = await localProvider.listProjects();
    const localProjectDocs = new Map<string, ProjectDocument>();

    for (const sum of localSummaries) {
      const doc = await localProvider.readProject(sum.id);
      if (doc) localProjectDocs.set(doc.project.id, doc);
    }

    // Identify project files in cloud (named project_{id}.json), excluding the default sample project
    const cloudProjectFiles = cloudFiles.filter(
      (f) =>
        f.name.startsWith('project_') &&
        f.name.endsWith('.json') &&
        f.name !== `project_${DEFAULT_SAMPLE_PROJECT_ID}.json`
    );
    const cloudProjectIds = new Set<string>();

    for (const cf of cloudProjectFiles) {
      const projectId = cf.name.replace('project_', '').replace('.json', '');
      if (projectId === DEFAULT_SAMPLE_PROJECT_ID) continue;
      cloudProjectIds.add(projectId);

      const cloudDoc = await GDriveClient.downloadJson<ProjectDocument>(cf.id);
      if (!cloudDoc || !cloudDoc.project || cloudDoc.project.id === DEFAULT_SAMPLE_PROJECT_ID) continue;

      const localDoc = localProjectDocs.get(projectId);
      if (!localDoc) {
        // Exists in cloud but not locally -> download to local IndexedDB
        await localProvider.writeProject(cloudDoc);
      } else {
        // Exists in both -> compare timestamps
        const localTime = new Date(localDoc.project.updatedAt || localDoc.exportedAt || 0).getTime();
        const cloudTime = new Date(cloudDoc.project.updatedAt || cloudDoc.exportedAt || 0).getTime();

        if (cloudTime > localTime) {
          // Cloud is newer
          await localProvider.writeProject(cloudDoc);
        } else if (localTime > cloudTime) {
          // Local is newer -> upload to cloud
          await GDriveClient.uploadJson(cf.name, localDoc, folderId);
        }
      }
    }

    // When importing projects through synchronization, remove the by-default sample project if present locally
    if (cloudProjectFiles.length > 0 && localProjectDocs.has(DEFAULT_SAMPLE_PROJECT_ID)) {
      await localProvider.deleteProject(DEFAULT_SAMPLE_PROJECT_ID);
      try {
        localStorage.setItem('graphdule_sample_deleted', 'true');
      } catch {
        // ignore
      }
    }

    // Projects that exist locally but not yet on cloud -> upload to cloud (excluding by-default sample project)
    for (const [id, localDoc] of localProjectDocs.entries()) {
      if (id === DEFAULT_SAMPLE_PROJECT_ID) continue;
      if (!cloudProjectIds.has(id)) {
        await GDriveClient.uploadJson(`project_${id}.json`, localDoc, folderId);
      }
    }

    // 2. Sync Standalone Tasks
    const localTasks = await localProvider.readStandaloneTasks();
    const cloudTasksFile = await GDriveClient.findFileByName('standalone_tasks.json', folderId);

    if (cloudTasksFile) {
      const cloudTasks = (await GDriveClient.downloadJson<StandaloneTask[]>(cloudTasksFile.id)) || [];
      const mergedTasks = this.mergeStandaloneTasks(localTasks, cloudTasks);
      await localProvider.writeStandaloneTasks(mergedTasks);
      await GDriveClient.uploadJson('standalone_tasks.json', mergedTasks, folderId);
    } else {
      await GDriveClient.uploadJson('standalone_tasks.json', localTasks, folderId);
    }

    // 3. Sync Preferences
    const localPrefs = await localProvider.readPreferences();
    const cloudPrefsFile = await GDriveClient.findFileByName('preferences.json', folderId);

    if (cloudPrefsFile) {
      const cloudPrefs = (await GDriveClient.downloadJson<UserPreferences>(cloudPrefsFile.id)) || localPrefs;
      const mergedPrefs = this.mergePreferences(localPrefs, cloudPrefs);
      await localProvider.writePreferences(mergedPrefs);
      await GDriveClient.uploadJson('preferences.json', mergedPrefs, folderId);
    } else {
      await GDriveClient.uploadJson('preferences.json', localPrefs, folderId);
    }

    // 4. Sync Idea Seeds
    if (localProvider.readIdeaSeeds && localProvider.writeIdeaSeeds) {
      const localSeeds = await localProvider.readIdeaSeeds();
      const cloudSeedsFile = await GDriveClient.findFileByName('idea_seeds.json', folderId);

      if (cloudSeedsFile) {
        const cloudSeeds = (await GDriveClient.downloadJson<IdeaSeed[]>(cloudSeedsFile.id)) || [];
        const mergedSeeds = this.mergeIdeaSeeds(localSeeds, cloudSeeds);
        await localProvider.writeIdeaSeeds(mergedSeeds);
        await GDriveClient.uploadJson('idea_seeds.json', mergedSeeds, folderId);
      } else if (localSeeds.length > 0) {
        await GDriveClient.uploadJson('idea_seeds.json', localSeeds, folderId);
      }
    }

    // 5. Sync Activity Log
    if (localProvider.readActivityLog && localProvider.appendActivityEvents) {
      const localLog = await localProvider.readActivityLog();
      const cloudLogFile = await GDriveClient.findFileByName('activity_log.json', folderId);

      if (cloudLogFile) {
        const cloudLog = (await GDriveClient.downloadJson<ActivityEvent[]>(cloudLogFile.id)) || [];
        const mergedLog = this.mergeActivityLogs(localLog, cloudLog);
        const localIds = new Set(localLog.map((e) => e.id));
        const newToLocal = mergedLog.filter((e) => !localIds.has(e.id));
        if (newToLocal.length > 0) {
          await localProvider.appendActivityEvents(newToLocal);
        }
        await GDriveClient.uploadJson('activity_log.json', mergedLog, folderId);
      } else if (localLog.length > 0) {
        await GDriveClient.uploadJson('activity_log.json', localLog, folderId);
      }
    }
  }

  // --- Microsoft OneDrive Sync Implementation ---
  private static async syncWithOneDrive(localProvider: IStorageProvider): Promise<void> {
    const cloudFiles = await OneDriveClient.listFiles();

    // 1. Sync Projects
    const localSummaries = await localProvider.listProjects();
    const localProjectDocs = new Map<string, ProjectDocument>();

    for (const sum of localSummaries) {
      const doc = await localProvider.readProject(sum.id);
      if (doc) localProjectDocs.set(doc.project.id, doc);
    }

    // Identify project files in cloud (named project_{id}.json), excluding the default sample project
    const cloudProjectFiles = cloudFiles.filter(
      (f) =>
        f.name.startsWith('project_') &&
        f.name.endsWith('.json') &&
        f.name !== `project_${DEFAULT_SAMPLE_PROJECT_ID}.json`
    );
    const cloudProjectIds = new Set<string>();

    for (const cf of cloudProjectFiles) {
      const projectId = cf.name.replace('project_', '').replace('.json', '');
      if (projectId === DEFAULT_SAMPLE_PROJECT_ID) continue;
      cloudProjectIds.add(projectId);

      const cloudDoc = await OneDriveClient.downloadJson<ProjectDocument>(cf.name);
      if (!cloudDoc || !cloudDoc.project || cloudDoc.project.id === DEFAULT_SAMPLE_PROJECT_ID) continue;

      const localDoc = localProjectDocs.get(projectId);
      if (!localDoc) {
        await localProvider.writeProject(cloudDoc);
      } else {
        const localTime = new Date(localDoc.project.updatedAt || localDoc.exportedAt || 0).getTime();
        const cloudTime = new Date(cloudDoc.project.updatedAt || cloudDoc.exportedAt || 0).getTime();

        if (cloudTime > localTime) {
          await localProvider.writeProject(cloudDoc);
        } else if (localTime > cloudTime) {
          await OneDriveClient.uploadJson(cf.name, localDoc);
        }
      }
    }

    // When importing projects through synchronization, remove the by-default sample project if present locally
    if (cloudProjectFiles.length > 0 && localProjectDocs.has(DEFAULT_SAMPLE_PROJECT_ID)) {
      await localProvider.deleteProject(DEFAULT_SAMPLE_PROJECT_ID);
      try {
        localStorage.setItem('graphdule_sample_deleted', 'true');
      } catch {
        // ignore
      }
    }

    // Projects that exist locally but not yet on cloud -> upload to cloud (excluding by-default sample project)
    for (const [id, localDoc] of localProjectDocs.entries()) {
      if (id === DEFAULT_SAMPLE_PROJECT_ID) continue;
      if (!cloudProjectIds.has(id)) {
        await OneDriveClient.uploadJson(`project_${id}.json`, localDoc);
      }
    }

    // 2. Sync Standalone Tasks
    const localTasks = await localProvider.readStandaloneTasks();
    const cloudTasks = await OneDriveClient.downloadJson<StandaloneTask[]>('standalone_tasks.json');

    if (cloudTasks) {
      const mergedTasks = this.mergeStandaloneTasks(localTasks, cloudTasks);
      await localProvider.writeStandaloneTasks(mergedTasks);
      await OneDriveClient.uploadJson('standalone_tasks.json', mergedTasks);
    } else {
      await OneDriveClient.uploadJson('standalone_tasks.json', localTasks);
    }

    // 3. Sync Preferences
    const localPrefs = await localProvider.readPreferences();
    const cloudPrefs = await OneDriveClient.downloadJson<UserPreferences>('preferences.json');

    if (cloudPrefs) {
      const mergedPrefs = this.mergePreferences(localPrefs, cloudPrefs);
      await localProvider.writePreferences(mergedPrefs);
      await OneDriveClient.uploadJson('preferences.json', mergedPrefs);
    } else {
      await OneDriveClient.uploadJson('preferences.json', localPrefs);
    }

    // 4. Sync Idea Seeds
    if (localProvider.readIdeaSeeds && localProvider.writeIdeaSeeds) {
      const localSeeds = await localProvider.readIdeaSeeds();
      const cloudSeeds = await OneDriveClient.downloadJson<IdeaSeed[]>('idea_seeds.json');

      if (cloudSeeds) {
        const mergedSeeds = this.mergeIdeaSeeds(localSeeds, cloudSeeds);
        await localProvider.writeIdeaSeeds(mergedSeeds);
        await OneDriveClient.uploadJson('idea_seeds.json', mergedSeeds);
      } else if (localSeeds.length > 0) {
        await OneDriveClient.uploadJson('idea_seeds.json', localSeeds);
      }
    }

    // 5. Sync Activity Log
    if (localProvider.readActivityLog && localProvider.appendActivityEvents) {
      const localLog = await localProvider.readActivityLog();
      const cloudLog = await OneDriveClient.downloadJson<ActivityEvent[]>('activity_log.json');

      if (cloudLog) {
        const mergedLog = this.mergeActivityLogs(localLog, cloudLog);
        const localIds = new Set(localLog.map((e) => e.id));
        const newToLocal = mergedLog.filter((e) => !localIds.has(e.id));
        if (newToLocal.length > 0) {
          await localProvider.appendActivityEvents(newToLocal);
        }
        await OneDriveClient.uploadJson('activity_log.json', mergedLog);
      } else if (localLog.length > 0) {
        await OneDriveClient.uploadJson('activity_log.json', localLog);
      }
    }
  }

  /**
   * Intelligently merges local and cloud standalone tasks by ID and updatedAt timestamp.
   */
  public static mergeStandaloneTasks(local: StandaloneTask[], cloud: StandaloneTask[]): StandaloneTask[] {
    const taskMap = new Map<string, StandaloneTask>();

    for (const t of local) {
      taskMap.set(t.id, t);
    }

    for (const ct of cloud) {
      const existing = taskMap.get(ct.id);
      if (!existing) {
        taskMap.set(ct.id, ct);
      } else {
        const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const cloudTime = new Date(ct.updatedAt || ct.createdAt || 0).getTime();
        if (cloudTime >= localTime) {
          taskMap.set(ct.id, ct);
        }
      }
    }

    return Array.from(taskMap.values());
  }

  /**
   * Intelligently merges local and cloud idea seeds by ID and updatedAt timestamp.
   */
  public static mergeIdeaSeeds(local: IdeaSeed[], cloud: IdeaSeed[]): IdeaSeed[] {
    const seedMap = new Map<string, IdeaSeed>();

    for (const s of local) {
      seedMap.set(s.id, s);
    }

    for (const cs of cloud) {
      const existing = seedMap.get(cs.id);
      if (!existing) {
        seedMap.set(cs.id, cs);
      } else {
        const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const cloudTime = new Date(cs.updatedAt || cs.createdAt || 0).getTime();
        if (cloudTime >= localTime) {
          seedMap.set(cs.id, cs);
        }
      }
    }

    return Array.from(seedMap.values());
  }

  /**
   * Merges local and cloud activity telemetry log events idempotently by UUID, sorted by timestamp.
   */
  public static mergeActivityLogs(local: ActivityEvent[], cloud: ActivityEvent[]): ActivityEvent[] {
    const eventMap = new Map<string, ActivityEvent>();

    for (const ev of local) {
      eventMap.set(ev.id, ev);
    }

    for (const ev of cloud) {
      if (!eventMap.has(ev.id)) {
        eventMap.set(ev.id, ev);
      }
    }

    return Array.from(eventMap.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Merges user preferences, preserving the newer last active node timestamp.
   */
  public static mergePreferences(local: UserPreferences, cloud: UserPreferences): UserPreferences {
    const localTime = new Date(local.lastActiveTimestamp || 0).getTime();
    const cloudTime = new Date(cloud.lastActiveTimestamp || 0).getTime();

    const activeNodePrefs =
      cloudTime > localTime
        ? {
            lastActiveNodeId: cloud.lastActiveNodeId,
            lastActiveProjectId: cloud.lastActiveProjectId,
            lastActiveTimestamp: cloud.lastActiveTimestamp,
          }
        : {
            lastActiveNodeId: local.lastActiveNodeId || cloud.lastActiveNodeId,
            lastActiveProjectId: local.lastActiveProjectId || cloud.lastActiveProjectId,
            lastActiveTimestamp: local.lastActiveTimestamp || cloud.lastActiveTimestamp,
          };

    return {
      ...cloud,
      ...local,
      ...activeNodePrefs,
    };
  }
}
