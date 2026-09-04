import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  WifiOff,
  AlertCircle,
} from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const { cloudSyncState, setIsSyncModalOpen } = useApp();

  const getProviderLabel = () => {
    switch (cloudSyncState.provider) {
      case 'google_drive':
        return 'Google Drive';
      case 'onedrive':
        return 'OneDrive';
      default:
        return 'Local Storage';
    }
  };

  const isConnected = cloudSyncState.provider !== 'none';

  return (
    <button
      onClick={() => setIsSyncModalOpen(true)}
      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs ${
        isConnected
          ? cloudSyncState.status === 'syncing'
            ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
            : cloudSyncState.status === 'error'
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            : cloudSyncState.status === 'offline'
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800/60 hover:bg-teal-100'
          : 'bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
      }`}
      title={`Storage: ${getProviderLabel()} (Click to manage cloud sync & multi-device access)`}
    >
      {/* Icon */}
      {isConnected ? (
        cloudSyncState.status === 'syncing' ? (
          <RefreshCw className="w-3.5 h-3.5 text-teal-500 animate-spin" />
        ) : cloudSyncState.status === 'error' ? (
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
        ) : cloudSyncState.status === 'offline' ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Cloud className="w-3.5 h-3.5 text-teal-500" />
        )
      ) : (
        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
      )}

      {/* Text Label */}
      <span className="hidden sm:inline font-medium">
        {isConnected
          ? cloudSyncState.status === 'syncing'
            ? 'Syncing...'
            : cloudSyncState.provider === 'google_drive'
            ? 'GDrive'
            : 'OneDrive'
          : 'Sync Cloud'}
      </span>

      {/* Tiny Status Dot */}
      {isConnected && cloudSyncState.status === 'synced' && (
        <CheckCircle2 className="w-3 h-3 text-teal-500 hidden sm:inline" />
      )}
    </button>
  );
};
