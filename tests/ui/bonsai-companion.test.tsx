import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
