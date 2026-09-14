import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart,
  X,
  Volume2,
  VolumeX,
  Play,
  Plus,
  Trash2,
  RotateCcw,
  Shield,
} from 'lucide-react';
import {
  HealthConfig,
  HealthIntervention,
  HealthSoundType,
  TaskEnvironment,
} from '../../domain/health/types';
import { HealthService, DEFAULT_HEALTH_CONFIG } from '../../domain/health/health-service';
import { previewSound } from '../../domain/health/sound';

export const HealthConfigModal: React.FC = () => {
  const {
    isHealthConfigModalOpen,
    setIsHealthConfigModalOpen,
    healthConfig,
    updateHealthConfig,
  } = useApp();

  const [localConfig, setLocalConfig] = useState<HealthConfig>(() =>
    healthConfig || DEFAULT_HEALTH_CONFIG
  );
  const [activeTab, setActiveTab] = useState<'interventions' | 'sound' | 'add'>('interventions');

  // New intervention form state
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIntervalMinutes, setNewIntervalMinutes] = useState(20);
  const [newDurationSeconds, setNewDurationSeconds] = useState(20);
  const [newMessage, setNewMessage] = useState('');
  const [newEnvironments, setNewEnvironments] = useState<TaskEnvironment[]>(['computer', 'mixed']);
  const [newSoundType, setNewSoundType] = useState<HealthSoundType>('subtle_chime');

  useEffect(() => {
    if (isHealthConfigModalOpen) {
      setLocalConfig(healthConfig || DEFAULT_HEALTH_CONFIG);
    }
  }, [isHealthConfigModalOpen, healthConfig]);

  if (!isHealthConfigModalOpen) return null;

  const handleToggleGlobal = async () => {
    const updated = { ...localConfig, enabled: !localConfig.enabled };
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleToggleSound = async () => {
    const updated = { ...localConfig, soundEnabled: !localConfig.soundEnabled };
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleVolumeChange = async (vol: number) => {
    const updated = { ...localConfig, globalVolume: vol };
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleDefaultSoundTypeChange = async (soundType: HealthSoundType) => {
    const updated = { ...localConfig, defaultSoundType: soundType };
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleToggleIntervention = async (id: string, enabled: boolean) => {
    const updated = HealthService.toggleIntervention(localConfig, id, enabled);
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleDeleteIntervention = async (id: string) => {
    const updated = HealthService.removeIntervention(localConfig, id);
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleUpdateInterventionMinutes = async (id: string, minutes: number) => {
    const validMinutes = Math.max(1, minutes);
    const updated = HealthService.updateIntervention(localConfig, id, {
      interval: validMinutes * 60,
      trigger: {
        type: 'continuous_duration',
        thresholdSeconds: validMinutes * 60,
      },
    });
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleUpdateInterventionDuration = async (id: string, seconds: number) => {
    const validSeconds = Math.max(5, seconds);
    const updated = HealthService.updateIntervention(localConfig, id, {
      duration: validSeconds,
    });
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleToggleInterventionEnvironment = async (
    id: string,
    env: TaskEnvironment,
    currentEnvs: TaskEnvironment[] | TaskEnvironment | 'all'
  ) => {
    let nextList: TaskEnvironment[];
    if (currentEnvs === 'all') {
      nextList = ['computer', 'physical', 'mixed'].filter((e) => e !== env) as TaskEnvironment[];
    } else {
      const arr = Array.isArray(currentEnvs) ? [...currentEnvs] : [currentEnvs];
      if (arr.includes(env)) {
        nextList = arr.filter((e) => e !== env);
        if (nextList.length === 0) nextList = [env]; // keep at least one
      } else {
        nextList = [...arr, env];
      }
    }
    const updated = HealthService.updateIntervention(localConfig, id, {
      environment: nextList,
    });
    setLocalConfig(updated);
    await updateHealthConfig(updated);
  };

  const handleResetDefaults = async () => {
    const defaults = HealthService.resetToDefaults();
    setLocalConfig(defaults);
    await updateHealthConfig(defaults);
  };

  const handleCreateIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newMessage.trim()) return;

    const id = (newId.trim() || newName.toLowerCase().replace(/[^a-z0-9]+/g, '_')).slice(0, 40);
    const customIntervention: HealthIntervention = {
      id,
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      enabled: true,
      environment: newEnvironments,
      trigger: {
        type: 'continuous_duration',
        thresholdSeconds: Math.max(1, newIntervalMinutes) * 60,
      },
      interval: Math.max(1, newIntervalMinutes) * 60,
      duration: Math.max(5, newDurationSeconds),
      message: newMessage.trim(),
      notification: {
        enabled: true,
        style: 'subtle',
        title: newName.trim(),
      },
      sound: {
        enabled: true,
        type: newSoundType,
        volume: localConfig.globalVolume ?? 0.3,
      },
    };

    const updated = HealthService.registerIntervention(localConfig, customIntervention);
    setLocalConfig(updated);
    await updateHealthConfig(updated);

    // Reset form
    setNewId('');
    setNewName('');
    setNewDescription('');
    setNewMessage('');
    setNewIntervalMinutes(20);
    setNewDurationSeconds(20);
    setActiveTab('interventions');
  };

  const handlePresetFill = (preset: 'posture' | 'hydration' | 'movement' | 'session_warning') => {
    switch (preset) {
      case 'posture':
        setNewId('posture_check');
        setNewName('Posture & Shoulder Check');
        setNewDescription('Check spine alignment, relax shoulders, and reset ergonomics.');
        setNewIntervalMinutes(30);
        setNewDurationSeconds(15);
        setNewMessage('Straighten your back, roll your shoulders backward, and uncross your legs.');
        setNewEnvironments(['computer', 'mixed']);
        setNewSoundType('gentle_pulse');
        break;
      case 'hydration':
        setNewId('hydration_reminder');
        setNewName('Hydration Break');
        setNewDescription('Drink water to maintain cognitive stamina and focus.');
        setNewIntervalMinutes(45);
        setNewDurationSeconds(15);
        setNewMessage('Drink a sip of water to stay hydrated and refreshed.');
        setNewEnvironments(['computer', 'physical', 'mixed']);
        setNewSoundType('subtle_chime');
        break;
      case 'movement':
        setNewId('stand_and_stretch');
        setNewName('Stand & Stretch Break');
        setNewDescription('Stand up and stretch to restore circulation.');
        setNewIntervalMinutes(60);
        setNewDurationSeconds(60);
        setNewMessage('Stand up, stretch your legs, and take deep breaths for 60 seconds.');
        setNewEnvironments(['computer', 'mixed']);
        setNewSoundType('meditation_bell');
        break;
      case 'session_warning':
        setNewId('prolonged_focus_warning');
        setNewName('Prolonged Session Warning');
        setNewDescription('Alert for continuous sessions exceeding 90 minutes.');
        setNewIntervalMinutes(90);
        setNewDurationSeconds(300);
        setNewMessage('You have been focusing continuously for 90 minutes. Step away for a restorative 5-minute break.');
        setNewEnvironments(['computer', 'mixed']);
        setNewSoundType('digital_soft');
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="health-config-modal"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Heart className="w-5 h-5 fill-rose-500/20 stroke-rose-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Health & Focus</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sustainable productivity interventions without compromising your focus or AU
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsHealthConfigModalOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Master Controls */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleGlobal}
              data-testid="health-master-toggle"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                localConfig.enabled ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Health System: {localConfig.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleSound}
              data-testid="health-sound-toggle"
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-medium border transition-colors cursor-pointer ${
                localConfig.soundEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
              }`}
            >
              {localConfig.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>Sound {localConfig.soundEnabled ? 'On' : 'Off'}</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Reset health settings to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0 px-5 pt-2">
          <button
            onClick={() => setActiveTab('interventions')}
            data-testid="tab-interventions"
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'interventions'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Interventions ({localConfig.interventions.length})
          </button>
          <button
            onClick={() => setActiveTab('sound')}
            data-testid="tab-sound"
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sound'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Sound & Audio
          </button>
          <button
            onClick={() => setActiveTab('add')}
            data-testid="tab-add"
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1 ${
              activeTab === 'add'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>Add Intervention</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 1: Interventions List */}
          {activeTab === 'interventions' && (
            <div className="space-y-4">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Interventions trigger subtly during active focus sessions based on task environment and continuous work duration. Screen-break reminders automatically suppress for physical tasks.
              </div>

              {localConfig.interventions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No interventions configured. Click "Add Intervention" or "Reset to Defaults" to get started.
                </div>
              ) : (
                localConfig.interventions.map((intervention) => {
                  const intervalMinutes = Math.round(intervention.interval / 60);
                  const envArray: TaskEnvironment[] =
                    intervention.environment === 'all'
                      ? ['computer', 'physical', 'mixed']
                      : Array.isArray(intervention.environment)
                      ? (intervention.environment as TaskEnvironment[])
                      : [intervention.environment as TaskEnvironment];

                  return (
                    <div
                      key={intervention.id}
                      data-testid={`intervention-card-${intervention.id}`}
                      className={`p-4 rounded-xl border transition-all ${
                        intervention.enabled && localConfig.enabled
                          ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 shadow-xs'
                          : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-2.5 min-w-0">
                          <button
                            onClick={() => handleToggleIntervention(intervention.id, !intervention.enabled)}
                            className={`mt-0.5 relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                              intervention.enabled ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                intervention.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>

                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {intervention.name}
                            </h3>
                            {intervention.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {intervention.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() =>
                              previewSound(
                                intervention.sound?.type || localConfig.defaultSoundType || 'subtle_chime',
                                intervention.sound?.volume ?? localConfig.globalVolume ?? 0.3
                              )
                            }
                            title="Preview notification sound"
                            className="p-1.5 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>

                          <button
                            onClick={() => handleDeleteIntervention(intervention.id)}
                            title="Delete intervention"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Configuration Controls */}
                      <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                        {/* Timing inputs */}
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-1.5">
                            <span className="text-slate-500 dark:text-slate-400">Interval:</span>
                            <input
                              type="number"
                              min={1}
                              max={240}
                              value={intervalMinutes}
                              onChange={(e) =>
                                handleUpdateInterventionMinutes(intervention.id, parseInt(e.target.value) || 20)
                              }
                              className="w-14 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono"
                            />
                            <span className="text-slate-500">min</span>
                          </label>

                          <label className="flex items-center space-x-1.5">
                            <span className="text-slate-500 dark:text-slate-400">Duration:</span>
                            <input
                              type="number"
                              min={5}
                              max={600}
                              value={intervention.duration}
                              onChange={(e) =>
                                handleUpdateInterventionDuration(intervention.id, parseInt(e.target.value) || 20)
                              }
                              className="w-14 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono"
                            />
                            <span className="text-slate-500">sec</span>
                          </label>
                        </div>

                        {/* Environment check pills */}
                        <div className="flex items-center space-x-1.5 justify-start sm:justify-end">
                          <span className="text-slate-500 dark:text-slate-400 mr-1">Applies to:</span>
                          {(['computer', 'mixed', 'physical'] as TaskEnvironment[]).map((env) => {
                            const isChecked = envArray.includes(env);
                            return (
                              <button
                                key={env}
                                type="button"
                                onClick={() =>
                                  handleToggleInterventionEnvironment(
                                    intervention.id,
                                    env,
                                    intervention.environment
                                  )
                                }
                                className={`px-2 py-0.5 rounded-md font-medium border capitalize transition-colors cursor-pointer text-[10px] ${
                                  isChecked
                                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                                }`}
                              >
                                {env}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Message preview */}
                      <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 italic bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/40 dark:border-slate-800/40">
                        "{intervention.message}"
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Sound & Audio Customization */}
          {activeTab === 'sound' && (
            <div className="space-y-4 max-w-lg">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                  Audio & Synthesizer Settings
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Choose a harmonic tone synthesized natively via Web Audio API. Zero external downloads, instant playback.
                </p>

                {/* Tone Preset Select */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Default Tone Preset:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'subtle_chime', label: 'Subtle Chime (528Hz)', desc: 'Soft dual chime' },
                      { id: 'meditation_bell', label: 'Meditation Bell', desc: 'Warm resonance & decay' },
                      { id: 'gentle_pulse', label: 'Gentle Pulse', desc: 'Warm two-tone C5' },
                      { id: 'digital_soft', label: 'Digital Soft', desc: 'Discreet double blip' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleDefaultSoundTypeChange(item.id as HealthSoundType)}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          localConfig.defaultSoundType === item.id
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-700 dark:text-rose-300'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="font-semibold text-xs">{item.label}</div>
                        <div className="text-[10px] opacity-75">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium">
                    <span>Master Volume:</span>
                    <span className="font-mono">{Math.round((localConfig.globalVolume ?? 0.3) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={localConfig.globalVolume ?? 0.3}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                {/* Preview Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      previewSound(
                        localConfig.defaultSoundType || 'subtle_chime',
                        localConfig.globalVolume ?? 0.3
                      )
                    }
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test Sound Preview</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Add Custom Intervention */}
          {activeTab === 'add' && (
            <form onSubmit={handleCreateIntervention} className="space-y-3">
              {/* Presets shortcut buttons */}
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
                <span className="font-medium text-rose-800 dark:text-rose-300 block mb-1.5 text-[11px]">
                  Quick Fill from Preset:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'posture', label: '🪑 Posture Check' },
                    { id: 'hydration', label: '💧 Hydration Break' },
                    { id: 'movement', label: '🚶 Stand & Stretch' },
                    { id: 'session_warning', label: '⏱️ 90m Session Warning' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetFill(p.id as any)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-100/50 dark:hover:bg-rose-900/40 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Posture Reset"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Identifier (ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. posture_reset"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 dark:text-slate-300 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Roll shoulders and reset posture"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Interval (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={newIntervalMinutes}
                    onChange={(e) => setNewIntervalMinutes(parseInt(e.target.value) || 20)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-300 font-medium">Duration (Seconds)</label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={newDurationSeconds}
                    onChange={(e) => setNewDurationSeconds(parseInt(e.target.value) || 20)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 dark:text-slate-300 font-medium">Action Message *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Actionable, gentle guidance shown to the user"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('interventions')}
                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Save Intervention
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Health layer is isolated from AU calculation</span>
          </span>
          <button
            onClick={() => setIsHealthConfigModalOpen(false)}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
