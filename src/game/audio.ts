import type { Mood } from './types';
class AE {
  ctx: AudioContext | null = null; musicBus: GainNode | null = null; sfxBus: GainNode | null = null; on = false; tm: any = null; beat = 0; mood: Mood = 'menu';
  init() { if (!this.ctx) { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); this.musicBus = this.ctx.createGain(); this.sfxBus = this.ctx.createGain(); this.musicBus.connect(this.ctx.destination); this.sfxBus.connect(this.ctx.destination); } if (this.ctx.state === 'suspended') void this.ctx.resume(); }
  volume(music: number, sfx: number) { if (!this.ctx) return; this.musicBus!.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.03); this.sfxBus!.gain.setTargetAtTime(sfx * 0.65, this.ctx.currentTime, 0.03); }
  private pausedMood: Mood | null = null;
  private pausedSong = false;
  pause() {
    const mood = this.on ? this.mood : this.pausedMood, song = this.songOn || this.pausedSong;
    this.stop(); this.pausedMood = mood; this.pausedSong = song;
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }
  resume() {
    const mood = this.pausedMood, song = this.pausedSong; this.pausedMood = null; this.pausedSong = false;
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (song) this.startSong(); else if (mood) this.music(mood);
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
  cfg(m: Mood) {
    switch (m) { case 'cedar': return { b: [110, 146.8, 130.8, 146.8], m: [293, 349, 392, 349, 293, 261, 220, 261], bpm: 240, mt: 'triangle' as OscillatorType, bt: 'sine' as OscillatorType }; case 'pasture': return { b: [130.8, 98, 116.5, 98], m: [392, 440, 523, 440, 392, 349, 293, 349], bpm: 250, mt: 'triangle' as OscillatorType, bt: 'triangle' as OscillatorType }; case 'gorge': return { b: [73.4, 87.3, 98, 87.3], m: [196, 246, 293, 246, 196, 174, 146, 174], bpm: 210, mt: 'sine' as OscillatorType, bt: 'sine' as OscillatorType }; case 'snow': return { b: [65.4, 87.3, 73.4, 87.3], m: [523, 587, 659, 587, 523, 466, 392, 466], bpm: 190, mt: 'sine' as OscillatorType, bt: 'sine' as OscillatorType }; default: return { b: [130.8, 98], m: [261, 329, 392, 329], bpm: 230, mt: 'square' as OscillatorType, bt: 'triangle' as OscillatorType }; }
  }
  music(m: Mood = 'menu') { if (!this.ctx) return; if (this.on && this.mood === m) return; this.stop(); this.mood = m; this.on = true; this.beat = 0; const c = this.cfg(m); const bd = 60000 / c.bpm / 2; const p = () => { if (!this.on || !this.ctx) return; const n = this.beat, tm = this.ctx.currentTime; if (n % 4 === 0) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = c.bt; o.frequency.value = c.b[(n / 4) % c.b.length]; g.gain.setValueAtTime(0.04, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.85); o.connect(g); g.connect(this.musicBus!); o.start(tm); o.stop(tm + 0.85); } const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = c.mt; o.frequency.value = c.m[n % c.m.length]; g.gain.setValueAtTime(0.016, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.22); o.connect(g); g.connect(this.musicBus!); o.start(tm); o.stop(tm + 0.22); this.beat++; this.tm = setTimeout(p, bd); }; p(); }
  stop() { this.pausedMood = null; this.pausedSong = false; this.on = false; this.songOn = false; if (this.tm) { clearTimeout(this.tm); this.tm = null; } if (this.songTimer) { clearTimeout(this.songTimer); this.songTimer = null; } }

  // ---- Procedural placeholder score. No recorded voice or cultural authenticity claim. ----
  // Layers: bendir (frame drum), loutar (plucked strings), hand-claps (tbiqt),
  //         zaghrouta (ululation as musical color), majestic wordless vocal-lead.
  songTimer: ReturnType<typeof setTimeout> | null = null;
  songBeat = 0;
  songOn = false;
  // Placeholder scale: D, E, F, G, A, Bb, C  -> degrees
  private songScale = [293.66, 329.63, 349.23, 392.0, 440.0, 466.16, 523.25, 587.33, 659.25];
  // bass / drone roots (loutar low strings)
  private songBass = [146.83, 164.81, 130.81, 174.61];

  // noise burst (bendir / clap texture) via short noise buffer
  private noiseBuf(): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    return buf;
  }
  private bendir(when: number, vol: number) {
    if (!this.ctx) return;
    const buf = this.noiseBuf(); if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 380;
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    src.connect(f); f.connect(g); g.connect(this.musicBus!); src.start(when);
  }
  private clap(when: number, vol: number) {
    if (!this.ctx) return;
    const buf = this.noiseBuf(); if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200;
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    src.connect(f); f.connect(g); g.connect(this.musicBus!); src.start(when);
  }
  private loutar(freq: number, when: number, vol: number, dur: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, when);
    // pluck decay
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    // slight pitch wobble (loutar resonance)
    o.frequency.exponentialRampToValueAtTime(freq * 0.995, when + dur);
    o.connect(g); g.connect(this.musicBus!); o.start(when); o.stop(when + dur + 0.02);
  }
  private vocalLead(freq: number, when: number, vol: number, dur: number) {
    if (!this.ctx) return;
    // wordless "ahh" — two detuned oscillators + formant-ish filter sweep
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o1.type = 'sine'; o2.type = 'sine'; o1.frequency.value = freq; o2.frequency.value = freq * 1.005;
    f.type = 'bandpass'; f.frequency.setValueAtTime(700, when); f.frequency.linearRampToValueAtTime(1100, when + dur); f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.08); g.gain.setValueAtTime(vol, when + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicBus!);
    o1.start(when); o2.start(when); o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }
  private zaghrouta(when: number) {
    if (!this.ctx) return;
    // ululation: rapid trill around a high pitch, rising then falling
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sine'; f.type = 'bandpass'; f.Q.value = 8; f.frequency.value = 1400;
    const base = 880;
    o.frequency.setValueAtTime(base, when);
    const dur = 1.6;
    for (let i = 0; i < 24; i++) { const t = when + (i / 24) * dur; const trill = i % 2 ? 1.18 : 1.0; const env = 1 - Math.abs((i / 24) - 0.5) * 1.6; o.frequency.setValueAtTime(base * trill * (0.9 + env * 0.3), t); }
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.05, when + 0.05); g.gain.setValueAtTime(0.05, when + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus!); o.start(when); o.stop(when + dur + 0.05);
  }
  startSong() {
    if (!this.ctx || this.songOn) return;
    this.songOn = true; this.songBeat = 0;
    const bpm = 92; const stepMs = 60000 / bpm / 2; // 8th notes
    let zaghroutaAt = 8; // ululation after intro phrase
    const tick = () => {
      if (!this.songOn || !this.ctx) return;
      const n = this.songBeat; const tm = this.ctx.currentTime + 0.02;
      const bar = Math.floor(n / 8), beatIn = n % 8;
      // bendir pattern: dum on 0,4 ; tak on 2,6
      if (beatIn === 0 || beatIn === 4) this.bendir(tm, 0.5);
      else if (beatIn === 2 || beatIn === 6) this.bendir(tm, 0.22);
      // hand claps (tbiqt) on offbeats after bar 2
      if (bar >= 2 && (beatIn === 2 || beatIn === 6)) this.clap(tm, 0.18);
      // loutar bass on downbeats
      if (beatIn === 0) this.loutar(this.songBass[bar % this.songBass.length], tm, 0.16, 0.5);
      // loutar melodic plucks (modal phrase)
      if (beatIn === 1 || beatIn === 3 || beatIn === 5) {
        const deg = (n * 3) % this.songScale.length;
        this.loutar(this.songScale[deg], tm, 0.09, 0.3);
      }
      // majestic wordless vocal lead from bar 1, sustained notes
      if (bar >= 1 && beatIn === 0) {
        const leadDeg = [4, 6, 5, 7, 4, 8, 6, 5][bar % 8];
        this.vocalLead(this.songScale[leadDeg] * 0.5, tm, 0.05, stepMs * 8 / 1000 * 0.95);
      }
      // zaghrouta at phrase turn (every ~16 beats after intro)
      if (n === zaghroutaAt) { this.zaghrouta(tm); zaghroutaAt = n + 32 + Math.floor(Math.random() * 8); }
      this.songBeat++;
      this.songTimer = setTimeout(tick, stepMs);
    };
    tick();
  }
  stopSong() { this.songOn = false; if (this.songTimer) { clearTimeout(this.songTimer); this.songTimer = null; } }
}
export const A = new AE();
