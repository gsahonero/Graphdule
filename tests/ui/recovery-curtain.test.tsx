import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoveryCurtainModal } from '../../src/ui/components/RecoveryCurtainModal';
import * as soundModule from '../../src/domain/health/sound';

vi.mock('../../src/domain/health/sound', () => ({
  playSynthesizedPreset: vi.fn(),
}));

describe('RecoveryCurtainModal', () => {
  const onEndRecoveryMock = vi.fn();
  const onMinimizeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <RecoveryCurtainModal
        isOpen={false}
        elapsedSeconds={30}
        targetMinutes={15}
        onEndRecovery={onEndRecoveryMock}
      />
    );
    expect(screen.queryByText(/Intentional Recovery/i)).not.toBeInTheDocument();
  });

  it('renders countdown timer when targetMinutes is provided', () => {
    render(
      <RecoveryCurtainModal
        isOpen={true}
        elapsedSeconds={60}
        targetMinutes={15} // 15m = 900s - 60s = 840s = 14:00
        onEndRecovery={onEndRecoveryMock}
      />
    );

    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('Time Remaining')).toBeInTheDocument();
    expect(screen.getByText('Resting & Recharging')).toBeInTheDocument();
  });

  it('renders elapsed timer when targetMinutes is not provided (open-ended)', () => {
    render(
      <RecoveryCurtainModal
        isOpen={true}
        elapsedSeconds={125} // 02:05
        targetMinutes={null}
        onEndRecovery={onEndRecoveryMock}
      />
    );

    expect(screen.getByText('02:05')).toBeInTheDocument();
    expect(screen.getByText('Elapsed Rest Time')).toBeInTheDocument();
  });

  it('plays chime and displays completion copy when time is reached', () => {
    render(
      <RecoveryCurtainModal
        isOpen={true}
        elapsedSeconds={900}
        targetMinutes={15}
        onEndRecovery={onEndRecoveryMock}
      />
    );

    expect(screen.getByText('Break Complete')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(soundModule.playSynthesizedPreset).toHaveBeenCalledWith('meditation_bell', 0.4);
  });

  it('calls onEndRecovery when End Break Early button is clicked', () => {
    render(
      <RecoveryCurtainModal
        isOpen={true}
        elapsedSeconds={10}
        targetMinutes={15}
        onEndRecovery={onEndRecoveryMock}
      />
    );

    const endBtn = screen.getByRole('button', { name: /End Break Early/i });
    fireEvent.click(endBtn);
    expect(onEndRecoveryMock).toHaveBeenCalledTimes(1);
  });

  it('calls onMinimize on Escape key when onMinimize is provided', () => {
    render(
      <RecoveryCurtainModal
        isOpen={true}
        elapsedSeconds={10}
        targetMinutes={15}
        onEndRecovery={onEndRecoveryMock}
        onMinimize={onMinimizeMock}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onMinimizeMock).toHaveBeenCalledTimes(1);
    expect(onEndRecoveryMock).not.toHaveBeenCalled();
  });
});
