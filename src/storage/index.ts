import { IStorageProvider } from './base/storage-provider';
import { IndexedDBProvider } from './idb/indexeddb-provider';

export * from './base/storage-provider';
export * from './idb/indexeddb-provider';
export * from './file/json-file-provider';
export * from './gdrive/gdrive-auth';
export * from './gdrive/gdrive-client';
export * from './onedrive/onedrive-auth';
export * from './onedrive/onedrive-client';
export * from './sync/sync-coordinator';

// Default global storage provider for the application
export const defaultStorageProvider: IStorageProvider = new IndexedDBProvider();
