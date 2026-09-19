import { describe, it, expect } from 'vitest';
import { ProjectService } from '../../src/domain/services/project-service';
import { DroppedThoughtSchema } from '../../src/domain/models/schema';

describe('ProjectService - Thoughts Drop Pool Domain Logic', () => {
  it('creates a new DroppedThought with inbox status and timestamps', () => {
    const thought = ProjectService.createDroppedThought('Check redis cache ttl', {
      projectId: 'proj_1',
      projectName: 'Alpha Project',
      originTaskId: 'node_10',
      originTaskText: 'Optimize endpoints',
    });

    expect(thought.id).toMatch(/^thought_/);
    expect(thought.text).toBe('Check redis cache ttl');
    expect(thought.status).toBe('inbox');
    expect(thought.projectId).toBe('proj_1');
    expect(thought.projectName).toBe('Alpha Project');
    expect(thought.originTaskId).toBe('node_10');
    expect(thought.originTaskText).toBe('Optimize endpoints');
    expect(new Date(thought.createdAt).getTime()).not.toBeNaN();
    expect(new Date(thought.updatedAt).getTime()).not.toBeNaN();

    const parsed = DroppedThoughtSchema.safeParse(thought);
    expect(parsed.success).toBe(true);
  });

  it('updates an existing thought text or status', () => {
    const thought = ProjectService.createDroppedThought('Original idea');
    const updated = ProjectService.updateDroppedThought(thought, {
      text: 'Refined idea',
    });

    expect(updated.id).toBe(thought.id);
    expect(updated.text).toBe('Refined idea');
    expect(updated.createdAt).toBe(thought.createdAt);
  });

  it('marks a thought as converted with target reference', () => {
    const thought = ProjectService.createDroppedThought('New feature task');
    const converted = ProjectService.markDroppedThoughtConverted(thought, {
      type: 'node',
      entityId: 'node_123',
      entityText: 'New feature task',
    });

    expect(converted.status).toBe('converted');
    expect(converted.convertedTarget).toEqual({
      type: 'node',
      entityId: 'node_123',
      entityText: 'New feature task',
    });
  });

  it('marks a thought as dismissed', () => {
    const thought = ProjectService.createDroppedThought('Discarded thought');
    const dismissed = ProjectService.markDroppedThoughtDismissed(thought);

    expect(dismissed.status).toBe('dismissed');
  });

  it('validates schema correctly and rejects empty text or missing id', () => {
    const valid = DroppedThoughtSchema.safeParse({
      id: 'thought_1',
      text: 'Valid text',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'inbox',
    });
    expect(valid.success).toBe(true);

    const invalid = DroppedThoughtSchema.safeParse({
      id: '',
      text: '',
    });
    expect(invalid.success).toBe(false);
  });
});
