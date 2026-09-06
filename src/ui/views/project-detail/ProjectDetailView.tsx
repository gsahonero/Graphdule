import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { GraphView } from '../graph/GraphView';
import { TimelineView } from '../timeline/TimelineView';
import { HistoryView } from '../history/HistoryView';
import { ProjectService } from '../../../domain/services/project-service';
import {
  Workflow,
  Calendar,
  History,
  Download,
  ArrowLeft,
  Edit2,
  Check,
  X,
  Tag,
  Plus,
  Archive,
  ArchiveRestore,
  AlertCircle,
  Palette,
  Undo2,
  Redo2,
} from 'lucide-react';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';
import { ProjectStylePicker } from '../../components/ProjectStylePicker';

export const ProjectDetailView: React.FC = () => {
  const {
    activeProjectDoc,
    activeProjectTab,
    setActiveProjectTab,
    setCurrentView,
    updateProjectName,
    updateProjectTags,
    updateProjectStyle,
    archiveProject,
    unarchiveProject,
    allAvailableTags,
    exportActiveProject,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useApp();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isEditingStyle, setIsEditingStyle] = useState(false);

  // Tag editor inline dropdown / popover state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeProjectDoc?.project.name) {
      setTitleInput(activeProjectDoc.project.name);
    }
  }, [activeProjectDoc?.project.name]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isAddingTag) {
      tagInputRef.current?.focus();
    }
  }, [isAddingTag]);

  if (!activeProjectDoc) return null;

  const { project, nodes } = activeProjectDoc;
  const egnNode = nodes.find((n) => n.id === project.endGoalNodeId);
  const progressPercentage = ProjectService.calculateProgress(nodes);
  const projectTags = project.tags || [];

  const summary = useMemo(() => {
    return ProjectService.getProjectSummary(project, nodes);
  }, [project, nodes]);
  const isArchived = summary.isArchived;
  const projectStatus = summary.status;

  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== project.name) {
      await updateProjectName(trimmed);
    } else {
      setTitleInput(project.name);
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setTitleInput(project.name);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelTitle();
    }
  };

  const handleAddTagToProject = async (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, '');
    if (trimmed && !projectTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      await updateProjectTags([...projectTags, trimmed]);
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTagFromProject = async (tagToRemove: string) => {
    await updateProjectTags(projectTags.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (newTagInput.trim()) {
        handleAddTagToProject(newTagInput);
      }
    } else if (e.key === 'Escape') {
      setIsAddingTag(false);
      setNewTagInput('');
    }
  };

  // Reusable suggested tags that aren't on this project yet
  const availableUnusedTags = useMemo(() => {
    const currentLower = new Set(projectTags.map((t) => t.toLowerCase()));
    return allAvailableTags.filter((t) => !currentLower.has(t.toLowerCase()));
  }, [allAvailableTags, projectTags]);

  const theme = useMemo(() => getProjectColorTheme(project.style?.color), [project.style?.color]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden dark:bg-slate-950 bg-slate-50 transition-colors duration-150">
      {/* Subheader / Project Bar */}
      <div className="h-12 sm:h-14 bg-white/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-2.5 sm:px-4 flex items-center justify-between z-20 shrink-0 backdrop-blur-md gap-1 sm:gap-3">
        {/* Left: Back button, Title & Tags */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 overflow-hidden min-w-0">
          <button
            onClick={() => setCurrentView('projects')}
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Back to Projects Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Project Theme Icon / Customizer Popover */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsEditingStyle((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${theme.badgeBg} hover:opacity-90 shadow-xs`}
              title="Click to customize project theme & icon"
            >
              <ProjectIconDisplay icon={project.style?.icon} emoji={project.style?.emoji} className="w-4 h-4" />
            </button>

            {isEditingStyle && (
              <div className="absolute top-full left-0 mt-2 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 min-w-[280px] sm:min-w-[300px] max-w-[calc(100vw-1.5rem)] animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                    <Palette className="w-3.5 h-3.5 text-slate-400" />
                    <span>Project Theme</span>
                  </div>
                  <button
                    onClick={() => setIsEditingStyle(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ProjectStylePicker
                  value={project.style || { color: 'emerald', icon: 'target' }}
                  onChange={(newStyle) => {
                    updateProjectStyle(newStyle);
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 overflow-hidden min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center space-x-1 sm:space-x-1.5 animate-in fade-in">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="px-2 py-1 text-xs sm:text-sm font-bold bg-slate-50 dark:bg-slate-950 border border-emerald-500 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner max-w-[100px] xs:max-w-[140px] sm:max-w-xs"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors shadow-xs"
                  title="Save title"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCancelTitle}
                  className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                className="group flex items-center space-x-1.5 cursor-pointer p-1 -m-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors min-w-0"
                title="Click to rename project"
              >
                <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-xs">
                  {project.name}
                </h2>
                <Edit2 className="w-3 h-3 text-slate-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            )}

            {/* Goal Tag with Custom Project Icon */}
            {egnNode && (
              <span className="hidden lg:flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-slate-700 shrink-0">
                <ProjectIconDisplay icon={project.style?.icon} emoji={project.style?.emoji} className={`w-3 h-3 ${theme.text} shrink-0`} />
                <span className="font-medium text-slate-500 dark:text-slate-400">Goal:</span>
                <span className="truncate max-w-[130px] font-semibold text-slate-700 dark:text-slate-200">{egnNode.text}</span>
              </span>
            )}

            {/* Project Tags & Tag Management */}
            <div className="hidden sm:flex items-center space-x-1.5 overflow-hidden pl-1 border-l border-slate-200 dark:border-slate-800">
              {projectTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium border border-emerald-500/30 shrink-0"
                >
                  <Tag className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t}</span>
                  <button
                    onClick={() => handleRemoveTagFromProject(t)}
                    className="hover:text-rose-500 cursor-pointer ml-0.5"
                    title={`Remove tag ${t}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}

              {/* Add Tag Inline Control */}
              {isAddingTag ? (
                <div className="relative flex items-center space-x-1 animate-in fade-in">
                  <input
                    ref={tagInputRef}
                    type="text"
                    placeholder="Tag name..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="w-24 px-1.5 py-0.5 text-[11px] bg-slate-50 dark:bg-slate-950 border border-emerald-500 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <button
                    onClick={() => {
                      if (newTagInput.trim()) handleAddTagToProject(newTagInput);
                      else setIsAddingTag(false);
                    }}
                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] cursor-pointer"
                  >
                    <Check className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingTag(false);
                      setNewTagInput('');
                    }}
                    className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>

                  {/* Suggestion Dropdown if existing tags match */}
                  {availableUnusedTags.length > 0 && newTagInput.trim() && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-1 z-50 min-w-[120px]">
                      {availableUnusedTags
                        .filter((t) => t.toLowerCase().includes(newTagInput.toLowerCase()))
                        .slice(0, 4)
                        .map((suggested) => (
                          <button
                            key={suggested}
                            type="button"
                            onClick={() => handleAddTagToProject(suggested)}
                            className="w-full text-left px-2 py-1 text-[11px] rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-600 flex items-center space-x-1"
                          >
                            <Tag className="w-2.5 h-2.5 text-emerald-500" />
                            <span>#{suggested}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingTag(true)}
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                  title="Add tag to project"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Tag</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center: Tabs */}
        <div id="nav-tabs" className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-0.5 sm:p-1 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveProjectTab('graph')}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeProjectTab === 'graph'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Graph Canvas"
          >
            <Workflow className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Graph</span>
          </button>

          <button
            onClick={() => setActiveProjectTab('timeline')}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeProjectTab === 'timeline'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Timeline Projection"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Timeline</span>
          </button>

          <button
            onClick={() => setActiveProjectTab('history')}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeProjectTab === 'history'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Version History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>

        {/* Right: Undo/Redo, Progress, Archive/Restore & Export */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Undo / Redo Actions */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                canUndo
                  ? 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50'
              }`}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                canRedo
                  ? 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800 cursor-pointer shadow-xs'
                  : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50'
              }`}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Progress:</div>
            <div className="w-20 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${theme.progressBar} transition-all duration-300`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className={`text-[11px] font-bold ${theme.text}`}>{progressPercentage}%</div>
          </div>

          {/* Archive / Restore Button */}
          {isArchived ? (
            <button
              onClick={() => unarchiveProject(project.id)}
              className="flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer shadow-xs"
              title="Restore project to Active"
            >
              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Restore</span>
            </button>
          ) : (
            <button
              onClick={() => archiveProject(project.id, 'archived')}
              className="flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer shadow-xs"
              title="Archive Project"
            >
              <Archive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Archive</span>
            </button>
          )}

          <button
            onClick={exportActiveProject}
            className="flex items-center space-x-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer shadow-xs"
            title="Export Project as JSON"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Archived Notice Banner */}
      {isArchived && (
        <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-xs flex items-center justify-between text-amber-800 dark:text-amber-200 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Archived Project ({projectStatus.toUpperCase()}):</strong> This project is archived.
              Its tasks are preserved for reference and hidden from active views.
            </span>
          </div>
          <button
            onClick={() => unarchiveProject(project.id)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] shadow-xs cursor-pointer transition-colors shrink-0 ml-3"
          >
            <ArchiveRestore className="w-3 h-3" />
            <span>Restore Project</span>
          </button>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeProjectTab === 'graph' && <GraphView />}
        {activeProjectTab === 'timeline' && <TimelineView />}
        {activeProjectTab === 'history' && <HistoryView />}
      </div>
    </div>
  );
};
