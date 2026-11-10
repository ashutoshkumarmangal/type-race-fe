/**
 * Web Audio API synthesizer for TypeRush.
 * Provides:
 * 1. An energetic arcade racing music / ringtone loop during the race.
 * 2. Realistic tire screech / brake sound effect on wrong keystrokes,
 *    ducking the music momentarily and bringing it right back.
 * 3. Volume / Mute control with localStorage persistence.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private schedulerTimer: number | null = null;
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private listeners: Set<(muted: boolean) => void> = new Set();

  // Noise buffer for drums and brake screech
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('typerush.sound_muted');
      this.isMuted = saved === 'true';

      // Auto-unlock AudioContext on first user interaction anywhere on the page
      const unlock = () => {
        this.ensureContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  public subscribe(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.isMuted));
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('typerush.sound_muted', String(this.isMuted));
    }
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, now);
    }
    this.notify();
    return this.isMuted;
  }

  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      // Music Gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.masterGain);

      // SFX Gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.65;
      this.sfxGain.connect(this.masterGain);

      // Create 1 second of stereo white noise
      const bufferSize = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Starts the driving arcade racing ringtone/music.
   * Continuous loop scheduled with high-precision Web Audio clock.
   */
  public startRaceMusic() {
    if (this.isMusicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isMusicPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    // Fade music in
    if (this.musicGain) {
      const now = ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(0, now);
      this.musicGain.gain.linearRampToValueAtTime(0.32, now + 0.4);
    }

    // Lookahead scheduler
    const scheduleAheadTime = 0.15; // Schedule 150ms ahead
    const lookaheadInterval = 30; // Check every 30ms

    const tempo = 138; // Upbeat racing BPM
    const stepDuration = 60 / tempo / 4; // 16th note (~108ms)

    const scheduler = () => {
      if (!this.isMusicPlaying || !this.ctx) return;

      while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
        this.scheduleStep(this.currentStep % 32, this.nextNoteTime, stepDuration);
        this.nextNoteTime += stepDuration;
        this.currentStep++;
      }

      this.schedulerTimer = window.setTimeout(scheduler, lookaheadInterval);
    };

    scheduler();
  }

  /**
   * Stops the race music smoothly with a gentle fade-out.
   */
  public stopRaceMusic() {
    if (!this.isMusicPlaying) return;
    this.isMusicPlaying = false;

    if (this.schedulerTimer !== null) {
      window.clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0.001, now + 0.35);
    }
  }

  /**
   * Plays a realistic tire screech / braking sound when typing a wrong letter.
   * Momentarily ducks the race music and then smoothly brings it right back up.
   */
  public playBrakeSound() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // 1. Duck the race music so the brake screech takes center stage
    if (this.musicGain && this.isMusicPlaying) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      // Dip down immediately
      this.musicGain.gain.linearRampToValueAtTime(0.06, now + 0.04);
      // Ramp back up to full race music volume after the screech finishes (~320ms)
      this.musicGain.gain.linearRampToValueAtTime(0.32, now + 0.36);
    }

    // 2. Synthesize the tire/brake friction screech
    // Screech friction noise generator
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    // Bandpass resonant filter (emulates tire friction slip-stick frequency)
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(8, now);
    // Slide frequency down from 3200Hz to 1400Hz (deceleration pitch drop)
    bandpass.frequency.setValueAtTime(3200, now);
    bandpass.frequency.exponentialRampToValueAtTime(1400, now + 0.3);

    // Friction vibrato LFO (fast tire wobble against pavement)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(32, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(450, now);
    lfo.connect(lfoGain);
    lfoGain.connect(bandpass.frequency);

    // Metallic squeal oscillator (brake pad friction tone)
    const squealOsc = ctx.createOscillator();
    squealOsc.type = 'sawtooth';
    squealOsc.frequency.setValueAtTime(1050, now);
    squealOsc.frequency.exponentialRampToValueAtTime(620, now + 0.28);

    const squealGain = ctx.createGain();
    squealGain.gain.setValueAtTime(0.09, now);
    squealGain.gain.linearRampToValueAtTime(0.14, now + 0.06);
    squealGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    squealOsc.connect(squealGain);

    // Overall screech envelope
    const brakeEnvelope = ctx.createGain();
    brakeEnvelope.gain.setValueAtTime(0, now);
    brakeEnvelope.gain.linearRampToValueAtTime(0.75, now + 0.03); // Quick sharp bite
    brakeEnvelope.gain.setValueAtTime(0.65, now + 0.16);
    brakeEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.34); // Fade out

    noiseSource.connect(bandpass);
    bandpass.connect(brakeEnvelope);
    squealGain.connect(brakeEnvelope);
    brakeEnvelope.connect(this.sfxGain);

    lfo.start(now);
    squealOsc.start(now);
    noiseSource.start(now);

    lfo.stop(now + 0.35);
    squealOsc.stop(now + 0.35);
    noiseSource.stop(now + 0.35);
  }

  /**
   * Sound effect on race finish (victory chime).
   */
  public playFinishSound() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const chords = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.55);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.6);
    });
  }

  // -------------------------------------------------------------
  // Internal music synthesizers (bass, arpeggio lead, drum beats)
  // -------------------------------------------------------------

  private scheduleStep(step: number, time: number, stepDuration: number) {
    if (!this.ctx || !this.musicGain) return;

    // 1. Driving Bassline (16th notes with punchy filter envelope)
    // 2-bar progression in D minor: D2 -> D2 -> F2 -> G2 -> A2 -> G2 -> F2 -> C2
    const bassScale = [
      73.42, 73.42, 73.42, 73.42, 87.31, 87.31, 98.0, 98.0, // Bar 1 (steps 0-7)
      73.42, 73.42, 73.42, 73.42, 87.31, 98.0, 110.0, 110.0, // (steps 8-15)
      110.0, 110.0, 98.0, 98.0, 87.31, 87.31, 73.42, 73.42, // Bar 2 (steps 16-23)
      65.41, 65.41, 87.31, 87.31, 98.0, 98.0, 110.0, 110.0, // (steps 24-31)
    ];

    const bassFreq = bassScale[step];
    if (bassFreq) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassFreq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, time);
      filter.frequency.exponentialRampToValueAtTime(160, time + stepDuration * 0.85);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.88);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + stepDuration * 0.9);
    }

    // 2. High-Energy Arpeggio Lead (8-bit / 16-bit arcade racing melody)
    const arpNotes = [
      293.66, 349.23, 440.0, 523.25, 587.33, 523.25, 440.0, 349.23, // D4 F4 A4 C5 D5 C5 A4 F4
      349.23, 440.0, 523.25, 587.33, 698.46, 587.33, 523.25, 440.0, // F4 A4 C5 D5 F5 D5 C5 A4
      392.0, 440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0, // G4 A4 C5 D5 E5 D5 C5 A4
      440.0, 523.25, 587.33, 698.46, 783.99, 698.46, 587.33, 523.25, // A4 C5 D5 F5 G5 F5 D5 C5
    ];

    const leadFreq = arpNotes[step];
    if (leadFreq) {
      const leadOsc = this.ctx.createOscillator();
      const leadFilter = this.ctx.createBiquadFilter();
      const leadGain = this.ctx.createGain();

      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(leadFreq, time);

      leadFilter.type = 'lowpass';
      leadFilter.frequency.setValueAtTime(2400, time);

      leadGain.gain.setValueAtTime(0.045, time);
      leadGain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.75);

      leadOsc.connect(leadFilter);
      leadFilter.connect(leadGain);
      leadGain.connect(this.musicGain);

      leadOsc.start(time);
      leadOsc.stop(time + stepDuration * 0.8);
    }

    // 3. Racing Drums
    // Kick on beats 0, 4, 8, 12, 16, 20, 24, 28
    if (step % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();

      kickOsc.frequency.setValueAtTime(140, time);
      kickOsc.frequency.exponentialRampToValueAtTime(38, time + 0.08);

      kickGain.gain.setValueAtTime(0.3, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);

      kickOsc.start(time);
      kickOsc.stop(time + 0.1);
    }

    // Snare / Clap on beats 4, 12, 20, 28
    if (step % 8 === 4 && this.noiseBuffer) {
      const snareNoise = this.ctx.createBufferSource();
      snareNoise.buffer = this.noiseBuffer;
      const snareFilter = this.ctx.createBiquadFilter();
      snareFilter.type = 'highpass';
      snareFilter.frequency.setValueAtTime(1100, time);
      const snareGain = this.ctx.createGain();

      snareGain.gain.setValueAtTime(0.18, time);
      snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      snareNoise.connect(snareFilter);
      snareFilter.connect(snareGain);
      snareGain.connect(this.musicGain);

      snareNoise.start(time);
      snareNoise.stop(time + 0.13);
    }

    // Hi-hat on off-beats (steps 2, 6, 10, 14, 18, 22, 26, 30)
    if (step % 2 === 1 && this.noiseBuffer) {
      const hatSource = this.ctx.createBufferSource();
      hatSource.buffer = this.noiseBuffer;
      const hatFilter = this.ctx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(6500, time);
      const hatGain = this.ctx.createGain();

      hatGain.gain.setValueAtTime(0.06, time);
      hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      hatSource.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(this.musicGain);

      hatSource.start(time);
      hatSource.stop(time + 0.04);
    }
  }
}

export const soundEngine = new SoundEngine();
