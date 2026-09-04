import React, { useState } from 'react';
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
    formatDateDisplay,
  } = useApp();

  const [customGdriveClientId, setCustomGdriveClientId] = useState(GDriveAuth.getCustomClientId());
  const [customOnedriveClientId, setCustomOnedriveClientId] = useState(OneDriveAuth.getCustomClientId());
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);
  const [isConnecting, setIsConnecting] = useState<'google_drive' | 'onedrive' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsSyncModalOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Cloud Sync & Cross-Device Access
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sync seamlessly across your desktop, laptop, tablet, and mobile phones.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSyncModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
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
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Google Drive
                      </h4>
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
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        OneDrive
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Microsoft 365 / Outlook
                      </span>
                    </div>
                  </div>
                  {cloudSyncState.provider === 'onedrive' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Stores projects directly inside your secure <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1 py-0.5 rounded text-[10px]">Apps/Graphdule/</code> OneDrive app folder.
                </p>

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
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isConnecting === 'onedrive' ? 'Connecting...' : 'Connect OneDrive'}
                  </button>
                )}
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
