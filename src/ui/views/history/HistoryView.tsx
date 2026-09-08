import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HistoryService, VersionDiff } from '../../../domain/services/history-service';
import { ProjectSnapshot } from '../../../domain/models/types';
import {
  History,
  Camera,
  RotateCcw,
  Clock,
  GitCommit,
  ArrowRight,
  PlusCircle,
  MinusCircle,
  AlertCircle,
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const {
    activeProjectDoc,
    projectSnapshots,
    createSnapshot,
    restoreSnapshot,
    storage,
  } = useApp();

  const [selectedSnapshot, setSelectedSnapshot] = useState<ProjectSnapshot | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState('');

  if (!activeProjectDoc) return null;

  const handleSelectSnapshot = async (snapshotId: string) => {
    const snap = await storage.readSnapshot(activeProjectDoc.project.id, snapshotId);
    if (snap) {
      setSelectedSnapshot(snap);
      const computedDiff = HistoryService.diffSnapshots(snap.document, activeProjectDoc);
      setDiff(computedDiff);
    }
  };

  const handleCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSnapshot(captureMsg.trim() || undefined);
    setCaptureMsg('');
    setIsCapturing(false);
  };

  const handleRestore = async (snapshotId: string) => {
    if (confirm('Restore project to this historical version? Current state will be preserved as a snapshot.')) {
      await restoreSnapshot(snapshotId);
      setSelectedSnapshot(null);
      setDiff(null);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span>Project History & Snapshots</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable version snapshots. Compare changes and restore past working states anytime.
          </p>
        </div>

        <button
          onClick={() => setIsCapturing(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/20 dark:shadow-amber-950/40 transition-all cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>Save Snapshot</span>
        </button>
      </div>

      {/* Snapshot creation banner */}
      {isCapturing && (
        <form
          onSubmit={handleCaptureSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center space-x-3 shadow-sm"
        >
          <input
            type="text"
            placeholder="Describe what changed in this version..."
            value={captureMsg}
            onChange={(e) => setCaptureMsg(e.target.value)}
            className="flex-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shrink-0 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsCapturing(false)}
            className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Snapshots & Diff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left: Snapshot List */}
        <div className="space-y-3 md:col-span-1">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Version Timeline ({projectSnapshots.length})
          </h3>

          {projectSnapshots.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
              No snapshots recorded yet. Click "Save Snapshot" to record a version.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] md:max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {projectSnapshots.map((snap) => (
                <div
                  key={snap.id}
                  onClick={() => handleSelectSnapshot(snap.id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all shadow-sm ${
                    selectedSnapshot?.id === snap.id
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500/60 shadow-md'
                      : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-medium text-slate-800 dark:text-slate-200">
                    <GitCommit className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span className="truncate">{snap.message || 'Snapshot'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(snap.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <span>{snap.nodeCount} tasks</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Selected Snapshot Diff & Details */}
        <div className="md:col-span-2">
          {selectedSnapshot && diff ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {selectedSnapshot.message || 'Snapshot Details'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Saved on {new Date(selectedSnapshot.timestamp).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => handleRestore(selectedSnapshot.id)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Version</span>
                </button>
              </div>

              {/* Diff summary */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Changes compared to current working state:
                </h4>

                {diff.nodeAdditions.length === 0 &&
                diff.nodeDeletions.length === 0 &&
                diff.statusChanges.length === 0 &&
                diff.nodeModifications.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    This snapshot matches the current working state exactly.
                  </p>
                ) : (
                  <div className="space-y-3 text-xs">
                    {diff.nodeAdditions.length > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-lg space-y-1">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Added in current state:</span>
                        </span>
                        <ul className="list-disc list-inside text-emerald-900 dark:text-emerald-200/90 pl-1 space-y-0.5">
                          {diff.nodeAdditions.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {diff.nodeDeletions.length > 0 && (
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-3 rounded-lg space-y-1">
                        <span className="font-semibold text-rose-800 dark:text-rose-300 flex items-center space-x-1.5">
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Deleted since this snapshot:</span>
                        </span>
                        <ul className="list-disc list-inside text-rose-900 dark:text-rose-200/90 pl-1 space-y-0.5">
                          {diff.nodeDeletions.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {diff.statusChanges.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 p-3 rounded-lg space-y-1">
                        <span className="font-semibold text-blue-800 dark:text-blue-300 flex items-center space-x-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Status shifts:</span>
                        </span>
                        <div className="space-y-1 pl-1">
                          {diff.statusChanges.map((sc, idx) => (
                            <div key={idx} className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                              <span>"{sc.text}":</span>
                              <span className="font-mono text-slate-500 dark:text-slate-400">{sc.fromStatus}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">{sc.toStatus}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto stroke-1 text-slate-400 dark:text-slate-600 mb-2" />
              <p>Select a snapshot from the timeline to view its contents and diff.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
