import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttentionUnitInput } from '../../src/ui/components/AttentionUnitInput';
import * as AppContextModule from '../../src/ui/context/AppContext';

describe('AttentionUnitInput - Arbitrary AU numeric entry and live minutes', () => {
  const onChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      attentionUnitMinutes: 15,
    } as any);
  });

  it('renders initial value and formatted minutes badge', () => {
    render(<AttentionUnitInput value={2} onChange={onChangeMock} auMinutes={15} />);
    expect(screen.getByText('2 AU')).toBeDefined();
    expect(screen.getByText('· 30m')).toBeDefined();
  });

  it('opens popover on click and reveals numeric input allowing arbitrary decimal AU', () => {
    render(<AttentionUnitInput value={1} onChange={onChangeMock} auMinutes={15} />);
    
    // Click trigger badge
    const badge = screen.getByText('1 AU');
    fireEvent.click(badge);

    // Number input should be present with step='any' and min='0'
    const numInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    expect(numInput).toBeDefined();
    expect(numInput.value).toBe('1');

    // Type arbitrary decimal number '2.75'
    fireEvent.change(numInput, { target: { value: '2.75' } });
    expect(numInput.value).toBe('2.75');

    // Live preview minutes should calculate: 2.75 * 15 = 41.25m -> 41.3m
    expect(screen.getByText('41.3m')).toBeDefined();

    // Press Enter to commit
    fireEvent.keyDown(numInput, { key: 'Enter', code: 'Enter' });

    expect(onChangeMock).toHaveBeenCalledWith(2.75);
  });

  it('allows arbitrary high AU values like 12.5 and commits on Done click', () => {
    render(<AttentionUnitInput value={undefined} onChange={onChangeMock} auMinutes={15} />);

    // Click placeholder
    const placeholder = screen.getByText('AU');
    fireEvent.click(placeholder);

    const numInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: '12.5' } });

    // 12.5 * 15 = 187.5m -> 3h 8m
    expect(screen.getByText('3h 8m')).toBeDefined();

    // Click Done
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    expect(onChangeMock).toHaveBeenCalledWith(12.5);
  });

  it('clears estimate when empty input is submitted', () => {
    render(<AttentionUnitInput value={3} onChange={onChangeMock} auMinutes={15} />);

    fireEvent.click(screen.getByText('3 AU'));
    const numInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: '' } });

    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    expect(onChangeMock).toHaveBeenCalledWith(undefined);
  });
});
