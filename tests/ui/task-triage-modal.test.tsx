import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TaskTriageModal, TriageTaskItem } from '../../src/ui/components/TaskTriageModal';
import { AppContext } from '../../src/ui/context/AppContext';

describe('TaskTriageModal', () => {
  const onCloseMock = vi.fn();
  const onApplyDelayMock = vi.fn().mockResolvedValue(undefined);

  const mockContextValue: any = {
    formatDateDisplay: (d: string) => d,
  };

  const sampleTasks: TriageTaskItem[] = [
    {
      id: 'task-1',
      text: 'Write benchmark suite',
      dueDate: '2026-09-10',
      projectId: 'proj-1',
      isNode: true,
    },
    {
      id: 'task-2',
      text: 'Submit expense report',
      dueDate: '2026-09-11',
      projectId: 'standalone',
      isNode: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true) => {
    return render(
      <AppContext.Provider value={mockContextValue}>
        <TaskTriageModal
          isOpen={isOpen}
          onClose={onCloseMock}
          tasks={sampleTasks}
          onApplyDelay={onApplyDelayMock}
        />
      </AppContext.Provider>
    );
  };

  it('renders nothing when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByText(/Triage/i)).not.toBeInTheDocument();
  });

  it('renders tasks and options when open', () => {
    renderModal(true);
    expect(screen.getByText('Triage 2 Overdue Tasks')).toBeInTheDocument();
    expect(screen.getByText('Write benchmark suite')).toBeInTheDocument();
    expect(screen.getByText('Submit expense report')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('+3 Days')).toBeInTheDocument();
    expect(screen.getByText('Next Monday')).toBeInTheDocument();
  });

  it('calls onApplyDelay with selected date and cascade when clicked', async () => {
    renderModal(true);

    const plusThreeDaysBtn = screen.getByText('+3 Days');
    fireEvent.click(plusThreeDaysBtn);

    const applyBtn = screen.getByText('Apply Reschedule');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(onApplyDelayMock).toHaveBeenCalledTimes(1);
    });
    expect(onApplyDelayMock).toHaveBeenCalledWith(
      ['task-1', 'task-2'],
      expect.any(String),
      true // cascade default is true
    );
    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it('allows toggling cascade shift off', async () => {
    renderModal(true);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    const applyBtn = screen.getByText('Apply Reschedule');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(onApplyDelayMock).toHaveBeenCalledWith(
        ['task-1', 'task-2'],
        expect.any(String),
        false
      );
    });
  });
});
