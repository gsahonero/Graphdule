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
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

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
          alert(`Failed to import project: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0 select-none transition-colors duration-150">
      {/* Brand */}
      <div
        id="header-brand"
        className="flex items-center space-x-3 cursor-pointer"
        onClick={() => setCurrentView('projects')}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-600/20 border border-emerald-500/30 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shadow-sm">
          <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100 tracking-tight text-base">
              {appConfig.name}
            </span>
            <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              v{appConfig.version}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            {appConfig.tagline}
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-lg border border-slate-200 dark:border-slate-800/80">
        <button
          id="nav-projects"
          onClick={() => setCurrentView(activeProjectDoc ? 'project_detail' : 'projects')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            currentView === 'projects' || currentView === 'project_detail'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Projects</span>
          {activeProjectDoc && currentView === 'project_detail' && (
            <span className="max-w-[120px] truncate text-slate-500 dark:text-slate-300 font-normal ml-1">
              / {activeProjectDoc.project.name}
            </span>
          )}
        </button>

        <button
          id="nav-my-day"
          onClick={() => setCurrentView('my_day')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            currentView === 'my_day'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>My Day</span>
        </button>
      </nav>

      {/* Storage & Tools */}
      <div className="flex items-center space-x-2">
        {/* Interactive Cloud Sync status indicator */}
        <SyncStatusIndicator />

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
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        {/* Date Format Toggle */}
        <button
          onClick={toggleDateFormat}
          title={`Date Format: ${preferences.dateFormat === 'MMM_D_YYYY' ? 'Month, Day (Year)' : 'DD/MM/YYYY'} (Click to switch)`}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>{preferences.dateFormat === 'MMM_D_YYYY' ? 'Mon, DD (YYYY)' : 'DD/MM/YYYY'}</span>
        </button>

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${preferences.theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {preferences.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600" />
          )}
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
    </header>
  );
};
