import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PostTaskReceiptModal, PostTaskReceiptData } from '../../src/ui/components/PostTaskReceiptModal';

describe('PostTaskReceiptModal', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleData: PostTaskReceiptData = {
    taskId: 'task-123',
    taskText: 'Refactor state machine',
    predictedAU: 2.0,
    actualAU: 2.1,
    actualMinutes: 32,
    pointsEarned: 21,
    newStage: 1,
    didAdvanceStage: false,
  };

  it('renders nothing when isOpen is false', () => {
    render(<PostTaskReceiptModal isOpen={false} onClose={onCloseMock} data={sampleData} />);
    expect(screen.queryByText('Task Completed')).not.toBeInTheDocument();
  });

  it('renders predicted vs actual AU and spot-on calibration message', () => {
    render(<PostTaskReceiptModal isOpen={true} onClose={onCloseMock} data={sampleData} />);

    expect(screen.getByText('Task Completed')).toBeInTheDocument();
    expect(screen.getByText('Refactor state machine')).toBeInTheDocument();
    expect(screen.getByText('2 AU')).toBeInTheDocument();
    expect(screen.getByText('2.1 AU')).toBeInTheDocument();
    expect(screen.getByText('(32m)')).toBeInTheDocument();
    expect(screen.getByText(/Spot-on calibration/i)).toBeInTheDocument();
    expect(screen.getByText('+21 Bonsai Growth Points')).toBeInTheDocument();
  });

  it('renders deep stretch feedback when actual significantly exceeds prediction', () => {
    const hardTask: PostTaskReceiptData = {
      ...sampleData,
      predictedAU: 1.0,
      actualAU: 3.5,
      actualMinutes: 52,
      pointsEarned: 35,
    };
    render(<PostTaskReceiptModal isOpen={true} onClose={onCloseMock} data={hardTask} />);

    expect(screen.getByText(/demanded more attention than expected/i)).toBeInTheDocument();
  });

  it('renders wrapped up faster feedback when actual is significantly lower than prediction', () => {
    const fastTask: PostTaskReceiptData = {
      ...sampleData,
      predictedAU: 4.0,
      actualAU: 1.5,
      actualMinutes: 22,
      pointsEarned: 15,
    };
    render(<PostTaskReceiptModal isOpen={true} onClose={onCloseMock} data={fastTask} />);

    expect(screen.getByText(/Wrapped up faster than estimated/i)).toBeInTheDocument();
  });

  it('shows stage advancement notification when didAdvanceStage is true', () => {
    const stageUpTask: PostTaskReceiptData = {
      ...sampleData,
      newStage: 2,
      didAdvanceStage: true,
    };
    render(<PostTaskReceiptModal isOpen={true} onClose={onCloseMock} data={stageUpTask} />);

    expect(screen.getByText(/Stage Evolved to Sapling!/i)).toBeInTheDocument();
  });

  it('dismisses when Continue button is clicked', () => {
    render(<PostTaskReceiptModal isOpen={true} onClose={onCloseMock} data={sampleData} />);

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Enter or Escape key press', () => {
    render(<PostTaskReceiptModal isOpen={true} onClose={onCloseMock} data={sampleData} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });
});
