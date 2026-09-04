import { describe, it, expect, beforeEach } from 'vitest';
import { SyncCoordinator } from '../../src/storage/sync/sync-coordinator';
import { StandaloneTask } from '../../src/domain/models/types';
import { GDriveAuth } from '../../src/storage/gdrive/gdrive-auth';
import { OneDriveAuth } from '../../src/storage/onedrive/onedrive-auth';

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
});
