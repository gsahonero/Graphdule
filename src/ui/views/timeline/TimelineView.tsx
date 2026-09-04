import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { TemporalService } from '../../../domain/services/temporal-service';
import { daysBetween, minDate, maxDate, addDays } from '../../../domain/utils/date';
import { Node } from '../../../domain/models/types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  Target,
  Layers,
  ArrowRight,
  ArrowRightLeft,
  ArrowDownUp,
  Circle,
  ZoomIn,
  ChevronRight,
  ChevronDown,
  FolderTree,
} from 'lucide-react';

interface TreeNode {
  node: Node;
  depth: number;
  isLastChild: boolean;
  parentPath: boolean[]; // true if an ancestor at this depth level has remaining siblings below
  children: TreeNode[];
}

interface HoveredTaskTooltip {
  node: Node;
  derivedStartDate: string;
  explicitDueDate: string;
  durationDays: number;
  isDerived: boolean;
  clientX: number;
  clientY: number;
}

// Recursively builds the hierarchical tree of tasks and subtasks
function buildTaskTree(
  allNodes: readonly Node[],
  parentId: string | null = null,
  depth: number = 0,
  parentPath: boolean[] = []
): TreeNode[] {
  const matching = allNodes.filter((n) => n.parentNodeId === parentId);
  const sorted = [...matching].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return sorted.map((node, index) => {
    const isLastChild = index === sorted.length - 1;
    const currentPath = [...parentPath, !isLastChild];
    const children = buildTaskTree(allNodes, node.id, depth + 1, currentPath);
    return {
      node,
      depth,
      isLastChild,
      parentPath,
      children,
    };
  });
}

// Flattens visible tree rows based on expand/collapse state
function flattenTaskTree(
  treeNodes: TreeNode[],
  expandedIds: Set<string>
): Array<{ treeNode: TreeNode; hasChildren: boolean; isExpanded: boolean }> {
  const result: Array<{ treeNode: TreeNode; hasChildren: boolean; isExpanded: boolean }> = [];

  function traverse(nodes: TreeNode[]) {
    for (const tn of nodes) {
      const hasChildren = tn.children.length > 0;
      const isExpanded = expandedIds.has(tn.node.id);
      result.push({ treeNode: tn, hasChildren, isExpanded });
      if (hasChildren && isExpanded) {
        traverse(tn.children);
      }
    }
  }

  traverse(treeNodes);
  return result;
}

export const TimelineView: React.FC = () => {
  const { activeProjectDoc, setSelectedNode, setIsNotesDrawerOpen, formatDateDisplay } = useApp();
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [trackWidth, setTrackWidth] = useState<number>(1400);

  // Scrubber cursor state (day focused at cursor position)
  const [scrubber, setScrubber] = useState<{ x: number; date: string } | null>(null);
  const [hoveredTask, setHoveredTask] = useState<HoveredTaskTooltip | null>(null);
  const timelineGridRef = useRef<HTMLDivElement>(null);

  // Initialize all parent nodes with children as expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (!activeProjectDoc) return new Set();
    const parentIds = activeProjectDoc.nodes
      .filter((n) => activeProjectDoc.nodes.some((child) => child.parentNodeId === n.id))
      .map((n) => n.id);
    return new Set(parentIds);
  });

  if (!activeProjectDoc) return null;

  const { project, nodes } = activeProjectDoc;

  // Build recursive tree
  const taskTree = useMemo(() => buildTaskTree(nodes, null, 0, []), [nodes]);
  const visibleRows = useMemo(() => flattenTaskTree(taskTree, expandedIds), [taskTree, expandedIds]);

  const toggleExpand = (nodeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allParentIds = nodes
      .filter((n) => nodes.some((c) => c.parentNodeId === n.id))
      .map((n) => n.id);
    setExpandedIds(new Set(allParentIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Compute total timeline bounds for horizontal view
  const allDates = nodes.flatMap((n) => {
    const derived = TemporalService.getDerivedTemporal(n, nodes);
    return [derived.derivedStartDate, derived.explicitDueDate];
  });
  const projectStartDate = minDate(allDates);
  const projectEndDate = maxDate(allDates);
  const totalDays = Math.max(1, daysBetween(projectStartDate, projectEndDate) || 1);

  // Generate intermediate tick dates for horizontal ruler (8-12 ticks across track)
  const tickCount = Math.min(10, Math.max(4, Math.floor((trackWidth - 320) / 140)));
  const ticks = Array.from({ length: tickCount }).map((_, i) => {
    const offset = Math.round((i / (tickCount - 1)) * totalDays);
    const date = addDays(projectStartDate, offset);
    const percent = (offset / totalDays) * 100;
    return { date, percent };
  });

  // Track cursor position over timeline to compute focused day
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineGridRef.current) return;
    const rect = timelineGridRef.current.getBoundingClientRect();
    const trackLeft = rect.left + 320;
    const trackWidth = rect.width - 320;
    if (trackWidth <= 0) return;

    const relX = e.clientX - trackLeft;
    if (relX < 0 || relX > trackWidth) {
      setScrubber(null);
      return;
    }
    const ratio = Math.max(0, Math.min(1, relX / trackWidth));
    const dayOffset = Math.round(ratio * totalDays);
    const dateAtCursor = addDays(projectStartDate, dayOffset);
    setScrubber({ x: relX, date: dateAtCursor });
  };

  const handleTimelineMouseLeave = () => {
    setScrubber(null);
  };

  const getStatusBadge = (node: Node) => {
    switch (node.status) {
      case 'completed':
        return (
          <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Completed</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-medium text-xs">
            <Clock className="w-3.5 h-3.5 animate-pulse shrink-0" />
            <span>In Progress</span>
          </span>
        );
      case 'abandoned':
        return (
          <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-medium text-xs">
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span>Abandoned</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-xs">
            <Circle className="w-2.5 h-2.5 shrink-0" />
            <span>Planned</span>
          </span>
        );
    }
  };

  // Helper to render tree branch guide lines
  const renderTreeBranch = (treeNode: TreeNode, hasChildren: boolean, isExpanded: boolean) => {
    const { depth, isLastChild, parentPath, node } = treeNode;

    return (
      <div className="flex items-center shrink-0 self-stretch select-none">
        {/* Ancestor Vertical Guidelines */}
        {parentPath.map((hasSiblingBelow, idx) => (
          <div
            key={idx}
            className="w-5 self-stretch relative flex items-center justify-center shrink-0"
          >
            {hasSiblingBelow && (
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-slate-300 dark:bg-slate-700" />
            )}
          </div>
        ))}

        {/* Current Level Branch Elbow */}
        {depth > 0 && (
          <div className="w-5 self-stretch relative flex items-center justify-center shrink-0">
            {/* Vertical top-half line */}
            <div className="absolute top-0 h-1/2 left-1/2 -translate-x-1/2 w-px bg-slate-300 dark:bg-slate-700" />
            {/* If not last child, extend vertical line to bottom */}
            {!isLastChild && (
              <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-px bg-slate-300 dark:bg-slate-700" />
            )}
            {/* Horizontal branch arm */}
            <div className="absolute top-1/2 left-1/2 w-3.5 h-px bg-slate-300 dark:bg-slate-700" />
          </div>
        )}

        {/* Expand / Collapse Chevron button or leaf bullet */}
        {hasChildren ? (
          <button
            onClick={(e) => toggleExpand(node.id, e)}
            className="p-1 -ml-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer shrink-0 z-10 mr-1"
            title={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        ) : depth > 0 ? (
          <div className="w-3.5 h-3.5 flex items-center justify-center mr-1 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-150">
      {/* View Header Bar */}
      <div className="p-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs z-20">
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Timeline Projection</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hover over blocks or scrub the timeline to inspect dates and task details.
          </p>
        </div>

        {/* Controls: Tree Expand, Orientation & Zoom */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Expand/Collapse All */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg text-xs">
            <FolderTree className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            <button
              onClick={expandAll}
              className="px-2 py-1 rounded text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expand all subtask branches"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 rounded text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Collapse all subtask branches"
            >
              Collapse
            </button>
          </div>

          {orientation === 'horizontal' && (
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg text-xs">
              <ZoomIn className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
              <button
                onClick={() => setTrackWidth(1100)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  trackWidth === 1100
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                1100px
              </button>
              <button
                onClick={() => setTrackWidth(1600)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  trackWidth === 1600
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                1600px
              </button>
              <button
                onClick={() => setTrackWidth(2400)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  trackWidth === 2400
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                2400px
              </button>
            </div>
          )}

          {/* Orientation Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setOrientation('horizontal')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                orientation === 'horizontal'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Horizontal Track</span>
            </button>

            <button
              onClick={() => setOrientation('vertical')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                orientation === 'vertical'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span>Vertical List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Scrollable Timeline Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8 relative">
        {/* Floating Tooltip when hovering over a task block */}
        {hoveredTask && (
          <div
            className="fixed z-50 pointer-events-none bg-slate-900/95 dark:bg-slate-900/95 text-white border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 max-w-xs animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${Math.min(window.innerWidth - 260, hoveredTask.clientX + 14)}px`,
              top: `${Math.min(window.innerHeight - 140, hoveredTask.clientY + 14)}px`,
            }}
          >
            <div className="font-bold text-slate-100 flex items-center space-x-1.5">
              {hoveredTask.node.id === project.endGoalNodeId ? (
                <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-bold uppercase">
                  <Target className="w-3 h-3" />
                  <span>Goal:</span>
                </span>
              ) : null}
              <span className="truncate">{hoveredTask.node.text}</span>
            </div>

            <div className="text-[11px] space-y-0.5 text-slate-300 font-mono">
              {hoveredTask.isDerived ? (
                <>
                  <div>Start: <span className="text-slate-100 font-medium">{formatDateDisplay(hoveredTask.derivedStartDate)}</span></div>
                  <div>Due: <span className="text-emerald-400 font-semibold">{formatDateDisplay(hoveredTask.explicitDueDate)}</span></div>
                  <div className="text-slate-400 text-[10px]">~{hoveredTask.durationDays} days span</div>
                </>
              ) : (
                <div>Due Date: <span className="text-emerald-400 font-semibold">{formatDateDisplay(hoveredTask.explicitDueDate)}</span></div>
              )}
            </div>

            <div className="pt-1 border-t border-slate-800 text-[10px] flex items-center justify-between text-slate-400 capitalize">
              <span>Status: <strong className="text-slate-200">{hoveredTask.node.status.replace('_', ' ')}</strong></span>
              <span className="text-emerald-400">Click to view notes</span>
            </div>
          </div>
        )}

        {/* HORIZONTAL GANTT TIMELINE VIEW */}
        {orientation === 'horizontal' && (
          <div
            className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden mx-auto flex flex-col select-none"
            style={{ width: `${trackWidth}px`, minWidth: `${trackWidth}px` }}
          >
            {/* Header: Task column + Time Ruler */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {/* Left Column Header */}
              <div className="w-80 shrink-0 p-3.5 border-r border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span>Task Tree Hierarchy</span>
                <span className="text-[10px] font-mono text-slate-400 font-normal">
                  {totalDays}d span • {visibleRows.length} tasks
                </span>
              </div>

              {/* Right Ruler Area */}
              <div className="flex-1 relative p-3.5 h-12 flex items-center">
                {ticks.map((t, idx) => (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none"
                    style={{ left: `${t.percent}%` }}
                  >
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{formatDateDisplay(t.date)}</span>
                    <div className="h-2 w-px bg-slate-300 dark:bg-slate-700 mt-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows Canvas Area with Interactive Day Scrubber */}
            <div
              ref={timelineGridRef}
              onMouseMove={handleTimelineMouseMove}
              onMouseLeave={handleTimelineMouseLeave}
              className="relative"
            >
              {/* Dynamic Focused Day Cursor Line & Badge */}
              {scrubber && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
                  style={{ left: `calc(320px + ${scrubber.x}px)` }}
                >
                  {/* Floating Focused Date Indicator */}
                  <div className="bg-emerald-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-lg -translate-x-1/2 whitespace-nowrap mt-1 border border-emerald-400">
                    📅 {formatDateDisplay(scrubber.date)}
                  </div>
                  {/* Sharp vertical guide line */}
                  <div className="w-px flex-1 bg-emerald-500/80 dark:bg-emerald-400/80 shadow-xs" />
                </div>
              )}

              {/* Individual Task Lanes */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {visibleRows.map(({ treeNode, hasChildren, isExpanded }) => {
                  const { node, depth } = treeNode;
                  const isEGN = node.id === project.endGoalNodeId;
                  const derived = TemporalService.getDerivedTemporal(node, nodes);

                  const startOffsetDays = Math.max(0, daysBetween(projectStartDate, derived.derivedStartDate));
                  const endOffsetDays = Math.max(startOffsetDays, daysBetween(projectStartDate, derived.explicitDueDate));

                  const leftPercent = Math.max(0, Math.min(99.5, (startOffsetDays / totalDays) * 100));
                  const rightPercent = Math.max(leftPercent + 0.5, Math.min(100, (endOffsetDays / totalDays) * 100));
                  const rawWidthPercent = rightPercent - leftPercent;
                  const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, rawWidthPercent));

                  return (
                    <div
                      key={node.id}
                      onClick={() => {
                        setSelectedNode(node);
                        setIsNotesDrawerOpen(true);
                      }}
                      className={`flex h-14 transition-colors cursor-pointer group items-center border-l-4 ${
                        depth > 0 ? 'bg-slate-50/40 dark:bg-slate-950/30' : 'bg-transparent'
                      } hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 hover:border-l-emerald-500 border-l-transparent`}
                    >
                      {/* Left Task Tree Cell */}
                      <div className="w-80 shrink-0 p-2.5 h-full border-r border-slate-200 dark:border-slate-800 flex items-center overflow-hidden">
                        {/* Recursive Tree Branch Visual Lines */}
                        {renderTreeBranch(treeNode, hasChildren, isExpanded)}

                        {/* Task Info */}
                        <div className="flex-1 flex items-center justify-between gap-1.5 overflow-hidden ml-1">
                          <span
                            className={`text-xs truncate text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors ${
                              depth === 0 ? 'font-bold' : 'font-medium'
                            } ${node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}
                            title={node.text}
                          >
                            {node.text}
                          </span>

                          <div className="flex items-center space-x-1 shrink-0">
                            {isEGN ? (
                              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase border border-emerald-500/30">
                                <Target className="w-3 h-3" />
                                <span>Goal</span>
                              </span>
                            ) : hasChildren ? (
                              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-medium border border-blue-500/30">
                                <Layers className="w-3 h-3" />
                                <span>{treeNode.children.length}</span>
                              </span>
                            ) : (
                              getStatusBadge(node)
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Timeline Track Cell */}
                      <div className="flex-1 relative h-full flex items-center overflow-hidden px-2">
                        {/* Background Vertical Grid Lines */}
                        <div className="absolute inset-0 pointer-events-none">
                          {ticks.map((t, idx) => (
                            <div
                              key={idx}
                              className="absolute top-0 bottom-0 w-px border-l border-dashed border-slate-200 dark:border-slate-800/80"
                              style={{ left: `${t.percent}%` }}
                            />
                          ))}
                        </div>

                        {/* Task Block / Goal Milestone Pill (Large & Sleek, without text) */}
                        {isEGN ? (
                          <div
                            onMouseEnter={(e) => {
                              setHoveredTask({
                                node,
                                derivedStartDate: derived.derivedStartDate,
                                explicitDueDate: derived.explicitDueDate,
                                durationDays: derived.derivedDurationDays,
                                isDerived: derived.isDerived,
                                clientX: e.clientX,
                                clientY: e.clientY,
                              });
                            }}
                            onMouseLeave={() => setHoveredTask(null)}
                            className="absolute h-8 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400 shadow-md border border-emerald-400/90 z-10 transition-all group-hover:brightness-110 hover:scale-y-105 hover:ring-2 hover:ring-emerald-400/70"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${Math.max(2, widthPercent)}%`,
                              minWidth: '24px',
                              maxWidth: `${100 - leftPercent}%`,
                            }}
                          />
                        ) : (
                          <div
                            onMouseEnter={(e) => {
                              setHoveredTask({
                                node,
                                derivedStartDate: derived.derivedStartDate,
                                explicitDueDate: derived.explicitDueDate,
                                durationDays: derived.derivedDurationDays,
                                isDerived: derived.isDerived,
                                clientX: e.clientX,
                                clientY: e.clientY,
                              });
                            }}
                            onMouseLeave={() => setHoveredTask(null)}
                            className={`absolute h-7 rounded-lg shadow-sm z-10 transition-all group-hover:brightness-110 hover:scale-y-105 hover:ring-2 hover:ring-emerald-400/70 ${
                              node.status === 'completed'
                                ? 'bg-emerald-500 dark:bg-emerald-600 border border-emerald-400/80'
                                : node.status === 'in_progress'
                                ? 'bg-amber-500 dark:bg-amber-600 border border-amber-400/80'
                                : node.status === 'abandoned'
                                ? 'bg-rose-400 dark:bg-rose-700 border border-rose-300/80 opacity-60'
                                : hasChildren
                                ? 'bg-blue-500 dark:bg-blue-600 border border-blue-400/80'
                                : 'bg-slate-400 dark:bg-slate-600 border border-slate-300 dark:border-slate-500'
                            }`}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${Math.max(2, widthPercent)}%`,
                              minWidth: '20px',
                              maxWidth: `${100 - leftPercent}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VERTICAL TREE CHRONOLOGICAL VIEW */}
        {orientation === 'vertical' && (
          <div className="max-w-4xl mx-auto space-y-3 py-2">
            {visibleRows.map(({ treeNode, hasChildren, isExpanded }) => {
              const { node, depth } = treeNode;
              const isEGN = node.id === project.endGoalNodeId;
              const derived = TemporalService.getDerivedTemporal(node, nodes);

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    setSelectedNode(node);
                    setIsNotesDrawerOpen(true);
                  }}
                  className="flex items-stretch cursor-pointer group"
                  style={{ paddingLeft: `${depth * 24}px` }}
                >
                  {/* Tree Branch Visual Guidelines for Vertical View */}
                  {renderTreeBranch(treeNode, hasChildren, isExpanded)}

                  {/* Node Card */}
                  <div className="flex-1 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-4 transition-all space-y-2.5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${
                              depth === 0 ? 'font-bold' : ''
                            } ${node.status === 'abandoned' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}
                          >
                            {node.text}
                          </span>
                          {isEGN && (
                            <span className="flex items-center space-x-1 text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                              <Target className="w-3 h-3" />
                              <span>Goal</span>
                            </span>
                          )}
                          {hasChildren && (
                            <button
                              onClick={(e) => toggleExpand(node.id, e)}
                              className="flex items-center space-x-1 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30 transition-colors cursor-pointer"
                            >
                              <Layers className="w-3 h-3" />
                              <span>{treeNode.children.length} subtasks</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div>{getStatusBadge(node)}</div>
                    </div>

                    {/* Derived temporal bar if decomposed or single deadline */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      {derived.isDerived ? (
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            Derived Span: {formatDateDisplay(derived.derivedStartDate)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                            Due: {formatDateDisplay(derived.explicitDueDate)}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            ~{derived.derivedDurationDays} days span
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
                          <span>Due:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{formatDateDisplay(node.dueDate)}</span>
                        </div>
                      )}

                      <span className="text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                        Click to view notes →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
