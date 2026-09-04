import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Cloud,
  Download,
  X,
  ExternalLink,
} from 'lucide-react';

export const StorageWarningBanner: React.FC = () => {
  const { cloudSyncState, triggerCloudSync, setIsSyncModalOpen, exportAllData } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const [lastErrorSeen, setLastErrorSeen] = useState<string | null>(null);

  // Automatically un-dismiss whenever a new error occurs or provider state changes
  useEffect(() => {
    if (cloudSyncState.status === 'error' && cloudSyncState.error !== lastErrorSeen) {
      setDismissed(false);
      setLastErrorSeen(cloudSyncState.error || 'error');
    }
  }, [cloudSyncState.status, cloudSyncState.error, lastErrorSeen]);

  if (dismissed) return null;

  // 1. Cloud Sync Error State (Prominent Red Alert)
  if (cloudSyncState.status === 'error') {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900/60 px-3 sm:px-4 py-2.5 text-xs text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-20 shrink-0 animate-in fade-in duration-200">
        <div className="flex items-start sm:items-center space-x-2.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
          </div>
          <div className="min-w-0">
            <strong className="font-bold text-rose-700 dark:text-rose-300 mr-1.5">
              Cloud Sync Error:
            </strong>
            <span className="text-rose-800 dark:text-rose-200/90">
              {cloudSyncState.error || 'Failed to synchronize with cloud storage.'} Your data is safe in this browser.
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={triggerCloudSync}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Sync</span>
          </button>
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 dark:hover:bg-rose-800/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 font-medium transition-colors cursor-pointer"
          >
            <span>Fix</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 p-1 rounded transition-colors cursor-pointer"
            title="Dismiss error banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Active Syncing State
  if (cloudSyncState.status === 'syncing') {
    return (
      <div className="bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200 dark:border-teal-900/50 px-3 sm:px-4 py-2 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-2.5">
          <RefreshCw className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-spin shrink-0" />
          <span className="text-[11px] sm:text-xs">
            <strong className="font-semibold text-teal-800 dark:text-teal-300">
              Synchronizing with {cloudSyncState.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}...
            </strong>{' '}
            Updating projects and tasks across your devices.
          </span>
        </div>
      </div>
    );
  }

  // 3. Offline Mode
  if (cloudSyncState.status === 'offline') {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-3 sm:px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate text-[11px] sm:text-xs">
            <strong className="font-semibold text-amber-800 dark:text-amber-300">Offline Mode:</strong> Changes are saved locally.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 p-1 rounded transition-colors cursor-pointer shrink-0 ml-2"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // 4. Cloud Sync Connected & Healthy (Reassuring Green Status)
  if (cloudSyncState.provider !== 'none' && cloudSyncState.status === 'synced') {
    return (
      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200/80 dark:border-emerald-900/40 px-3 sm:px-4 py-1.5 text-xs text-emerald-900 dark:text-emerald-200/90 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate text-[11px] sm:text-xs">
            <strong className="font-semibold text-emerald-800 dark:text-emerald-300">
              Cloud Backup Active:
            </strong>{' '}
            {cloudSyncState.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}
            {cloudSyncState.user?.email ? ` (${cloudSyncState.user.email})` : ''}.
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0 ml-2">
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 hover:underline cursor-pointer"
          >
            Manage
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-1 rounded transition-colors cursor-pointer"
            title="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 5. Default Local-First Unlinked Storage (Amber Warning)
  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-3 sm:px-4 py-2 text-xs text-amber-900 dark:text-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-20 shrink-0">
      <div className="flex items-start sm:items-center space-x-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
        <span className="text-[11px] sm:text-xs leading-relaxed">
          <strong className="font-semibold text-amber-800 dark:text-amber-300">Local-First Storage:</strong> Your Graphdule data is currently stored only in this browser. Connect Cloud Sync or export backups periodically.
        </span>
      </div>
      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
        <button
          onClick={() => setIsSyncModalOpen(true)}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium shadow-xs transition-colors cursor-pointer text-xs"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Connect Cloud</span>
        </button>
        <button
          onClick={exportAllData}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-medium transition-colors cursor-pointer text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Backup</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 p-1 rounded transition-colors cursor-pointer"
          title="Dismiss warning"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

};

