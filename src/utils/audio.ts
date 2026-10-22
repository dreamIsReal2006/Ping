/**
 * Combines the bundled music/button audio with procedural gameplay sound effects.
 */

export type SoundPack = 'decompression' | 'crystal' | 'tactile' | 'cyber';
type MusicTrack = 'home' | 'game' | 'none';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private soundPack: SoundPack = 'decompression';
  private musicAudio: HTMLAudioElement | null = null;
  private gameMusicAudio: HTMLAudioElement | null = null;
  private gameOverAudio: HTMLAudioElement | null = null;
  private activeMusicAudio: HTMLAudioElement | null = null;
  private buttonAudio: HTMLAudioElement | null = null;
  private musicFadeTimer: number | null = null;
  private musicTransitionId = 0;
  private desiredTrack: MusicTrack = 'none';

  constructor() {
    // AudioContext playback is resumed on launch or the first user interaction.
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    const desiredTrack = this.desiredTrack;
    this.isMuted = muted;
    if (muted) {
      this.pauseAudio();
    } else if (desiredTrack !== 'none') {
      this.startTrack(desiredTrack);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setSoundPack(pack: SoundPack) {
    this.soundPack = pack;
  }

  public getSoundPack(): SoundPack {
    return this.soundPack;
  }

  public startMusic() {
    this.startTrack('home');
  }

  public startGameMusic() {
    this.startTrack('game');
  }

  public resumeMusic() {
    if (this.desiredTrack !== 'none') this.startTrack(this.desiredTrack);
  }

  private startTrack(track: Exclude<MusicTrack, 'none'>) {
    this.desiredTrack = track;
    if (this.isMuted) return;

    const audio = track === 'home' ? this.getMusicAudio() : this.getGameMusicAudio();
    const transitionId = ++this.musicTransitionId;
    if (this.musicFadeTimer !== null) {
      window.clearInterval(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
    if (this.activeMusicAudio && this.activeMusicAudio !== audio) {
      this.activeMusicAudio.pause();
      this.activeMusicAudio.volume = 0;
    }
    this.gameOverAudio?.pause();
    this.activeMusicAudio = audio;
    audio.loop = true;
    if (!audio.paused) {
      this.fadeMusic(audio, 0.55, 900);
      return;
    }
    audio.volume = 0;
    void audio.play().then(() => {
      if (transitionId !== this.musicTransitionId) return;
      this.fadeMusic(audio, 0.55, 900);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      console.warn(`Unable to play ${track} background music.`, error);
    });
  }

  public playGameOver() {
    this.desiredTrack = 'none';
    this.musicTransitionId += 1;
    if (this.musicFadeTimer !== null) {
      window.clearInterval(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
    if (this.activeMusicAudio) {
      this.activeMusicAudio.pause();
      this.activeMusicAudio.currentTime = 0;
      this.activeMusicAudio.volume = 0;
      this.activeMusicAudio = null;
    }
    if (this.isMuted) return;
    if (!this.gameOverAudio) {
      this.gameOverAudio = new Audio('/audio/gamefailed.m4a');
      this.gameOverAudio.preload = 'auto';
    }
    this.gameOverAudio.pause();
    this.gameOverAudio.currentTime = 0;
    this.gameOverAudio.loop = false;
    this.gameOverAudio.volume = 0.85;
    void this.gameOverAudio.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        console.warn('Unable to play game-over audio.', error);
      }
    });
  }

  public stopMusic() {
    this.desiredTrack = 'none';
    this.pauseAudio();
  }

  private pauseAudio() {
    this.musicTransitionId += 1;
    if (this.musicFadeTimer !== null) {
      window.clearInterval(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
    if (this.activeMusicAudio) {
      const audio = this.activeMusicAudio;
      this.fadeMusic(audio, 0, 320, () => {
        audio.pause();
        if (this.activeMusicAudio === audio) this.activeMusicAudio = null;
      });
    }
    this.gameOverAudio?.pause();
  }

  private getMusicAudio() {
    if (!this.musicAudio) {
      this.musicAudio = new Audio('/audio/infinity-space.m4a');
      this.musicAudio.preload = 'auto';
      this.musicAudio.loop = true;
    }
    return this.musicAudio;
  }

  private getGameMusicAudio() {
    if (!this.gameMusicAudio) {
      this.gameMusicAudio = new Audio('/audio/gameon.m4a');
      this.gameMusicAudio.preload = 'auto';
      this.gameMusicAudio.loop = true;
    }
    return this.gameMusicAudio;
  }

  private fadeMusic(
    audio: HTMLAudioElement,
    targetVolume: number,
    durationMs: number,
    onComplete?: () => void
  ) {
    if (!audio) return;
    if (this.musicFadeTimer !== null) window.clearInterval(this.musicFadeTimer);

    const startVolume = audio.volume;
    const startedAt = performance.now();
    this.musicFadeTimer = window.setInterval(() => {
      const progress = Math.min((performance.now() - startedAt) / durationMs, 1);
      audio.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress === 1) {
        if (this.musicFadeTimer !== null) window.clearInterval(this.musicFadeTimer);
        this.musicFadeTimer = null;
        onComplete?.();
      }
    }, 24);
  }

  public playButton() {
    if (this.isMuted) return;
    try {
      if (!this.buttonAudio) {
        this.buttonAudio = new Audio('/audio/button.m4a');
        this.buttonAudio.preload = 'auto';
      }
      const audio = this.buttonAudio.cloneNode() as HTMLAudioElement;
      audio.volume = 0.7;
      void audio.play().catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
          console.warn('Unable to play button sound.', error);
        }
      });
    } catch (error) {
      console.warn('Unable to initialize button sound.', error);
    }
  }

  /**
   * Sound played when user successfully hits a circle
   * Pitch slightly modulates upward with combo for rewarding progression
   */
  public playHit(combo: number = 0, judgment: 'PERFECT' | 'GREAT' | 'GOOD' = 'PERFECT') {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const baseFreqMultiplier = Math.min(1 + (combo % 20) * 0.04, 1.8);
      const qualityBoost = judgment === 'PERFECT' ? 1.15 : judgment === 'GREAT' ? 1.0 : 0.9;

      if (this.soundPack === 'decompression') {
        // Soft bubble pop with warm sub-bass punch
        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const subGain = this.ctx.createGain();

        const baseFreq = 380 * baseFreqMultiplier * qualityBoost;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * 1.5, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.12);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(120, now);
        subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
        subOsc.start(now);
        subOsc.stop(now + 0.19);
      } else if (this.soundPack === 'crystal') {
        // Pure crystal chime with harmonic shimmer
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const baseFreq = 523.25 * baseFreqMultiplier * qualityBoost; // C5

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 2.756, now); // Metallic chime ratio

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.36);
        osc2.stop(now + 0.36);
      } else if (this.soundPack === 'tactile') {
        // Mechanical switch click + short airy snap
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800 * baseFreqMultiplier, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.06);
      } else {
        // Cyber pulse
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240 * baseFreqMultiplier, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.17);
      }
    } catch {
      // Audio playback failsafe
    }
  }

  /**
   * Special hit for multi-tap double-ring targets
   */
  public playDoubleTap() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Gentle, non-punishing game over tone (decompression philosophy)
   */
  public playMiss() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    } catch {
      // Audio failsafe
    }
  }

  /**
   * UI Click / Start Button Sound
   */
  public playStart() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.22); // D5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Audio failsafe
    }
  }
}

export const soundManager = new SoundEngine();
