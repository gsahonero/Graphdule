import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildEventPayload,
  formatEventSummary,
  getGCalendarColorForStatus,
  toGCalEventId,
  getTaskIdFromEventId,
} from '../../src/storage/gcalendar/gcalendar-client';
import { GCalendarSync } from '../../src/storage/gcalendar/gcalendar-sync';

describe('Google Calendar Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('formatEventSummary', () => {
    it('should format normal task title when planned or in_progress', () => {
      expect(formatEventSummary('Write literature review', 'planned')).toBe('Write literature review');
      expect(formatEventSummary('Design experiment pipeline', 'in_progress')).toBe('Design experiment pipeline');
    });

    it('should prepend [✓] for completed tasks without duplicating', () => {
      expect(formatEventSummary('Finish thesis draft', 'completed')).toBe('[✓] Finish thesis draft');
      expect(formatEventSummary('[✓] Finish thesis draft', 'completed')).toBe('[✓] Finish thesis draft');
    });
  });

  describe('getGCalendarColorForStatus', () => {
    it('should return appropriate colorId for each task status', () => {
      expect(getGCalendarColorForStatus('completed')).toBe('10'); // Green
      expect(getGCalendarColorForStatus('in_progress')).toBe('5'); // Yellow
      expect(getGCalendarColorForStatus('abandoned')).toBe('8'); // Graphite
      expect(getGCalendarColorForStatus('planned')).toBe('1'); // Lavender
    });
  });

  describe('buildEventPayload', () => {
    it('should construct RFC 5545 compliant all-day event payload', () => {
      const payload = buildEventPayload({
        taskId: 'node_123',
        taskText: 'Deploy staging cluster',
        dueDate: '2026-09-10',
        status: 'planned',
        projectId: 'proj_alpha',
        projectName: 'Infrastructure Overhaul',
      });

      expect(payload.summary).toBe('Deploy staging cluster');
      expect(payload.start.date).toBe('2026-09-10');
      // RFC 5545: End date is exclusive (+1 day)
      expect(payload.end.date).toBe('2026-09-11');
      expect(payload.extendedProperties?.private.graphduleTaskId).toBe('node_123');
      expect(payload.extendedProperties?.private.graphduleProjectId).toBe('proj_alpha');
      expect(payload.extendedProperties?.private.graphduleApp).toBe('graphdule');
      expect(payload.extendedProperties?.private.graphduleStatus).toBe('planned');
      expect(payload.description).toContain('Infrastructure Overhaul');
    });

    it('should include note content in event description when provided', () => {
      const payload = buildEventPayload({
        taskId: 'task_abc',
        taskText: 'Weekly sync meeting',
        dueDate: '2026-10-01',
        status: 'in_progress',
        notes: 'Discuss Q3 deliverables and milestone 2.',
      });

      expect(payload.start.date).toBe('2026-10-01');
      expect(payload.end.date).toBe('2026-10-02');
      expect(payload.description).toContain('Discuss Q3 deliverables and milestone 2.');
    });
  });

  describe('GCalendarSync Configuration & Mappings', () => {
    it('should return default config if none stored', () => {
      const config = GCalendarSync.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.targetCalendarId).toBe('dedicated');
      expect(config.autoSyncOnDateChange).toBe(true);
      expect(config.lastSyncTime).toBeNull();
    });

    it('should update and persist sync config', () => {
      GCalendarSync.setConfig({
        enabled: true,
        targetCalendarId: 'primary',
        targetCalendarSummary: 'Primary (user@example.com)',
      });

      const config = GCalendarSync.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.targetCalendarId).toBe('primary');
      expect(config.targetCalendarSummary).toBe('Primary (user@example.com)');
    });

    it('should save, retrieve and remove task-to-event mappings', () => {
      GCalendarSync.setMapping('node_1', {
        eventId: 'gcal_ev_1',
        calendarId: 'cal_graphdule_123',
        lastSyncedDate: '2026-09-15',
        lastSyncedText: 'Write Introduction',
        lastSyncedStatus: 'planned',
        projectId: 'proj_1',
        updatedAt: new Date().toISOString(),
      });

      let map = GCalendarSync.getEventMap();
      expect(map['node_1']).toBeDefined();
      expect(map['node_1'].eventId).toBe('gcal_ev_1');
      expect(map['node_1'].lastSyncedDate).toBe('2026-09-15');

      GCalendarSync.removeMapping('node_1');
      map = GCalendarSync.getEventMap();
      expect(map['node_1']).toBeUndefined();
    });

    it('should clear calendar cache properly', () => {
      localStorage.setItem('graphdule_gcal_dedicated_id', 'cal_123');
      GCalendarSync.clearCalendarCache();
      expect(localStorage.getItem('graphdule_gcal_dedicated_id')).toBeNull();
    });
  });

  describe('GCalendarClient Query URL and Search', () => {
    beforeEach(async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_oauth_token');
    });

    it('should query listGraphduleEvents with literal = separator in privateExtendedProperty', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], nextPageToken: undefined }),
      } as any);

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      const events = await GCalendarClient.listGraphduleEvents('test_calendar_id');
      expect(events).toEqual([]);

      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('privateExtendedProperty=graphduleApp=graphdule');
      expect(calledUrl).not.toContain('graphduleApp%3Dgraphdule');
    });

    it('should search for event by taskId using findEventByTaskId', async () => {
      const mockEvent = { id: 'ev_99', summary: 'Task 99' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockEvent] }),
      } as any);

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      const found = await GCalendarClient.findEventByTaskId('test_calendar_id', 'node_99');
      expect(found).toEqual(mockEvent);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('privateExtendedProperty=graphduleTaskId=node_99');
    });
  });

  describe('clearAllEventsFromCalendar', () => {
    it('should delete all events returned by listGraphduleEvents and mapped events, then clear map', async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      vi.spyOn(GCalendarClient, 'getOrCreateDedicatedCalendar').mockResolvedValue({
        id: 'cal_dedicated_id',
        summary: 'Graphdule',
        primary: false,
        accessRole: 'owner',
      });
      vi.spyOn(GCalendarClient, 'listGraphduleEvents').mockResolvedValue([
        { id: 'ev_1', summary: 'Event 1' } as any,
        { id: 'ev_2', summary: 'Event 2' } as any,
      ]);
      const deleteSpy = vi.spyOn(GCalendarClient, 'deleteEvent').mockResolvedValue(true);

      GCalendarSync.setMapping('node_1', {
        eventId: 'ev_1',
        calendarId: 'cal_dedicated_id',
        lastSyncedDate: '2026-09-01',
        lastSyncedText: 'Task 1',
        lastSyncedStatus: 'planned',
        updatedAt: new Date().toISOString(),
      });
      GCalendarSync.setMapping('node_3', {
        eventId: 'ev_3',
        calendarId: 'cal_dedicated_id',
        lastSyncedDate: '2026-09-03',
        lastSyncedText: 'Task 3',
        lastSyncedStatus: 'planned',
        updatedAt: new Date().toISOString(),
      });

      const res = await GCalendarSync.clearAllEventsFromCalendar();
      expect(res.success).toBe(true);
      expect(res.count).toBe(3); // ev_1, ev_2, ev_3
      expect(deleteSpy).toHaveBeenCalledTimes(3);

      // Verify local event map is cleared
      const map = GCalendarSync.getEventMap();
      expect(Object.keys(map).length).toBe(0);
    });
  });

  describe('syncAll 3-way merge conflict resolution', () => {
    it('should push Date B to Google Calendar when Graphdule task was moved from Date A to Date B', async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_oauth_token');

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      vi.spyOn(GCalendarClient, 'getOrCreateDedicatedCalendar').mockResolvedValue({
        id: 'cal_dedicated_id',
        summary: 'Graphdule',
        primary: false,
        accessRole: 'owner',
      });

      // Calendar currently has the old event on Date A
      vi.spyOn(GCalendarClient, 'listGraphduleEvents').mockResolvedValue([
        {
          id: 'gcal_ev_100',
          summary: 'Task 100',
          start: { date: '2026-09-01' }, // Date A
          end: { date: '2026-09-02' },
          extendedProperties: {
            private: {
              graphduleTaskId: 'node_100',
              graphduleApp: 'graphdule',
            },
          },
        } as any,
      ]);

      const updateEventSpy = vi.spyOn(GCalendarClient, 'updateEvent').mockResolvedValue({} as any);

      // Previous baseline: synced on Date A
      GCalendarSync.setMapping('node_100', {
        eventId: 'gcal_ev_100',
        calendarId: 'cal_dedicated_id',
        lastSyncedDate: '2026-09-01', // Date A
        lastSyncedText: 'Task 100',
        lastSyncedStatus: 'planned',
        updatedAt: new Date().toISOString(),
      });

      // Local storage has node moved to Date B
      const mockStorage: any = {
        listProjects: async () => [{ id: 'p1', name: 'Project 1' }],
        readProject: async () => ({
          project: { id: 'p1', name: 'Project 1' },
          nodes: [
            {
              id: 'node_100',
              text: 'Task 100',
              dueDate: '2026-09-15', // Date B
              status: 'planned',
            },
          ],
          edges: [],
        }),
        writeProject: vi.fn(),
        readStandaloneTasks: async () => [],
        writeStandaloneTasks: vi.fn(),
      };

      const result = await GCalendarSync.syncAll(mockStorage);
      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);
      expect(result.pulledFromCalendar).toBe(0);

      // Should NOT have overwritten storage with Date A
      expect(mockStorage.writeProject).not.toHaveBeenCalled();

      // Should have called updateEvent on Google Calendar with Date B
      expect(updateEventSpy).toHaveBeenCalledWith(
        'cal_dedicated_id',
        'gcal_ev_100',
        expect.objectContaining({
          start: { date: '2026-09-15' },
          end: { date: '2026-09-16' },
        })
      );
    });

    it('should pull Date C from Google Calendar when event was rescheduled externally', async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_oauth_token');

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      vi.spyOn(GCalendarClient, 'getOrCreateDedicatedCalendar').mockResolvedValue({
        id: 'cal_dedicated_id',
        summary: 'Graphdule',
        primary: false,
        accessRole: 'owner',
      });

      // Calendar was moved externally to Date C (2026-09-20)
      vi.spyOn(GCalendarClient, 'listGraphduleEvents').mockResolvedValue([
        {
          id: 'gcal_ev_200',
          summary: 'Task 200',
          start: { date: '2026-09-20' }, // Date C
          end: { date: '2026-09-21' },
          extendedProperties: {
            private: {
              graphduleTaskId: 'node_200',
              graphduleApp: 'graphdule',
            },
          },
        } as any,
      ]);

      // Previous baseline: synced on Date A (2026-09-05)
      GCalendarSync.setMapping('node_200', {
        eventId: 'gcal_ev_200',
        calendarId: 'cal_dedicated_id',
        lastSyncedDate: '2026-09-05', // Date A
        lastSyncedText: 'Task 200',
        lastSyncedStatus: 'planned',
        updatedAt: new Date().toISOString(),
      });

      // Graphdule local node was UNTOUCHED (still Date A)
      const mockStorage: any = {
        listProjects: async () => [{ id: 'p1', name: 'Project 1' }],
        readProject: async () => ({
          project: { id: 'p1', name: 'Project 1' },
          nodes: [
            {
              id: 'node_200',
              text: 'Task 200',
              dueDate: '2026-09-05', // Date A (untouched)
              status: 'planned',
            },
          ],
          edges: [],
        }),
        writeProject: vi.fn(),
        readStandaloneTasks: async () => [],
        writeStandaloneTasks: vi.fn(),
      };

      const result = await GCalendarSync.syncAll(mockStorage);
      expect(result.success).toBe(true);
      expect(result.pulledFromCalendar).toBe(1);

      // Should have saved updated project doc with Date C
      expect(mockStorage.writeProject).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: [
            expect.objectContaining({
              id: 'node_200',
              dueDate: '2026-09-20', // Date C
            }),
          ],
        })
      );
    });

    it('should deduplicate multiple existing events in Google Calendar for the same task during syncAll', async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_oauth_token');

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      vi.spyOn(GCalendarClient, 'getOrCreateDedicatedCalendar').mockResolvedValue({
        id: 'cal_dedicated_id',
        summary: 'Graphdule',
        primary: false,
        accessRole: 'owner',
      });

      const deterministicId = toGCalEventId('node_dup_1');

      // Google Calendar currently has 3 duplicate events for node_dup_1!
      vi.spyOn(GCalendarClient, 'listGraphduleEvents').mockResolvedValue([
        {
          id: 'legacy_dup_random_1',
          summary: 'Task Duplicate',
          start: { date: '2026-09-10' },
          end: { date: '2026-09-11' },
          extendedProperties: {
            private: {
              graphduleTaskId: 'node_dup_1',
              graphduleApp: 'graphdule',
            },
          },
        } as any,
        {
          id: deterministicId, // Canonical deterministic event
          summary: 'Task Duplicate',
          start: { date: '2026-09-10' },
          end: { date: '2026-09-11' },
          extendedProperties: {
            private: {
              graphduleTaskId: 'node_dup_1',
              graphduleApp: 'graphdule',
            },
          },
        } as any,
        {
          id: 'legacy_dup_random_2',
          summary: 'Task Duplicate',
          start: { date: '2026-09-10' },
          end: { date: '2026-09-11' },
          extendedProperties: {
            private: {
              graphduleTaskId: 'node_dup_1',
              graphduleApp: 'graphdule',
            },
          },
        } as any,
      ]);

      const deleteEventSpy = vi.spyOn(GCalendarClient, 'deleteEvent').mockResolvedValue(true);
      vi.spyOn(GCalendarClient, 'updateEvent').mockResolvedValue({} as any);

      const mockStorage: any = {
        listProjects: async () => [{ id: 'p1', name: 'Project 1' }],
        readProject: async () => ({
          project: { id: 'p1', name: 'Project 1' },
          nodes: [
            {
              id: 'node_dup_1',
              text: 'Task Duplicate',
              dueDate: '2026-09-10',
              status: 'planned',
            },
          ],
          edges: [],
        }),
        writeProject: vi.fn(),
        readStandaloneTasks: async () => [],
        writeStandaloneTasks: vi.fn(),
      };

      const result = await GCalendarSync.syncAll(mockStorage);
      expect(result.success).toBe(true);

      // Should have deleted the 2 duplicate events from Google Calendar!
      expect(deleteEventSpy).toHaveBeenCalledWith('cal_dedicated_id', 'legacy_dup_random_1');
      expect(deleteEventSpy).toHaveBeenCalledWith('cal_dedicated_id', 'legacy_dup_random_2');
      // Should NOT delete the deterministic canonical event
      expect(deleteEventSpy).not.toHaveBeenCalledWith('cal_dedicated_id', deterministicId);
      expect(result.deleted).toBe(2);
    });
  });

  describe('Deterministic Unique Event IDs (RFC 4648 Base32Hex)', () => {
    it('should generate Google Calendar compliant event IDs with only [a-v0-9] and length >= 5', () => {
      const taskIds = [
        'node_1',
        'node_1788480760675_abc',
        'task_2026_09_04_goal',
        'special-characters_123!?',
      ];

      for (const taskId of taskIds) {
        const eventId = toGCalEventId(taskId);
        expect(eventId.startsWith('gdl')).toBe(true);
        expect(eventId.length).toBeGreaterThanOrEqual(5);
        expect(eventId.length).toBeLessThanOrEqual(1024);
        // Strictly only [a-v0-9] (no uppercase, no hyphens, no underscores, no w, x, y, z)
        expect(/^[a-v0-9]+$/.test(eventId)).toBe(true);

        // Round-trip decoding recovers exact original taskId
        const recovered = getTaskIdFromEventId(eventId);
        expect(recovered).toBe(taskId);
      }
    });

    it('should generate different event IDs for different tasks and identical IDs for the same task', () => {
      const idA = toGCalEventId('node_alpha');
      const idA2 = toGCalEventId('node_alpha');
      const idB = toGCalEventId('node_beta');

      expect(idA).toBe(idA2);
      expect(idA).not.toBe(idB);
    });

    it('buildEventPayload should include the deterministic event id', () => {
      const payload = buildEventPayload({
        taskId: 'node_deploy_01',
        taskText: 'Deploy to Cloud',
        dueDate: '2026-09-12',
        status: 'in_progress',
      });

      expect(payload.id).toBe(toGCalEventId('node_deploy_01'));
      expect(payload.id).toBeDefined();
    });

    it('GCalendarClient.createEvent should fall back to updateEvent on 409 Conflict', async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_oauth_token');

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      const updateSpy = vi.spyOn(GCalendarClient, 'updateEvent').mockResolvedValue({
        id: 'gdl_conflict_event',
        summary: 'Updated in place',
        status: 'confirmed',
      } as any);

      // First call returns 409 Conflict
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 409,
        ok: false,
        json: async () => ({ error: { message: 'The requested identifier already exists.' } }),
      } as any);

      const payload = buildEventPayload({
        taskId: 'node_conflict',
        taskText: 'Conflict Task',
        dueDate: '2026-09-15',
        status: 'planned',
      });

      const res = await GCalendarClient.createEvent('cal_id', payload);
      expect(updateSpy).toHaveBeenCalledWith('cal_id', payload.id, payload);
      expect(res.id).toBe('gdl_conflict_event');
    });

    it('syncTaskDelete should delete deterministic event ID even if local map is empty', async () => {
      const { GDriveAuth } = await import('../../src/storage/gdrive/gdrive-auth');
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      GCalendarSync.setConfig({ enabled: true });

      const { GCalendarClient } = await import('../../src/storage/gcalendar/gcalendar-client');
      vi.spyOn(GCalendarClient, 'getOrCreateDedicatedCalendar').mockResolvedValue({
        id: 'cal_dedicated_id',
        summary: 'Graphdule',
        primary: false,
        accessRole: 'owner',
      });
      const deleteSpy = vi.spyOn(GCalendarClient, 'deleteEvent').mockResolvedValue(true);

      // Local map is completely empty
      GCalendarSync.saveEventMap({});

      await GCalendarSync.syncTaskDelete('node_orphaned_task');
      const expectedEventId = toGCalEventId('node_orphaned_task');
      expect(deleteSpy).toHaveBeenCalledWith('cal_dedicated_id', expectedEventId);
    });
  });
});
