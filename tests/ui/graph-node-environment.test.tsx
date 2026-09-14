import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GraphNode, GraphNodeData } from '../../src/ui/views/graph/GraphNode';
import { AppContext } from '../../src/ui/context/AppContext';
import { Node } from '../../src/domain/models/types';

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  Handle: (props: any) => <div data-testid="xyflow-handle" {...props} />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

describe('GraphNode Environment Toggle Button', () => {
  const updateNodeMock = vi.fn().mockResolvedValue(undefined);
  const onEnvironmentChangeMock = vi.fn();
  const onStatusChangeMock = vi.fn();
  const onTextChangeMock = vi.fn();
  const onDateChangeMock = vi.fn();
  const onOpenNotesMock = vi.fn();

  const baseNode: Node = {
    id: 'node-1',
    projectId: 'proj-1',
    text: 'Implement Neural Graph',
    dueDate: '2026-09-20',
    status: 'planned',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const createNodeData = (nodeOverrides?: Partial<Node>, dataOverrides?: Partial<GraphNodeData>): GraphNodeData => ({
    node: { ...baseNode, ...nodeOverrides },
    isEGN: false,
    notesCount: 0,
    subtaskCount: 0,
    viewDensity: 'compact',
    onStatusChange: onStatusChangeMock,
    onTextChange: onTextChangeMock,
    onDateChange: onDateChangeMock,
    onEnvironmentChange: onEnvironmentChangeMock,
    onOpenNotes: onOpenNotesMock,
    ...dataOverrides,
  });

  const baseContextValue: any = {
    preferences: {
      theme: 'dark',
      attentionSystemEnabled: true,
      attentionUnitMinutes: 15,
      dateFormat: 'DD/MM/YYYY',
    },
    activityLog: [],
    updateTaskEstimate: vi.fn(),
    activeWorkSession: null,
    activeWorkElapsedSeconds: 0,
    openWorkSessionsModal: vi.fn(),
    updateNode: updateNodeMock,
    formatDateDisplay: (d: string) => d,
  };

  const renderNode = (data: GraphNodeData, selected = false) => {
    const props: any = {
      id: 'node-1',
      data,
      selected,
      type: 'graphNode',
      zIndex: 1,
      isConnectable: true,
      dragging: false,
    };
    return render(
      <AppContext.Provider value={baseContextValue}>
        <GraphNode {...props} />
      </AppContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Compact / Circular Node Mode', () => {
    it('always displays environment toggle button defaulting to computer (💻) when undefined', () => {
      const nodeData = createNodeData({ environment: undefined });
      renderNode(nodeData);

      const toggleBtn = screen.getByTestId('graph-node-environment-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent('💻');
      expect(toggleBtn).toHaveAttribute('title', expect.stringContaining('Task Environment: computer'));
    });

    it('displays physical icon (🏃) when environment is physical', () => {
      const nodeData = createNodeData({ environment: 'physical' });
      renderNode(nodeData);

      const toggleBtn = screen.getByTestId('graph-node-environment-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent('🏃');
      expect(toggleBtn).toHaveAttribute('title', expect.stringContaining('Task Environment: physical'));
    });

    it('displays mixed icon (🔄) when environment is mixed', () => {
      const nodeData = createNodeData({ environment: 'mixed' });
      renderNode(nodeData);

      const toggleBtn = screen.getByTestId('graph-node-environment-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveTextContent('🔄');
      expect(toggleBtn).toHaveAttribute('title', expect.stringContaining('Task Environment: mixed'));
    });

    it('cycles from computer (💻) to physical (🏃) when clicked', () => {
      const nodeData = createNodeData({ environment: 'computer' });
      renderNode(nodeData);

      const toggleBtn = screen.getByTestId('graph-node-environment-toggle');
      fireEvent.click(toggleBtn);

      expect(onEnvironmentChangeMock).toHaveBeenCalledWith('physical');
      expect(updateNodeMock).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'physical' })
      );
    });

    it('cycles from physical (🏃) to mixed (🔄) when clicked', () => {
      const nodeData = createNodeData({ environment: 'physical' });
      renderNode(nodeData);

      const toggleBtn = screen.getByTestId('graph-node-environment-toggle');
      fireEvent.click(toggleBtn);

      expect(onEnvironmentChangeMock).toHaveBeenCalledWith('mixed');
      expect(updateNodeMock).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'mixed' })
      );
    });

    it('cycles from mixed (🔄) back to computer (💻) when clicked', () => {
      const nodeData = createNodeData({ environment: 'mixed' });
      renderNode(nodeData);

      const toggleBtn = screen.getByTestId('graph-node-environment-toggle');
      fireEvent.click(toggleBtn);

      expect(onEnvironmentChangeMock).toHaveBeenCalledWith('computer');
      expect(updateNodeMock).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'computer' })
      );
    });
  });

  describe('Full Density Node Mode', () => {
    it('renders environment toggle button with icon and text in full density mode', () => {
      const nodeData = createNodeData({ environment: 'physical' }, { viewDensity: 'full' });
      renderNode(nodeData);

      const fullToggleBtn = screen.getByTestId('graph-node-environment-toggle-full');
      expect(fullToggleBtn).toBeInTheDocument();
      expect(fullToggleBtn).toHaveTextContent('🏃');
      expect(fullToggleBtn).toHaveTextContent('physical');

      fireEvent.click(fullToggleBtn);
      expect(onEnvironmentChangeMock).toHaveBeenCalledWith('mixed');
    });
  });

  describe('Hover Card / Popover Mode', () => {
    it('renders environment toggle button in popover header when node is selected', () => {
      const nodeData = createNodeData({ environment: 'mixed' }, { viewDensity: 'compact' });
      renderNode(nodeData, true);

      const popoverToggleBtn = screen.getByTestId('graph-popover-environment-toggle');
      expect(popoverToggleBtn).toBeInTheDocument();
      expect(popoverToggleBtn).toHaveTextContent('🔄');
      expect(popoverToggleBtn).toHaveTextContent('mixed');

      fireEvent.click(popoverToggleBtn);
      expect(onEnvironmentChangeMock).toHaveBeenCalledWith('computer');
    });
  });
});
