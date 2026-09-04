import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  WifiOff,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const { cloudSyncState, gcalendarSyncConfig, setIsSyncModalOpen } = useApp();

  const isCloudConnected = cloudSyncState.provider !== 'none';
  const isCalendarConnected = gcalendarSyncConfig.enabled;
  const isAnyConnected = isCloudConnected || isCalendarConnected;
  const isSyncing = cloudSyncState.status === 'syncing';
  const isError = cloudSyncState.status === 'error';
  const isOffline = cloudSyncState.status === 'offline';

  const getButtonText = () => {
    if (isSyncing) return 'Syncing...';
    if (isError) return 'Sync Error';
    if (isOffline) return 'Offline';

    if (isCloudConnected && isCalendarConnected) {
      const providerShort = cloudSyncState.provider === 'google_drive' ? 'GDrive' : 'OneDrive';
      return `${providerShort} + Cal`;
    }

    if (isCloudConnected) {
      return cloudSyncState.provider === 'google_drive' ? 'GDrive Synced' : 'OneDrive Synced';
    }

    if (isCalendarConnected) {
      return 'Calendar Synced';
    }

    return 'Cloud & Calendar Sync';
  };

  const getTitle = () => {
    const parts: string[] = [];
    if (isCloudConnected) {
      parts.push(cloudSyncState.provider === 'google_drive' ? 'Google Drive' : 'OneDrive');
    }
    if (isCalendarConnected) {
      parts.push(`Google Calendar (${gcalendarSyncConfig.targetCalendarSummary || 'Graphdule'})`);
    }

    if (parts.length > 0) {
      return `Connected: ${parts.join(' & ')} (Click to manage sync)`;
    }
    return 'Cloud & Calendar Sync (Click to connect Google Drive or Google Calendar)';
  };

  return (
    <button
      onClick={() => setIsSyncModalOpen(true)}
      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs ${
        isSyncing
          ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
          : isError
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
          : isOffline
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          : isAnyConnected
          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800/60 hover:bg-teal-100'
          : 'bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
      }`}
      title={getTitle()}
    >
      {/* Icons */}
      {isSyncing ? (
        <RefreshCw className="w-3.5 h-3.5 text-teal-500 animate-spin" />
      ) : isError ? (
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
      ) : isOffline ? (
        <WifiOff className="w-3.5 h-3.5 text-amber-500" />
      ) : (
        <div className="flex items-center -space-x-1">
          <Cloud className={`w-3.5 h-3.5 ${isCloudConnected ? 'text-teal-500' : 'text-slate-400'}`} />
          <CalendarDays className={`w-3 h-3 ${isCalendarConnected ? 'text-blue-500' : 'text-slate-400'}`} />
        </div>
      )}

      {/* Text Label */}
      <span className="font-medium whitespace-nowrap hidden sm:inline">
        {getButtonText()}
      </span>
      <span className="font-medium whitespace-nowrap sm:hidden">
        {isSyncing ? 'Syncing' : isError ? 'Error' : isOffline ? 'Offline' : isAnyConnected ? 'Synced' : 'Sync'}
      </span>

      {/* Status Dot / Checkmark */}
      {isAnyConnected && !isSyncing && !isError && !isOffline && (
        <CheckCircle2 className="w-3 h-3 text-teal-500 hidden sm:inline" />
      )}
    </button>
  );
};
