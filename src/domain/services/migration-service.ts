import {
  ProjectDocumentSchema,
  StandaloneTaskSchema,
  UserPreferencesSchema,
  IdeaSeedSchema,
  ActivityEventSchema,
  WeeklyAttentionReviewRecordSchema,
} from '../models/schema';
import {
  ProjectDocument,
  StandaloneTask,
  UserPreferences,
  IdeaSeed,
  ActivityEvent,
  WeeklyAttentionReviewRecord,
} from '../models/types';

export type ParsedImportPayload =
  | {
      type: 'workspace';
      projects: ProjectDocument[];
      standaloneTasks?: StandaloneTask[];
      preferences?: UserPreferences;
      ideaSeeds?: IdeaSeed[];
      activityLog?: ActivityEvent[];
      attentionReviews?: WeeklyAttentionReviewRecord[];
    }
  | { type: 'projects_array'; projects: ProjectDocument[] }
  | { type: 'project'; document: ProjectDocument };

export class MigrationService {
  public static CURRENT_SCHEMA_VERSION = 1;

  /**
   * Normalizes a single project document object, supplying sensible defaults for missing arrays or metadata.
   */
  public static normalizeProjectObject(rawObj: Record<string, unknown>): Record<string, unknown> {
    // If project metadata is at root level instead of under `project`
    let projectMeta = rawObj.project;
    if (!projectMeta && typeof rawObj.name === 'string' && typeof rawObj.id === 'string') {
      projectMeta = {
        id: rawObj.id,
        name: rawObj.name,
        endGoalNodeId: rawObj.endGoalNodeId || ((rawObj.nodes as any[])?.[0]?.id ?? 'goal'),
        tags: rawObj.tags || [],
        status: rawObj.status || 'active',
        isAttention: Boolean(rawObj.isAttention),
        attentionPromotedAt: rawObj.attentionPromotedAt,
        archivedAt: rawObj.archivedAt,
        style: rawObj.style,
        createdAt: rawObj.createdAt || new Date().toISOString(),
        updatedAt: rawObj.updatedAt || new Date().toISOString(),
      };
    }

    return {
      schemaVersion: (rawObj.schemaVersion as number) || 1,
      exportedAt: (rawObj.exportedAt as string) || new Date().toISOString(),
      project: projectMeta,
      nodes: Array.isArray(rawObj.nodes) ? rawObj.nodes : [],
      edges: Array.isArray(rawObj.edges) ? rawObj.edges : [],
      notes: Array.isArray(rawObj.notes) ? rawObj.notes : [],
      history: Array.isArray(rawObj.history) ? rawObj.history : [],
    };
  }

  /**
   * Validates and if necessary migrates a single project document JSON to the current schema version.
   */
  public static parseAndMigrate(
    rawJson: unknown
  ): { success: true; document: ProjectDocument } | { success: false; error: string } {
    if (typeof rawJson !== 'object' || rawJson === null) {
      return { success: false, error: 'Invalid JSON: root must be an object.' };
    }

    const docObj = rawJson as Record<string, unknown>;
    const schemaVersion = (docObj.schemaVersion as number) || 1;

    if (schemaVersion > this.CURRENT_SCHEMA_VERSION) {
      return {
        success: false,
        error: `Document has schema version ${schemaVersion}, but this application only supports up to ${this.CURRENT_SCHEMA_VERSION}. Please update the application.`,
      };
    }

    const normalizedData = this.normalizeProjectObject(docObj);

    // Validate with Zod
    const parseResult = ProjectDocumentSchema.safeParse(normalizedData);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Schema validation failed: ${errorMsg}` };
    }

    return { success: true, document: parseResult.data as ProjectDocument };
  }

  /**
   * Parses any valid import payload: full workspace backup, list of projects, or single project.
   */
  public static parseAnyJsonPayload(
    rawJson: unknown
  ): { success: true; payload: ParsedImportPayload } | { success: false; error: string } {
    if (typeof rawJson !== 'object' || rawJson === null) {
      return { success: false, error: 'Invalid JSON: root must be an object or array.' };
    }

    // 1. Array of projects
    if (Array.isArray(rawJson)) {
      const validDocs: ProjectDocument[] = [];
      for (let i = 0; i < rawJson.length; i++) {
        const itemRes = this.parseAndMigrate(rawJson[i]);
        if (!itemRes.success) {
          return { success: false, error: `Project at index ${i} failed validation: ${itemRes.error}` };
        }
        validDocs.push(itemRes.document);
      }
      return { success: true, payload: { type: 'projects_array', projects: validDocs } };
    }

    const obj = rawJson as Record<string, unknown>;

    // 2. Full Workspace Backup
    if (obj.backupType === 'full_workspace' || Array.isArray(obj.projects)) {
      const rawProjects = Array.isArray(obj.projects) ? (obj.projects as unknown[]) : [];
      const validDocs: ProjectDocument[] = [];
      for (let i = 0; i < rawProjects.length; i++) {
        const itemRes = this.parseAndMigrate(rawProjects[i]);
        if (itemRes.success) {
          validDocs.push(itemRes.document);
        }
      }

      const validStandalones: StandaloneTask[] = [];
      if (Array.isArray(obj.standaloneTasks)) {
        for (const st of obj.standaloneTasks) {
          const parsedSt = StandaloneTaskSchema.safeParse(st);
          if (parsedSt.success) {
            validStandalones.push(parsedSt.data as StandaloneTask);
          }
        }
      }

      let validPrefs: UserPreferences | undefined;
      if (obj.preferences && typeof obj.preferences === 'object') {
        const parsedPrefs = UserPreferencesSchema.safeParse(obj.preferences);
        if (parsedPrefs.success) {
          validPrefs = parsedPrefs.data as UserPreferences;
        }
      }

      const validSeeds: IdeaSeed[] = [];
      if (Array.isArray(obj.ideaSeeds)) {
        for (const seed of obj.ideaSeeds) {
          const parsedSeed = IdeaSeedSchema.safeParse(seed);
          if (parsedSeed.success) {
            validSeeds.push(parsedSeed.data as IdeaSeed);
          }
        }
      }

      const validEvents: ActivityEvent[] = [];
      if (Array.isArray(obj.activityLog)) {
        for (const ev of obj.activityLog) {
          const parsedEvent = ActivityEventSchema.safeParse(ev);
          if (parsedEvent.success) {
            validEvents.push(parsedEvent.data as ActivityEvent);
          }
        }
      }

      const validReviews: WeeklyAttentionReviewRecord[] = [];
      if (Array.isArray(obj.attentionReviews)) {
        for (const rev of obj.attentionReviews) {
          const parsedRev = WeeklyAttentionReviewRecordSchema.safeParse(rev);
          if (parsedRev.success) {
            validReviews.push(parsedRev.data as unknown as WeeklyAttentionReviewRecord);
          }
        }
      }

      return {
        success: true,
        payload: {
          type: 'workspace',
          projects: validDocs,
          standaloneTasks: validStandalones.length > 0 ? validStandalones : undefined,
          preferences: validPrefs,
          ideaSeeds: validSeeds.length > 0 ? validSeeds : undefined,
          activityLog: validEvents.length > 0 ? validEvents : undefined,
          attentionReviews: validReviews.length > 0 ? validReviews : undefined,
        },
      };
    }

    // 3. Single Project Document
    const singleRes = this.parseAndMigrate(obj);
    if (singleRes.success) {
      return { success: true, payload: { type: 'project', document: singleRes.document } };
    }

    return { success: false, error: singleRes.error };
  }
}

