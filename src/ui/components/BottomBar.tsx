import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar,
  Scale,
  Heart,
  Palette,
  Keyboard,
  Download,
  Upload,
  HelpCircle,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { ProjectService } from '../../domain/services/project-service';
import { ProjectHealthService } from '../../domain/services/project-health-service';
import { getProjectColorTheme, ProjectIconDisplay } from '../utils/project-style';
import { getTodayString } from '../../domain/utils/date';

export const BottomBar: React.FC = () => {
  const {
    activeProjectDoc,
    preferences,
    toggleDateFormat,
    setIsCapacityConfigModalOpen,
    setIsHealthConfigModalOpen,
    setIsAppearanceModalOpen,
    setIsShortcutsModalOpen,
    setIsOnboardingOpen,
    exportAllData,
    importProjectJson,
    setIsThoughtsPoolOpen,
    droppedThoughts,
    activityLog,
  } = useApp();

  const inboxThoughtsCount = droppedThoughts ? droppedThoughts.filter((t) => t.status === 'inbox').length : 0;

  // Project Progress Calculation for Minimal Bottom Bar Indicator
  const hasActiveProject = Boolean(activeProjectDoc);
  const projectNodes = activeProjectDoc?.nodes || [];
  const projectProgress = hasActiveProject ? ProjectService.calculateProgress(projectNodes) : 0;
  const completedTaskCount = projectNodes.filter((n) => n.status === 'completed').length;
  const totalTaskCount = projectNodes.length;
  const projectTheme = getProjectColorTheme(activeProjectDoc?.project?.style?.color);
  const projectHealth = hasActiveProject && activeProjectDoc
    ? ProjectHealthService.evaluateProjectHealth(
        projectNodes,
        activeProjectDoc.edges,
        activityLog,
        getTodayString(),
        activeProjectDoc.project.id
      )
    : null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standaloneCheck =
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
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
      alert(
        '💻 To install Graphdule as an app:\n\nClick the Install icon (computer/down arrow) in your browser address bar (Chrome, Edge, or Brave).'
      );
    }
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
    <footer
      aria-label="Desktop Utility Bottom Bar"
      className="hidden md:flex fixed bottom-0 left-0 right-0 z-30 h-9 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-4 items-center justify-between text-xs backdrop-blur-md select-none transition-colors duration-150"
    >
      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Left: Sync Status & Date Format Switcher */}
      <div className="flex items-center space-x-2">
        <SyncStatusIndicator />

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {/* Date Format Toggle */}
        <button
          onClick={toggleDateFormat}
          title={`Date Format: ${
            preferences.dateFormat === 'MMM_D_YYYY' ? 'Month, Day (Year)' : 'DD/MM/YYYY'
          } (Click to toggle)`}
          className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{preferences.dateFormat === 'MMM_D_YYYY' ? 'Mon, DD' : 'DD/MM'}</span>
        </button>

        {/* Minimal Project Progress Cue with Rich Hover Detail */}
        {hasActiveProject && activeProjectDoc && (
          <>
            <span className="text-slate-300 dark:text-slate-700">|</span>

            <div
              data-testid="bottombar-progress-indicator"
              className="relative group flex items-center space-x-1.5 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Progress</span>
              <div className="w-16 sm:w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${projectTheme.progressBar || 'bg-emerald-500'} transition-all duration-300 rounded-full`}
                  style={{ width: `${projectProgress}%` }}
                />
              </div>
              <span className={`text-[10px] font-mono font-bold ${projectTheme.text || 'text-emerald-500'}`}>
                {projectProgress}%
              </span>

              {/* Full Detail Hover Popover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 hidden group-hover:flex flex-col gap-2.5 pointer-events-none animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <ProjectIconDisplay icon={activeProjectDoc.project.style?.icon} emoji={activeProjectDoc.project.style?.emoji} className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                      {activeProjectDoc.project.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                    {projectProgress}%
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${projectTheme.progressBar || 'bg-emerald-500'} rounded-full transition-all duration-300`}
                    style={{ width: `${projectProgress}%` }}
                  />
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Tasks Completed:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {completedTaskCount} / {totalTaskCount} ({totalTaskCount - completedTaskCount} remaining)
                    </span>
                  </div>

                  {projectHealth && (
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Flow State:</span>
                      <span className="inline-flex items-center gap-1 font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${projectHealth.health === 'flowing' ? 'bg-emerald-500 animate-pulse' : projectHealth.health === 'idle' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        {projectHealth.health} ({projectHealth.frontierCount} ready)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Center: Essential Utilities & Shortcuts */}
      <div className="flex items-center space-x-1 sm:space-x-1.5">
        {/* Keyboard Shortcuts Cheat Sheet */}
        <button
          onClick={() => setIsShortcutsModalOpen(true)}
          title="Keyboard Shortcuts Cheat Sheet (Press ? anytime)"
          className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
        >
          <Keyboard className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Shortcuts</span>
          <kbd className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[9px] text-slate-500 dark:text-slate-400">
            ?
          </kbd>
        </button>

        {/* Thoughts Drop Pool */}
        <button
          onClick={() => setIsThoughtsPoolOpen(true)}
          title="Thoughts Drop Pool (Press Alt+D)"
          data-testid="bottombar-thoughts-pool-button"
          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0" />
          <span>Thoughts Pool</span>
          {inboxThoughtsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-500 text-white">
              {inboxThoughtsCount}
            </span>
          )}
        </button>

        {/* Daily AU Capacity */}
        <button
          onClick={() => setIsCapacityConfigModalOpen(true)}
          title="Daily AU Capacity & Reality Check Settings"
          className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Scale className="w-3 h-3 text-slate-400 shrink-0" />
          <span>Capacity</span>
        </button>

        {/* Health & Ergonomics */}
        <button
          onClick={() => setIsHealthConfigModalOpen(true)}
          title="Health & Focus Settings (Breaks, posture, ergonomics)"
          className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Heart className="w-3 h-3 text-rose-500 fill-rose-500/20 shrink-0" />
          <span>Health</span>
        </button>

        {/* Appearance / Theme Palette */}
        <button
          onClick={() => setIsAppearanceModalOpen(true)}
          title="Appearance & Color Themes"
          data-testid="bottombar-appearance-button"
          className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Palette className="w-3 h-3 text-indigo-500 shrink-0" />
          <span>Palette</span>
        </button>
      </div>

      {/* Right: Backup & Guide */}
      <div className="flex items-center space-x-1 sm:space-x-1.5">
        {!isStandalone && (
          <button
            onClick={handleInstallApp}
            title="Install Graphdule as App"
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-800/60 transition-colors cursor-pointer"
          >
            <Smartphone className="w-3 h-3 shrink-0" />
            <span>Install</span>
          </button>
        )}

        <button
          onClick={exportAllData}
          title="Download Full JSON Backup"
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import Project from JSON"
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsOnboardingOpen(true)}
          title="Welcome Guide & Tour"
          className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
