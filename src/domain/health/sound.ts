import { HealthSoundType, InterventionSoundConfig } from './types';

let cachedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtxClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!cachedAudioCtx || cachedAudioCtx.state === 'closed') {
      cachedAudioCtx = new AudioCtxClass();
    }
    if (cachedAudioCtx.state === 'suspended') {
      cachedAudioCtx.resume().catch(() => {});
    }
    return cachedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthesizes a pure harmonic chime/tone using Web Audio API.
 * Completely client-side, zero external asset downloads or network latency.
 */
export function playSynthesizedPreset(
  preset: HealthSoundType = 'subtle_chime',
  volume = 0.3
): void {
  if (preset === 'none') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const masterGain = ctx.createGain();
    const clampedVolume = Math.max(0, Math.min(1, volume));
    masterGain.gain.setValueAtTime(clampedVolume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (preset) {
      case 'meditation_bell': {
        // Singing bowl style: fundamental 440Hz with 880Hz overtone and slow decay
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.7, now + 0.04);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 1.25);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now);
        osc2.stop(now + 0.85);
        break;
      }

      case 'gentle_pulse': {
        // G4 (392Hz) stepping up to C5 (523.25Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(392, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.6, now + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(523.25, now + 0.08);
        gain2.gain.setValueAtTime(0.0001, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.65, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.5);
        break;
      }

      case 'digital_soft': {
        // High-tech discreet double pip
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(784, now);
        gain1.gain.setValueAtTime(0.5, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.06);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, now + 0.07);
        gain2.gain.setValueAtTime(0.0001, now + 0.07);
        gain2.gain.exponentialRampToValueAtTime(0.55, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.07);
        osc2.stop(now + 0.18);
        break;
      }

      case 'subtle_chime':
      default: {
        // Soft dual chime: 528Hz (C5 solfeggio) + 660Hz (E5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(528, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.5);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(660, now + 0.06);
        gain2.gain.setValueAtTime(0.0001, now + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.5, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.06);
        osc2.stop(now + 0.65);
        break;
      }
    }
  } catch (err) {
    // Gracefully ignore any audio context restriction
  }
}

/**
 * Plays sound according to intervention config and global preferences.
 * Supports custom audio file URL with seamless synthesizer fallback.
 */
export function playSound(
  soundConfig?: InterventionSoundConfig,
  globalVolume = 0.3,
  globalSoundEnabled = true
): void {
  if (!globalSoundEnabled) return;
  if (!soundConfig || !soundConfig.enabled) return;
  if (soundConfig.type === 'none') return;

  const targetVolume =
    typeof soundConfig.volume === 'number' ? soundConfig.volume : globalVolume;

  if (soundConfig.type === 'custom_url' && soundConfig.customAudioUrl) {
    try {
      const audio = new Audio(soundConfig.customAudioUrl);
      audio.volume = Math.max(0, Math.min(1, targetVolume));
      audio.play().catch(() => {
        // Fallback to default synthesized chime if audio file fails to load or play
        playSynthesizedPreset('subtle_chime', targetVolume);
      });
      return;
    } catch {
      playSynthesizedPreset('subtle_chime', targetVolume);
      return;
    }
  }

  playSynthesizedPreset(soundConfig.type || 'subtle_chime', targetVolume);
}

/**
 * Test preview helper used in Settings UI.
 */
export function previewSound(
  type: HealthSoundType = 'subtle_chime',
  volume = 0.3,
  customAudioUrl?: string
): void {
  playSound({ enabled: true, type, volume, customAudioUrl }, volume, true);
}

export const HealthSoundService = {
  playTone: (type: HealthSoundType, volume = 0.3): Promise<void> => {
    playSynthesizedPreset(type, volume);
    return Promise.resolve();
  },
  playSound,
  previewSound,
  getSoundPresets: () => [
    { id: 'subtle_chime', name: 'Subtle Chime' },
    { id: 'meditation_bell', name: 'Meditation Bell' },
    { id: 'gentle_pulse', name: 'Gentle Pulse' },
    { id: 'digital_soft', name: 'Digital Soft' },
    { id: 'none', name: 'None (Mute)' },
  ],
};
