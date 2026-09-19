import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationService } from '../../src/domain/services/migration-service';
import { ProjectService } from '../../src/domain/services/project-service';
import { DroppedThought } from '../../src/domain/models/types';

describe('Thoughts Drop Pool Storage & Backup Migration', () => {
  it('parses droppedThoughts from a full workspace backup JSON payload', () => {
    const thought1: DroppedThought = {
      id: 'thought_1',
      text: 'Backup idea',
      createdAt: '2026-09-18T10:00:00.000Z',
      updatedAt: '2026-09-18T10:00:00.000Z',
      status: 'inbox',
      projectId: 'proj_a',
      projectName: 'Alpha',
    };

    const payload = {
      backupType: 'full_workspace',
      projects: [],
      standaloneTasks: [],
      droppedThoughts: [thought1],
    };

    const res = MigrationService.parseAnyJsonPayload(payload);
    expect(res.success).toBe(true);
    if (res.success && res.payload.type === 'workspace') {
      expect(res.payload.droppedThoughts).toBeDefined();
      expect(res.payload.droppedThoughts?.length).toBe(1);
      expect(res.payload.droppedThoughts?.[0].text).toBe('Backup idea');
      expect(res.payload.droppedThoughts?.[0].projectId).toBe('proj_a');
    }
  });

  it('filters out malformed thoughts while preserving valid ones', () => {
    const payload = {
      backupType: 'full_workspace',
      projects: [],
      droppedThoughts: [
        {
          id: 'thought_valid',
          text: 'Good thought',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'inbox',
        },
        {
          id: '',
          text: '',
        },
      ],
    };

    const res = MigrationService.parseAnyJsonPayload(payload);
    expect(res.success).toBe(true);
    if (res.success && res.payload.type === 'workspace') {
      expect(res.payload.droppedThoughts?.length).toBe(1);
      expect(res.payload.droppedThoughts?.[0].id).toBe('thought_valid');
    }
  });
});
