import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GroupNode, GroupNodeData } from '../../src/ui/views/graph/GroupNode';
import { Node } from '../../src/domain/models/types';

vi.mock('@xyflow/react', () => ({
  Handle: (props: any) => <div data-testid="xyflow-handle" {...props} />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

describe('GroupNode Component (Compound Container)', () => {
  const baseNode: Node = {
    id: 'parent-1',
    projectId: 'proj-1',
    text: 'Refactor Core Architecture',
    dueDate: '2026-10-15',
    status: 'in_progress',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const createGroupData = (overrides?: Partial<GroupNodeData>): GroupNodeData => ({
    node: baseNode,
    childCount: 4,
    completedCount: 2,
    totalAU: 6.5,
    trackedAU: 3.0,
    width: 400,
    height: 250,
    layoutDir: 'LR',
    onDrillDown: vi.fn(),
    ...overrides,
  });

  const renderGroupNode = (data: GroupNodeData, selected = false) => {
    const props: any = {
      id: 'parent-1',
      data,
      selected,
      type: 'groupNode',
      zIndex: 1,
      isConnectable: true,
      dragging: false,
      selectable: true,
      deletable: true,
      draggable: true,
    };
    return render(<GroupNode {...props} />);
  };

  it('renders parent task title, subtask progress, and AU metrics', () => {
    const data = createGroupData();
    renderGroupNode(data);

    expect(screen.getByText('Refactor Core Architecture')).toBeInTheDocument();
    expect(screen.getByText('2/4 subtasks (50%)')).toBeInTheDocument();
    expect(screen.getByText('6.5 AU (3 tracked)')).toBeInTheDocument();
    expect(screen.getByText('2026-10-15')).toBeInTheDocument();
  });

  it('renders handles on left and right for LR layout', () => {
    const data = createGroupData({ layoutDir: 'LR' });
    renderGroupNode(data);

    const handles = screen.getAllByTestId('xyflow-handle');
    expect(handles.length).toBe(2);
    expect(handles.some((h) => h.getAttribute('position') === 'left')).toBe(true);
    expect(handles.some((h) => h.getAttribute('position') === 'right')).toBe(true);
  });

  it('triggers onDrillDown when clicking the Focus button', () => {
    const onDrillDownMock = vi.fn();
    const data = createGroupData({ onDrillDown: onDrillDownMock });
    renderGroupNode(data);

    const focusBtn = screen.getByRole('button', { name: /Focus/i });
    fireEvent.click(focusBtn);
    expect(onDrillDownMock).toHaveBeenCalledTimes(1);
  });

  it('renders critical path glowing styling when isOnCriticalPath is true', () => {
    const data = createGroupData({ isOnCriticalPath: true });
    const { container } = renderGroupNode(data);

    const groupContainer = container.querySelector('.group-container');
    expect(groupContainer).toBeInTheDocument();
    expect(groupContainer?.className).toContain('border-indigo-400/80');
    expect(groupContainer?.className).toContain('shadow-indigo-500/10');
  });

  it('renders Goal badge when parent is End Goal Node', () => {
    const data = createGroupData({ isEGN: true });
    renderGroupNode(data);

    expect(screen.getByText('Goal')).toBeInTheDocument();
  });
});
