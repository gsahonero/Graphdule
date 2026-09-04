import React, { useState, useRef, useEffect } from 'react';
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

export interface GraphNodeData extends Record<string, unknown> {
  node: Node;
  isEGN: boolean;
  notesCount: number;
  subtaskCount: number;
  viewDensity?: 'auto' | 'compact' | 'full';
  nodeScale?: number;
  totalNodesInScope?: number;
  onStatusChange: (status: NodeStatus) => void;
  onTextChange: (newText: string) => void;
  onDateChange: (newDate: string) => void;
  onOpenNotes: () => void;
  onOpenDecompose: () => void;
  onDeleteNode?: () => void;
  onDrillDown?: () => void;
}

export const GraphNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { formatDateDisplay } = useApp();
  const {
    node,
    isEGN,
    notesCount,
    subtaskCount,
    viewDensity = 'auto',
    nodeScale = 1.0,
    totalNodesInScope = 4,
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
    if (node.status === 'abandoned') {
      onStatusChange('planned');
    } else {
      onStatusChange('abandoned');
    }
  };

  const getStatusBorder = () => {
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEGN && onDrillDown) {
            onDrillDown();
          }
        }}
        style={{ transform: nodeScale !== 1.0 ? `scale(${nodeScale})` : undefined, transformOrigin: 'center' }}
        className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center p-2.5 text-center transition-all select-none shadow-md ${
          selected
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
          isEGN
            ? 'bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-100'
            : node.status === 'completed'
            ? 'bg-emerald-50/90 dark:bg-emerald-950/80 border-2 border-emerald-400 text-emerald-900 dark:text-emerald-100'
            : node.status === 'in_progress'
            ? 'bg-amber-50/90 dark:bg-amber-950/80 border-2 border-amber-400 text-amber-900 dark:text-amber-100'
            : node.status === 'abandoned'
            ? 'bg-rose-50/90 dark:bg-rose-950/80 border-2 border-rose-400 text-rose-900 dark:text-rose-100'
            : 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'
        } hover:scale-110 hover:shadow-xl hover:z-50 cursor-pointer`}
        title={isEGN ? undefined : 'Double-click to open internal decomposed tasks'}
      >
        {/* Target handle (Left) */}
        <Handle
          type="target"
          position={Position.Left}
          className="!m-0 !w-3.5 !h-3.5 !-left-[7px] !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair"
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

        {/* Status / Goal Icon */}
        <div className="shrink-0 mb-1">
          {isEGN ? (
            <Target className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          ) : node.status === 'completed' ? (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          ) : node.status === 'in_progress' ? (
            <Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 animate-pulse" />
          ) : node.status === 'abandoned' ? (
            <Ban className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>

        {/* Task Title (Simplified & Legible) */}
        <span
          className={`text-xs font-bold leading-tight line-clamp-3 px-1.5 break-words ${
            node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''
          }`}
        >
          {node.text}
        </span>

        {/* Floating Rich Tooltip / Hover Card Popover */}
        {(isHovered || isCalendarOpen) && (
          <div
            className="nodrag nowheel nopan absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-2xl z-[999] pointer-events-auto text-left space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center space-x-1.5">
                {node.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                {node.status === 'in_progress' && <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                {node.status === 'abandoned' && <Ban className="w-3.5 h-3.5 text-rose-500" />}
                {node.status === 'planned' && <Circle className="w-3 h-3 text-slate-400" />}
                <span className="text-xs font-bold capitalize text-slate-800 dark:text-slate-200">
                  {node.status === 'in_progress' ? 'In Progress' : node.status}
                </span>
              </div>
              {isEGN ? (
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  Goal
                </span>
              ) : subtaskCount > 0 ? (
                <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/30 font-medium">
                  {subtaskCount} subtasks
                </span>
              ) : null}
            </div>

            {/* Popover Task Title */}
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs break-words">
              {node.text}
            </div>

            {/* Popover Info: Due Date & Notes */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 relative">
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer group/cal"
                  title="Click to change date with modern calendar"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover/cal:text-emerald-500 transition-colors" />
                  <span className="font-mono text-[10px] font-medium">{formatDateDisplay(node.dueDate)}</span>
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
              {notesCount > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                  {notesCount} notes
                </span>
              )}
            </div>

            {/* Popover Action Shortcuts */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              {!isEGN && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Double-click to expand
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNotes();
                }}
                className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer ml-auto"
              >
                View Notes →
              </button>
            </div>
          </div>
        )}

        {/* Source handle (Right) */}
        {!isEGN && (
          <Handle
            type="source"
            position={Position.Right}
            className="!m-0 !w-3 !h-3 !-right-[6px] !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair"
          />
        )}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isEGN && onDrillDown && !isEditing) {
          onDrillDown();
        }
      }}
      style={{ transform: nodeScale !== 1.0 ? `scale(${nodeScale})` : undefined, transformOrigin: 'center' }}
      className={`relative w-68 rounded-2xl border p-3.5 transition-all text-xs flex flex-col gap-2.5 shadow-sm dark:shadow-xl select-none ${getStatusBorder()}`}
      title={isEGN ? undefined : 'Double-click to open internal decomposed tasks'}
    >
      {/* Target handle (Left - incoming dependency) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!m-0 !w-3.5 !h-3.5 !-left-[7px] !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair"
      />

      {/* Header: Status Toggle and EGN / Subtasks indicator */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center space-x-1">
          {/* Main Status Cycle Toggle Button */}
          {node.status === 'abandoned' ? (
            <button
              onClick={toggleAbandoned}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 transition-colors cursor-pointer"
              title="Click to un-abandon task"
            >
              <RotateCcw className="w-3 h-3 text-rose-500 dark:text-rose-400" />
              <span>Abandoned</span>
            </button>
          ) : (
            <button
              onClick={cycleStatus}
              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer ${
                node.status === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                  : node.status === 'in_progress'
                  ? 'bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
              title="Click to toggle status (Planned → In Progress → Completed)"
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
          {node.status !== 'abandoned' && (
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
            className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold px-2 py-1 rounded border border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-xs shadow-inner"
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="group/text flex items-center justify-between cursor-text p-1 -m-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            title="Click to edit task name"
          >
            <span className={`break-words ${node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
              {node.text}
            </span>
            <Edit2 className="w-3 h-3 text-slate-400 dark:text-slate-500 opacity-0 group-hover/text:opacity-100 transition-opacity shrink-0 ml-1.5" />
          </div>
        )}
      </div>

      {/* Temporal due date & controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] relative">
        {/* Due date picker with modern custom calendar popup */}
        <div className="relative nodrag nowheel nopan">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCalendarOpen((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center space-x-1.5 px-2 py-0.5 -mx-1 rounded-md text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group/date"
            title="Click to open calendar and set due date"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover/date:text-emerald-500 transition-colors shrink-0" />
            <span className="font-mono text-[10px] font-medium">
              {formatDateDisplay(node.dueDate)}
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
              onClick={(e) => {
                e.stopPropagation();
                onOpenDecompose();
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              title="Decompose Task"
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

      {/* Source handle (Right - outgoing dependency). Not rendered for End Goal Node */}
      {!isEGN && (
        <Handle
          type="source"
          position={Position.Right}
          className="!m-0 !w-3.5 !h-3.5 !-right-[7px] !bg-slate-400 dark:!bg-slate-700 !border-2 !border-white dark:!border-slate-900 hover:!bg-emerald-400 hover:!scale-125 transition-all !cursor-crosshair"
        />
      )}
    </div>
  );
};
