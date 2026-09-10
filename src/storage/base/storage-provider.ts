import {
  ProjectDocument,
  ProjectSnapshot,
  SnapshotMetadata,
  StandaloneTask,
  UserPreferences,
  ProjectSummary,
  IdeaSeed,
  ActivityEvent,
  WeeklyAttentionReviewRecord,
  DailyCapacitySnapshot,
} from '../../domain/models/types';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudUserInfo {
  readonly email?: string;
  readonly name?: string;
  readonly avatarUrl?: string;
}

export interface StorageProviderInfo {
  readonly id: 'browser' | 'local_file' | 'google_drive' | 'onedrive' | 'dropbox';
  readonly name: string;
  readonly isConnected: boolean;
  readonly isLocalOnly: boolean;
  readonly syncStatus?: CloudSyncStatus;
  readonly user?: CloudUserInfo;
  readonly lastSyncAt?: string;
  readonly statusMessage: string;
}

export interface IStorageProvider {
  readonly info: StorageProviderInfo;

  init(): Promise<void>;
  listProjects(): Promise<ProjectSummary[]>;
  readProject(projectId: string): Promise<ProjectDocument | null>;
  writeProject(projectDoc: ProjectDocument): Promise<void>;
  deleteProject(projectId: string): Promise<void>;

  readStandaloneTasks(): Promise<StandaloneTask[]>;
  writeStandaloneTasks(tasks: StandaloneTask[]): Promise<void>;

  readPreferences(): Promise<UserPreferences>;
  writePreferences(prefs: UserPreferences): Promise<void>;

  listSnapshots(projectId: string): Promise<SnapshotMetadata[]>;
  readSnapshot(projectId: string, snapshotId: string): Promise<ProjectSnapshot | null>;
  writeSnapshot(snapshot: ProjectSnapshot): Promise<void>;

  readIdeaSeeds?(): Promise<IdeaSeed[]>;
  writeIdeaSeeds?(seeds: IdeaSeed[]): Promise<void>;
  deleteIdeaSeed?(seedId: string): Promise<void>;

  readActivityLog?(): Promise<ActivityEvent[]>;
  appendActivityEvents?(events: ActivityEvent[]): Promise<void>;
  deleteActivityEvents?(eventIds: string[]): Promise<void>;
  updateActivityEvent?(event: ActivityEvent): Promise<void>;
  clearActivityLog?(): Promise<void>;

  readAttentionReviews?(): Promise<WeeklyAttentionReviewRecord[]>;
  writeAttentionReviews?(reviews: WeeklyAttentionReviewRecord[]): Promise<void>;
  deleteAttentionReview?(reviewId: string): Promise<void>;

  readCapacitySnapshots?(): Promise<DailyCapacitySnapshot[]>;
  writeCapacitySnapshots?(snapshots: DailyCapacitySnapshot[]): Promise<void>;
  appendCapacitySnapshots?(snapshots: DailyCapacitySnapshot[]): Promise<void>;
}
