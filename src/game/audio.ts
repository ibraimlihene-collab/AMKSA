import type { Mood } from './types';

const backgroundMusic = new URL('../assets/audio/atlas-mountain-loop.mp3', import.meta.url).href;

class AE {
  ctx: AudioContext | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  on = false;
  mood: Mood = 'menu';
  private track: HTMLAudioElement | null = null;
  private pausedMusic = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.musicBus = this.ctx.createGain(); this.sfxBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.18; this.sfxBus.gain.value = 0.39;
      this.musicBus.connect(this.ctx.destination); this.sfxBus.connect(this.ctx.destination);
      // One streamed element avoids decoding the full recording into memory or stacking music on transitions.
      this.track = new Audio(backgroundMusic); this.track.loop = true; this.track.preload = 'none';
      this.ctx.createMediaElementSource(this.track).connect(this.musicBus);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  volume(music: number, sfx: number) {
    if (!this.ctx) return;
    this.musicBus!.gain.setTargetAtTime(Math.max(0, Math.min(1, music)) * 0.45, this.ctx.currentTime, 0.03);
    this.sfxBus!.gain.setTargetAtTime(Math.max(0, Math.min(1, sfx)) * 0.65, this.ctx.currentTime, 0.03);
  }

  private playTrack() {
    // Browsers can reject playback before a user gesture. Resume retries through the real game controls.
    void this.track?.play().catch((error: DOMException) => {
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') console.warn('Background music could not start.', error);
    });
  }

  music(m: Mood = 'menu') {
    this.init(); this.mood = m; this.on = true; this.pausedMusic = false; this.playTrack();
  }
  startSong() { this.music('menu'); }
  stopSong() { this.stop(); }

  pause() {
    this.pausedMusic = this.pausedMusic || this.on; this.on = false;
    this.track?.pause();
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }
  resume() {
    if (!this.pausedMusic) return;
    this.init(); this.pausedMusic = false; this.on = true; this.playTrack();
  }
  stop() {
    this.on = false; this.pausedMusic = false;
    if (this.track) { this.track.pause(); this.track.currentTime = 0; }
  }

  b(f: number, d: number, t: OscillatorType, v: number, dl = 0) { if (!this.ctx) return; const tm = this.ctx.currentTime + dl; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = t; o.frequency.setValueAtTime(f, tm); g.gain.setValueAtTime(v, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + d); o.connect(g); g.connect(this.sfxBus!); o.start(tm); o.stop(tm + d); }
  jump() { this.b(190, 0.1, 'square', 0.04); this.b(320, 0.08, 'square', 0.025, 0.03); }
  land() { this.b(120, 0.06, 'triangle', 0.03); }
  dash() { this.b(380, 0.12, 'sawtooth', 0.05); }
  throwS() { this.b(440, 0.08, 'sine', 0.05); }
  rockHit() { this.b(170, 0.08, 'sawtooth', 0.08); this.b(90, 0.1, 'sawtooth', 0.05, 0.02); }
  hurt() { this.b(150, 0.22, 'sawtooth', 0.1); this.b(80, 0.28, 'square', 0.07, 0.02); }
  enemyH() { this.b(250, 0.07, 'square', 0.06); }
  punch() { this.b(140, 0.08, 'sawtooth', 0.06); this.b(90, 0.1, 'square', 0.04, 0.02); }
  collect() { this.b(760, 0.07, 'square', 0.05); this.b(1140, 0.09, 'square', 0.04, 0.05); }
  task() { this.b(523, 0.1, 'triangle', 0.06); this.b(784, 0.16, 'triangle', 0.06, 0.09); }
  portal() { this.b(330, 0.25, 'sine', 0.06); this.b(494, 0.35, 'sine', 0.05, 0.1); this.b(660, 0.5, 'sine', 0.04, 0.2); }
  sheep() { this.b(230, 0.16, 'sawtooth', 0.04); this.b(180, 0.18, 'sawtooth', 0.03, 0.07); }
}
export const A = new AE();
