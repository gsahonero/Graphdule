import { IStorageProvider } from '../storage/base/storage-provider';
import {
  ProjectDocument,
  ProjectSummary,
  Node,
  Edge,
  Note,
  StandaloneTask,
  SnapshotMetadata,
} from '../domain/models/types';
import { GraphService } from '../domain/services/graph-service';
import { MyDayService } from '../domain/services/my-day-service';
import { getTodayString, isBefore } from '../domain/utils/date';

export class GraphduleMcpApi {
  constructor(private storage: IStorageProvider) {}

  public async getProjects(): Promise<ProjectSummary[]> {
    return this.storage.listProjects();
  }

  public async getProject(projectId: string): Promise<ProjectDocument | null> {
    return this.storage.readProject(projectId);
  }

  public async getProjectGraph(
    projectId: string
  ): Promise<{ project: ProjectDocument['project']; nodes: readonly Node[]; edges: readonly Edge[] } | null> {
    const doc = await this.storage.readProject(projectId);
    if (!doc) return null;
    return {
      project: doc.project,
      nodes: doc.nodes,
      edges: doc.edges,
    };
  }

  public async getProjectNodes(projectId: string): Promise<readonly Node[]> {
    const doc = await this.storage.readProject(projectId);
    return doc ? doc.nodes : [];
  }

  public async getProjectNodesByDate(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<Node[]> {
    const doc = await this.storage.readProject(projectId);
    if (!doc) return [];
    return doc.nodes.filter((n) => n.dueDate >= startDate && n.dueDate <= endDate);
  }

  public async getCurrentTasks(mode?: 'today' | 'current_tasks'): Promise<{
    mode: string;
    isFallback: boolean;
    projectTasks: Node[];
    standaloneTasks: StandaloneTask[];
  }> {
    const projects = await this.storage.listProjects();
    const allProjectNodes: Node[] = [];
    for (const p of projects) {
      const doc = await this.storage.readProject(p.id);
      if (doc) {
        allProjectNodes.push(...doc.nodes);
      }
    }

    const standaloneTasks = await this.storage.readStandaloneTasks();
    const prefs = await this.storage.readPreferences();
    const effectiveMode = mode || prefs.myDayMode;

    const result = MyDayService.getMyDayTasks(
      allProjectNodes,
      standaloneTasks,
      effectiveMode,
      getTodayString()
    );

    return {
      mode: result.mode,
      isFallback: result.isFallback,
      projectTasks: result.projectTasks,
      standaloneTasks: result.standaloneTasks,
    };
  }

  public async getOverdueTasks(): Promise<{
    projectTasks: Node[];
    standaloneTasks: StandaloneTask[];
  }> {
    const today = getTodayString();
    const projects = await this.storage.listProjects();
    const overdueProjectTasks: Node[] = [];

    for (const p of projects) {
      const doc = await this.storage.readProject(p.id);
      if (doc) {
        const overdue = doc.nodes.filter(
          (n) => isBefore(n.dueDate, today) && (n.status === 'planned' || n.status === 'in_progress')
        );
        overdueProjectTasks.push(...overdue);
      }
    }

    const standalone = await this.storage.readStandaloneTasks();
    const overdueStandalone = standalone.filter(
      (t) => isBefore(t.dueDate, today) && (t.status === 'planned' || t.status === 'in_progress')
    );

    return {
      projectTasks: overdueProjectTasks,
      standaloneTasks: overdueStandalone,
    };
  }

  public async getNode(
    nodeId: string
  ): Promise<{ node: Node; projectId?: string; notes: Note[] } | null> {
    const projects = await this.storage.listProjects();
    for (const p of projects) {
      const doc = await this.storage.readProject(p.id);
      if (doc) {
        const node = doc.nodes.find((n) => n.id === nodeId);
        if (node) {
          const notes = doc.notes.filter((note) => note.nodeId === nodeId);
          return { node, projectId: p.id, notes };
        }
      }
    }
    return null;
  }

  public async getNodeNotes(nodeId: string): Promise<Note[]> {
    const nodeInfo = await this.getNode(nodeId);
    return nodeInfo ? nodeInfo.notes : [];
  }

  public async getNodeDependencies(
    nodeId: string
  ): Promise<{ predecessors: Node[]; successors: Node[] } | null> {
    const projects = await this.storage.listProjects();
    for (const p of projects) {
      const doc = await this.storage.readProject(p.id);
      if (doc) {
        const node = doc.nodes.find((n) => n.id === nodeId);
        if (node) {
          const preds = GraphService.getDirectPredecessors(nodeId, doc.nodes, doc.edges);
          const succs = GraphService.getDirectSuccessors(nodeId, doc.nodes, doc.edges);
          return { predecessors: preds, successors: succs };
        }
      }
    }
    return null;
  }

  public async getProjectHistory(projectId: string): Promise<SnapshotMetadata[]> {
    return this.storage.listSnapshots(projectId);
  }

  public async getCompletedTasks(projectId: string): Promise<Node[]> {
    const doc = await this.storage.readProject(projectId);
    return doc ? doc.nodes.filter((n) => n.status === 'completed') : [];
  }

  public async getAbandonedTasks(projectId: string): Promise<Node[]> {
    const doc = await this.storage.readProject(projectId);
    return doc ? doc.nodes.filter((n) => n.status === 'abandoned') : [];
  }
}
