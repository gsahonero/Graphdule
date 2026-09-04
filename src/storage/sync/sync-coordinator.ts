import { ProjectDocument, StandaloneTask, UserPreferences } from '../../domain/models/types';
import { IStorageProvider, CloudSyncStatus, CloudUserInfo } from '../base/storage-provider';
import { GDriveAuth } from '../gdrive/gdrive-auth';
import { GDriveClient } from '../gdrive/gdrive-client';
import { OneDriveAuth } from '../onedrive/onedrive-auth';
import { OneDriveClient } from '../onedrive/onedrive-client';

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

    // Identify project files in cloud (named project_{id}.json)
    const cloudProjectFiles = cloudFiles.filter((f) => f.name.startsWith('project_') && f.name.endsWith('.json'));
    const cloudProjectIds = new Set<string>();

    for (const cf of cloudProjectFiles) {
      const projectId = cf.name.replace('project_', '').replace('.json', '');
      cloudProjectIds.add(projectId);

      const cloudDoc = await GDriveClient.downloadJson<ProjectDocument>(cf.id);
      if (!cloudDoc || !cloudDoc.project) continue;

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

    // Projects that exist locally but not yet on cloud -> upload to cloud
    for (const [id, localDoc] of localProjectDocs.entries()) {
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
      const mergedPrefs: UserPreferences = {
        ...cloudPrefs,
        ...localPrefs,
      };
      await localProvider.writePreferences(mergedPrefs);
    } else {
      await GDriveClient.uploadJson('preferences.json', localPrefs, folderId);
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

    const cloudProjectFiles = cloudFiles.filter((f) => f.name.startsWith('project_') && f.name.endsWith('.json'));
    const cloudProjectIds = new Set<string>();

    for (const cf of cloudProjectFiles) {
      const projectId = cf.name.replace('project_', '').replace('.json', '');
      cloudProjectIds.add(projectId);

      const cloudDoc = await OneDriveClient.downloadJson<ProjectDocument>(cf.name);
      if (!cloudDoc || !cloudDoc.project) continue;

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

    for (const [id, localDoc] of localProjectDocs.entries()) {
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
      const mergedPrefs: UserPreferences = {
        ...cloudPrefs,
        ...localPrefs,
      };
      await localProvider.writePreferences(mergedPrefs);
    } else {
      await OneDriveClient.uploadJson('preferences.json', localPrefs);
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
}
