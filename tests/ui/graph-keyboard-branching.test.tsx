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

describe('Graph Keyboard Branching, Spike Nodes and Inline Tokenizer', () => {
  const updateNodeMock = vi.fn().mockResolvedValue(undefined);
  const onQuickAppendChildMock = vi.fn();
  const onQuickAppendSiblingMock = vi.fn();
  const onNodeTypeChangeMock = vi.fn();
  const onCognitiveDemandChangeMock = vi.fn();
  const onTextChangeMock = vi.fn();

  const baseNode: Node = {
    id: 'node-1',
    projectId: 'proj-1',
    text: 'Implement Parser',
    dueDate: '2026-09-20',
    status: 'planned',
    nodeType: 'standard',
    cognitiveDemand: 'medium',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const createNodeData = (nodeOverrides?: Partial<Node>, dataOverrides?: Partial<GraphNodeData>): GraphNodeData => ({
    node: { ...baseNode, ...nodeOverrides },
    isEGN: false,
    notesCount: 0,
    subtaskCount: 0,
    viewDensity: 'full',
    onStatusChange: vi.fn(),
    onTextChange: onTextChangeMock,
    onDateChange: vi.fn(),
    onOpenNotes: vi.fn(),
    onQuickAppendChild: onQuickAppendChildMock,
    onQuickAppendSibling: onQuickAppendSiblingMock,
    onNodeTypeChange: onNodeTypeChangeMock,
    onCognitiveDemandChange: onCognitiveDemandChangeMock,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (nodeData: GraphNodeData) => {
    const props: any = {
      id: 'node-1',
      data: nodeData,
      selected: false,
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

  it('renders spike badge when nodeType is spike', () => {
    const data = createNodeData({ nodeType: 'spike', text: 'Explore CRDT Algorithms' });
    renderComponent(data);

    expect(screen.getByText('Spike')).toBeInTheDocument();
    expect(screen.getByText('Explore CRDT Algorithms')).toBeInTheDocument();
  });

  it('renders cognitive demand badge and cycles on click', () => {
    const data = createNodeData({ cognitiveDemand: 'high' });
    renderComponent(data);

    const demandBadge = screen.getByText('high');
    expect(demandBadge).toBeInTheDocument();

    fireEvent.click(demandBadge);
    expect(onCognitiveDemandChangeMock).toHaveBeenCalledWith('low');
  });

  it('shows completed spike prompt with "Add Next Step" button', () => {
    const data = createNodeData({ nodeType: 'spike', status: 'completed' });
    renderComponent(data);

    expect(screen.getByText('Spike complete! Discovered new tasks?')).toBeInTheDocument();
    const addNextBtn = screen.getByText('Add Next Step');
    expect(addNextBtn).toBeInTheDocument();

    fireEvent.click(addNextBtn);
    expect(onQuickAppendChildMock).toHaveBeenCalledTimes(1);
  });

  it('triggers onQuickAppendChild when Tab is pressed during inline editing', () => {
    const data = createNodeData({ text: 'New Task' });
    renderComponent(data);

    const input = screen.getByDisplayValue('New Task');
    fireEvent.change(input, { target: { value: 'Research GraphQL' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(onQuickAppendChildMock).toHaveBeenCalledTimes(1);
    expect(updateNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Research GraphQL',
      })
    );
  });

  it('parses shorthand inline tokens (!spike, !high, 2h) from text input', () => {
    const data = createNodeData({ text: 'New Task' });
    renderComponent(data);

    const input = screen.getByDisplayValue('New Task');
    fireEvent.change(input, { target: { value: 'Audit Security !spike !high 2h' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Audit Security',
        nodeType: 'spike',
        cognitiveDemand: 'high',
        estimatedAU: 8, // 2 hours * 60m / 15m AU = 8 AU
      })
    );
  });
});
