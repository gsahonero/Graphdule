import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  X,
  Plus,
  Trash2,
  Clock,
  FolderKanban,
  CheckCircle2,
  Archive,
  RotateCcw,
  Check,
  ChevronDown,
  Sprout,
  FileText,
  Target,
} from 'lucide-react';
import { DroppedThoughtConversionTarget } from '../../domain/models/types';

export const ThoughtsDropPoolDrawer: React.FC = () => {
  const {
    isThoughtsPoolOpen,
    setIsThoughtsPoolOpen,
    droppedThoughts,
    addDroppedThought,
    deleteDroppedThought,
    convertDroppedThought,
    updateDroppedThought,
    activeProjectDoc,
    activeWorkSession,
    projects,
  } = useApp();

  const [newThoughtText, setNewThoughtText] = useState('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'processed'>('inbox');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isThoughtsPoolOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setOpenDropdownId(null);
    }
  }, [isThoughtsPoolOpen]);

  if (!isThoughtsPoolOpen) return null;

  const inboxThoughts = droppedThoughts.filter((t) => t.status === 'inbox');
  const processedThoughts = droppedThoughts.filter((t) => t.status !== 'inbox');

  const handleAddThought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThoughtText.trim()) return;

    await addDroppedThought(newThoughtText.trim(), {
      projectId: activeProjectDoc?.project.id || activeWorkSession?.projectId,
      projectName: activeProjectDoc?.project.name || activeWorkSession?.projectName,
      originTaskId: activeWorkSession?.taskId,
      originTaskText: activeWorkSession?.taskText,
    });
    setNewThoughtText('');
  };

  const handleSmartConversion = async (thought: typeof droppedThoughts[0]) => {
    if (thought.projectId) {
      await convertDroppedThought(thought.id, {
        type: 'node',
        targetId: thought.projectId,
        targetTitle: thought.projectName,
      });
    } else if (thought.originTaskId) {
      await convertDroppedThought(thought.id, {
        type: 'note',
        targetId: thought.originTaskId,
        targetTitle: thought.originTaskText,
      });
    } else {
      await convertDroppedThought(thought.id, {
        type: 'standalone_task',
      });
    }
  };

  const handleCustomConversion = async (
    thoughtId: string,
    type: DroppedThoughtConversionTarget,
    targetId?: string,
    targetTitle?: string
  ) => {
    setOpenDropdownId(null);
    await convertDroppedThought(thoughtId, {
      type,
      targetId,
      targetTitle,
    });
  };

  const handleDismiss = async (thoughtId: string) => {
    setOpenDropdownId(null);
    await updateDroppedThought(thoughtId, { status: 'dismissed' });
  };

  const handleRestore = async (thoughtId: string) => {
    await updateDroppedThought(thoughtId, { status: 'inbox', convertedTarget: undefined });
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-45 sm:hidden animate-in fade-in"
        onClick={() => setIsThoughtsPoolOpen(false)}
      />

      <div
        role="dialog"
        aria-label="Thoughts Drop Pool"
        className="fixed inset-y-0 right-0 w-full sm:w-[460px] max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Thoughts Drop Pool
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {inboxThoughts.length} active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Safe holding bay for fleeting thoughts and ideas
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsThoughtsPoolOpen(false)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instant Quick-Drop Composer */}
        <form onSubmit={handleAddThought} className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={newThoughtText}
              onChange={(e) => setNewThoughtText(e.target.value)}
              placeholder="Drop a thought... (Press Enter)"
              className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-xs"
            />
            <button
              type="submit"
              disabled={!newThoughtText.trim()}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white transition-colors cursor-pointer shrink-0 shadow-xs flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Drop</span>
            </button>
          </div>
          {(activeProjectDoc || activeWorkSession) && (
            <div className="flex items-center space-x-1.5 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
              <span>Auto-tagging context:</span>
              {activeProjectDoc && (
                <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                  📍 {activeProjectDoc.project.name}
                </span>
              )}
              {activeWorkSession && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-950/60 font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[140px]">
                  🎯 {activeWorkSession.taskText}
                </span>
              )}
            </div>
          )}
        </form>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-2 bg-slate-50/30 dark:bg-slate-950/20 text-xs">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`pb-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'inbox'
                ? 'border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>Inbox</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {inboxThoughts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`pb-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'processed'
                ? 'border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>Processed</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {processedThoughts.length}
            </span>
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'inbox' ? (
            inboxThoughts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs space-y-2">
                <Sparkles className="w-10 h-10 mx-auto stroke-1 text-slate-300 dark:text-slate-600 mb-1" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Your Thoughts Pool is clear!</p>
                <p className="text-[11px] max-w-xs mx-auto text-slate-400 dark:text-slate-500">
                  When you're executing a task and an intrusive idea arises, drop it here to keep your deep flow intact.
                </p>
              </div>
            ) : (
              inboxThoughts.map((thought) => (
                <div
                  key={thought.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-800 dark:text-slate-100 font-medium whitespace-pre-wrap leading-relaxed">
                      {thought.text}
                    </p>
                    <button
                      onClick={() => deleteDroppedThought(thought.id)}
                      className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded transition-colors cursor-pointer shrink-0"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Badges / Context info */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(thought.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {thought.projectName && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800/80 font-medium text-slate-600 dark:text-slate-400 truncate max-w-[130px]">
                        📍 {thought.projectName}
                      </span>
                    )}
                    {thought.originTaskText && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-[130px]">
                        🎯 {thought.originTaskText}
                      </span>
                    )}
                  </div>

                  {/* Closure Action Bar */}
                  <div className="pt-2 flex items-center justify-between gap-2 relative">
                    {/* Primary 1-Click Smart Action */}
                    <button
                      onClick={() => handleSmartConversion(thought)}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                      title="1-Click conversion based on context"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {thought.projectId
                          ? `+ Add Node to ${thought.projectName ? `"${thought.projectName}"` : 'Project'}`
                          : thought.originTaskId
                          ? `📝 Attach Note to Task`
                          : `✓ Make Standalone Task`}
                      </span>
                    </button>

                    {/* More Menu Dropdown Toggle */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenDropdownId(openDropdownId === thought.id ? null : thought.id)
                        }
                        className="py-1.5 px-2 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center space-x-1"
                        title="More conversion options"
                      >
                        <span>⋯</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {/* Dropdown Menu */}
                      {openDropdownId === thought.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenDropdownId(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-30 text-xs animate-in fade-in zoom-in-95">
                            <button
                              onClick={() => handleCustomConversion(thought.id, 'standalone_task')}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Make Standalone Task</span>
                            </button>

                            {projects.length > 0 && (
                              <button
                                onClick={() =>
                                  handleCustomConversion(
                                    thought.id,
                                    'node',
                                    activeProjectDoc?.project.id || projects[0].id,
                                    activeProjectDoc?.project.name || projects[0].name
                                  )
                                }
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                <Target className="w-3.5 h-3.5 text-teal-500" />
                                <span className="truncate">Add as Node ({activeProjectDoc?.project.name || projects[0].name})</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleCustomConversion(thought.id, 'seed')}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <Sprout className="w-3.5 h-3.5 text-amber-500" />
                              <span>Plant as Idea Seed</span>
                            </button>

                            <button
                              onClick={() => handleCustomConversion(thought.id, 'project')}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <FolderKanban className="w-3.5 h-3.5 text-brand-500" />
                              <span>Create New Project</span>
                            </button>

                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                            <button
                              onClick={() => handleDismiss(thought.id)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Archive / Dismiss</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            processedThoughts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs">
                <p>No processed thoughts yet.</p>
              </div>
            ) : (
              processedThoughts.map((thought) => (
                <div
                  key={thought.id}
                  className="bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-through decoration-slate-400">
                    {thought.text}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-900">
                    <span className="font-medium text-teal-600 dark:text-teal-400">
                      {thought.convertedTarget
                        ? `Converted to ${thought.convertedTarget.type.replace('_', ' ')}`
                        : 'Dismissed'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRestore(thought.id)}
                        className="text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 flex items-center space-x-1 cursor-pointer"
                        title="Restore back to Inbox"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => deleteDroppedThought(thought.id)}
                        className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </>
  );
};
