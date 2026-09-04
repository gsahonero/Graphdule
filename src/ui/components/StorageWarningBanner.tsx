import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Download, X } from 'lucide-react';

export const StorageWarningBanner: React.FC = () => {
  const { exportAllData } = useApp();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2 text-xs text-amber-900 dark:text-amber-200/90 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center space-x-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          <strong className="font-semibold text-amber-800 dark:text-amber-300">Local-First Storage:</strong> Your Graphdule data is currently stored only in this browser. Export or backup your data periodically to protect your work.
        </span>
      </div>
      <div className="flex items-center space-x-3 shrink-0 ml-4">
        <button
          onClick={exportAllData}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-medium transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Backup</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 p-1 rounded transition-colors cursor-pointer"
          title="Dismiss warning"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
