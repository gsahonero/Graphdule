import { describe, it, expect, beforeEach } from 'vitest';
import { IStorageProvider, StorageProviderInfo } from '../../src/storage/base/storage-provider';
import {
  ProjectDocument,
  ProjectSnapshot,
  SnapshotMetadata,
  StandaloneTask,
  UserPreferences,
  ProjectSummary,
} from '../../src/domain/models/types';
import { ProjectService } from '../../src/domain/services/project-service';
import { GraphduleMcpApi } from '../../src/mcp/mcp-domain-api';

class InMemoryStorageProvider implements IStorageProvider {
  public info: StorageProviderInfo = {
    id: 'browser',
    name: 'In-Memory Mock',
    isConnected: true,
    isLocalOnly: true,
    statusMessage: 'In Memory',
  };

  private projects = new Map<string, ProjectDocument>();
  private standaloneTasks: StandaloneTask[] = [];
  private preferences: UserPreferences = {
    myDayMode: 'today',
    theme: 'dark',
    onboardingCompleted: false,
    preferredStorageProvider: 'browser',
  };
  private snapshots: ProjectSnapshot[] = [];

  public async init(): Promise<void> {}

  public async listProjects(): Promise<ProjectSummary[]> {
    return Array.from(this.projects.values()).map((doc) =>
      ProjectService.getProjectSummary(doc.project, doc.nodes)
    );
  }

  public async readProject(projectId: string): Promise<ProjectDocument | null> {
    return this.projects.get(projectId) || null;
  }

  public async writeProject(projectDoc: ProjectDocument): Promise<void> {
    this.projects.set(projectDoc.project.id, projectDoc);
  }

  public async deleteProject(projectId: string): Promise<void> {
    this.projects.delete(projectId);
  }

  public async readStandaloneTasks(): Promise<StandaloneTask[]> {
    return this.standaloneTasks;
  }

  public async writeStandaloneTasks(tasks: StandaloneTask[]): Promise<void> {
    this.standaloneTasks = tasks;
  }

  public async readPreferences(): Promise<UserPreferences> {
    return this.preferences;
  }

  public async writePreferences(prefs: UserPreferences): Promise<void> {
    this.preferences = prefs;
  }

  public async listSnapshots(projectId: string): Promise<SnapshotMetadata[]> {
    return this.snapshots
      .filter((s) => s.projectId === projectId)
      .map((s) => ({
        id: s.id,
        projectId: s.projectId,
        message: s.message,
        timestamp: s.timestamp,
        nodeCount: s.document.nodes.length,
        edgeCount: s.document.edges.length,
      }));
  }

  public async readSnapshot(_projectId: string, snapshotId: string): Promise<ProjectSnapshot | null> {
    return this.snapshots.find((s) => s.id === snapshotId) || null;
  }

  public async writeSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    this.snapshots.push(snapshot);
  }
}

describe('MCP Domain API', () => {
  let storage: InMemoryStorageProvider;
  let mcp: GraphduleMcpApi;

  beforeEach(async () => {
    storage = new InMemoryStorageProvider();
    mcp = new GraphduleMcpApi(storage);

    // Populate test project
    const { project, egnNode } = ProjectService.createProject('PhD Paper', 'Submit Paper', '2026-10-30');
    const nodeA = ProjectService.createNode(project.id, 'Run Experiment', '2026-09-10');
    const nodeB = ProjectService.createNode(project.id, 'Analyze MRI', '2026-09-20');
    const edge = ProjectService.createEdge(project.id, nodeA.id, nodeB.id, [nodeA, nodeB, egnNode], []);

    const doc: ProjectDocument = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project,
      nodes: [nodeA, nodeB, egnNode],
      edges: edge.success ? [edge.edge] : [],
      notes: [
        {
          id: 'note_1',
          nodeId: nodeA.id,
          text: 'Repeat acquisition with corrected gradient table',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      history: [],
    };

    await storage.writeProject(doc);
  });

  it('retrieves project summaries via getProjects', async () => {
    const projects = await mcp.getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('PhD Paper');
    expect(projects[0].endGoalText).toBe('Submit Paper');
  });

  it('retrieves project graphs via getProjectGraph', async () => {
    const projects = await mcp.getProjects();
    const graph = await mcp.getProjectGraph(projects[0].id);
    expect(graph).not.toBeNull();
    expect(graph?.nodes).toHaveLength(3);
    expect(graph?.edges).toHaveLength(1);
  });

  it('retrieves node dependencies via getNodeDependencies', async () => {
    const projects = await mcp.getProjects();
    const doc = (await mcp.getProject(projects[0].id))!;
    const nodeB = doc.nodes.find((n) => n.text === 'Analyze MRI')!;

    const deps = await mcp.getNodeDependencies(nodeB.id);
    expect(deps).not.toBeNull();
    expect(deps?.predecessors).toHaveLength(1);
    expect(deps?.predecessors[0].text).toBe('Run Experiment');
  });

  it('retrieves node notes via getNodeNotes', async () => {
    const projects = await mcp.getProjects();
    const doc = (await mcp.getProject(projects[0].id))!;
    const nodeA = doc.nodes.find((n) => n.text === 'Run Experiment')!;

    const notes = await mcp.getNodeNotes(nodeA.id);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain('Repeat acquisition');
  });
});
