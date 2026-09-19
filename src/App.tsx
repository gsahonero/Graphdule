import React from 'react';
import { AppProvider, useApp } from './ui/context/AppContext';
import { Header } from './ui/components/Header';
import { StorageWarningBanner } from './ui/components/StorageWarningBanner';
import { ProjectsView } from './ui/views/projects/ProjectsView';
import { ProjectDetailView } from './ui/views/project-detail/ProjectDetailView';
import { MyDayView } from './ui/views/my-day/MyDayView';
import { TaskCalendarView } from './ui/views/calendar/TaskCalendarView';
import { AttentionReviewView } from './ui/views/attention/AttentionReviewView';
import { NotesDrawer } from './ui/components/NotesDrawer';
import { CascadeModal } from './ui/components/CascadeModal';
import { OnboardingModal } from './ui/components/OnboardingModal';
import { CloudSyncModal } from './ui/components/CloudSyncModal';
import { ActiveWorkBar } from './ui/components/ActiveWorkBar';
import { TaskWorkSessionsModal } from './ui/components/TaskWorkSessionsModal';
import { CapacityConfigModal } from './ui/components/CapacityConfigModal';
import { WeeklyCapacityModal } from './ui/components/WeeklyCapacityModal';
import { HealthConfigModal } from './ui/components/HealthConfigModal';
import { AppearanceModal } from './ui/components/AppearanceModal';
import { PostTaskReceiptModal } from './ui/components/PostTaskReceiptModal';
import { RecoveryCurtainModal } from './ui/components/RecoveryCurtainModal';
import { ThoughtsDropPoolDrawer } from './ui/components/ThoughtsDropPoolDrawer';
import { PlanningInterceptionModal } from './ui/components/PlanningInterceptionModal';
import { ZenFocusCurtain } from './ui/components/ZenFocusCurtain';
import { BottomNav } from './ui/components/BottomNav';
import { BottomBar } from './ui/components/BottomBar';
import { KeyboardShortcutsModal } from './ui/components/KeyboardShortcutsModal';

const AppContent: React.FC = () => {
  const {
    currentView,
    preferences,
    isReceiptModalOpen,
    closeReceiptModal,
    receiptModalData,
    isRecoveryCurtainOpen,
    closeRecoveryCurtain,
    recoveryTargetMinutes,
    stopWork,
    activeWorkElapsedSeconds,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    setIsThoughtsPoolOpen,
  } = useApp();

  // Global Alt+D shortcut to open Thoughts Drop Pool
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsThoughtsPoolOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsThoughtsPoolOpen]);

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-screen flex flex-col dark:bg-slate-950 dark:text-slate-100 bg-slate-100 text-slate-900 overflow-hidden select-none transition-colors duration-150">
      <Header />
      <StorageWarningBanner />

      <main className="flex-1 flex overflow-hidden relative pb-14 md:pb-9">
        {currentView === 'projects' && <ProjectsView />}
        {currentView === 'project_detail' && <ProjectDetailView />}
        {currentView === 'my_day' && <MyDayView />}
        {currentView === 'calendar' && <TaskCalendarView />}
        {currentView === 'attention_review' && <AttentionReviewView />}
      </main>

      {/* Mobile Bottom Navigation (< md) */}
      <BottomNav />

      {/* Desktop Bottom Utility Bar (>= md) */}
      <BottomBar />

      {/* Global Modals, Drawers & Persistent Active Session Bar */}
      <ZenFocusCurtain />
      <ActiveWorkBar />
      <ThoughtsDropPoolDrawer />
      <PlanningInterceptionModal />
      <NotesDrawer />
      <CascadeModal />
      <OnboardingModal />
      <CloudSyncModal />
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
      <TaskWorkSessionsModal />
      <CapacityConfigModal />
      <WeeklyCapacityModal />
      <HealthConfigModal />
      <AppearanceModal />
      <PostTaskReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={closeReceiptModal}
        data={receiptModalData}
        bonsaiEnabled={preferences.bonsaiEnabled !== false}
      />
      <RecoveryCurtainModal
        isOpen={isRecoveryCurtainOpen}
        elapsedSeconds={activeWorkElapsedSeconds}
        targetMinutes={recoveryTargetMinutes}
        onEndRecovery={() => {
          closeRecoveryCurtain();
          stopWork();
        }}
        onMinimize={closeRecoveryCurtain}
      />
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
