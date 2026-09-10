import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MigrationService,
  getMondayOfWeek,
  getISOWeekString,
  DailyCapacitySnapshot,
  DailyCapacityConfig,
} from '../../src/domain';
import { GCalendarSync } from '../../src/storage/gcalendar/gcalendar-sync';
import { GDriveAuth } from '../../src/storage/gdrive/gdrive-auth';
import { GCalendarClient } from '../../src/storage/gcalendar/gcalendar-client';

describe('Capacity & Calendar Reality Check Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Monday Review Detection & ISO Week Utilities', () => {
    it('determines the Monday of any date correctly', () => {
      // 2026-09-09 is Wednesday
      expect(getMondayOfWeek('2026-09-09')).toBe('2026-09-07');
      // 2026-09-07 is Monday
      expect(getMondayOfWeek('2026-09-07')).toBe('2026-09-07');
      // 2026-09-13 is Sunday
      expect(getMondayOfWeek('2026-09-13')).toBe('2026-09-07');
    });

    it('generates consistent ISO week strings (YYYY-Www)', () => {
      const weekStr = getISOWeekString('2026-09-07');
      expect(weekStr).toBe('2026-W37');
    });

    it('identifies when Monday prompt should fire based on lastWeeklyPromptWeek', () => {
      const currentMondayWeek = getISOWeekString('2026-09-07');
      const capConfig1: Partial<DailyCapacityConfig> = {
        isConfigured: true,
        lastWeeklyPromptWeek: '2026-W36', // previous week
      };

      const shouldPrompt1 = capConfig1.lastWeeklyPromptWeek !== currentMondayWeek;
      expect(shouldPrompt1).toBe(true);

      const capConfig2: Partial<DailyCapacityConfig> = {
        isConfigured: true,
        lastWeeklyPromptWeek: '2026-W37', // already prompted this week
      };

      const shouldPrompt2 = capConfig2.lastWeeklyPromptWeek !== currentMondayWeek;
      expect(shouldPrompt2).toBe(false);
    });
  });

  describe('Workspace Backup and Restore with Capacity Snapshots', () => {
    it('exports and parses capacitySnapshots and preferences.capacityConfig without loss', () => {
      const mockSnapshot: DailyCapacitySnapshot = {
        id: 'cap_snap_2026-09-07_001',
        date: '2026-09-07',
        timestamp: '2026-09-07T12:00:00Z',
        expectedCapacityAU: 20,
        effectiveCapacityAU: 18,
        plannedAU: 15,
        calendarAvailabilityAU: 18,
        realizedAU: 14,
        occupiedMinutes: 90,
        confidence: 0.8,
        source: 'sync',
      };

      const workspacePayload = {
        backupType: 'full_workspace',
        version: 1,
        exportedAt: '2026-09-07T18:00:00Z',
        projects: [],
        standaloneTasks: [],
        preferences: {
          theme: 'dark',
          dateFormat: 'DD/MM/YYYY',
          capacityConfig: {
            isConfigured: true,
            weekdayDefaults: { 1: 24, 2: 20, 3: 20, 4: 20, 5: 18, 6: 0, 0: 0 },
            manualOverrides: { '2026-09-07': 30 },
            calendarInference: {
              enabled: true,
              minutesPerAU: 15,
              workSchedule: {
                startHour: 8,
                startMinute: 30,
                endHour: 16,
                endMinute: 30,
                workDays: [1, 2, 3, 4, 5],
              },
            },
          },
        },
        capacitySnapshots: [mockSnapshot],
      };

      const parseRes = MigrationService.parseAnyJsonPayload(workspacePayload);
      expect(parseRes.success).toBe(true);

      if (parseRes.success && parseRes.payload.type === 'workspace') {
        expect(parseRes.payload.capacitySnapshots).toBeDefined();
        expect(parseRes.payload.capacitySnapshots).toHaveLength(1);
        expect(parseRes.payload.capacitySnapshots![0].id).toBe('cap_snap_2026-09-07_001');
        expect(parseRes.payload.capacitySnapshots![0].effectiveCapacityAU).toBe(18);

        const parsedConfig = parseRes.payload.preferences?.capacityConfig;
        expect(parsedConfig).toBeDefined();
        expect(parsedConfig?.isConfigured).toBe(true);
        expect(parsedConfig?.weekdayDefaults[1]).toBe(24);
        expect(parsedConfig?.manualOverrides['2026-09-07']).toBe(30);
        expect(parsedConfig?.calendarInference.workSchedule.startHour).toBe(8);
      }
    });
  });

  describe('Google Calendar Sync - Capacity Snapshot Recording', () => {
    it('computes affected day availability and appends DailyCapacitySnapshots during syncAll', async () => {
      vi.spyOn(GDriveAuth, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(GDriveAuth, 'getToken').mockReturnValue('mock_token');

      vi.spyOn(GCalendarClient, 'getOrCreateDedicatedCalendar').mockResolvedValue({
        id: 'cal_dedicated_id',
        summary: 'Graphdule',
        primary: false,
        accessRole: 'owner',
      });

      vi.spyOn(GCalendarClient, 'createEvent').mockResolvedValue({ id: 'created_ev_1' } as any);
      vi.spyOn(GCalendarClient, 'updateEvent').mockResolvedValue({ id: 'updated_ev_1' } as any);
      vi.spyOn(GCalendarClient, 'deleteEvent').mockResolvedValue(true);

      // Mock calendar events on Monday 2026-09-07: 10:00 to 12:00 (120 min)
      vi.spyOn(GCalendarClient, 'listGraphduleEvents').mockResolvedValue([
        {
          id: 'ev-1',
          summary: 'Weekly Planning',
          start: { dateTime: '2026-09-07T10:00:00' },
          end: { dateTime: '2026-09-07T12:00:00' },
        } as any,
      ]);

      const appendedSnapshots: DailyCapacitySnapshot[] = [];

      const mockStorage = {
        listProjects: vi.fn().mockResolvedValue([]),
        readProject: vi.fn().mockResolvedValue(null),
        readAllDocuments: vi.fn().mockResolvedValue([]),
        readStandaloneTasks: vi.fn().mockResolvedValue([
          {
            id: 'task-1',
            text: 'Prep docs',
            dueDate: '2026-09-07',
            status: 'planned',
            estimatedAU: 4,
          },
        ]),
        writeStandaloneTasks: vi.fn().mockResolvedValue(undefined),
        readPreferences: vi.fn().mockResolvedValue({
          theme: 'light',
          capacityConfig: {
            isConfigured: true,
            weekdayDefaults: { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20, 6: 0, 0: 0 },
            manualOverrides: {},
            calendarInference: {
              enabled: true,
              minutesPerAU: 15,
              workSchedule: {
                startHour: 9,
                startMinute: 0,
                endHour: 17,
                endMinute: 0,
                workDays: [1, 2, 3, 4, 5],
              },
            },
          },
        }),
        appendCapacitySnapshots: vi.fn().mockImplementation(async (snaps) => {
          appendedSnapshots.push(...snaps);
        }),
      };

      const result = await GCalendarSync.syncAll(mockStorage as any);

      expect(result.success).toBe(true);
      expect(mockStorage.appendCapacitySnapshots).toHaveBeenCalled();
      expect(appendedSnapshots.length).toBeGreaterThan(0);

      const mondaySnap = appendedSnapshots.find((s) => s.date === '2026-09-07');
      expect(mondaySnap).toBeDefined();
      expect(mondaySnap?.source).toBe('sync');
      expect(mondaySnap?.calendarAvailabilityAU).toBeDefined();
      // Total work: 480m. Occupied: 120m. Remaining: 360m -> 360/15 = 24 AU
      expect(mondaySnap?.calendarAvailabilityAU).toBe(24);
      expect(mondaySnap?.effectiveCapacityAU).toBe(24);
    });
  });
});
