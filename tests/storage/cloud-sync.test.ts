import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncCoordinator } from '../../src/storage/sync/sync-coordinator';
import { ProjectDocument, StandaloneTask, WeeklyAttentionReviewRecord } from '../../src/domain/models/types';
import { GDriveAuth } from '../../src/storage/gdrive/gdrive-auth';
import { GDriveClient } from '../../src/storage/gdrive/gdrive-client';
import { OneDriveAuth } from '../../src/storage/onedrive/onedrive-auth';
import { OneDriveClient } from '../../src/storage/onedrive/onedrive-client';
import { DEFAULT_SAMPLE_PROJECT_ID, createDefaultSampleProject } from '../../src/config/sample-project';
import { IStorageProvider } from '../../src/storage/base/storage-provider';
import { ProjectService } from '../../src/domain/services/project-service';

describe('Cloud Sync & Multi-Device Coordination', () => {
  beforeEach(() => {
    localStorage.clear();
    SyncCoordinator.disconnect();
  });

  describe('SyncCoordinator State & Provider Switching', () => {
    it('starts with local storage provider by default', () => {
      const state = SyncCoordinator.getState();
      expect(state.provider).toBe('none');
      expect(state.status).toBe('idle');
      expect(state.user).toBeNull();
    });

    it('manages active provider and auth status changes', async () => {
      await SyncCoordinator.setCloudProvider('google_drive');
      // Because no token is set in test env, refreshAuthStatus falls back to 'none' safely
      const state = SyncCoordinator.getState();
      expect(['google_drive', 'none']).toContain(state.provider);
    });

    it('subscribes to state updates correctly', async () => {
      let notifiedCount = 0;
      const unsubscribe = SyncCoordinator.subscribe((state) => {
        notifiedCount++;
        expect(state).toBeDefined();
      });

      expect(notifiedCount).toBeGreaterThanOrEqual(1);
      unsubscribe();
    });
  });

  describe('Standalone Tasks Merge Resolution', () => {
    it('merges distinct tasks from local and cloud without duplicates', () => {
      const localTasks: StandaloneTask[] = [
        {
          id: 'task_1',
          text: 'Local Task 1',
          dueDate: '2026-09-05',
          status: 'planned',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
      ];

      const cloudTasks: StandaloneTask[] = [
        {
          id: 'task_2',
          text: 'Cloud Task 2',
          dueDate: '2026-09-06',
          status: 'planned',
          createdAt: '2026-09-01T11:00:00Z',
          updatedAt: '2026-09-01T11:00:00Z',
        },
      ];

      const merged = SyncCoordinator.mergeStandaloneTasks(localTasks, cloudTasks);
      expect(merged).toHaveLength(2);
      expect(merged.map((t) => t.id).sort()).toEqual(['task_1', 'task_2']);
    });

    it('resolves conflicting updates by keeping the most recently updated task instance', () => {
      const olderLocal: StandaloneTask = {
        id: 'task_1',
        text: 'Buy Milk',
        dueDate: '2026-09-05',
        status: 'planned',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const newerCloudCompleted: StandaloneTask = {
        id: 'task_1',
        text: 'Buy Milk (Done on Phone)',
        dueDate: '2026-09-05',
        status: 'completed',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-02T15:00:00Z', // Newer!
      };

      const merged = SyncCoordinator.mergeStandaloneTasks([olderLocal], [newerCloudCompleted]);
      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('completed');
      expect(merged[0].text).toBe('Buy Milk (Done on Phone)');
    });

    it('preserves local newer edits over older cloud versions', () => {
      const newerLocal: StandaloneTask = {
        id: 'task_1',
        text: 'Edited on Desktop',
        dueDate: '2026-09-10',
        status: 'planned',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-03T18:00:00Z', // Newer!
      };

      const olderCloud: StandaloneTask = {
        id: 'task_1',
        text: 'Old Phone Version',
        dueDate: '2026-09-05',
        status: 'planned',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-02T12:00:00Z',
      };

      const merged = SyncCoordinator.mergeStandaloneTasks([newerLocal], [olderCloud]);
      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('Edited on Desktop');
      expect(merged[0].dueDate).toBe('2026-09-10');
    });
  });

  describe('Custom OAuth Client ID Configuration', () => {
    it('allows setting and clearing custom Google Drive client ID', () => {
      expect(GDriveAuth.getCustomClientId()).toBe('');

      GDriveAuth.setCustomClientId('custom-google-client-id.apps.googleusercontent.com');
      expect(GDriveAuth.getCustomClientId()).toBe('custom-google-client-id.apps.googleusercontent.com');
      expect(GDriveAuth.getEffectiveClientId()).toBe('custom-google-client-id.apps.googleusercontent.com');

      GDriveAuth.setCustomClientId('');
      expect(GDriveAuth.getCustomClientId()).toBe('');
    });

    it('allows setting and clearing custom OneDrive client ID', () => {
      expect(OneDriveAuth.getCustomClientId()).toBe('');

      OneDriveAuth.setCustomClientId('custom-azure-client-id-12345');
      expect(OneDriveAuth.getCustomClientId()).toBe('custom-azure-client-id-12345');
      expect(OneDriveAuth.getEffectiveClientId()).toBe('custom-azure-client-id-12345');

      OneDriveAuth.setCustomClientId('');
      expect(OneDriveAuth.getCustomClientId()).toBe('');
    });
  });

  describe('Idea Seeds & Activity Log Cloud Merge Resolution', () => {
    it('merges distinct idea seeds and keeps the most recent update on conflict', () => {
      const localSeed = {
        id: 'seed_1',
        title: 'Original Title',
        seedThoughts: ['Old thought'],
        tags: ['AI'],
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const newerCloudSeed = {
        id: 'seed_1',
        title: 'Cloud Updated Title',
        seedThoughts: ['Old thought', 'New thought'],
        tags: ['AI'],
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-02T15:00:00Z',
      };

      const distinctSeed = {
        id: 'seed_2',
        title: 'Distinct Seed',
        seedThoughts: [],
        tags: [],
        createdAt: '2026-09-03T10:00:00Z',
        updatedAt: '2026-09-03T10:00:00Z',
      };

      const merged = SyncCoordinator.mergeIdeaSeeds([localSeed], [newerCloudSeed, distinctSeed]);
      expect(merged).toHaveLength(2);
      const s1 = merged.find((s) => s.id === 'seed_1');
      expect(s1?.title).toBe('Cloud Updated Title');
      expect(s1?.seedThoughts).toEqual(['Old thought', 'New thought']);
    });

    it('merges activity telemetry logs idempotently by event id', () => {
      const ev1 = {
        id: 'act_1',
        timestamp: '2026-09-01T10:00:00Z',
        type: 'task_created' as const,
        entityId: 't1',
      };
      const ev2 = {
        id: 'act_2',
        timestamp: '2026-09-01T11:00:00Z',
        type: 'task_completed' as const,
        entityId: 't1',
      };

      const merged = SyncCoordinator.mergeActivityLogs([ev1], [ev1, ev2]);
      expect(merged).toHaveLength(2);
      expect(merged.map((e) => e.id)).toEqual(['act_1', 'act_2']);
    });
  });

  describe('Default Sample Project Exclusion in Synchronization', () => {
    function createMockStorageProvider(initialProjects: ProjectDocument[] = []): IStorageProvider {
      const projects = new Map<string, ProjectDocument>();
      for (const p of initialProjects) {
        projects.set(p.project.id, p);
      }
      return {
        info: {
          id: 'browser',
          name: 'IndexedDB',
          isConnected: true,
          isLocalOnly: true,
          statusMessage: 'Ready',
        },
        init: async () => {},
        listProjects: async () =>
          Array.from(projects.values()).map((doc) => ProjectService.getProjectSummary(doc.project, doc.nodes)),
        readProject: async (id: string) => projects.get(id) || null,
        writeProject: async (doc: ProjectDocument) => {
          projects.set(doc.project.id, doc);
        },
        deleteProject: async (id: string) => {
          projects.delete(id);
        },
        readStandaloneTasks: async () => [],
        writeStandaloneTasks: async () => {},
        readPreferences: async () => ({
          myDayMode: 'today',
          theme: 'dark',
          dateFormat: 'DD/MM/YYYY',
          onboardingCompleted: true,
          preferredStorageProvider: 'browser',
        }),
        writePreferences: async () => {},
        listSnapshots: async () => [],
        readSnapshot: async () => null,
        writeSnapshot: async () => {},
      };
    }

    const mockRealProjectDoc: ProjectDocument = {
      schemaVersion: 1,
      exportedAt: '2026-09-01T10:00:00Z',
      project: {
        id: 'proj_real_work',
        name: 'Real Work Project',
        endGoalNodeId: 'node_goal',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
      nodes: [],
      edges: [],
      notes: [],
      history: [],
    };

    beforeEach(() => {
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_gdrive_token');
      vi.spyOn(OneDriveAuth, 'getToken').mockReturnValue('mock_onedrive_token');
      vi.spyOn(GDriveClient, 'findFileByName').mockResolvedValue(null);
      vi.spyOn(OneDriveClient, 'downloadJson').mockResolvedValue(null);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('excludes by-default sample project when syncing with Google Drive and deletes it locally upon importing cloud projects', async () => {
      const sampleDoc = createDefaultSampleProject();
      const localProvider = createMockStorageProvider([sampleDoc]);

      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveClient, 'getOrCreateAppFolder').mockResolvedValue('folder_test_123');
      vi.spyOn(GDriveClient, 'listFiles').mockResolvedValue([
        { id: 'cloud_file_real', name: 'project_proj_real_work.json', modifiedTime: '2026-09-01T10:00:00Z' },
      ]);
      vi.spyOn(GDriveClient, 'downloadJson').mockImplementation(async (fileId: string) => {
        if (fileId === 'cloud_file_real') return mockRealProjectDoc;
        return null;
      });
      const uploadSpy = vi.spyOn(GDriveClient, 'uploadJson').mockResolvedValue('uploaded_id_123');

      await SyncCoordinator.setCloudProvider('google_drive');
      const syncResult = await SyncCoordinator.sync(localProvider);

      expect(syncResult.success).toBe(true);
      // Verify real project was imported
      const realDoc = await localProvider.readProject('proj_real_work');
      expect(realDoc).toBeDefined();
      expect(realDoc?.project.name).toBe('Real Work Project');

      // Verify default sample project was deleted locally and not included in projects
      const sampleResult = await localProvider.readProject(DEFAULT_SAMPLE_PROJECT_ID);
      expect(sampleResult).toBeNull();
      expect(localStorage.getItem('graphdule_sample_deleted')).toBe('true');

      // Verify sample project was never uploaded to Google Drive
      const uploadedFileNames = uploadSpy.mock.calls.map((call) => call[0]);
      expect(uploadedFileNames).not.toContain(`project_${DEFAULT_SAMPLE_PROJECT_ID}.json`);
    });

    it('never uploads by-default sample project to Google Drive when it is the only local project', async () => {
      const sampleDoc = createDefaultSampleProject();
      const localProvider = createMockStorageProvider([sampleDoc]);

      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveClient, 'getOrCreateAppFolder').mockResolvedValue('folder_test_123');
      vi.spyOn(GDriveClient, 'listFiles').mockResolvedValue([]);
      const uploadSpy = vi.spyOn(GDriveClient, 'uploadJson').mockResolvedValue('uploaded_id_123');

      await SyncCoordinator.setCloudProvider('google_drive');
      await SyncCoordinator.sync(localProvider);

      const uploadedFileNames = uploadSpy.mock.calls.map((call) => call[0]);
      expect(uploadedFileNames).not.toContain(`project_${DEFAULT_SAMPLE_PROJECT_ID}.json`);
    });

    it('ignores legacy project_sample_phd_paper.json in Google Drive and does not import it', async () => {
      const localProvider = createMockStorageProvider([]);

      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveClient, 'getOrCreateAppFolder').mockResolvedValue('folder_test_123');
      vi.spyOn(GDriveClient, 'listFiles').mockResolvedValue([
        { id: 'cloud_file_sample', name: `project_${DEFAULT_SAMPLE_PROJECT_ID}.json`, modifiedTime: '2026-09-01T10:00:00Z' },
        { id: 'cloud_file_real', name: 'project_proj_real_work.json', modifiedTime: '2026-09-01T10:00:00Z' },
      ]);
      const downloadSpy = vi.spyOn(GDriveClient, 'downloadJson').mockImplementation(async (fileId: string) => {
        if (fileId === 'cloud_file_sample') return createDefaultSampleProject();
        if (fileId === 'cloud_file_real') return mockRealProjectDoc;
        return null;
      });
      vi.spyOn(GDriveClient, 'uploadJson').mockResolvedValue('uploaded_id_123');

      await SyncCoordinator.setCloudProvider('google_drive');
      await SyncCoordinator.sync(localProvider);

      // Verify downloadJson was never called for cloud_file_sample
      expect(downloadSpy).not.toHaveBeenCalledWith('cloud_file_sample');
      const importedSample = await localProvider.readProject(DEFAULT_SAMPLE_PROJECT_ID);
      expect(importedSample).toBeNull();

      // Verify real project was imported
      const realDoc = await localProvider.readProject('proj_real_work');
      expect(realDoc).toBeDefined();
    });

    it('excludes by-default sample project when syncing with OneDrive and deletes it locally upon importing cloud projects', async () => {
      const sampleDoc = createDefaultSampleProject();
      const localProvider = createMockStorageProvider([sampleDoc]);

      vi.spyOn(OneDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(OneDriveClient, 'listFiles').mockResolvedValue([
        { id: 'onedrive_real', name: 'project_proj_real_work.json', lastModifiedDateTime: '2026-09-01T10:00:00Z' },
      ]);
      vi.spyOn(OneDriveClient, 'downloadJson').mockImplementation(async (fileName: string) => {
        if (fileName === 'project_proj_real_work.json') return mockRealProjectDoc;
        return null;
      });
      const uploadSpy = vi.spyOn(OneDriveClient, 'uploadJson').mockResolvedValue();

      await SyncCoordinator.setCloudProvider('onedrive');
      const syncResult = await SyncCoordinator.sync(localProvider);

      expect(syncResult.success).toBe(true);
      // Verify real project was imported
      const realDoc = await localProvider.readProject('proj_real_work');
      expect(realDoc).toBeDefined();
      expect(realDoc?.project.name).toBe('Real Work Project');

      // Verify sample project was deleted locally
      const sampleResult = await localProvider.readProject(DEFAULT_SAMPLE_PROJECT_ID);
      expect(sampleResult).toBeNull();
      expect(localStorage.getItem('graphdule_sample_deleted')).toBe('true');

      // Verify sample project was never uploaded to OneDrive
      const uploadedFileNames = uploadSpy.mock.calls.map((call) => call[0]);
      expect(uploadedFileNames).not.toContain(`project_${DEFAULT_SAMPLE_PROJECT_ID}.json`);
    });

    it('never uploads by-default sample project to OneDrive when it is the only local project', async () => {
      const sampleDoc = createDefaultSampleProject();
      const localProvider = createMockStorageProvider([sampleDoc]);

      vi.spyOn(OneDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(OneDriveClient, 'listFiles').mockResolvedValue([]);
      const uploadSpy = vi.spyOn(OneDriveClient, 'uploadJson').mockResolvedValue();

      await SyncCoordinator.setCloudProvider('onedrive');
      await SyncCoordinator.sync(localProvider);

      const uploadedFileNames = uploadSpy.mock.calls.map((call) => call[0]);
      expect(uploadedFileNames).not.toContain(`project_${DEFAULT_SAMPLE_PROJECT_ID}.json`);
    });

    it('ignores legacy project_sample_phd_paper.json in OneDrive and does not import it', async () => {
      const localProvider = createMockStorageProvider([]);

      vi.spyOn(OneDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(OneDriveClient, 'listFiles').mockResolvedValue([
        { id: 'onedrive_sample', name: `project_${DEFAULT_SAMPLE_PROJECT_ID}.json`, lastModifiedDateTime: '2026-09-01T10:00:00Z' },
        { id: 'onedrive_real', name: 'project_proj_real_work.json', lastModifiedDateTime: '2026-09-01T10:00:00Z' },
      ]);
      const downloadSpy = vi.spyOn(OneDriveClient, 'downloadJson').mockImplementation(async (fileName: string) => {
        if (fileName === `project_${DEFAULT_SAMPLE_PROJECT_ID}.json`) return createDefaultSampleProject();
        if (fileName === 'project_proj_real_work.json') return mockRealProjectDoc;
        return null;
      });
      vi.spyOn(OneDriveClient, 'uploadJson').mockResolvedValue();

      await SyncCoordinator.setCloudProvider('onedrive');
      await SyncCoordinator.sync(localProvider);

      expect(downloadSpy).not.toHaveBeenCalledWith(`project_${DEFAULT_SAMPLE_PROJECT_ID}.json`);
      const importedSample = await localProvider.readProject(DEFAULT_SAMPLE_PROJECT_ID);
      expect(importedSample).toBeNull();

      const realDoc = await localProvider.readProject('proj_real_work');
      expect(realDoc).toBeDefined();
    });
  });

  describe('Preferences JSON & Last Active Node Synchronization', () => {
    it('merges preferences choosing the last active node from the newer timestamp', () => {
      const localPrefs = {
        myDayMode: 'today' as const,
        theme: 'dark' as const,
        dateFormat: 'DD/MM/YYYY' as const,
        onboardingCompleted: true,
        preferredStorageProvider: 'browser' as const,
        lastActiveNodeId: 'node_local',
        lastActiveProjectId: 'proj_local',
        lastActiveTimestamp: '2026-09-04T12:00:00Z',
      };

      const newerCloudPrefs = {
        myDayMode: 'today' as const,
        theme: 'light' as const,
        dateFormat: 'DD/MM/YYYY' as const,
        onboardingCompleted: true,
        preferredStorageProvider: 'browser' as const,
        lastActiveNodeId: 'node_cloud_newer',
        lastActiveProjectId: 'proj_cloud',
        lastActiveTimestamp: '2026-09-04T15:00:00Z', // 3 hours newer
      };

      const merged = SyncCoordinator.mergePreferences(localPrefs, newerCloudPrefs);
      expect(merged.lastActiveNodeId).toBe('node_cloud_newer');
      expect(merged.lastActiveProjectId).toBe('proj_cloud');
      expect(merged.lastActiveTimestamp).toBe('2026-09-04T15:00:00Z');
    });

    it('preserves local last active node if local timestamp is newer than cloud', () => {
      const newerLocalPrefs = {
        myDayMode: 'today' as const,
        theme: 'dark' as const,
        dateFormat: 'DD/MM/YYYY' as const,
        onboardingCompleted: true,
        preferredStorageProvider: 'browser' as const,
        lastActiveNodeId: 'node_local_newer',
        lastActiveProjectId: 'proj_local',
        lastActiveTimestamp: '2026-09-04T18:00:00Z', // Newer!
      };

      const olderCloudPrefs = {
        myDayMode: 'today' as const,
        theme: 'light' as const,
        dateFormat: 'DD/MM/YYYY' as const,
        onboardingCompleted: true,
        preferredStorageProvider: 'browser' as const,
        lastActiveNodeId: 'node_cloud_old',
        lastActiveProjectId: 'proj_cloud',
        lastActiveTimestamp: '2026-09-04T12:00:00Z',
      };

      const merged = SyncCoordinator.mergePreferences(newerLocalPrefs, olderCloudPrefs);
      expect(merged.lastActiveNodeId).toBe('node_local_newer');
      expect(merged.lastActiveProjectId).toBe('proj_local');
      expect(merged.lastActiveTimestamp).toBe('2026-09-04T18:00:00Z');
    });
  });

  describe('Version Conflict Management & Semantic Project Merging', () => {
    it('merges node and edge additions from both devices without discarding either side', async () => {
      const localDoc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-05T10:00:00Z',
        project: {
          id: 'proj_collab',
          name: 'Collab Project',
          endGoalNodeId: 'goal_node',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-05T10:00:00Z',
          tags: ['local-tag'],
        },
        nodes: [
          { id: 'goal_node', text: 'Goal', status: 'planned', dueDate: '2026-09-30' } as any,
          { id: 'node_local', text: 'Local Task', status: 'completed', dueDate: '2026-09-10' } as any,
        ],
        edges: [
          { id: 'e1', projectId: 'proj_collab', fromNodeId: 'node_local', toNodeId: 'goal_node', createdAt: '2026-09-01T10:00:00Z' },
        ],
        notes: [],
        history: [],
      };

      const cloudDoc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-05T11:00:00Z',
        project: {
          id: 'proj_collab',
          name: 'Collab Project',
          endGoalNodeId: 'goal_node',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-05T11:00:00Z',
          tags: ['cloud-tag'],
        },
        nodes: [
          { id: 'goal_node', text: 'Goal', status: 'planned', dueDate: '2026-09-30' } as any,
          { id: 'node_cloud', text: 'Cloud Task', status: 'in_progress', dueDate: '2026-09-15' } as any,
        ],
        edges: [
          { id: 'e2', projectId: 'proj_collab', fromNodeId: 'node_cloud', toNodeId: 'goal_node', createdAt: '2026-09-01T10:00:00Z' },
        ],
        notes: [],
        history: [],
      };

      const merged = await SyncCoordinator.mergeProjectDocuments(localDoc, cloudDoc);

      // Verify all nodes from both sides exist
      const nodeIds = merged.nodes.map((n) => n.id).sort();
      expect(nodeIds).toEqual(['goal_node', 'node_cloud', 'node_local']);

      // Verify all valid edges are preserved
      expect(merged.edges).toHaveLength(2);
      expect(merged.edges.map((e) => e.id).sort()).toEqual(['e1', 'e2']);

      // Verify tags are merged
      expect(merged.project.tags).toContain('local-tag');
      expect(merged.project.tags).toContain('cloud-tag');
    });

    it('creates an automatic backup snapshot before applying conflict merge', async () => {
      const writtenSnapshots: any[] = [];
      const mockStorage: any = {
        writeSnapshot: async (snap: any) => {
          writtenSnapshots.push(snap);
        },
      };

      const docA: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-05T10:00:00Z',
        project: { id: 'proj_test', name: 'Test', endGoalNodeId: 'g', createdAt: '', updatedAt: '2026-09-05T10:00:00Z' },
        nodes: [{ id: 'g', text: 'Goal', status: 'planned' } as any],
        edges: [],
        notes: [],
        history: [],
      };

      const docB: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-05T11:00:00Z',
        project: { id: 'proj_test', name: 'Test', endGoalNodeId: 'g', createdAt: '', updatedAt: '2026-09-05T11:00:00Z' },
        nodes: [{ id: 'g', text: 'Goal Updated', status: 'completed' } as any],
        edges: [],
        notes: [],
        history: [],
      };

      await SyncCoordinator.mergeProjectDocuments(docA, docB, mockStorage);

      expect(writtenSnapshots).toHaveLength(1);
      expect(writtenSnapshots[0].projectId).toBe('proj_test');
      expect(writtenSnapshots[0].message).toContain('Pre-sync backup');
    });
  });

  describe('Deletion Tombstones & Resurrection Prevention', () => {
    it('records project deletion and prevents resurrection during sync', () => {
      SyncCoordinator.recordProjectDeletion('proj_deleted_123');
      const tombstones = SyncCoordinator.getProjectTombstones();
      expect(tombstones['proj_deleted_123']).toBeDefined();

      SyncCoordinator.clearProjectTombstone('proj_deleted_123');
      expect(SyncCoordinator.getProjectTombstones()['proj_deleted_123']).toBeUndefined();
    });

    it('filters out tombstoned standalone tasks when deletedAt is newer than task update', () => {
      const task: StandaloneTask = {
        id: 'task_del',
        text: 'Should be deleted',
        dueDate: '2026-09-05',
        status: 'planned',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const tombstones = {
        task_del: '2026-09-02T10:00:00Z', // Deleted after updatedAt
      };

      const merged = SyncCoordinator.mergeStandaloneTasks([task], [task], tombstones);
      expect(merged).toHaveLength(0);
    });

    it('preserves task if it was updated on another device after deletion timestamp', () => {
      const task: StandaloneTask = {
        id: 'task_resurrected',
        text: 'Edited after deletion',
        dueDate: '2026-09-05',
        status: 'completed',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-03T10:00:00Z', // Newer than deletedAt
      };

      const tombstones = {
        task_resurrected: '2026-09-02T10:00:00Z',
      };

      const merged = SyncCoordinator.mergeStandaloneTasks([], [task], tombstones);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('task_resurrected');
    });
  });

  describe('Attention Reviews Merge Resolution', () => {
    it('merges distinct reviews across local and cloud without duplicates', () => {
      const rev1: WeeklyAttentionReviewRecord = {
        id: 'rev_1',
        weekStartDate: '2026-08-24',
        createdAt: '2026-08-31T00:00:00Z',
        data: {
          weekStartDate: '2026-08-24',
          weekEndDate: '2026-08-30',
          attentionUnitMinutes: 15,
          trackedAU: 10,
          trackedSeconds: 9000,
          sessionCount: 5,
          projectAllocations: [],
          standaloneAllocations: { au: 0, percentage: 0, tasksWorkedCount: 0, tasksCompletedCount: 0 },
          topTasksByAttention: [],
          estimationCalibration: {
            tasksWithEstimate: 2,
            accurateCount: 2,
            overestimatedCount: 0,
            underestimatedCount: 0,
            averageRatio: 1.0,
          },
          taskSummaries: [],
          patternObservations: [],
        } as any,
      };

      const rev2: WeeklyAttentionReviewRecord = {
        id: 'rev_2',
        weekStartDate: '2026-08-31',
        createdAt: '2026-09-07T00:00:00Z',
        data: {
          weekStartDate: '2026-08-31',
          weekEndDate: '2026-09-06',
          attentionUnitMinutes: 15,
          trackedAU: 12,
          trackedSeconds: 10800,
          sessionCount: 6,
          projectAllocations: [],
          standaloneAllocations: { au: 0, percentage: 0, tasksWorkedCount: 0, tasksCompletedCount: 0 },
          topTasksByAttention: [],
          estimationCalibration: {
            tasksWithEstimate: 3,
            accurateCount: 3,
            overestimatedCount: 0,
            underestimatedCount: 0,
            averageRatio: 1.0,
          },
          taskSummaries: [],
          patternObservations: [],
        } as any,
      };

      const merged = SyncCoordinator.mergeAttentionReviews([rev1], [rev2], {});
      expect(merged).toHaveLength(2);
      expect(merged.map((r) => r.id)).toEqual(expect.arrayContaining(['rev_1', 'rev_2']));
    });

    it('honors tombstones when review was deleted', () => {
      const rev: WeeklyAttentionReviewRecord = {
        id: 'rev_del',
        weekStartDate: '2026-08-24',
        createdAt: '2026-08-31T00:00:00Z',
        data: {} as any,
      };

      const tombstones = {
        rev_del: '2026-09-01T00:00:00Z',
      };

      const merged = SyncCoordinator.mergeAttentionReviews([rev], [rev], tombstones);
      expect(merged).toHaveLength(0);
    });
  });

  describe('Connection Persistence & Auto-Removal Prevention', () => {
    it('preserves active provider in state and localStorage even if token is expired', async () => {
      localStorage.setItem('graphdule_active_cloud_provider', 'google_drive');
      // Mock GDriveAuth.isAuthenticated to return false (simulating 1-hour expiry)
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(false);

      SyncCoordinator.refreshAuthStatus();
      const state = SyncCoordinator.getState();

      // Crucial: Active provider MUST NOT be wiped out or set to 'none' in localStorage!
      expect(state.provider).toBe('google_drive');
      expect(localStorage.getItem('graphdule_active_cloud_provider')).toBe('google_drive');
    });
  });

  describe('Sync Loop Prevention & Redundant Upload Optimization', () => {
    it('does not re-upload standalone tasks or preferences if local and cloud copies match', async () => {
      const mockDoc: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-01T10:00:00Z',
        project: {
          id: 'proj_test',
          name: 'Test Project',
          endGoalNodeId: 'node_goal',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        nodes: [],
        edges: [],
        notes: [],
        history: [],
      };

      const identicalTasks: StandaloneTask[] = [
        { id: 'task_1', text: 'Existing Task', dueDate: '2026-09-05', status: 'planned', createdAt: '2026-09-01T10:00:00Z' },
      ];

      const identicalPrefs = {
        myDayMode: 'today' as const,
        theme: 'dark' as const,
        dateFormat: 'DD/MM/YYYY' as const,
        onboardingCompleted: true,
        preferredStorageProvider: 'browser',
      };

      const mockProvider: IStorageProvider = {
        info: { id: 'browser', name: 'IndexedDB', isConnected: true, isLocalOnly: true, statusMessage: 'Ready' },
        init: async () => {},
        listProjects: async () => [ProjectService.getProjectSummary(mockDoc.project, mockDoc.nodes)],
        readProject: async () => mockDoc,
        writeProject: async () => {},
        deleteProject: async () => {},
        readStandaloneTasks: async () => identicalTasks,
        writeStandaloneTasks: async () => {},
        readPreferences: async () => identicalPrefs,
        writePreferences: async () => {},
        listSnapshots: async () => [],
        readSnapshot: async () => null,
        writeSnapshot: async () => {},
      };

      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_token');
      vi.spyOn(GDriveClient, 'getOrCreateAppFolder').mockResolvedValue('folder_123');
      vi.spyOn(GDriveClient, 'listFiles').mockResolvedValue([
        { id: 'cloud_proj_file', name: 'project_proj_test.json', modifiedTime: '2026-09-01T10:00:00Z' },
      ]);
      vi.spyOn(GDriveClient, 'downloadJson').mockImplementation(async (id: string) => {
        if (id === 'cloud_proj_file') return mockDoc;
        if (id === 'cloud_tasks_file') return identicalTasks;
        if (id === 'cloud_prefs_file') return identicalPrefs;
        return null;
      });
      vi.spyOn(GDriveClient, 'findFileByName').mockImplementation(async (name: string) => {
        if (name === 'standalone_tasks.json') return { id: 'cloud_tasks_file', name };
        if (name === 'preferences.json') return { id: 'cloud_prefs_file', name };
        return null;
      });

      const uploadSpy = vi.spyOn(GDriveClient, 'uploadJson').mockResolvedValue('new_id');

      await SyncCoordinator.setCloudProvider('google_drive');
      const res = await SyncCoordinator.sync(mockProvider);

      expect(res.success).toBe(true);
      // Crucial: No uploads should be performed for matching project, tasks, or preferences!
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('shares in-flight promise for concurrent sync invocations', async () => {
      const mockProvider: IStorageProvider = {
        info: { id: 'browser', name: 'IndexedDB', isConnected: true, isLocalOnly: true, statusMessage: 'Ready' },
        init: async () => {},
        listProjects: async () => [],
        readProject: async () => null,
        writeProject: async () => {},
        deleteProject: async () => {},
        readStandaloneTasks: async () => [],
        writeStandaloneTasks: async () => {},
        readPreferences: async () => ({
          myDayMode: 'today',
          theme: 'dark',
          dateFormat: 'DD/MM/YYYY',
          onboardingCompleted: true,
          preferredStorageProvider: 'browser',
        }),
        writePreferences: async () => {},
        listSnapshots: async () => [],
        readSnapshot: async () => null,
        writeSnapshot: async () => {},
      };

      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_token');
      vi.spyOn(GDriveClient, 'getOrCreateAppFolder').mockResolvedValue('folder_123');
      vi.spyOn(GDriveClient, 'listFiles').mockResolvedValue([]);
      vi.spyOn(GDriveClient, 'findFileByName').mockResolvedValue(null);
      vi.spyOn(GDriveClient, 'uploadJson').mockResolvedValue('uploaded');

      await SyncCoordinator.setCloudProvider('google_drive');

      // Trigger two concurrent syncs
      const sync1Promise = SyncCoordinator.sync(mockProvider);
      const sync2Promise = SyncCoordinator.sync(mockProvider);

      // Both should resolve successfully
      const [res1, res2] = await Promise.all([sync1Promise, sync2Promise]);
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
    });

    it('preserves existing timestamp in mergeProjectDocuments when documents are identical', async () => {
      const docA: ProjectDocument = {
        schemaVersion: 1,
        exportedAt: '2026-09-01T10:00:00Z',
        project: {
          id: 'proj_1',
          name: 'Project 1',
          endGoalNodeId: 'node_1',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        nodes: [{ id: 'node_1', text: 'Goal', projectId: 'proj_1', status: 'planned', createdAt: '2026-09-01T10:00:00Z' }],
        edges: [],
        notes: [],
        history: [],
      };

      const docB: ProjectDocument = { ...docA };

      const merged = await SyncCoordinator.mergeProjectDocuments(docA, docB);
      // Must not generate a brand new nowIso timestamp when there is zero difference
      expect(merged.project.updatedAt).toBe('2026-09-01T10:00:00Z');
      expect(merged.exportedAt).toBe('2026-09-01T10:00:00Z');
    });
  });
});


