import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CalendarPicker } from '../../components/CalendarPicker';
import {
  FolderPlus,
  Calendar,
  Target,
  CheckCircle2,
  Trash2,
  Sparkles,
  Tag,
  Plus,
  X,
  Filter,
  Archive,
  FolderKanban,
  Check,
  Ban,
  ArchiveRestore,
  Palette,
} from 'lucide-react';
import { getTodayString, addDays } from '../../../domain/utils/date';
import { createDefaultSampleProject } from '../../../config/sample-project';
import { ProjectStyle } from '../../../domain/models/types';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';
import { ProjectStylePicker } from '../../components/ProjectStylePicker';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    openProject,
    createProject,
    updateProjectStyle,
    archiveProject,
    unarchiveProject,
    deleteProject,
    importProjectJson,
    allAvailableTags,
    formatDateDisplay,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'completed' | 'abandoned' | 'manual'>('all');
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [editingStyleProjectId, setEditingStyleProjectId] = useState<string | null>(null);

  // Active vs Archived split
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.isArchived), [projects]);

  // Current scope of projects based on activeTab
  const currentScopedProjects = useMemo(() => {
    if (activeTab === 'active') return activeProjects;

    if (archiveFilter === 'completed') {
      return archivedProjects.filter((p) => p.status === 'completed');
    }
    if (archiveFilter === 'abandoned') {
      return archivedProjects.filter((p) => p.status === 'abandoned');
    }
    if (archiveFilter === 'manual') {
      return archivedProjects.filter((p) => p.status === 'archived');
    }
    return archivedProjects;
  }, [activeTab, activeProjects, archivedProjects, archiveFilter]);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [endGoalText, setEndGoalText] = useState('');
  const [deadline, setDeadline] = useState(addDays(getTodayString(), 30));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [projectStyle, setProjectStyle] = useState<ProjectStyle>({ color: 'emerald', icon: 'target' });

  // Tag stats across scoped projects
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    currentScopedProjects.forEach((p) => {
      p.tags?.forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) {
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        }
      });
    });
    return counts;
  }, [currentScopedProjects]);

  const uniqueTagsList = useMemo(() => {
    return Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));
  }, [tagCounts]);

  // Filtered projects by tag
  const filteredProjects = useMemo(() => {
    if (!selectedTagFilter) return currentScopedProjects;
    return currentScopedProjects.filter((p) =>
      p.tags?.some((t) => t.toLowerCase() === selectedTagFilter.toLowerCase())
    );
  }, [currentScopedProjects, selectedTagFilter]);

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, '');
    if (trimmed && !projectTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setProjectTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProjectTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === 'Backspace' && !tagInput && projectTags.length > 0) {
      setProjectTags((prev) => prev.slice(0, prev.length - 1));
    }
  };

  const handleResetForm = () => {
    setProjectName('');
    setEndGoalText('');
    setDeadline(addDays(getTodayString(), 30));
    setProjectTags([]);
    setTagInput('');
    setProjectStyle({ color: 'emerald', icon: 'target' });
    setIsCreatingInline(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    // If user left unsubmitted text in tag input, include it
    let finalTags = [...projectTags];
    if (tagInput.trim() && !finalTags.includes(tagInput.trim())) {
      finalTags.push(tagInput.trim());
    }

    await createProject(
      projectName.trim(),
      endGoalText.trim() || projectName.trim(),
      deadline,
      finalTags,
      projectStyle
    );

    handleResetForm();
  };

  const handleImportSample = async () => {
    const sampleDoc = createDefaultSampleProject();
    await importProjectJson(JSON.stringify(sampleDoc));
  };

  // Reusable tags that are not yet selected in the current creation form
  const availableUnselectedTags = useMemo(() => {
    const activeLower = new Set(projectTags.map((t) => t.toLowerCase()));
    return allAvailableTags.filter((t) => !activeLower.has(t.toLowerCase()));
  }, [allAvailableTags, projectTags]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 max-w-6xl mx-auto w-full space-y-7">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Projects Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Projects are graphs of evolving understanding leading toward a single terminal Goal.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {projects.length === 0 && (
            <button
              onClick={handleImportSample}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Load Sample Project</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsCreatingInline((prev) => !prev);
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer ${
              isCreatingInline
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20 dark:shadow-emerald-950/40'
            }`}
          >
            {isCreatingInline ? (
              <>
                <X className="w-4 h-4" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4" />
                <span>New Project</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Active vs Archived) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3">
        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              setActiveTab('active');
              setSelectedTagFilter(null);
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Active Projects</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'active'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {activeProjects.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('archive');
              setSelectedTagFilter(null);
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'archive'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Archive</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'archive'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {archivedProjects.length}
            </span>
          </button>
        </div>

        {/* Sub-filters for Archived view */}
        {activeTab === 'archive' && (
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setArchiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                archiveFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All ({archivedProjects.length})
            </button>
            <button
              onClick={() => setArchiveFilter('completed')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                archiveFilter === 'completed'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Completed ({archivedProjects.filter((p) => p.status === 'completed').length})</span>
            </button>
            <button
              onClick={() => setArchiveFilter('abandoned')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                archiveFilter === 'abandoned'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Ban className="w-3 h-3 text-rose-500" />
              <span>Abandoned ({archivedProjects.filter((p) => p.status === 'abandoned').length})</span>
            </button>
            <button
              onClick={() => setArchiveFilter('manual')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                archiveFilter === 'manual'
                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Archive className="w-3 h-3 text-indigo-500" />
              <span>Manual ({archivedProjects.filter((p) => p.status === 'archived').length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Streamlined Inline Project Creation Card (No intrusive modals) */}
      {isCreatingInline && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 dark:border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Create New Project</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Define your project, target goal, deadline, and optional tags.</p>
              </div>
            </div>
            <button
              onClick={handleResetForm}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Project Name */}
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Project Name</span>
                  <span className="text-emerald-600 dark:text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master's Thesis, Product Launch"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  autoFocus
                />
              </div>

              {/* Goal Text */}
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Terminal Goal Text
                </label>
                <input
                  type="text"
                  placeholder="Defaults to project name"
                  value={endGoalText}
                  onChange={(e) => setEndGoalText(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Deadline */}
              <div className="space-y-1.5 md:col-span-1 relative">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Target Deadline</span>
                  <span className="text-emerald-600 dark:text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCalendarOpen((prev) => !prev);
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer flex items-center justify-between group/cal"
                    title="Click to select target deadline"
                  >
                    <span>{formatDateDisplay(deadline)}</span>
                    <Calendar className="w-4 h-4 text-slate-400 group-hover/cal:text-emerald-500 transition-colors shrink-0" />
                  </button>

                  {isCalendarOpen && (
                    <CalendarPicker
                      value={deadline}
                      onChange={(newDate) => setDeadline(newDate)}
                      onClose={() => setIsCalendarOpen(false)}
                      position="bottom"
                      align="right"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Optional Reusable Tags Section */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Project Tags (Optional & Reusable)</span>
              </label>

              {/* Tag Input Box with Badges */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 min-h-[42px] transition-all">
                {projectTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-500/30 animate-in fade-in zoom-in-90 duration-100"
                  >
                    <span>#{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-rose-500 dark:hover:text-rose-400 p-0.5 rounded cursor-pointer"
                      title={`Remove tag ${t}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  placeholder={projectTags.length === 0 ? "Type tag name and press Enter (e.g. Research, Urgent, Q3)..." : "Add more tags..."}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="flex-1 min-w-[160px] bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none p-1"
                />

                {tagInput.trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {/* Reusable Tags Pill Cloud (Click to attach instantly) */}
              {availableUnselectedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500 font-medium mr-1">Existing tags:</span>
                  {availableUnselectedTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleAddTag(t)}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-500/40 border border-slate-300/80 dark:border-slate-700 transition-all cursor-pointer"
                      title={`Click to add #${t}`}
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Customizable Project Style (Color & Icon) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <ProjectStylePicker value={projectStyle} onChange={setProjectStyle} />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 dark:shadow-emerald-950/40 transition-all cursor-pointer"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reusable Tag Filtering Toolbar */}
      {uniqueTagsList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 font-semibold mr-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>

            {/* All Projects Button */}
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedTagFilter === null
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All {activeTab === 'active' ? 'Active' : 'Archived'} ({currentScopedProjects.length})
            </button>

            {/* Distinct Tag Filter Chips */}
            {uniqueTagsList.map((tag) => {
              const count = tagCounts[tag] || 0;
              const isSelected = selectedTagFilter?.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTagFilter(isSelected ? null : tag)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Tag className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>#{tag}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTagFilter && (
            <button
              onClick={() => setSelectedTagFilter(null)}
              className="flex items-center space-x-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          )}
        </div>
      )}

      {/* Project Grid / Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto my-12 bg-white/60 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            {activeTab === 'archive' ? (
              <Archive className="w-6 h-6" />
            ) : selectedTagFilter ? (
              <Tag className="w-6 h-6" />
            ) : (
              <Target className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {activeTab === 'archive'
                ? 'No Archived Projects'
                : selectedTagFilter
                ? `No projects tagged with "#${selectedTagFilter}"`
                : 'No Active Projects Yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTab === 'archive'
                ? 'Finished (100% completed), abandoned, or manually archived projects will be kept here.'
                : selectedTagFilter
                ? 'Try selecting another tag or clear the filter to view all projects.'
                : 'Create a project by defining its long-term objective (Goal) and decomposing work toward it.'}
            </p>
          </div>
          <div className="flex justify-center space-x-3 pt-2">
            {activeTab === 'archive' ? (
              <button
                onClick={() => setActiveTab('active')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                View Active Projects
              </button>
            ) : selectedTagFilter ? (
              <button
                onClick={() => setSelectedTagFilter(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                Show All Active Projects
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsCreatingInline(true)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  Create First Project
                </button>
                <button
                  onClick={handleImportSample}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
                >
                  Load Sample
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const theme = getProjectColorTheme(project.style?.color);
            return (
              <div
                key={project.id}
                onClick={() => openProject(project.id)}
                className={`bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 ${theme.cardBorderHover} rounded-xl shadow-sm dark:shadow-lg dark:shadow-slate-950/40 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden relative`}
              >
                {/* Top Colored Accent Bar */}
                <div className={`h-1.5 w-full ${theme.cardTopBar}`} />

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Top info */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                            {project.name}
                          </h3>
                          {project.isArchived && (
                            <>
                              {project.status === 'completed' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-500/30 flex items-center space-x-1 shrink-0">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Completed</span>
                                </span>
                              )}
                              {project.status === 'abandoned' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-500/30 flex items-center space-x-1 shrink-0">
                                  <Ban className="w-2.5 h-2.5" />
                                  <span>Abandoned</span>
                                </span>
                              )}
                              {project.status === 'archived' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center space-x-1 shrink-0">
                                  <Archive className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>Archived</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions (Style Edit, Archive, Restore, Delete) */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Edit Style Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStyleProjectId((prev) => (prev === project.id ? null : project.id));
                          }}
                          className={`p-1 transition-all cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            editingStyleProjectId === project.id
                              ? 'opacity-100 text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-800'
                              : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                          }`}
                          title="Customize Project Color & Icon"
                        >
                          <Palette className="w-4 h-4" />
                        </button>

                        {project.isArchived ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              unarchiveProject(project.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Restore to Active Projects"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveProject(project.id, 'archived');
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Archive Project"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete project "${project.name}" and all its history?`)) {
                              deleteProject(project.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Floating Style Editor Popover on Card */}
                    {editingStyleProjectId === project.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                            <Palette className="w-3.5 h-3.5 text-slate-400" />
                            <span>Card Style: {project.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStyleProjectId(null);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <ProjectStylePicker
                          value={project.style || { color: 'emerald', icon: 'target' }}
                          onChange={(newStyle) => {
                            updateProjectStyle(newStyle, project.id);
                          }}
                        />
                      </div>
                    )}

                    {/* Goal target with customized icon & color */}
                    <div className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingStyleProjectId((prev) => (prev === project.id ? null : project.id));
                        }}
                        className={`p-1.5 rounded-lg ${theme.badgeBg} shrink-0 hover:opacity-80 transition-opacity cursor-pointer`}
                        title="Click to customize project style & icon"
                      >
                        <ProjectIconDisplay icon={project.style?.icon} emoji={project.style?.emoji} className="w-3.5 h-3.5" />
                      </button>
                      <div className="truncate">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-medium">
                          Goal
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{project.endGoalText}</span>
                      </div>
                    </div>

                    {/* Optional Tags on Card */}
                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {project.tags.map((t) => (
                          <span
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTagFilter(t);
                            }}
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                              selectedTagFilter?.toLowerCase() === t.toLowerCase()
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-semibold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-emerald-400 dark:hover:border-emerald-500'
                            }`}
                            title={`Filter by #${t}`}
                          >
                            <Tag className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Progress and Stats */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500 dark:text-slate-400">Progress</span>
                        <span className={`font-mono font-semibold ${theme.text}`}>{project.progressPercentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div
                          className={`h-full ${theme.progressBar} rounded-full transition-all duration-500`}
                          style={{ width: `${project.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Metadata badges */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>Due <span className="font-mono text-slate-700 dark:text-slate-300">{formatDateDisplay(project.deadline)}</span></span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{project.activeTaskCount} active tasks</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
