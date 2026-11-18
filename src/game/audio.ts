import type { Mood } from './types';

const backgroundMusic = new URL('../assets/audio/atlas-mountain-loop.mp3', import.meta.url).href;

/**
 * Interactive music states. The supplied Atlas recording is the only recorded music.
 * State changes filter and level it, and add a synthesised frame-drum pulse and drone.
 * Every other sound in this file is synthesised; none of it claims to be a field recording.
 */
export type MusicState = 'menu' | 'explore' | 'puzzle' | 'warning' | 'chase' | 'rescue' | 'shelter' | 'ending';
export type Surface = 'dirt' | 'rock' | 'wood' | 'snow';
const MIX: Record<MusicState, { track: number; cutoff: number; drum: number; tempo: number; drone: number }> = {
  menu: { track: 1, cutoff: 18000, drum: 0, tempo: 0, drone: 0 },
  explore: { track: 0.85, cutoff: 9000, drum: 0, tempo: 0, drone: 0.02 },
  puzzle: { track: 0.45, cutoff: 1400, drum: 0, tempo: 0, drone: 0.05 },
  warning: { track: 0.55, cutoff: 2400, drum: 0.5, tempo: 0.75, drone: 0.08 },
  chase: { track: 0.7, cutoff: 6000, drum: 0.9, tempo: 0.42, drone: 0.1 },
  rescue: { track: 1, cutoff: 14000, drum: 0, tempo: 0, drone: 0 },
  shelter: { track: 0.5, cutoff: 1800, drum: 0.15, tempo: 1.2, drone: 0.04 },
  ending: { track: 1, cutoff: 18000, drum: 0, tempo: 0, drone: 0 },
};
const AMBIENCE: Record<Mood, { wind: number; water: number; birds: number }> = {
  menu: { wind: 0, water: 0, birds: 0 }, cedar: { wind: 0.05, water: 0, birds: 1 }, pasture: { wind: 0.09, water: 0, birds: 0.6 },
  gorge: { wind: 0.04, water: 0.12, birds: 0.3 }, snow: { wind: 0.16, water: 0, birds: 0 },
};

class AE {
  ctx: AudioContext | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  on = false;
  mood: Mood = 'menu';
  state: MusicState = 'menu';
  private track: HTMLAudioElement | null = null;
  private pausedMusic = false;
  private trackGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private drumGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private drumTimer: ReturnType<typeof setTimeout> | null = null;
  private birdTimer: ReturnType<typeof setTimeout> | null = null;
  private tempo = 0;

  init() {
    if (!this.ctx) {
      const ctx = this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain();
      this.musicBus.gain.value = 0.18; this.sfxBus.gain.value = 0.39;
      this.musicBus.connect(ctx.destination); this.sfxBus.connect(ctx.destination);
      // One streamed element avoids decoding the full recording into memory or stacking music on transitions.
      this.track = new Audio(backgroundMusic); this.track.loop = true; this.track.preload = 'none';
      this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 18000;
      this.trackGain = ctx.createGain();
      ctx.createMediaElementSource(this.track).connect(this.filter); this.filter.connect(this.trackGain); this.trackGain.connect(this.musicBus);
      this.drumGain = ctx.createGain(); this.drumGain.gain.value = 0; this.drumGain.connect(this.musicBus);
      this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0; this.droneGain.connect(this.musicBus);
      const drone = ctx.createOscillator(), drone2 = ctx.createOscillator(); drone.frequency.value = 73.4; drone2.frequency.value = 110.2; drone.type = drone2.type = 'triangle';
      drone.connect(this.droneGain); drone2.connect(this.droneGain); drone.start(); drone2.start();
      // Ambience beds: filtered noise for wind and running water.
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const bed = (type: BiquadFilterType, f: number, q: number) => { const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(flt); flt.connect(g); g.connect(this.sfxBus!); src.start(); return g; };
      this.windGain = bed('bandpass', 420, 0.6); this.waterGain = bed('lowpass', 900, 0.3);
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

  /** Crossfades to a music state. Repeated calls with the same state do nothing. */
  setState(state: MusicState) {
    if (!this.ctx || this.state === state) return; this.state = state;
    const m = MIX[state], now = this.ctx.currentTime;
    this.trackGain!.gain.setTargetAtTime(m.track, now, 0.6); this.filter!.frequency.setTargetAtTime(m.cutoff, now, 0.5);
    this.drumGain!.gain.setTargetAtTime(m.drum * 0.5, now, 0.5); this.droneGain!.gain.setTargetAtTime(m.drone, now, 0.8);
    this.tempo = m.tempo; if (m.tempo > 0 && !this.drumTimer && this.on) this.drum();
  }
  private drum() {
    this.drumTimer = null; if (!this.ctx || !this.on || this.tempo <= 0) return;
    this.hit(this.drumGain!, 'lowpass', 260, 0.16, 0.9); setTimeout(() => this.on && this.hit(this.drumGain!, 'lowpass', 420, 0.08, 0.45), this.tempo * 500);
    this.drumTimer = setTimeout(() => this.drum(), this.tempo * 1000);
  }
  private hit(bus: AudioNode, type: BiquadFilterType, f: number, dur: number, vol: number, delay = 0) {
    if (!this.ctx || !this.noise) return; const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; const flt = this.ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(flt); flt.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }

  ambience(mood: Mood) {
    if (!this.ctx) return; this.mood = mood; const a = AMBIENCE[mood], now = this.ctx.currentTime;
    this.windGain!.gain.setTargetAtTime(this.on ? a.wind : 0, now, 1.2); this.waterGain!.gain.setTargetAtTime(this.on ? a.water : 0, now, 1.2);
    if (this.birdTimer) clearTimeout(this.birdTimer); this.birdTimer = null;
    const bird = () => { if (!this.on || a.birds <= 0) return; const f = 2200 + Math.random() * 1600; this.b(f, 0.07, 'sine', 0.012 * a.birds); this.b(f * 1.2, 0.06, 'sine', 0.01 * a.birds, 0.09); this.birdTimer = setTimeout(bird, 2500 + Math.random() * 5000); };
    if (a.birds > 0) this.birdTimer = setTimeout(bird, 1500);
  }
  /** Raises the wind for storms and the water for floods. */
  storm(level: number) { if (!this.ctx || !this.on) return; const a = AMBIENCE[this.mood]; this.windGain!.gain.setTargetAtTime(a.wind + level * 0.18, this.ctx.currentTime, 0.4); if (this.mood === 'gorge') this.waterGain!.gain.setTargetAtTime(a.water + level * 0.2, this.ctx.currentTime, 0.4); }

  music(m: Mood = 'menu') {
    this.init(); this.mood = m; this.on = true; this.pausedMusic = false; this.playTrack();
    this.state = 'ending'; this.setState(m === 'menu' ? 'menu' : 'explore'); this.ambience(m);
  }
  startSong() { this.music('menu'); }
  stopSong() { this.stop(); }

  pause() {
    this.pausedMusic = this.pausedMusic || this.on; this.on = false;
    this.track?.pause(); if (this.drumTimer) { clearTimeout(this.drumTimer); this.drumTimer = null; }
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }
  resume() {
    if (!this.pausedMusic) return;
    this.init(); this.pausedMusic = false; this.on = true; this.playTrack(); if (this.tempo > 0 && !this.drumTimer) this.drum();
  }
  stop() {
    this.on = false; this.pausedMusic = false; this.tempo = 0;
    if (this.drumTimer) { clearTimeout(this.drumTimer); this.drumTimer = null; } if (this.birdTimer) { clearTimeout(this.birdTimer); this.birdTimer = null; }
    if (this.ctx) { this.windGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); this.waterGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); this.drumGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); this.droneGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
    this.state = 'menu';
    if (this.track) { this.track.pause(); this.track.currentTime = 0; }
  }

  b(f: number, d: number, t: OscillatorType, v: number, dl = 0) { if (!this.ctx) return; const tm = this.ctx.currentTime + dl; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = t; o.frequency.setValueAtTime(f, tm); g.gain.setValueAtTime(v, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + d); o.connect(g); g.connect(this.sfxBus!); o.start(tm); o.stop(tm + d); }
  private n(type: BiquadFilterType, f: number, d: number, v: number, dl = 0) { if (this.sfxBus) this.hit(this.sfxBus, type, f, d, v, dl); }
  jump() { this.n('bandpass', 900, 0.06, 0.08); this.b(220, 0.08, 'triangle', 0.025); }
  /** Footsteps and landings differ by surface: dirt, rock, wood and snow. */
  step(surface: Surface, heavy = false) {
    const v = heavy ? 0.28 : 0.12;
    if (surface === 'dirt') this.n('lowpass', 520, 0.07, v);
    else if (surface === 'rock') { this.n('bandpass', 1900, 0.04, v * 0.9); this.b(160, 0.03, 'triangle', v * 0.15); }
    else if (surface === 'wood') { this.n('bandpass', 420, 0.06, v); this.b(190, 0.06, 'square', v * 0.12); }
    else { this.n('highpass', 2600, 0.11, v * 0.8); this.n('lowpass', 700, 0.08, v * 0.5, 0.02); }
  }
  land() { this.step('dirt', true); }
  dash() { this.n('bandpass', 1400, 0.16, 0.12); }
  throwS() { this.n('highpass', 1800, 0.08, 0.1); this.b(440, 0.06, 'sine', 0.03); }
  rockHit(material: 'rock' | 'wood' | 'metal' | 'ice' = 'rock') {
    if (material === 'wood') { this.b(210, 0.09, 'triangle', 0.08); this.n('bandpass', 500, 0.05, 0.12); }
    else if (material === 'metal') { this.b(880, 0.4, 'sine', 0.05); this.b(1320, 0.3, 'sine', 0.03); }
    else if (material === 'ice') { this.b(1600, 0.12, 'sine', 0.04); this.n('highpass', 3000, 0.08, 0.1); }
    else { this.n('bandpass', 1200, 0.06, 0.18); this.b(120, 0.05, 'triangle', 0.04); }
  }
  hurt() { this.b(150, 0.22, 'sawtooth', 0.08); this.b(80, 0.28, 'square', 0.05, 0.02); }
  enemyH() { this.n('bandpass', 700, 0.08, 0.15); }
  punch() { this.n('lowpass', 400, 0.08, 0.18); }
  collect() { this.b(760, 0.07, 'sine', 0.05); this.b(1140, 0.09, 'sine', 0.04, 0.05); }
  task() { this.b(523, 0.1, 'triangle', 0.06); this.b(784, 0.16, 'triangle', 0.06, 0.09); }
  /** Soft, non-punitive cue for an incorrect attempt. */
  wrong() { this.b(330, 0.14, 'triangle', 0.04); this.b(294, 0.18, 'triangle', 0.035, 0.1); }
  portal() { this.b(330, 0.25, 'sine', 0.06); this.b(494, 0.35, 'sine', 0.05, 0.1); this.b(660, 0.5, 'sine', 0.04, 0.2); }
  /** The flock bell: a bright partial over a lower body. Pitch 0 low, 1 mid, 2 high. */
  bell(pitch: 0 | 1 | 2 = 1, v = 0.07) { const f = [392, 523, 698][pitch]; this.b(f, 1.4, 'sine', v); this.b(f * 2.76, 0.6, 'sine', v * 0.35); this.b(f * 5.4, 0.3, 'sine', v * 0.15); }
  /** Synthesised bleat. A frightened bleat is higher and shakier. */
  sheep(kind: 'near' | 'far' | 'fear' | 'calm' = 'near') {
    if (!this.ctx) return; const base = kind === 'fear' ? 330 : kind === 'calm' ? 210 : 250, v = kind === 'far' ? 0.012 : 0.035, tm = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(), flt = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = base; lfo.frequency.value = kind === 'fear' ? 14 : 7; lg.gain.value = base * 0.06; lfo.connect(lg); lg.connect(o.frequency);
    flt.type = 'bandpass'; flt.frequency.value = 1100; flt.Q.value = 2; g.gain.setValueAtTime(0.0001, tm); g.gain.exponentialRampToValueAtTime(v, tm + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, tm + 0.55);
    o.connect(flt); flt.connect(g); g.connect(this.sfxBus!); o.start(tm); lfo.start(tm); o.stop(tm + 0.6); lfo.stop(tm + 0.6);
  }
  plate() { this.n('lowpass', 300, 0.1, 0.25); this.b(140, 0.08, 'square', 0.03); }
  creak() { this.b(95, 0.6, 'sawtooth', 0.025); this.n('bandpass', 260, 0.5, 0.08); }
  gate() { this.n('lowpass', 220, 0.5, 0.3); this.b(70, 0.4, 'triangle', 0.06); }
  lift() { this.b(55, 0.12, 'sawtooth', 0.02); }
  water() { this.n('lowpass', 700, 1.2, 0.2); this.n('bandpass', 1500, 0.9, 0.08, 0.2); }
  splash() { this.n('bandpass', 1200, 0.3, 0.25); }
  crack() { this.n('highpass', 2500, 0.12, 0.2); this.b(1900, 0.05, 'square', 0.02); this.n('highpass', 3000, 0.1, 0.15, 0.08); }
  rumble(v = 0.25) { this.n('lowpass', 120, 1.6, v); this.b(42, 1.2, 'sine', v * 0.25); }
  checkpoint() { this.bell(1, 0.04); this.b(659, 0.3, 'sine', 0.03, 0.15); }
  hint() { this.b(880, 0.15, 'sine', 0.03); this.b(1175, 0.2, 'sine', 0.025, 0.08); }
  animal(sound: 'growl' | 'hiss' | 'screech' | 'snort' | 'yelp' | 'chirp' | 'howl') {
    if (sound === 'growl') { this.b(85, 0.6, 'sawtooth', 0.04); this.n('lowpass', 300, 0.5, 0.08); }
    else if (sound === 'howl') { if (!this.ctx) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(), tm = this.ctx.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(380, tm); o.frequency.linearRampToValueAtTime(560, tm + 0.6); o.frequency.linearRampToValueAtTime(420, tm + 1.6); g.gain.setValueAtTime(0.0001, tm); g.gain.exponentialRampToValueAtTime(0.02, tm + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, tm + 1.7); o.connect(g); g.connect(this.sfxBus!); o.start(tm); o.stop(tm + 1.8); }
    else if (sound === 'hiss') this.n('highpass', 4000, 0.6, 0.12);
    else if (sound === 'screech') { this.b(1500, 0.3, 'sawtooth', 0.025); this.b(1200, 0.3, 'sawtooth', 0.02, 0.1); }
    else if (sound === 'snort') { this.n('lowpass', 500, 0.15, 0.2); this.n('lowpass', 450, 0.15, 0.16, 0.2); }
    else if (sound === 'yelp') this.b(700, 0.12, 'triangle', 0.04);
    else this.b(1800, 0.05, 'sine', 0.015);
  }
}
export const A = new AE();
