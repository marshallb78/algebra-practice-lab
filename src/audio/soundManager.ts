/**
 * Sound & Music Manager for Matthew Clicker.
 * Uses downloaded MP3 tracks for background music:
 * - Normal gameplay: ./audio/chill_bgm.mp3 (Chill Wave)
 * - Matthew Storm Live Event: ./audio/storm_techno.mp3 (Crazy Epic Techno)
 * Plus low-latency Web Audio API procedural SFX for clicks, crits, and unlocks.
 */

export type MusicTrackMode = 'chill' | 'storm' | 's2_winter' | 's2_event' | 's2_cutscene' | 's2_mystery';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private tracks: Partial<Record<MusicTrackMode, HTMLAudioElement>> = {};
  private trackMultipliers: Partial<Record<MusicTrackMode, number>> = {};
  private currentTrackMode: MusicTrackMode = 's2_winter';
  private fadeRafId: number | null = null;
  private isFadedOutPaused: boolean = false;

  private isMuted: boolean = false;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.9;
  private musicVolume: number = 0.45;
  private isMusicPlaying: boolean = true;

  constructor() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const urls: Record<MusicTrackMode, string> = {
          chill: './audio/chill_bgm.mp3',
          storm: './audio/storm_techno.mp3',
          s2_winter: './audio/s2/s2_winter_bgm.mp3',
          s2_event: './audio/s2/s2_event_bgm.mp3',
          s2_cutscene: './audio/s2/s2_cutscene_bgm.mp3',
          s2_mystery: './audio/s2/s2_mystery_bgm.mp3',
        };
        (Object.keys(urls) as MusicTrackMode[]).forEach((key) => {
          const el = new Audio(urls[key]);
          el.loop = true;
          el.preload = key === 's2_winter' || key === 's2_cutscene' ? 'auto' : 'metadata';
          this.tracks[key] = el;
          this.trackMultipliers[key] = key === this.currentTrackMode ? 1 : 0;
        });

        this.syncAudioElementVolumes();

        const unlockAudio = () => {
          this.unlockAndEnsureAudio();
        };
        window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
        window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });
      } catch {
        // Ignore in headless test environments
      }
    }
  }

  private getTargetVolume(): number {
    return this.isMuted || !this.isMusicPlaying
      ? 0
      : Math.max(0, Math.min(1, this.masterVolume * this.musicVolume));
  }

  private syncAudioElementVolumes() {
    const base = this.getTargetVolume();
    (Object.keys(this.tracks) as MusicTrackMode[]).forEach((key) => {
      const el = this.tracks[key];
      if (!el) return;
      const mult = this.trackMultipliers[key] ?? (key === this.currentTrackMode ? 1 : 0);
      el.volume = Math.max(0, Math.min(1, base * mult));
    });
  }

  /**
   * Call directly inside a user gesture handler (e.g., PLAY button) to unlock Web Audio & BGM reliably.
   */
  public unlockAndEnsureAudio(preferredMode?: MusicTrackMode) {
    this.isFadedOutPaused = false;
    if (preferredMode) {
      this.currentTrackMode = preferredMode;
    }
    try {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore context resume error
    }
    this.ensureMusicPlaying(true);
  }

  /**
   * Smoothly fades out all active music over fadeMs milliseconds.
   */
  public fadeOutMusic(fadeMs = 950) {
    if (typeof window === 'undefined') return;
    if (this.fadeRafId !== null) {
      cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
    this.isFadedOutPaused = true;
    const startMultipliers = { ...this.trackMultipliers };
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / Math.max(80, fadeMs));
      const ease = 1 - t;
      (Object.keys(this.tracks) as MusicTrackMode[]).forEach((key) => {
        this.trackMultipliers[key] = (startMultipliers[key] ?? 0) * ease;
      });
      this.syncAudioElementVolumes();
      if (t < 1) {
        this.fadeRafId = requestAnimationFrame(step);
      } else {
        this.fadeRafId = null;
        Object.values(this.tracks).forEach((el) => el?.pause());
      }
    };
    this.fadeRafId = requestAnimationFrame(step);
  }

  public ensureMusicPlaying(withFadeIn = false) {
    if (typeof window === 'undefined') return;
    if (this.isFadedOutPaused) return;

    if (!this.isMusicPlaying || this.isMuted) {
      this.syncAudioElementVolumes();
      Object.values(this.tracks).forEach((el) => el?.pause());
      return;
    }

    const active = this.tracks[this.currentTrackMode];
    if (!active) return;

    // Crossfade smoothly between currently playing tracks and new target track
    if (this.fadeRafId !== null) {
      cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }

    const fadeMs = withFadeIn ? 900 : 1050;
    const startMultipliers: Partial<Record<MusicTrackMode, number>> = { ...this.trackMultipliers };
    const targetMode = this.currentTrackMode;
    const base = this.getTargetVolume();

    if (active.paused) {
      this.trackMultipliers[targetMode] = withFadeIn ? 0.02 : (startMultipliers[targetMode] ?? 0.05);
      active.volume = Math.max(0, Math.min(1, base * (this.trackMultipliers[targetMode] || 0)));
      active.play().catch(() => {
        // Autoplay blocked until next user gesture; keep multiplier ready
      });
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / fadeMs);
      (Object.keys(this.tracks) as MusicTrackMode[]).forEach((key) => {
        const el = this.tracks[key];
        if (!el) return;
        const from = startMultipliers[key] ?? (key === targetMode ? 0 : 0);
        const to = key === targetMode ? 1 : 0;
        const val = from + (to - from) * p;
        this.trackMultipliers[key] = val;
        if (key !== targetMode && p >= 1 && !el.paused) {
          el.pause();
          el.currentTime = 0;
        }
      });
      this.syncAudioElementVolumes();
      if (p < 1) {
        this.fadeRafId = requestAnimationFrame(tick);
      } else {
        this.fadeRafId = null;
      }
    };
    this.fadeRafId = requestAnimationFrame(tick);
  }

  public setMusicTrack(mode: MusicTrackMode, forceFadeIn = false) {
    this.isFadedOutPaused = false;
    if (this.currentTrackMode === mode && !forceFadeIn) {
      const active = this.tracks[mode];
      if (active && !active.paused) return;
      this.ensureMusicPlaying(true);
      return;
    }
    this.currentTrackMode = mode;
    this.ensureMusicPlaying(true);
  }

  private initContext() {
    this.ensureMusicPlaying();
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime
      );
    }
    this.syncAudioElementVolumes();
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public setMusicVolume(val: number) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    this.syncAudioElementVolumes();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime
      );
    }
    this.ensureMusicPlaying();
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getSettings() {
    return {
      masterVolume: this.masterVolume,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      isMuted: this.isMuted,
      isMusicPlaying: this.isMusicPlaying,
    };
  }

  // --- SOUND EFFECTS ---

  public playClick(combo = 1) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const pitchJitter = 0.95 + Math.random() * 0.1;
    const baseFreq = (300 + Math.min(combo * 15, 300)) * pitchJitter;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playCrit() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(580, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1100, this.ctx.currentTime + 0.18);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.22);
    osc2.stop(this.ctx.currentTime + 0.22);
  }

  public playBuy() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = this.ctx.currentTime + idx * 0.05;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  public playSkinUnlock() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    });
  }

  public playPrestige() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.4);
  }

  public playGoldenSpawn() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    [1000, 1200, 1500, 2000].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const t = this.ctx.currentTime + i * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playThunder() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 0.9);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.95);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.95);
  }

  public playCountdownTick(secondsLeft: number) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = 320 + (10 - Math.min(10, secondsLeft)) * 55;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  public playStormWaveStart() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    [220, 330, 440, 660, 880].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + idx * 0.07;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  public playGiantHit() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180 + Math.random() * 80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(65, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playChestOpen() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    [392, 493.88, 587.33, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + idx * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playTokenUnlock() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    [261.63, 329.63, 392, 523.25, 659.25, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + idx * 0.09;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  public playCutsceneBoom() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(115, t);
    sub.frequency.exponentialRampToValueAtTime(34, t + 1.15);
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
    sub.connect(g);
    g.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 1.25);
  }

  public toggleMusic(): boolean {
    this.isMusicPlaying = !this.isMusicPlaying;
    this.ensureMusicPlaying();
    return this.isMusicPlaying;
  }

  public startMusic() {
    this.isMusicPlaying = true;
    this.ensureMusicPlaying();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    this.ensureMusicPlaying();
  }
}

export const soundManager = new SoundManager();
