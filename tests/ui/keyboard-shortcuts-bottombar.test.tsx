import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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

  it('renders minimal progress cue on BottomBar when active project is present, with rich hover detail', () => {
    const mockActiveDoc: any = {
      project: {
        id: 'proj_test',
        name: 'Launch Website',
        endGoalNodeId: 'node_2',
        style: { color: 'emerald', icon: 'rocket' },
      },
      nodes: [
        { id: 'node_1', text: 'Task 1', status: 'completed', dueDate: '2026-09-18' },
        { id: 'node_2', text: 'Task 2', status: 'planned', dueDate: '2026-09-19' },
      ],
      edges: [
        { id: 'edge_1', projectId: 'proj_test', fromNodeId: 'node_1', toNodeId: 'node_2' },
      ],
      activityLog: [],
    };

    const mockContext: any = {
      preferences: { theme: 'dark', dateFormat: 'DD/MM/YYYY' },
      toggleDateFormat: vi.fn(),
      setIsCapacityConfigModalOpen: vi.fn(),
      setIsHealthConfigModalOpen: vi.fn(),
      setIsAppearanceModalOpen: vi.fn(),
      setIsShortcutsModalOpen: vi.fn(),
      setIsOnboardingOpen: vi.fn(),
      exportAllData: vi.fn(),
      importProjectJson: vi.fn(),
      cloudSyncState: { provider: 'none', status: 'idle' },
      gcalendarSyncConfig: { enabled: false },
      activeProjectDoc: mockActiveDoc,
      activityLog: [],
    };

    render(
      <AppContext.Provider value={mockContext}>
        <BottomBar />
      </AppContext.Provider>
    );

    const progressIndicator = screen.getByTestId('bottombar-progress-indicator');
    expect(progressIndicator).toBeInTheDocument();
    expect(progressIndicator).toHaveTextContent('Progress');
    expect(progressIndicator).toHaveTextContent('50%');

    // Rich hover popover content
    expect(screen.getByText('Launch Website')).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
    expect(screen.getByText(/Flow State:/)).toBeInTheDocument();
  });

  it('verifies non-contradictory Enter key descriptions in KeyboardShortcutsModal', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={vi.fn()} />);

    // In canvas selection: Enter adds parallel sibling
    expect(screen.getByText('Graph Canvas (When a task is selected)')).toBeInTheDocument();
    expect(screen.getByText('Add parallel sibling task from same predecessor')).toBeInTheDocument();

    // While naming/editing a task: Enter saves inline text edit
    expect(screen.getByText('Confirm & save inline text edit')).toBeInTheDocument();
  });
});
