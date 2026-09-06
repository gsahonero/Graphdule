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
  Zap,
  Brain,
  Lightbulb,
  Sprout,
  ArrowRightLeft,
  Copy,
  PauseCircle,
  Compass,
  ArrowRight,
  Layers,
  Clock,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { getTodayString, addDays } from '../../../domain/utils/date';
import { createDefaultSampleProject } from '../../../config/sample-project';
import { IdeaSeed, ProjectStyle, ProjectSummary } from '../../../domain/models/types';
import { getProjectColorTheme, ProjectIconDisplay } from '../../utils/project-style';
import { ProjectStylePicker } from '../../components/ProjectStylePicker';
import { ActivityLogService } from '../../../domain/services/activity-log-service';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    allActiveNodes,
    lastActiveNode,
    goToLastActivityNode,
    openProject,
    createProject,
    updateProjectStyle,
    archiveProject,
    unarchiveProject,
    deleteProject,
    importProjectJson,
    allAvailableTags,
    formatDateDisplay,
    ideaSeeds,
    addIdeaSeed,
    updateIdeaSeed,
    deleteIdeaSeed,
    germinateIdeaSeed,
    parkProject,
    unparkProject,
    maxAttentionProjects,
    attentionProjects,
    toggleProjectAttention,
    swapProjectAttention,
    activityLog,
    clearActivityLog,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'active' | 'parking' | 'archive'>('active');
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'completed' | 'abandoned' | 'manual'>('all');
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [editingStyleProjectId, setEditingStyleProjectId] = useState<string | null>(null);

  // Attention & Demotion Modal state
  const [pendingAttentionPromotionProject, setPendingAttentionPromotionProject] = useState<ProjectSummary | null>(null);

  // Telemetry & AI Patterns Modal state
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Idea Seed Creation state
  const [isSeedComposerOpen, setIsSeedComposerOpen] = useState(false);
  const [seedTitle, setSeedTitle] = useState('');
  const [seedRawNotes, setSeedRawNotes] = useState('');
  const [seedThoughts, setSeedThoughts] = useState<string[]>([]);
  const [thoughtInput, setThoughtInput] = useState('');

  // Idea Seed Editing state
  const [editingSeed, setEditingSeed] = useState<IdeaSeed | null>(null);
  const [editingSeedTitle, setEditingSeedTitle] = useState('');
  const [editingSeedRawNotes, setEditingSeedRawNotes] = useState('');
  const [editingSeedThoughts, setEditingSeedThoughts] = useState<string[]>([]);
  const [editingThoughtInput, setEditingThoughtInput] = useState('');
  const [editingSeedTags, setEditingSeedTags] = useState<string[]>([]);
  const [editingTagInput, setEditingTagInput] = useState('');

  // Quick inline thought input per card (map of seedId -> input text)
  const [cardThoughtInputs, setCardThoughtInputs] = useState<Record<string, string>>({});
  // Expanded thoughts state for cards with more than 3 thoughts
  const [expandedSeedThoughts, setExpandedSeedThoughts] = useState<Record<string, boolean>>({});

  // Parent breadcrumb trail for lastActiveNode if nested
  const lastActiveNodeParentChain = useMemo(() => {
    if (!lastActiveNode?.node.parentNodeId) return [];
    const chain: string[] = [];
    const nodesMap = new Map(allActiveNodes.map((n) => [n.id, n]));
    let curr: string | null | undefined = lastActiveNode.node.parentNodeId;
    const visited = new Set<string>();
    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const parent = nodesMap.get(curr);
      if (!parent) break;
      chain.unshift(parent.text);
      curr = parent.parentNodeId;
    }
    return chain;
  }, [lastActiveNode, allActiveNodes]);

  // Active vs Parked vs Archived split
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived && !p.isParked), [projects]);
  const parkedProjects = useMemo(() => projects.filter((p) => p.isParked), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.isArchived), [projects]);

  // Current scope of projects based on activeTab
  const currentScopedProjects = useMemo(() => {
    if (activeTab === 'active') return activeProjects;
    if (activeTab === 'parking') return parkedProjects;

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
  }, [activeTab, activeProjects, parkedProjects, archivedProjects, archiveFilter]);

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

  const handleToggleAttention = async (p: ProjectSummary) => {
    if (p.isAttention) {
      await toggleProjectAttention(p.id);
    } else {
      const res = await toggleProjectAttention(p.id);
      if (res.requiresDemotion) {
        setPendingAttentionPromotionProject(p);
      }
    }
  };

  const handleSwapAttention = async (demoteProjectId: string) => {
    if (!pendingAttentionPromotionProject) return;
    await swapProjectAttention(pendingAttentionPromotionProject.id, demoteProjectId);
    setPendingAttentionPromotionProject(null);
  };

  const handleAddThoughtToSeed = () => {
    const trimmed = thoughtInput.trim();
    if (trimmed && !seedThoughts.includes(trimmed)) {
      setSeedThoughts((prev) => [...prev, trimmed]);
      setThoughtInput('');
    }
  };

  const handleCreateIdeaSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedTitle.trim()) return;

    let finalThoughts = [...seedThoughts];
    if (thoughtInput.trim() && !finalThoughts.includes(thoughtInput.trim())) {
      finalThoughts.push(thoughtInput.trim());
    }

    await addIdeaSeed(seedTitle.trim(), {
      rawNotes: seedRawNotes.trim() || undefined,
      seedThoughts: finalThoughts,
    });

    setSeedTitle('');
    setSeedRawNotes('');
    setSeedThoughts([]);
    setThoughtInput('');
    setIsSeedComposerOpen(false);
  };

  const handleGerminate = async (seedId: string) => {
    try {
      await germinateIdeaSeed(seedId);
    } catch (err) {
      console.error('Failed to germinate seed:', err);
    }
  };

  const handleOpenEditSeed = (seed: IdeaSeed) => {
    setEditingSeed(seed);
    setEditingSeedTitle(seed.title);
    setEditingSeedRawNotes(seed.rawNotes || '');
    setEditingSeedThoughts(seed.seedThoughts ? [...seed.seedThoughts] : []);
    setEditingThoughtInput('');
    setEditingSeedTags(seed.tags ? [...seed.tags] : []);
    setEditingTagInput('');
  };

  const handleCloseEditSeed = () => {
    setEditingSeed(null);
    setEditingSeedTitle('');
    setEditingSeedRawNotes('');
    setEditingSeedThoughts([]);
    setEditingThoughtInput('');
    setEditingSeedTags([]);
    setEditingTagInput('');
  };

  const handleAddThoughtToEditingSeed = () => {
    const trimmed = editingThoughtInput.trim();
    if (trimmed && !editingSeedThoughts.includes(trimmed)) {
      setEditingSeedThoughts((prev) => [...prev, trimmed]);
      setEditingThoughtInput('');
    }
  };

  const handleRemoveThoughtFromEditingSeed = (index: number) => {
    setEditingSeedThoughts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTagToEditingSeed = () => {
    const tag = editingTagInput.trim().toLowerCase();
    if (tag && !editingSeedTags.includes(tag)) {
      setEditingSeedTags((prev) => [...prev, tag]);
      setEditingTagInput('');
    }
  };

  const handleRemoveTagFromEditingSeed = (tagToRemove: string) => {
    setEditingSeedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSaveSeedEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeed || !editingSeedTitle.trim()) return;

    let finalThoughts = [...editingSeedThoughts];
    if (editingThoughtInput.trim() && !finalThoughts.includes(editingThoughtInput.trim())) {
      finalThoughts.push(editingThoughtInput.trim());
    }

    let finalTags = [...editingSeedTags];
    if (editingTagInput.trim()) {
      const extraTag = editingTagInput.trim().toLowerCase();
      if (!finalTags.includes(extraTag)) {
        finalTags.push(extraTag);
      }
    }

    await updateIdeaSeed(editingSeed.id, {
      title: editingSeedTitle.trim(),
      rawNotes: editingSeedRawNotes.trim() || undefined,
      seedThoughts: finalThoughts,
      tags: finalTags,
    });

    handleCloseEditSeed();
  };

  const handleQuickAddThought = async (seed: IdeaSeed) => {
    const text = (cardThoughtInputs[seed.id] || '').trim();
    if (!text) return;

    const currentThoughts = seed.seedThoughts ? [...seed.seedThoughts] : [];
    if (currentThoughts.includes(text)) {
      setCardThoughtInputs((prev) => ({ ...prev, [seed.id]: '' }));
      return;
    }

    await updateIdeaSeed(seed.id, {
      seedThoughts: [...currentThoughts, text],
    });

    setCardThoughtInputs((prev) => ({ ...prev, [seed.id]: '' }));
  };

  const handleQuickRemoveThought = async (seed: IdeaSeed, thoughtIndex: number) => {
    if (!seed.seedThoughts) return;
    const updatedThoughts = seed.seedThoughts.filter((_, idx) => idx !== thoughtIndex);
    await updateIdeaSeed(seed.id, {
      seedThoughts: updatedThoughts,
    });
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
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Projects & Attention
            </h1>
            <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Zap className="w-3 h-3 fill-amber-500" />
              <span>{attentionProjects.length}/{maxAttentionProjects} Slots</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ideas are unlimited; projects are manageable; attention is limited.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Go to last activity node button */}
          {lastActiveNode && (
            <button
              onClick={goToLastActivityNode}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer shadow-2xs group"
              title={`Go to last activity node: "${lastActiveNode.node.text}" in "${lastActiveNode.project.name}"`}
            >
              <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:rotate-45 transition-transform shrink-0" />
              <span className="hidden lg:inline text-slate-500 dark:text-slate-400 font-normal">Resume:</span>
              <span className="max-w-[120px] sm:max-w-[170px] md:max-w-[210px] truncate">
                {lastActiveNode.node.text}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )}

          {/* AI Telemetry & Patterns Modal trigger */}
          <button
            onClick={() => setIsTelemetryModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="View activity telemetry journal & copy LLM pattern prompt"
          >
            <Brain className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden md:inline">AI Telemetry</span>
            <span className="md:hidden">AI</span>
          </button>

          {projects.length === 0 && (
            <button
              onClick={handleImportSample}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Sample Project</span>
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
                <span>Close</span>
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

      {/* Last Activity Node Quick-Resume Banner */}
      {lastActiveNode && (
        <div
          onClick={goToLastActivityNode}
          className="bg-gradient-to-r from-indigo-500/10 via-white dark:via-slate-900 to-indigo-500/5 hover:from-indigo-500/15 dark:hover:from-indigo-950/60 border border-indigo-200/90 dark:border-indigo-800/70 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all group"
          title={`Click to open "${lastActiveNode.node.text}" in ${lastActiveNode.project.name}`}
        >
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  <Clock className="w-2.5 h-2.5" />
                  <span>Last Activity Node</span>
                </span>
                {lastActiveNode.node.parentNodeId && (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <Layers className="w-2.5 h-2.5 text-blue-500" />
                    <span>Subtask</span>
                  </span>
                )}
                {lastActiveNode.node.status === 'completed' ? (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Completed</span>
                  </span>
                ) : lastActiveNode.node.status === 'in_progress' ? (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                    <span>In Progress</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    <span>Planned</span>
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                  {lastActiveNode.node.text}
                </span>
              </div>

              {lastActiveNodeParentChain.length > 0 && (
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">↳</span>
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">Inside:</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                    {lastActiveNodeParentChain.join(' → ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
            {/* Project Pill */}
            {(() => {
              const projectTheme = getProjectColorTheme(lastActiveNode.project.style?.color);
              return (
                <span
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${projectTheme.badgeBg} max-w-[150px] truncate shadow-2xs`}
                >
                  <ProjectIconDisplay
                    icon={lastActiveNode.project.style?.icon}
                    emoji={lastActiveNode.project.style?.emoji}
                    className="w-3 h-3 shrink-0"
                  />
                  <span className="truncate">{lastActiveNode.project.name}</span>
                </span>
              );
            })()}

            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs group-hover:shadow transition-all cursor-pointer"
            >
              <span>Go to node</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs (Active vs Archived) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3 gap-2.5">
        <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
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
              setActiveTab('parking');
              setSelectedTagFilter(null);
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'parking'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Idea Parking Lot</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'parking'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {ideaSeeds.length + parkedProjects.length}
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

      {/* Dedicated Priority Attention Section (on Active Tab) */}
      {activeTab === 'active' && (
        <div className="space-y-3.5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-2xl border border-amber-500/25 dark:border-amber-500/35 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4 fill-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Priority Attention
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hard-capped focus slots ({attentionProjects.length}/{maxAttentionProjects}) sorted from nearest to furthest due date.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shrink-0 self-start sm:self-auto shadow-2xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                {attentionProjects.length} / {maxAttentionProjects}
              </span>
              <div className="flex items-center space-x-1.5">
                {Array.from({ length: maxAttentionProjects }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i < attentionProjects.length
                        ? 'bg-amber-500 shadow-xs shadow-amber-500/60 ring-2 ring-amber-500/20'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {attentionProjects.length === 0 ? (
            <div className="border border-dashed border-amber-500/30 dark:border-amber-500/20 rounded-xl p-4 text-center bg-white/40 dark:bg-slate-900/40 space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No projects currently receiving priority attention
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Ideas are unlimited; projects are manageable; attention is limited. Click the ⚡ Focus button on any project below to allocate an attention slot.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {attentionProjects.map((proj, idx) => (
                <div
                  key={proj.id}
                  onClick={() => openProject(proj.id)}
                  className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 hover:border-amber-500 rounded-xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 mb-1">
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Zap className="w-2.5 h-2.5 fill-amber-500" />
                            <span>Priority #{idx + 1}</span>
                          </span>
                          <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300">
                            Due {formatDateDisplay(proj.deadline)}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {proj.name}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAttention(proj);
                          }}
                          className="p-1 rounded text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          title="Step Down (Free Attention Slot)"
                        >
                          <Zap className="w-4 h-4 fill-amber-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            parkProject(proj.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Park Project"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      Goal: {proj.endGoalText}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {proj.progressPercentage}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${proj.progressPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Due {formatDateDisplay(proj.deadline)}</span>
                      <span>{proj.activeTaskCount} active tasks</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Idea Parking Lot Tab Content */}
      {activeTab === 'parking' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Parking Lot Banner & Plant Seed Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-500/5 to-transparent border border-amber-500/20">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Idea Parking Lot
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                Ideas are unlimited; projects are manageable; attention is limited. Parked projects retain all graph nodes and chronology, dormant until you reactivate them.
              </p>
            </div>

            <button
              onClick={() => setIsSeedComposerOpen((prev) => !prev)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-950/20 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Sprout className="w-4 h-4" />
              <span>{isSeedComposerOpen ? 'Close Composer' : 'Plant an Idea Seed'}</span>
            </button>
          </div>

          {/* Idea Seed Composer Form */}
          {isSeedComposerOpen && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sprout className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Plant a New Idea Seed
                  </h3>
                </div>
                <button
                  onClick={() => setIsSeedComposerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateIdeaSeed} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Seed Title / Core Concept <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={seedTitle}
                    onChange={(e) => setSeedTitle(e.target.value)}
                    placeholder="e.g. Next-gen automated reporting pipeline"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                    required
                  />
                </div>

                {/* Bulleted Thoughts */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Initial Thoughts / Components (Becomes predecessor nodes when germinated)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={thoughtInput}
                      onChange={(e) => setThoughtInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddThoughtToSeed();
                        }
                      }}
                      placeholder="Type a thought and press Enter or click Add"
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAddThoughtToSeed}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
                    >
                      Add Thought
                    </button>
                  </div>

                  {seedThoughts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {seedThoughts.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                        >
                          <span>• {t}</span>
                          <button
                            type="button"
                            onClick={() => setSeedThoughts(seedThoughts.filter((_, i) => i !== idx))}
                            className="text-amber-500 hover:text-amber-700 ml-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Freeform Raw Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Raw Notes & Brainstorming (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={seedRawNotes}
                    onChange={(e) => setSeedRawNotes(e.target.value)}
                    placeholder="Dump freeform ideas, links, or context without any graph burden..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="flex justify-end space-x-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSeedComposerOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-colors cursor-pointer"
                  >
                    <Sprout className="w-3.5 h-3.5" />
                    <span>Plant Seed</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Section 1: Idea Seeds */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Sprout className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Idea Seeds ({ideaSeeds.length})
              </h3>
            </div>

            {ideaSeeds.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No idea seeds planted yet. Capture fleeting thoughts without the graph overhead.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ideaSeeds.map((seed) => {
                  const isExpanded = !!expandedSeedThoughts[seed.id];
                  const thoughtsList = seed.seedThoughts || [];
                  const visibleThoughts = isExpanded ? thoughtsList : thoughtsList.slice(0, 3);
                  const isUpdated = seed.updatedAt && seed.updatedAt !== seed.createdAt;

                  return (
                    <div
                      key={seed.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            onClick={() => handleOpenEditSeed(seed)}
                            className="flex items-center space-x-2 cursor-pointer group/title"
                            title="Click to edit Idea Seed"
                          >
                            <div className="p-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover/title:bg-emerald-500/25 transition-colors">
                              <Sprout className="w-3.5 h-3.5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover/title:text-emerald-600 dark:group-hover/title:text-emerald-400 transition-colors">
                              {seed.title}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => handleOpenEditSeed(seed)}
                              className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Idea Seed (modify thoughts, notes, title)"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete seed "${seed.title}"?`)) {
                                  deleteIdeaSeed(seed.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete Seed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Tags */}
                        {seed.tags && seed.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {seed.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Raw Notes */}
                        {seed.rawNotes && (
                          <p
                            onClick={() => handleOpenEditSeed(seed)}
                            className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer transition-colors"
                            title="Click to edit notes"
                          >
                            {seed.rawNotes}
                          </p>
                        )}

                        {/* Thoughts / Components */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                              Components & Thoughts ({thoughtsList.length}):
                            </span>
                            {thoughtsList.length > 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSeedThoughts((prev) => ({
                                    ...prev,
                                    [seed.id]: !prev[seed.id],
                                  }))
                                }
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
                              >
                                {isExpanded ? 'Show less' : `Show all (${thoughtsList.length})`}
                              </button>
                            )}
                          </div>

                          {thoughtsList.length > 0 ? (
                            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                              {visibleThoughts.map((thought, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center justify-between group/item hover:bg-slate-50 dark:hover:bg-slate-800/40 px-1 py-0.5 rounded transition-colors"
                                >
                                  <span className="truncate pr-2">• {thought}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickRemoveThought(seed, idx)}
                                    className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-0.5 rounded cursor-pointer shrink-0"
                                    title="Remove thought"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">No components added yet.</p>
                          )}

                          {/* Quick Add Thought to Seed */}
                          <div className="flex items-center space-x-1.5 pt-1">
                            <input
                              type="text"
                              value={cardThoughtInputs[seed.id] || ''}
                              onChange={(e) =>
                                setCardThoughtInputs((prev) => ({ ...prev, [seed.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleQuickAddThought(seed);
                                }
                              }}
                              placeholder="+ Add another thought..."
                              className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/30"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuickAddThought(seed)}
                              disabled={!(cardThoughtInputs[seed.id] || '').trim()}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Add thought"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {isUpdated
                            ? `Updated ${new Date(seed.updatedAt).toLocaleDateString()}`
                            : `Planted ${new Date(seed.createdAt).toLocaleDateString()}`}
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSeed(seed)}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            title="Edit all fields of this idea seed"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleGerminate(seed.id)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
                            title="Convert seed into a full DAG project"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Germinate</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Parked Projects */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <PauseCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Parked Projects ({parkedProjects.length})
              </h3>
            </div>

            {parkedProjects.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No projects parked right now. You can park active projects at any time to preserve 100% of their data while freeing attention.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {parkedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mb-1">
                            <span>Parked</span>
                          </span>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {proj.name}
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Delete project "${proj.name}"?`)) {
                              deleteProject(proj.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        Goal: {proj.endGoalText}
                      </p>
                      <div className="text-[11px] text-slate-400">
                        {proj.totalTaskCount} tasks • {proj.progressPercentage}% progress
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => unparkProject(proj.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        Unpark to Active
                      </button>
                      <button
                        onClick={() => handleToggleAttention(proj)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        <Zap className="w-3 h-3 fill-white" />
                        <span>Unpark & Focus</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reusable Tag Filtering Toolbar & Project Grid (for Active & Archive tabs) */}
      {activeTab !== 'parking' && (
        <>
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
                          {project.isAttention && !project.isArchived && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1 shrink-0">
                              <Zap className="w-2.5 h-2.5 fill-amber-500" />
                              <span>Focus</span>
                            </span>
                          )}
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

                      {/* Actions (Focus, Park, Style Edit, Archive, Restore, Delete) */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Focus / Attention Toggle Button */}
                        {!project.isArchived && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAttention(project);
                            }}
                            className={`p-1.5 sm:p-1 transition-all cursor-pointer rounded ${
                              project.isAttention
                                ? 'text-amber-500 bg-amber-500/15 opacity-100 hover:bg-amber-500/25'
                                : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={project.isAttention ? 'Remove from Attention Focus' : 'Focus (Allocate Attention Slot)'}
                          >
                            <Zap className={`w-4 h-4 ${project.isAttention ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}

                        {/* Park Button */}
                        {!project.isArchived && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              parkProject(project.id);
                            }}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 p-1.5 sm:p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Move to Idea Parking Lot"
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Style Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStyleProjectId((prev) => (prev === project.id ? null : project.id));
                          }}
                          className={`p-1.5 sm:p-1 transition-all cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            editingStyleProjectId === project.id
                              ? 'opacity-100 text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-800'
                              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
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
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-1.5 sm:p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
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
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 sm:p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
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
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 sm:p-1 transition-opacity cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800"
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
      </>
      )}

      {/* Attention Capacity Limit Demotion / Swap Modal */}
      {pendingAttentionPromotionProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Zap className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Attention Limit Reached ({maxAttentionProjects}/{maxAttentionProjects})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Attention is limited. To focus on <strong>{pendingAttentionPromotionProject.name}</strong>, choose a project to step down:
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingAttentionPromotionProject(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {attentionProjects.map((ap, idx) => (
                <div
                  key={ap.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-amber-400 dark:hover:border-amber-500 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        #{idx + 1}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {ap.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono font-medium text-amber-700 dark:text-amber-300">Due {formatDateDisplay(ap.deadline)}</span>
                      <span>•</span>
                      <span>{ap.progressPercentage}% progress</span>
                      <span>•</span>
                      <span>{ap.activeTaskCount} active tasks</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSwapAttention(ap.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Demote & Focus</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPendingAttentionPromotionProject(null)}
                className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Telemetry & AI Prompt Modal */}
      {isTelemetryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Activity Telemetry & AI Patterns
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Append-only execution telemetry formatted as an executive coaching prompt for LLMs.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTelemetryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics cards and LLM Prompt */}
            {(() => {
              const analysis = ActivityLogService.generatePatternAnalysis(activityLog);
              return (
                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total Events</span>
                      <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {analysis.metrics.totalEvents}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Completed</span>
                      <p className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {analysis.metrics.tasksCompleted}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Under Attention</span>
                      <p className="text-lg font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                        {analysis.metrics.tasksCompletedUnderAttention}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40">
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Dates Moved</span>
                      <p className="text-lg font-mono font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                        {analysis.metrics.datesMovedCount}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        LLM Prompt Preview
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(analysis.markdownPrompt);
                          setCopiedPrompt(true);
                          setTimeout(() => setCopiedPrompt(false), 2000);
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs"
                      >
                        {copiedPrompt ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Prompt for LLM</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800 whitespace-pre-wrap selection:bg-emerald-500 selection:text-black">
                      {analysis.markdownPrompt}
                    </pre>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={async () => {
                  if (confirm('Clear telemetry activity history?')) {
                    await clearActivityLog();
                  }
                }}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium cursor-pointer"
              >
                Clear Telemetry Log
              </button>
              <button
                onClick={() => setIsTelemetryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Idea Seed Modal */}
      {editingSeed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Edit Idea Seed
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Refine thoughts, add components, or update raw notes before germinating.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEditSeed}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSeedEdits} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Seed Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Seed Title / Core Concept <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingSeedTitle}
                  onChange={(e) => setEditingSeedTitle(e.target.value)}
                  placeholder="e.g. Next-gen automated reporting pipeline"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
              </div>

              {/* Thoughts / Components */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Thoughts & Components ({editingSeedThoughts.length})</span>
                  <span className="text-[10px] font-normal text-slate-400">Predecessor nodes when germinated</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editingThoughtInput}
                    onChange={(e) => setEditingThoughtInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddThoughtToEditingSeed();
                      }
                    }}
                    placeholder="Add a new thought or component..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleAddThoughtToEditingSeed}
                    disabled={!editingThoughtInput.trim()}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {editingSeedThoughts.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                    {editingSeedThoughts.map((thought, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-800 dark:text-slate-200 group"
                      >
                        <span className="truncate mr-2">• {thought}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveThoughtFromEditingSeed(idx)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer shrink-0"
                          title="Delete thought"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Freeform Raw Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Raw Notes & Brainstorming (Optional)
                </label>
                <textarea
                  rows={4}
                  value={editingSeedRawNotes}
                  onChange={(e) => setEditingSeedRawNotes(e.target.value)}
                  placeholder="Keep including more thoughts, dump ideas, research links, or context..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 leading-relaxed"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tags (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editingTagInput}
                    onChange={(e) => setEditingTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTagToEditingSeed();
                      }
                    }}
                    placeholder="Add tag (press Enter)..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddTagToEditingSeed}
                    disabled={!editingTagInput.trim()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>
                {editingSeedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editingSeedTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTagFromEditingSeed(tag)}
                          className="text-slate-400 hover:text-rose-500 ml-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseEditSeed}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editingSeedTitle.trim()}
                  className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
