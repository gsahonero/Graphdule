import { ProjectDocumentSchema } from '../models/schema';
import { ProjectDocument } from '../models/types';

export class MigrationService {
  public static CURRENT_SCHEMA_VERSION = 1;

  /**
   * Validates and if necessary migrates a project document JSON to the current schema version.
   */
  public static parseAndMigrate(rawJson: unknown): { success: true; document: ProjectDocument } | { success: false; error: string } {
    if (typeof rawJson !== 'object' || rawJson === null) {
      return { success: false, error: 'Invalid JSON: root must be an object.' };
    }

    const docObj = rawJson as Record<string, unknown>;
    const schemaVersion = (docObj.schemaVersion as number) || 1;

    let currentData = docObj;

    // Schema migration chain if future versions exist
    if (schemaVersion > this.CURRENT_SCHEMA_VERSION) {
      return {
        success: false,
        error: `Document has schema version ${schemaVersion}, but this application only supports up to ${this.CURRENT_SCHEMA_VERSION}. Please update the application.`,
      };
    }

    // Future version migrations: e.g. if (schemaVersion === 1) { currentData = migrateV1toV2(currentData); }

    // Validate with Zod
    const parseResult = ProjectDocumentSchema.safeParse(currentData);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Schema validation failed: ${errorMsg}` };
    }

    return { success: true, document: parseResult.data as ProjectDocument };
  }
}
