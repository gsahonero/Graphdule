import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps, useViewport } from '@xyflow/react';
import { Node, NodeStatus } from '../../../domain/models/types';
import { useApp } from '../../context/AppContext';
import { CalendarPicker } from '../../components/CalendarPicker';
import {
  CheckCircle2,
  Clock,
  Ban,
  Target,
  StickyNote,
  Split,
  Calendar,
  Layers,
  Circle,
  RotateCcw,
  Edit2,
  Trash2,
} from 'lucide-react';
import { WorkButton } from '../../components/WorkButton';
import { AttentionUnitInput } from '../../components/AttentionUnitInput';
import { AttentionService } from '../../../domain/services/attention-service';

export interface GraphNodeData extends Record<string, unknown> {
  node: Node;
  isEGN: boolean;
  notesCount: number;
  subtaskCount: number;
  viewDensity?: 'auto' | 'compact' | 'full';
  layoutDir?: 'LR' | 'TB';
  nodeScale?: number;
  totalNodesInScope?: number;
  hasInProgressChild?: boolean;
  isDropTargetParent?: boolean;
  onStatusChange: (status: NodeStatus) => void;
  onTextChange: (newText: string) => void;
  onDateChange: (newDate: string) => void;
  onOpenNotes: () => void;
  onOpenDecompose?: () => void;
  onDeleteNode?: () => void;
  onDrillDown?: () => void;
}

export const GraphNode: React.FC<NodeProps> = ({ data, selected }) => {
  const {
    formatDateDisplay,
    preferences,
    activityLog,
    updateTaskEstimate,
    activeWorkSession,
    activeWorkElapsedSeconds,
    openWorkSessionsModal,
  } = useApp();
  const {
    node,
    isEGN,
    notesCount,
    subtaskCount,
    viewDensity = 'auto',
    layoutDir = 'LR',
    nodeScale = 1.0,
    totalNodesInScope = 4,
    hasInProgressChild = false,
    isDropTargetParent = false,
    onStatusChange,
    onTextChange,
    onDateChange,
    onOpenNotes,
    onOpenDecompose,
    onDeleteNode,
    onDrillDown,
  } = data as unknown as GraphNodeData;

  const { zoom } = useViewport();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleDecomposeAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDrillDown) {
      onDrillDown();
    } else if (onOpenDecompose) {
      onOpenDecompose();
    }
  };

  // In auto mode, keep full cards when there are few nodes (empty space) and only switch to circles if dense & zoomed out
  const isCompact =
    viewDensity === 'compact'
      ? true
      : viewDensity === 'full'
      ? false
      : totalNodesInScope > 8 && zoom < 0.55;

  const [isEditing, setIsEditing] = useState(node.text === 'New Task');
  const [editText, setEditText] = useState(node.text);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trackedAU = useMemo(() => {
    if (!preferences.attentionSystemEnabled) return 0;
    const sessions = AttentionService.reconstructWorkSessions(
      activityLog,
      preferences.attentionUnitMinutes || 15
    );
    return sessions
      .filter((s) => s.taskId === node.id)
      .reduce((sum, s) => sum + s.au, 0);
  }, [activityLog, preferences.attentionSystemEnabled, preferences.attentionUnitMinutes, node.id]);

  const isCurrentActive = activeWorkSession?.taskId === node.id;
  const isPaused = isCurrentActive && !!activeWorkSession?.isPaused;

  const formatTimer = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    setEditText(node.text);
  }, [node.text]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== node.text) {
      onTextChange(trimmed);
    } else if (!trimmed) {
      setEditText(node.text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishEditing();
    } else if (e.key === 'Escape') {
      setEditText(node.text);
      setIsEditing(false);
    }
  };

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasInProgressChild) return;
    if (node.status === 'abandoned') {
      onStatusChange('planned');
      return;
    }
    const sequence: NodeStatus[] = ['planned', 'in_progress', 'completed'];
    const currentIndex = sequence.indexOf(node.status);
    const nextIndex = (currentIndex + 1) % sequence.length;
    onStatusChange(sequence[nextIndex]);
  };

  const toggleAbandoned = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasInProgressChild) return;
    if (node.status === 'abandoned') {
      onStatusChange('planned');
    } else {
      onStatusChange('abandoned');
    }
  };

  const getStatusBorder = () => {
    if (isDropTargetParent) {
      return 'border-amber-500 ring-4 ring-amber-500/70 shadow-2xl bg-amber-500/15 dark:bg-amber-500/25 scale-[1.03] z-50';
    }
    if (isCurrentActive) {
      return 'border-amber-500 ring-2 ring-amber-500/50 shadow-amber-500/20 bg-amber-50/20 dark:bg-amber-950/25 shadow-md';
    }
    if (selected) return 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-950/20 dark:shadow-emerald-950/80 bg-white dark:bg-slate-900/95';
    if (isEGN) return 'border-emerald-500/80 shadow-md bg-white dark:bg-slate-900/95';
    switch (node.status) {
      case 'completed':
        return 'border-emerald-400 dark:border-emerald-600/60 bg-white dark:bg-slate-900/90 shadow-sm';
      case 'in_progress':
        return 'border-amber-400 dark:border-amber-500/70 bg-white dark:bg-slate-900/90 shadow-sm';
      case 'abandoned':
        return 'border-rose-300 dark:border-rose-900/60 opacity-60 bg-rose-50/50 dark:bg-rose-950/20';
      default:
        return 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/95 shadow-sm';
    }
  };

  // --- COMPACT CIRCULAR NODE VIEW (Semantic Zoom / Compact Mode) ---
  if (isCompact) {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={(e) => {
          if (isEditing) return;
          e.stopPropagation();
          if (!isEGN && onDrillDown) {
            onDrillDown();
          }
        }}
        style={{ transform: nodeScale !== 1.0 ? `scale(${nodeScale})` : undefined, transformOrigin: 'center' }}
        className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center p-2.5 text-center transition-all select-none shadow-md ${
          isDropTargetParent
            ? 'ring-4 ring-amber-500 bg-amber-500/25 scale-110 z-50 border-2 border-amber-500 shadow-amber-500/40'
            : isCurrentActive
            ? 'ring-4 ring-amber-500 shadow-amber-500/40'
            : selected
            ? 'ring-4 ring-emerald-500 shadow-emerald-500/30'
            : isEGN
            ? 'ring-4 ring-emerald-600/50 dark:ring-emerald-500/40 shadow-emerald-600/20'
            : node.status === 'completed'
            ? 'ring-3 ring-emerald-500/60 dark:ring-emerald-400/50'
            : node.status === 'in_progress'
            ? 'ring-3 ring-amber-500/70 dark:ring-amber-400/60'
            : node.status === 'abandoned'
            ? 'ring-3 ring-rose-400/60 dark:ring-rose-600/50 opacity-70'
            : 'ring-2 ring-slate-300 dark:ring-slate-700'
        } ${
          isDropTargetParent
            ? 'bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-500 text-amber-900 dark:text-amber-100'
            : isCurrentActive
            ? 'bg-amber-50/95 dark:bg-amber-950/80 border-2 border-amber-500 text-amber-900 dark:text-amber-100'
            : isEGN
            ? 'bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-100'
            : node.status === 'completed'
            ? 'bg-emerald-50/90 dark:bg-emerald-950/80 border-2 border-emerald-400 text-emerald-900 dark:text-emerald-100'
            : node.status === 'in_progress'
            ? 'bg-amber-50/90 dark:bg-amber-950/80 border-2 border-amber-400 text-amber-900 dark:text-amber-100'
            : node.status === 'abandoned'
            ? 'bg-rose-50/90 dark:bg-rose-950/80 border-2 border-rose-400 text-rose-900 dark:text-rose-100'
            : 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'
        } hover:scale-105 hover:shadow-xl hover:z-50 cursor-pointer`}
        title={isEGN ? undefined : 'Double-click to open internal decomposed tasks'}
      >
        {/* Drop target badge */}
        {isDropTargetParent && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[9px] shadow-lg flex items-center gap-1 animate-bounce whitespace-nowrap z-50 pointer-events-none">
            <span>📥 Drop into task</span>
          </div>
        )}
        {/* Target handle */}
        <Handle
          type="target"
          position={layoutDir === 'TB' ? Position.Top : Position.Left}
          className={`!m-0 !w-3.5 !h-3.5 ${
            layoutDir === 'TB'
              ? '!-top-[7px] !left-1/2 !-translate-x-1/2'
              : '!-left-[7px] !top-1/2 !-translate-y-1/2'
          } !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair`}
        />

        {/* Subtask count badge */}
        {subtaskCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 border border-white dark:border-slate-900 z-10"
            title={`${subtaskCount} internal subtasks`}
          >
            <Layers className="w-3 h-3" />
            <span>{subtaskCount}</span>
          </span>
        )}

        {/* Notes count badge */}
        {notesCount > 0 && (
          <span
            className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5 border border-white dark:border-slate-900 z-10"
            title={`${notesCount} notes`}
          >
            <StickyNote className="w-3 h-3" />
            <span>{notesCount}</span>
          </span>
        )}

        {/* Status / Goal Icon (Direct Click to Cycle Status) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cycleStatus(e);
          }}
          disabled={isEGN || hasInProgressChild}
          className={`shrink-0 mb-1 p-1 rounded-full transition-transform ${
            isEGN || hasInProgressChild
              ? 'cursor-default'
              : 'hover:scale-125 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer active:scale-95'
          }`}
          title={
            isEGN
              ? 'End Goal Node'
              : hasInProgressChild
              ? 'In Progress: subtasks are in progress (status cannot be modified)'
              : node.status === 'abandoned'
              ? 'Click to reactivate task'
              : 'Click to toggle status (Planned → In Progress → Completed)'
          }
        >
          {isEGN ? (
            <Target className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          ) : node.status === 'completed' ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          ) : node.status === 'in_progress' ? (
            <Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 animate-pulse" />
          ) : node.status === 'abandoned' ? (
            <Ban className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
          )}
        </button>

        {/* Task Title (Simplified & Legible on circle) */}
        <span
          className={`text-xs font-bold leading-tight line-clamp-3 px-1.5 break-words ${
            node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''
          }`}
        >
          {node.text}
        </span>

        {/* Active work timer badge on circle */}
        {isCurrentActive && (
          <div
            className="nodrag nowheel nopan absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/95 dark:bg-slate-900/95 border border-amber-500/80 text-[10px] font-mono font-semibold text-amber-300 shadow-lg whitespace-nowrap pointer-events-auto"
            title={`Active work session: ${formatTimer(activeWorkElapsedSeconds)}`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
              />
            </span>
            <span>{formatTimer(activeWorkElapsedSeconds)}</span>
          </div>
        )}

        {/* Floating Rich Tooltip / Hover Card Popover with Full Modification Capabilities */}
        {(isHovered || isCalendarOpen || isEditing || selected) && (
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="nodrag nowheel nopan absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-2xl z-[999] pointer-events-auto text-left space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Invisible hover bridge to prevent cursor gap when moving between circle and popover */}
            <div className="absolute -bottom-3 inset-x-0 h-4 bg-transparent pointer-events-auto" />

            {/* Popover Header: Status Cycle, Abandon & Goal/Subtasks */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center space-x-1">
                {/* Main Status Cycle Toggle Button */}
                {node.status === 'abandoned' ? (
                  <button
                    type="button"
                    onClick={toggleAbandoned}
                    disabled={hasInProgressChild}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 transition-colors ${
                      hasInProgressChild ? 'cursor-default opacity-80' : 'cursor-pointer'
                    }`}
                    title="Click to un-abandon task"
                  >
                    <RotateCcw className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                    <span>Abandoned</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={cycleStatus}
                    disabled={hasInProgressChild}
                    className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                      hasInProgressChild ? 'cursor-default opacity-90' : 'cursor-pointer'
                    } ${
                      node.status === 'completed'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                        : node.status === 'in_progress'
                        ? 'bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                    title={
                      hasInProgressChild
                        ? 'In Progress: subtasks are in progress (cannot be modified)'
                        : 'Click to toggle status (Planned → In Progress → Completed)'
                    }
                  >
                    {node.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                    {node.status === 'in_progress' && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" />}
                    {node.status === 'planned' && <Circle className="w-2.5 h-2.5 text-slate-400 dark:text-slate-400" />}
                    <span className="capitalize">
                      {node.status === 'in_progress' ? 'In Progress' : node.status}
                    </span>
                  </button>
                )}

                {/* Abandon shortcut icon button */}
                {!hasInProgressChild && node.status !== 'abandoned' && (
                  <button
                    type="button"
                    onClick={toggleAbandoned}
                    className="p-1 rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Mark task as abandoned"
                  >
                    <Ban className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Goal or Subtask count tag */}
              {isEGN ? (
                <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tracking-wide uppercase border border-emerald-500/30 shrink-0">
                  <Target className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Goal</span>
                </span>
              ) : subtaskCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDrillDown) onDrillDown();
                  }}
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-medium border border-blue-500/30 shrink-0 transition-colors cursor-pointer"
                  title="Click to view internal subtasks"
                >
                  <Layers className="w-3 h-3" />
                  <span>{subtaskCount} subtasks</span>
                </button>
              ) : null}
            </div>

            {/* Popover Task Title - Inline Canvas Editable */}
            <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs leading-snug">
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={handleFinishEditing}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold px-2 py-1 rounded border border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-xs shadow-inner"
                />
              ) : (
                <div
                  onDoubleClick={(e) => {
                    if (isEGN) {
                      e.stopPropagation();
                      setIsEditing(true);
                    }
                  }}
                  className="group/text flex items-center justify-between p-1 -m-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  title={isEGN ? 'Double-click or click pencil to edit' : undefined}
                >
                  <span className={`break-words ${node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                    {node.text}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-100 sm:opacity-0 sm:group-hover/text:opacity-100 transition-opacity shrink-0 ml-1.5 cursor-pointer"
                    title="Edit task name"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Popover Attention tracking & estimate section */}
            {preferences.attentionSystemEnabled && (
              <div
                className={`flex flex-col gap-2 p-2 rounded-xl border nodrag nowheel nopan ${
                  isCurrentActive
                    ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {isCurrentActive ? (
                  <div className="flex flex-col gap-2">
                    {/* Row 1: Dedicated Active Work Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <WorkButton
                        taskId={node.id}
                        taskText={node.text}
                        projectId={node.projectId}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWorkSessionsModal(node.id);
                        }}
                        className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer transition-opacity"
                        title="Click to view and edit recorded work sessions for this task"
                      >
                        Active: {AttentionService.formatAU(trackedAU, preferences.attentionUnitMinutes)}
                      </button>
                    </div>

                    {/* Row 2: Estimate Stepper */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-500/20">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Estimate:
                      </span>
                      <AttentionUnitInput
                        value={node.estimatedAU}
                        onChange={(newAU) => updateTaskEstimate(node.id, newAU, true)}
                        isParentDerived={subtaskCount > 0}
                        auMinutes={preferences.attentionUnitMinutes}
                        compact={true}
                        align="right"
                      />
                    </div>

                    {/* Row 3: Progress Bar */}
                    {node.estimatedAU && node.estimatedAU > 0 && (
                      <div className="flex flex-col gap-1 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-500 dark:text-slate-400">Progress</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {Math.round((trackedAU / node.estimatedAU) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              trackedAU > node.estimatedAU ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round((trackedAU / node.estimatedAU) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <WorkButton
                        taskId={node.id}
                        taskText={node.text}
                        projectId={node.projectId}
                      />
                      <AttentionUnitInput
                        value={node.estimatedAU}
                        onChange={(newAU) => updateTaskEstimate(node.id, newAU, true)}
                        isParentDerived={subtaskCount > 0}
                        auMinutes={preferences.attentionUnitMinutes}
                        compact={true}
                        align="right"
                      />
                    </div>

                    {/* Dedicated Active Attention (Tracked Time) & Progress */}
                    {trackedAU > 0 && (
                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openWorkSessionsModal(node.id);
                            }}
                            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300 font-semibold hover:underline cursor-pointer transition-opacity"
                            title="Click to view and edit recorded work sessions for this task"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <span>Active: {AttentionService.formatAU(trackedAU, preferences.attentionUnitMinutes)}</span>
                          </button>
                          {node.estimatedAU && node.estimatedAU > 0 ? (
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                              {Math.round((trackedAU / node.estimatedAU) * 100)}%
                            </span>
                          ) : null}
                        </div>

                        {node.estimatedAU && node.estimatedAU > 0 && (
                          <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                trackedAU > node.estimatedAU
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500 dark:bg-indigo-400'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((trackedAU / node.estimatedAU) * 100))}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Popover Temporal due date & controls */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] relative">
              {/* Due date picker with modern custom calendar popup */}
              <div className={`relative nodrag nowheel nopan ${isCalendarOpen ? 'z-50' : ''}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`flex items-center space-x-1.5 px-2 py-0.5 -mx-1 rounded-md transition-colors cursor-pointer group/date ${
                    !node.dueDate
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-dashed border-amber-300 dark:border-amber-700 animate-pulse'
                      : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                  title={!node.dueDate ? 'Select due date (required)' : 'Click to open calendar and set due date'}
                >
                  <Calendar className={`w-3.5 h-3.5 shrink-0 transition-colors ${!node.dueDate ? 'text-amber-500' : 'text-slate-400 group-hover/date:text-emerald-500'}`} />
                  <span className="font-mono text-[10px] font-medium">
                    {node.dueDate ? formatDateDisplay(node.dueDate) : 'Pick date'}
                  </span>
                </button>

                {isCalendarOpen && (
                  <CalendarPicker
                    value={node.dueDate}
                    onChange={(newDate) => onDateChange(newDate)}
                    onClose={() => setIsCalendarOpen(false)}
                    position="bottom"
                    align="left"
                  />
                )}
              </div>

              {/* Action icons */}
              <div className="flex items-center space-x-1">
                {/* Notes button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNotes();
                  }}
                  className="flex items-center space-x-0.5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Notes"
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  {notesCount > 0 && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{notesCount}</span>
                  )}
                </button>

                {/* Decompose button (Disabled for End Goal Node) */}
                {!isEGN && (
                  <button
                    type="button"
                    onClick={handleDecomposeAction}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Decompose Task (Open subtasks)"
                  >
                    <Split className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete node button */}
                {!isEGN && onDeleteNode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode();
                    }}
                    className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick drill-down navigation link */}
            {!isEGN && (
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDrillDown) onDrillDown();
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  {subtaskCount > 0 ? `Open subtasks (${subtaskCount}) →` : 'Decompose subtasks →'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNotes();
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer ml-auto"
                >
                  View Notes ({notesCount}) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Source handle */}
        {!isEGN && (
          <Handle
            type="source"
            position={layoutDir === 'TB' ? Position.Bottom : Position.Right}
            className={`!m-0 !w-3 !h-3 ${
              layoutDir === 'TB'
                ? '!-bottom-[6px] !left-1/2 !-translate-x-1/2'
                : '!-right-[6px] !top-1/2 !-translate-y-1/2'
            } !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair`}
          />
        )}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        if (isEditing) return;
        e.stopPropagation();
        if (!isEGN && onDrillDown) {
          onDrillDown();
        }
      }}
      style={{ transform: nodeScale !== 1.0 ? `scale(${nodeScale})` : undefined, transformOrigin: 'center' }}
      className={`relative w-80 rounded-2xl border p-3.5 transition-all text-xs flex flex-col gap-2.5 shadow-sm dark:shadow-xl select-none ${getStatusBorder()}`}
      title={isEGN ? undefined : 'Double-click to open internal decomposed tasks'}
    >
      {/* Target handle (incoming dependency) */}
      <Handle
        type="target"
        position={layoutDir === 'TB' ? Position.Top : Position.Left}
        className={`!m-0 !w-3.5 !h-3.5 ${
          layoutDir === 'TB'
            ? '!-top-[7px] !left-1/2 !-translate-x-1/2'
            : '!-left-[7px] !top-1/2 !-translate-y-1/2'
        } !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair`}
      />

      {/* Drop target badge */}
      {isDropTargetParent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] shadow-lg flex items-center gap-1 animate-bounce whitespace-nowrap z-50 pointer-events-none">
          <span>📥 Drop to nest as child</span>
        </div>
      )}

      {/* Header: Status Toggle and EGN / Subtasks indicator */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center space-x-1">
          {/* Main Status Cycle Toggle Button */}
          {node.status === 'abandoned' ? (
            <button
              onClick={toggleAbandoned}
              disabled={hasInProgressChild}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 transition-colors ${
                hasInProgressChild ? 'cursor-not-allowed opacity-90' : 'hover:bg-rose-100 dark:hover:bg-rose-500/30 cursor-pointer'
              }`}
              title={
                hasInProgressChild
                  ? 'In Progress: subtasks are in progress (status cannot be modified)'
                  : 'Click to un-abandon task'
              }
            >
              <RotateCcw className="w-3 h-3 text-rose-500 dark:text-rose-400" />
              <span>Abandoned</span>
            </button>
          ) : (
            <button
              onClick={cycleStatus}
              disabled={hasInProgressChild}
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                hasInProgressChild
                  ? 'cursor-not-allowed opacity-90'
                  : 'cursor-pointer'
              } ${
                node.status === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                  : node.status === 'in_progress'
                  ? 'bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
              title={
                hasInProgressChild
                  ? 'In Progress: subtasks are in progress (status cannot be modified)'
                  : 'Click to toggle status (Planned → In Progress → Completed)'
              }
            >
              {node.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
              {node.status === 'in_progress' && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" />}
              {node.status === 'planned' && <Circle className="w-2.5 h-2.5 text-slate-400 dark:text-slate-400" />}
              <span className="capitalize">
                {node.status === 'in_progress' ? 'In Progress' : node.status}
              </span>
            </button>
          )}

          {/* Abandon shortcut icon button */}
          {!hasInProgressChild && node.status !== 'abandoned' && (
            <button
              onClick={toggleAbandoned}
              className="p-1 rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Mark task as abandoned"
            >
              <Ban className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* EGN or Subtask count tag */}
        {isEGN ? (
          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tracking-wide uppercase border border-emerald-500/30 shrink-0">
            <Target className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Goal</span>
          </span>
        ) : subtaskCount > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onDrillDown) onDrillDown();
            }}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-medium border border-blue-500/30 shrink-0 transition-colors cursor-pointer"
            title="Click or double-click to view internal subtasks"
          >
            <Layers className="w-3 h-3" />
            <span>{subtaskCount}</span>
          </button>
        ) : null}
      </div>

      {/* Node Text - Inline Canvas Editable */}
      <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs leading-snug">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold px-2 py-1 rounded border border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-xs shadow-inner"
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              if (isEGN) {
                e.stopPropagation();
                setIsEditing(true);
              }
            }}
            className="group/text flex items-center justify-between p-1 -m-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            title={isEGN ? 'Double-click or click pencil to edit' : undefined}
          >
            <span className={`break-words ${node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
              {node.text}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-100 sm:opacity-0 sm:group-hover/text:opacity-100 transition-opacity shrink-0 ml-1.5 cursor-pointer"
              title="Edit task name"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Attention tracking & estimate section */}
      {preferences.attentionSystemEnabled && (
        <div
          className={`flex flex-col gap-2 p-2 rounded-xl border nodrag nowheel nopan ${
            isCurrentActive
              ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40 shadow-sm'
              : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {isCurrentActive ? (
            <div className="flex flex-col gap-2">
              {/* Row 1: Dedicated Active Work Bar */}
              <div className="flex items-center justify-between gap-2">
                <WorkButton
                  taskId={node.id}
                  taskText={node.text}
                  projectId={node.projectId}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openWorkSessionsModal(node.id);
                  }}
                  className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-300 hover:underline cursor-pointer transition-opacity"
                  title="Click to view and edit recorded work sessions for this task"
                >
                  Active: {AttentionService.formatAU(trackedAU, preferences.attentionUnitMinutes)}
                </button>
              </div>

              {/* Row 2: Estimate Stepper */}
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-500/20">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Estimate:
                </span>
                <AttentionUnitInput
                  value={node.estimatedAU}
                  onChange={(newAU) => updateTaskEstimate(node.id, newAU, true)}
                  isParentDerived={subtaskCount > 0}
                  auMinutes={preferences.attentionUnitMinutes}
                  compact={true}
                  align="right"
                />
              </div>

              {/* Row 3: Progress Bar */}
              {node.estimatedAU && node.estimatedAU > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500 dark:text-slate-400">Progress</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {Math.round((trackedAU / node.estimatedAU) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        trackedAU > node.estimatedAU ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((trackedAU / node.estimatedAU) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Top row: Work action button & Estimated AU */}
              <div className="flex items-center justify-between gap-2">
                <WorkButton
                  taskId={node.id}
                  taskText={node.text}
                  projectId={node.projectId}
                />
                <AttentionUnitInput
                  value={node.estimatedAU}
                  onChange={(newAU) => updateTaskEstimate(node.id, newAU, true)}
                  isParentDerived={subtaskCount > 0}
                  auMinutes={preferences.attentionUnitMinutes}
                  compact={true}
                  align="right"
                />
              </div>

              {/* Dedicated Active Attention (Tracked Time) & Progress */}
              {trackedAU > 0 && (
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWorkSessionsModal(node.id);
                      }}
                      className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300 font-semibold hover:underline cursor-pointer transition-opacity"
                      title="Click to view and edit recorded work sessions for this task"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span>Active: {AttentionService.formatAU(trackedAU, preferences.attentionUnitMinutes)}</span>
                    </button>
                    {node.estimatedAU && node.estimatedAU > 0 ? (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {Math.round((trackedAU / node.estimatedAU) * 100)}%
                      </span>
                    ) : null}
                  </div>

                  {node.estimatedAU && node.estimatedAU > 0 && (
                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          trackedAU > node.estimatedAU
                            ? 'bg-amber-500'
                            : 'bg-indigo-500 dark:bg-indigo-400'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((trackedAU / node.estimatedAU) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Temporal due date & controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] relative">
        {/* Due date picker with modern custom calendar popup */}
        <div className={`relative nodrag nowheel nopan ${isCalendarOpen ? 'z-50' : ''}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCalendarOpen((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`flex items-center space-x-1.5 px-2 py-0.5 -mx-1 rounded-md transition-colors cursor-pointer group/date ${
              !node.dueDate
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-dashed border-amber-300 dark:border-amber-700 animate-pulse'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
            title={!node.dueDate ? 'Select due date (required)' : 'Click to open calendar and set due date'}
          >
            <Calendar className={`w-3.5 h-3.5 shrink-0 transition-colors ${!node.dueDate ? 'text-amber-500' : 'text-slate-400 group-hover/date:text-emerald-500'}`} />
            <span className="font-mono text-[10px] font-medium">
              {node.dueDate ? formatDateDisplay(node.dueDate) : 'Pick date'}
            </span>
          </button>

          {isCalendarOpen && (
            <CalendarPicker
              value={node.dueDate}
              onChange={(newDate) => onDateChange(newDate)}
              onClose={() => setIsCalendarOpen(false)}
              position="top"
              align="left"
            />
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1">
          {/* Notes button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNotes();
            }}
            className="flex items-center space-x-0.5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Notes"
          >
            <StickyNote className="w-3.5 h-3.5" />
            {notesCount > 0 && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{notesCount}</span>
            )}
          </button>

          {/* Decompose button (Disabled for End Goal Node) */}
          {!isEGN && (
            <button
              type="button"
              onClick={handleDecomposeAction}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              title="Decompose Task (Open subtasks)"
            >
              <Split className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete node button */}
          {!isEGN && onDeleteNode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode();
              }}
              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Source handle (outgoing dependency). Not rendered for End Goal Node */}
      {!isEGN && (
        <Handle
          type="source"
          position={layoutDir === 'TB' ? Position.Bottom : Position.Right}
          className={`!m-0 !w-3.5 !h-3.5 ${
            layoutDir === 'TB'
              ? '!-bottom-[7px] !left-1/2 !-translate-x-1/2'
              : '!-right-[7px] !top-1/2 !-translate-y-1/2'
          } !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair`}
        />
      )}
    </div>
  );
};
