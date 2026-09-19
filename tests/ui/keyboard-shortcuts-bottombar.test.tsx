import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { KeyboardShortcutsModal } from '../../src/ui/components/KeyboardShortcutsModal';
import { BottomBar } from '../../src/ui/components/BottomBar';
import { AppContext } from '../../src/ui/context/AppContext';

describe('Keyboard Shortcuts Modal & BottomBar', () => {
  it('renders KeyboardShortcutsModal when isOpen is true with shortcuts categories', () => {
    const onCloseMock = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onCloseMock} />);

    expect(screen.getByText('Keyboard Shortcuts & Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Inline Quick Tokens (Type while naming a task)')).toBeInTheDocument();
    expect(screen.getByText('!spike')).toBeInTheDocument();
    expect(screen.getByText('!high')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close shortcuts modal');
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('renders BottomBar with shortcuts button, capacity, health, palette, and sync indicator', () => {
    const setIsShortcutsModalOpenMock = vi.fn();
    const setIsCapacityConfigModalOpenMock = vi.fn();
    const setIsHealthConfigModalOpenMock = vi.fn();
    const setIsAppearanceModalOpenMock = vi.fn();

    const mockContext: any = {
      preferences: { theme: 'dark', dateFormat: 'DD/MM/YYYY' },
      toggleDateFormat: vi.fn(),
      setIsCapacityConfigModalOpen: setIsCapacityConfigModalOpenMock,
      setIsHealthConfigModalOpen: setIsHealthConfigModalOpenMock,
      setIsAppearanceModalOpen: setIsAppearanceModalOpenMock,
      setIsShortcutsModalOpen: setIsShortcutsModalOpenMock,
      setIsOnboardingOpen: vi.fn(),
      exportAllData: vi.fn(),
      importProjectJson: vi.fn(),
      cloudSyncState: { provider: 'none', status: 'idle' },
      gcalendarSyncConfig: { enabled: false },
    };

    render(
      <AppContext.Provider value={mockContext}>
        <BottomBar />
      </AppContext.Provider>
    );

    const shortcutsBtn = screen.getByTitle('Keyboard Shortcuts Cheat Sheet (Press ? anytime)');
    expect(shortcutsBtn).toBeInTheDocument();
    fireEvent.click(shortcutsBtn);
    expect(setIsShortcutsModalOpenMock).toHaveBeenCalledWith(true);

    const capacityBtn = screen.getByTitle('Daily AU Capacity & Reality Check Settings');
    expect(capacityBtn).toBeInTheDocument();
    fireEvent.click(capacityBtn);
    expect(setIsCapacityConfigModalOpenMock).toHaveBeenCalledWith(true);

    const healthBtn = screen.getByTitle('Health & Focus Settings (Breaks, posture, ergonomics)');
    expect(healthBtn).toBeInTheDocument();
    fireEvent.click(healthBtn);
    expect(setIsHealthConfigModalOpenMock).toHaveBeenCalledWith(true);

    const paletteBtn = screen.getByTestId('bottombar-appearance-button');
    expect(paletteBtn).toBeInTheDocument();
    fireEvent.click(paletteBtn);
    expect(setIsAppearanceModalOpenMock).toHaveBeenCalledWith(true);
  });
});
