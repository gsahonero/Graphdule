import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Node, NodeStatus } from '../../../domain/models/types';
import {
  Layers,
  CheckCircle2,
  Clock,
  Circle,
  Ban,
  Calendar,
  ExternalLink,
  Target,
} from 'lucide-react';

export interface GroupNodeData extends Record<string, unknown> {
  node: Node;
  childCount: number;
  completedCount: number;
  totalAU: number;
  trackedAU?: number;
  isOnCriticalPath?: boolean;
  isEGN?: boolean;
  layoutDir?: 'LR' | 'TB';
  width: number;
  height: number;
  onDrillDown?: () => void;
}

export const GroupNode: React.FC<NodeProps> = ({ data, selected }) => {
  const {
    node,
    childCount = 0,
    completedCount = 0,
    totalAU = 0,
    trackedAU = 0,
    isOnCriticalPath = false,
    isEGN = false,
    layoutDir = 'LR',
    width,
    height,
    onDrillDown,
  } = (data || {}) as unknown as GroupNodeData;

  const isCompleted = completedCount === childCount && childCount > 0;
  const isInProgress = completedCount > 0 && !isCompleted;
  const progressPercent = childCount > 0 ? Math.round((completedCount / childCount) * 100) : 0;

  const getStatusIcon = (status: NodeStatus) => {
    if (isCompleted || status === 'completed') {
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (isInProgress || status === 'in_progress') {
      return <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
    }
    if (status === 'abandoned') {
      return <Ban className="w-3.5 h-3.5 text-rose-400" />;
    }
    return <Circle className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div
      style={{
        width: Math.max(260, width || 320),
        height: Math.max(160, height || 200),
      }}
      className={`group-container relative rounded-2xl transition-all border-2 select-none pointer-events-none ${
        selected
          ? 'border-indigo-400 ring-4 ring-indigo-500/40 shadow-2xl bg-indigo-950/25 dark:bg-slate-950/70'
          : isOnCriticalPath
          ? 'border-indigo-400/80 ring-2 ring-indigo-500/30 shadow-xl shadow-indigo-500/10 bg-indigo-950/20 dark:bg-slate-950/60'
          : 'border-indigo-500/30 dark:border-indigo-500/25 hover:border-indigo-400/60 shadow-lg bg-indigo-950/15 dark:bg-slate-950/50'
      } backdrop-blur-xs`}
    >
      {/* Target handle for incoming edges from external parent-level nodes */}
      <Handle
        type="target"
        position={layoutDir === 'TB' ? Position.Top : Position.Left}
        className={`!m-0 !w-4 !h-4 ${
          layoutDir === 'TB'
            ? '!-top-[9px] !left-1/2 !-translate-x-1/2'
            : '!-left-[9px] !top-8'
        } !bg-indigo-500 !border-2 !border-slate-900 hover:!bg-indigo-300 transition-all pointer-events-auto !cursor-crosshair z-30`}
      />

      {/* Header Bar */}
      <div
        className="w-full px-3.5 py-2.5 rounded-t-[14px] bg-slate-900/85 dark:bg-slate-900/90 border-b border-indigo-500/25 flex items-center justify-between gap-2 pointer-events-auto"
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDrillDown) onDrillDown();
        }}
      >
        {/* Left: Icon, Parent Title, Status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="p-1 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shrink-0"
            title="Decomposed task with subtasks"
          >
            <Layers className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs font-semibold text-slate-100 truncate cursor-pointer hover:text-indigo-300 transition-colors"
                title={`Decomposed Task: "${node?.text || ''}" (Double-click to drill down)`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDrillDown) onDrillDown();
                }}
              >
                {node?.text || 'Parent Task'}
              </span>

              {isEGN && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold shrink-0 flex items-center gap-0.5">
                  <Target className="w-2.5 h-2.5" />
                  <span>Goal</span>
                </span>
              )}
            </div>

            {/* Subline metrics: Child count & AU */}
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
              <span className="flex items-center gap-1">
                {getStatusIcon(node?.status || 'planned')}
                <span>
                  {completedCount}/{childCount} subtasks ({progressPercent}%)
                </span>
              </span>

              {totalAU > 0 && (
                <span className="text-indigo-300 font-medium">
                  {totalAU} AU {trackedAU > 0 ? `(${trackedAU} tracked)` : ''}
                </span>
              )}

              {node?.dueDate && (
                <span className="hidden sm:inline-flex items-center gap-0.5 text-slate-400">
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{node.dueDate}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Drill down button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onDrillDown) onDrillDown();
          }}
          className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 active:scale-95 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/30 text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
          title="Focus drill-down into this task's subtasks"
        >
          <span>Focus</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Subtle background label at bottom right to orient user */}
      <div className="absolute bottom-2 right-3 text-[10px] font-mono font-bold tracking-wider text-indigo-400/20 dark:text-indigo-400/15 pointer-events-none uppercase">
        Sub-DAG Container
      </div>

      {/* Source handle for outgoing edges from external parent-level nodes */}
      <Handle
        type="source"
        position={layoutDir === 'TB' ? Position.Bottom : Position.Right}
        className={`!m-0 !w-4 !h-4 ${
          layoutDir === 'TB'
            ? '!-bottom-[9px] !left-1/2 !-translate-x-1/2'
            : '!-right-[9px] !top-8'
        } !bg-indigo-500 !border-2 !border-slate-900 hover:!bg-indigo-300 transition-all pointer-events-auto !cursor-crosshair z-30`}
      />
    </div>
  );
};
