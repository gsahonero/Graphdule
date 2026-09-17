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

  it('notifies onOpenChange when opening and closing popover with correct alignment', () => {
    const onOpenChangeMock = vi.fn();
    render(
      <AttentionUnitInput
        value={1}
        onChange={onChangeMock}
        auMinutes={15}
        align="right"
        onOpenChange={onOpenChangeMock}
      />
    );

    // Open
    fireEvent.click(screen.getByText('1 AU'));
    expect(onOpenChangeMock).toHaveBeenCalledWith(true);

    // Verify right alignment class
    const popover = screen.getByText('Attention Estimate').closest('.absolute');
    expect(popover?.className).toContain('right-0');

    // Close
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it('rounds floating-point values to 2 decimal places for display and commit', () => {
    // Value with float leakage (e.g. 1.3333333333333333) should display as 1.33 AU
    render(<AttentionUnitInput value={1.3333333333333333} onChange={onChangeMock} auMinutes={15} />);
    expect(screen.getByText('1.33 AU')).toBeDefined();

    // Opening and submitting 2.55555 should commit 2.56
    fireEvent.click(screen.getByText('1.33 AU'));
    const numInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    fireEvent.change(numInput, { target: { value: '2.55555' } });
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);
    expect(onChangeMock).toHaveBeenCalledWith(2.56);
  });

  it('stops double click propagation so parent card double click is never triggered', () => {
    const onCardDoubleClick = vi.fn();

    render(
      <div onDoubleClick={onCardDoubleClick}>
        <AttentionUnitInput value={1} onChange={onChangeMock} auMinutes={15} />
      </div>
    );

    // Find the increase AU button (+0.5 AU)
    const increaseBtn = screen.getByTitle('Increase by 0.5 AU');
    expect(increaseBtn).toBeDefined();

    // Double click the increase button
    fireEvent.doubleClick(increaseBtn);

    // Parent card onDoubleClick should NOT have been called
    expect(onCardDoubleClick).not.toHaveBeenCalled();

    // Double click the trigger badge
    const badge = screen.getByText('1 AU');
    fireEvent.doubleClick(badge);
    expect(onCardDoubleClick).not.toHaveBeenCalled();
  });

  it('maintains constant width across undefined, small, and large AU values', () => {
    // Render compact with undefined value
    const { rerender } = render(
      <AttentionUnitInput value={undefined} onChange={onChangeMock} compact={true} />
    );
    const triggerUndefined = screen.getByText('AU').closest('.group');
    expect(triggerUndefined?.className).toContain('w-[136px]');

    // Rerender with 0.5 AU
    rerender(<AttentionUnitInput value={0.5} onChange={onChangeMock} compact={true} />);
    const triggerSmall = screen.getByText('0.5 AU').closest('.group');
    expect(triggerSmall?.className).toContain('w-[136px]');

    // Rerender with 12.5 AU
    rerender(<AttentionUnitInput value={12.5} onChange={onChangeMock} compact={true} />);
    const triggerLarge = screen.getByText('12.5 AU').closest('.group');
    expect(triggerLarge?.className).toContain('w-[136px]');

    // Standard mode with undefined and defined values
    rerender(<AttentionUnitInput value={undefined} onChange={onChangeMock} compact={false} />);
    const triggerStandardUndefined = screen.getByText('AU').closest('.group');
    expect(triggerStandardUndefined?.className).toContain('w-[144px]');

    rerender(<AttentionUnitInput value={3} onChange={onChangeMock} compact={false} />);
    const triggerStandardDefined = screen.getByText('3 AU').closest('.group');
    expect(triggerStandardDefined?.className).toContain('w-[144px]');
  });

  it('maintains constant width for parent-derived display', () => {
    const { rerender } = render(
      <AttentionUnitInput value={5} onChange={onChangeMock} isParentDerived={true} compact={true} />
    );
    const derivedCompact = screen.getByText('5 AU').closest('div');
    expect(derivedCompact?.className).toContain('w-[136px]');

    rerender(
      <AttentionUnitInput value={5} onChange={onChangeMock} isParentDerived={true} compact={false} />
    );
    const derivedStandard = screen.getByText('5 AU').closest('div');
    expect(derivedStandard?.className).toContain('w-[144px]');
  });
});
