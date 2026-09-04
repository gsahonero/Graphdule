import React from 'react';
import { AppProvider, useApp } from './ui/context/AppContext';
import { Header } from './ui/components/Header';
import { StorageWarningBanner } from './ui/components/StorageWarningBanner';
import { ProjectsView } from './ui/views/projects/ProjectsView';
import { ProjectDetailView } from './ui/views/project-detail/ProjectDetailView';
import { MyDayView } from './ui/views/my-day/MyDayView';
import { NotesDrawer } from './ui/components/NotesDrawer';
import { CascadeModal } from './ui/components/CascadeModal';
import { OnboardingModal } from './ui/components/OnboardingModal';
import { CloudSyncModal } from './ui/components/CloudSyncModal';

const AppContent: React.FC = () => {
  const { currentView } = useApp();

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-screen flex flex-col dark:bg-slate-950 dark:text-slate-100 bg-slate-100 text-slate-900 overflow-hidden select-none transition-colors duration-150 pb-[env(safe-area-inset-bottom,0px)]">
      <Header />
      <StorageWarningBanner />

      <main className="flex-1 flex overflow-hidden relative">
        {currentView === 'projects' && <ProjectsView />}
        {currentView === 'project_detail' && <ProjectDetailView />}
        {currentView === 'my_day' && <MyDayView />}
      </main>

      {/* Global Modals & Drawers */}
      <NotesDrawer />
      <CascadeModal />
      <OnboardingModal />
      <CloudSyncModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
