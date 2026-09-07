import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GDriveAuth } from '../../storage/gdrive/gdrive-auth';
import { OneDriveAuth } from '../../storage/onedrive/onedrive-auth';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Smartphone,
  Laptop,
  LogOut,
  ChevronDown,
  ChevronUp,
  Settings,
  HardDrive,
  WifiOff,
  Calendar,
  CalendarDays,
  ExternalLink,
  Check,
  Layers,
  AlertTriangle,
  Trash2,
  Clock,
} from 'lucide-react';

export const CloudSyncModal: React.FC = () => {
  const {
    isSyncModalOpen,
    setIsSyncModalOpen,
    cloudSyncState,
    connectGoogleDrive,
    connectOneDrive,
    disconnectCloud,
    triggerCloudSync,
    gcalendarSyncConfig,
    setGCalendarSyncConfig,
    triggerGCalendarSync,
    clearAllGCalendarEvents,
    availableGCalendars,
    fetchAvailableGCalendars,
    formatDateDisplay,
    preferences,
    updatePreferences,
  } = useApp();

  const [customGdriveClientId, setCustomGdriveClientId] = useState(GDriveAuth.getCustomClientId());
  const [customOnedriveClientId, setCustomOnedriveClientId] = useState(OneDriveAuth.getCustomClientId());
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);
  const [isConnecting, setIsConnecting] = useState<'google_drive' | 'onedrive' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Google Calendar UI state
  const [isGCalSyncing, setIsGCalSyncing] = useState(false);
  const [isClearingGCal, setIsClearingGCal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [gcalFeedback, setGcalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isFetchingCalendars, setIsFetchingCalendars] = useState(false);
  const [calendarApiError, setCalendarApiError] = useState<string | null>(null);

  useEffect(() => {
    if (isSyncModalOpen && GDriveAuth.isAuthenticated()) {
      setIsFetchingCalendars(true);
      setCalendarApiError(null);
      fetchAvailableGCalendars()
        .then(() => setCalendarApiError(null))
        .catch((err: any) => {
          setCalendarApiError(err.message || 'Failed to load calendars.');
        })
        .finally(() => setIsFetchingCalendars(false));
    }
  }, [isSyncModalOpen, fetchAvailableGCalendars]);

  const handleTriggerGCalSync = async () => {
    setIsGCalSyncing(true);
    setGcalFeedback(null);
    try {
      const res = await triggerGCalendarSync();
      if (res.success) {
        setGcalFeedback({
          type: 'success',
          message: `Synced with "${res.calendarSummary}": ${res.created} created, ${res.updated} updated, ${res.pulledFromCalendar} pulled.`,
        });
      } else {
        setGcalFeedback({
          type: 'error',
          message: res.error || 'Failed to sync with Google Calendar.',
        });
      }
    } catch (err: any) {
      setGcalFeedback({
        type: 'error',
        message: err.message || 'Synchronization failed.',
      });
    } finally {
      setIsGCalSyncing(false);
    }
  };

  const handleClearAllGCalEvents = async () => {
    setIsClearingGCal(true);
    setGcalFeedback(null);
    setShowClearConfirm(false);
    try {
      const res = await clearAllGCalendarEvents();
      if (res.success) {
        setGcalFeedback({
          type: 'success',
          message: `Deleted ${res.count} Graphdule event(s) from Google Calendar.`,
        });
      } else {
        setGcalFeedback({
          type: 'error',
          message: res.error || 'Failed to clear events from Google Calendar.',
        });
      }
    } catch (err: any) {
      setGcalFeedback({
        type: 'error',
        message: err.message || 'Error occurred while clearing events.',
      });
    } finally {
      setIsClearingGCal(false);
    }
  };

  if (!isSyncModalOpen) return null;

  const handleConnectGDrive = async () => {
    setActionError(null);
    setIsConnecting('google_drive');
    try {
      const success = await connectGoogleDrive(customGdriveClientId);
      if (!success) {
        setActionError('Failed to connect Google Drive. Check client ID or popup permissions.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Google Drive connection failed.');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleConnectOneDrive = async () => {
    setActionError(null);
    setIsConnecting('onedrive');
    try {
      const success = await connectOneDrive(customOnedriveClientId);
      if (!success) {
        setActionError('Failed to connect Microsoft OneDrive. Check client ID or popup permissions.');
      }
    } catch (err: any) {
      setActionError(err.message || 'OneDrive connection failed.');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleSaveCustomClientIds = () => {
    GDriveAuth.setCustomClientId(customGdriveClientId);
    OneDriveAuth.setCustomClientId(customOnedriveClientId);
    setActionError(null);
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const datePart = formatDateDisplay(isoString.split('T')[0]);
    const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${datePart} at ${timePart}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] animate-in fade-in duration-150"
      onClick={() => setIsSyncModalOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-xs shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Cloud & Calendar Sync
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sync projects across all your devices and schedule events with Google Calendar.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSyncModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
          {/* Active Status Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="shrink-0">
                {cloudSyncState.status === 'syncing' ? (
                  <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
                ) : cloudSyncState.status === 'synced' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : cloudSyncState.status === 'offline' ? (
                  <WifiOff className="w-5 h-5 text-amber-500" />
                ) : cloudSyncState.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                ) : (
                  <HardDrive className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {cloudSyncState.provider === 'google_drive'
                      ? 'Google Drive Sync'
                      : cloudSyncState.provider === 'onedrive'
                      ? 'Microsoft OneDrive Sync'
                      : 'Local Storage Only (Offline)'}
                  </span>
                  {cloudSyncState.provider !== 'none' && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {cloudSyncState.user?.email ? (
                    <span>Account: <strong className="text-slate-700 dark:text-slate-300">{cloudSyncState.user.email}</strong> • </span>
                  ) : null}
                  Last sync: {formatLastSync(cloudSyncState.lastSyncedAt)}
                </p>
              </div>
            </div>

            {cloudSyncState.provider !== 'none' && (
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={triggerCloudSync}
                  disabled={cloudSyncState.status === 'syncing'}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{cloudSyncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                <button
                  onClick={disconnectCloud}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  title="Disconnect Cloud Provider"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Action Error Alert */}
          {actionError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Provider Selection Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Cloud Storage Provider
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Google Drive Card */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  cloudSyncState.provider === 'google_drive'
                    ? 'border-teal-500 bg-teal-50/30 dark:bg-teal-950/20 ring-1 ring-teal-500/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-base shadow-xs">
                      ▲
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          Google Drive
                        </h4>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Ready
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Google Workspace / Gmail
                      </span>
                    </div>
                  </div>
                  {cloudSyncState.provider === 'google_drive' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Stores project documents and snapshots in your private <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1 py-0.5 rounded text-[10px]">Graphdule/</code> Google Drive folder.
                </p>

                {cloudSyncState.provider === 'google_drive' ? (
                  <button
                    onClick={disconnectCloud}
                    className="w-full py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGDrive}
                    disabled={isConnecting !== null}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isConnecting === 'google_drive' ? 'Connecting...' : 'Connect Google Drive'}
                  </button>
                )}
              </div>

              {/* Microsoft OneDrive Card */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  cloudSyncState.provider === 'onedrive'
                    ? 'border-teal-500 bg-teal-50/30 dark:bg-teal-950/20 ring-1 ring-teal-500/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shadow-xs">
                      ☁
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          OneDrive
                        </h4>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Work in Progress
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Microsoft 365 / Outlook
                      </span>
                    </div>
                  </div>
                  {cloudSyncState.provider === 'onedrive' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Stores projects directly inside your secure <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1 py-0.5 rounded text-[10px]">Apps/Graphdule/</code> OneDrive app folder.
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400/90 font-medium">
                    ⚠️ OneDrive integration is currently undergoing authentication testing. Please use Google Drive for stable multi-device sync.
                  </p>
                </div>

                {cloudSyncState.provider === 'onedrive' ? (
                  <button
                    onClick={disconnectCloud}
                    className="w-full py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectOneDrive}
                    disabled={isConnecting !== null}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isConnecting === 'onedrive' ? 'Connecting...' : 'Connect OneDrive (Beta)'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Google Calendar Synchronization Card */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Google Calendar Synchronization</span>
              </h3>
              {gcalendarSyncConfig.enabled && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active</span>
                </span>
              )}
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-xs">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <span>Real-time Calendar Sync</span>
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                      Keep your project milestones, deadlines, and standalone tasks in sync with Google Calendar. Moving a task in Graphdule updates the calendar event immediately.
                    </p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={gcalendarSyncConfig.enabled}
                    onChange={(e) => {
                      if (e.target.checked && !GDriveAuth.isAuthenticated()) {
                        handleConnectGDrive();
                        return;
                      }
                      setGCalendarSyncConfig({ enabled: e.target.checked });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Connected Google Account & Calendar Options */}
              {GDriveAuth.isAuthenticated() ? (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  {/* Google Calendar API Not Enabled Alert */}
                  {calendarApiError && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div className="space-y-0.5">
                          <strong className="font-semibold block">Google Calendar API Needs Activation</strong>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                            Google requires the <strong>Google Calendar API</strong> to be enabled once in your Google Cloud project (<code>1081532507375</code>).
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <a
                          href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1081532507375"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                        >
                          <span>Enable Google Calendar API ↗</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setIsFetchingCalendars(true);
                            setCalendarApiError(null);
                            fetchAvailableGCalendars()
                              .then(() => setCalendarApiError(null))
                              .catch((e: any) => setCalendarApiError(e.message))
                              .finally(() => setIsFetchingCalendars(false));
                          }}
                          className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline cursor-pointer font-medium"
                        >
                          Retry Connection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Calendar Target Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Destination Calendar</span>
                      </span>
                      <button
                        onClick={() => {
                          setIsFetchingCalendars(true);
                          fetchAvailableGCalendars().finally(() => setIsFetchingCalendars(false));
                        }}
                        disabled={isFetchingCalendars}
                        className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isFetchingCalendars ? 'animate-spin' : ''}`} />
                        <span>Refresh list</span>
                      </button>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Option A: Dedicated "Graphdule" Calendar */}
                      <button
                        type="button"
                        onClick={() =>
                          setGCalendarSyncConfig({
                            targetCalendarId: 'dedicated',
                            targetCalendarSummary: 'Graphdule',
                          })
                        }
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          gcalendarSyncConfig.targetCalendarId === 'dedicated' || !gcalendarSyncConfig.targetCalendarId
                            ? 'border-teal-500 bg-teal-500/10 ring-1 ring-teal-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                            <span>Exclusive "Graphdule" Calendar</span>
                          </span>
                          {(gcalendarSyncConfig.targetCalendarId === 'dedicated' || !gcalendarSyncConfig.targetCalendarId) && (
                            <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          Dedicated secondary layer. Can be toggled on/off in Google Calendar anytime.
                        </span>
                      </button>

                      {/* Option B: Choose an existing calendar */}
                      <div
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                          gcalendarSyncConfig.targetCalendarId && gcalendarSyncConfig.targetCalendarId !== 'dedicated'
                            ? 'border-teal-500 bg-teal-500/10 ring-1 ring-teal-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">
                          Existing Calendar
                        </span>
                        <select
                          value={gcalendarSyncConfig.targetCalendarId === 'dedicated' ? '' : gcalendarSyncConfig.targetCalendarId}
                          onChange={(e) => {
                            const calId = e.target.value;
                            if (calId) {
                              const found = availableGCalendars.find((c) => c.id === calId);
                              setGCalendarSyncConfig({
                                targetCalendarId: calId,
                                targetCalendarSummary: found?.summary || calId,
                              });
                            }
                          }}
                          className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 focus:outline-none focus:border-teal-500 text-slate-800 dark:text-slate-200"
                        >
                          <option value="" disabled>
                            -- Select one of your calendars --
                          </option>
                          {availableGCalendars.map((cal) => (
                            <option key={cal.id} value={cal.id}>
                              {cal.summary} {cal.primary ? '(Primary)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Immediate Drag & Drop Move Sync Preference */}
                  <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={gcalendarSyncConfig.autoSyncOnDateChange}
                      onChange={(e) => setGCalendarSyncConfig({ autoSyncOnDateChange: e.target.checked })}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>Automatically move Google Calendar event when task date is dragged or changed</span>
                  </label>

                  {/* Feedback Message */}
                  {gcalFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                        gcalFeedback.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      {gcalFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      )}
                      <span>{gcalFeedback.message}</span>
                    </div>
                  )}

                  {/* Clear Calendar Events Confirmation Dialog */}
                  {showClearConfirm && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
                      <div className="flex items-start space-x-2 text-rose-800 dark:text-rose-200 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                        <div>
                          <p className="font-bold">Delete all Graphdule events from Google Calendar?</p>
                          <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                            This will remove all task events created by Graphdule from the selected Google Calendar. Your local tasks and projects in Graphdule will not be deleted.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(false)}
                          disabled={isClearingGCal}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllGCalEvents}
                          disabled={isClearingGCal}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {isClearingGCal && <RefreshCw className="w-3 h-3 animate-spin" />}
                          <span>{isClearingGCal ? 'Deleting...' : 'Yes, Delete All Events'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Last calendar sync: {formatLastSync(gcalendarSyncConfig.lastSyncTime)}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(true)}
                        disabled={isClearingGCal || isGCalSyncing}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete all Graphdule events from Google Calendar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete All Events</span>
                      </button>

                      <a
                        href="https://calendar.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                      >
                        <span>Open Calendar</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        type="button"
                        onClick={handleTriggerGCalSync}
                        disabled={isGCalSyncing || isClearingGCal}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGCalSyncing ? 'animate-spin' : ''}`} />
                        <span>{isGCalSyncing ? 'Syncing...' : 'Sync All Tasks Now'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Sign in with Google to enable calendar sync.
                  </span>
                  <button
                    onClick={handleConnectGDrive}
                    disabled={isConnecting !== null}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isConnecting === 'google_drive' ? 'Connecting...' : 'Connect Google'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sync Automation & Schedule (Modification + Idle Interval) */}
          <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-slate-100">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Sync Automation & Idle Schedule</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                Default: 15 min idle
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Graphdule is <strong>local-first</strong>: all changes are stored locally on your device immediately. When connected to cloud storage, sync runs <strong>automatically on modification</strong> (debounced) and <strong>periodically when idle</strong>. Both local storage and cloud storage remain strictly in sync.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Idle Background Sync Interval
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  How often to sync when Graphdule is idle in the background
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={preferences.idleSyncIntervalMinutes ?? 15}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value, 10);
                    updatePreferences({ idleSyncIntervalMinutes: minutes });
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={10}>Every 10 minutes</option>
                  <option value={15}>Every 15 minutes (Default)</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 60 minutes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cross-device Flow Guide */}
          <div className="p-4 rounded-2xl bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 flex items-start space-x-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center space-x-1 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
              <Laptop className="w-4 h-4" />
              <span>↔</span>
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                How multi-device sync works:
              </span>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                Sign in with the same Google or Microsoft account on your phone browser or other computers. Graphdule automatically detects newer changes and synchronizes projects, recurring tasks, and settings across all your devices.
              </p>
              <p className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                💡 Tip: Tap <strong>"Install App"</strong> in the header (or "Add to Home Screen" on iOS Safari) to run Graphdule as a full-screen native-like mobile app.
              </p>
            </div>
          </div>

          {/* Advanced OAuth Settings Drawer / Setup Guide */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowAdvancedOAuth(!showAdvancedOAuth)}
              className="flex items-center justify-between w-full text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 cursor-pointer py-1.5 px-2 rounded-xl hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-colors"
            >
              <div className="flex items-center space-x-1.5">
                <Settings className="w-3.5 h-3.5" />
                <span>Custom OAuth Client ID & Setup Guide</span>
              </div>
              {showAdvancedOAuth ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedOAuth && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
                {/* Current Origin Helper */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Your App Origin (for OAuth Whitelisting):
                    </span>
                    <code className="text-xs font-mono text-teal-600 dark:text-teal-400 select-all">
                      {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(window.location.origin);
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
                  >
                    Copy Origin
                  </button>
                </div>

                {/* Google Cloud Instructions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Google OAuth Client ID
                    </label>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center"
                    >
                      Google Cloud Console ↗
                    </a>
                  </div>
                  <input
                    type="text"
                    value={customGdriveClientId}
                    onChange={(e) => setCustomGdriveClientId(e.target.value)}
                    placeholder="e.g. 1234567890-xxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                    <strong>Quick Setup:</strong> In Google Cloud Console &gt; Credentials &gt; OAuth client ID &gt; Application type: <em>Web application</em> &gt; Add your App Origin (e.g. <code>http://localhost:5173</code>) to <strong>both</strong> <em>Authorized JavaScript origins</em> AND <em>Authorized redirect URIs</em> &gt; Save.
                  </p>
                </div>

                {/* OneDrive Instructions */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Microsoft OneDrive App Client ID
                    </label>
                    <a
                      href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center"
                    >
                      Azure Portal App Registrations ↗
                    </a>
                  </div>
                  <input
                    type="text"
                    value={customOnedriveClientId}
                    onChange={(e) => setCustomOnedriveClientId(e.target.value)}
                    placeholder="e.g. e6435d64-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                    <strong>Quick Setup:</strong> In Azure Portal &gt; App Registrations &gt; New Registration &gt; Single-page application (SPA) &gt; Set Redirect URI to your App Origin &gt; Paste Application (client) ID above.
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSaveCustomClientIds}
                    className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    Save Client IDs
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero-Lock-In & Local-First: Your data is always saved locally on your device.</span>
          </div>
          <button
            onClick={() => setIsSyncModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
