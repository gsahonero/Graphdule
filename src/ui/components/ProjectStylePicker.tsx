import React from 'react';
import { ProjectColor, ProjectIcon, ProjectStyle } from '../../domain/models/types';
import {
  PROJECT_COLOR_PRESETS,
  PROJECT_ICON_PRESETS,
  getProjectColorTheme,
} from '../utils/project-style';
import { Check, Palette, Sparkles } from 'lucide-react';

interface ProjectStylePickerProps {
  value: ProjectStyle;
  onChange: (newStyle: ProjectStyle) => void;
  compact?: boolean;
}

export const ProjectStylePicker: React.FC<ProjectStylePickerProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const currentColor = value.color || 'emerald';
  const currentIcon = value.icon || 'target';
  const currentEmoji = value.emoji || '';

  const handleColorSelect = (color: ProjectColor) => {
    onChange({
      ...value,
      color,
    });
  };

  const handleIconSelect = (icon: ProjectIcon) => {
    onChange({
      ...value,
      icon,
      emoji: '', // reset emoji if icon chosen
    });
  };

  const handleEmojiChange = (emojiStr: string) => {
    onChange({
      ...value,
      emoji: emojiStr,
    });
  };

  const activeTheme = getProjectColorTheme(currentColor);

  return (
    <div className={`space-y-3 ${compact ? 'text-xs' : 'text-xs'}`}>
      {/* Color Accent Palette */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-slate-400" />
          <span>Color Theme</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {PROJECT_COLOR_PRESETS.map((colorPreset) => {
            const isSelected = currentColor === colorPreset.id;
            return (
              <button
                key={colorPreset.id}
                type="button"
                onClick={() => handleColorSelect(colorPreset.id)}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                  colorPreset.dotClass
                } ${
                  isSelected
                    ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110 shadow-sm'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                title={colorPreset.label}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Project Icon Grid */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <span>Project Icon</span>
          </label>
          <span className="text-[10px] text-slate-400">or type an emoji</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Icon presets button cloud */}
          <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
            {PROJECT_ICON_PRESETS.map((iconPreset) => {
              const IconComp = iconPreset.icon;
              const isSelected = !currentEmoji && currentIcon === iconPreset.id;
              return (
                <button
                  key={iconPreset.id}
                  type="button"
                  onClick={() => handleIconSelect(iconPreset.id)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? `${activeTheme.badgeBg} border-current shadow-xs font-bold`
                      : 'bg-slate-100 dark:bg-slate-800/80 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={iconPreset.label}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Optional emoji input */}
          <div className="shrink-0 flex flex-col items-center space-y-1">
            <input
              type="text"
              placeholder="🚀"
              maxLength={4}
              value={currentEmoji}
              onChange={(e) => handleEmojiChange(e.target.value)}
              className="w-9 h-8 text-center text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
              title="Custom Emoji"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
