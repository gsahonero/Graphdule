import React from 'react';
import { ProjectColor, ProjectIcon } from '../../domain/models/types';
import {
  Target,
  Rocket,
  Sparkles,
  GraduationCap,
  Briefcase,
  Code,
  Heart,
  Flame,
  BookOpen,
  Compass,
  Zap,
  Layers,
  Trophy,
  FlaskConical,
  ShieldCheck,
  LucideIcon,
} from 'lucide-react';

export interface ColorPreset {
  id: ProjectColor;
  label: string;
  dotClass: string;
  badgeBg: string;
  cardBorderHover: string;
  cardTopBar: string;
  text: string;
  progressBar: string;
  ring: string;
}

export interface IconPreset {
  id: ProjectIcon;
  label: string;
  icon: LucideIcon;
}

export const PROJECT_COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'emerald',
    label: 'Emerald',
    dotClass: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30',
    cardBorderHover: 'hover:border-emerald-400 dark:hover:border-emerald-500/60',
    cardTopBar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    progressBar: 'bg-gradient-to-r from-emerald-600 to-teal-400',
    ring: 'ring-emerald-500',
  },
  {
    id: 'teal',
    label: 'Teal',
    dotClass: 'bg-teal-500',
    badgeBg: 'bg-teal-500/10 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 border-teal-500/30',
    cardBorderHover: 'hover:border-teal-400 dark:hover:border-teal-500/60',
    cardTopBar: 'bg-teal-500',
    text: 'text-teal-600 dark:text-teal-400',
    progressBar: 'bg-gradient-to-r from-teal-600 to-cyan-400',
    ring: 'ring-teal-500',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    dotClass: 'bg-cyan-500',
    badgeBg: 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/30',
    cardBorderHover: 'hover:border-cyan-400 dark:hover:border-cyan-500/60',
    cardTopBar: 'bg-cyan-500',
    text: 'text-cyan-600 dark:text-cyan-400',
    progressBar: 'bg-gradient-to-r from-cyan-600 to-blue-400',
    ring: 'ring-cyan-500',
  },
  {
    id: 'blue',
    label: 'Blue',
    dotClass: 'bg-blue-500',
    badgeBg: 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/30',
    cardBorderHover: 'hover:border-blue-400 dark:hover:border-blue-500/60',
    cardTopBar: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    progressBar: 'bg-gradient-to-r from-blue-600 to-indigo-400',
    ring: 'ring-blue-500',
  },
  {
    id: 'indigo',
    label: 'Indigo',
    dotClass: 'bg-indigo-500',
    badgeBg: 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/30',
    cardBorderHover: 'hover:border-indigo-400 dark:hover:border-indigo-500/60',
    cardTopBar: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400',
    progressBar: 'bg-gradient-to-r from-indigo-600 to-purple-400',
    ring: 'ring-indigo-500',
  },
  {
    id: 'violet',
    label: 'Violet',
    dotClass: 'bg-violet-500',
    badgeBg: 'bg-violet-500/10 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border-violet-500/30',
    cardBorderHover: 'hover:border-violet-400 dark:hover:border-violet-500/60',
    cardTopBar: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-400',
    progressBar: 'bg-gradient-to-r from-violet-600 to-fuchsia-400',
    ring: 'ring-violet-500',
  },
  {
    id: 'purple',
    label: 'Purple',
    dotClass: 'bg-purple-500',
    badgeBg: 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/30',
    cardBorderHover: 'hover:border-purple-400 dark:hover:border-purple-500/60',
    cardTopBar: 'bg-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
    progressBar: 'bg-gradient-to-r from-purple-600 to-pink-400',
    ring: 'ring-purple-500',
  },
  {
    id: 'rose',
    label: 'Rose',
    dotClass: 'bg-rose-500',
    badgeBg: 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/30',
    cardBorderHover: 'hover:border-rose-400 dark:hover:border-rose-500/60',
    cardTopBar: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    progressBar: 'bg-gradient-to-r from-rose-600 to-amber-400',
    ring: 'ring-rose-500',
  },
  {
    id: 'amber',
    label: 'Amber',
    dotClass: 'bg-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30',
    cardBorderHover: 'hover:border-amber-400 dark:hover:border-amber-500/60',
    cardTopBar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    progressBar: 'bg-gradient-to-r from-amber-600 to-yellow-400',
    ring: 'ring-amber-500',
  },
  {
    id: 'orange',
    label: 'Orange',
    dotClass: 'bg-orange-500',
    badgeBg: 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border-orange-500/30',
    cardBorderHover: 'hover:border-orange-400 dark:hover:border-orange-500/60',
    cardTopBar: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    progressBar: 'bg-gradient-to-r from-orange-600 to-rose-400',
    ring: 'ring-orange-500',
  },
];

export const PROJECT_ICON_PRESETS: IconPreset[] = [
  { id: 'target', label: 'Goal', icon: Target },
  { id: 'rocket', label: 'Launch', icon: Rocket },
  { id: 'sparkles', label: 'AI / Magic', icon: Sparkles },
  { id: 'graduation-cap', label: 'Academic', icon: GraduationCap },
  { id: 'briefcase', label: 'Business', icon: Briefcase },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'heart', label: 'Health', icon: Heart },
  { id: 'flame', label: 'Priority', icon: Flame },
  { id: 'book-open', label: 'Reading', icon: BookOpen },
  { id: 'compass', label: 'Strategy', icon: Compass },
  { id: 'zap', label: 'Fast track', icon: Zap },
  { id: 'layers', label: 'System', icon: Layers },
  { id: 'trophy', label: 'Milestone', icon: Trophy },
  { id: 'flask-conical', label: 'Research', icon: FlaskConical },
  { id: 'shield-check', label: 'Security', icon: ShieldCheck },
];

const ICON_MAP = new Map<ProjectIcon, LucideIcon>(
  PROJECT_ICON_PRESETS.map((p) => [p.id, p.icon])
);

const COLOR_MAP = new Map<ProjectColor, ColorPreset>(
  PROJECT_COLOR_PRESETS.map((c) => [c.id, c])
);

export function getProjectColorTheme(color?: ProjectColor): ColorPreset {
  const selected = color && COLOR_MAP.get(color);
  return selected || PROJECT_COLOR_PRESETS[0]; // defaults to emerald
}

export function getProjectIconComponent(icon?: ProjectIcon): LucideIcon {
  const selected = icon && ICON_MAP.get(icon);
  return selected || Target;
}

export const ProjectIconDisplay: React.FC<{
  icon?: ProjectIcon;
  emoji?: string;
  className?: string;
}> = ({ icon, emoji, className = 'w-4 h-4' }) => {
  if (emoji && emoji.trim()) {
    return <span className="inline-flex items-center justify-center select-none text-sm">{emoji.trim()}</span>;
  }
  const IconComponent = getProjectIconComponent(icon);
  return <IconComponent className={className} />;
};
