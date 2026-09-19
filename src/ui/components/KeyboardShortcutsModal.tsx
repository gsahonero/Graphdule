import React, { useEffect } from 'react';
import {
  Keyboard,
  X,
  Workflow,
  Sparkles,
  Zap,
} from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
}

interface ShortcutCategory {
  title: string;
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const categories: ShortcutCategory[] = [
    {
      title: 'Graph Canvas (When a task is selected)',
      icon: <Workflow className="w-4 h-4 text-emerald-500" />,
      shortcuts: [
        {
          keys: ['Tab'],
          description: 'Add dependent child task to selected node',
          badge: 'Fast Decomposition',
        },
        {
          keys: ['Enter'],
          description: 'Add parallel sibling task from same predecessor',
          badge: 'Parallel Tasks',
        },
        {
          keys: ['Delete'],
          description: 'Delete selected task or dependency connection',
        },
        {
          keys: ['Esc'],
          description: 'Step up one level in subtask hierarchy / close modal',
        },
        {
          keys: ['Double Click'],
          description: 'Edit task name inline on canvas',
        },
        {
          keys: ['Right Click'],
          description: 'Create new task directly at canvas pointer location',
        },
      ],
    },
    {
      title: 'Inline Quick Tokens (Type while naming a task)',
      icon: <Sparkles className="w-4 h-4 text-purple-500" />,
      shortcuts: [
        {
          keys: ['!spike'],
          description: 'Mark task as an Exploration / Spike node (research & discovery)',
          badge: 'Discovery',
        },
        {
          keys: ['!high', '!med', '!low'],
          description: 'Assign cognitive demand level',
        },
        {
          keys: ['30m', '1h', '2h'],
          description: 'Automatically converts duration to Attention Units (AU)',
          badge: 'Auto AU',
        },
        {
          keys: ['[1.5 AU]', '2au'],
          description: 'Directly set Attention Units estimate',
        },
        {
          keys: ['Enter'],
          description: 'Confirm & save inline text edit',
          badge: 'Save',
        },
        {
          keys: ['Tab'],
          description: 'Save title and immediately create dependent child task',
          badge: 'Save & Child',
        },
        {
          keys: ['Esc'],
          description: 'Cancel inline edit without saving',
        },
      ],
    },
    {
      title: 'Global Flow & Deep Work',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      shortcuts: [
        {
          keys: [modKey, 'Z'],
          description: 'Undo last graph change or deletion',
        },
        {
          keys: [modKey, 'Y'],
          description: 'Redo previously undone action (or Ctrl+Shift+Z)',
        },
        {
          keys: [modKey, 'Shift', 'P'],
          description: 'Start / stop Deliberate Project Planning focus session',
          badge: 'Meta-Work',
        },
        {
          keys: ['Alt', 'D'],
          description: 'Open Thoughts Drop Pool (quick thought capture)',
          badge: 'Distraction Pad',
        },
        {
          keys: ['?'],
          description: 'Open this Keyboard Shortcuts cheat sheet',
        },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Keyboard Shortcuts & Quick Actions</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Speed up your planning and decompose complex graphs effortlessly.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shortcuts modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories content */}
        <div className="p-5 overflow-y-auto space-y-6 no-scrollbar">
          {categories.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {cat.icon}
                <span>{cat.title}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.shortcuts.map((sc, scIdx) => (
                  <div
                    key={scIdx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="text-slate-700 dark:text-slate-200 font-medium truncate">
                        {sc.description}
                      </div>
                      {sc.badge && (
                        <span className="inline-block text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {sc.badge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {sc.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          {kIdx > 0 && <span className="text-slate-400 text-[10px]">+</span>}
                          <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">?</kbd> anytime to open this helper.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
