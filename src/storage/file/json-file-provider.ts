import { ProjectDocument } from '../../domain/models/types';
import { MigrationService } from '../../domain/services/migration-service';

export class JsonFileProvider {
  /**
   * Triggers a browser download of the canonical project JSON.
   */
  public static exportProjectToFile(doc: ProjectDocument): void {
    const filename = `${doc.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-graphdule.json`;
    const jsonString = JSON.stringify(doc, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Reads and parses a canonical JSON string into a validated ProjectDocument.
   */
  public static parseProjectFileContent(
    content: string
  ): { success: true; document: ProjectDocument } | { success: false; error: string } {
    try {
      const parsed = JSON.parse(content);
      return MigrationService.parseAndMigrate(parsed);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Invalid JSON syntax: ${errorMsg}` };
    }
  }

  /**
   * Exports an entire workspace backup (all projects, standalone tasks, preferences).
   */
  public static exportFullWorkspaceBackup(payload: {
    projects: ProjectDocument[];
    standaloneTasks: unknown[];
    preferences: unknown;
  }): void {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `graphdule-backup-${dateStr}.json`;
    const jsonString = JSON.stringify(
      {
        schemaVersion: MigrationService.CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        backupType: 'full_workspace',
        ...payload,
      },
      null,
      2
    );

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
