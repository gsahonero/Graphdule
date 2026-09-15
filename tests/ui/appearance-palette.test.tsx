import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPalette,
  applyPaletteToDOM,
} from '../../src/ui/utils/palettes';
import { ColorPaletteId } from '../../src/domain/models/types';
import { AppContext } from '../../src/ui/context/AppContext';
import { AppearanceModal } from '../../src/ui/components/AppearanceModal';
import { Header } from '../../src/ui/components/Header';

describe('Science-Backed Color Palettes Utility', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });

  it('contains 8 curated, science-backed palettes with complete cognitive metadata', () => {
    expect(PALETTES.length).toBe(8);

    const expectedPalettes = [
      'emerald',
      'ocean',
      'amber',
      'sage',
      'indigo',
      'rose',
      'teal',
      'minimal',
    ];

    expectedPalettes.forEach((id) => {
      const palette = PALETTES.find((p) => p.id === id);
      expect(palette).toBeDefined();
      expect(palette?.name).toBeTruthy();
      expect(palette?.scienceTitle).toBeTruthy();
      expect(palette?.scienceBasis).toBeTruthy();
      expect(palette?.primaryHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette?.rgbChannels[500]).toBeTruthy();
      expect(palette?.selectionLight.bg).toBeTruthy();
      expect(palette?.selectionDark.text).toBeTruthy();
    });
  });

  it('getPalette returns correct palette and falls back to emerald default', () => {
    const ocean = getPalette('ocean');
    expect(ocean.id).toBe('ocean');
    expect(ocean.name).toBe('Serenity Ocean');

    const fallback = getPalette(undefined);
    expect(fallback.id).toBe(DEFAULT_PALETTE_ID);
    expect(fallback.name).toBe('Biophilic Emerald');
  });

  it('applyPaletteToDOM updates data-palette, CSS root variables, and localStorage', () => {
    applyPaletteToDOM('amber');

    expect(document.documentElement.getAttribute('data-palette')).toBe('amber');
    expect(document.documentElement.style.getPropertyValue('--brand-500')).toBe('245 158 11');
    expect(document.documentElement.style.getPropertyValue('--brand-selection-light-bg')).toBe('#fde68a');
    expect(localStorage.getItem('graphdule_palette')).toBe('amber');
  });
});

describe('AppearanceModal & Context Integration', () => {
  let isModalOpen = true;
  let currentPalette: ColorPaletteId = 'emerald';
  let currentTheme: 'dark' | 'light' | 'system' = 'dark';
  const setIsAppearanceModalOpenMock = vi.fn((open: boolean) => {
    isModalOpen = open;
  });
  const setColorPaletteMock = vi.fn((palette: ColorPaletteId) => {
    currentPalette = palette;
    applyPaletteToDOM(palette);
  });
  const updatePreferencesMock = vi.fn((partial: any) => {
    if (partial.theme) {
      currentTheme = partial.theme;
      localStorage.setItem('graphdule_theme', partial.theme);
      if (partial.theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    }
  });

  const getContextValue = (): any => ({
    colorPalette: currentPalette,
    setColorPalette: setColorPaletteMock,
    isAppearanceModalOpen: isModalOpen,
    setIsAppearanceModalOpen: setIsAppearanceModalOpenMock,
    preferences: {
      theme: currentTheme,
      colorPalette: currentPalette,
    },
    updatePreferences: updatePreferencesMock,
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
    document.documentElement.className = '';
    isModalOpen = true;
    currentPalette = 'emerald';
    currentTheme = 'dark';
    vi.clearAllMocks();

    window.matchMedia =
      window.matchMedia ||
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
  });

  it('renders modal when open and displays all science-backed palettes', () => {
    render(
      <AppContext.Provider value={getContextValue()}>
        <AppearanceModal />
      </AppContext.Provider>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Appearance & Color Customization')).toBeInTheDocument();
    expect(screen.getAllByText('Biophilic Emerald').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Serenity Ocean')).toBeInTheDocument();
    expect(screen.getByText('Circadian Amber')).toBeInTheDocument();
    expect(screen.getByText('Sage Tranquility')).toBeInTheDocument();
    expect(screen.getByText('Twilight Indigo')).toBeInTheDocument();
    expect(screen.getByText('Sunset Vitality')).toBeInTheDocument();
    expect(screen.getByText('Glacier Mint')).toBeInTheDocument();
    expect(screen.getByText('Nordic Minimal')).toBeInTheDocument();
  });

  it('switches color palette and updates DOM and calls setColorPalette', () => {
    render(
      <AppContext.Provider value={getContextValue()}>
        <AppearanceModal />
      </AppContext.Provider>
    );

    const oceanCard = screen.getByText('Serenity Ocean').closest('button');
    expect(oceanCard).toBeDefined();
    fireEvent.click(oceanCard!);

    expect(setColorPaletteMock).toHaveBeenCalledWith('ocean');
    expect(document.documentElement.getAttribute('data-palette')).toBe('ocean');
  });

  it('allows resetting palette to Biophilic Emerald default', () => {
    currentPalette = 'ocean';
    render(
      <AppContext.Provider value={getContextValue()}>
        <AppearanceModal />
      </AppContext.Provider>
    );

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    expect(setColorPaletteMock).toHaveBeenCalledWith('emerald');
  });

  it('supports theme mode selection (Light/Dark/System)', () => {
    render(
      <AppContext.Provider value={getContextValue()}>
        <AppearanceModal />
      </AppContext.Provider>
    );

    const lightBtn = screen.getByRole('button', { name: /^Light$/i });
    fireEvent.click(lightBtn);

    expect(updatePreferencesMock).toHaveBeenCalledWith({ theme: 'light' });
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('closes modal when Done button is clicked', () => {
    render(
      <AppContext.Provider value={getContextValue()}>
        <AppearanceModal />
      </AppContext.Provider>
    );

    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);

    expect(setIsAppearanceModalOpenMock).toHaveBeenCalledWith(false);
  });
});

describe('Header Appearance Controls', () => {
  beforeEach(() => {
    window.matchMedia =
      window.matchMedia ||
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
  });

  it('opens AppearanceModal when desktop Palette button is clicked', () => {
    const setIsAppearanceModalOpenMock = vi.fn();
    const mockContext: any = {
      currentView: 'projects',
      setCurrentView: vi.fn(),
      activeProjectDoc: null,
      preferences: { theme: 'dark', dateFormat: 'DD/MM/YYYY' },
      updatePreferences: vi.fn(),
      toggleDateFormat: vi.fn(),
      setIsOnboardingOpen: vi.fn(),
      exportAllData: vi.fn(),
      importProjectJson: vi.fn(),
      activeWorkSession: null,
      setIsSyncModalOpen: vi.fn(),
      cloudSyncState: { provider: 'none' },
      gcalendarSyncConfig: { enabled: false },
      setIsCapacityConfigModalOpen: vi.fn(),
      setIsHealthConfigModalOpen: vi.fn(),
      healthConfig: { enabled: false },
      colorPalette: 'emerald',
      setIsAppearanceModalOpen: setIsAppearanceModalOpenMock,
    };

    render(
      <AppContext.Provider value={mockContext}>
        <Header />
      </AppContext.Provider>
    );

    const appearanceBtn = screen.getByTestId('header-appearance-button');
    expect(appearanceBtn).toBeInTheDocument();

    fireEvent.click(appearanceBtn);

    expect(setIsAppearanceModalOpenMock).toHaveBeenCalledWith(true);
  });
});
