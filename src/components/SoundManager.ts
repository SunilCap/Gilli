/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext is initialized lazily on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainStart: number = 0.1,
    gainEnd: number = 0.001
  ) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
      
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
      }

      gainNode.gain.setValueAtTime(gainStart, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(gainEnd, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  public playPaddleHit() {
    // Cool pitch sweep upwards
    this.playTone(150, 300, 0.15, 'triangle', 0.2);
  }

  public playWallHit() {
    // Quick solid blip
    this.playTone(120, 100, 0.08, 'sine', 0.15);
  }

  public playBrickHit() {
    // High pluck
    this.playTone(600, 800, 0.06, 'sine', 0.1);
  }

  public playBrickDestroy(strength: number) {
    // Explosive tone depending on strength
    const freq = 400 - strength * 50;
    this.playTone(freq, 80, 0.25, 'sawtooth', 0.15);
  }

  public playPowerUpCollect() {
    // Ascending major chord
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((note, i) => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = note;
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } catch (e) {}
      }, i * 80);
    });
  }

  public playLoseLife() {
    // Descending sad drone
    this.playTone(220, 55, 0.5, 'triangle', 0.25);
  }

  public playLaserShoot() {
    // Fast high to low laser sound
    this.playTone(880, 220, 0.12, 'sawtooth', 0.08);
  }

  public playLevelUp() {
    // Triumphant arpeggio
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [349.23, 440.00, 523.25, 698.46, 880.00]; // F4, A4, C5, F5, A5
    notes.forEach((note, i) => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = note;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch (e) {}
      }, i * 100);
    });
  }

  public playVictory() {
    // Huge major chord progression
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const chords = [
      [261.63, 329.63, 392.00], // C
      [293.66, 349.23, 440.00], // Dm
      [349.23, 440.00, 523.25], // F
      [523.25, 659.25, 783.99]  // C
    ];

    chords.forEach((chord, chordIdx) => {
      setTimeout(() => {
        chord.forEach(note => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = note;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.45);
          } catch (e) {}
        });
      }, chordIdx * 250);
    });
  }
}

export const sound = new SoundManager();
