import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { appConfig } from '../../config';
import {
  FolderKanban,
  Sun,
  Moon,
  Download,
  Upload,
  HelpCircle,
  Calendar,
  CalendarDays,
  Smartphone,
  MoreVertical,
  Coffee,
  Clock,
  Cloud,
  Scale,
} from 'lucide-react';
import { SyncStatusIndicator } from './SyncStatusIndicator';

export const Header: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    activeProjectDoc,
    preferences,
    updatePreferences,
    toggleDateFormat,
    setIsOnboardingOpen,
    exportAllData,
    importProjectJson,
    activeWorkSession,
    setIsSyncModalOpen,
    cloudSyncState,
    gcalendarSyncConfig,
    setIsCapacityConfigModalOpen,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const standaloneCheck =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standaloneCheck);

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert(
          '📱 To install Graphdule on iPhone/iPad:\n\n1. Tap the Share button (⎋) in Safari.\n2. Scroll down and tap "Add to Home Screen" (➕).\n3. Tap "Add" in the top right.'
        );
      } else {
        alert(
          '💻 To install Graphdule as an app:\n\nClick the Install icon (computer/down arrow) in your browser address bar (Chrome, Edge, or Android).'
        );
      }
    }
  };

  const toggleTheme = () => {
    const nextTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: nextTheme });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = await importProjectJson(content);
        if (!res.success) {
          alert(`Failed to import file: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none transition-colors duration-150 pt-[env(safe-area-inset-top,0px)] min-h-[calc(3.5rem+env(safe-area-inset-top,0px))]">
      {/* Brand */}
      <div
        id="header-brand"
        className="flex items-center space-x-2 sm:space-x-3 cursor-pointer shrink-0"
        onClick={() => setCurrentView('projects')}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-600/20 border border-emerald-500/30 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shadow-sm shrink-0">
          <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-800 dark:text-slate-100 tracking-tight text-sm sm:text-base">
              {appConfig.name}
            </span>
            <span className="hidden sm:inline-block text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              v{appConfig.version}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block truncate">
            {appConfig.tagline}
          </p>
        </div>
      </div>

      {/* Main Navigation (Desktop only, mobile uses BottomNav) */}
      <nav className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-950/60 p-0.5 sm:p-1 rounded-lg border border-slate-200 dark:border-slate-800/80 shrink-0 mx-1">
        <button
          id="nav-projects"
          onClick={() => setCurrentView(activeProjectDoc ? 'project_detail' : 'projects')}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            currentView === 'projects' || currentView === 'project_detail'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5 shrink-0" />
          <span>Projects</span>
          {activeProjectDoc && currentView === 'project_detail' && (
            <span className="hidden md:inline max-w-[120px] truncate text-slate-500 dark:text-slate-300 font-normal ml-1">
              / {activeProjectDoc.project.name}
            </span>
          )}
        </button>

        <button
          id="nav-my-day"
          onClick={() => setCurrentView('my_day')}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            currentView === 'my_day'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
          }`}
        >
          <Sun className="w-3.5 h-3.5 shrink-0" />
          <span>My Day</span>
        </button>

        <button
          id="nav-calendar"
          onClick={() => setCurrentView('calendar')}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            currentView === 'calendar'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span>Calendar</span>
        </button>

        <button
          id="nav-attention-review"
          onClick={() => setCurrentView('attention_review')}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            currentView === 'attention_review'
              ? 'bg-white dark:bg-slate-800 text-amber-500 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-transparent'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Attention</span>
          {activeWorkSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
          )}
        </button>
      </nav>

      {/* Storage & Tools */}
      <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
        {/* Unified Cloud & Calendar Sync status indicator (always visible) */}
        <SyncStatusIndicator />

        {/* Desktop-Only Action Buttons */}
        <div className="hidden md:flex items-center space-x-1.5">
          {/* Install Web App Button */}
          {!isStandalone && (
            <button
              onClick={handleInstallApp}
              title="Install Graphdule as App on your Desktop or Phone"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          {/* Export Full Backup */}
          <button
            onClick={exportAllData}
            title="Download Full Backup (JSON)"
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Import JSON */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import Project from JSON"
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Date Format Toggle */}
          <button
            onClick={toggleDateFormat}
            title={`Date Format: ${preferences.dateFormat === 'MMM_D_YYYY' ? 'Month, Day (Year)' : 'DD/MM/YYYY'} (Click to switch)`}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{preferences.dateFormat === 'MMM_D_YYYY' ? 'Mon, DD (YYYY)' : 'DD/MM/YYYY'}</span>
          </button>

          {/* Daily AU Capacity & Reality Check Settings */}
          <button
            onClick={() => setIsCapacityConfigModalOpen(true)}
            title="Daily AU Capacity & Reality Check Settings"
            data-testid="header-capacity-button"
            className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Capacity</span>
          </button>

          {/* Onboarding Guide */}
          <button
            onClick={() => setIsOnboardingOpen(true)}
            title="Welcome Tour & Guide"
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Dark/Light mode toggle (visible on all screens) */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${preferences.theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-2 sm:p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {preferences.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600" />
          )}
        </button>

        {/* Mobile Options Menu Dropdown (< md) */}
        <div className="relative md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 sm:p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs">
                {/* Cloud & Calendar Sync */}
                <button
                  onClick={() => {
                    setIsSyncModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-slate-800/80 mb-0.5"
                >
                  <span className="flex items-center space-x-2">
                    <Cloud className="w-4 h-4 text-teal-500 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">Cloud & Calendar Sync</span>
                  </span>
                  <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    {cloudSyncState.provider !== 'none' || gcalendarSyncConfig.enabled ? 'Active' : 'Setup'}
                  </span>
                </button>

                {/* AU Capacity Settings */}
                <button
                  onClick={() => {
                    setIsCapacityConfigModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-slate-800/80 mb-0.5"
                >
                  <span className="flex items-center space-x-2">
                    <Scale className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">AU Capacity</span>
                  </span>
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    Reality Check
                  </span>
                </button>

                {/* Date Format Toggle */}
                <button
                  onClick={() => {
                    toggleDateFormat();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>Date Format</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {preferences.dateFormat === 'MMM_D_YYYY' ? 'Mon, DD' : 'DD/MM'}
                  </span>
                </button>

                {/* Export Full Backup */}
                <button
                  onClick={() => {
                    exportAllData();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span>Export Backup (JSON)</span>
                </button>

                {/* Import JSON */}
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Import Project (JSON)</span>
                </button>

                {/* Install App */}
                {!isStandalone && (
                  <button
                    onClick={() => {
                      handleInstallApp();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center space-x-2 font-medium cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Install App</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {/* Welcome Tour */}
                <button
                  onClick={() => {
                    setIsOnboardingOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Tour & Guide</span>
                </button>

                {/* Support / Donate */}
                <a
                  href="https://ko-fi.com/thepolygon"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full px-3.5 py-2.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 cursor-pointer"
                >
                  <Coffee className="w-4 h-4 text-amber-500" />
                  <span>Support / Donate</span>
                </a>
              </div>
            </>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
      </div>
    </header>
  );
};
