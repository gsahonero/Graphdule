import { GDriveAuth } from '../gdrive/gdrive-auth';
import {
  GCalendarClient,
  buildEventPayload,
  formatEventSummary,
  getGCalendarColorForStatus,
  toGCalEventId,
  getTaskIdFromEventId,
  GCalendarEventResponse,
} from './gcalendar-client';
import { IStorageProvider } from '../base/storage-provider';
import { NodeStatus, ProjectDocument, DailyCapacitySnapshot } from '../../domain/models/types';
import { addDays, getTodayString } from '../../domain/utils/date';
import { CapacityService, CalendarEventInterval, DEFAULT_CAPACITY_CONFIG } from '../../domain/services/capacity-service';
import { DEFAULT_SAMPLE_PROJECT_ID } from '../../config/sample-project';

const GCAL_EVENT_MAP_KEY = 'graphdule_gcal_event_map';
const GCAL_CONFIG_KEY = 'graphdule_gcal_config';

export interface GCalendarSyncConfig {
  enabled: boolean;
  targetCalendarId: string; // 'dedicated' or specific calendar ID (e.g. 'primary' or custom ID)
  targetCalendarSummary?: string;
  autoSyncOnDateChange: boolean;
  lastSyncTime: string | null;
}

export interface GCalEventMapping {
  eventId: string;
  calendarId: string;
  lastSyncedDate: string;
  lastSyncedText: string;
  lastSyncedStatus: NodeStatus;
  projectId?: string;
  updatedAt: string;
}

export interface GCalSyncSummary {
  success: boolean;
  created: number;
  updated: number;
  pulledFromCalendar: number;
  deleted: number;
  calendarSummary: string;
  error?: string;
}

export class GCalendarSync {
  public static getConfig(): GCalendarSyncConfig {
    try {
      const raw = localStorage.getItem(GCAL_CONFIG_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return {
      enabled: false,
      targetCalendarId: 'dedicated',
      autoSyncOnDateChange: true,
      lastSyncTime: null,
    };
  }

  public static setConfig(config: Partial<GCalendarSyncConfig>): GCalendarSyncConfig {
    const current = this.getConfig();
    const updated: GCalendarSyncConfig = { ...current, ...config };
    localStorage.setItem(GCAL_CONFIG_KEY, JSON.stringify(updated));
    return updated;
  }

  public static getEventMap(): Record<string, GCalEventMapping> {
    try {
      const raw = localStorage.getItem(GCAL_EVENT_MAP_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return {};
  }

  public static saveEventMap(map: Record<string, GCalEventMapping>): void {
    localStorage.setItem(GCAL_EVENT_MAP_KEY, JSON.stringify(map));
  }

  public static setMapping(taskId: string, mapping: GCalEventMapping): void {
    const map = this.getEventMap();
    map[taskId] = mapping;
    this.saveEventMap(map);
  }

  public static removeMapping(taskId: string): void {
    const map = this.getEventMap();
    delete map[taskId];
    this.saveEventMap(map);
  }

  private static cachedDedicatedCalendarId: string | null = null;

  /**
   * Clears cached dedicated calendar ID.
   */
  public static clearCalendarCache(): void {
    this.cachedDedicatedCalendarId = null;
    try {
      localStorage.removeItem('graphdule_gcal_dedicated_id');
    } catch {
      // ignore
    }
  }

  /**
   * Resolves effective target calendar ID.
   * If config is 'dedicated', finds or creates 'Graphdule' calendar with local caching.
   */
  public static async resolveEffectiveCalendarId(): Promise<{ calendarId: string; summary: string }> {
    const config = this.getConfig();
    if (config.targetCalendarId && config.targetCalendarId !== 'dedicated') {
      return {
        calendarId: config.targetCalendarId,
        summary: config.targetCalendarSummary || config.targetCalendarId,
      };
    }

    // Check memory or localStorage cache for dedicated calendar ID
    const cachedId = this.cachedDedicatedCalendarId || localStorage.getItem('graphdule_gcal_dedicated_id');
    if (cachedId) {
      this.cachedDedicatedCalendarId = cachedId;
      return {
        calendarId: cachedId,
        summary: config.targetCalendarSummary || 'Graphdule',
      };
    }

    // Dedicated mode: find or create 'Graphdule' calendar
    const dedicated = await GCalendarClient.getOrCreateDedicatedCalendar();
    this.cachedDedicatedCalendarId = dedicated.id;
    try {
      localStorage.setItem('graphdule_gcal_dedicated_id', dedicated.id);
    } catch {
      // ignore
    }

    this.setConfig({
      targetCalendarSummary: dedicated.summary,
    });
    return {
      calendarId: dedicated.id,
      summary: dedicated.summary,
    };
  }

  /**
   * Sync a single task date move event immediately to Google Calendar.
   */
  public static async syncTaskDateChange(params: {
    taskId: string;
    newDueDate: string;
    taskText: string;
    status: NodeStatus;
    projectId?: string;
    projectName?: string;
  }): Promise<void> {
    const config = this.getConfig();
    if (!config.enabled || !GDriveAuth.isAuthenticated() || params.projectId === DEFAULT_SAMPLE_PROJECT_ID) return;

    try {
      const { calendarId } = await this.resolveEffectiveCalendarId();
      const deterministicEventId = toGCalEventId(params.taskId);
      const nextDay = addDays(params.newDueDate, 1);
      const summary = formatEventSummary(params.taskText, params.status);
      const colorId = getGCalendarColorForStatus(params.status);

      const map = this.getEventMap();
      const existing = map[params.taskId];

      const eventId = (existing && existing.calendarId === calendarId) ? existing.eventId : deterministicEventId;

      // Try updating via existing/deterministic event ID directly (fast, 1 call)
      try {
        const updated = await GCalendarClient.updateEvent(calendarId, eventId, {
          summary,
          start: { date: params.newDueDate },
          end: { date: nextDay },
          colorId,
        });

        this.setMapping(params.taskId, {
          eventId: updated.id,
          calendarId,
          lastSyncedDate: params.newDueDate,
          lastSyncedText: params.taskText,
          lastSyncedStatus: params.status,
          projectId: params.projectId,
          updatedAt: new Date().toISOString(),
        });
        return;
      } catch (updateErr: any) {
        // If event doesn't exist yet on Google Calendar, create it below
      }

      // Create new event in calendar using deterministic ID
      const payload = buildEventPayload({
        taskId: params.taskId,
        taskText: params.taskText,
        dueDate: params.newDueDate,
        status: params.status,
        projectId: params.projectId,
        projectName: params.projectName,
      });

      const created = await GCalendarClient.createEvent(calendarId, payload);
      this.setMapping(params.taskId, {
        eventId: created.id,
        calendarId,
        lastSyncedDate: params.newDueDate,
        lastSyncedText: params.taskText,
        lastSyncedStatus: params.status,
        projectId: params.projectId,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[GCalendarSync] Quick date sync failed:', err);
    }
  }

  /**
   * Sync task status or text update to Google Calendar.
   */
  public static async syncTaskStatusOrTextChange(params: {
    taskId: string;
    taskText: string;
    status: NodeStatus;
    dueDate?: string;
    projectId?: string;
    projectName?: string;
  }): Promise<void> {
    const config = this.getConfig();
    if (!config.enabled || !GDriveAuth.isAuthenticated() || params.projectId === DEFAULT_SAMPLE_PROJECT_ID) return;

    try {
      const { calendarId } = await this.resolveEffectiveCalendarId();
      const deterministicEventId = toGCalEventId(params.taskId);
      const summary = formatEventSummary(params.taskText, params.status);
      const colorId = getGCalendarColorForStatus(params.status);

      const map = this.getEventMap();
      const existing = map[params.taskId];

      const eventId = (existing && existing.calendarId === calendarId) ? existing.eventId : deterministicEventId;

      // Try updating existing event by ID directly
      try {
        await GCalendarClient.updateEvent(calendarId, eventId, {
          summary,
          colorId,
        });

        this.setMapping(params.taskId, {
          eventId,
          calendarId,
          lastSyncedDate: params.dueDate || existing?.lastSyncedDate || '',
          lastSyncedText: params.taskText,
          lastSyncedStatus: params.status,
          projectId: params.projectId,
          updatedAt: new Date().toISOString(),
        });
        return;
      } catch (updateErr: any) {
        // Event not found, create below if dueDate is present
      }

      if (params.dueDate) {
        // Create if missing and has a dueDate
        const payload = buildEventPayload({
          taskId: params.taskId,
          taskText: params.taskText,
          dueDate: params.dueDate,
          status: params.status,
          projectId: params.projectId,
          projectName: params.projectName,
        });

        const created = await GCalendarClient.createEvent(calendarId, payload);
        this.setMapping(params.taskId, {
          eventId: created.id,
          calendarId,
          lastSyncedDate: params.dueDate,
          lastSyncedText: params.taskText,
          lastSyncedStatus: params.status,
          projectId: params.projectId,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[GCalendarSync] Status/text sync failed:', err);
    }
  }

  /**
   * Delete event from Google Calendar when task is deleted.
   */
  public static async syncTaskDelete(taskId: string): Promise<void> {
    const config = this.getConfig();
    if (!config.enabled || !GDriveAuth.isAuthenticated()) return;

    try {
      const { calendarId } = await this.resolveEffectiveCalendarId();
      const deterministicEventId = toGCalEventId(taskId);
      const map = this.getEventMap();
      const existing = map[taskId];

      // Always attempt deletion by deterministic ID directly (even if local map was cleared!)
      await GCalendarClient.deleteEvent(calendarId, deterministicEventId).catch(() => {});

      // If mapped to a legacy event ID, delete that too
      if (existing && existing.eventId !== deterministicEventId) {
        await GCalendarClient.deleteEvent(existing.calendarId, existing.eventId).catch(() => {});
      }

      this.removeMapping(taskId);
    } catch (err) {
      console.warn('[GCalendarSync] Delete event failed:', err);
    }
  }

  /**
   * Deletes all Graphdule events from the active/connected Google Calendar,
   * and clears the local event mapping.
   */
  public static async clearAllEventsFromCalendar(): Promise<{ success: boolean; count: number; error?: string }> {
    if (!GDriveAuth.isAuthenticated()) {
      return {
        success: false,
        count: 0,
        error: 'Not signed in with Google. Please sign in to clear calendar events.',
      };
    }

    try {
      const config = this.getConfig();
      const { calendarId } = await this.resolveEffectiveCalendarId();
      const map = this.getEventMap();
      const isDedicated = config.targetCalendarId === 'dedicated' || !config.targetCalendarId;

      // 1. Fetch all Graphdule events from the calendar
      let gcalEvents: any[] = [];
      try {
        gcalEvents = await GCalendarClient.listGraphduleEvents(calendarId, isDedicated);
      } catch (err) {
        console.warn('[GCalendarSync] Could not list existing events for clearing:', err);
      }

      // 2. Collect unique event IDs to delete (combining calendar query and local map)
      const eventIdsToDelete = new Set<string>();
      for (const ev of gcalEvents) {
        if (ev.id) eventIdsToDelete.add(ev.id);
      }
      for (const mapping of Object.values(map)) {
        if (mapping.eventId && mapping.calendarId === calendarId) {
          eventIdsToDelete.add(mapping.eventId);
        }
      }

      let count = 0;
      for (const eventId of eventIdsToDelete) {
        try {
          await GCalendarClient.deleteEvent(calendarId, eventId);
          count++;
        } catch (err) {
          console.warn(`[GCalendarSync] Failed to delete event ${eventId}:`, err);
        }
      }

      // 3. Clear local event mapping
      this.saveEventMap({});

      return {
        success: true,
        count,
      };
    } catch (err: any) {
      console.error('[GCalendarSync] Clear all events failed:', err);
      return {
        success: false,
        count: 0,
        error: err.message || 'Failed to clear events from Google Calendar.',
      };
    }
  }

  /**
   * Full bidirectional synchronization:
   * 1. Fetches all active tasks with due dates in Graphdule (project nodes + standalone tasks).
   * 2. Reads all Graphdule events in target Google Calendar.
   * 3. Uses 3-way merge to determine if local or remote date changed.
   * 4. Pushes local changes to Google Calendar and pulls external moves into Graphdule.
   * 5. Cleans up orphaned events in calendar.
   */
  public static async syncAll(storage: IStorageProvider): Promise<GCalSyncSummary> {
    if (!GDriveAuth.isAuthenticated()) {
      return {
        success: false,
        created: 0,
        updated: 0,
        pulledFromCalendar: 0,
        deleted: 0,
        calendarSummary: '',
        error: 'Not signed in with Google. Please sign in to sync with Google Calendar.',
      };
    }

    try {
      const config = this.getConfig();
      const { calendarId, summary: calendarSummary } = await this.resolveEffectiveCalendarId();
      const map = this.getEventMap();

      // 1. Gather all tasks from Graphdule
      const projects = await storage.listProjects();
      const projectDocs: ProjectDocument[] = [];
      for (const p of projects) {
        const doc = await storage.readProject(p.id);
        if (doc) projectDocs.push(doc);
      }
      const standalones = await storage.readStandaloneTasks();

      // Collect all Graphdule tasks with due dates
      interface TaskItem {
        taskId: string;
        text: string;
        dueDate: string;
        status: NodeStatus;
        projectId?: string;
        projectName?: string;
        isProjectNode: boolean;
      }

      const allTasks: TaskItem[] = [];

      for (const doc of projectDocs) {
        if (doc.project.id === DEFAULT_SAMPLE_PROJECT_ID) continue;
        for (const node of doc.nodes) {
          if (node.dueDate) {
            allTasks.push({
              taskId: node.id,
              text: node.text,
              dueDate: node.dueDate,
              status: node.status,
              projectId: doc.project.id,
              projectName: doc.project.name,
              isProjectNode: true,
            });
          }
        }
      }

      for (const st of standalones) {
        if (st.dueDate) {
          allTasks.push({
            taskId: st.id,
            text: st.text,
            dueDate: st.dueDate,
            status: st.status,
            projectId: 'standalone',
            projectName: 'Standalone Tasks',
            isProjectNode: false,
          });
        }
      }

      // 2. Fetch existing Google Calendar events for Graphdule
      const isDedicated = config.targetCalendarId === 'dedicated' || !config.targetCalendarId;
      let gcalEvents: GCalendarEventResponse[] = [];
      try {
        gcalEvents = await GCalendarClient.listGraphduleEvents(calendarId, isDedicated);
      } catch (err) {
        console.warn('[GCalendarSync] Could not list existing events, proceeding with mapping:', err);
      }

      // Group all calendar events by Graphdule taskId
      const gcalEventsByTaskId = new Map<string, GCalendarEventResponse[]>();
      for (const ev of gcalEvents) {
        let tId = ev.extendedProperties?.private?.graphduleTaskId;
        if (!tId && ev.id) {
          tId = getTaskIdFromEventId(ev.id) || undefined;
        }
        if (!tId && ev.description) {
          const match = ev.description.match(/Task ID:\s*([^\s\n]+)/);
          if (match) tId = match[1];
        }

        if (tId) {
          const list = gcalEventsByTaskId.get(tId) || [];
          list.push(ev);
          gcalEventsByTaskId.set(tId, list);
        }
      }

      let created = 0;
      let updated = 0;
      let pulledFromCalendar = 0;
      let deleted = 0;

      // Online Deduplication: If Google Calendar has multiple events for the same task, remove duplicates!
      for (const [tId, evList] of gcalEventsByTaskId.entries()) {
        if (evList.length > 1) {
          const deterministicId = toGCalEventId(tId);
          // Prefer the event that already has the deterministic ID, or the first event
          const preferred = evList.find((e) => e.id === deterministicId) || evList[0];
          for (const ev of evList) {
            if (ev.id !== preferred.id) {
              try {
                await GCalendarClient.deleteEvent(calendarId, ev.id);
                deleted++;
              } catch (delErr) {
                console.warn(`[GCalendarSync] Failed to delete duplicate event ${ev.id}:`, delErr);
              }
            }
          }
          gcalEventsByTaskId.set(tId, [preferred]);
        }
      }

      // Track modified documents to save back
      const modifiedProjectDocs = new Map<string, ProjectDocument>();
      let modifiedStandalones = false;
      const updatedStandalonesList = [...standalones];

      // 3. Process each Graphdule task
      for (const task of allTasks) {
        const existingMapping = map[task.taskId];
        const evList = gcalEventsByTaskId.get(task.taskId);
        const gcalEvent = evList && evList.length > 0 ? evList[0] : undefined;

        const gcalDate = gcalEvent?.start?.date;
        const lastSyncedDate = existingMapping?.lastSyncedDate;

        // Three-way conflict check:
        // Did date differ between Graphdule and Google Calendar?
        if (gcalEvent && gcalDate && gcalDate !== task.dueDate) {
          // If Google Calendar changed externally (gcalDate != lastSyncedDate, but task.dueDate == lastSyncedDate)
          if (lastSyncedDate && gcalDate !== lastSyncedDate && task.dueDate === lastSyncedDate) {
            // PULL date from Google Calendar to Graphdule
            if (task.isProjectNode && task.projectId) {
              let doc = modifiedProjectDocs.get(task.projectId) || projectDocs.find((d) => d.project.id === task.projectId);
              if (doc) {
                const updatedNodes = doc.nodes.map((n) =>
                  n.id === task.taskId ? { ...n, dueDate: gcalDate, updatedAt: new Date().toISOString() } : n
                );
                doc = { ...doc, nodes: updatedNodes };
                modifiedProjectDocs.set(task.projectId, doc);
                pulledFromCalendar++;
              }
            } else {
              const idx = updatedStandalonesList.findIndex((st) => st.id === task.taskId);
              if (idx >= 0) {
                updatedStandalonesList[idx] = {
                  ...updatedStandalonesList[idx],
                  dueDate: gcalDate,
                  updatedAt: new Date().toISOString(),
                };
                modifiedStandalones = true;
                pulledFromCalendar++;
              }
            }

            this.setMapping(task.taskId, {
              eventId: gcalEvent.id,
              calendarId,
              lastSyncedDate: gcalDate,
              lastSyncedText: task.text,
              lastSyncedStatus: task.status,
              projectId: task.projectId,
              updatedAt: new Date().toISOString(),
            });
            continue;
          }
          // If Graphdule changed locally or fresh sync: fall through and PUSH Graphdule date to Google Calendar!
        }

        const payload = buildEventPayload({
          taskId: task.taskId,
          taskText: task.text,
          dueDate: task.dueDate,
          status: task.status,
          projectId: task.projectId,
          projectName: task.projectName,
        });

        if (gcalEvent) {
          const needsUpdate =
            !existingMapping ||
            existingMapping.lastSyncedDate !== task.dueDate ||
            existingMapping.lastSyncedText !== task.text ||
            existingMapping.lastSyncedStatus !== task.status ||
            (gcalDate && gcalDate !== task.dueDate);

          if (needsUpdate) {
            await GCalendarClient.updateEvent(calendarId, gcalEvent.id, payload);

            this.setMapping(task.taskId, {
              eventId: gcalEvent.id,
              calendarId,
              lastSyncedDate: task.dueDate,
              lastSyncedText: task.text,
              lastSyncedStatus: task.status,
              projectId: task.projectId,
              updatedAt: new Date().toISOString(),
            });
            updated++;
          }
        } else {
          // Create new event with deterministic ID
          const createdEvent = await GCalendarClient.createEvent(calendarId, payload);
          this.setMapping(task.taskId, {
            eventId: createdEvent.id,
            calendarId,
            lastSyncedDate: task.dueDate,
            lastSyncedText: task.text,
            lastSyncedStatus: task.status,
            projectId: task.projectId,
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      }

      // 4. Clean up any orphaned Google Calendar events that no longer exist in Graphdule
      const allTaskIds = new Set(allTasks.map((t) => t.taskId));
      for (const [taskId, evList] of gcalEventsByTaskId.entries()) {
        if (!allTaskIds.has(taskId)) {
          for (const ev of evList) {
            try {
              await GCalendarClient.deleteEvent(calendarId, ev.id);
              this.removeMapping(taskId);
              deleted++;
            } catch (delErr) {
              console.warn('[GCalendarSync] Could not clean up orphaned event:', delErr);
            }
          }
        }
      }

      // 5. Write any pulled changes back to storage
      for (const [_, doc] of modifiedProjectDocs.entries()) {
        await storage.writeProject(doc);
      }
      if (modifiedStandalones) {
        await storage.writeStandaloneTasks(updatedStandalonesList);
      }

      // 6. Recalculate affected daily availability/capacity and record snapshots
      try {
        const prefs = storage.readPreferences ? await storage.readPreferences() : null;
        const capConfig = prefs?.capacityConfig || DEFAULT_CAPACITY_CONFIG;
        const historicalSnapshots = storage.readCapacitySnapshots ? await storage.readCapacitySnapshots() : [];

        // Collect dates affected by sync (dates of all tasks + today + next 7 days)
        const affectedDates = new Set<string>();
        for (const t of allTasks) {
          if (t.dueDate) affectedDates.add(t.dueDate);
        }
        const today = getTodayString();
        for (let i = 0; i < 7; i++) {
          affectedDates.add(addDays(today, i));
        }

        // Map calendar events into interval format
        const calendarIntervals: CalendarEventInterval[] = gcalEvents
          .filter((ev) => ev.start && (ev.start.dateTime || ev.start.date))
          .map((ev) => ({
            start: ev.start?.dateTime || ev.start?.date || '',
            end: ev.end?.dateTime || ev.end?.date || ev.start?.dateTime || ev.start?.date || '',
            allDay: !ev.start?.dateTime,
          }));

        const newSnapshots: DailyCapacitySnapshot[] = [];
        for (const dateStr of affectedDates) {
          const avail = CapacityService.calculateCalendarAvailability(
            calendarIntervals,
            capConfig.calendarInference.workSchedule,
            capConfig.calendarInference.minutesPerAU,
            dateStr
          );

          const plannedAU = CapacityService.calculatePlannedAU(allTasks, dateStr);
          const realizedAU = CapacityService.calculateRealizedAU(allTasks, dateStr);

          const resolved = CapacityService.resolveDailyCapacity(dateStr, capConfig, {
            calendarAvailabilityAU: avail.availableAU,
            historicalSnapshots,
          });

          newSnapshots.push(
            CapacityService.createCapacitySnapshot({
              date: dateStr,
              expectedCapacityAU: resolved.expectedCapacityAU,
              effectiveCapacityAU: resolved.effectiveCapacityAU,
              plannedAU,
              realizedAU: realizedAU > 0 ? realizedAU : undefined,
              calendarAvailabilityAU: avail.availableAU,
              userOverrideAU: capConfig.manualOverrides?.[dateStr],
              occupiedMinutes: avail.occupiedMinutes,
              confidence: resolved.confidence,
              source: 'sync',
            })
          );
        }

        if (storage.appendCapacitySnapshots && newSnapshots.length > 0) {
          await storage.appendCapacitySnapshots(newSnapshots);
        }
      } catch (capErr) {
        console.warn('[GCalendarSync] Capacity snapshot recording warning:', capErr);
      }

      this.setConfig({
        lastSyncTime: new Date().toISOString(),
      });

      return {
        success: true,
        created,
        updated,
        pulledFromCalendar,
        deleted,
        calendarSummary,
      };
    } catch (err: any) {
      console.error('[GCalendarSync] Full sync error:', err);
      return {
        success: false,
        created: 0,
        updated: 0,
        pulledFromCalendar: 0,
        deleted: 0,
        calendarSummary: '',
        error: err.message || 'Google Calendar synchronization encountered an error.',
      };
    }
  }
}
