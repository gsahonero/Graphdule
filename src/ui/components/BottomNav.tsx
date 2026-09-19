import React from 'react';
import { useApp } from '../context/AppContext';
import { FolderKanban, Sun, Clock, CalendarDays, Waves } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    activeProjectDoc,
    activeWorkSession,
    setIsThoughtsPoolOpen,
    droppedThoughts,
  } = useApp();

  const inboxThoughtsCount = droppedThoughts ? droppedThoughts.filter((t) => t.status === 'inbox').length : 0;

  const isProjectsActive = currentView === 'projects' || currentView === 'project_detail';
  const isMyDayActive = currentView === 'my_day';
  const isCalendarActive = currentView === 'calendar';
  const isAttentionActive = currentView === 'attention_review';

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom,0px)] shadow-lg select-none transition-colors duration-150"
    >
      <div className="h-14 flex items-center justify-around px-3 max-w-md mx-auto">
        {/* Projects Tab */}
        <button
          onClick={() => setCurrentView(activeProjectDoc ? 'project_detail' : 'projects')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            isProjectsActive
              ? 'text-brand-600 dark:text-brand-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title={activeProjectDoc ? `Project: ${activeProjectDoc.project.name}` : 'Projects'}
        >
          <div className="relative">
            <FolderKanban className={`w-5 h-5 transition-transform ${isProjectsActive ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">Projects</span>
        </button>

        {/* My Day Tab */}
        <button
          onClick={() => setCurrentView('my_day')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            isMyDayActive
              ? 'text-brand-600 dark:text-brand-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title="My Day"
        >
          <div className="relative">
            <Sun className={`w-5 h-5 transition-transform ${isMyDayActive ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">My Day</span>
        </button>

        {/* Calendar Tab */}
        <button
          onClick={() => setCurrentView('calendar')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            isCalendarActive
              ? 'text-brand-600 dark:text-brand-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title="Task Calendar"
        >
          <div className="relative">
            <CalendarDays className={`w-5 h-5 transition-transform ${isCalendarActive ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">Calendar</span>
        </button>

        {/* Attention Review Tab */}
        <button
          onClick={() => setCurrentView('attention_review')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            isAttentionActive
              ? 'text-amber-500 dark:text-amber-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title="Attention & Telemetry Review"
        >
          <div className="relative">
            <Clock className={`w-5 h-5 transition-transform ${isAttentionActive ? 'scale-110' : ''}`} />
            {activeWorkSession && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-white dark:border-slate-900" />
            )}
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">Attention</span>
        </button>

        {/* Thoughts Pool Tab */}
        <button
          onClick={() => setIsThoughtsPoolOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer min-h-[44px] text-teal-600 dark:text-teal-400 hover:text-teal-700"
          title="Thoughts Drop Pool"
        >
          <div className="relative">
            <Waves className="w-5 h-5 transition-transform" />
            {inboxThoughtsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-teal-500 text-white leading-tight">
                {inboxThoughtsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] tracking-tight mt-0.5">Pool</span>
        </button>
      </div>
    </nav>
  );
};
