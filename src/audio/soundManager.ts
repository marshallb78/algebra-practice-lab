/**
 * Sound & Music Manager for Matthew Clicker.
 * Uses downloaded MP3 tracks for background music:
 * - Normal gameplay: ./audio/chill_bgm.mp3 (Chill Wave)
 * - Matthew Storm Live Event: ./audio/storm_techno.mp3 (Crazy Epic Techno)
 * Plus low-latency Web Audio API procedural SFX for clicks, crits, and unlocks.
 */

export type MusicTrackMode =
  | 'chill'
  | 'storm'
  | 's2_winter'
  | 's2_event'
  | 's2_cutscene'
  | 's2_mystery'
  | 's3_downtime'
  | 's3_marvel'
  | 's3_event';

const S3_MODES = new Set<MusicTrackMode>(['s3_downtime', 's3_marvel', 's3_event']);

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private tracks: Partial<Record<MusicTrackMode, HTMLAudioElement>> = {};
  private trackMultipliers: Partial<Record<MusicTrackMode, number>> = {};
  private currentTrackMode: MusicTrackMode = 's3_marvel';
  private fadeRafId: number | null = null;
  private isFadedOutPaused: boolean = false;
  private s3MusicTimer: ReturnType<typeof setInterval> | null = null;
  private s3StepIndex: number = 0;

  private isMuted: boolean = false;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.9;
  private musicVolume: number = 0.45;
  private isMusicPlaying: boolean = true;

  constructor() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const urls: Partial<Record<MusicTrackMode, string>> = {
          chill: './audio/chill_bgm.mp3',
          storm: './audio/storm_techno.mp3',
          s2_winter: './audio/s2/s2_winter_bgm.mp3',
          s2_event: './audio/s2/s2_event_bgm.mp3',
          s2_cutscene: './audio/s2/s2_cutscene_bgm.mp3',
          s2_mystery: './audio/s2/s2_mystery_bgm.mp3',
          s3_downtime: './audio/s3/avengers_theme.mp3',
          s3_marvel: './audio/s3/avengers_theme.mp3',
          s3_event: './audio/s3/avengers_theme.mp3',
        };
        (Object.keys(urls) as MusicTrackMode[]).forEach((key) => {
          const url = urls[key];
          if (!url) return;
          const el = new Audio(url);
          el.loop = true;
          el.preload = key === 's3_marvel' || key === 's3_downtime' ? 'auto' : 'metadata';
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

  private stopS3SynthLoop() {
    if (this.s3MusicTimer !== null) {
      clearInterval(this.s3MusicTimer);
      this.s3MusicTimer = null;
    }
  }

  private playSynthTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    gainVal: number,
    filterCutoff?: number,
    attackSec = 0.16,
    detuneCents = 0
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted || this.musicVolume <= 0) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc1.type = type;
    osc1.frequency.setValueAtTime(freq, now);

    const scaledGain = Math.max(0.0001, gainVal * this.musicVolume * 0.35);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(scaledGain, now + attackSec);
    g.gain.setValueAtTime(scaledGain * 0.85, now + Math.max(attackSec, durationSec * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    const targetNode: AudioNode = (() => {
      if (!filterCutoff || !this.ctx) return g;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.setValueAtTime(1.2, now);
      filt.frequency.setValueAtTime(filterCutoff * 0.6, now);
      filt.frequency.linearRampToValueAtTime(filterCutoff, now + attackSec);
      filt.frequency.exponentialRampToValueAtTime(Math.max(220, filterCutoff * 0.55), now + durationSec);
      filt.connect(g);
      return filt;
    })();

    osc1.connect(targetNode);
    if (detuneCents !== 0) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = type;
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(detuneCents, now);
      osc2.connect(targetNode);
      osc2.start(now);
      osc2.stop(now + durationSec + 0.05);
    }

    g.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + durationSec + 0.05);
  }

  private playTimpaniHit(freqStart = 115, gainVal = 0.32) {
    if (!this.ctx || !this.masterGain || this.isMuted || this.musicVolume <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.24);
    const vol = Math.max(0.0001, gainVal * this.musicVolume * 0.45);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  private ensureS3SynthLoop() {
    if (typeof window === 'undefined' || !this.ctx || this.ctx.state !== 'running') return;
    if (this.s3MusicTimer !== null) return;

    // Real Heroic Avengers-Style Marvel Anthem: driving 8th-note ostinato + sweeping French horn brass melody
    const eighthMs = this.currentTrackMode === 's3_downtime' ? 290 : this.currentTrackMode === 's3_event' ? 200 : 235;

    const bars = [
      { bass: 82.41, stringRoot: 164.81, stringFifth: 246.94, melody: [329.63, 0, 0, 493.88, 0, 440.0, 392.0, 369.99] },
      { bass: 98.0, stringRoot: 196.0, stringFifth: 293.66, melody: [329.63, 0, 0, 493.88, 0, 523.25, 587.33, 493.88] },
      { bass: 73.42, stringRoot: 146.83, stringFifth: 220.0, melody: [440.0, 0, 392.0, 369.99, 0, 329.63, 392.0, 440.0] },
      { bass: 65.41, stringRoot: 130.81, stringFifth: 196.0, melody: [493.88, 0, 523.25, 587.33, 0, 659.25, 587.33, 493.88] },
    ];
    const downtimeBars = [
      { bass: 82.41, stringRoot: 164.81, stringFifth: 246.94, melody: [329.63, 0, 0, 0, 493.88, 0, 440.0, 0] },
      { bass: 65.41, stringRoot: 130.81, stringFifth: 196.0, melody: [392.0, 0, 0, 0, 523.25, 0, 493.88, 0] },
      { bass: 55.0, stringRoot: 110.0, stringFifth: 164.81, melody: [440.0, 0, 0, 0, 392.0, 0, 329.63, 0] },
      { bass: 61.74, stringRoot: 123.47, stringFifth: 185.0, melody: [369.99, 0, 0, 0, 493.88, 0, 329.63, 0] },
    ];

    this.s3MusicTimer = setInterval(() => {
      if (this.isMuted || !this.isMusicPlaying || this.isFadedOutPaused || !S3_MODES.has(this.currentTrackMode)) {
        this.stopS3SynthLoop();
        return;
      }
      if (!this.ctx || this.ctx.state !== 'running') return;
      const mode = this.currentTrackMode;
      const step = this.s3StepIndex++;
      const list = mode === 's3_downtime' ? downtimeBars : bars;
      const bar = list[Math.floor(step / 8) % list.length];
      const sub = step % 8;

      if (sub === 0) {
        this.playSynthTone(bar.bass, eighthMs * 0.0085, 'sawtooth', 0.28, 360, 0.06, 6);
        this.playTimpaniHit(115, mode === 's3_downtime' ? 0.24 : 0.42);
      } else if (sub === 3 || sub === 6) {
        this.playTimpaniHit(96, 0.22);
      }

      if (mode !== 's3_downtime' || sub % 2 === 0) {
        const ostFreq = sub % 2 === 0 ? bar.stringRoot : bar.stringFifth;
        this.playSynthTone(ostFreq, eighthMs * 0.0011, 'triangle', 0.11, 950, 0.02, 5);
      }

      const hornNote = bar.melody[sub];
      if (hornNote > 0) {
        const dur = sub === 0 || sub === 3 ? eighthMs * 0.0032 : eighthMs * 0.0018;
        this.playSynthTone(hornNote, dur, 'sawtooth', 0.19, 1380, 0.04, 9);
        this.playSynthTone(hornNote * 0.5, dur, 'sawtooth', 0.12, 920, 0.05, -7);
      }
    }, eighthMs);
  }

  public ensureMusicPlaying(withFadeIn = false) {
    if (typeof window === 'undefined') return;
    if (this.isFadedOutPaused) return;

    if (!this.isMusicPlaying || this.isMuted) {
      this.stopS3SynthLoop();
      this.syncAudioElementVolumes();
      Object.values(this.tracks).forEach((el) => el?.pause());
      return;
    }

    this.stopS3SynthLoop();
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
    if (S3_MODES.has(mode)) {
      this.stopS3SynthLoop();
    }
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
    const now = this.ctx.currentTime;

    // Punchy Stark kinetic thump + crisp metallic tick
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    const pitchJitter = 0.96 + Math.random() * 0.08;
    const baseFreq = (220 + Math.min(combo * 10, 220)) * pitchJitter;

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(baseFreq, now);
    sub.frequency.exponentialRampToValueAtTime(85, now + 0.065);
    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.075);

    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(baseFreq * 2.4, now);
    ping.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.04);
    pingGain.gain.setValueAtTime(0.11, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    ping.connect(pingGain);
    pingGain.connect(this.sfxGain);
    ping.start(now);
    ping.stop(now + 0.05);
  }

  public playCrit() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Repulsor energy blast + harmonic cosmic fifth shimmer
    [523.25, 783.99, 1046.5].forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.85, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, now + 0.16);
      gain.gain.setValueAtTime(idx === 0 ? 0.16 : 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  public playBuy() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = this.ctx.currentTime + idx * 0.04;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  public playSkinUnlock() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const chord = [261.63, 392.0, 523.25, 659.25, 783.99];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t0 = now + idx * 0.04;
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.72);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t0);
      osc.stop(t0 + 0.75);
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
