import React, { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  Background,
  Controls,
  MiniMap,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node as RFNode,
  Edge as RFEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useApp } from '../../context/AppContext';
import { GraphNode, GraphNodeData } from './GraphNode';
import { getLayoutedElements, isValidCoordinate, NODE_WIDTH, NODE_HEIGHT } from './layout';
import { Node, NodeStatus } from '../../../domain/models/types';
import { getTodayString, addDays } from '../../../domain/utils/date';
import {
  Plus,
  Workflow,
  Camera,
  ArrowRightLeft,
  ArrowDownUp,
  Trash2,
  ChevronRight,
  Folder,
  Layers,
  ArrowLeft,
  Sparkles,
  CircleDot,
  LayoutGrid,
  Maximize2,
} from 'lucide-react';

const nodeTypes = {
  graphNode: GraphNode,
};

const SNAP_THRESHOLD = 15;

interface GuideLine {
  coord: number;
}

// Smart Alignment Guide Lines SVG Overlay (PowerPoint-style)
const AlignmentGuidesOverlay: React.FC<{
  guideLines: { horizontal: GuideLine | null; vertical: GuideLine | null };
}> = ({ guideLines }) => {
  const { x: vpX, y: vpY, zoom } = useViewport();

  if (!guideLines.horizontal && !guideLines.vertical) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full z-30 overflow-hidden">
      {guideLines.horizontal && isValidCoordinate(guideLines.horizontal.coord) && (
        <line
          x1="0"
          y1={guideLines.horizontal.coord * zoom + vpY}
          x2="100%"
          y2={guideLines.horizontal.coord * zoom + vpY}
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="5 5"
          style={{ filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.9))' }}
        />
      )}
      {guideLines.vertical && isValidCoordinate(guideLines.vertical.coord) && (
        <line
          x1={guideLines.vertical.coord * zoom + vpX}
          y1="0"
          x2={guideLines.vertical.coord * zoom + vpX}
          y2="100%"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="5 5"
          style={{ filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.9))' }}
        />
      )}
    </svg>
  );
};

const GraphCanvas: React.FC = () => {
  const {
    activeProjectDoc,
    preferences,
    addNode,
    updateNode,
    deleteNode,
    updateNodePositions,
    updateNodeStatus,
    moveNodeDate,
    addEdge,
    deleteEdge,
    decomposeNode,
    createSnapshot,
    setSelectedNode,
    setIsNotesDrawerOpen,
    syncAtomicInheritance,
  } = useApp();

  const { screenToFlowPosition, fitView } = useReactFlow();

  // Recursive Decomposition Scope Navigation (Scope Breadcrumb Stack)
  const [scopeStack, setScopeStack] = useState<Node[]>([]);
  const currentParentNode = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null;

  // View density mode: 'auto' (LOD based on zoom), 'compact' (simplified circles), 'full' (full cards)
  const [viewDensity, setViewDensity] = useState<'auto' | 'compact' | 'full'>('auto');

  // Node scale adjustment: 0.85 (Small), 1.0 (Medium), 1.2 (Large)
  const [nodeScale, setNodeScale] = useState<number>(1.0);

  // Layout orientation: 'LR' (Left to Right) vs 'TB' (Top to Bottom)
  const [layoutDir, setLayoutDir] = useState<'LR' | 'TB'>('LR');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // PowerPoint-style Smart Alignment Guides
  const [guideLines, setGuideLines] = useState<{
    horizontal: GuideLine | null;
    vertical: GuideLine | null;
  }>({ horizontal: null, vertical: null });

  // Modals state
  const [decomposingNode, setDecomposingNode] = useState<Node | null>(null);
  const [subtasksInput, setSubtasksInput] = useState('');

  const [snapshotMsg, setSnapshotMsg] = useState('');
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);

  if (!activeProjectDoc) return null;

  const { project, nodes, edges, notes } = activeProjectDoc;

  // Scoped nodes for current hierarchy level (Root level has parentNodeId === null)
  const scopedNodes = useMemo(() => {
    return nodes.filter(
      (n) => n.parentNodeId === (currentParentNode ? currentParentNode.id : null)
    );
  }, [nodes, currentParentNode]);

  // Scoped edges where both endpoints belong to current hierarchy level
  const scopedEdges = useMemo(() => {
    const scopedNodeIds = new Set(scopedNodes.map((n) => n.id));
    return edges.filter(
      (e) => scopedNodeIds.has(e.fromNodeId) && scopedNodeIds.has(e.toNodeId)
    );
  }, [edges, scopedNodes]);

  // Build React Flow nodes for active scope
  const initialElements = useMemo(() => {
    return getLayoutedElements(
      scopedNodes,
      scopedEdges,
      layoutDir,
      false,
      viewDensity === 'compact',
      nodeScale
    );
  }, [scopedNodes, scopedEdges, layoutDir, viewDensity, nodeScale]);

  const [rfNodes, setRfNodes] = useState<RFNode[]>(initialElements.rfNodes);
  const [rfEdges, setRfEdges] = useState<RFEdge[]>(initialElements.rfEdges);

  React.useEffect(() => {
    const layout = getLayoutedElements(
      scopedNodes,
      scopedEdges,
      layoutDir,
      false,
      viewDensity === 'compact',
      nodeScale
    );
    setRfNodes(layout.rfNodes);
    setRfEdges(layout.rfEdges);
  }, [scopedNodes, scopedEdges, layoutDir, viewDensity, nodeScale]);

  // Drill-down navigation handlers
  const handleDrillDown = useCallback(
    (nodeToOpen: Node) => {
      if (nodeToOpen.id === project.endGoalNodeId) return;
      setScopeStack((prev) => [...prev, nodeToOpen]);
      setSelectedEdgeId(null);
      setTimeout(() => {
        fitView({ padding: 0.25, duration: 350 });
      }, 50);
    },
    [project.endGoalNodeId, fitView]
  );

  const handleNavigateToBreadcrumb = useCallback(
    async (index: number) => {
      setSelectedEdgeId(null);
      // Automatically trigger due date computation when shifting to a superior level
      await syncAtomicInheritance();
      if (index === -1) {
        setScopeStack([]);
      } else {
        setScopeStack((prev) => prev.slice(0, index + 1));
      }
      setTimeout(() => {
        fitView({ padding: 0.25, duration: 350 });
      }, 50);
    },
    [fitView, syncAtomicInheritance]
  );

  const handleGoUpOneLevel = useCallback(async () => {
    setSelectedEdgeId(null);
    // Automatically trigger due date computation when shifting to immediately superior level
    await syncAtomicInheritance();
    setScopeStack((prev) => prev.slice(0, prev.length - 1));
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 350 });
    }, 50);
  }, [fitView, syncAtomicInheritance]);

  // Keyboard shortcut: Escape to go up one level
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && scopeStack.length > 0) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          handleGoUpOneLevel();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [scopeStack.length, handleGoUpOneLevel]);

  // Clean onNodesChange: updates RF local state and propagates node deletions to storage
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedNodeIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => c.id)
      );

      if (removedNodeIds.size > 0) {
        // Erase connected edges first
        setRfEdges((eds) =>
          eds.filter((e) => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target))
        );
        setSelectedEdgeId((prevId) => {
          if (!prevId) return null;
          const isConnected = rfEdges.some(
            (e) => e.id === prevId && (removedNodeIds.has(e.source) || removedNodeIds.has(e.target))
          );
          return isConnected ? null : prevId;
        });
      }

      setRfNodes((nds) => applyNodeChanges(changes, nds));
      changes.forEach((change) => {
        if (change.type === 'remove') {
          deleteNode(change.id);
        }
      });
    },
    [deleteNode, rfEdges]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRfEdges((eds) => applyEdgeChanges(changes, eds));
      changes.forEach((change) => {
        if (change.type === 'remove') {
          deleteEdge(change.id);
          if (selectedEdgeId === change.id) {
            setSelectedEdgeId(null);
          }
        } else if (change.type === 'select') {
          if (change.selected) {
            setSelectedEdgeId(change.id);
          } else if (selectedEdgeId === change.id) {
            setSelectedEdgeId(null);
          }
        }
      });
    },
    [deleteEdge, selectedEdgeId]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const res = await addEdge(connection.source, connection.target);
      if (!res.success) {
        alert(`Cannot create dependency: ${res.error}`);
      }
    },
    [addEdge]
  );

  // PowerPoint-style Smart Alignment Drag Handler with Real Magnetic Snap
  const onNodeDrag = useCallback(
    (_event: unknown, activeNode: RFNode) => {
      if (
        !activeNode?.position ||
        !isValidCoordinate(activeNode.position.x) ||
        !isValidCoordinate(activeNode.position.y)
      ) {
        return;
      }

      let activeX = activeNode.position.x;
      let activeY = activeNode.position.y;

      let matchedH: GuideLine | null = null;
      let matchedV: GuideLine | null = null;

      const otherNodes = rfNodes.filter((n) => n.id !== activeNode.id);

      const activeCenterX = activeX + NODE_WIDTH / 2;
      const activeCenterY = activeY + NODE_HEIGHT / 2;
      const activeRight = activeX + NODE_WIDTH;
      const activeBottom = activeY + NODE_HEIGHT;

      for (const other of otherNodes) {
        if (
          !other.position ||
          !isValidCoordinate(other.position.x) ||
          !isValidCoordinate(other.position.y)
        ) {
          continue;
        }

        const otherX = other.position.x;
        const otherY = other.position.y;
        const otherCenterX = otherX + NODE_WIDTH / 2;
        const otherCenterY = otherY + NODE_HEIGHT / 2;
        const otherRight = otherX + NODE_WIDTH;
        const otherBottom = otherY + NODE_HEIGHT;

        // --- X Axis Alignment Checks (Vertical Lines) ---
        if (Math.abs(activeX - otherX) < SNAP_THRESHOLD) {
          activeX = otherX;
          matchedV = { coord: otherX };
        } else if (Math.abs(activeCenterX - otherCenterX) < SNAP_THRESHOLD) {
          activeX = otherCenterX - NODE_WIDTH / 2;
          matchedV = { coord: otherCenterX };
        } else if (Math.abs(activeRight - otherRight) < SNAP_THRESHOLD) {
          activeX = otherRight - NODE_WIDTH;
          matchedV = { coord: otherRight };
        }

        // --- Y Axis Alignment Checks (Horizontal Lines) ---
        if (Math.abs(activeY - otherY) < SNAP_THRESHOLD) {
          activeY = otherY;
          matchedH = { coord: otherY };
        } else if (Math.abs(activeCenterY - otherCenterY) < SNAP_THRESHOLD) {
          activeY = otherCenterY - NODE_HEIGHT / 2;
          matchedH = { coord: otherCenterY };
        } else if (Math.abs(activeBottom - otherBottom) < SNAP_THRESHOLD) {
          activeY = otherBottom - NODE_HEIGHT;
          matchedH = { coord: otherBottom };
        }
      }

      setGuideLines({ horizontal: matchedH, vertical: matchedV });

      // Magnetically snap the node position in state if aligned
      if (matchedV || matchedH) {
        setRfNodes((nds) =>
          nds.map((n) => {
            if (n.id === activeNode.id) {
              return {
                ...n,
                position: { x: activeX, y: activeY },
              };
            }
            return n;
          })
        );
      }
    },
    [rfNodes]
  );

  // Drag Stop: Magnetically snap and persist final coordinates
  const onNodeDragStop = useCallback(
    (_event: unknown, activeNode: RFNode) => {
      setGuideLines({ horizontal: null, vertical: null });
      if (
        !activeNode?.position ||
        !isValidCoordinate(activeNode.position.x) ||
        !isValidCoordinate(activeNode.position.y)
      ) {
        return;
      }

      let finalX = activeNode.position.x;
      let finalY = activeNode.position.y;

      const otherNodes = rfNodes.filter((n) => n.id !== activeNode.id);
      const activeCenterX = finalX + NODE_WIDTH / 2;
      const activeCenterY = finalY + NODE_HEIGHT / 2;
      const activeRight = finalX + NODE_WIDTH;
      const activeBottom = finalY + NODE_HEIGHT;

      for (const other of otherNodes) {
        if (!other.position || !isValidCoordinate(other.position.x) || !isValidCoordinate(other.position.y)) continue;
        const otherX = other.position.x;
        const otherY = other.position.y;
        const otherCenterX = otherX + NODE_WIDTH / 2;
        const otherCenterY = otherY + NODE_HEIGHT / 2;
        const otherRight = otherX + NODE_WIDTH;
        const otherBottom = otherY + NODE_HEIGHT;

        // X Snap
        if (Math.abs(finalX - otherX) < SNAP_THRESHOLD) {
          finalX = otherX;
        } else if (Math.abs(activeCenterX - otherCenterX) < SNAP_THRESHOLD) {
          finalX = otherCenterX - NODE_WIDTH / 2;
        } else if (Math.abs(activeRight - otherRight) < SNAP_THRESHOLD) {
          finalX = otherRight - NODE_WIDTH;
        }

        // Y Snap
        if (Math.abs(finalY - otherY) < SNAP_THRESHOLD) {
          finalY = otherY;
        } else if (Math.abs(activeCenterY - otherCenterY) < SNAP_THRESHOLD) {
          finalY = otherCenterY - NODE_HEIGHT / 2;
        } else if (Math.abs(activeBottom - otherBottom) < SNAP_THRESHOLD) {
          finalY = otherBottom - NODE_HEIGHT;
        }
      }

      finalX = Math.round(finalX);
      finalY = Math.round(finalY);

      setRfNodes((nds) =>
        nds.map((n) => (n.id === activeNode.id ? { ...n, position: { x: finalX, y: finalY } } : n))
      );

      const targetNode = nodes.find((n) => n.id === activeNode.id);
      if (targetNode) {
        updateNode({
          ...targetNode,
          position: {
            x: finalX,
            y: finalY,
          },
        });
      }
    },
    [rfNodes, nodes, updateNode]
  );

  // Auto Layout Handler - tight minimal distance layout
  const handleAutoLayout = useCallback(
    (direction: 'LR' | 'TB' = layoutDir) => {
      const isCompact = viewDensity === 'compact';
      const layout = getLayoutedElements(
        scopedNodes,
        scopedEdges,
        direction,
        true,
        isCompact,
        nodeScale
      );
      setRfNodes(layout.rfNodes);
      setRfEdges(layout.rfEdges);

      const positionsToUpdate = layout.rfNodes.map((rfN) => ({
        id: rfN.id,
        position: rfN.position,
      }));
      updateNodePositions(positionsToUpdate);

      setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 });
      }, 50);
    },
    [scopedNodes, scopedEdges, layoutDir, viewDensity, nodeScale, updateNodePositions, fitView]
  );

  const handleScaleChange = useCallback(
    (newScale: number) => {
      setNodeScale(newScale);
      const isCompact = viewDensity === 'compact';
      const layout = getLayoutedElements(
        scopedNodes,
        scopedEdges,
        layoutDir,
        true,
        isCompact,
        newScale
      );
      setRfNodes(layout.rfNodes);
      setRfEdges(layout.rfEdges);

      const positionsToUpdate = layout.rfNodes.map((rfN) => ({
        id: rfN.id,
        position: rfN.position,
      }));
      updateNodePositions(positionsToUpdate);

      setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 });
      }, 50);
    },
    [viewDensity, scopedNodes, scopedEdges, layoutDir, updateNodePositions, fitView]
  );

  const handleDensityChange = useCallback(
    (newDensity: 'auto' | 'compact' | 'full') => {
      setViewDensity(newDensity);
      const isCompact = newDensity === 'compact';
      const layout = getLayoutedElements(
        scopedNodes,
        scopedEdges,
        layoutDir,
        true,
        isCompact,
        nodeScale
      );
      setRfNodes(layout.rfNodes);
      setRfEdges(layout.rfEdges);

      const positionsToUpdate = layout.rfNodes.map((rfN) => ({
        id: rfN.id,
        position: rfN.position,
      }));
      updateNodePositions(positionsToUpdate);

      setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 });
      }, 50);
    },
    [nodeScale, scopedNodes, scopedEdges, layoutDir, updateNodePositions, fitView]
  );

  const handleFitScreen = useCallback(() => {
    fitView({ padding: 0.15, duration: 300 });
  }, [fitView]);

  const handleToggleLayoutDirection = () => {
    const newDir = layoutDir === 'LR' ? 'TB' : 'LR';
    setLayoutDir(newDir);
    handleAutoLayout(newDir);
  };

  // Direct In-Canvas Node Creation (Toolbar button)
  const handleQuickAddNode = async () => {
    const defaultDueDate = currentParentNode?.dueDate || addDays(getTodayString(), 7);
    const parentId = currentParentNode ? currentParentNode.id : null;
    const lastNode = scopedNodes[scopedNodes.length - 1];
    let newPos = { x: 100, y: 150 };

    if (lastNode?.position && isValidCoordinate(lastNode.position.x) && isValidCoordinate(lastNode.position.y)) {
      newPos = { x: lastNode.position.x - 60, y: lastNode.position.y + 120 };
    }

    await addNode('New Task', defaultDueDate, parentId, newPos);
  };

  // Right-click on canvas pane to create node directly at cursor location
  const handlePaneContextMenu = async (event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const posX = isValidCoordinate(position.x) ? Math.round(position.x - 130) : 100;
    const posY = isValidCoordinate(position.y) ? Math.round(position.y - 70) : 150;
    const defaultDueDate = currentParentNode?.dueDate || addDays(getTodayString(), 7);
    const parentId = currentParentNode ? currentParentNode.id : null;

    await addNode('New Task', defaultDueDate, parentId, { x: posX, y: posY });
  };

  const handleDecomposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decomposingNode || !subtasksInput.trim()) return;

    const subtaskLines = subtasksInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const subtasks = subtaskLines.map((text, i) => ({
      text,
      dueDate: addDays(decomposingNode.dueDate, -Math.max(1, (subtaskLines.length - i) * 2)),
    }));

    await decomposeNode(decomposingNode.id, subtasks);
    setDecomposingNode(null);
    setSubtasksInput('');
    setTimeout(() => handleAutoLayout(), 100);
  };

  const handleSnapshotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSnapshot(snapshotMsg.trim() || undefined);
    setSnapshotMsg('');
    setIsSnapshotModalOpen(false);
  };

  const handleDeleteSelectedEdge = () => {
    if (selectedEdgeId) {
      deleteEdge(selectedEdgeId);
      setSelectedEdgeId(null);
    }
  };

  // Enhance RFNodes with current data handlers
  const decoratedNodes = useMemo(() => {
    return rfNodes.map((rfNode): RFNode => {
      const nodeObj = nodes.find((n) => n.id === rfNode.id);
      if (!nodeObj) return rfNode;

      const isEGN = nodeObj.id === project.endGoalNodeId;
      const nodeNotesCount = notes.filter((note) => note.nodeId === nodeObj.id).length;
      const subtaskCount = nodes.filter((n) => n.parentNodeId === nodeObj.id).length;

      const nodeData: GraphNodeData = {
        node: nodeObj,
        isEGN,
        notesCount: nodeNotesCount,
        subtaskCount,
        viewDensity,
        nodeScale,
        totalNodesInScope: scopedNodes.length,
        onStatusChange: (status: NodeStatus) => updateNodeStatus(nodeObj.id, status),
        onTextChange: (newText: string) => updateNode({ ...nodeObj, text: newText }),
        onDateChange: (newDate: string) => moveNodeDate(nodeObj.id, newDate),
        onOpenNotes: () => {
          setSelectedNode(nodeObj);
          setIsNotesDrawerOpen(true);
        },
        onOpenDecompose: () => setDecomposingNode(nodeObj),
        onDeleteNode: isEGN
          ? undefined
          : () => {
              // 1. Erase connected edges first in local React Flow state
              setRfEdges((eds) =>
                eds.filter((e) => e.source !== nodeObj.id && e.target !== nodeObj.id)
              );
              setSelectedEdgeId((prev) => {
                if (!prev) return null;
                const isConnected = rfEdges.some(
                  (e) => e.id === prev && (e.source === nodeObj.id || e.target === nodeObj.id)
                );
                return isConnected ? null : prev;
              });
              // 2. Erase node next
              setRfNodes((nds) => nds.filter((n) => n.id !== nodeObj.id));
              // 3. Persist to storage
              deleteNode(nodeObj.id);
            },
        onDrillDown: isEGN ? undefined : () => handleDrillDown(nodeObj),
      };

      return {
        ...rfNode,
        data: nodeData,
      };
    });
  }, [
    rfNodes,
    nodes,
    project.endGoalNodeId,
    notes,
    viewDensity,
    nodeScale,
    scopedNodes.length,
    updateNodeStatus,
    updateNode,
    deleteNode,
    moveNodeDate,
    setSelectedNode,
    setIsNotesDrawerOpen,
    handleDrillDown,
  ]);

  const decoratedEdges = useMemo(() => {
    const arrowSize = Math.round(18 * nodeScale);
    const strokeWidth = Math.max(1.5, Math.round(2.5 * nodeScale * 10) / 10);
    const interactionWidth = Math.round(20 * nodeScale);

    return rfEdges.map((e) => {
      const isSelected = e.id === selectedEdgeId;
      return {
        ...e,
        selected: isSelected,
        type: 'smoothstep',
        animated: false,
        interactionWidth,
        style: { strokeWidth },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: arrowSize,
          height: arrowSize,
          color: isSelected
            ? '#10b981'
            : preferences.theme === 'dark'
            ? '#94a3b8'
            : '#64748b',
        },
      };
    });
  }, [rfEdges, selectedEdgeId, preferences.theme, nodeScale]);

  return (
    <div className="flex-1 h-full relative dark:bg-slate-950 bg-slate-50 flex flex-col overflow-hidden transition-colors duration-150">
      {/* Breadcrumb & Task Hierarchy Scope Header */}
      <div className="bg-white/95 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs z-20 backdrop-blur-md shrink-0">
        {/* Left: Breadcrumbs Trail */}
        <div className="flex items-center space-x-1.5 text-xs font-medium overflow-x-auto py-0.5">
          <button
            onClick={() => handleNavigateToBreadcrumb(-1)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              scopeStack.length === 0
                ? 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{project.name} (Root)</span>
          </button>

          {scopeStack.map((scopeNode, idx) => {
            const isLast = idx === scopeStack.length - 1;
            return (
              <React.Fragment key={scopeNode.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <button
                  onClick={() => handleNavigateToBreadcrumb(idx)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer truncate max-w-[200px] sm:max-w-xs ${
                    isLast
                      ? 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={scopeNode.text}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate">{scopeNode.text}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Parent Context & Back Up button */}
        {currentParentNode && (
          <div className="flex items-center space-x-3 text-xs">
            <div className="hidden sm:flex items-center space-x-2 text-slate-500 dark:text-slate-400">
              <span>Parent Due: <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{currentParentNode.dueDate}</span></span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{scopedNodes.length} internal subtasks</span>
            </div>

            <button
              onClick={handleGoUpOneLevel}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
              title="Go back up one level"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back Up</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Toolbar */}
      <div className="absolute top-14 left-4 z-20 flex flex-wrap items-center gap-2 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl shadow-lg backdrop-blur-md">
        <button
          onClick={handleQuickAddNode}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
          title={currentParentNode ? `Add subtask to ${currentParentNode.text}` : 'Add task directly to canvas'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{currentParentNode ? 'Add Subtask' : 'Add Task'}</span>
        </button>

        <button
          onClick={() => handleAutoLayout()}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
          title="Auto-align topological DAG with minimal node distance"
        >
          <Workflow className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Auto Layout</span>
        </button>

        <button
          onClick={handleToggleLayoutDirection}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
          title={`Switch graph orientation (${layoutDir === 'LR' ? 'Horizontal Left-to-Right' : 'Vertical Top-to-Bottom'})`}
        >
          {layoutDir === 'LR' ? (
            <>
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>L→R</span>
            </>
          ) : (
            <>
              <ArrowDownUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>T↓B</span>
            </>
          )}
        </button>

        {/* View Density / LOD Semantic Zoom Switcher */}
        <div className="flex items-center space-x-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => handleDensityChange('auto')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
              viewDensity === 'auto'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Auto LOD: Automatically switches to simplified circles when zoomed out"
          >
            <Sparkles className="w-3 h-3" />
            <span>Auto</span>
          </button>
          <button
            onClick={() => handleDensityChange('compact')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
              viewDensity === 'compact'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Simplified circles: compact high-density view with hover details"
          >
            <CircleDot className="w-3 h-3" />
            <span>Circles</span>
          </button>
          <button
            onClick={() => handleDensityChange('full')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
              viewDensity === 'full'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Full cards: detailed editable task cards"
          >
            <LayoutGrid className="w-3 h-3" />
            <span>Cards</span>
          </button>
        </div>

        {/* Node Scale Sizing Selector */}
        <div className="flex items-center space-x-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1 font-semibold">Scale</span>
          <button
            onClick={() => handleScaleChange(0.85)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              nodeScale === 0.85
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Small scale (85%)"
          >
            S
          </button>
          <button
            onClick={() => handleScaleChange(1.0)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              nodeScale === 1.0
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Regular scale (100%)"
          >
            M
          </button>
          <button
            onClick={() => handleScaleChange(1.2)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              nodeScale === 1.2
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Large scale (120% - enlarged nodes and arrows)"
          >
            L
          </button>
        </div>

        {/* Fit Screen Button */}
        <button
          onClick={handleFitScreen}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
          title="Fit graph to screen tightly"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Fit</span>
        </button>

        {/* Selected edge quick delete */}
        {selectedEdgeId && (
          <button
            onClick={handleDeleteSelectedEdge}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 transition-colors cursor-pointer animate-in fade-in"
            title="Delete selected dependency (or press Delete key)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>Delete Edge</span>
          </button>
        )}

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        <button
          onClick={() => setIsSnapshotModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
          title="Capture versioned snapshot"
        >
          <Camera className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>Snapshot</span>
        </button>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 w-full h-full relative">
        <AlignmentGuidesOverlay guideLines={guideLines} />

        {/* Empty State Overlay for internal decomposed scope */}
        {currentParentNode && scopedNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
            <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md text-center shadow-2xl backdrop-blur-md space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Decomposition of "{currentParentNode.text}"
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  No internal subtasks yet. Right-click anywhere on the canvas or click below to build the sub-graph of tasks required to achieve this goal.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={handleQuickAddNode}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Subtask</span>
                </button>
                <button
                  onClick={handleGoUpOneLevel}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Back to Parent
                </button>
              </div>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={decoratedNodes}
          edges={decoratedEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={(_event, rfN) => {
            const nObj = nodes.find((n) => n.id === rfN.id);
            if (nObj) handleDrillDown(nObj);
          }}
          onConnect={onConnect}
          onPaneContextMenu={handlePaneContextMenu}
          onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
          onDelete={({ nodes: deletedNodes, edges: deletedEdges }) => {
            const deletedNodeIds = new Set(deletedNodes.map((n) => n.id));
            const deletedEdgeIds = new Set(deletedEdges.map((e) => e.id));

            // 1. Erase connecting and selected edges first
            setRfEdges((eds) =>
              eds.filter(
                (e) =>
                  !deletedEdgeIds.has(e.id) &&
                  !deletedNodeIds.has(e.source) &&
                  !deletedNodeIds.has(e.target)
              )
            );
            deletedEdges.forEach((e) => deleteEdge(e.id));
            setSelectedEdgeId(null);

            // 2. Erase nodes next
            setRfNodes((nds) => nds.filter((n) => !deletedNodeIds.has(n.id)));
            deletedNodes.forEach((n) => deleteNode(n.id));
          }}
          deleteKeyCode={['Backspace', 'Delete']}
          zoomOnDoubleClick={false}
          fitView
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background
            color={preferences.theme === 'dark' ? '#334155' : '#cbd5e1'}
            gap={20}
            size={1}
            className="dark:bg-slate-950 bg-slate-50"
          />
          <Controls className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !fill-slate-700 dark:!fill-slate-200 !text-slate-700 dark:!text-slate-200 shadow-sm" />
          <MiniMap
            nodeColor={(n) => {
              const nd = n.data as unknown as GraphNodeData;
              if (nd?.isEGN) return '#10b981';
              if (nd?.node.status === 'completed') return '#059669';
              if (nd?.node.status === 'in_progress') return '#f59e0b';
              if (nd?.node.status === 'abandoned') return '#e11d48';
              return '#475569';
            }}
            maskColor={preferences.theme === 'dark' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
            className="!bg-white dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800 shadow-sm"
          />
        </ReactFlow>
      </div>

      {/* Decompose Task Modal */}
      {decomposingNode && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Decompose Task</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Break down <strong className="text-slate-800 dark:text-slate-100">"{decomposingNode.text}"</strong> into subtasks. Enter one subtask per line.
            </p>

            <form onSubmit={handleDecomposeSubmit} className="space-y-4">
              <textarea
                required
                rows={5}
                placeholder="Write introduction&#10;Write methods&#10;Write results&#10;Prepare figures"
                value={subtasksInput}
                onChange={(e) => setSubtasksInput(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono shadow-inner"
              />

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDecomposingNode(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/40 cursor-pointer"
                >
                  Generate Subtasks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snapshot Modal */}
      {isSnapshotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-amber-500 dark:text-amber-400">
              <Camera className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Capture Version Snapshot</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Save an immutable snapshot of the current project graph and notes.
            </p>

            <form onSubmit={handleSnapshotSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. Added experiment phase 2 decomposition..."
                value={snapshotMsg}
                onChange={(e) => setSnapshotMsg(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-inner"
              />

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/20 dark:shadow-amber-950/40 cursor-pointer"
                >
                  Capture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const GraphView: React.FC = () => {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  );
};
