import React, { useEffect, useRef, useState } from 'react';

// ============================================================
//  ⴰⵎⴽⵙⴰ — AMKSA  (The Shepherd)  — v3 redesign
//  A Limbo-style atmospheric puzzle-platformer set in the
//  Middle Atlas (Béni Mellal – Khénifra), Morocco.
// ============================================================

// ---- Physics ----
const GRAVITY = 2100;
const FALL_MUL = 2.0;
const LOWJ_MUL = 2.0;
const JUMP = 760;
const MAXSPD = 300;
const ACC = 1500;
const FRIC_G = 1100;
const FRIC_A = 360;
const DASH_SPD = 700;
const DASH_T = 0.15;
const DASH_CD = 0.4;

// Throw
const ROCK_BOUNCE = 0.34;
const ROCK_FRIC = 240;
const T_MIN = 480, T_MAX = 1280;
const CHARGE_SPD = 1.7;

// Punch (when out of rocks)
const PUNCH_RANGE = 56;
const PUNCH_DMG = 1;
const PUNCH_CD = 0.45;
const PUNCH_KNOCK = 260;

const W = 1024, H = 576, MAXHP = 3, GY = 470;

// ============================================================
//  Audio
// ============================================================
type Mood = 'menu' | 'cedar' | 'pasture' | 'gorge' | 'snow';
class AE {
  ctx: AudioContext | null = null; on = false; tm: any = null; beat = 0; mood: Mood = 'menu';
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); }
  b(f: number, d: number, t: OscillatorType, v: number, dl = 0) { if (!this.ctx) return; const tm = this.ctx.currentTime + dl; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = t; o.frequency.setValueAtTime(f, tm); g.gain.setValueAtTime(v, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + d); o.connect(g); g.connect(this.ctx.destination); o.start(tm); o.stop(tm + d); }
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
  music(m: Mood = 'menu') { if (!this.ctx) return; if (this.on && this.mood === m) return; this.stop(); this.mood = m; this.on = true; this.beat = 0; const c = this.cfg(m); const bd = 60000 / c.bpm / 2; const p = () => { if (!this.on || !this.ctx) return; const n = this.beat, tm = this.ctx.currentTime; if (n % 4 === 0) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = c.bt; o.frequency.value = c.b[(n / 4) % c.b.length]; g.gain.setValueAtTime(0.04, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.85); o.connect(g); g.connect(this.ctx.destination); o.start(tm); o.stop(tm + 0.85); } const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = c.mt; o.frequency.value = c.m[n % c.m.length]; g.gain.setValueAtTime(0.016, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.22); o.connect(g); g.connect(this.ctx.destination); o.start(tm); o.stop(tm + 0.22); this.beat++; this.tm = setTimeout(p, bd); }; p(); }
  stop() { this.on = false; if (this.tm) { clearTimeout(this.tm); this.tm = null; } if (this.songTimer) { clearTimeout(this.songTimer); this.songTimer = null; } }

  // ---- Amazigh Atlas song: synthesized, multi-layered, no sung words ----
  // Layers: bendir (frame drum), loutar (plucked strings), hand-claps (tbiqt),
  //         zaghrouta (ululation as musical color), majestic wordless vocal-lead.
  songTimer: ReturnType<typeof setTimeout> | null = null;
  songBeat = 0;
  songOn = false;
  // Atlas modal scale (Ahwach-inspired): D, E, F, G, A, Bb, C  -> degrees
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
    src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(when);
  }
  private clap(when: number, vol: number) {
    if (!this.ctx) return;
    const buf = this.noiseBuf(); if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200;
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(when);
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
    o.connect(g); g.connect(this.ctx.destination); o.start(when); o.stop(when + dur + 0.02);
  }
  private vocalLead(freq: number, when: number, vol: number, dur: number) {
    if (!this.ctx) return;
    // wordless "ahh" — two detuned oscillators + formant-ish filter sweep
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o1.type = 'sine'; o2.type = 'sine'; o1.frequency.value = freq; o2.frequency.value = freq * 1.005;
    f.type = 'bandpass'; f.frequency.setValueAtTime(700, when); f.frequency.linearRampToValueAtTime(1100, when + dur); f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.08); g.gain.setValueAtTime(vol, when + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.ctx.destination);
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
    o.connect(f); f.connect(g); g.connect(this.ctx.destination); o.start(when); o.stop(when + dur + 0.05);
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
const A = new AE();

// ============================================================
//  Types
// ============================================================
interface Player { x: number; y: number; vx: number; vy: number; w: number; h: number; grounded: boolean; faceR: boolean; anim: number; stepT: number; state: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'dash' | 'punch'; jumpBuf: number; coyote: number; jumps: number; squash: number; stretch: number; rockN: number; charging: boolean; power: number; aim: number; hp: number; invinc: number; hitFlash: number; dashT: number; dashCD: number; dashDir: number; punchT: number; punchCD: number; }
interface Rock { id: number; x: number; y: number; vx: number; vy: number; r: number; }
interface Box { x: number; y: number; w: number; h: number; vx: number; vy: number; impactVy?: number; }
interface Hanging { x: number; y: number; w: number; h: number; hit: boolean; }
type PType = 'ground' | 'pillar' | 'wall' | 'ice' | 'goal' | 'break' | 'plateau';
interface Plat { x: number; y: number; w: number; h: number; type: PType; label?: string; broken?: boolean; breakT?: number; grad?: CanvasGradient; }
interface MP { x: number; y: number; w: number; h: number; sx: number; ex: number; vx: number; axis: 'x' | 'y'; sy?: number; ey?: number; }
interface Lever { x: number; y: number; on: boolean; lid: number; seq?: number; seqMax?: number; bridgeId?: number; target?: boolean; timed?: number; solved?: boolean; puzzleId?: number; } // may require solving a logic puzzle instead of just pressing
interface Door { id: number; x: number; y: number; w: number; h: number; open: boolean; timer?: number; }
interface Plate { id?: number; x: number; y: number; w: number; h: number; pressed: boolean; lid: number; solved?: boolean; elevatorId?: number; } // pressure plate; may control an elevator or a door
interface Bridge { id: number; x: number; y: number; w: number; h: number; down: boolean; progress: number; }
interface Elevator { id: number; x: number; y: number; w: number; h: number; baseY: number; topY: number; speed: number; plateId: number; } // rises while its linked plate is weighed down
interface Coin { x: number; y: number; got: boolean; bob: number; }
interface Check { x: number; y: number; on: boolean; }
interface Portal { x: number; y: number; w: number; h: number; }
interface Sheep { x: number; y: number; vx: number; vy: number; rescued: boolean; bob: number; }
type EType = 'macaque' | 'boar' | 'wolf' | 'fox' | 'eagle' | 'snake' | 'lynx';
interface Enemy { type: EType; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; maxHp: number; state: 'idle' | 'walk' | 'attack' | 'dead'; faceR: boolean; sx: number; ex: number; dmgT: number; atkT: number; onGround: boolean; anim: number; deadT: number; shootT: number; kbX: number; }
interface Proj { x: number; y: number; vx: number; vy: number; r: number; life: number; }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'snow' | 'leaf' | 'mist' | 'spark' | 'firefly'; }
interface Haz { x: number; y: number; w: number; h: number; type: 'water' | 'spike' | 'ice'; baseY?: number; }
interface Threat { kind: 'wolfpack' | 'eagle' | 'flood' | 'avalanche'; timer: number; level: number; phase: 'calm' | 'warning' | 'active'; frontX: number; }
interface Pal { skyTop: string; skyBot: string; far: string; mid: string; near: string; ground: string; groundTop: string; accent: string; fog: string; particle: string; }
interface WD { id: string; tif: string; name: string; sub: string; width: number; mood: Mood; pal: Pal; pType: Part['kind']; spawnX: number; spawnY: number; threat: Threat['kind']; platforms: Plat[]; mplatforms: MP[]; bridges: Bridge[]; elevators: Elevator[]; levers: Lever[]; doors: Door[]; plates: Plate[]; enemies: Enemy[]; rocks: Rock[]; boxes: Box[]; hanging: Hanging[]; hazards: Haz[]; checkpoints: Check[]; coins: Coin[]; sheep: Sheep[]; portal: Portal; goalE: number; goalS: number; goalP: number; }

// ============================================================
//  Logic Puzzles — real deduction, not just pressing buttons
// ============================================================
type PuzzleKind = 'symbol-match' | 'akomas-count' | 'equation' | 'sequence';
interface LogicPuzzle {
  id: number;
  kind: PuzzleKind;
  // symbol-match: given a row of Amazigh symbols with one missing, pick the right one from 4 choices
  prompt: string; // Arabic prompt text
  symbols?: string[]; // the sequence shown (with '?' for missing)
  choices: string[]; // selectable answers
  answer: number; // index into choices
  hint?: string;
}
// Each world gets a unique logic puzzle that must be solved before its lever activates.
const PUZZLES: Record<number, LogicPuzzle> = {
  1: {
    id: 1, kind: 'symbol-match',
    prompt: 'أكمل النمط الأمازيغي — أي رمز يأتي بعد؟',
    symbols: ['ⴰ', 'ⴱ', 'ⴳ', '?'],
    choices: ['ⴷ', 'ⴰ', 'ⵎ', 'ⵉ'],
    answer: 0, hint: 'الترتيب الأبجدي لتيفيناغ: ⴰ ⴱ ⴳ ⴷ...',
  },
  2: {
    id: 2, kind: 'akomas-count',
    prompt: 'عدّ أكوام الحجارة في الصورة. كم كومة؟',
    choices: ['٣', '٤', '٥', '٦'],
    answer: 2, hint: 'كل كومة عبارة عن مجموعة أحجار مرصوصة',
  },
  3: {
    id: 3, kind: 'equation',
    prompt: 'غنم + غنم + غنم = ٩  —  كم يساوي غنم واحدة؟',
    choices: ['٢', '٣', '٤', '٩'],
    answer: 1, hint: 'قسّم المجموع على عدد الغنم',
  },
  4: {
    id: 4, kind: 'sequence',
    prompt: 'أكمل التسلسل: ١ ، ٤ ، ٩ ، ١٦ ، ؟',
    choices: ['٢٠', '٢٥', '٢٤', '٣٦'],
    answer: 1, hint: 'كل رقم هو مربع ترتيبه: ١² ، ٢² ، ٣² ، ٤² ...',
  },
  5: {
    id: 5, kind: 'symbol-match',
    prompt: 'أي رمز تيفيناغ يختلف عن البقية؟',
    symbols: ['ⵍ', 'ⵎ', 'ⵏ', 'ⴰ'],
    choices: ['ⵍ', 'ⵎ', 'ⵏ', 'ⴰ'],
    answer: 3, hint: 'ⴰ هو حرف العلة، الباقي حروف ساكنة',
  },
  6: {
    id: 6, kind: 'equation',
    prompt: 'ذئب يأكل ٢ غنم. لديه ٨ غنم. كم وجبة تبقى؟',
    choices: ['٢', '٣', '٤', '٥'],
    answer: 2, hint: '٨ ÷ ٢ = ؟',
  },
};

const mkE = (t: EType, x: number, y: number, sx: number, ex: number): Enemy => {
  const s: Record<EType, { w: number; h: number; hp: number }> = { macaque: { w: 32, h: 40, hp: 1 }, boar: { w: 50, h: 34, hp: 2 }, wolf: { w: 54, h: 38, hp: 2 }, fox: { w: 46, h: 32, hp: 1 }, eagle: { w: 50, h: 32, hp: 2 }, snake: { w: 44, h: 18, hp: 1 }, lynx: { w: 60, h: 40, hp: 3 } };
  const c = s[t]; return { type: t, x, y, w: c.w, h: c.h, vx: 0, vy: 0, hp: c.hp, maxHp: c.hp, state: 'idle', faceR: false, sx, ex, dmgT: 0, atkT: 0, onGround: false, anim: 0, deadT: 0, shootT: Math.random() * 2, kbX: 0 };
};

// ============================================================
//  WORLDS — 4 Middle Atlas environments (sheep placed on safe platforms)
// ============================================================
function wCedar(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 400, h: 900, type: 'ground', label: 'ⵜⵉⴳⵎⵉⵏⵜ' },
    { x: 500, y: 420, w: 64, h: 900, type: 'pillar' }, { x: 640, y: 360, w: 64, h: 900, type: 'pillar' }, { x: 780, y: 410, w: 64, h: 900, type: 'pillar' },
    { x: 920, y: 350, w: 80, h: 900, type: 'plateau' },
    { x: 1090, y: GY, w: 280, h: 900, type: 'ground' },
    { x: 1420, y: 400, w: 64, h: 900, type: 'pillar' }, { x: 1560, y: 330, w: 64, h: 900, type: 'pillar' }, { x: 1700, y: 390, w: 64, h: 900, type: 'pillar' },
    { x: 1850, y: GY, w: 260, h: 900, type: 'ground' },
    { x: 2120, y: 410, w: 56, h: 900, type: 'pillar' }, { x: 2150, y: 380, w: 64, h: 900, type: 'pillar' }, { x: 2300, y: 300, w: 64, h: 900, type: 'pillar' }, { x: 2450, y: 370, w: 70, h: 900, type: 'plateau' },
    { x: 2700, y: 410, w: 56, h: 900, type: 'pillar' },
    { x: 2620, y: GY, w: 460, h: 900, type: 'ground', label: 'ⵉⴼⵔⴰⵏ' },
    { x: 3140, y: 410, w: 64, h: 900, type: 'pillar' }, { x: 3280, y: 340, w: 64, h: 900, type: 'pillar' }, { x: 3420, y: 410, w: 64, h: 900, type: 'pillar' },
    { x: 3560, y: GY, w: 820, h: 900, type: 'ground', label: 'ⵜⴰⵣⵣⵏⴰⵢⵜ' },
  ];
  return { id: 'cedar', tif: 'ⵜⵉⴳⵎⵉⵏⵜ', name: 'غابة الأرز', sub: 'العالم الأول', width: 4420, mood: 'cedar',
    pal: { skyTop: '#16342a', skyBot: '#2c5640', far: '#1d4636', mid: '#2a6346', near: '#3a7a54', ground: '#1f3326', groundTop: '#4d8060', accent: '#d4a857', fog: '#a8c0a0', particle: '#8fb878' },
    pType: 'leaf', spawnX: 70, spawnY: GY - 48, threat: 'wolfpack',
    platforms: P, mplatforms: [{ x: 3000, y: 360, w: 110, h: 16, sx: 3000, ex: 3140, vx: 95, axis: 'x' }], bridges: [], elevators: [],
    levers: [
      { x: 700, y: 360, on: false, lid: 1, seq: 1, seqMax: 3 },
      { x: 1700, y: 390, on: false, lid: 2, seq: 2, seqMax: 3 },
      { x: 3140, y: 410, on: false, lid: 0, seq: 3, seqMax: 3, puzzleId: 1 }
    ],
    doors: [
      { id: 0, x: 4240, y: 80, w: 32, h: GY - 80, open: false },
      { id: 1, x: 1090, y: 80, w: 32, h: GY - 80, open: false },
      { id: 2, x: 2450, y: 80, w: 32, h: GY - 80, open: false }
    ],
    plates: [],
    enemies: [ mkE('macaque', 1200, GY - 40, 1110, 1360), mkE('boar', 2720, GY - 34, 2640, 3070), mkE('wolf', 3800, GY - 38, 3580, 4320), mkE('wolf', 4050, GY - 38, 3580, 4320) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 1110, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2640, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3580, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 2080, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3300, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4120, y: 110, w: 56, h: 56, hit: false }],
    hazards: [{ x: 1380, y: GY, w: 40, h: 50, type: 'spike' }], checkpoints: [{ x: 1090, y: GY, on: false }, { x: 2620, y: GY, on: false }],
    coins: [[180, 420], [660, 320], [1570, 290], [1890, 420], [2330, 260], [2640, 420], [4160, 420]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ x: 960, y: 300, vx: 0, vy: 0, rescued: false, bob: 0 }, { x: 2490, y: 320, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4320, y: GY - 150, w: 64, h: 150 }, goalE: 4, goalS: 2, goalP: 1,
  };
}
function wPasture(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 420, h: 900, type: 'ground', label: 'ⵜⴰⵏⵎⵉⵔⵜ' },
    { x: 540, y: 430, w: 70, h: 900, type: 'plateau' }, { x: 700, y: 370, w: 70, h: 900, type: 'plateau' }, { x: 860, y: 430, w: 70, h: 900, type: 'plateau' },
    { x: 1020, y: GY, w: 300, h: 900, type: 'ground' },
    { x: 1160, y: 420, w: 56, h: 900, type: 'plateau' }, { x: 1380, y: 410, w: 64, h: 900, type: 'plateau' }, { x: 1530, y: 330, w: 64, h: 900, type: 'plateau' }, { x: 1680, y: 410, w: 64, h: 900, type: 'plateau' },
    { x: 1840, y: GY, w: 260, h: 900, type: 'ground' },
    { x: 2380, y: 246, w: 120, h: 900, type: 'plateau' }, // high ledge reachable via elevator
    { x: 2160, y: 390, w: 64, h: 900, type: 'plateau' }, { x: 2310, y: 310, w: 64, h: 900, type: 'plateau' }, { x: 2460, y: 390, w: 70, h: 900, type: 'plateau' },
    { x: 2620, y: GY, w: 440, h: 900, type: 'ground', label: 'ⵜⵉⵏⵎⵉⵔⵉⵏ' },
    { x: 3100, y: 430, w: 56, h: 900, type: 'plateau' }, { x: 3160, y: 420, w: 64, h: 900, type: 'plateau' }, { x: 3300, y: 350, w: 64, h: 900, type: 'plateau' }, { x: 3440, y: 420, w: 64, h: 900, type: 'plateau' },
    { x: 3580, y: GY, w: 800, h: 900, type: 'ground', label: 'ⴰⵣⵔⵓ' },
  ];
  return { id: 'pasture', tif: 'ⵜⴰⵏⵎⵉⵔⵜ', name: 'المرتفعات والمرعى', sub: 'العالم الثاني', width: 4420, mood: 'pasture',
    pal: { skyTop: '#34506e', skyBot: '#7ea8c4', far: '#446280', mid: '#648aa4', near: '#86a6b4', ground: '#3a4830', groundTop: '#7fa84a', accent: '#e0a040', fog: '#bcd0b0', particle: '#c8d8a0' },
    pType: 'mist', spawnX: 70, spawnY: GY - 48, threat: 'eagle',
    platforms: P, mplatforms: [{ x: 2080, y: 330, w: 100, h: 16, sx: 2080, ex: 2160, vx: 75, axis: 'y', sy: 290, ey: 390 }], bridges: [],
    elevators: [{ id: 0, x: 2380, y: GY, w: 90, h: 14, baseY: GY, topY: 260, speed: 60, plateId: 99 }],
    levers: [
      { x: 1560, y: 330, on: false, lid: 1, puzzleId: 3 },
      { x: 2760, y: GY - 30, on: false, lid: 0, puzzleId: 6 }
    ],
    doors: [
      { id: 0, x: 4320, y: 80, w: 32, h: GY - 80, open: false },
      { id: 1, x: 2120, y: 80, w: 28, h: GY - 80, open: false },
      { id: 2, x: 2530, y: 80, w: 28, h: GY - 80, open: false }
    ],
    plates: [{ x: 2030, y: GY, w: 56, h: 10, pressed: false, lid: 2 }, { id: 99, x: 1920, y: GY, w: 56, h: 10, pressed: false, lid: -1, elevatorId: 0 }],
    enemies: [ mkE('fox', 1100, GY - 32, 1030, 1310), mkE('fox', 1890, GY - 32, 1850, 2090), mkE('wolf', 2760, GY - 38, 2640, 3050), mkE('boar', 3900, GY - 34, 3600, 4340) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 1050, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2640, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3600, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 1900, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3304, y: 294, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4220, y: 110, w: 56, h: 56, hit: false }, { x: 2740, y: 130, w: 56, h: 56, hit: false }],
    hazards: [{ x: 1350, y: GY, w: 30, h: 50, type: 'spike' }], checkpoints: [{ x: 1020, y: GY, on: false }, { x: 2620, y: GY, on: false }],
    coins: [[200, 420], [720, 330], [1550, 280], [1890, 420], [2350, 270], [2660, 420], [4140, 420]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ x: 920, y: 380, vx: 0, vy: 0, rescued: false, bob: 0 }, { x: 2440, y: 224, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4400, y: GY - 150, w: 64, h: 150 }, goalE: 4, goalS: 2, goalP: 3,
  };
}
function wGorge(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 380, h: 900, type: 'plateau', label: 'ⴰⵎⴹⴰⵏ' },
    { x: 500, y: 430, w: 70, h: 900, type: 'pillar' }, { x: 650, y: 370, w: 70, h: 900, type: 'pillar' }, { x: 800, y: 430, w: 70, h: 900, type: 'pillar' },
    { x: 950, y: GY, w: 260, h: 900, type: 'plateau' },
    { x: 1110, y: 410, w: 56, h: 220, type: 'pillar' }, { x: 1240, y: 380, w: 70, h: 220, type: 'pillar' }, { x: 1400, y: 320, w: 70, h: 220, type: 'pillar' }, { x: 1560, y: 380, w: 70, h: 220, type: 'pillar' },
    { x: 1720, y: GY, w: 300, h: 900, type: 'plateau' },
    { x: 1990, y: 410, w: 56, h: 900, type: 'pillar' }, { x: 2110, y: 400, w: 64, h: 900, type: 'pillar' }, { x: 2250, y: 320, w: 64, h: 900, type: 'pillar' }, { x: 2390, y: 400, w: 70, h: 900, type: 'pillar' },
    { x: 2540, y: GY, w: 420, h: 900, type: 'plateau', label: 'ⴰⵎⴹⴰⵏ' },
    { x: 2780, y: 440, w: 56, h: 900, type: 'pillar' }, { x: 2990, y: 430, w: 56, h: 900, type: 'pillar' }, { x: 3060, y: 420, w: 64, h: 900, type: 'pillar' }, { x: 3200, y: 350, w: 64, h: 900, type: 'pillar' }, { x: 3340, y: 420, w: 64, h: 900, type: 'pillar' },
    { x: 3480, y: GY, w: 900, h: 900, type: 'plateau', label: 'ⵉⵎⵉ ⵏ ⵡⴰⵎⴰⵏ' },
  ];
  return { id: 'gorge', tif: 'ⴰⵎⴹⴰⵏ', name: 'مضيق أم الربيع', sub: 'العالم الثالث', width: 4420, mood: 'gorge',
    pal: { skyTop: '#281612', skyBot: '#7a3a26', far: '#5a281e', mid: '#8a4a30', near: '#a86038', ground: '#3a1a12', groundTop: '#c8703a', accent: '#e8a050', fog: '#c88858', particle: '#d8a878' },
    pType: 'mist', spawnX: 70, spawnY: GY - 48, threat: 'flood',
    platforms: P, mplatforms: [{ x: 2020, y: 350, w: 100, h: 16, sx: 2020, ex: 2110, vx: 80, axis: 'y', sy: 310, ey: 410 }, { x: 3020, y: 390, w: 100, h: 16, sx: 3020, ex: 3060, vx: 90, axis: 'x' }],
    bridges: [{ id: 0, x: 1630, y: 410, w: 220, h: 14, down: false, progress: 0 }], elevators: [],
    levers: [
      { x: 1400, y: 320, on: false, lid: -1, bridgeId: 0, target: true },
      { x: 2250, y: 320, on: false, lid: 2, puzzleId: 2 },
      { x: 2680, y: GY - 30, on: false, lid: 0, puzzleId: 5 }
    ],
    doors: [
      { id: 0, x: 4300, y: 80, w: 32, h: GY - 80, open: false },
      { id: 1, x: 1760, y: 80, w: 28, h: GY - 80, open: false },
      { id: 2, x: 2540, y: 80, w: 28, h: GY - 80, open: false }
    ],
    plates: [{ x: 1560, y: 380, w: 56, h: 10, pressed: false, lid: 1 }],
    enemies: [ mkE('snake', 1000, GY - 18, 960, 1200), mkE('snake', 1800, GY - 18, 1730, 2010), mkE('fox', 2680, GY - 32, 2560, 2950), mkE('boar', 3850, GY - 34, 3500, 4320) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 960, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2560, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3500, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 1420, y: 264, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3204, y: 294, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4180, y: 120, w: 56, h: 56, hit: false }, { x: 2660, y: 100, w: 56, h: 56, hit: false }],
    hazards: [{ x: 1230, y: GY + 30, w: 100, h: 90, type: 'water' }, { x: 1640, y: GY + 30, w: 100, h: 90, type: 'water' }, { x: 2040, y: GY, w: 80, h: 50, type: 'water' }],
    checkpoints: [{ x: 950, y: GY, on: false }, { x: 2540, y: GY, on: false }],
    coins: [[180, 420], [680, 330], [1420, 280], [1770, 420], [2270, 280], [2560, 420], [4140, 420]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ x: 1000, y: 410, vx: 0, vy: 0, rescued: false, bob: 0 }, { x: 2440, y: 350, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4400, y: GY - 150, w: 64, h: 150 }, goalE: 4, goalS: 2, goalP: 4,
  };
}
function wSnow(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 400, h: 900, type: 'ice', label: 'ⵉⴼⵔⵉ' },
    { x: 520, y: 430, w: 70, h: 900, type: 'ice' }, { x: 680, y: 360, w: 70, h: 900, type: 'ice' }, { x: 840, y: 290, w: 70, h: 900, type: 'ice' }, { x: 1000, y: 360, w: 70, h: 900, type: 'ice' },
    { x: 1160, y: GY, w: 280, h: 900, type: 'ice' },
    { x: 1520, y: 400, w: 64, h: 900, type: 'ice' }, { x: 1660, y: 320, w: 64, h: 900, type: 'ice' }, { x: 1800, y: 400, w: 64, h: 900, type: 'ice' },
    { x: 1940, y: GY, w: 260, h: 900, type: 'ice' },
    { x: 2280, y: 380, w: 64, h: 900, type: 'ice' }, { x: 2430, y: 290, w: 64, h: 900, type: 'ice' }, { x: 2580, y: 380, w: 70, h: 900, type: 'ice' },
    { x: 2740, y: GY, w: 440, h: 900, type: 'ice', label: 'ⵉⴼⵔⵉ ⵏ ⵉⴹⵕⴰⵏ' },
    { x: 3210, y: 440, w: 56, h: 900, type: 'ice' }, { x: 3300, y: 420, w: 64, h: 900, type: 'ice' }, { x: 3440, y: 350, w: 64, h: 900, type: 'ice' }, { x: 3580, y: 420, w: 64, h: 900, type: 'ice' },
    { x: 3720, y: GY, w: 320, h: 900, type: 'ice' },
    { x: 3900, y: 440, w: 56, h: 900, type: 'ice' }, { x: 4100, y: 430, w: 64, h: 900, type: 'ice' }, { x: 4250, y: 350, w: 64, h: 900, type: 'ice' }, { x: 4400, y: 270, w: 64, h: 900, type: 'ice' },
    { x: 4560, y: GY - 70, w: 360, h: 900, type: 'goal', label: 'ⴰⵎⴽⵙⴰ' },
  ];
  return { id: 'snow', tif: 'ⵉⴼⵔⵉ', name: 'القمم الثلجية', sub: 'العالم الأخير', width: 4940, mood: 'snow',
    pal: { skyTop: '#0a2438', skyBot: '#4a7898', far: '#143a56', mid: '#2a5e7a', near: '#4a82a0', ground: '#143248', groundTop: '#dceaf2', accent: '#8ac0e0', fog: '#c0d8e8', particle: '#ffffff' },
    pType: 'snow', spawnX: 70, spawnY: GY - 48, threat: 'avalanche',
    platforms: P, mplatforms: [{ x: 2180, y: 340, w: 100, h: 16, sx: 2180, ex: 2280, vx: 100, axis: 'y', sy: 290, ey: 410 }, { x: 3220, y: 400, w: 100, h: 16, sx: 3220, ex: 3300, vx: 110, axis: 'x' }],
    bridges: [{ id: 0, x: 2070, y: 410, w: 300, h: 14, down: false, progress: 0 }], elevators: [],
    levers: [
      { x: 1660, y: 320, on: false, lid: -1, bridgeId: 0, target: true },
      { x: 2430, y: 290, on: false, lid: 2, timed: 8, puzzleId: 4 }
    ],
    doors: [
      { id: 1, x: 2100, y: 80, w: 28, h: GY - 80, open: false },
      { id: 2, x: 2740, y: 80, w: 28, h: GY - 80, open: false }
    ],
    plates: [{ x: 1800, y: 400, w: 56, h: 10, pressed: false, lid: 1 }],
    enemies: [ mkE('fox', 1200, GY - 32, 1170, 1430), mkE('lynx', 2000, GY - 40, 1960, 2190), mkE('eagle', 2840, GY - 32, 2760, 3170), mkE('lynx', 3860, GY - 40, 3740, 4020) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 1170, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2760, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3740, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 1680, y: 264, w: 56, h: 56, vx: 0, vy: 0 }, { x: 4104, y: 374, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [],
    hazards: [{ x: 2070, y: GY, w: 150, h: 50, type: 'ice' }, { x: 3640, y: GY, w: 80, h: 50, type: 'spike' }],
    checkpoints: [{ x: 1160, y: GY, on: false }, { x: 2740, y: GY, on: false }, { x: 3720, y: GY, on: false }],
    coins: [[180, 420], [700, 320], [860, 250], [1680, 280], [2020, 420], [2450, 250], [2780, 420], [4380, 300], [4580, 360]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ x: 1000, y: 310, vx: 0, vy: 0, rescued: false, bob: 0 }, { x: 2580, y: 330, vx: 0, vy: 0, rescued: false, bob: 1 }, { x: 3580, y: 370, vx: 0, vy: 0, rescued: false, bob: 2 }],
    portal: { x: 0, y: 0, w: 0, h: 0 }, goalE: 4, goalS: 3, goalP: 3,
  };
}
export const WORLDS = [wCedar, wPasture, wGorge, wSnow];
const MOODS: Mood[] = ['cedar', 'pasture', 'gorge', 'snow'];

// ---- helpers ----
const pR = (p: Player) => ({ x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h });
const hit = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SAVE = 'amksa_v3';
const loadS = () => { try { const r = localStorage.getItem(SAVE); if (r) return JSON.parse(r); } catch (e) { } return { world: 0, coins: 0, deaths: 0 }; };
const saveS = (d: any) => { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch (e) { } };
const clearS = () => { try { localStorage.removeItem(SAVE); } catch (e) { } };

// ============================================================
//  RENDER — atmospheric, hand-drawn feel, multi-layered
// ============================================================
function drawSky(ctx: CanvasRenderingContext2D, cx: number, pal: Pal, id: string) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun/moon glow
  if (id === 'pasture' || id === 'gorge') { const sx = (id === 'gorge' ? 760 : 820) - cx * 0.02; const r = id === 'gorge' ? 70 : 55; const gg = ctx.createRadialGradient(sx, 130, 8, sx, 130, r); gg.addColorStop(0, 'rgba(255,235,180,0.5)'); gg.addColorStop(1, 'rgba(255,235,180,0)'); ctx.fillStyle = gg; ctx.fillRect(sx - r, 60, r * 2, r * 2); }
  if (id === 'snow') { const gg = ctx.createRadialGradient(820 - cx * 0.02, 110, 8, 820 - cx * 0.02, 110, 60); gg.addColorStop(0, 'rgba(220,235,250,0.45)'); gg.addColorStop(1, 'rgba(220,235,250,0)'); ctx.fillStyle = gg; ctx.fillRect(760, 50, 120, 120); }
}
function drawMountains(ctx: CanvasRenderingContext2D, cx: number, pal: Pal) {
  ctx.fillStyle = pal.far; ctx.beginPath();
  for (let i = 0; i < 13; i++) { const x = i * 300 - (cx * 0.12) % 300; ctx.moveTo(x, H); ctx.lineTo(x + 150, H - 210 + Math.sin(i * 1.3) * 45); ctx.lineTo(x + 300, H); }
  ctx.fill();
  ctx.fillStyle = pal.mid; ctx.beginPath();
  for (let i = 0; i < 15; i++) { const x = i * 240 - (cx * 0.26) % 240; ctx.moveTo(x, H); ctx.lineTo(x + 120, H - 140 + Math.cos(i * 1.7) * 35); ctx.lineTo(x + 240, H); }
  ctx.fill();
}
// cedar tree silhouette (atmospheric, layered canopy). baseY = world-space top of the platform it stands on.
function cedar(ctx: CanvasRenderingContext2D, x: number, baseY: number, hgt: number, dark: string) {
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 5, baseY - hgt * 0.32, 10, hgt * 0.32);
  ctx.fillStyle = dark;
  for (let t = 0; t < 4; t++) { const ty = baseY - hgt * 0.32 - t * (hgt * 0.18); const tw = (hgt * 0.5) * (1 - t * 0.2); ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - hgt * 0.24); ctx.lineTo(x + tw, ty); ctx.closePath(); ctx.fill(); }
}
// find the top surface y at a given world x among platforms (for anchoring trees to ground)
const topAt = (plats: Plat[], x: number): number | null => {
  let best: number | null = null;
  for (const p of plats) { if (p.type === 'break' && p.broken) continue; if (x >= p.x && x <= p.x + p.w) { if (best === null || p.y < best) best = p.y; } }
  return best;
};
function drawFog(ctx: CanvasRenderingContext2D, cx: number, cy: number, pal: Pal, level: number) {
  if (level <= 0) return;
  ctx.fillStyle = pal.fog; ctx.globalAlpha = 0.12 * level;
  for (let i = 0; i < 5; i++) { const x = (cx * 0.4 + i * 260) % (W + 260) - 130; const y = H - 60 - i * 18 + Math.sin(Date.now() / 2000 + i) * 10; ctx.beginPath(); ctx.ellipse(x, y - cy * 0.3, 160, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawPlatform(ctx: CanvasRenderingContext2D, p: Plat, pal: Pal, id: string) {
  let body = pal.ground, top = pal.groundTop;
  if (p.type === 'pillar') { body = '#2e1f14'; top = id === 'cedar' ? '#4d8060' : id === 'gorge' ? '#a8603a' : pal.groundTop; }
  if (p.type === 'ice') { body = '#143a56'; top = '#d4eaf2'; }
  if (p.type === 'plateau') { body = '#33271c'; top = pal.groundTop; }
  if (p.type === 'break') { body = '#5a3a20'; top = '#c8a060'; }
  if (p.type === 'goal') { body = '#243a2c'; top = '#5aaa6a'; }
  let ox = 0; if (p.type === 'break' && p.broken && (p.breakT ?? 0) > 0) ox = Math.sin(Date.now() / 28) * 3;
  ctx.save(); ctx.translate(ox, 0);
  // shadow under platform
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x + 4, p.y + 4, p.w, p.h);
  ctx.fillStyle = body; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = top; ctx.fillRect(p.x, p.y, p.w, 9);
  // grass tufts on ground tops (cedar/pasture)
  if ((p.type === 'ground' || p.type === 'plateau') && (id === 'cedar' || id === 'pasture')) {
    ctx.fillStyle = id === 'cedar' ? '#5d9068' : '#8fb850';
    for (let i = 6; i < p.w; i += 14) { ctx.fillRect(p.x + i, p.y - 3, 2, 6); ctx.fillRect(p.x + i + 3, p.y - 5, 2, 8); ctx.fillRect(p.x + i + 6, p.y - 2, 2, 5); }
  }
  // snow caps
  if (p.type === 'ice') { ctx.fillStyle = '#fff'; for (let i = 4; i < p.w; i += 20) { ctx.fillRect(p.x + i, p.y - 2, 12, 3); } }
  // texture cracks
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let i = 0; i < p.w; i += 24) ctx.fillRect(p.x + i, p.y + 9, 2, Math.min(p.h, 50));
  if (p.type === 'pillar') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(p.x + 5, p.y, 4, p.h); ctx.fillRect(p.x + p.w - 9, p.y, 4, p.h); }
  if (p.label) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.label, p.x + p.w / 2, p.y - 8); }
  if (p.type === 'goal') { ctx.fillStyle = '#5aaa6a'; ctx.fillRect(p.x + p.w / 2 - 2, p.y - 60, 4, 60); ctx.fillStyle = '#3a8a4a'; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2 + 2, p.y - 60); ctx.lineTo(p.x + p.w / 2 + 26, p.y - 48); ctx.lineTo(p.x + p.w / 2 + 2, p.y - 36); ctx.fill(); }
  ctx.restore();
}
function drawHazard(ctx: CanvasRenderingContext2D, h: Haz, t: number) {
  if (h.type === 'water') {
    // Atlas river water — deep teal with depth gradient, layered waves, foam, reflections
    const x = h.x, y = h.y, wW = h.w, hH = h.h;
    // depth gradient: lighter teal at top, darker deep below
    const g = ctx.createLinearGradient(0, y, 0, y + hH);
    g.addColorStop(0, '#1f6f78'); g.addColorStop(0.4, '#16565e'); g.addColorStop(1, '#0c353c');
    ctx.fillStyle = g; ctx.fillRect(x, y, wW, hH);
    // back wave layer (slower, darker)
    ctx.fillStyle = '#1a5a62';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i <= wW; i += 6) { ctx.lineTo(x + i, y + Math.sin(t / 160 + i * 0.05) * 3 - 2); }
    ctx.lineTo(x + wW, y + hH); ctx.lineTo(x, y + hH); ctx.closePath(); ctx.fill();
    // front wave layer (faster, lighter teal)
    ctx.fillStyle = '#2a8088';
    ctx.beginPath(); ctx.moveTo(x, y + 3);
    for (let i = 0; i <= wW; i += 6) { ctx.lineTo(x + i, y + 3 + Math.sin(t / 110 + i * 0.08) * 3); }
    ctx.lineTo(x + wW, y + hH); ctx.lineTo(x, y + hH); ctx.closePath(); ctx.fill();
    // surface highlight line (shimmering)
    ctx.strokeStyle = 'rgba(180,240,235,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= wW; i += 4) { const yy = y + 2 + Math.sin(t / 110 + i * 0.08) * 3; if (i === 0) ctx.moveTo(x + i, yy); else ctx.lineTo(x + i, yy); }
    ctx.stroke();
    // foam band at the very top edge
    ctx.fillStyle = 'rgba(220,250,245,0.7)';
    for (let i = 0; i <= wW; i += 14) { const yy = y - 1 + Math.sin(t / 110 + i * 0.08) * 3; ctx.fillRect(x + i + (Math.sin(t / 300 + i) * 3), yy, 6, 2); }
    // moving reflection streaks
    ctx.strokeStyle = 'rgba(200,245,240,0.18)'; ctx.lineWidth = 1;
    for (let r = 0; r < 4; r++) { const ry = y + 10 + r * 9; const off = Math.sin(t / 600 + r) * 14; ctx.beginPath(); ctx.ellipse(x + wW / 2 + off, ry, wW * 0.3, 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    // sparkle dots
    ctx.fillStyle = 'rgba(220,250,245,0.6)';
    for (let i = 0; i < 5; i++) { const sx = x + ((t / 30 + i * 37) % wW); const sy = y + 6 + Math.sin(t / 200 + i) * 3; ctx.fillRect(sx, sy, 2, 1); }
  } else {
    ctx.fillStyle = h.type === 'ice' ? '#bce0ee' : '#b8c0c8';
    const n = Math.floor(h.w / 16);
    for (let i = 0; i < n; i++) { const sx = h.x + i * 16; ctx.beginPath(); ctx.moveTo(sx, h.y + h.h); ctx.lineTo(sx + 8, h.y); ctx.lineTo(sx + 16, h.y + h.h); ctx.fill(); }
    ctx.fillStyle = '#5a6068'; ctx.fillRect(h.x, h.y + h.h - 6, h.w, 6);
  }
}
function drawPortal(ctx: CanvasRenderingContext2D, p: Portal, t: number, pal: Pal, open: boolean) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (!open) { ctx.fillStyle = 'rgba(60,40,30,0.6)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(p.x + 4, p.y, 4, p.h); ctx.fillRect(p.x + p.w - 8, p.y, 4, p.h); }
  else {
    for (let i = 0; i < 4; i++) { const r = 14 + i * 11 + Math.sin(t / 280 + i) * 3; ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.5 - i * 0.1; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, r, p.h / 2 + i * 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, p.w); g.addColorStop(0, 'rgba(255,240,200,0.85)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = pal.accent; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ⴰⵎⴽⵙⴰ', cx, p.y - 8);
}
function drawLever(ctx: CanvasRenderingContext2D, l: Lever) {
  if (l.target) {
    // unmistakable distant target: bright concentric disc connected to a hanging pin
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.x, l.y - 58); ctx.lineTo(l.x, l.y - 34); ctx.stroke();
    ctx.fillStyle = l.on ? '#34d399' : '#d4a857'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = l.on ? '#34d399' : '#f5d889'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(l.x - 3, l.y - 30, 6, 30);
  ctx.strokeStyle = l.on ? pal_accent : '#8a7a5a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(l.x, l.y - 26); ctx.lineTo(l.x + (l.on ? 14 : -14), l.y - 36); ctx.stroke();
  ctx.fillStyle = l.on ? pal_accent : '#6a5a3a'; ctx.beginPath(); ctx.arc(l.x + (l.on ? 14 : -14), l.y - 36, 5, 0, Math.PI * 2); ctx.fill();
  if (l.seq !== undefined) { ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(l.seq), l.x, l.y - 47); }
  if (l.puzzleId !== undefined && !l.solved) { ctx.fillStyle = '#8ac0e0'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧩', l.x, l.y - 54); }
}
const pal_accent = '#d4a857';
function drawPlate(ctx: CanvasRenderingContext2D, pl: Plate) {
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(pl.x, pl.y, pl.w, 8);
  ctx.fillStyle = pl.pressed ? '#34d399' : '#8a6a3a'; ctx.fillRect(pl.x + 2, pl.y + (pl.pressed ? 4 : 1), pl.w - 4, pl.pressed ? 4 : 7);
  if (!pl.solved) { ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▼ وزن', pl.x + pl.w / 2, pl.y - 7); }
}
function drawBridge(ctx: CanvasRenderingContext2D, b: Bridge) {
  ctx.save();
  ctx.translate(b.x, b.y + b.h / 2);
  ctx.rotate(-Math.PI / 2 * (1 - b.progress));
  // rope rails
  ctx.strokeStyle = '#3b2517'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(b.w, -7); ctx.moveTo(0, 7); ctx.lineTo(b.w, 7); ctx.stroke();
  // planks
  ctx.fillStyle = '#795330';
  for (let x = 0; x < b.w; x += 15) { ctx.fillRect(x, -b.h / 2, 13, b.h); ctx.fillStyle = '#9a7042'; ctx.fillRect(x + 2, -b.h / 2 + 2, 9, 2); ctx.fillStyle = '#795330'; }
  // hinge
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawDoor(ctx: CanvasRenderingContext2D, d: Door, glyph = '') {
  if (d.open || d.w === 0) return;
  const g = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0); g.addColorStop(0, '#342014'); g.addColorStop(0.5, '#765238'); g.addColorStop(1, '#342014');
  ctx.fillStyle = g; ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = '#b89058'; ctx.lineWidth = 2;
  for (let y = d.y + 14; y < d.y + d.h; y += 28) { ctx.beginPath(); ctx.moveTo(d.x + 3, y); ctx.lineTo(d.x + d.w - 3, y); ctx.stroke(); }
  ctx.fillStyle = '#b89058'; ctx.fillRect(d.x + d.w / 2 - 2, d.y, 4, d.h);
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(d.x + d.w - 6, d.y + d.h / 2, 3, 0, Math.PI * 2); ctx.fill();
  if (glyph) { ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(glyph, d.x + d.w / 2, d.y + 24); }
}
function drawCheck(ctx: CanvasRenderingContext2D, c: Check) {
  // akomas: stacked stones
  ctx.fillStyle = c.on ? '#c8a45c' : '#6a6a6a';
  ctx.fillRect(c.x - 2, c.y - 34, 4, 34);
  [[-9, -8, 18], [-7, -20, 14], [-5, -30, 9]].forEach(([dx, dy, s]) => { ctx.fillStyle = c.on ? '#b8924c' : '#5a5a5a'; ctx.fillRect(c.x + dx, c.y + dy, s, 9); });
  if (c.on) { ctx.fillStyle = 'rgba(200,164,92,0.22)'; ctx.beginPath(); ctx.arc(c.x, c.y - 34, 13 + Math.sin(Date.now() / 300) * 3, 0, Math.PI * 2); ctx.fill(); }
}
function drawSheep(ctx: CanvasRenderingContext2D, s: Sheep) {
  ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y)); const by = Math.sin(s.bob) * 1.2;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 13, 3, 0, 0, Math.PI * 2); ctx.fill();
  // fluffy wool body
  ctx.fillStyle = '#f0ece4'; ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; ctx.arc(Math.cos(a) * 9, by - 9 + Math.sin(a) * 7, 6, 0, Math.PI * 2); }
  ctx.fill();
  ctx.fillStyle = '#ddd8cc'; ctx.beginPath(); ctx.arc(-5, by - 11, 5, 0, Math.PI * 2); ctx.arc(5, by - 12, 4, 0, Math.PI * 2); ctx.fill();
  // dark head
  ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.ellipse(12, by - 9, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(11, by - 14, 2, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  // eye
  ctx.fillStyle = '#e8d8c0'; ctx.fillRect(14, by - 11, 2, 2);
  // legs
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(-7, by - 2, 3, 6); ctx.fillRect(5, by - 2, 3, 6);
  ctx.restore();
}

// ===== Animals — detailed, realistic silhouettes, clearly visible =====
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save(); ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2));
  if (!e.faceR) ctx.scale(-1, 1);
  if (e.state === 'dead') { ctx.globalAlpha = Math.max(0, e.deadT / 1.2); ctx.rotate(Math.PI); }
  const hurt = e.dmgT > 0;
  const ls = (e.state === 'walk') ? Math.sin(Date.now() / 90) * 6 : 0;
  const col = hurt ? '#ef4444' : '';

  // WOLF — long-bodied, visible, realistic
  if (e.type === 'wolf') {
    const base = hurt ? '#ef4444' : '#3e382e';
    ctx.fillStyle = base;
    // body (elongated)
    ctx.beginPath(); ctx.ellipse(0, -2, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
    // chest highlight
    ctx.fillStyle = hurt ? '#ef4444' : '#52483a'; ctx.beginPath(); ctx.ellipse(-4, 2, e.w / 2 - 8, e.h / 2 - 6, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 + 6 + ls, e.h / 2 - 4, 6, 10); ctx.fillRect(-e.w / 2 + 16 - ls, e.h / 2 - 4, 6, 10); ctx.fillRect(e.w / 2 - 18 + ls, e.h / 2 - 4, 6, 10); ctx.fillRect(e.w / 2 - 8 - ls, e.h / 2 - 4, 6, 10);
    // tail (bushy, down)
    ctx.fillStyle = base; ctx.save(); ctx.translate(-e.w / 2, -4); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(-8, 0, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hurt ? '#ef4444' : '#2a241c'; ctx.beginPath(); ctx.ellipse(-16, 2, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (e.state !== 'dead') {
      // head (snout forward)
      ctx.fillStyle = base; ctx.save(); ctx.translate(e.w / 2 - 4, -e.h / 2 + 6); ctx.beginPath(); ctx.ellipse(8, 4, 14, 11, -0.1, 0, Math.PI * 2); ctx.fill();
      // snout
      ctx.beginPath(); ctx.ellipse(18, 8, 8, 5, 0.1, 0, Math.PI * 2); ctx.fill();
      // ears (pointed, alert)
      ctx.fillStyle = hurt ? '#ef4444' : '#2a241c'; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(0, -14); ctx.lineTo(4, -6); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(11, -15); ctx.lineTo(13, -6); ctx.fill();
      // eyes (glowing amber — visible)
      ctx.fillStyle = e.state === 'attack' ? '#ff5050' : '#f0c050'; ctx.fillRect(4, 2, 3, 3); ctx.fillRect(12, 3, 3, 3);
      // nose
      ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.arc(24, 8, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // MACAQUE (Barbary macaque) — compact, tailless, expressive
  else if (e.type === 'macaque') {
    const base = hurt ? '#ef4444' : '#5a4030';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // lighter face area
    ctx.fillStyle = hurt ? '#ef4444' : '#7a5a40'; ctx.beginPath(); ctx.arc(e.w / 2 - 6, -e.h / 2 + 8, 10, 0, Math.PI * 2); ctx.fill();
    // limbs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 - 2, -4 + ls, 7, 12); ctx.fillRect(e.w / 2 - 4, -4 - ls, 7, 12); ctx.fillRect(-e.w / 2 + 4, e.h / 2 - 2, 6, 8 + ls); ctx.fillRect(e.w / 2 - 10, e.h / 2 - 2, 6, 8 - ls);
    // face (pinkish)
    ctx.fillStyle = hurt ? '#ef4444' : '#c8a888'; ctx.beginPath(); ctx.arc(e.w / 2 - 6, -e.h / 2 + 8, 6, 0, Math.PI * 2); ctx.fill();
    // ears
    ctx.fillStyle = base; ctx.beginPath(); ctx.arc(e.w / 2 - 14, -e.h / 2 + 6, 4, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 8, -e.h / 2 + 6, 2, 2); ctx.fillRect(e.w / 2 - 4, -e.h / 2 + 6, 2, 2);
  }
  // BOAR — stocky, bristly mane, tusks
  else if (e.type === 'boar') {
    const base = hurt ? '#ef4444' : '#42301c';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // bristle mane
    ctx.fillStyle = '#241810'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * 7 - 2, -e.h / 2 - 5, 4, 7);
    // legs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 + 6, e.h / 2 - 2, 7, 8 + ls); ctx.fillRect(e.w / 2 - 13, e.h / 2 - 2, 7, 8 - ls);
    // head + snout
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(e.w / 2 - 6, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(e.w / 2 + 6, 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    // tusk
    ctx.fillStyle = '#e8d8b8'; ctx.beginPath(); ctx.moveTo(e.w / 2 + 8, 6); ctx.lineTo(e.w / 2 + 12, 9); ctx.lineTo(e.w / 2 + 7, 8); ctx.fill();
    // eye
    ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 2, -2, 2, 2); ctx.fillStyle = e.state === 'attack' ? '#ef4444' : '#1a1008';
  }
  // FOX — slender, bushy tail, pointed ears, orange
  else if (e.type === 'fox') {
    const base = hurt ? '#ef4444' : '#c4602a';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // white belly
    ctx.fillStyle = hurt ? '#ef4444' : '#e8d8c0'; ctx.beginPath(); ctx.ellipse(0, 4, e.w / 2 - 8, e.h / 2 - 6, 0, 0, Math.PI * 2); ctx.fill();
    // bushy tail with white tip
    ctx.fillStyle = base; ctx.save(); ctx.translate(-e.w / 2, -2); ctx.rotate(-0.4); ctx.beginPath(); ctx.ellipse(-10, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.ellipse(-20, 1, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // legs
    ctx.fillStyle = '#3a2418'; ctx.fillRect(-e.w / 2 + 6, e.h / 2 - 2, 5, 7 + ls); ctx.fillRect(e.w / 2 - 11, e.h / 2 - 2, 5, 7 - ls);
    // head
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(e.w / 2 - 4, -2, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    // pointed ears
    ctx.fillStyle = '#a85020'; ctx.beginPath(); ctx.moveTo(e.w / 2 - 10, -e.h / 2); ctx.lineTo(e.w / 2 - 8, -e.h / 2 - 7); ctx.lineTo(e.w / 2 - 4, -e.h / 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(e.w / 2 + 2, -e.h / 2); ctx.lineTo(e.w / 2 + 4, -e.h / 2 - 7); ctx.lineTo(e.w / 2 + 7, -e.h / 2); ctx.fill();
    // snout (white) + nose
    ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.ellipse(e.w / 2 + 6, 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.arc(e.w / 2 + 10, 2, 2, 0, Math.PI * 2); ctx.fill();
    // eye
    ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 2, -2, 2, 2);
  }
  // EAGLE — soaring, flapping wings, hooked beak
  else if (e.type === 'eagle') {
    const base = hurt ? '#ef4444' : '#4a3420';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2 - 4, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // wings (flap)
    const fl = Math.sin(Date.now() / 70) * 0.6;
    ctx.fillStyle = '#2e2014';
    ctx.save(); ctx.rotate(fl); ctx.beginPath(); ctx.moveTo(-e.w / 2, -2); ctx.quadraticCurveTo(-e.w / 2 - 22, -8, -e.w / 2 - 16, 8); ctx.lineTo(-e.w / 2, 6); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(-fl); ctx.beginPath(); ctx.moveTo(e.w / 2, -2); ctx.quadraticCurveTo(e.w / 2 + 22, -8, e.w / 2 + 16, 8); ctx.lineTo(e.w / 2, 6); ctx.fill(); ctx.restore();
    // head
    ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.arc(e.w / 2 - 2, -e.h / 2 + 3, 7, 0, Math.PI * 2); ctx.fill();
    // hooked beak
    ctx.fillStyle = '#d4a040'; ctx.beginPath(); ctx.moveTo(e.w / 2 + 4, -e.h / 2 + 2); ctx.lineTo(e.w / 2 + 10, -e.h / 2 + 4); ctx.lineTo(e.w / 2 + 4, -e.h / 2 + 7); ctx.fill();
    // eye
    ctx.fillStyle = '#d4a040'; ctx.fillRect(e.w / 2 - 4, -e.h / 2 + 1, 2, 2);
    // tail
    ctx.fillStyle = '#2e2014'; ctx.beginPath(); ctx.moveTo(-e.w / 2 + 2, 2); ctx.lineTo(-e.w / 2 - 6, -2); ctx.lineTo(-e.w / 2 - 6, 6); ctx.fill();
  }
  // SNAKE — serpentine, coiled/slithering
  else if (e.type === 'snake') {
    ctx.fillStyle = hurt ? '#ef4444' : '#3a6a3a';
    const seg = 6; const ph = Date.now() / 100;
    for (let i = 0; i < seg; i++) { const sx = -e.w / 2 + i * (e.w / seg) + Math.sin(ph + i * 0.8) * 3; ctx.beginPath(); ctx.ellipse(sx, Math.sin(ph + i) * 2, e.w / seg + 1, e.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    // diamond pattern
    ctx.fillStyle = hurt ? '#ef4444' : '#5a8a4a'; for (let i = 0; i < 4; i++) { const sx = -e.w / 2 + 8 + i * 9; ctx.beginPath(); ctx.moveTo(sx, -3); ctx.lineTo(sx + 3, 0); ctx.lineTo(sx, 3); ctx.lineTo(sx - 3, 0); ctx.fill(); }
    // head
    ctx.fillStyle = hurt ? '#ef4444' : '#3a6a3a'; ctx.beginPath(); ctx.ellipse(e.w / 2 - 4, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    // tongue
    ctx.strokeStyle = '#e04040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.w / 2 + 4, 0); ctx.lineTo(e.w / 2 + 10, -1 + Math.sin(Date.now() / 80) * 2); ctx.stroke();
    // eye
    ctx.fillStyle = '#e0c040'; ctx.fillRect(e.w / 2 - 2, -2, 2, 2);
  }
  // LYNX — tufted ears, spotted, powerful
  else if (e.type === 'lynx') {
    const base = hurt ? '#ef4444' : '#9a8062';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // spots
    ctx.fillStyle = '#5a4030'; for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) { if ((i + j) % 2 === 0) { ctx.beginPath(); ctx.arc(i * 9, j * 7 - 2, 2.5, 0, Math.PI * 2); ctx.fill(); } }
    // legs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 + 8 + ls, e.h / 2 - 4, 7, 12); ctx.fillRect(-e.w / 2 + 20 - ls, e.h / 2 - 4, 7, 12); ctx.fillRect(e.w / 2 - 20 + ls, e.h / 2 - 4, 7, 12); ctx.fillRect(e.w / 2 - 8 - ls, e.h / 2 - 4, 7, 12);
    // short bobbed tail
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(-e.w / 2 - 2, -2, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    if (e.state !== 'dead') {
      // head
      ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(e.w / 2 - 6, -e.h / 2 + 8, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
      // tufted ears (lynx signature)
      ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.moveTo(e.w / 2 - 12, -e.h / 2); ctx.lineTo(e.w / 2 - 11, -e.h / 2 - 8); ctx.lineTo(e.w / 2 - 7, -e.h / 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.w / 2 - 2, -e.h / 2); ctx.lineTo(e.w / 2, -e.h / 2 - 8); ctx.lineTo(e.w / 2 + 3, -e.h / 2); ctx.fill();
      // ear tufts (black tips)
      ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 11, -e.h / 2 - 8, 2, 3); ctx.fillRect(e.w / 2 - 1, -e.h / 2 - 8, 2, 3);
      // facial ruff
      ctx.fillStyle = '#b89878'; ctx.beginPath(); ctx.ellipse(e.w / 2 - 6, -e.h / 2 + 12, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      // eyes (amber)
      ctx.fillStyle = e.state === 'attack' ? '#ff5050' : '#e0a040'; ctx.fillRect(e.w / 2 - 4, -e.h / 2 + 5, 3, 3); ctx.fillRect(e.w / 2 + 3, -e.h / 2 + 5, 3, 3);
      // nose
      ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.arc(e.w / 2 + 8, -e.h / 2 + 10, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  // health bar
  if (e.hp > 0 && e.hp < e.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 1, e.y - 9, e.w + 2, 4); ctx.fillStyle = '#ef4444'; ctx.fillRect(e.x, e.y - 8, (e.w * e.hp) / e.maxHp, 3); }
}
function drawProj(ctx: CanvasRenderingContext2D, p: Proj) { ctx.fillStyle = '#e0c060'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillRect(-p.r, -2, p.r * 2, 4); ctx.restore(); }

// Shepherd player — burnous, staff, detailed
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y));
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, p.w / 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (p.invinc > 0 && Math.floor(Date.now() / 80) % 2 === 0) ctx.globalAlpha = 0.4;
  let sq = p.squash, st = p.stretch;
  if (p.state === 'run' && p.grounded) { const r = Math.sin(p.anim * 2); sq *= 1 - r * 0.08; st *= 1 + r * 0.08; }
  ctx.scale(sq, st);
  // aim trajectory (full parabola)
  if (p.charging) {
    const ang = p.faceR ? p.aim : Math.PI - p.aim; const pw = T_MIN + p.power * (T_MAX - T_MIN);
    ctx.strokeStyle = `rgba(220,170,80,${0.25 + p.power * 0.45})`; ctx.lineWidth = 2;
    let px = 0, py = -14, vx = Math.cos(ang) * pw, vy = Math.sin(ang) * pw;
    ctx.beginPath();
    for (let s = 0; s < 32; s++) { if (s % 2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); px += vx * 0.028; vy += GRAVITY * 0.028; py += vy * 0.028; }
    ctx.stroke();
    // power bar (steady, controlled)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-23, -43, 46, 6);
    ctx.fillStyle = `rgb(${255 - p.power * 180},${140 + p.power * 90},60)`; ctx.fillRect(-23, -43, 46 * p.power, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(-23, -43, 46, 6);
  }
  ctx.scale(p.faceR ? 1 : -1, 1);
  const t = p.anim; let legL = 0, legR = 0, bodyY = 0, tilt = 0;
  if (p.state === 'run') { legL = Math.sin(t) * 13; legR = Math.sin(t + Math.PI) * 13; bodyY = Math.abs(Math.sin(t * 2)) * 3; tilt = 0.08; }
  else if (p.state === 'walk') { legL = Math.sin(t) * 8; legR = Math.sin(t + Math.PI) * 8; tilt = 0.04; }
  else if (p.state === 'jump') { legL = -8; legR = -4; tilt = -0.1; }
  else if (p.state === 'fall') { legL = -4; legR = -8; tilt = 0.1; }
  else if (p.state === 'dash') { legL = -12; legR = -6; tilt = 0.2; }
  else if (p.state === 'punch') { legL = -4; legR = -2; tilt = 0.05; }
  else { bodyY = Math.sin(t * 2) * 1; }
  // legs (trousers) + sandals
  ctx.strokeStyle = '#3a2616'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -13 + bodyY); ctx.lineTo(legL, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -13 + bodyY); ctx.lineTo(legR, -2); ctx.stroke();
  ctx.fillStyle = '#241208'; ctx.fillRect(legL - 2, -2, 5, 3); ctx.fillRect(legR - 2, -2, 5, 3);
  ctx.save(); ctx.translate(0, -13 + bodyY); ctx.rotate(tilt);
  // burnous (selham) — earthy brown, draped with depth
  const cloak = p.hitFlash > 0 ? '#dc2626' : '#6a4a30';
  // back drape (slightly darker, behind)
  ctx.fillStyle = p.hitFlash > 0 ? '#b91c1c' : '#523824';
  ctx.beginPath(); ctx.moveTo(-12, -21); ctx.lineTo(12, -21); ctx.lineTo(16, 11); ctx.lineTo(-16, 11); ctx.closePath(); ctx.fill();
  // front cloak
  ctx.fillStyle = cloak;
  ctx.beginPath(); ctx.moveTo(-11, -21); ctx.lineTo(11, -21); ctx.lineTo(14, 9); ctx.lineTo(-14, 9); ctx.closePath(); ctx.fill();
  // Amazigh ⵣ (yaz) motif belt stripe in accent
  ctx.fillStyle = '#c8a45c'; ctx.fillRect(-12, 2, 24, 3);
  ctx.fillStyle = '#e0c074'; ctx.fillRect(-12, 2, 24, 1);
  // cloak folds
  ctx.strokeStyle = '#4a2e1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -19); ctx.lineTo(-8, 8); ctx.moveTo(6, -19); ctx.lineTo(8, 8); ctx.stroke();
  // hood (deeper, with inner shadow)
  ctx.fillStyle = '#4a2e1c'; ctx.beginPath(); ctx.arc(0, -24, 12, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, 0); ctx.fill();
  // face (warm tan) — clearer
  ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(1, -25, 7, 0, Math.PI * 2); ctx.fill();
  // cheek shading
  ctx.fillStyle = '#b07a52'; ctx.beginPath(); ctx.arc(5, -23, 3, 0, Math.PI * 2); ctx.fill();
  // beard
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(1, -19, 5.5, 3.5, 0, 0, Math.PI); ctx.fill();
  // eyes (clearer)
  ctx.fillStyle = '#1a0e08'; ctx.fillRect(3, -26, 2, 2.5); ctx.fillRect(-3, -26, 2, 2.5);
  // eyebrow
  ctx.fillStyle = '#1a0e08'; ctx.fillRect(2, -28, 4, 1); ctx.fillRect(-4, -28, 4, 1);
  // carved shepherd staff (with crook)
  ctx.strokeStyle = '#9a7a44'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, -16); ctx.lineTo(18, 0); ctx.stroke();
  ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, -16); ctx.lineTo(18, 0); ctx.stroke();
  ctx.strokeStyle = '#9a7a44'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(10, -18, 3, Math.PI * 0.3, Math.PI * 1.4); ctx.stroke();
  // rock in hand OR punch fist
  if (p.state === 'punch') { ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(18, -8, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a8784a'; ctx.fillRect(15, -11, 4, 2); }
  else if (p.rockN > 0) { ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.arc(13, -8, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9080'; ctx.beginPath(); ctx.arc(12, -9, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore(); ctx.restore();
}
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.7); ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.3); ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s, x, y + s * 1.2); ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.7, x + s, y + s * 0.3); ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.7); ctx.fill(); }
function drawHUD(ctx: CanvasRenderingContext2D, wd: WD, p: Player, coins: number, deaths: number, kE: number, rS: number, sP: number, thL: number, streak: number) {
  const pal = wd.pal;
  for (let i = 0; i < MAXHP; i++) { ctx.fillStyle = i < p.hp ? '#ef4444' : 'rgba(255,255,255,0.15)'; drawHeart(ctx, 24 + i * 28, 24, 10); }
  ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(W - 130, 24, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${coins}`, W - 118, 29);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(`السقوط: ${deaths}`, W - 64, 50);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(wd.name, W / 2, 24);
  ctx.fillStyle = pal.accent; ctx.font = 'bold 13px sans-serif'; ctx.fillText(wd.tif, W / 2, 40);
  // tasks
  ctx.textAlign = 'left'; ctx.font = 'bold 11px sans-serif';
  const ts = [['الحيوانات', `${kE}/${wd.goalE}`, '#ef4444'], ['الغنم', `${rS}/${wd.goalS}`, '#f0ece4'], ['الألغاز', `${sP}/${wd.goalP}`, '#e0a040']];
  ts.forEach((t, i) => { const y = 50 + i * 18; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(22, y, 92, 14); ctx.fillStyle = t[2]; ctx.beginPath(); ctx.arc(32, y + 7, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(`${t[0]}: ${t[1]}`, 40, y + 11); });
  // threat meter
  if (thL > 0) { const bw = 170, bx = W / 2 - bw / 2, by = 50; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx, by, bw, 7); const c = thL > 0.66 ? '#ef4444' : thL > 0.33 ? '#f59e0b' : '#a3a3a3'; ctx.fillStyle = c; ctx.fillRect(bx, by, bw * thL, 7); ctx.fillStyle = c; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; const lbl = wd.threat === 'wolfpack' ? 'الذئاب تقترب' : wd.threat === 'eagle' ? 'النسر يحوم' : wd.threat === 'flood' ? 'الفيضان يرتفع' : 'انهيار ثلجي'; ctx.fillText(lbl, W / 2, by + 18); }
  // death streak warning
  if (streak > 0) { ctx.fillStyle = `rgba(239,68,68,${0.4 + streak * 0.2})`; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`موت متتابع: ${streak}/3`, W / 2, H - 18); }
}

// ============================================================
//  Component
// ============================================================
type Screen = 'title' | 'intro' | 'transition' | 'playing' | 'complete' | 'reset' | 'puzzle';
type Lang = 'ar' | 'en' | 'fr';
// Tri-lingual story, sentence by sentence (shown together over the Atlas song)
const STORY: { ar: string; en: string; fr: string }[] = [
  { ar: 'في قلب جبال الأطلس المتوسط، بإقليم بني ملال-خنيفرة، عاش راعٍ أمازيغي.', en: 'In the heart of the Middle Atlas, in Béni Mellal–Khénifra, lived an Amazigh shepherd.', fr: "Au cœur du Moyen Atlas, au pays de Béni Mellal–Khénifra, vivait un berger amazigh." },
  { ar: 'كان يرعى قطيعه بين أشجار الأرز العتيقة ومرتفعات الماء البارد.', en: 'He grazed his flock among ancient cedars and the cold high springs.', fr: 'Il faisait paître son troupeau parmi les cèdars anciens et les sources froides des hauteurs.' },
  { ar: 'ذات فجر، استيقظ فلم يجد غنمه... تفرّقت في العوالم وتاهت بين الجبال.', en: 'One dawn he woke to find his sheep gone — scattered across worlds, lost among the mountains.', fr: "Un matin, à l'aube, il trouva son troupeau disparu — éparpillé à travers les mondes, perdu dans les montagnes." },
  { ar: 'عليه أن يجمع غنمه، يفك الألغاز، وينجو قبل أن يدركه التهديد في كل أفق.', en: 'He must gather his sheep, solve the riddles, and escape before the threat closing in reaches him.', fr: 'Il doit rassembler ses moutons, résoudre les énigmes, et s\'échapper avant que la menace ne l\'atteigne.' },
  { ar: 'أربعة عوالم تنتظره: الأرز، المرعى، المضيق، والقمم الثلجية.', en: 'Four worlds await him: the cedar, the pasture, the gorge, the snowy peaks.', fr: 'Quatre mondes l\'attendent : le cèdre, le pâturage, la gorge, les sommets enneigés.' },
  { ar: 'هكذا تبدأ رحلة ⴰⵎⴽⵙⴰ — الراعي.', en: 'So begins the journey of ⴰⵎⴽⵙⴰ — the Shepherd.', fr: 'Ainsi commence le voyage de ⴰⵎⴽⵙⴰ — le Berger.' },
];

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('title');
  const [lang, setLang] = useState<Lang | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [wi, setWi] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [hasSave, setHasSave] = useState(false);
  const [activePuzzle, setActivePuzzle] = useState<LogicPuzzle | null>(null);
  const [puzzleCallback, setPuzzleCallback] = useState<(() => void) | null>(null);
  const [puzzleSelected, setPuzzleSelected] = useState<number>(-1);
  const [puzzleShowHint, setPuzzleShowHint] = useState(false);
  const [puzzleWrong, setPuzzleWrong] = useState<number | null>(null);
  const S = useRef<any>(null);
  useEffect(() => { setHasSave(loadS().world > 0); }, []);

  const build = (idx: number) => {
    const d = WORLDS[idx]();
    // Anchor sheep to the actual platform top beneath them (fixes floating sheep)
    const anchoredSheep = d.sheep.map(s => {
      const baseY = topAt(d.platforms, s.x);
      return baseY !== null ? { ...s, y: baseY - 22 } : { ...s };
    });
    const anchoredBoxes = d.boxes.map(b => {
      const baseY = topAt(d.platforms, b.x + b.w / 2);
      return baseY !== null ? { ...b, y: baseY - b.h } : { ...b };
    });
    return { def: d, platforms: d.platforms.map(p => ({ ...p })), mplatforms: d.mplatforms.map(m => ({ ...m })), bridges: d.bridges.map(b => ({ ...b })), elevators: d.elevators.map(e => ({ ...e, y: e.baseY })), levers: d.levers.map(l => ({ ...l })), doors: d.doors.map(o => ({ ...o })), plates: d.plates.map(p => ({ ...p })), seqProgress: 0, seqFailed: false, seqSolved: false, enemies: d.enemies.map(e => ({ ...e })), rocks: d.rocks.map(r => ({ ...r })), boxes: anchoredBoxes, hanging: d.hanging.map(h => ({ ...h })), hazards: d.hazards.map(h => ({ ...h, baseY: h.y })), checkpoints: d.checkpoints.map(c => ({ ...c })), coins: d.coins.map(c => ({ ...c })), sheep: anchoredSheep, portal: { ...d.portal }, projectiles: [] as Proj[], particles: [] as Part[], threat: { kind: d.threat, timer: 0, level: 0, phase: 'calm', frontX: 0 } as Threat, killed: 0, rescued: 0, solved: 0, opened: false, streak: 0, completionAwarded: false };
  };
  const start = (fs: boolean) => { if (!lang) return; A.init(); const sv = loadS(); const idx = fs && sv.world > 0 ? Math.min(sv.world, WORLDS.length - 1) : 0; setWi(idx); setDeaths(fs ? sv.deaths : 0); setTotalCoins(fs ? sv.coins : 0); setStoryIdx(0); setScreen('intro'); };
  // intro: play the Amazigh song + reveal story sentence by sentence
  useEffect(() => {
    if (screen !== 'intro') return;
    A.init(); A.stopSong(); A.startSong();
    const revealMs = 4200; // time per sentence
    const t = setInterval(() => { setStoryIdx(i => { if (i >= STORY.length - 1) { clearInterval(t); return i; } return i + 1; }); }, revealMs);
    const end = setTimeout(() => { A.stopSong(); setScreen('transition'); }, revealMs * STORY.length + 1500);
    return () => { clearInterval(t); clearTimeout(end); A.stopSong(); };
  }, [screen]);
  useEffect(() => { if (screen !== 'transition') return; const t = setTimeout(() => { const w = build(wi); const d = w.def; const pl: Player = { x: d.spawnX, y: d.spawnY, vx: 0, vy: 0, w: 22, h: 46, grounded: false, faceR: true, anim: 0, stepT: 0, state: 'idle', jumpBuf: 0, coyote: 0, jumps: 2, squash: 1, stretch: 1, rockN: 0, charging: false, power: 0, aim: -Math.PI / 4, hp: MAXHP, invinc: 0, hitFlash: 0, dashT: 0, dashCD: 0, dashDir: 1, punchT: 0, punchCD: 0 }; S.current = { world: w, player: pl, camX: 0, camY: 0, camTX: 0, camTY: 0, deaths, totalCoins, wCoins: 0 }; A.music(MOODS[wi]); setScreen('playing'); }, 1400); return () => clearTimeout(t); }, [screen, wi, deaths, totalCoins]);

  useEffect(() => {
    if (screen !== 'playing' || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext('2d'); if (!ctx) return;
    let raf = 0, last = performance.now();
    const k: Record<string, boolean> = { left: false, right: false, jump: false, jumpJP: false, inter: false, interJP: false, aim: false, up: false, down: false, quick: false, quickJP: false, dash: false, dashJP: false, punch: false, punchJP: false };
    const kd = (e: KeyboardEvent) => { const c = e.code; if (c === 'ArrowLeft' || c === 'KeyA') k.left = true; if (c === 'ArrowRight' || c === 'KeyD') k.right = true; if (c === 'Space' || c === 'KeyW' || c === 'ArrowUp') { if (!k.jump) k.jumpJP = true; k.jump = true; e.preventDefault(); } if (c === 'KeyE' || c === 'Enter') { if (!k.inter) k.interJP = true; k.inter = true; } if (c === 'KeyR') { if (!k.aim) k.aim = true; } if (c === 'KeyF') { if (!k.quick) k.quickJP = true; k.quick = true; } if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyL') { if (!k.dash) k.dashJP = true; k.dash = true; } if (c === 'KeyG' || c === 'KeyJ' || c === 'KeyQ') { if (!k.punch) k.punchJP = true; k.punch = true; } if (c === 'ArrowUp') k.up = true; if (c === 'ArrowDown') { k.down = true; e.preventDefault(); } };
    const ku = (e: KeyboardEvent) => { const c = e.code; if (c === 'ArrowLeft' || c === 'KeyA') k.left = false; if (c === 'ArrowRight' || c === 'KeyD') k.right = false; if (c === 'Space' || c === 'KeyW' || c === 'ArrowUp') { k.jump = false; k.up = false; } if (c === 'KeyE' || c === 'Enter') k.inter = false; if (c === 'KeyR') k.aim = false; if (c === 'KeyF') k.quick = false; if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyL') k.dash = false; if (c === 'KeyG' || c === 'KeyJ' || c === 'KeyQ') k.punch = false; if (c === 'ArrowDown') k.down = false; };
    window.addEventListener('keydown', kd, { passive: false }); window.addEventListener('keyup', ku);
    const st = S.current; if (!st) return; const { world, player } = st; const def = world.def; const pal = def.pal; let pT = 0;

    const hurt = (force = false) => {
      if (player.invinc > 0) return;
      player.hp -= 1; player.invinc = 1.1; player.hitFlash = 0.25; A.hurt();
      player.vy = -280; player.vx = (player.faceR ? -1 : 1) * 180;
      if (player.hp <= 0 || force) {
        world.streak += 1;
        if (world.streak >= 3) { // 3 consecutive deaths -> reset world
          st.deaths += 1; setDeaths(st.deaths); setScreen('reset'); return;
        }
        st.deaths += 1; setDeaths(st.deaths);
        player.hp = MAXHP; player.invinc = 1.4; player.x = def.spawnX; player.y = def.spawnY; player.vx = 0; player.vy = 0; player.rockN = 0; player.charging = false; player.dashT = 0; player.punchT = 0;
        // restart environmental pressure cleanly; never respawn into an unavoidable threat
        world.threat.timer = 0; world.threat.level = 0; world.threat.phase = 'calm'; world.threat.frontX = 0;
        world.hazards.forEach((h: Haz) => { if (h.type === 'water' && h.baseY !== undefined) h.y = h.baseY; });
      }
    };
    const burst = (x: number, y: number, col: string, n = 12) => { for (let i = 0; i < n; i++) world.particles.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -70 - Math.random() * 110, life: 0.5, max: 0.5, size: 3 + Math.random() * 3, color: col, kind: 'spark' }); };

    // One authoritative switch handler: prevents double-counting and keeps cause/effect consistent.
    const activateLever = (l: Lever, byRock: boolean) => {
      if (l.on) return;
      // A distant target must be struck; walking up and pressing E does not solve it.
      if (l.target && !byRock) return;
      // A lever with a linked puzzle requires solving the logic puzzle before it activates.
      if (l.puzzleId !== undefined && !byRock) {
        const pz = PUZZLES[l.puzzleId];
        if (pz && !l.solved) {
          setActivePuzzle(pz);
          setPuzzleSelected(-1);
          setPuzzleShowHint(false);
          setPuzzleWrong(null);
          setPuzzleCallback(() => () => {
            l.on = true; l.solved = true; world.solved++; A.task();
            world.doors.forEach((d: Door) => { if (d.id === l.lid) { d.open = true; if (l.timed) d.timer = l.timed; } });
            burst(l.x, l.y - 20, pal.accent, 14);
          });
          setScreen('puzzle');
          return;
        }
      }
      if (l.bridgeId !== undefined) {
        l.on = true;
        const br = world.bridges.find((b: Bridge) => b.id === l.bridgeId);
        if (br && !br.down) { br.down = true; world.solved++; A.task(); burst(l.x, l.y - 20, pal.accent, 12); }
        return;
      }
      if (l.seq !== undefined) {
        const expected = world.seqProgress + 1;
        if (l.seq === expected) {
          l.on = true; world.seqProgress = expected; world.seqFailed = false; A.task();
          world.doors.forEach((d: Door) => { if (d.id === l.lid) d.open = true; });
          if (l.seq === l.seqMax && !world.seqSolved) { world.seqSolved = true; world.solved++; }
        } else {
          world.seqFailed = true; A.hurt();
          world.levers.forEach((sl: Lever) => { if (sl.seq !== undefined) sl.on = false; });
          // Keep already-open traversal doors open so a wrong guess never traps the player between gates.
          world.seqProgress = 0; world.seqSolved = false;
        }
        return;
      }
      l.on = true; A.task(); if (!l.solved) { l.solved = true; world.solved++; }
      world.doors.forEach((d: Door) => { if (d.id === l.lid) { d.open = true; if (l.timed) d.timer = l.timed; } });
    };

    const update = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.05); last = time;
      // camera (smooth, slight lookahead)
      st.camTX = player.x - W / 2 + (player.faceR ? 30 : -30); st.camTX = cl(st.camTX, 0, def.width - W);
      let camTY = 0; if (player.y < 320) camTY = player.y - 320; camTY = Math.max(-240, camTY);
      st.camX += (st.camTX - st.camX) * Math.min(1, dt * 7); st.camY += (camTY - st.camY) * Math.min(1, dt * 5);
      const cx = Math.round(st.camX), cy = Math.round(st.camY);

      // aim
      if (player.rockN > 0) { if (k.up) player.aim -= 2.5 * dt; if (k.down) player.aim += 2.5 * dt; player.aim = cl(player.aim, -Math.PI / 2, 0); }

      // pickup rock (E)
      if (k.interJP) {
        let bi = -1, md = 90; world.rocks.forEach((r: Rock, i: number) => { const d = Math.hypot(r.x - player.x, r.y - player.y); if (d < md) { md = d; bi = i; } });
        if (bi !== -1 && player.rockN < 4) { world.rocks.splice(bi, 1); player.rockN++; player.aim = 0; A.collect(); }
        // nearby physical switches; distant targets are rock-only
        world.levers.forEach((l: Lever) => {
          if (Math.abs(player.x - l.x) < 38 && Math.abs((player.y - 24) - l.y) < 50) activateLever(l, false);
        });
      }
      k.interJP = false;

      // charge throw (R held)
      if (k.aim && player.rockN > 0) { player.charging = true; player.power = cl(player.power + CHARGE_SPD * dt, 0, 1); }
      else if (!k.aim && player.charging) { player.charging = false; const ang = player.faceR ? player.aim : Math.PI - player.aim; const pw = T_MIN + player.power * (T_MAX - T_MIN); player.rockN--; A.throwS(); world.rocks.push({ id: Date.now(), x: player.x + (player.faceR ? 8 : -8), y: player.y - 12, vx: Math.cos(ang) * pw + player.vx * 0.4, vy: Math.sin(ang) * pw, r: 6 + Math.random() * 2 }); player.power = 0; }
      // quick throw (F)
      if (k.quickJP && player.rockN > 0 && !player.charging) { player.rockN--; const ang = player.faceR ? 0 : Math.PI; A.throwS(); world.rocks.push({ id: Date.now(), x: player.x + (player.faceR ? 8 : -8), y: player.y - 12, vx: Math.cos(ang) * 1250 + player.vx * 0.4, vy: -60, r: 6 + Math.random() * 2 }); }
      k.quickJP = false;

      // PUNCH (G/Q) — works always, especially when out of rocks
      if (player.punchCD > 0) player.punchCD -= dt;
      if (k.punchJP && player.punchCD <= 0 && player.dashT <= 0) { player.punchT = 0.18; player.punchCD = PUNCH_CD; player.state = 'punch'; A.punch(); }
      k.punchJP = false;
      if (player.punchT > 0) { player.punchT -= dt; // apply punch damage in range
        const fx = player.x + (player.faceR ? PUNCH_RANGE : -PUNCH_RANGE);
        for (const e of world.enemies) {
          if (e.state === 'dead') continue;
          const ex = e.x + e.w / 2;
          if ((player.faceR && ex > player.x && ex < fx + 10) || (!player.faceR && ex < player.x && ex > fx - 10)) {
            if (Math.abs((e.y + e.h / 2) - (player.y - 12)) < 40) { e.hp -= PUNCH_DMG; e.dmgT = 0.2; e.kbX = (player.faceR ? 1 : -1) * PUNCH_KNOCK; A.enemyH(); if (e.hp <= 0) { e.state = 'dead'; e.deadT = 1.2; world.killed++; A.task(); burst(e.x + e.w / 2, e.y + e.h / 2, '#ef4444'); } }
          }
        }
      }

      // movement
      let md = 0; if (k.left) md -= 1; if (k.right) md += 1; if (md !== 0) player.faceR = md > 0;
      if (player.dashCD > 0) player.dashCD -= dt;
      if (k.dashJP && player.dashCD <= 0 && player.dashT <= 0) { player.dashT = DASH_T; player.dashCD = DASH_CD; player.dashDir = player.faceR ? 1 : -1; A.dash(); player.invinc = Math.max(player.invinc, DASH_T + 0.05); }
      k.dashJP = false;
      if (player.dashT > 0) { player.dashT -= dt; player.vx = player.dashDir * DASH_SPD; player.vy = 0; player.state = 'dash'; if (Math.random() < 0.5) world.particles.push({ x: player.x, y: player.y - 18, vx: -player.dashDir * 50, vy: (Math.random() - 0.5) * 30, life: 0.25, max: 0.25, size: 3 + Math.random() * 2, color: pal.accent, kind: 'spark' }); }
      else if (md !== 0) { player.vx += md * ACC * dt; player.vx = cl(player.vx, -MAXSPD, MAXSPD); }
      else { const fr = player.grounded ? FRIC_G : FRIC_A; if (player.vx > 0) { player.vx -= fr * dt; if (player.vx < 0) player.vx = 0; } else if (player.vx < 0) { player.vx += fr * dt; if (player.vx > 0) player.vx = 0; } }

      // jump
      if (k.jumpJP) player.jumpBuf = 0.14; if (player.jumpBuf > 0) player.jumpBuf -= dt;
      if (player.grounded) { player.coyote = 0.14; player.jumps = 2; } else if (player.coyote > 0) player.coyote -= dt;
      if (player.jumpBuf > 0) { if (player.coyote > 0 || player.grounded) { A.jump(); player.vy = -JUMP; player.grounded = false; player.jumpBuf = 0; player.coyote = 0; player.jumps = 1; player.squash = 0.6; player.stretch = 1.4; } else if (player.jumps > 0 && player.dashT <= 0) { A.jump(); player.vy = -JUMP * 0.9; player.jumpBuf = 0; player.jumps--; player.squash = 0.7; player.stretch = 1.3; } }
      k.jumpJP = false;
      player.squash += (1 - player.squash) * 14 * dt; player.stretch += (1 - player.stretch) * 14 * dt;
      let g = GRAVITY; if (player.vy > 0) g *= FALL_MUL; else if (player.vy < 0 && !k.jump) g *= LOWJ_MUL; player.vy += g * dt;

      // ===== collisions (previous-position resolved) =====
      // Timed gates close predictably; their lever can then be used again without duplicating puzzle credit.
      world.doors.forEach((d: Door) => {
        if (d.timer !== undefined && d.open) {
          d.timer -= dt;
          if (d.timer <= 0) {
            const occupied = hit(pR(player), d) || world.boxes.some((b: Box) => hit({ x: b.x, y: b.y, w: b.w, h: b.h }, d));
            if (occupied) d.timer = 0.25; // never close a gate inside the player or a box
            else { d.open = false; d.timer = undefined; world.levers.forEach((l: Lever) => { if (l.lid === d.id && l.timed) l.on = false; }); }
          }
        }
      });
      // Bridges animate from vertical to horizontal after a distant target is struck.
      world.bridges.forEach((b: Bridge) => { b.progress = cl(b.progress + (b.down ? dt * 2.2 : -dt * 2.2), 0, 1); });
      const bridgeSolids = world.bridges.flatMap((b: Bridge) => {
        if (b.progress > 0.92) return [{ x: b.x, y: b.y, w: b.w, h: b.h }]; // lowered crossing
        if (b.progress < 0.08) return [{ x: b.x - b.h / 2, y: b.y + b.h / 2 - b.w, w: b.h, h: b.w }]; // raised anti-bypass wall
        return []; // moving bridge is non-solid to avoid trapping the player inside it
      });
      const mp = world.mplatforms;
      const evSolids = world.elevators.map((ev: Elevator) => ({ x: ev.x, y: ev.y, w: ev.w, h: ev.h }));
      const solids = [...world.platforms.filter(p => !(p.type === 'break' && p.broken)), ...mp, ...evSolids, ...bridgeSolids, ...world.doors.filter(d => !d.open)];
      mp.forEach((m: MP) => { if (m.axis === 'y' && m.sy !== undefined && m.ey !== undefined) { m.y += m.vx * dt; if (m.vx > 0 && m.y >= m.ey) { m.y = m.ey; m.vx *= -1; } else if (m.vx < 0 && m.y <= m.sy) { m.y = m.sy; m.vx *= -1; } } else { m.x += m.vx * dt; if (m.vx > 0 && m.x >= m.ex) { m.x = m.ex; m.vx *= -1; } else if (m.vx < 0 && m.x <= m.sx) { m.x = m.sx; m.vx *= -1; } } });
      // Sub-stepped horizontal sweep prevents dash tunnelling through thin gates and raised bridges.
      const totalDX = player.vx * dt; const hSteps = Math.max(1, Math.ceil(Math.abs(totalDX) / 7)); const stepDX = totalDX / hSteps;
      let pr = pR(player); let hBlocked = false;
      for (let hs = 0; hs < hSteps && !hBlocked; hs++) {
        const prevTop = player.y - player.h, prevBottom = player.y;
        player.x += stepDX; pr = pR(player);
        for (const p of solids) {
          if (!hit(pr, p)) continue;
          const beside = !(prevBottom <= p.y + 2 || prevTop >= p.y + p.h - 2); if (!beside) continue;
          if (stepDX > 0) player.x = p.x - player.w / 2; else if (stepDX < 0) player.x = p.x + p.w + player.w / 2;
          player.vx = 0; hBlocked = true; pr = pR(player); break;
        }
        if (hBlocked) break;
        for (const b of world.boxes) {
          const br = { x: b.x, y: b.y, w: b.w, h: b.h }; if (!hit(pr, br)) continue;
          const beside = !(prevBottom <= b.y + 2 || prevTop >= b.y + b.h - 2); if (!beside) continue;
          if (stepDX > 0) { b.vx = Math.max(b.vx, player.vx * 0.6); player.x = b.x - player.w / 2; }
          else if (stepDX < 0) { b.vx = Math.min(b.vx, player.vx * 0.6); player.x = b.x + b.w + player.w / 2; }
          player.vx = 0; hBlocked = true; pr = pR(player); break;
        }
      }
      // Boxes also use sub-steps, so fast pushes cannot pass through a wall.
      for (const b of world.boxes) {
        b.vx *= 0.85; const boxDX = b.vx * dt; const bs = Math.max(1, Math.ceil(Math.abs(boxDX) / 7));
        for (let s = 0; s < bs; s++) { b.x += boxDX / bs; let br = { x: b.x, y: b.y, w: b.w, h: b.h }; let stop = false; for (const p of solids) { if (hit(br, p)) { if (boxDX > 0) b.x = p.x - b.w; else if (boxDX < 0) b.x = p.x + p.w; b.vx = 0; stop = true; break; } } if (stop) break; }
      }
      // Sub-stepped vertical sweep prevents falling through moving platforms and narrow bridge planks.
      const impactVy = player.vy; const totalDY = player.vy * dt; const vSteps = Math.max(1, Math.ceil(Math.abs(totalDY) / 7)); const stepDY = totalDY / vSteps;
      player.grounded = false; let onMove: MP | null = null; let vBlocked = false;
      for (let vs = 0; vs < vSteps && !vBlocked; vs++) {
        const beforeY = player.y, beforeTop = beforeY - player.h;
        player.y += stepDY; pr = pR(player);
        let bestY = Infinity, bestP: any = null;
        for (const p of solids) {
          if (!hit(pr, p)) continue;
          if (stepDY >= 0 && beforeY <= p.y + 2 && p.y < bestY) { bestY = p.y; bestP = p; }
          else if (stepDY < 0 && beforeTop >= p.y + p.h - 2) { player.y = p.y + p.h + player.h; player.vy = 0; vBlocked = true; pr = pR(player); break; }
        }
        if (bestP) {
          player.y = bestY; player.vy = 0; player.grounded = true; vBlocked = true;
          if (impactVy > 200) { player.squash = 1.4; player.stretch = 0.6; A.land(); }
          if (mp.includes(bestP)) onMove = bestP;
          const bp = bestP as Plat; if (bp.type === 'break' && !bp.broken) { bp.broken = true; bp.breakT = 0.4; }
          pr = pR(player); break;
        }
        for (const b of world.boxes) {
          const br = { x: b.x, y: b.y, w: b.w, h: b.h }; if (!hit(pr, br)) continue;
          if (stepDY >= 0 && beforeY <= b.y + 2) { player.y = b.y; player.vy = 0; player.grounded = true; vBlocked = true; if (impactVy > 200) { player.squash = 1.4; player.stretch = 0.6; A.land(); } pr = pR(player); break; }
          if (stepDY < 0 && beforeTop >= b.y + b.h - 2) { player.y = b.y + b.h + player.h; player.vy = 0; vBlocked = true; pr = pR(player); break; }
        }
      }
      // Box gravity with sub-steps; no fall-through at low frame rates.
      for (const b of world.boxes) {
        b.impactVy = 0; b.vy += GRAVITY * dt; const boxDY = b.vy * dt; const bs = Math.max(1, Math.ceil(Math.abs(boxDY) / 7));
        for (let s = 0; s < bs; s++) { const prevBottom = b.y + b.h, prevTop = b.y; b.y += boxDY / bs; const br = { x: b.x, y: b.y, w: b.w, h: b.h }; let stop = false; for (const p of solids) { if (!hit(br, p)) continue; if (boxDY >= 0 && prevBottom <= p.y + 2) { b.y = p.y - b.h; b.impactVy = b.vy; b.vy = 0; stop = true; break; } if (boxDY < 0 && prevTop >= p.y + p.h - 2) { b.y = p.y + p.h; b.vy = 0; stop = true; break; } } if (stop) break; }
      }
      if (onMove) { if (onMove.axis === 'x') player.x += onMove.vx * dt; else player.y += onMove.vx * dt; }
      if (player.x < player.w / 2) { player.x = player.w / 2; player.vx = 0; } if (player.x > def.width - player.w / 2) { player.x = def.width - player.w / 2; player.vx = 0; }
      world.platforms.forEach((p: Plat) => { if (p.broken && p.breakT !== undefined) p.breakT -= dt; });

      // rocks physics
      const s2 = [...solids, ...world.boxes];
      for (let i = world.rocks.length - 1; i >= 0; i--) {
        const r = world.rocks[i]; r.vy += GRAVITY * dt; r.vx *= 0.99; const px = r.x, py = r.y; r.x += r.vx * dt; r.y += r.vy * dt;
        for (const pl of s2) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && r.y + r.r > pl.y && r.y - r.r < pl.y + pl.h) { if (py + r.r <= pl.y && r.vy > 0) { r.y = pl.y - r.r; if (r.vy > 120) A.rockHit(); r.vy *= -ROCK_BOUNCE; if (Math.abs(r.vx) > 0) { r.vx -= Math.sign(r.vx) * ROCK_FRIC * dt; if (Math.abs(r.vx) < 12) r.vx = 0; } if (Math.abs(r.vy) < 50) r.vy = 0; } else if (py - r.r >= pl.y + pl.h && r.vy < 0) { r.y = pl.y + pl.h + r.r; r.vy *= -ROCK_BOUNCE; } else { if (px + r.r <= pl.x && r.vx > 0) { r.x = pl.x - r.r; r.vx *= -ROCK_BOUNCE; } else if (px - r.r >= pl.x + pl.w && r.vx < 0) { r.x = pl.x + pl.w + r.r; r.vx *= -ROCK_BOUNCE; } } } }
        world.levers.forEach((l: Lever) => {
          if (!l.on && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, { x: l.x - 10, y: l.y - 40, w: 28, h: 42 })) activateLever(l, true);
        });
        for (const hb of world.hanging) { if (!hb.hit && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, { x: hb.x, y: hb.y, w: hb.w, h: hb.h })) { hb.hit = true; world.boxes.push({ x: hb.x, y: hb.y, w: hb.w, h: hb.h, vx: 0, vy: 0 }); A.rockHit(); r.vy = -50; r.vx = r.vx > 0 ? -40 : 40; } }
        if (r.y > H + 200) world.rocks.splice(i, 1);
      }

      // enemies
      for (const e of world.enemies) {
        if (e.state === 'dead') { e.deadT -= dt; continue; }
        // knockback
        if (e.kbX !== 0) { e.x += e.kbX * dt; e.kbX *= 0.85; if (Math.abs(e.kbX) < 5) e.kbX = 0; }
        e.vy += GRAVITY * dt; const ePB = e.y + e.h; e.y += e.vy * dt; e.anim += dt;
        let er = { x: e.x, y: e.y, w: e.w, h: e.h }; e.onGround = false; let bestEY = Infinity;
        for (const p of solids) { if (hit(er, p)) { if (e.vy >= 0 && ePB <= p.y + 4 && (e.x + e.w > p.x + 1 && e.x < p.x + p.w - 1)) { if (p.y < bestEY) bestEY = p.y; } } er = { x: e.x, y: e.y, w: e.w, h: e.h }; }
        if (bestEY < Infinity) { e.y = bestEY - e.h; e.vy = 0; e.onGround = true; }
        if (e.dmgT > 0) e.dmgT -= dt;
        if (e.type === 'eagle') e.vy = Math.sin(time / 600) * 30;
        const dx = Math.abs(player.x - e.x), dy = Math.abs(player.y - e.y);
        const relevantThreat = (world.threat.kind === 'wolfpack' && e.type === 'wolf') || (world.threat.kind === 'eagle' && e.type === 'eagle');
        const pressureBoost = relevantThreat ? 1 + world.threat.level * 0.28 : 1;
        const sight = (e.type === 'eagle' ? 520 : e.type === 'lynx' ? 360 : 300) * pressureBoost;
        const inSight = dx < sight && dy < 130; const inRange = dx < 56 && dy < 50;
        if (e.type === 'snake') { e.state = 'walk'; if (e.faceR) { e.vx = 55; if (e.x > e.ex) e.faceR = false; } else { e.vx = -55; if (e.x < e.sx) e.faceR = true; } if (inRange && player.invinc <= 0) hurt(); }
        else if (e.type === 'eagle') { e.faceR = player.x > e.x; e.shootT -= dt; if (inSight && e.shootT <= 0) { e.shootT = Math.max(1.5, 2.6 - world.threat.level * 0.8); const dir = e.faceR ? 1 : -1; world.projectiles.push({ x: e.x + dir * e.w / 2, y: e.y + e.h, vx: dir * 240 * pressureBoost, vy: 50, r: 6, life: 3 }); } if (inRange && player.invinc <= 0) hurt(); }
        else { // realistic wolf speed (moderate, visible)
          if (inSight) { if (inRange) { if (e.state !== 'attack') { e.state = 'attack'; e.atkT = 0; e.faceR = player.x > e.x; A.hurt(); } e.atkT += dt; if (e.atkT > 0.45 && inRange && player.invinc <= 0) { hurt(); e.state = 'walk'; e.atkT = 0; } } else { e.state = 'walk'; e.faceR = player.x > e.x; const baseSp = e.type === 'lynx' ? 175 : e.type === 'wolf' ? 145 : e.type === 'boar' ? 120 : 125; const sp = baseSp * pressureBoost; e.vx = e.faceR ? sp : -sp; } }
          else { e.state = 'walk'; if (e.faceR) { e.vx = 65; if (e.x > e.ex) e.faceR = false; } else { e.vx = -65; if (e.x < e.sx) e.faceR = true; } }
        }
        e.x += e.vx * dt; if (e.x < e.sx) { e.x = e.sx; e.faceR = true; } if (e.x > e.ex) { e.x = e.ex; e.faceR = false; }
        // enemy vs rocks
        for (let i = world.rocks.length - 1; i >= 0; i--) { const r = world.rocks[i]; const cX = cl(r.x, e.x, e.x + e.w), cY = cl(r.y, e.y, e.y + e.h); if ((r.x - cX) ** 2 + (r.y - cY) ** 2 < r.r * r.r) { if (Math.abs(r.vx) > 60 || Math.abs(r.vy) > 60) { e.hp -= 1; e.dmgT = 0.2; A.enemyH(); if (e.hp <= 0) { e.state = 'dead'; e.deadT = 1.2; world.killed++; A.task(); burst(e.x + e.w / 2, e.y + e.h / 2, '#ef4444'); } r.vy = -50; r.vx = r.vx > 0 ? -50 : 50; } } }
        // CRUSH TRAP (Limbo-style): a falling box or rock landing on the enemy kills it instantly
        if (e.state !== 'dead') {
          for (const b of world.boxes) {
            if ((b.impactVy ?? b.vy) > 200 && hit({ x: b.x, y: b.y, w: b.w, h: b.h }, { x: e.x, y: e.y, w: e.w, h: e.h })) {
              e.hp = 0; e.state = 'dead'; e.deadT = 1.2; world.killed++; A.task(); burst(e.x + e.w / 2, e.y + e.h / 2, '#ef4444', 16);
            }
          }
          for (const r of world.rocks) {
            if (r.vy > 300 && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, { x: e.x, y: e.y, w: e.w, h: e.h })) {
              e.hp = 0; e.state = 'dead'; e.deadT = 1.2; world.killed++; A.task(); burst(e.x + e.w / 2, e.y + e.h / 2, '#ef4444', 16);
            }
          }
        }
      }
      // projectiles
      for (let i = world.projectiles.length - 1; i >= 0; i--) { const p = world.projectiles[i]; p.vy += GRAVITY * 0.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (player.invinc <= 0) { const cX = cl(p.x, player.x - player.w / 2, player.x + player.w / 2), cY = cl(p.y, player.y - player.h, player.y); if ((p.x - cX) ** 2 + (p.y - cY) ** 2 < p.r * p.r) { hurt(); world.projectiles.splice(i, 1); continue; } } if (p.life <= 0 || p.y > H + 100) world.projectiles.splice(i, 1); }
      // coins
      world.coins.forEach((c: Coin) => { c.bob += dt; if (!c.got && Math.abs(player.x - c.x) < 24 && Math.abs((player.y - 22) - c.y) < 28) { c.got = true; st.wCoins++; A.collect(); burst(c.x, c.y, pal.accent, 6); } });
      // sheep
      world.sheep.forEach((s: Sheep) => { s.bob += dt; if (!s.rescued && Math.abs(player.x - s.x) < 36 && Math.abs((player.y - 20) - s.y) < 30) { s.rescued = true; world.rescued++; A.sheep(); A.task(); burst(s.x, s.y, '#f0ece4', 10); } });
      // checkpoints
      world.checkpoints.forEach((c: Check) => { if (!c.on && Math.abs(player.x - c.x) < 38 && player.grounded) { c.on = true; A.task(); def.spawnX = c.x + 20; def.spawnY = c.y - 46; } });
      // hazards
      for (const h of world.hazards) { if (hit(pR(player), { x: h.x, y: h.y, w: h.w, h: h.h }) && player.invinc <= 0) hurt(true); }

      // pressure plates (Limbo-style: pressed while player/box/rock stands on it)
      world.plates.forEach((pl: Plate) => {
        if (!pl.solved) {
          pl.pressed = false;
          // player, boxes, and resting rocks all provide weight
          if (hit(pR(player), { x: pl.x, y: pl.y - 6, w: pl.w, h: 12 }) && player.grounded) pl.pressed = true;
          for (const b of world.boxes) { if (b.x + b.w > pl.x && b.x < pl.x + pl.w && Math.abs((b.y + b.h) - pl.y) < 12) pl.pressed = true; }
          for (const r of world.rocks) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && Math.abs((r.y + r.r) - pl.y) < 10) pl.pressed = true; }
          if (pl.pressed) { pl.solved = true; world.solved++; A.task(); burst(pl.x + pl.w / 2, pl.y - 8, pal.accent, 10); }
        }
        // Elevator plates are dynamic: the platform rises only while weight is on the plate.
        if (pl.elevatorId !== undefined) {
          pl.pressed = false;
          if (hit(pR(player), { x: pl.x, y: pl.y - 6, w: pl.w, h: 12 }) && player.grounded) pl.pressed = true;
          for (const b of world.boxes) { if (b.x + b.w > pl.x && b.x < pl.x + pl.w && Math.abs((b.y + b.h) - pl.y) < 12) pl.pressed = true; }
          for (const r of world.rocks) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && Math.abs((r.y + r.r) - pl.y) < 10) pl.pressed = true; }
          // do not latch or count as solved — it's a dynamic mechanism, not a one-shot puzzle
        } else if (pl.solved) pl.pressed = true; // Solved plates latch the mechanism permanently.
        // Door-linked plates
        if (pl.lid >= 0) world.doors.forEach((d: Door) => { if (d.id === pl.lid) d.open = !!pl.pressed; });
      });

      // Elevators: rise while their linked plate is weighed down, fall when weight is removed.
      // Player and boxes ride the elevator platform. This creates multi-step puzzles:
      // e.g. push a box onto a plate to raise an elevator, ride it to a high ledge,
      // then push the box off to lower the elevator for a different purpose.
      world.elevators.forEach((ev: Elevator) => {
        const pl = world.plates.find((p: Plate) => p.id === ev.plateId);
        const rising = pl && pl.pressed;
        const dy = (rising ? -1 : 1) * ev.speed * dt;
        ev.y = cl(ev.y + dy, ev.topY, ev.baseY);
      });

      // Environmental pressure: telegraphed, escapable, and reset-safe.
      const th = world.threat; th.timer += dt;
      if (th.kind === 'flood') {
        th.level = cl(th.timer / 150, 0, 1); th.phase = th.level > 0.62 ? 'warning' : 'calm';
        // slow, capped rise; water never consumes half the screen
        world.hazards.forEach((h: Haz) => { if (h.type === 'water' && h.y > GY - 50) h.y -= 2.4 * dt * (0.35 + th.level); });
      } else if (th.kind === 'avalanche') {
        th.level = cl(th.timer / 42, 0, 1);
        if (th.timer > 34 && th.phase === 'calm') th.phase = 'warning'; // eight-second visual/audio warning
        if (th.timer > 42 && th.phase !== 'active') { th.phase = 'active'; th.frontX = Math.max(0, player.x - 520); A.hurt(); }
        if (th.phase === 'active') {
          const safe = world.checkpoints.some((c: Check) => c.on && Math.abs(player.x - c.x) < 90);
          if (safe) {
            const shelter = world.checkpoints.filter((c: Check) => c.on).sort((a: Check, b: Check) => Math.abs(player.x - a.x) - Math.abs(player.x - b.x))[0];
            if (shelter) th.frontX = Math.min(th.frontX + 110 * dt, shelter.x - 120);
            if (th.timer > 52) { th.timer = 0; th.level = 0; th.phase = 'calm'; th.frontX = 0; }
          } else {
            th.frontX += (215 + th.level * 35) * dt;
            if (th.frontX > player.x - 32 && player.invinc <= 0) hurt(true);
          }
        }
      } else {
        th.level = cl(th.timer / 105, 0, 1); th.phase = th.level > 0.7 ? 'warning' : 'calm';
        // Wolf/eagle pressure is expressed through their AI, not unavoidable periodic damage.
      }

      // world progression: portal is always usable (smooth pass-through); tasks give bonus + feedback
      const done = world.killed >= def.goalE && world.rescued >= def.goalS && world.solved >= def.goalP;
      if (done && !world.completionAwarded) { world.completionAwarded = true; st.wCoins += 10; A.portal(); burst(player.x, player.y - 30, '#34d399', 20); }
      world.opened = true; // portal is always open — no hard lock
      // success / portal
      if (def.id === 'snow' && player.x > 4560 && player.grounded) { A.portal(); saveS({ world: WORLDS.length, coins: st.totalCoins + st.wCoins, deaths: st.deaths }); setTotalCoins(st.totalCoins + st.wCoins); clearS(); setScreen('complete'); return; }
      if (def.portal.w > 0 && hit(pR(player), { x: def.portal.x, y: def.portal.y, w: def.portal.w, h: def.portal.h })) { A.portal(); const ni = wi + 1; saveS({ world: ni, coins: st.totalCoins + st.wCoins, deaths: st.deaths }); setTotalCoins(st.totalCoins + st.wCoins); if (ni >= WORLDS.length) { clearS(); setScreen('complete'); } else { setWi(ni); setScreen('transition'); } return; }
      if (player.y > H + 80) hurt(true);
      if (player.invinc > 0) player.invinc -= dt; if (player.hitFlash > 0) player.hitFlash -= dt;

      // particles
      pT -= dt; if (pT <= 0) { pT = 0.07; const kk = def.pType; if (kk === 'snow') world.particles.push({ x: cx + Math.random() * W, y: cy - 10, vx: -18 + Math.random() * 8, vy: 40 + Math.random() * 30, life: 6, max: 6, size: 2 + Math.random() * 2, color: pal.particle, kind: 'snow' }); if (kk === 'leaf') world.particles.push({ x: cx + Math.random() * W, y: cy - 10, vx: -25 + Math.random() * 25, vy: 25 + Math.random() * 15, life: 7, max: 7, size: 3 + Math.random() * 2, color: pal.particle, kind: 'leaf' }); if (kk === 'mist') world.particles.push({ x: cx + Math.random() * W, y: cy + H * 0.7 + Math.random() * 120, vx: 30 + Math.random() * 20, vy: 0, life: 5, max: 5, size: 30 + Math.random() * 20, color: pal.particle, kind: 'mist' }); }
      for (let i = world.particles.length - 1; i >= 0; i--) { const p = world.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.kind === 'leaf') p.vx += Math.sin(p.life * 4) * 18 * dt; if (p.life <= 0) world.particles.splice(i, 1); }

      // anim
      if (player.dashT <= 0 && player.punchT <= 0) { if (!player.grounded) player.state = player.vy < 0 ? 'jump' : 'fall'; else if (Math.abs(player.vx) > 10) { const sp = Math.abs(player.vx) / MAXSPD; player.state = sp > 0.6 ? 'run' : 'walk'; player.anim += dt * 14 * sp; player.stepT += dt * sp; if (player.stepT > 0.24) { A.land(); player.stepT = 0; } } else { player.state = 'idle'; player.anim += dt; player.stepT = 0; } }

      // ===== RENDER =====
      ctx.clearRect(0, 0, W, H);
      drawSky(ctx, cx, pal, def.id); drawMountains(ctx, cx, pal);
      if (def.id === 'snow') { [200, 850, 1750, 2650, 3550].forEach((px, i) => { ctx.fillStyle = '#dce8f0'; ctx.beginPath(); ctx.moveTo(px - cx * 0.22, H); ctx.lineTo(px - cx * 0.22 + 80, H - 210 - (i % 2) * 40); ctx.lineTo(px - cx * 0.22 + 160, H); ctx.fill(); }); }
      drawFog(ctx, cx, cy, pal, 1 + world.threat.level * 0.6);
      ctx.save(); ctx.translate(-cx, -cy);
      // cedar trees anchored to actual platforms (no floating)
      if (def.id === 'cedar') { [380, 760, 1450, 2200, 2900, 3600, 4200].forEach((tx, i) => { const base = topAt(world.platforms, tx); if (base !== null) cedar(ctx, tx, base, 170 + (i % 2) * 35, i % 2 ? '#214a36' : '#2c5a3e'); }); }
      for (const h of world.hazards) drawHazard(ctx, h, time);
      for (const p of world.platforms) { if (p.type === 'break' && p.broken && (p.breakT ?? 0) <= 0) continue; drawPlatform(ctx, p, pal, def.id); }
      for (const m of mp) { ctx.fillStyle = pal.accent; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.w, m.h); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.w, 4); }
      // elevators: wooden platform on a vertical rail, linked to a weight plate
      for (const ev of world.elevators) {
        ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ev.x - 4, ev.baseY); ctx.lineTo(ev.x - 4, ev.topY); ctx.moveTo(ev.x + ev.w + 4, ev.baseY); ctx.lineTo(ev.x + ev.w + 4, ev.topY); ctx.stroke();
        ctx.fillStyle = '#795330'; ctx.fillRect(Math.round(ev.x), Math.round(ev.y), ev.w, ev.h);
        ctx.fillStyle = '#9a7042'; ctx.fillRect(Math.round(ev.x + 3), Math.round(ev.y + 3), ev.w - 6, 3);
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(Math.round(ev.x + ev.w / 2 - 2), Math.round(ev.y), 4, ev.h);
      }
      // visible mechanical cable tells the player exactly what a distant target controls
      for (const l of world.levers) { if (l.bridgeId !== undefined) { const br = world.bridges.find((b: Bridge) => b.id === l.bridgeId); if (br) { ctx.strokeStyle = 'rgba(212,168,87,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(l.x, l.y - 22); ctx.lineTo(br.x, br.y); ctx.stroke(); ctx.setLineDash([]); } } }
      for (const b of world.bridges) drawBridge(ctx, b);
      for (const l of world.levers) drawLever(ctx, l);
      for (const pl of world.plates) drawPlate(ctx, pl);
      for (const d of world.doors) {
        const ctrl = world.levers.find((l: Lever) => l.lid === d.id); const plateCtrl = world.plates.find((p: Plate) => p.lid === d.id);
        const glyph = ctrl?.seq ? String(ctrl.seq) : ctrl?.timed ? '⏱' : plateCtrl ? '⚖' : '';
        drawDoor(ctx, d, glyph);
        if (d.timer !== undefined) { ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.max(0, d.timer).toFixed(1)}s`, d.x + d.w / 2, Math.max(70, d.y - 8)); }
      }
      for (const c of world.checkpoints) drawCheck(ctx, c);
      for (const c of world.coins) { if (c.got) continue; const by = c.y + Math.sin(c.bob * 3) * 4; ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(c.x, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.x - 2, by - 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
      for (const s of world.sheep) drawSheep(ctx, s);
      for (const r of world.rocks) { ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.r), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9080'; ctx.beginPath(); ctx.arc(Math.round(r.x - 2), Math.round(r.y - 2), 2, 0, Math.PI * 2); ctx.fill(); }
      for (const b of world.boxes) { ctx.fillStyle = '#6a4a30'; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(Math.round(b.x + 4), Math.round(b.y + 4), b.w - 8, b.h - 8); ctx.strokeStyle = '#4a2e1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x, b.y + b.h); ctx.stroke(); }
      for (const hb of world.hanging) { if (!hb.hit) { ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hb.x + hb.w / 2, cy); ctx.lineTo(hb.x + hb.w / 2, hb.y); ctx.stroke(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(Math.round(hb.x), Math.round(hb.y), hb.w, hb.h); } }
      for (const e of world.enemies) { if (e.state === 'dead' && e.deadT <= 0) continue; drawEnemy(ctx, e); }
      for (const p of world.projectiles) drawProj(ctx, p);
      if (def.portal.w > 0) drawPortal(ctx, def.portal, time, pal, world.opened);
      drawPlayer(ctx, player);
      for (const p of world.particles) { const a = Math.max(0, p.life / p.max); ctx.globalAlpha = a * (p.kind === 'mist' ? 0.2 : 1); ctx.fillStyle = p.color; if (p.kind === 'mist') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
      ctx.globalAlpha = 1; ctx.restore();
      // Avalanche is visible, telegraphed, and escapable; checkpoints act as shelters.
      if (def.id === 'snow' && world.threat.phase === 'warning') {
        const pulse = 0.35 + Math.sin(time / 160) * 0.18;
        ctx.fillStyle = `rgba(220,240,250,${pulse})`; ctx.fillRect(0, 0, W, 5);
        ctx.fillStyle = '#e0f2fe'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚠ انهيار ثلجي قادم — تحرّك نحو أكوماس الحماية', W / 2, 92);
      }
      if (def.id === 'snow' && world.threat.phase === 'active') {
        const fx = world.threat.frontX - cx;
        const grad = ctx.createLinearGradient(Math.max(0, fx - 230), 0, fx + 30, 0);
        grad.addColorStop(0, 'rgba(210,232,244,0.2)'); grad.addColorStop(1, 'rgba(245,252,255,0.92)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, Math.max(0, fx + 30), H);
        ctx.fillStyle = 'rgba(245,252,255,0.9)';
        for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(fx - (i % 3) * 18, H - 70 - Math.floor(i / 3) * 35 + Math.sin(time / 90 + i) * 8, 45 + (i % 2) * 18, 0, Math.PI * 2); ctx.fill(); }
      }
      // threat vignette
      if (world.threat.level > 0.3) { ctx.fillStyle = `rgba(0,0,0,${world.threat.level * 0.18})`; ctx.fillRect(0, 0, W, H); }
      // contextual puzzle affordances: clear goal, no pixel-hunt ambiguity
      const nearTarget = world.levers.find((l: Lever) => l.target && !l.on && Math.abs(player.x - l.x) < 360);
      const nearPlate = world.plates.find((pl: Plate) => !pl.solved && Math.abs(player.x - pl.x) < 250);
      const nextSeq = world.levers.find((l: Lever) => l.seq === world.seqProgress + 1 && !l.on && Math.abs(player.x - l.x) < 280);
      if (world.seqFailed || nearTarget || nearPlate || nextSeq) {
        const msg = world.seqFailed ? 'ترتيب غير صحيح — ارجع إلى الرافعة رقم 1' : nearTarget ? 'العلامة متصلة بالجسر — أصِب مركزها بحجر' : nearPlate ? 'ضع صندوقاً أو حجراً على صفيحة الوزن' : `الرافعة التالية في التسلسل: ${nextSeq?.seq}`;
        ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(W / 2 - 160, H - 76, 320, 27);
        ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H - 58);
      }
      // progress hint near portal (encouraging, not blocking)
      if (def.portal.w > 0 && Math.abs(player.x - def.portal.x) < 130) {
        const pct = Math.round(((world.killed / def.goalE) + (world.rescued / def.goalS) + (world.solved / def.goalP)) / 3 * 100);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 140, H - 48, 280, 30);
        ctx.fillStyle = pct >= 100 ? '#34d399' : '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(pct >= 100 ? 'أكملت كل المهام! ادخل البوابة ⵎⴽⵙⴰ' : `تقدم المهام: ${pct}% — ادخل البوابة للمواصلة`, W / 2, H - 30);
      }
      drawHUD(ctx, def, player, st.wCoins, st.deaths, world.killed, world.rescued, world.solved, world.threat.level, world.streak);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cancelAnimationFrame(raf); };
  }, [screen, wi]);

  if (screen === 'title') return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center font-sans p-6" style={{ background: 'linear-gradient(160deg,#16342a,#0f172a 60%,#020617)' }}>
      <div className="max-w-xl w-full text-center space-y-6 p-10 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-amber-900/40 shadow-2xl">
        <div className="space-y-2">
          <div className="text-amber-400 text-6xl font-black tracking-widest">ⴰⵎⴽⵙⴰ</div>
          <h1 className="text-4xl font-black text-white">أمكسا</h1>
          <p className="text-amber-200/70 text-sm">الراعي — رحلة في جبال الأطلس المتوسط</p>
        </div>
        {/* Language selection */}
        <div className="space-y-2">
          <p className="text-slate-400 text-xs">اختر اللغة / Choose language / Choisissez la langue</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setLang('ar')} className={`py-3 rounded-xl font-bold transition-all ${lang === 'ar' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>العربية</button>
            <button onClick={() => setLang('en')} className={`py-3 rounded-xl font-bold transition-all ${lang === 'en' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>English</button>
            <button onClick={() => setLang('fr')} className={`py-3 rounded-xl font-bold transition-all ${lang === 'fr' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Français</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950/50 rounded-xl p-4 border border-slate-800">
          <span>الأسهم / A·D: حركة</span><span>مسافة / W: قفز (مزدوج)</span>
          <span>Shift / L: انقضاض</span><span>E: التقاط / مفاتيح</span>
          <span>R: تصويب (اضغط للقوة)</span><span>F: رمي سريع</span>
          <span>G / Q: لكمة (دائماً)</span><span>الغنم/الأعداء اختيارية — الألغاز تفتح الطريق</span>
        </div>
        <div className="flex flex-col gap-3">
          <button disabled={!lang} onClick={() => start(false)} className={`w-full py-4 font-black text-xl rounded-full transition-all shadow-lg ${lang ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}>ابدأ الرحلة</button>
          {hasSave && lang && <button onClick={() => start(true)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-full transition-all border border-slate-700">استئناف</button>}
        </div>
      </div>
    </div>
  );
  if (screen === 'intro') {
    const cur = STORY[storyIdx];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans p-8 relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#16342a,#0a1814 70%,#020610)' }}>
        {/* drifting cedar silhouettes backdrop */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute bottom-0 left-10 w-2 h-40 bg-[#0f2a1c] rounded-t" />
          <div className="absolute bottom-0 left-1/4 w-3 h-56 bg-[#0c2417] rounded-t" />
          <div className="absolute bottom-0 right-1/4 w-2 h-44 bg-[#102e1e] rounded-t" />
          <div className="absolute bottom-0 right-12 w-3 h-52 bg-[#0c2417] rounded-t" />
        </div>
        <div className="relative z-10 max-w-2xl w-full text-center space-y-6">
          <div className="text-amber-400 text-4xl font-black tracking-widest opacity-80">ⴰⵎⴽⵙⴰ</div>
          <div className="space-y-4 min-h-[220px] flex flex-col justify-center">
            {lang === 'ar' && <p key={`ar-${storyIdx}`} className="text-amber-200 text-2xl leading-relaxed font-medium" style={{ animation: 'fadein 1.2s ease' }}>{cur.ar}</p>}
            <p key={`en-${storyIdx}`} dir="ltr" className="text-slate-300 text-lg leading-relaxed" style={{ animation: 'fadein 1.2s ease 0.2s both' }}>{cur.en}</p>
            <p key={`fr-${storyIdx}`} dir="ltr" className="text-slate-400 text-lg leading-relaxed" style={{ animation: 'fadein 1.2s ease 0.4s both' }}>{cur.fr}</p>
          </div>
          <div className="flex justify-center gap-1.5">
            {STORY.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i <= storyIdx ? 'bg-amber-500 w-6' : 'bg-slate-700 w-3'}`} />)}
          </div>
        </div>
        <style>{`@keyframes fadein{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }
  if (screen === 'transition') { const d = WORLDS[wi](); const pal = d.pal; return (<div dir="rtl" className="min-h-screen flex flex-col items-center justify-center font-sans" style={{ background: `linear-gradient(160deg, ${pal.skyTop}, ${pal.skyBot})` }}><div className="text-center space-y-3 animate-pulse"><div className="text-white/70 text-lg tracking-widest">{d.sub}</div><div className="text-5xl text-white font-black drop-shadow-2xl">{d.tif}</div><h1 className="text-5xl font-black text-white drop-shadow-2xl">{d.name}</h1><div className="mt-6 w-48 h-1 mx-auto bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-white" style={{ animation: 'lb 1.4s ease-in-out forwards' }} /></div></div><style>{`@keyframes lb{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style></div>); }
  if (screen === 'reset') return (<div dir="rtl" className="min-h-screen flex flex-col items-center justify-center font-sans p-6" style={{ background: 'linear-gradient(160deg,#3a1414,#0f0a0a)' }}><div className="max-w-lg text-center space-y-6 p-10 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-red-800/40 shadow-2xl"><h1 className="text-3xl font-black text-red-400">سقطت ثلاث مرات</h1><p className="text-slate-300 leading-relaxed">لقد متّ ثلاث مرات متتابعة في هذا العالم. ستعيده من البداية، وتفقد تقدم مهامه — لكن شجاعتك تبقى.</p><button onClick={() => setScreen('transition')} className="mt-2 w-full py-4 bg-red-700 hover:bg-red-600 text-white font-bold text-xl rounded-full transition-all">أعد العالم من البداية</button></div></div>);
  if (screen === 'puzzle' && activePuzzle) {
    const pz = activePuzzle;
    const submit = () => {
      if (puzzleSelected < 0) return;
      if (puzzleSelected === pz.answer) {
        A.task(); if (puzzleCallback) puzzleCallback(); setScreen('playing'); setActivePuzzle(null);
      } else {
        setPuzzleWrong(puzzleSelected); A.hurt();
        setTimeout(() => setPuzzleWrong(null), 600);
      }
    };
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center font-sans p-6" style={{ background: 'linear-gradient(160deg,#16342a,#0f172a)' }}>
        <div className="max-w-md w-full space-y-5 p-8 rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-amber-800/40 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="text-amber-400 text-3xl font-black">ⴰⵎⴽⵙⴰ — لغز</div>
            <p className="text-slate-200 text-lg leading-relaxed">{pz.prompt}</p>
          </div>
          {pz.symbols && (
            <div className="flex justify-center items-center gap-3 py-3">
              {pz.symbols.map((s, i) => (
                <span key={i} className={`text-4xl font-black ${s === '?' ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>{s}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {pz.choices.map((c, i) => (
              <button key={i} onClick={() => setPuzzleSelected(i)}
                className={`py-4 rounded-2xl font-black text-xl transition-all border-2
                  ${puzzleWrong === i ? 'bg-red-700 border-red-500 text-white' :
                    puzzleSelected === i ? 'bg-amber-600 border-amber-400 text-white shadow-lg' :
                    'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                {c}
              </button>
            ))}
          </div>
          {puzzleShowHint && pz.hint && <p className="text-amber-300/70 text-sm text-center">{pz.hint}</p>}
          <div className="flex gap-3">
            <button onClick={() => setPuzzleShowHint(true)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl transition-all text-sm">تلميح</button>
            <button onClick={submit} disabled={puzzleSelected < 0} className={`flex-1 py-3 font-bold rounded-xl transition-all ${puzzleSelected >= 0 ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>تأكيد</button>
            <button onClick={() => { setScreen('playing'); setActivePuzzle(null); }} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl transition-all text-sm">رجوع</button>
          </div>
        </div>
      </div>
    );
  }
  if (screen === 'complete') return (<div dir="rtl" className="min-h-screen flex flex-col items-center justify-center font-sans p-6" style={{ background: 'linear-gradient(160deg,#16342a,#0f172a)' }}><div className="max-w-lg text-center space-y-6 p-10 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-amber-700/40 shadow-2xl"><div className="text-amber-400 text-6xl font-black">ⴰⵎⴽⵙⴰ</div><h1 className="text-4xl font-black text-emerald-400">لمّ الراعي قطيعه!</h1><p className="text-slate-300 leading-relaxed">اجتزت غابة الأرز، المرتفعات، مضيق أم الربيع، والقمم الثلجية — وجمعت غنمك وعُدت إلى الجبل.</p><div className="text-2xl text-amber-400 font-bold">العملات: {totalCoins}</div><button onClick={() => setScreen('title')} className="mt-2 w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xl rounded-full transition-all">العودة للبداية</button></div></div>);
  return (<div dir="rtl" className="min-h-screen bg-[#020617] flex flex-col items-center justify-center font-sans"><div className="relative rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)] ring-1 ring-slate-700"><canvas ref={ref} width={W} height={H} className="block bg-[#0f172a]" style={{ touchAction: 'none' }} /></div><div className="mt-3 text-slate-500 text-xs text-center px-4">الأسهم حركة • مسافة قفز (مرتان) • Shift انقضاض • E التقاط/مفاتيح • R تصويب (اضغط للقوة) • F رمي سريع • G/Q لكمة</div></div>);
}
