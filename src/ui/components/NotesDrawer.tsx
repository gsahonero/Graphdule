import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StickyNote, Plus, Trash2, X, Clock } from 'lucide-react';

export const NotesDrawer: React.FC = () => {
  const {
    selectedNode,
    activeProjectDoc,
    isNotesDrawerOpen,
    setIsNotesDrawerOpen,
    addNote,
    deleteNote,
    formatDateDisplay,
  } = useApp();

  const [newNoteText, setNewNoteText] = useState('');

  if (!isNotesDrawerOpen || !selectedNode || !activeProjectDoc) return null;

  const nodeNotes = activeProjectDoc.notes.filter((n) => n.nodeId === selectedNode.id);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    addNote(selectedNode.id, newNoteText.trim());
    setNewNoteText('');
  };

  return (
    <>
      {/* Mobile Backdrop Overlay for easy tap-to-dismiss */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-35 sm:hidden animate-in fade-in"
        onClick={() => setIsNotesDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <StickyNote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Node Notes & Memory</h3>
          </div>
          <button
            onClick={() => setIsNotesDrawerOpen(false)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 sm:p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Node context */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Selected Task:</span>
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{selectedNode.text}</p>
          <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Due: <span className="text-slate-700 dark:text-slate-300 font-mono">{formatDateDisplay(selectedNode.dueDate)}</span></span>
            <span>•</span>
            <span className="capitalize">{selectedNode.status.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {nodeNotes.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs space-y-1">
              <StickyNote className="w-8 h-8 mx-auto stroke-1 text-slate-300 dark:text-slate-600 mb-2" />
              <p>No notes for this task yet.</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Record why a scan was repeated or why a plan shifted.</p>
            </div>
          ) : (
            nodeNotes.map((note) => (
              <div
                key={note.id}
                className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2 group hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm"
              >
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {note.text}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-900">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-rose-500 hover:text-rose-600 dark:hover:text-rose-300 transition-opacity p-1 sm:p-0.5 cursor-pointer"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Add context or notes about this task..."
            rows={3}
            className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none shadow-sm"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!newNoteText.trim()}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
