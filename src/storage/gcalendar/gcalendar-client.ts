import { GDriveAuth } from '../gdrive/gdrive-auth';
import { addDays } from '../../domain/utils/date';
import { NodeStatus } from '../../domain/models/types';

export interface GCalendarItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

export interface GCalendarEventPayload {
  id?: string;
  summary: string;
  description?: string;
  start: { date: string };
  end: { date: string };
  colorId?: string;
  extendedProperties?: {
    private: {
      graphduleTaskId: string;
      graphduleProjectId: string;
      graphduleApp: string;
      graphduleStatus: string;
      [key: string]: string;
    };
  };
}

export interface GCalendarEventResponse {
  id: string;
  summary: string;
  description?: string;
  status: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  updated?: string;
  extendedProperties?: {
    private?: {
      graphduleTaskId?: string;
      graphduleProjectId?: string;
      graphduleApp?: string;
      graphduleStatus?: string;
      [key: string]: string | undefined;
    };
  };
}

// Color IDs in Google Calendar: 10 = Green (Completed), 5 = Banana/Yellow (In Progress), 8 = Graphite (Abandoned), 1 = Lavender/Default (Planned)
export function getGCalendarColorForStatus(status: NodeStatus): string {
  switch (status) {
    case 'completed':
      return '10'; // Basil / Green
    case 'in_progress':
      return '5'; // Banana / Yellow
    case 'abandoned':
      return '8'; // Graphite / Gray
    case 'planned':
    default:
      return '1'; // Lavender / Blue
  }
}

export function formatEventSummary(taskText: string, status: NodeStatus): string {
  const cleanText = taskText.replace(/^\[(✓|x|\?)\]\s*/i, '').trim();
  if (status === 'completed') {
    return `[✓] ${cleanText}`;
  }
  return cleanText;
}

const BASE32HEX_ALPHABET = '0123456789abcdefghijklmnopqrstuv';

/**
 * Encodes an arbitrary string into an RFC 4648 Base32Hex string (lowercase a-v, 0-9).
 * Guaranteed to satisfy Google Calendar's event ID regex: [a-v0-9]{5,1024}.
 */
export function stringToBase32Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let result = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += BASE32HEX_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32HEX_ALPHABET[(value << (5 - bits)) & 31];
  }
  return result;
}

/**
 * Decodes an RFC 4648 Base32Hex string back to the original UTF-8 string.
 */
export function base32HexToString(input: string): string {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const idx = BASE32HEX_ALPHABET.indexOf(input[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * Generates a unique, deterministic Google Calendar event ID for a given Graphdule task ID.
 * Prefixed with 'gdl' (all characters in [a-v0-9]).
 * Ensures online updates, direct lookups, and deletions are 100% deterministic and never duplicated.
 */
export function toGCalEventId(taskId: string): string {
  return `gdl${stringToBase32Hex(taskId)}`;
}

/**
 * Recovers the original Graphdule task ID from a Google Calendar event ID if it matches the 'gdl' format.
 */
export function getTaskIdFromEventId(eventId: string): string | null {
  if (!eventId || !eventId.startsWith('gdl')) return null;
  try {
    const decoded = base32HexToString(eventId.substring(3));
    return decoded || null;
  } catch {
    return null;
  }
}

export function buildEventPayload(params: {
  taskId: string;
  taskText: string;
  dueDate: string;
  status: NodeStatus;
  projectId?: string;
  projectName?: string;
  notes?: string;
}): GCalendarEventPayload {
  const { taskId, taskText, dueDate, status, projectId = 'standalone', projectName = 'Standalone Tasks', notes } = params;
  
  // RFC 5545 all-day end date is exclusive (next day)
  const nextDay = addDays(dueDate, 1);

  let description = `Project: ${projectName}\nStatus: ${status}\nTask ID: ${taskId}`;
  if (notes && notes.trim()) {
    description += `\n\nNotes:\n${notes.trim()}`;
  }
  description += '\n\n— Synchronized with Graphdule';

  return {
    id: toGCalEventId(taskId),
    summary: formatEventSummary(taskText, status),
    description,
    start: { date: dueDate },
    end: { date: nextDay },
    colorId: getGCalendarColorForStatus(status),
    extendedProperties: {
      private: {
        graphduleApp: 'graphdule',
        graphduleTaskId: taskId,
        graphduleProjectId: projectId,
        graphduleStatus: status,
      },
    },
  };
}

export class GCalendarClient {
  private static readonly BASE_URL = 'https://www.googleapis.com/calendar/v3';

  private static async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    let token = (await GDriveAuth.getValidToken()) || GDriveAuth.getToken();
    if (!token) {
      throw new Error('Not authenticated with Google. Please sign in to sync with Google Calendar.');
    }

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    let res = await fetch(url, { ...init, headers });

    if (res.status === 401) {
      const refreshRes = await GDriveAuth.refreshToken(false);
      if (refreshRes.success) {
        token = (await GDriveAuth.getValidToken()) || GDriveAuth.getToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
          res = await fetch(url, { ...init, headers });
        }
      }
    }

    return res;
  }

  /**
   * Fetch all user calendars where the user has edit/write permissions.
   */
  public static async listCalendars(): Promise<GCalendarItem[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/users/me/calendarList?minAccessRole=writer`);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch calendars (${res.status})`);
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary,
      description: item.description,
      primary: !!item.primary,
      accessRole: item.accessRole,
      backgroundColor: item.backgroundColor,
    }));
  }

  /**
   * Find existing dedicated 'Graphdule' calendar or return null.
   */
  public static async findDedicatedCalendar(): Promise<GCalendarItem | null> {
    const calendars = await this.listCalendars();
    return calendars.find((c) => c.summary === 'Graphdule') || null;
  }

  /**
   * Creates a dedicated 'Graphdule' calendar.
   */
  public static async createDedicatedCalendar(): Promise<GCalendarItem> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/calendars`, {
      method: 'POST',
      body: JSON.stringify({
        summary: 'Graphdule',
        description: 'Goal-oriented project schedules and tasks synchronized from Graphdule.',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create Graphdule calendar (${res.status})`);
    }

    const data = await res.json();
    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      primary: false,
      accessRole: 'owner',
    };
  }

  /**
   * Get or create dedicated 'Graphdule' calendar.
   */
  public static async getOrCreateDedicatedCalendar(): Promise<GCalendarItem> {
    const existing = await this.findDedicatedCalendar();
    if (existing) return existing;
    return this.createDedicatedCalendar();
  }

  public static toGCalEventId = toGCalEventId;
  public static getTaskIdFromEventId = getTaskIdFromEventId;

  /**
   * Get an event directly by its ID.
   */
  public static async getEventById(
    calendarId: string,
    eventId: string
  ): Promise<GCalendarEventResponse | null> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);

    if (res.status === 404 || res.status === 410) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && data.id && !Array.isArray(data.items)) {
      return data;
    }
    return null;
  }

  /**
   * Create an event in the specified calendar.
   * If an event with the deterministic ID already exists (409 Conflict), seamlessly updates it.
   */
  public static async createEvent(calendarId: string, payload: GCalendarEventPayload): Promise<GCalendarEventResponse> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 409 && payload.id) {
      // Event already exists with this unique deterministic ID! Update in place.
      return this.updateEvent(calendarId, payload.id, payload);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create event (${res.status})`);
    }

    return res.json();
  }

  /**
   * Update an existing event in the calendar.
   */
  public static async updateEvent(
    calendarId: string,
    eventId: string,
    payload: Partial<GCalendarEventPayload>
  ): Promise<GCalendarEventResponse> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update event (${res.status})`);
    }

    return res.json();
  }

  /**
   * Delete an event from the calendar.
   */
  public static async deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });

    if (res.status === 404 || res.status === 410) {
      return true; // Already deleted
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to delete event (${res.status})`);
    }

    return true;
  }

  /**
   * Fetch all Graphdule events from the calendar.
   * Uses pagination support.
   * If isDedicated is true, lists all events in the dedicated calendar directly.
   * Otherwise queries by privateExtendedProperty=graphduleApp=graphdule.
   */
  public static async listGraphduleEvents(calendarId: string, isDedicated: boolean = false): Promise<GCalendarEventResponse[]> {
    let allItems: GCalendarEventResponse[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const pageParam: string = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const filterParam: string = isDedicated
        ? ''
        : `privateExtendedProperty=${encodeURIComponent('graphduleApp')}=${encodeURIComponent('graphdule')}&`;
      const url: string = `${this.BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events?${filterParam}maxResults=2500&singleEvents=true${pageParam}`;
      const res: Response = await this.fetchWithAuth(url);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to list events (${res.status})`);
      }

      const data: any = await res.json();
      if (data.items && Array.isArray(data.items)) {
        allItems = allItems.concat(data.items);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    // If not dedicated, ensure items belong to Graphdule (extended property, 'gdl' prefix, or description)
    if (!isDedicated) {
      return allItems.filter(
        (ev) =>
          ev.extendedProperties?.private?.graphduleApp === 'graphdule' ||
          ev.id?.startsWith('gdl') ||
          ev.description?.includes('— Synchronized with Graphdule')
      );
    }

    return allItems;
  }

  /**
   * Find a specific Graphdule event by its taskId using privateExtendedProperty.
   */
  public static async findEventByTaskId(
    calendarId: string,
    taskId: string
  ): Promise<GCalendarEventResponse | null> {
    const url = `${this.BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=${encodeURIComponent('graphduleTaskId')}=${encodeURIComponent(taskId)}&maxResults=1&singleEvents=true`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.items && data.items.length > 0 ? data.items[0] : null;
  }
}
