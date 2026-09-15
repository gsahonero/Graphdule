import { ColorPaletteId } from '../../domain/models/types';

export interface PaletteDefinition {
  readonly id: ColorPaletteId;
  readonly name: string;
  readonly scienceTitle: string;
  readonly scienceBasis: string;
  readonly primaryHex: string;
  readonly previewDotClass: string;
  readonly previewGradient: string;
  readonly rgbChannels: {
    readonly 50: string;
    readonly 100: string;
    readonly 200: string;
    readonly 300: string;
    readonly 400: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
    readonly 800: string;
    readonly 900: string;
    readonly 950: string;
  };
  readonly selectionLight: {
    readonly bg: string;
    readonly text: string;
  };
  readonly selectionDark: {
    readonly bg: string;
    readonly text: string;
  };
  readonly edgeGlow: string;
}

export const PALETTES: readonly PaletteDefinition[] = [
  {
    id: 'emerald',
    name: 'Biophilic Emerald',
    scienceTitle: 'Attention Restoration & Eye Comfort',
    scienceBasis:
      'Grounded in Attention Restoration Theory (Kaplan). Natural green wavelengths (~520-540nm) reduce ocular fatigue, lower autonomic stress, and sustain executive attention during deep work.',
    primaryHex: '#10b981',
    previewDotClass: 'bg-emerald-500',
    previewGradient: 'from-emerald-500 to-teal-400',
    rgbChannels: {
      50: '240 253 244',
      100: '220 252 231',
      200: '187 247 208',
      300: '134 239 172',
      400: '74 222 128',
      500: '16 185 129',
      600: '5 150 105',
      700: '4 120 87',
      800: '6 95 70',
      900: '6 78 59',
      950: '2 44 34',
    },
    selectionLight: {
      bg: '#a7f3d0',
      text: '#064e3b',
    },
    selectionDark: {
      bg: '#065f46',
      text: '#f0fdf4',
    },
    edgeGlow: 'rgba(16, 185, 129, 0.8)',
  },
  {
    id: 'ocean',
    name: 'Serenity Ocean',
    scienceTitle: 'Cognitive Calm & Deep Analysis',
    scienceBasis:
      'Supported by research on chromatic ergonomics (Mehta & Zhu, Science 2009). Blue wavelengths promote parasympathetic calmness, decrease heart rate, and enhance analytical accuracy and problem-solving flow.',
    primaryHex: '#0284c7',
    previewDotClass: 'bg-sky-600',
    previewGradient: 'from-sky-500 to-blue-600',
    rgbChannels: {
      50: '240 249 255',
      100: '224 242 254',
      200: '186 230 253',
      300: '125 211 252',
      400: '56 189 248',
      500: '2 132 199',
      600: '3 105 161',
      700: '3 84 130',
      800: '7 70 108',
      900: '12 59 90',
      950: '8 38 60',
    },
    selectionLight: {
      bg: '#bae6fd',
      text: '#0c4a6e',
    },
    selectionDark: {
      bg: '#075985',
      text: '#f0f9ff',
    },
    edgeGlow: 'rgba(2, 132, 199, 0.8)',
  },
  {
    id: 'amber',
    name: 'Circadian Amber',
    scienceTitle: 'Low Blue-Light Strain & Daylight Warmth',
    scienceBasis:
      'Aligns with circadian neurobiology (ipRGC sensitivity). Warm amber (~585-595nm) minimizes short-wavelength retinal stress, ideal for evening sessions, long reading sprints, and reduced headache susceptibility.',
    primaryHex: '#f59e0b',
    previewDotClass: 'bg-amber-500',
    previewGradient: 'from-amber-500 to-orange-400',
    rgbChannels: {
      50: '255 251 235',
      100: '254 243 199',
      200: '253 230 138',
      300: '252 211 77',
      400: '251 191 36',
      500: '245 158 11',
      600: '217 119 6',
      700: '180 83 9',
      800: '146 64 14',
      900: '120 53 15',
      950: '69 26 3',
    },
    selectionLight: {
      bg: '#fde68a',
      text: '#78350f',
    },
    selectionDark: {
      bg: '#92400e',
      text: '#fffbeb',
    },
    edgeGlow: 'rgba(245, 158, 11, 0.8)',
  },
  {
    id: 'sage',
    name: 'Sage Tranquility',
    scienceTitle: 'Low-Arousal Harmony & Balanced Mood',
    scienceBasis:
      'Grounded in environmental psychology. Muted sage/olive tones prevent visual hyperarousal, reducing anxiety and sensory overload in complex project dependency graphs.',
    primaryHex: '#84cc16',
    previewDotClass: 'bg-lime-600',
    previewGradient: 'from-lime-600 to-emerald-500',
    rgbChannels: {
      50: '247 254 231',
      100: '236 252 203',
      200: '217 249 157',
      300: '190 242 100',
      400: '163 230 53',
      500: '132 204 22',
      600: '101 163 13',
      700: '77 124 15',
      800: '63 98 18',
      900: '54 83 20',
      950: '26 46 5',
    },
    selectionLight: {
      bg: '#d9f99d',
      text: '#365314',
    },
    selectionDark: {
      bg: '#3f6212',
      text: '#f7fee7',
    },
    edgeGlow: 'rgba(132, 204, 22, 0.8)',
  },
  {
    id: 'indigo',
    name: 'Twilight Indigo',
    scienceTitle: 'Focus Clarity & Information Processing',
    scienceBasis:
      'Proven high-legibility spectrum for typographic hierarchy. Deep violet-indigo balances luminance contrast across both OLED dark mode and daylight light mode for sustained readability.',
    primaryHex: '#6366f1',
    previewDotClass: 'bg-indigo-500',
    previewGradient: 'from-indigo-500 to-violet-500',
    rgbChannels: {
      50: '238 242 255',
      100: '224 231 255',
      200: '199 210 254',
      300: '165 180 252',
      400: '129 140 248',
      500: '99 102 241',
      600: '79 70 229',
      700: '67 56 202',
      800: '55 48 163',
      900: '49 46 129',
      950: '30 27 75',
    },
    selectionLight: {
      bg: '#c7d2fe',
      text: '#312e81',
    },
    selectionDark: {
      bg: '#3730a3',
      text: '#eef2ff',
    },
    edgeGlow: 'rgba(99, 102, 241, 0.8)',
  },
  {
    id: 'rose',
    name: 'Sunset Vitality',
    scienceTitle: 'Positive Affect & Cognitive Momentum',
    scienceBasis:
      'Rose and warm coral tones elevate dopamine response and subjective motivation, reducing friction when organizing challenging backlog tasks and scheduling demanding milestones.',
    primaryHex: '#f43f5e',
    previewDotClass: 'bg-rose-500',
    previewGradient: 'from-rose-500 to-pink-500',
    rgbChannels: {
      50: '255 241 242',
      100: '255 228 230',
      200: '254 205 211',
      300: '253 164 175',
      400: '251 113 133',
      500: '244 63 94',
      600: '225 29 72',
      700: '190 18 60',
      800: '159 18 57',
      900: '136 19 55',
      950: '76 5 25',
    },
    selectionLight: {
      bg: '#fecdd3',
      text: '#881337',
    },
    selectionDark: {
      bg: '#9f1239',
      text: '#fff1f2',
    },
    edgeGlow: 'rgba(244, 63, 94, 0.8)',
  },
  {
    id: 'teal',
    name: 'Glacier Mint',
    scienceTitle: 'Alertness & Mental Refreshment',
    scienceBasis:
      'Intermediate blue-green spectra (~495nm) boost subjective alertness without increasing psychological friction, providing a revitalizing visual atmosphere.',
    primaryHex: '#0d9488',
    previewDotClass: 'bg-teal-600',
    previewGradient: 'from-teal-500 to-cyan-400',
    rgbChannels: {
      50: '240 253 250',
      100: '204 251 241',
      200: '153 246 228',
      300: '94 234 212',
      400: '45 212 191',
      500: '13 148 136',
      600: '15 118 110',
      700: '17 94 89',
      800: '19 78 74',
      900: '19 64 61',
      950: '4 47 46',
    },
    selectionLight: {
      bg: '#99f6e4',
      text: '#134e4a',
    },
    selectionDark: {
      bg: '#115e59',
      text: '#f0fdfa',
    },
    edgeGlow: 'rgba(13, 148, 136, 0.8)',
  },
  {
    id: 'minimal',
    name: 'Nordic Minimal',
    scienceTitle: 'Low Cognitive Load & Neuro-Inclusive',
    scienceBasis:
      'Specifically tailored for ADHD, sensory sensitivity, and distraction minimization. Neutral achromatic slate tones remove chromatic clutter so the structural content and timeline take center stage.',
    primaryHex: '#64748b',
    previewDotClass: 'bg-slate-500',
    previewGradient: 'from-slate-500 to-zinc-600',
    rgbChannels: {
      50: '248 250 252',
      100: '241 245 249',
      200: '226 232 240',
      300: '203 213 225',
      400: '148 163 184',
      500: '100 116 139',
      600: '71 85 105',
      700: '51 65 85',
      800: '30 41 59',
      900: '15 23 42',
      950: '2 6 23',
    },
    selectionLight: {
      bg: '#cbd5e1',
      text: '#0f172a',
    },
    selectionDark: {
      bg: '#334155',
      text: '#f8fafc',
    },
    edgeGlow: 'rgba(100, 116, 139, 0.8)',
  },
];

export const PALETTE_MAP = new Map<ColorPaletteId, PaletteDefinition>(
  PALETTES.map((p) => [p.id, p])
);

export const DEFAULT_PALETTE_ID: ColorPaletteId = 'emerald';

export function getPalette(id?: ColorPaletteId): PaletteDefinition {
  if (!id) return PALETTES[0];
  return PALETTE_MAP.get(id) || PALETTES[0];
}

/**
 * Applies the given palette to the DOM:
 * 1. Sets data-palette attribute on document.documentElement
 * 2. Writes RGB variables directly to style so Tailwind's brand utility colors adapt instantly
 * 3. Persists to localStorage for fast initial boot before bundle hydration
 */
export function applyPaletteToDOM(paletteId: ColorPaletteId): void {
  if (typeof document === 'undefined') return;

  const palette = getPalette(paletteId);
  const root = document.documentElement;

  root.setAttribute('data-palette', palette.id);

  // Set CSS variables for RGB channels
  Object.entries(palette.rgbChannels).forEach(([shade, rgb]) => {
    root.style.setProperty(`--brand-${shade}`, rgb);
  });

  // Set selection and glow variables
  root.style.setProperty('--brand-selection-light-bg', palette.selectionLight.bg);
  root.style.setProperty('--brand-selection-light-text', palette.selectionLight.text);
  root.style.setProperty('--brand-selection-dark-bg', palette.selectionDark.bg);
  root.style.setProperty('--brand-selection-dark-text', palette.selectionDark.text);
  root.style.setProperty('--brand-glow', palette.edgeGlow);

  try {
    localStorage.setItem('graphdule_palette', palette.id);
  } catch {
    // ignore quota/storage errors
  }
}
