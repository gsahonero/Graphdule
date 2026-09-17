import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BonsaiCompanion } from '../../src/ui/components/BonsaiCompanion';
import { BonsaiState } from '../../src/domain/models/types';

describe('BonsaiCompanion', () => {
  it('renders default seedling state correctly', () => {
    render(<BonsaiCompanion />);

    expect(screen.getByTestId('bonsai-companion')).toBeInTheDocument();
    expect(screen.getByText('Seedling')).toBeInTheDocument();
    expect(screen.getByText('0 pts')).toBeInTheDocument();
  });

  it('renders stage 1 (Sprout) with updated points', () => {
    const sproutState: BonsaiState = {
      growthPoints: 75,
      stage: 1,
      leavesCount: 6,
      blossomCount: 2,
      lastWateredDate: '2026-09-15',
    };

    render(<BonsaiCompanion state={sproutState} />);

    expect(screen.getByText('Sprout')).toBeInTheDocument();
    expect(screen.getByText('75 pts')).toBeInTheDocument();
  });

  it('renders stage 4 (Ancient) with Mastery badge', () => {
    const ancientState: BonsaiState = {
      growthPoints: 850,
      stage: 4,
      leavesCount: 35,
      blossomCount: 20,
      lastWateredDate: '2026-09-15',
    };

    render(<BonsaiCompanion state={ancientState} />);

    expect(screen.getByText('Ancient')).toBeInTheDocument();
    expect(screen.getByText('850 pts')).toBeInTheDocument();
    expect(screen.getByText('Mastery')).toBeInTheDocument();
  });

  it('hides details when showDetails is false', () => {
    render(<BonsaiCompanion showDetails={false} />);

    expect(screen.queryByText('Seedling')).not.toBeInTheDocument();
  });

  it('shows rich growth tooltip when mouse enters companion', () => {
    render(<BonsaiCompanion />);

    const container = screen.getByTestId('bonsai-companion');
    fireEvent.mouseEnter(container);

    expect(screen.getByTestId('bonsai-growth-tooltip')).toBeInTheDocument();
    expect(screen.getByText('How we make it grow:')).toBeInTheDocument();
    expect(screen.getByText(/Complete tasks & focus/)).toBeInTheDocument();
    expect(screen.getByText(/Intentional recovery/)).toBeInTheDocument();
    expect(screen.getByText(/Zero-Shame Promise/)).toBeInTheDocument();
  });

  it('renders different companion species like cat, owl, fox, turtle', () => {
    const catState: BonsaiState = {
      companionType: 'cat',
      growthPoints: 120,
      stage: 1,
      leavesCount: 7,
      blossomCount: 3,
      lastWateredDate: '2026-09-16',
    };

    render(<BonsaiCompanion state={catState} />);

    expect(screen.getByText('Playful Cat')).toBeInTheDocument();
    expect(screen.getByText('120 pts')).toBeInTheDocument();
  });

  it('opens pet selector modal on click and selects a new pet', async () => {
    const onPetChange = vi.fn();
    render(<BonsaiCompanion onPetChange={onPetChange} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByTestId('companion-pet-modal')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Focus Companion')).toBeInTheDocument();

    // Click on the cat card
    const catCard = screen.getByTestId('pet-card-cat');
    expect(catCard).toBeInTheDocument();
    fireEvent.click(catCard);

    expect(onPetChange).toHaveBeenCalledWith('cat');
    await waitFor(() => {
      expect(screen.queryByTestId('companion-pet-modal')).not.toBeInTheDocument();
    });
  });
});
