import React, { useEffect, useRef, useState } from 'react';

// ============================================================
// AMKSA — Worlds of the Abyss  (Metroidvania redesign)
// ============================================================

// --- Physics Constants (kept from proven original, slightly tuned) ---
const GRAVITY = 1800;
const FALL_MULTIPLIER = 2.5;
const LOW_JUMP_MULTIPLIER = 2.5;
const JUMP_FORCE = 750;
const MAX_SPEED = 320;
const ACCELERATION = 1300;
const FRICTION_GROUND = 900;
const FRICTION_AIR = 400;

const DASH_SPEED = 780;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 0.5;

const ROCK_BOUNCE = 0.4;
const ROCK_FRICTION = 200;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

const MAX_HEALTH = 3;

// --- Power-up constants ---
const POWERUP_DURATION = 8;          // seconds for timed buffs (speed, triple jump)
const POWERUP_BOOST_SPEED = 520;     // max speed while Speed power-up active
const POWERUP_BOOST_ACCEL = 1800;    // acceleration while Speed active
const TRIPLE_JUMP_BONUS_JUMPS = 2;   // extra air jumps with Triple Jump power-up (on top of base 2)

// ============================================================
// Audio Engine  (per-world music + SFX)
// ============================================================
type MusicStyle = 'forest' | 'desert' | 'ice' | 'volcano' | 'menu';

class AudioEngine {
  ctx: AudioContext | null = null;
  isMusicPlaying = false;
  musicTimer: ReturnType<typeof setTimeout> | null = null;
  beat = 0;
  currentStyle: MusicStyle = 'menu';

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  playJump() { this.blip(160, 0.12, 'square', 0.05); this.blip(320, 0.1, 'square', 0.03, 0.03); }
  playDash() { this.blip(420, 0.14, 'sawtooth', 0.06); }
  playDoubleJump() { this.blip(280, 0.12, 'triangle', 0.06); this.blip(560, 0.1, 'triangle', 0.04, 0.04); }
  playRockImpact() { this.blip(180, 0.1, 'sawtooth', 0.1); this.blip(90, 0.12, 'sawtooth', 0.06, 0.02); }
  playThrow() { this.blip(420, 0.1, 'sine', 0.05); }
  playHit() { this.blip(120, 0.25, 'sawtooth', 0.12); this.blip(70, 0.3, 'square', 0.08, 0.02); }
  playEnemyHurt() { this.blip(220, 0.08, 'square', 0.07); }
  playCoin() { this.blip(880, 0.08, 'square', 0.05); this.blip(1320, 0.1, 'square', 0.04, 0.05); }
  playCheckpoint() { this.blip(523, 0.12, 'triangle', 0.06); this.blip(659, 0.12, 'triangle', 0.06, 0.1); this.blip(784, 0.18, 'triangle', 0.06, 0.2); }
  playPortal() { this.blip(392, 0.3, 'sine', 0.07); this.blip(587, 0.4, 'sine', 0.06, 0.1); this.blip(784, 0.5, 'sine', 0.05, 0.2); }
  playStep() { this.blip(140, 0.05, 'triangle', 0.03); }
  playPowerup() { this.blip(659, 0.1, 'square', 0.06); this.blip(880, 0.1, 'square', 0.06, 0.08); this.blip(1175, 0.18, 'square', 0.06, 0.16); }
  playShieldBreak() { this.blip(200, 0.25, 'sawtooth', 0.08); this.blip(120, 0.3, 'square', 0.06, 0.02); }

  // --- Music: different scales/moods per world ---
  private musicFor(style: MusicStyle) {
    switch (style) {
      case 'forest':
        return { bass: [130.81, 196.0, 174.61, 196.0], mel: [392, 440, 523, 440, 392, 349, 293, 349], bpm: 260, mType: 'triangle' as OscillatorType, bType: 'sine' as OscillatorType };
      case 'desert':
        return { bass: [98, 110, 146.83, 110], mel: [440, 523, 587, 523, 466, 392, 349, 392], bpm: 230, mType: 'square' as OscillatorType, bType: 'triangle' as OscillatorType };
      case 'ice':
        return { bass: [87.31, 130.81, 116.54, 130.81], mel: [698, 784, 880, 784, 698, 622, 523, 622], bpm: 200, mType: 'sine' as OscillatorType, bType: 'sine' as OscillatorType };
      case 'volcano':
        return { bass: [65.41, 87.31, 73.42, 87.31], mel: [330, 392, 466, 392, 349, 311, 261, 311], bpm: 280, mType: 'sawtooth' as OscillatorType, bType: 'square' as OscillatorType };
      default:
        return { bass: [130.81, 98, 116.54, 98], mel: [261, 329, 392, 329, 293, 261, 233, 261], bpm: 240, mType: 'square' as OscillatorType, bType: 'triangle' as OscillatorType };
    }
  }

  startMusic(style: MusicStyle = 'menu') {
    if (!this.ctx) return;
    if (this.isMusicPlaying && this.currentStyle === style) return;
    this.stopMusic();
    this.currentStyle = style;
    this.isMusicPlaying = true;
    this.beat = 0;
    const cfg = this.musicFor(style);
    const beatDur = 60000 / cfg.bpm / 2;

    const playBeat = () => {
      if (!this.isMusicPlaying || !this.ctx) return;
      const b = this.beat;
      const time = this.ctx.currentTime;
      if (b % 4 === 0) {
        const bo = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bo.type = cfg.bType;
        bo.frequency.value = cfg.bass[(b / 4) % cfg.bass.length];
        bg.gain.setValueAtTime(0.05, time);
        bg.gain.exponentialRampToValueAtTime(0.001, time + 0.9);
        bo.connect(bg); bg.connect(this.ctx.destination);
        bo.start(time); bo.stop(time + 0.9);
      }
      const mo = this.ctx.createOscillator();
      const mg = this.ctx.createGain();
      mo.type = cfg.mType;
      mo.frequency.value = cfg.mel[b % cfg.mel.length];
      mg.gain.setValueAtTime(0.02, time);
      mg.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      mo.connect(mg); mg.connect(this.ctx.destination);
      mo.start(time); mo.stop(time + 0.25);
      this.beat++;
      this.musicTimer = setTimeout(playBeat, beatDur);
    };
    playBeat();
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }
}

const audio = new AudioEngine();

// ============================================================
// Type Definitions
// ============================================================
interface PlayerState {
  x: number; y: number; vx: number; vy: number;
  width: number; height: number;
  isGrounded: boolean; facingRight: boolean;
  animTimer: number; stepTimer: number;
  state: 'idle' | 'run' | 'jump' | 'fall' | 'dash' | 'hit';
  jumpBuffer: number; coyoteTime: number;
  jumpsLeft: number;
  squash: number; stretch: number;
  rockCount: number;
  isCharging: boolean; chargeLevel: number; chargeDir: number; relativeAimAngle: number;
  health: number;
  invincibleTimer: number;
  dashTimer: number; dashCooldown: number; dashDir: number;
  hitFlash: number;
  // power-up state
  speedTimer: number;       // >0 while Speed boost active
  shieldTimer: number;      // >0 while Shield active (extra life-style protection)
  tripleJumpTimer: number;  // >0 while Triple Jump ability active
}

type PowerUpType = 'speed' | 'shield' | 'triplejump';
interface PowerUp { x: number; y: number; type: PowerUpType; collected: boolean; bob: number; }

interface Rock { id: number; x: number; y: number; vx: number; vy: number; radius: number; fromPlayer: boolean; }

interface Box { x: number; y: number; w: number; h: number; vx: number; vy: number; }

interface HangingBox { x: number; y: number; w: number; h: number; hit: boolean; }

interface Platform {
  x: number; y: number; w: number; h: number;
  type: 'normal' | 'pillar' | 'goal' | 'wall' | 'crate' | 'ice' | 'sand' | 'stone' | 'breakable';
  label?: string; cachedGradient?: CanvasGradient; broken?: boolean; breakTimer?: number;
}

interface MovingPlatform { x: number; y: number; w: number; h: number; startX: number; endX: number; speed: number; active: boolean; vx: number; axis: 'x' | 'y'; startY?: number; endY?: number; }

interface Button { x: number; y: number; w: number; h: number; active: boolean; }

interface Coin { x: number; y: number; collected: boolean; bob: number; }

interface Checkpoint { x: number; y: number; activated: boolean; }

interface Portal { x: number; y: number; w: number; h: number; toWorld: number; active: boolean; }

type EnemyType = 'wolf' | 'scorpion' | 'icebeast' | 'lavalizard';
interface Enemy {
  type: EnemyType;
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  health: number; maxHealth: number;
  state: 'idle' | 'run' | 'attack' | 'dead' | 'hurt';
  facingRight: boolean; startX: number; endX: number;
  damageTimer: number; attackTimer: number;
  shootTimer: number; onGround: boolean; animTimer: number; deadTimer: number;
}

interface Projectile { x: number; y: number; vx: number; vy: number; radius: number; fromEnemy: boolean; life: number; type: 'fireball' | 'sting' | 'iceshard'; }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; type: 'snow' | 'sand' | 'ash' | 'leaves' | 'spark' | 'ember'; }

interface Hazard { x: number; y: number; w: number; h: number; type: 'lava' | 'spikes' | 'ice' | 'quicksand'; }

// ============================================================
// World Definitions
// ============================================================
interface WorldPalette {
  skyTop: string; skyBottom: string; far: string; mid: string; near: string;
  ground: string; groundTop: string; accent: string; particle: string;
}

interface WorldDef {
  id: string; name: string; subtitle: string; width: number;
  palette: WorldPalette;
  particleType: Particle['type'];
  spawnX: number; spawnY: number;
  platforms: Platform[];
  movingPlatforms: MovingPlatform[];
  buttons: Button[];
  enemies: Enemy[];
  coins: Coin[];
  powerups: PowerUp[];
  rocks: Rock[];
  boxes: Box[];
  hangingBoxes: HangingBox[];
  hazards: Hazard[];
  checkpoints: Checkpoint[];
  portal: Portal;
}

function mkEnemy(type: EnemyType, x: number, y: number, startX: number, endX: number): Enemy {
  const stats: Record<EnemyType, { w: number; h: number; hp: number }> = {
    wolf: { w: 50, h: 32, hp: 2 },
    scorpion: { w: 46, h: 28, hp: 2 },
    icebeast: { w: 54, h: 40, hp: 3 },
    lavalizard: { w: 52, h: 34, hp: 3 },
  };
  const s = stats[type];
  return {
    type, x, y, w: s.w, h: s.h, vx: 0, vy: 0,
    health: s.hp, maxHealth: s.hp, state: 'idle', facingRight: false,
    startX, endX, damageTimer: 0, attackTimer: 0, shootTimer: Math.random() * 2,
    onGround: false, animTimer: 0, deadTimer: 0,
  };
}

const Y_GROUND = 470;

// ---------- WORLD 1: FOREST ----------
function worldForest(): WorldDef {
  const platforms: Platform[] = [
    { x: 0, y: Y_GROUND, w: 360, h: 800, type: 'normal', label: 'غابة الفجر' },
    { x: 470, y: 410, w: 70, h: 800, type: 'pillar' },
    { x: 620, y: 360, w: 70, h: 800, type: 'pillar' },
    { x: 780, y: 400, w: 70, h: 800, type: 'pillar' },
    { x: 940, y: 330, w: 80, h: 800, type: 'normal' },
    { x: 1200, y: 400, w: 60, h: 800, type: 'pillar' },
    { x: 1120, y: Y_GROUND, w: 260, h: 800, type: 'normal' },
    { x: 1480, y: 380, w: 70, h: 800, type: 'pillar' },
    { x: 1640, y: 300, w: 70, h: 800, type: 'pillar' },
    { x: 1800, y: 380, w: 70, h: 800, type: 'pillar' },
    { x: 1960, y: Y_GROUND, w: 300, h: 800, type: 'normal' },
    { x: 2150, y: 340, w: 70, h: 800, type: 'pillar' },
    { x: 2360, y: 380, w: 70, h: 800, type: 'pillar' },
    { x: 2520, y: 300, w: 70, h: 800, type: 'pillar' },
    { x: 2680, y: 240, w: 90, h: 800, type: 'normal' },
    { x: 2880, y: Y_GROUND, w: 520, h: 800, type: 'normal', label: 'معبر الأشجار' },
    { x: 3520, y: 400, w: 70, h: 800, type: 'pillar' },
    { x: 3680, y: 330, w: 70, h: 800, type: 'pillar' },
    { x: 3840, y: 400, w: 70, h: 800, type: 'pillar' },
    { x: 4000, y: Y_GROUND, w: 700, h: 800, type: 'normal', label: 'بوابة الصحراء' },
  ];
  return {
    id: 'forest', name: 'غابة الفجر', subtitle: 'العالم الأول', width: 4700,
    palette: { skyTop: '#0b3d2e', skyBottom: '#1a5e4a', far: '#0e4a38', mid: '#126b4f', near: '#15803d', ground: '#1e3a2a', groundTop: '#22c55e', accent: '#fbbf24', particle: '#86efac' },
    particleType: 'leaves',
    spawnX: 80, spawnY: Y_GROUND - 48,
    platforms,
    movingPlatforms: [
      { x: 3080, y: 360, w: 120, h: 18, startX: 3080, endX: 3400, speed: 110, active: true, vx: 110, axis: 'x' },
    ],
    buttons: [],
    enemies: [
      mkEnemy('wolf', 1300, Y_GROUND - 32, 1180, 1380),
      mkEnemy('wolf', 2050, Y_GROUND - 32, 1980, 2240),
      mkEnemy('wolf', 3000, Y_GROUND - 32, 2900, 3380),
      mkEnemy('wolf', 4150, Y_GROUND - 32, 4010, 4650),
    ],
    coins: (() => {
      const c: Coin[] = [];
      const spots: [number, number][] = [[200, 420], [680, 320], [1640, 260], [2000, 420], [2720, 200], [3050, 320], [4100, 420], [4350, 420]];
      spots.forEach(([x, y], i) => c.push({ x, y, collected: false, bob: i * 0.5 }));
      return c;
    })(),
    powerups: [
      { x: 1640, y: 220, type: 'shield', collected: false, bob: 0 },
      { x: 2720, y: 160, type: 'speed', collected: false, bob: 1 },
      { x: 4100, y: 370, type: 'triplejump', collected: false, bob: 2 },
    ],
    rocks: [
      { id: 1, x: 250, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 2, x: 1150, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 3, x: 2920, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
    ],
    boxes: [{ x: 3720, y: Y_GROUND - 60, w: 60, h: 60, vx: 0, vy: 0 }],
    hangingBoxes: [],
    hazards: [],
    checkpoints: [
      { x: 1120, y: Y_GROUND, activated: false },
      { x: 2880, y: Y_GROUND, activated: false },
    ],
    portal: { x: 4520, y: Y_GROUND - 140, w: 70, h: 140, toWorld: 1, active: true },
  };
}

// ---------- WORLD 2: DESERT ----------
function worldDesert(): WorldDef {
  const platforms: Platform[] = [
    { x: 0, y: Y_GROUND, w: 400, h: 800, type: 'sand', label: 'صحراء الرمال' },
    { x: 520, y: 430, w: 80, h: 800, type: 'sand' },
    { x: 680, y: 380, w: 80, h: 800, type: 'sand' },
    { x: 840, y: 430, w: 80, h: 800, type: 'sand' },
    { x: 1000, y: Y_GROUND, w: 320, h: 800, type: 'sand' },
    { x: 1220, y: 400, w: 70, h: 800, type: 'stone' },
    { x: 1420, y: 360, w: 70, h: 800, type: 'stone' },
    { x: 1580, y: 280, w: 70, h: 800, type: 'stone' },
    { x: 1740, y: 360, w: 70, h: 800, type: 'stone' },
    { x: 1900, y: Y_GROUND, w: 280, h: 800, type: 'sand' },
    { x: 2090, y: 350, w: 70, h: 800, type: 'stone' },
    { x: 2300, y: 400, w: 80, h: 800, type: 'stone' },
    { x: 2480, y: 350, w: 80, h: 800, type: 'stone' },
    { x: 2660, y: 400, w: 80, h: 800, type: 'stone' },
    { x: 2840, y: Y_GROUND, w: 420, h: 800, type: 'sand', label: 'واحة العقب' },
    { x: 3150, y: 410, w: 70, h: 800, type: 'stone' },
    { x: 3340, y: 410, w: 70, h: 800, type: 'stone' },
    { x: 3360, y: 390, w: 70, h: 800, type: 'stone' },
    { x: 3520, y: 320, w: 70, h: 800, type: 'stone' },
    { x: 3680, y: 390, w: 70, h: 800, type: 'stone' },
    { x: 3840, y: Y_GROUND, w: 760, h: 800, type: 'sand', label: 'بوابة الجليد' },
  ];
  return {
    id: 'desert', name: 'صحراء الرمال', subtitle: 'العالم الثاني', width: 4700,
    palette: { skyTop: '#b45309', skyBottom: '#fbbf24', far: '#a16207', mid: '#ca8a04', near: '#d97706', ground: '#92400e', groundTop: '#fcd34d', accent: '#fb923c', particle: '#fde68a' },
    particleType: 'sand',
    spawnX: 80, spawnY: Y_GROUND - 48,
    platforms,
    movingPlatforms: [
      { x: 2200, y: 320, w: 110, h: 18, startX: 2200, endX: 2300, speed: 90, active: true, vx: 90, axis: 'y', startY: 280, endY: 380 },
      { x: 3260, y: 380, w: 100, h: 18, startX: 3260, endX: 3360, speed: 100, active: true, vx: 100, axis: 'x' },
    ],
    buttons: [],
    enemies: [
      mkEnemy('scorpion', 1050, Y_GROUND - 28, 1020, 1300),
      mkEnemy('scorpion', 1970, Y_GROUND - 28, 1920, 2160),
      mkEnemy('scorpion', 2950, Y_GROUND - 28, 2860, 3240),
      mkEnemy('wolf', 2970, Y_GROUND - 32, 2880, 3240),
      mkEnemy('scorpion', 4000, Y_GROUND - 28, 3860, 4520),
      mkEnemy('lavalizard', 4250, Y_GROUND - 34, 3860, 4520),
    ],
    coins: (() => {
      const c: Coin[] = [];
      const spots: [number, number][] = [[220, 420], [720, 340], [1600, 240], [1970, 420], [2520, 310], [2950, 420], [3560, 280], [4100, 420], [4450, 420]];
      spots.forEach(([x, y], i) => c.push({ x, y, collected: false, bob: i * 0.5 }));
      return c;
    })(),
    powerups: [
      { x: 1600, y: 200, type: 'speed', collected: false, bob: 0 },
      { x: 2950, y: 370, type: 'triplejump', collected: false, bob: 1 },
      { x: 4450, y: 370, type: 'shield', collected: false, bob: 2 },
    ],
    rocks: [
      { id: 1, x: 250, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 2, x: 1030, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 3, x: 2870, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 4, x: 3870, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
    ],
    boxes: [{ x: 3740, y: Y_GROUND - 60, w: 60, h: 60, vx: 0, vy: 0 }],
    hangingBoxes: [],
    hazards: [{ x: 2180, y: Y_GROUND, w: 660, h: 60, type: 'quicksand' }],
    checkpoints: [
      { x: 1000, y: Y_GROUND, activated: false },
      { x: 2840, y: Y_GROUND, activated: false },
    ],
    portal: { x: 4520, y: Y_GROUND - 140, w: 70, h: 140, toWorld: 2, active: true },
  };
}

// ---------- WORLD 3: ICE CAVES ----------
function worldIce(): WorldDef {
  const platforms: Platform[] = [
    { x: 0, y: Y_GROUND, w: 380, h: 800, type: 'ice', label: 'كهوف الجليد' },
    { x: 500, y: 420, w: 80, h: 800, type: 'ice' },
    { x: 660, y: 350, w: 80, h: 800, type: 'ice' },
    { x: 820, y: 280, w: 80, h: 800, type: 'ice' },
    { x: 980, y: 350, w: 80, h: 800, type: 'ice' },
    { x: 1140, y: Y_GROUND, w: 280, h: 800, type: 'ice' },
    { x: 1260, y: 400, w: 70, h: 800, type: 'ice' },
    { x: 1540, y: 380, w: 70, h: 800, type: 'ice' },
    { x: 1700, y: 300, w: 70, h: 800, type: 'ice' },
    { x: 1860, y: 380, w: 70, h: 800, type: 'ice' },
    { x: 2020, y: Y_GROUND, w: 260, h: 800, type: 'ice' },
    { x: 2200, y: 340, w: 70, h: 800, type: 'ice' },
    { x: 2420, y: 360, w: 70, h: 800, type: 'ice' },
    { x: 2580, y: 260, w: 70, h: 800, type: 'ice' },
    { x: 2740, y: 360, w: 70, h: 800, type: 'ice' },
    { x: 2900, y: Y_GROUND, w: 480, h: 800, type: 'ice', label: 'القلب المتجمد' },
    { x: 3300, y: 420, w: 70, h: 800, type: 'ice' },
    { x: 3440, y: 410, w: 70, h: 800, type: 'ice' },
    { x: 3520, y: 400, w: 70, h: 800, type: 'ice' },
    { x: 3680, y: 320, w: 70, h: 800, type: 'ice' },
    { x: 3840, y: 400, w: 70, h: 800, type: 'ice' },
    { x: 4000, y: Y_GROUND, w: 760, h: 800, type: 'ice', label: 'بوابة البركان' },
  ];
  return {
    id: 'ice', name: 'كهوف الجليد', subtitle: 'العالم الثالث', width: 4800,
    palette: { skyTop: '#0c4a6e', skyBottom: '#38bdf8', far: '#075985', mid: '#0369a1', near: '#0ea5e9', ground: '#0c4a6e', groundTop: '#e0f2fe', accent: '#22d3ee', particle: '#e0f2fe' },
    particleType: 'snow',
    spawnX: 80, spawnY: Y_GROUND - 48,
    platforms,
    movingPlatforms: [
      { x: 1450, y: 320, w: 110, h: 16, startX: 1450, endX: 1540, speed: 120, active: true, vx: 120, axis: 'y', startY: 280, endY: 400 },
      { x: 3400, y: 360, w: 110, h: 16, startX: 3400, endX: 3520, speed: 110, active: true, vx: 110, axis: 'x' },
    ],
    buttons: [],
    enemies: [
      mkEnemy('icebeast', 1170, Y_GROUND - 40, 1150, 1410),
      mkEnemy('icebeast', 2080, Y_GROUND - 40, 2030, 2270),
      mkEnemy('scorpion', 2950, Y_GROUND - 28, 2910, 3370),
      mkEnemy('icebeast', 3000, Y_GROUND - 40, 2910, 3370),
      mkEnemy('icebeast', 4200, Y_GROUND - 40, 4010, 4650),
    ],
    coins: (() => {
      const c: Coin[] = [];
      const spots: [number, number][] = [[200, 420], [700, 310], [860, 240], [1740, 260], [2050, 420], [2620, 220], [2960, 420], [3720, 280], [4150, 420], [4500, 420]];
      spots.forEach(([x, y], i) => c.push({ x, y, collected: false, bob: i * 0.5 }));
      return c;
    })(),
    powerups: [
      { x: 860, y: 200, type: 'triplejump', collected: false, bob: 0 },
      { x: 2620, y: 180, type: 'shield', collected: false, bob: 1 },
      { x: 4500, y: 370, type: 'speed', collected: false, bob: 2 },
    ],
    rocks: [
      { id: 1, x: 250, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 2, x: 1170, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 3, x: 2920, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 4, x: 4020, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
    ],
    boxes: [{ x: 3740, y: Y_GROUND - 60, w: 60, h: 60, vx: 0, vy: 0 }],
    hangingBoxes: [],
    hazards: [{ x: 1460, y: Y_GROUND, w: 80, h: 60, type: 'spikes' }, { x: 2300, y: Y_GROUND, w: 120, h: 60, type: 'spikes' }],
    checkpoints: [
      { x: 1140, y: Y_GROUND, activated: false },
      { x: 2900, y: Y_GROUND, activated: false },
    ],
    portal: { x: 4640, y: Y_GROUND - 140, w: 70, h: 140, toWorld: 3, active: true },
  };
}

// ---------- WORLD 4: VOLCANO ----------
function worldVolcano(): WorldDef {
  const platforms: Platform[] = [
    { x: 0, y: Y_GROUND, w: 360, h: 800, type: 'stone', label: 'جحيم البراكين' },
    { x: 480, y: 410, w: 80, h: 800, type: 'stone' },
    { x: 640, y: 330, w: 80, h: 800, type: 'stone' },
    { x: 800, y: 410, w: 80, h: 800, type: 'stone' },
    { x: 960, y: Y_GROUND, w: 280, h: 800, type: 'stone' },
    { x: 1180, y: 410, w: 70, h: 800, type: 'stone' },
    { x: 1360, y: 380, w: 70, h: 800, type: 'stone' },
    { x: 1520, y: 300, w: 70, h: 800, type: 'stone' },
    { x: 1680, y: 380, w: 70, h: 800, type: 'stone' },
    { x: 1840, y: Y_GROUND, w: 240, h: 800, type: 'stone' },
    { x: 2040, y: 350, w: 70, h: 800, type: 'stone' },
    { x: 2240, y: 350, w: 70, h: 800, type: 'stone' },
    { x: 2400, y: 250, w: 70, h: 800, type: 'stone' },
    { x: 2560, y: 350, w: 70, h: 800, type: 'stone' },
    { x: 2720, y: Y_GROUND, w: 440, h: 800, type: 'stone', label: 'قلب البركان' },
    { x: 3120, y: 430, w: 70, h: 800, type: 'stone' },
    { x: 3220, y: 420, w: 70, h: 800, type: 'stone' },
    { x: 3340, y: 400, w: 70, h: 800, type: 'stone' },
    { x: 3500, y: 320, w: 70, h: 800, type: 'stone' },
    { x: 3660, y: 400, w: 70, h: 800, type: 'stone' },
    { x: 3820, y: Y_GROUND, w: 300, h: 800, type: 'stone' },
    { x: 4030, y: 420, w: 70, h: 800, type: 'stone' },
    { x: 4220, y: 420, w: 70, h: 800, type: 'stone' },
    { x: 4380, y: 340, w: 70, h: 800, type: 'stone' },
    { x: 4540, y: 260, w: 70, h: 800, type: 'stone' },
    { x: 4700, y: Y_GROUND - 80, w: 360, h: 800, type: 'goal', label: 'محراب النهاية' },
  ];
  return {
    id: 'volcano', name: 'جحيم البراكين', subtitle: 'العالم الأخير', width: 5100,
    palette: { skyTop: '#1c0a0a', skyBottom: '#7f1d1d', far: '#450a0a', mid: '#7f1d1d', near: '#991b1b', ground: '#1c0a0a', groundTop: '#ef4444', accent: '#fb923c', particle: '#f97316' },
    particleType: 'ash',
    spawnX: 80, spawnY: Y_GROUND - 48,
    platforms,
    movingPlatforms: [
      { x: 2120, y: 330, w: 100, h: 16, startX: 2120, endX: 2240, speed: 130, active: true, vx: 130, axis: 'y', startY: 250, endY: 410 },
      { x: 3200, y: 380, w: 100, h: 16, startX: 3200, endX: 3340, speed: 120, active: true, vx: 120, axis: 'x' },
    ],
    buttons: [],
    enemies: [
      mkEnemy('lavalizard', 1010, Y_GROUND - 34, 970, 1230),
      mkEnemy('wolf', 1900, Y_GROUND - 32, 1850, 2070),
      mkEnemy('lavalizard', 2780, Y_GROUND - 34, 2730, 3150),
      mkEnemy('icebeast', 2820, Y_GROUND - 40, 2730, 3150),
      mkEnemy('lavalizard', 3880, Y_GROUND - 34, 3830, 4110),
      mkEnemy('wolf', 4350, Y_GROUND - 32, 4220, 4550),
    ],
    coins: (() => {
      const c: Coin[] = [];
      const spots: [number, number][] = [[200, 420], [680, 290], [1560, 260], [1900, 420], [2440, 210], [2780, 420], [3560, 280], [3880, 420], [4420, 300], [4700, 360], [4850, 360]];
      spots.forEach(([x, y], i) => c.push({ x, y, collected: false, bob: i * 0.5 }));
      return c;
    })(),
    powerups: [
      { x: 1560, y: 220, type: 'shield', collected: false, bob: 0 },
      { x: 2440, y: 170, type: 'speed', collected: false, bob: 1 },
      { x: 4420, y: 260, type: 'triplejump', collected: false, bob: 2 },
    ],
    rocks: [
      { id: 1, x: 250, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 2, x: 990, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 3, x: 2740, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
      { id: 4, x: 3840, y: Y_GROUND - 30, vx: 0, vy: 0, radius: 8, fromPlayer: false },
    ],
    boxes: [{ x: 4160, y: Y_GROUND - 60, w: 60, h: 60, vx: 0, vy: 0 }],
    hangingBoxes: [],
    hazards: [
      { x: 2080, y: Y_GROUND, w: 160, h: 60, type: 'lava' },
      { x: 3160, y: Y_GROUND, w: 180, h: 60, type: 'lava' },
      { x: 4120, y: Y_GROUND, w: 100, h: 60, type: 'lava' },
    ],
    checkpoints: [
      { x: 960, y: Y_GROUND, activated: false },
      { x: 2720, y: Y_GROUND, activated: false },
      { x: 3820, y: Y_GROUND, activated: false },
    ],
    portal: { x: 0, y: 0, w: 0, h: 0, toWorld: -1, active: false },
  };
}

const WORLD_BUILDERS: (() => WorldDef)[] = [worldForest, worldDesert, worldIce, worldVolcano];
const WORLD_MUSIC: MusicStyle[] = ['forest', 'desert', 'ice', 'volcano'];

// ============================================================
// Helpers
// ============================================================
const getPlayerRect = (p: PlayerState) => ({ x: p.x - p.width / 2, y: p.y - p.height, w: p.width, h: p.height });
const isColliding = (r1: any, r2: any) =>
  r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

const SAVE_KEY = 'amksa_save_v1';
function loadSave(): { world: number; coins: number; deaths: number } {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
  return { world: 0, coins: 0, deaths: 0 };
}
function saveSave(d: { world: number; coins: number; deaths: number }) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

// ============================================================
// Render helpers
// ============================================================
function drawBackground(ctx: CanvasRenderingContext2D, camX: number, pal: WorldPalette, id: string) {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (id === 'desert') { ctx.fillStyle = 'rgba(255,240,180,0.5)'; ctx.beginPath(); ctx.arc(820 - camX * 0.02, 120, 50, 0, Math.PI * 2); ctx.fill(); }
  if (id === 'volcano') { ctx.fillStyle = 'rgba(255,80,30,0.25)'; ctx.beginPath(); ctx.arc(820 - camX * 0.02, 180, 80, 0, Math.PI * 2); ctx.fill(); }
  if (id === 'ice') { ctx.fillStyle = 'rgba(200,230,255,0.5)'; ctx.beginPath(); ctx.arc(820 - camX * 0.02, 110, 40, 0, Math.PI * 2); ctx.fill(); }
}

function drawParallax(ctx: CanvasRenderingContext2D, camX: number, pal: WorldPalette) {
  ctx.fillStyle = pal.far;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const x = i * 320 - (camX * 0.15) % 320;
    ctx.moveTo(x, CANVAS_HEIGHT); ctx.lineTo(x + 160, CANVAS_HEIGHT - 240 + Math.sin(i * 1.3) * 60); ctx.lineTo(x + 320, CANVAS_HEIGHT);
  }
  ctx.fill();
  ctx.fillStyle = pal.mid;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const x = i * 260 - (camX * 0.3) % 260;
    ctx.moveTo(x, CANVAS_HEIGHT); ctx.lineTo(x + 130, CANVAS_HEIGHT - 160 + Math.cos(i * 1.7) * 40); ctx.lineTo(x + 260, CANVAS_HEIGHT);
  }
  ctx.fill();
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, pal: WorldPalette) {
  const isBreak = p.type === 'breakable';
  let top = pal.groundTop, body = pal.ground;
  if (p.type === 'ice') { body = '#0e3a5c'; top = '#bae6fd'; }
  if (p.type === 'sand') { body = '#a16207'; top = '#fcd34d'; }
  if (p.type === 'stone') { body = '#27272a'; top = '#52525b'; }
  if (p.type === 'pillar') { body = '#3f1616'; top = '#ef4444'; }
  if (isBreak) { body = '#92400e'; top = '#fbbf24'; }
  if (p.type === 'goal') { body = '#065f46'; top = '#34d399'; }

  if (p.type === 'pillar') {
    if (!p.cachedGradient) {
      p.cachedGradient = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
      p.cachedGradient.addColorStop(0, '#3f1616'); p.cachedGradient.addColorStop(0.5, '#991b1b'); p.cachedGradient.addColorStop(1, '#270e0e');
    }
    ctx.fillStyle = p.cachedGradient; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const gc = Math.max(2, Math.floor(p.w / 12)), sp = p.w / gc;
    for (let i = 1; i < gc; i++) ctx.fillRect(p.x + i * sp - 1, p.y, 2, p.h);
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(p.x - 6, p.y, p.w + 12, 16);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(p.x - 6, p.y, p.w + 12, 4);
    return;
  }

  let ox = 0;
  if (isBreak && p.broken && (p.breakTimer ?? 0) > 0) ox = Math.sin(Date.now() / 30) * 3;
  ctx.save(); ctx.translate(ox, 0);
  ctx.fillStyle = body; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = top; ctx.fillRect(p.x, p.y, p.w, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < p.w; i += 24) ctx.fillRect(p.x + i, p.y + 8, 2, p.h);
  if (p.label) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.label, p.x + p.w / 2, p.y - 8); }
  if (p.type === 'goal') {
    ctx.fillStyle = '#34d399'; ctx.fillRect(p.x + p.w / 2 - 2, p.y - 70, 4, 70);
    ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2 + 2, p.y - 70); ctx.lineTo(p.x + p.w / 2 + 28, p.y - 58); ctx.lineTo(p.x + p.w / 2 + 2, p.y - 46); ctx.fill();
  }
  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, time: number) {
  if (h.type === 'lava') {
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.fillStyle = '#ef4444'; const wob = Math.sin(time / 200) * 3;
    ctx.beginPath(); ctx.moveTo(h.x, h.y);
    for (let i = 0; i <= h.w; i += 12) ctx.lineTo(h.x + i, h.y + Math.sin(time / 150 + i) * 4 + wob);
    ctx.lineTo(h.x + h.w, h.y + h.h); ctx.lineTo(h.x, h.y + h.h); ctx.fill();
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(h.x, h.y + 2, h.w, 3);
  } else if (h.type === 'spikes') {
    ctx.fillStyle = '#cbd5e1'; const n = Math.floor(h.w / 16);
    for (let i = 0; i < n; i++) { const sx = h.x + i * 16; ctx.beginPath(); ctx.moveTo(sx, h.y + h.h); ctx.lineTo(sx + 8, h.y); ctx.lineTo(sx + 16, h.y + h.h); ctx.fill(); }
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(h.x, h.y + h.h - 6, h.w, 6);
  } else if (h.type === 'quicksand') {
    ctx.fillStyle = '#92400e'; ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.fillStyle = '#b45309'; const wob = Math.sin(time / 250) * 2; ctx.fillRect(h.x, h.y + wob, h.w, 6);
  }
}

function drawPortal(ctx: CanvasRenderingContext2D, p: Portal, time: number, pal: WorldPalette) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (let i = 0; i < 4; i++) {
    const r = 18 + i * 14 + Math.sin(time / 300 + i) * 4;
    ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.5 - i * 0.1; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, p.h / 2 + i * 6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, p.w);
  g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill();
}

function drawCheckpoint(ctx: CanvasRenderingContext2D, cp: Checkpoint) {
  ctx.fillStyle = cp.activated ? '#22c55e' : '#64748b';
  ctx.fillRect(cp.x - 2, cp.y - 50, 4, 50);
  ctx.beginPath(); ctx.moveTo(cp.x + 2, cp.y - 50); ctx.lineTo(cp.x + 26, cp.y - 40); ctx.lineTo(cp.x + 2, cp.y - 30); ctx.fill();
  if (cp.activated) { ctx.fillStyle = 'rgba(34,197,94,0.3)'; ctx.beginPath(); ctx.arc(cp.x, cp.y - 50, 12 + Math.sin(Date.now() / 300) * 3, 0, Math.PI * 2); ctx.fill(); }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save();
  ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2));
  if (!e.facingRight) ctx.scale(-1, 1);
  if (e.state === 'dead') { ctx.globalAlpha = Math.max(0, e.deadTimer / 1.2); ctx.rotate(Math.PI); }
  const hurt = e.damageTimer > 0;

  if (e.type === 'wolf') {
    let lunge = 0, jaw = 0;
    if (e.state === 'attack') {
      const t = e.attackTimer / 0.5;
      if (t < 0.2) lunge = -10 * (t / 0.2);
      else if (t < 0.5) { lunge = -10 + 30 * ((t - 0.2) / 0.3); jaw = 15 * ((t - 0.2) / 0.3); }
      else { const r = (t - 0.5) / 0.5; lunge = 20 * (1 - r); jaw = 15 * (1 - r); }
      ctx.translate(lunge, 0);
      if (t < 0.3) { ctx.save(); ctx.scale(e.facingRight ? 1 : -1, 1); ctx.fillStyle = '#ef4444'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('!', -5, -40); ctx.restore(); }
    }
    ctx.fillStyle = hurt ? '#ef4444' : '#1f2937';
    ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    if (e.state === 'run') { const ls = Math.sin(Date.now() / 50) * 10; ctx.fillRect(-e.w / 2 + 5 + ls, e.h / 2, 8, 10); ctx.fillRect(e.w / 2 - 15 - ls, e.h / 2, 8, 10); }
    else { ctx.fillRect(-e.w / 2 + 5, e.h / 2, 8, 10); ctx.fillRect(e.w / 2 - 15, e.h / 2, 8, 10); }
    if (e.state !== 'dead') {
      ctx.fillRect(e.w / 2 - 10, -e.h / 2 - 15, 25, 25);
      if (jaw > 0) { ctx.fillStyle = '#111827'; ctx.fillRect(e.w / 2 + 5, -e.h / 2 + 5 + jaw, 15, 8); ctx.fillStyle = 'white'; ctx.fillRect(e.w / 2 + 8, -e.h / 2 + 5 + jaw - 3, 3, 3); ctx.fillRect(e.w / 2 + 14, -e.h / 2 + 5 + jaw - 3, 3, 3); }
      ctx.fillStyle = e.state === 'attack' ? '#ef4444' : '#fca5a5'; ctx.fillRect(e.w / 2, -e.h / 2 - 5, 6, 6);
      ctx.fillStyle = '#111827'; ctx.fillRect(e.w / 2 + 15, -e.h / 2, 10, 10);
    }
  } else if (e.type === 'scorpion') {
    ctx.fillStyle = hurt ? '#ef4444' : '#7c2d12';
    ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-e.w / 2, 0); ctx.quadraticCurveTo(-e.w / 2 - 18, -6, -e.w / 2 - 10, -22); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(-e.w / 2 - 10, -24, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7c2d12'; ctx.fillRect(e.w / 2, -e.h / 2, 14, 8); ctx.fillRect(e.w / 2, e.h / 2 - 8, 14, 8);
    const ls = Math.sin(Date.now() / 60) * 4; ctx.fillStyle = '#451a03';
    ctx.fillRect(-e.w / 2 + 4, e.h / 2, 6, 8 + ls); ctx.fillRect(e.w / 2 - 14, e.h / 2, 6, 8 - ls);
  } else if (e.type === 'icebeast') {
    ctx.fillStyle = hurt ? '#ef4444' : '#bfdbfe';
    ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.ellipse(0, 4, e.w / 2 - 6, e.h / 2 - 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bae6fd';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 5, -e.h / 2); ctx.lineTo(i * 10, -e.h / 2 - 12); ctx.lineTo(i * 10 + 5, -e.h / 2); ctx.fill(); }
    ctx.fillStyle = e.state === 'attack' ? '#ef4444' : '#0c4a6e'; ctx.fillRect(e.w / 2 - 14, -8, 6, 6); ctx.fillRect(e.w / 2 - 6, -8, 6, 6);
    const ls = Math.sin(Date.now() / 80) * 5; ctx.fillStyle = '#bfdbfe'; ctx.fillRect(-e.w / 2 + 6, e.h / 2, 8, 8 + ls); ctx.fillRect(e.w / 2 - 14, e.h / 2, 8, 8 - ls);
  } else if (e.type === 'lavalizard') {
    ctx.fillStyle = hurt ? '#ef4444' : '#b91c1c';
    ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    ctx.fillStyle = '#fb923c'; ctx.fillRect(-e.w / 2 + 4, -e.h / 2 + 4, e.w - 8, 4);
    ctx.fillRect(e.w / 2 - 8, -e.h / 2 - 10, 22, 18);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(e.w / 2 - 4, -e.h / 2 - 6, 5, 5);
    ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-e.w / 2, 0); ctx.quadraticCurveTo(-e.w / 2 - 16, 8, -e.w / 2 - 8, 20); ctx.stroke();
    const ls = Math.sin(Date.now() / 50) * 5; ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-e.w / 2 + 4, e.h / 2, 7, 8 + ls); ctx.fillRect(e.w / 2 - 12, e.h / 2, 7, 8 - ls);
  }

  ctx.restore();
  if (e.health > 0 && e.health < e.maxHealth) {
    ctx.fillStyle = 'black'; ctx.fillRect(e.x, e.y - 12, e.w, 5);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(e.x, e.y - 12, (e.w * e.health) / e.maxHealth, 5);
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, prj: Projectile) {
  if (prj.type === 'fireball') {
    const g = ctx.createRadialGradient(prj.x, prj.y, 2, prj.x, prj.y, prj.radius + 4);
    g.addColorStop(0, '#fbbf24'); g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(prj.x, prj.y, prj.radius + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(prj.x, prj.y, prj.radius, 0, Math.PI * 2); ctx.fill();
  } else if (prj.type === 'sting') {
    ctx.fillStyle = '#fbbf24'; ctx.save(); ctx.translate(prj.x, prj.y); ctx.rotate(Math.atan2(prj.vy, prj.vx)); ctx.fillRect(-prj.radius, -2, prj.radius * 2, 4); ctx.restore();
  } else {
    ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.arc(prj.x, prj.y, prj.radius, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState, time: number) {
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  // Shield aura
  if (p.shieldTimer > 0) {
    const pulse = 0.6 + Math.sin(time / 120) * 0.2;
    const g = ctx.createRadialGradient(0, -24, 8, 0, -24, 34);
    g.addColorStop(0, 'rgba(56,189,248,0)');
    g.addColorStop(0.7, `rgba(56,189,248,${0.15 * pulse})`);
    g.addColorStop(1, `rgba(56,189,248,${0.45 * pulse})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -24, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(125,211,252,${0.5 + pulse * 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -24, 30, 0, Math.PI * 2); ctx.stroke();
  }
  if (p.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) ctx.globalAlpha = 0.4;
  // Speed trail
  if (p.speedTimer > 0 && Math.abs(p.vx) > 100) {
    ctx.globalAlpha = Math.max(ctx.globalAlpha, 0.0) + 0.25;
    ctx.fillStyle = '#f59e0b';
    for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 0.25 - i * 0.06; const ox = -Math.sign(p.vx) * i * 9; ctx.fillRect(ox - p.width / 2, -p.height + 6, p.width, p.height - 8); }
    ctx.globalAlpha = 1;
  }
  let sq = p.squash, st = p.stretch;
  if (p.state === 'run' && p.isGrounded) { const rb = Math.sin(p.animTimer * 2); sq *= 1 - rb * 0.08; st *= 1 + rb * 0.08; }
  ctx.scale(sq, st);
  if (p.isCharging) {
    const ang = p.facingRight ? p.relativeAimAngle : Math.PI - p.relativeAimAngle;
    ctx.strokeStyle = `rgba(255,0,0,${0.4 + p.chargeLevel * 0.6})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(Math.cos(ang) * (20 + p.chargeLevel * 30), -15 + Math.sin(ang) * (20 + p.chargeLevel * 30)); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-20, -40, 40, 6);
    ctx.fillStyle = `rgb(${255 * (1 - p.chargeLevel)},${255 * p.chargeLevel},0)`; ctx.fillRect(-20, -40, 40 * p.chargeLevel, 6);
  }
  ctx.scale(p.facingRight ? 1 : -1, 1);
  const color = p.hitFlash > 0 ? '#dc2626' : '#0ea5e9';
  const t = p.animTimer;
  let legL = 0, legR = 0, bodyY = 0, bodyTilt = 0;
  if (p.state === 'run') { legL = Math.sin(t) * 15; legR = Math.sin(t + Math.PI) * 15; bodyY = Math.abs(Math.sin(t * 2)) * 3; bodyTilt = 0.1; }
  else if (p.state === 'jump') { legL = -10; legR = -5; bodyTilt = -0.1; }
  else if (p.state === 'fall') { legL = -5; legR = -10; bodyTilt = 0.1; }
  else if (p.state === 'dash') { legL = -14; legR = -8; bodyTilt = 0.25; }
  else { bodyY = Math.sin(t * 2) * 1; }
  ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -15 + bodyY); ctx.lineTo(legL, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -15 + bodyY); ctx.lineTo(legR, 0); ctx.stroke();
  ctx.save(); ctx.translate(0, -15 + bodyY); ctx.rotate(bodyTilt);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-9, -22); ctx.lineTo(9, -22); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -27, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.ellipse(3, -27, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -27, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  if (p.rockCount > 0) { ctx.save(); ctx.rotate(p.relativeAimAngle); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(14, -5); ctx.stroke(); ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(16, -5, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.restore();
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.7);
  ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.3);
  ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s, x, y + s * 1.2);
  ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.7, x + s, y + s * 0.3);
  ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.7);
  ctx.fill();
}

function drawHUD(ctx: CanvasRenderingContext2D, worldName: string, health: number, coins: number, deaths: number, pal: WorldPalette, speedT: number, shieldT: number, tripleT: number) {
  for (let i = 0; i < MAX_HEALTH; i++) {
    ctx.fillStyle = i < health ? '#ef4444' : 'rgba(255,255,255,0.15)';
    drawHeart(ctx, 24 + i * 30, 26, 11);
  }
  ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 120, 26, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${coins}`, CANVAS_WIDTH - 106, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(`السقوط: ${deaths}`, CANVAS_WIDTH - 60, 55);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(worldName, CANVAS_WIDTH / 2, 30);

  // Active power-up indicators (left side, below hearts)
  const buffs: { t: number; color: string; label: string }[] = [];
  if (speedT > 0) buffs.push({ t: speedT, color: '#f59e0b', label: 'سرعة' });
  if (shieldT > 0) buffs.push({ t: shieldT, color: '#38bdf8', label: 'درع' });
  if (tripleT > 0) buffs.push({ t: tripleT, color: '#a78bfa', label: 'قفز ثلاثي' });
  buffs.forEach((b, i) => {
    const x = 24, y = 56 + i * 26;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, 92, 20);
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(x + 11, y + 10, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(b.label, x + 24, y + 14);
    // timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 24, y + 16, 60, 2);
    ctx.fillStyle = b.color; ctx.fillRect(x + 24, y + 16, 60 * Math.min(1, b.t / POWERUP_DURATION), 2);
  });
}

function drawPowerup(ctx: CanvasRenderingContext2D, pu: PowerUp, time: number) {
  const by = pu.y + Math.sin(pu.bob * 2.5) * 5;
  const col = pu.type === 'speed' ? '#f59e0b' : pu.type === 'shield' ? '#38bdf8' : '#a78bfa';
  // glow
  const g = ctx.createRadialGradient(pu.x, by, 3, pu.x, by, 22);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.5; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pu.x, by, 22, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // rotating orb
  ctx.save(); ctx.translate(pu.x, by); ctx.rotate(time / 400);
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const r = i % 2 ? 10 : 7; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // icon glyph
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  const glyph = pu.type === 'speed' ? '»' : pu.type === 'shield' ? '◇' : '↑↑';
  ctx.fillText(glyph, pu.x, by + 5);
}

// ============================================================
// Main Component
// ============================================================
type Screen = 'menu' | 'playing' | 'transition' | 'complete';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [worldIndex, setWorldIndex] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [hasSave, setHasSave] = useState(false);

  const stateRef = useRef<any>(null);

  useEffect(() => { setHasSave(loadSave().world > 0); }, []);

  function buildWorld(idx: number) {
    const def = WORLD_BUILDERS[idx]();
    return {
      def,
      platforms: def.platforms.map(p => ({ ...p })),
      movingPlatforms: def.movingPlatforms.map(m => ({ ...m })),
      buttons: def.buttons.map(b => ({ ...b })),
      enemies: def.enemies.map(e => ({ ...e })),
      coins: def.coins.map(c => ({ ...c })),
      powerups: def.powerups.map(p => ({ ...p })),
      rocks: def.rocks.map(r => ({ ...r })),
      boxes: def.boxes.map(b => ({ ...b })),
      hangingBoxes: def.hangingBoxes.map(b => ({ ...b })),
      hazards: def.hazards.map(h => ({ ...h })),
      checkpoints: def.checkpoints.map(c => ({ ...c })),
      portal: { ...def.portal },
      projectiles: [] as Projectile[],
      particles: [] as Particle[],
    };
  }

  function startGame(fromSave: boolean) {
    audio.init();
    const sv = loadSave();
    const startIdx = fromSave && sv.world > 0 ? Math.min(sv.world, WORLD_BUILDERS.length - 1) : 0;
    setWorldIndex(startIdx);
    setDeaths(fromSave ? sv.deaths : 0);
    setTotalCoins(fromSave ? sv.coins : 0);
    setScreen('transition');
  }

  useEffect(() => {
    if (screen !== 'transition') return;
    const t = setTimeout(() => {
      const w = buildWorld(worldIndex);
      const def = w.def;
      const player: PlayerState = {
        x: def.spawnX, y: def.spawnY, vx: 0, vy: 0,
        width: 24, height: 48, isGrounded: false, facingRight: true,
        animTimer: 0, stepTimer: 0, state: 'idle',
        jumpBuffer: 0, coyoteTime: 0, jumpsLeft: 2,
        squash: 1, stretch: 1, rockCount: 0,
        isCharging: false, chargeLevel: 0, chargeDir: 1, relativeAimAngle: -Math.PI / 4,
        health: MAX_HEALTH, invincibleTimer: 0,
        dashTimer: 0, dashCooldown: 0, dashDir: 1, hitFlash: 0,
        speedTimer: 0, shieldTimer: 0, tripleJumpTimer: 0,
      };
      stateRef.current = {
        world: w, player, cameraX: 0, cameraY: 0, camTargetX: 0, camTargetY: 0,
        deaths, totalCoins, worldCoins: 0,
      };
      audio.startMusic(WORLD_MUSIC[worldIndex]);
      setScreen('playing');
    }, 1400);
    return () => clearTimeout(t);
  }, [screen, worldIndex, deaths, totalCoins]);

  useEffect(() => {
    if (screen !== 'playing' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    const keys: Record<string, boolean> = {
      left: false, right: false, jump: false, jumpJustPressed: false,
      interact: false, interactJustPressed: false, aimThrow: false, aimThrowJustPressed: false,
      aimUp: false, aimDown: false, quickThrow: false, quickThrowJustPressed: false,
      dash: false, dashJustPressed: false,
    };

    const kd = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') { if (!keys.jump) keys.jumpJustPressed = true; keys.jump = true; e.preventDefault(); }
      if (e.code === 'KeyE' || e.code === 'Enter') { if (!keys.interact) keys.interactJustPressed = true; keys.interact = true; }
      if (e.code === 'KeyR') { if (!keys.aimThrow) keys.aimThrowJustPressed = true; keys.aimThrow = true; }
      if (e.code === 'KeyF') { if (!keys.quickThrow) keys.quickThrowJustPressed = true; keys.quickThrow = true; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') { if (!keys.dash) keys.dashJustPressed = true; keys.dash = true; }
      if (e.code === 'ArrowDown') { keys.aimDown = true; e.preventDefault(); }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') keys.jump = false;
      if (e.code === 'KeyE' || e.code === 'Enter') keys.interact = false;
      if (e.code === 'KeyR') keys.aimThrow = false;
      if (e.code === 'KeyF') keys.quickThrow = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') keys.dash = false;
      if (e.code === 'ArrowDown') keys.aimDown = false;
    };
    window.addEventListener('keydown', kd, { passive: false });
    window.addEventListener('keyup', ku);

    const S = stateRef.current;
    if (!S) return;
    const { world, player } = S;
    const def = world.def;
    const pal = def.palette;

    let particleTimer = 0;

    const damagePlayer = (hazard = false) => {
      if (player.invincibleTimer > 0) return;
      // Shield absorbs the hit instead of losing health
      if (player.shieldTimer > 0) {
        player.shieldTimer = 0;
        player.invincibleTimer = 1.2;
        player.hitFlash = 0.2;
        audio.playShieldBreak();
        player.vy = -300; player.vx = (player.facingRight ? -1 : 1) * 200;
        // shield-break burst
        for (let i = 0; i < 16; i++) world.particles.push({ x: player.x, y: player.y - 24, vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 100, life: 0.5, maxLife: 0.5, size: 3 + Math.random() * 3, color: '#38bdf8', type: 'spark' });
        return;
      }
      player.health -= 1; player.invincibleTimer = 1.2; player.hitFlash = 0.3; audio.playHit();
      player.vy = -300; player.vx = (player.facingRight ? -1 : 1) * 200;
      if (player.health <= 0 || hazard) {
        player.health = MAX_HEALTH; player.invincibleTimer = 1.5;
        player.x = def.spawnX; player.y = def.spawnY; player.vx = 0; player.vy = 0;
        player.rockCount = 0; player.isCharging = false; player.dashTimer = 0;
        // lose power-ups on respawn
        player.speedTimer = 0; player.shieldTimer = 0; player.tripleJumpTimer = 0;
        S.deaths += 1; setDeaths(S.deaths);
      }
    };

    const spawnDeathBurst = (x: number, y: number) => {
      for (let i = 0; i < 14; i++) world.particles.push({ x, y, vx: (Math.random() - 0.5) * 240, vy: -80 - Math.random() * 120, life: 0.6, maxLife: 0.6, size: 3 + Math.random() * 3, color: i % 2 ? pal.accent : '#ef4444', type: 'spark' });
    };

    const update = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      // ---- Camera ----
      S.camTargetX = player.x - CANVAS_WIDTH / 2;
      if (S.camTargetX < 0) S.camTargetX = 0;
      if (S.camTargetX > def.width - CANVAS_WIDTH) S.camTargetX = def.width - CANVAS_WIDTH;
      let camTargetY = 0;
      if (player.y < 320) camTargetY = player.y - 320;
      if (camTargetY < -260) camTargetY = -260;
      S.cameraX += (S.camTargetX - S.cameraX) * Math.min(1, dt * 8);
      S.cameraY += (camTargetY - S.cameraY) * Math.min(1, dt * 6);
      const cameraX = Math.round(S.cameraX);
      const cameraY = Math.round(S.cameraY);

      // ---- Aim ----
      if (player.rockCount > 0) {
        if (keys.aimUp || (keys.jump && player.rockCount > 0)) player.relativeAimAngle -= 3 * dt;
        if (keys.aimDown) player.relativeAimAngle += 3 * dt;
        if (player.relativeAimAngle < -Math.PI / 2) player.relativeAimAngle = -Math.PI / 2;
        if (player.relativeAimAngle > 0) player.relativeAimAngle = 0;
      }

      // ---- Pick up rocks ----
      if (keys.interactJustPressed) {
        let ci = -1, md = 100;
        world.rocks.forEach((r: Rock, i: number) => { const d = Math.hypot(r.x - player.x, r.y - player.y); if (d < md) { md = d; ci = i; } });
        if (ci !== -1 && player.rockCount < 4) { world.rocks.splice(ci, 1); player.rockCount++; player.relativeAimAngle = 0; }
      }

      // ---- Charge throw ----
      if (keys.aimThrow && player.rockCount > 0) {
        player.isCharging = true;
        player.chargeLevel += player.chargeDir * dt * 2.0;
        if (player.chargeLevel > 1) { player.chargeLevel = 1; player.chargeDir = -1; }
        else if (player.chargeLevel < 0) { player.chargeLevel = 0; player.chargeDir = 1; }
      } else if (!keys.aimThrow && player.isCharging) {
        player.isCharging = false; player.rockCount--;
        const ang = player.facingRight ? player.relativeAimAngle : Math.PI - player.relativeAimAngle;
        const power = 600 + player.chargeLevel * 800;
        audio.playThrow();
        world.rocks.push({ id: Date.now(), x: player.x + (player.facingRight ? 6 : -6), y: player.y - 15, vx: Math.cos(ang) * power + player.vx * 0.5, vy: Math.sin(ang) * power, radius: 5 + Math.random() * 2, fromPlayer: true });
        player.chargeLevel = 0; player.chargeDir = 1;
      }

      // ---- Quick throw ----
      if (keys.quickThrowJustPressed && player.rockCount > 0 && !player.isCharging) {
        player.rockCount--;
        const ang = player.facingRight ? 0 : Math.PI;
        audio.playThrow();
        world.rocks.push({ id: Date.now(), x: player.x + (player.facingRight ? 6 : -6), y: player.y - 15, vx: Math.cos(ang) * 1400 + player.vx * 0.5, vy: -80, radius: 5 + Math.random() * 2, fromPlayer: true });
      }
      keys.interactJustPressed = false; keys.quickThrowJustPressed = false; keys.aimThrowJustPressed = false;

      // ---- Movement ----
      let moveDir = 0;
      if (keys.left) moveDir -= 1;
      if (keys.right) moveDir += 1;
      if (moveDir !== 0) player.facingRight = moveDir > 0;

      // ---- Dash ----
      if (player.dashCooldown > 0) player.dashCooldown -= dt;
      if (keys.dashJustPressed && player.dashCooldown <= 0 && player.dashTimer <= 0) {
        player.dashTimer = DASH_DURATION; player.dashCooldown = DASH_COOLDOWN;
        player.dashDir = player.facingRight ? 1 : -1;
        audio.playDash();
        player.invincibleTimer = Math.max(player.invincibleTimer, DASH_DURATION + 0.05);
      }
      keys.dashJustPressed = false;

      if (player.dashTimer > 0) {
        player.dashTimer -= dt;
        player.vx = player.dashDir * DASH_SPEED; player.vy = 0; player.state = 'dash';
        if (Math.random() < 0.6) world.particles.push({ x: player.x, y: player.y - 20, vx: -player.dashDir * 60, vy: (Math.random() - 0.5) * 40, life: 0.3, maxLife: 0.3, size: 4 + Math.random() * 3, color: pal.accent, type: 'spark' });
      } else if (moveDir !== 0) {
        const spdActive = player.speedTimer > 0;
        const top = spdActive ? POWERUP_BOOST_SPEED : MAX_SPEED;
        const acc = spdActive ? POWERUP_BOOST_ACCEL : ACCELERATION;
        player.vx += moveDir * acc * dt;
        if (player.vx > top) player.vx = top;
        if (player.vx < -top) player.vx = -top;
      } else {
        const fr = player.isGrounded ? FRICTION_GROUND : FRICTION_AIR;
        if (player.vx > 0) { player.vx -= fr * dt; if (player.vx < 0) player.vx = 0; }
        else if (player.vx < 0) { player.vx += fr * dt; if (player.vx > 0) player.vx = 0; }
      }

      // ---- Jump ----
      const maxJumps = 2 + (player.tripleJumpTimer > 0 ? TRIPLE_JUMP_BONUS_JUMPS : 0);
      if (keys.jumpJustPressed) player.jumpBuffer = 0.15;
      if (player.jumpBuffer > 0) player.jumpBuffer -= dt;
      if (player.isGrounded) { player.coyoteTime = 0.15; player.jumpsLeft = maxJumps; }
      else if (player.coyoteTime > 0) player.coyoteTime -= dt;

      if (player.jumpBuffer > 0) {
        if (player.coyoteTime > 0 || player.isGrounded) {
          audio.playJump(); player.vy = -JUMP_FORCE; player.isGrounded = false;
          player.jumpBuffer = 0; player.coyoteTime = 0; player.jumpsLeft = maxJumps - 1;
          player.squash = 0.6; player.stretch = 1.4;
        } else if (player.jumpsLeft > 0 && player.dashTimer <= 0) {
          const isTriple = player.tripleJumpTimer > 0 && player.jumpsLeft === 1; // final bonus jump: extra punch
          audio.playDoubleJump(); player.vy = -JUMP_FORCE * (isTriple ? 1.0 : 0.88);
          player.jumpBuffer = 0; player.jumpsLeft--;
          player.squash = 0.7; player.stretch = 1.3;
          const burstColor = isTriple ? '#a78bfa' : pal.accent;
          for (let i = 0; i < (isTriple ? 14 : 8); i++) world.particles.push({ x: player.x, y: player.y, vx: Math.cos(i / (isTriple ? 14 : 8) * Math.PI * 2) * 90, vy: Math.sin(i / (isTriple ? 14 : 8) * Math.PI * 2) * 90, life: 0.35, maxLife: 0.35, size: 3, color: burstColor, type: 'spark' });
        }
      }
      keys.jumpJustPressed = false;

      player.squash += (1 - player.squash) * 15 * dt;
      player.stretch += (1 - player.stretch) * 15 * dt;

      let g = GRAVITY;
      if (player.vy > 0) g *= FALL_MULTIPLIER;
      else if (player.vy < 0 && !keys.jump) g *= LOW_JUMP_MULTIPLIER;
      player.vy += g * dt;

      // ---- Collisions ----
      // ---- Collisions (robust, previous-position resolved) ----
      const movingPlats = world.movingPlatforms;
      const allPlatforms = [...world.platforms.filter(p => !(p.type === 'breakable' && p.broken)), ...movingPlats];

      // remember pre-move position for proper axis resolution
      const prevY = player.y;
      const prevTop = prevY - player.height;
      const prevBottom = prevY;

      movingPlats.forEach((mp: MovingPlatform) => {
        if (mp.axis === 'y' && mp.startY !== undefined && mp.endY !== undefined) {
          mp.y += mp.vx * dt;
          if (mp.vx > 0 && mp.y >= mp.endY) { mp.y = mp.endY; mp.vx *= -1; }
          else if (mp.vx < 0 && mp.y <= mp.startY) { mp.y = mp.startY; mp.vx *= -1; }
        } else {
          mp.x += mp.vx * dt;
          if (mp.vx > 0 && mp.x >= mp.endX) { mp.x = mp.endX; mp.vx *= -1; }
          else if (mp.vx < 0 && mp.x <= mp.startX) { mp.x = mp.startX; mp.vx *= -1; }
        }
      });

      // 1) HORIZONTAL MOVE + resolve. Skip platforms we were clearly above/below last frame (those are landings, handled below).
      player.x += player.vx * dt;
      let pr = getPlayerRect(player);
      for (const p of allPlatforms) {
        if (isColliding(pr, p)) {
          const wasVerticallyBeside = !(prevBottom <= p.y + 2 || prevTop >= p.y + p.h - 2);
          if (!wasVerticallyBeside) continue;
          if (player.vx > 0) { player.x = p.x - player.width / 2; player.vx = 0; }
          else if (player.vx < 0) { player.x = p.x + p.w + player.width / 2; player.vx = 0; }
          pr = getPlayerRect(player);
        }
      }
      for (const box of world.boxes) {
        const br = { x: box.x, y: box.y, w: box.w, h: box.h };
        if (isColliding(pr, br)) {
          const wasVerticallyBeside = !(prevBottom <= box.y + 2 || prevTop >= box.y + box.h - 2);
          if (!wasVerticallyBeside) continue;
          if (player.vx > 0) { box.vx = player.vx * 0.6; player.x = box.x - player.width / 2; player.vx = 0; }
          else if (player.vx < 0) { box.vx = player.vx * 0.6; player.x = box.x + box.w + player.width / 2; player.vx = 0; }
          pr = getPlayerRect(player);
        }
      }
      for (const box of world.boxes) {
        box.vx *= 0.85; box.x += box.vx * dt;
        let br = { x: box.x, y: box.y, w: box.w, h: box.h };
        for (const p of allPlatforms) {
          if (isColliding(br, p)) { if (box.vx > 0) { box.x = p.x - box.w; box.vx = 0; } else if (box.vx < 0) { box.x = p.x + p.w; box.vx = 0; } br.x = box.x; }
        }
      }

      // 2) VERTICAL MOVE + resolve. Land only if feet were above platform top last frame; bonk only if head was below bottom.
      player.y += player.vy * dt;
      pr = getPlayerRect(player);
      player.isGrounded = false;
      let onMoving: MovingPlatform | null = null;
      let bestLandY = Infinity;
      let bestLandPlatform: Platform | MovingPlatform | null = null;
      for (const p of allPlatforms) {
        if (!isColliding(pr, p)) continue;
        if (player.vy >= 0) {
          if (prevBottom <= p.y + 2) {
            const pxL = player.x - player.width / 2, pxR = player.x + player.width / 2;
            if (pxR > p.x + 1 && pxL < p.x + p.w - 1 && p.y < bestLandY) { bestLandY = p.y; bestLandPlatform = p; }
          }
        } else {
          if (prevTop >= p.y + p.h - 2) { player.y = p.y + p.h + player.height; player.vy = 0; pr = getPlayerRect(player); }
        }
      }
      if (bestLandPlatform) {
        player.y = bestLandY;
        if (player.vy > 200) { player.squash = 1.4; player.stretch = 0.6; }
        player.vy = 0; player.isGrounded = true;
        if (movingPlats.includes(bestLandPlatform as MovingPlatform)) onMoving = bestLandPlatform as MovingPlatform;
        const blp = bestLandPlatform as Platform;
        if (blp.type === 'breakable' && !blp.broken) { blp.broken = true; blp.breakTimer = 0.4; }
      }
      for (const box of world.boxes) {
        const br = { x: box.x, y: box.y, w: box.w, h: box.h };
        if (!isColliding(pr, br)) continue;
        if (player.vy >= 0) {
          if (prevBottom <= box.y + 2) {
            const pxL = player.x - player.width / 2, pxR = player.x + player.width / 2;
            if (pxR > box.x + 1 && pxL < box.x + box.w - 1) { player.y = box.y; if (player.vy > 200) { player.squash = 1.4; player.stretch = 0.6; } player.vy = 0; player.isGrounded = true; pr = getPlayerRect(player); }
          }
        } else {
          if (prevTop >= box.y + box.h - 2) { player.y = box.y + box.h + player.height; player.vy = 0; pr = getPlayerRect(player); }
        }
      }
      for (const box of world.boxes) {
        box.vy += GRAVITY * dt; box.y += box.vy * dt;
        let br = { x: box.x, y: box.y, w: box.w, h: box.h };
        for (const p of allPlatforms) {
          if (isColliding(br, p)) { if (box.vy > 0) { box.y = p.y - box.h; box.vy = 0; } else if (box.vy < 0) { box.y = p.y + p.h; box.vy = 0; } br.y = box.y; }
        }
      }
      // carry player on moving platform (apply AFTER landing so we ride, not sink)
      if (onMoving) { if (onMoving.axis === 'x') player.x += onMoving.vx * dt; else player.y += onMoving.vx * dt; }
      if (player.x < player.width / 2) { player.x = player.width / 2; player.vx = 0; }
      if (player.x > def.width - player.width / 2) { player.x = def.width - player.width / 2; player.vx = 0; }

      world.platforms.forEach((p: Platform) => { if (p.broken && p.breakTimer !== undefined) { p.breakTimer -= dt; } });

      // ---- Rocks ----
      const allSolid = [...allPlatforms, ...world.boxes];
      for (let i = world.rocks.length - 1; i >= 0; i--) {
        const r = world.rocks[i];
        r.vy += GRAVITY * dt; r.vx *= 0.99;
        const px = r.x, py = r.y;
        r.x += r.vx * dt; r.y += r.vy * dt;
        for (const plat of allSolid) {
          if (r.x + r.radius > plat.x && r.x - r.radius < plat.x + plat.w && r.y + r.radius > plat.y && r.y - r.radius < plat.y + plat.h) {
            if (py + r.radius <= plat.y && r.vy > 0) { r.y = plat.y - r.radius; if (r.vy > 100) audio.playRockImpact(); r.vy *= -ROCK_BOUNCE; if (Math.abs(r.vx) > 0) { r.vx -= Math.sign(r.vx) * ROCK_FRICTION * dt; if (Math.abs(r.vx) < 10) r.vx = 0; } if (Math.abs(r.vy) < 50) r.vy = 0; }
            else if (py - r.radius >= plat.y + plat.h && r.vy < 0) { r.y = plat.y + plat.h + r.radius; r.vy *= -ROCK_BOUNCE; }
            else { if (px + r.radius <= plat.x && r.vx > 0) { r.x = plat.x - r.radius; r.vx *= -ROCK_BOUNCE; } else if (px - r.radius >= plat.x + plat.w && r.vx < 0) { r.x = plat.x + plat.w + r.radius; r.vx *= -ROCK_BOUNCE; } }
          }
        }
        for (const hb of world.hangingBoxes) {
          if (!hb.hit) { const rr = { x: r.x - r.radius, y: r.y - r.radius, w: r.radius * 2, h: r.radius * 2 }; if (isColliding(rr, { x: hb.x, y: hb.y, w: hb.w, h: hb.h })) { hb.hit = true; world.boxes.push({ x: hb.x, y: hb.y, w: hb.w, h: hb.h, vx: 0, vy: 0 }); audio.playRockImpact(); r.vy = -50; r.vx = r.vx > 0 ? -40 : 40; } }
        }
        if (r.y > CANVAS_HEIGHT + 200) world.rocks.splice(i, 1);
      }

      // ---- Enemies ----
      for (const e of world.enemies) {
        if (e.state === 'dead') { e.deadTimer -= dt; continue; }
        e.vy += GRAVITY * dt;
        const ePrevBottom = e.y + e.h;
        e.y += e.vy * dt; e.animTimer += dt;
        let er = { x: e.x, y: e.y, w: e.w, h: e.h }; e.onGround = false;
        let bestEY = Infinity;
        for (const p of allPlatforms) {
          if (isColliding(er, p)) {
            if (e.vy >= 0 && ePrevBottom <= p.y + 4 && (e.x + e.w > p.x + 1 && e.x < p.x + p.w - 1)) { if (p.y < bestEY) bestEY = p.y; }
          }
          er = { x: e.x, y: e.y, w: e.w, h: e.h };
        }
        if (bestEY < Infinity) { e.y = bestEY - e.h; e.vy = 0; e.onGround = true; er = { x: e.x, y: e.y, w: e.w, h: e.h }; }
        if (e.damageTimer > 0) e.damageTimer -= dt;

        const dx = Math.abs(player.x - e.x), dy = Math.abs(player.y - e.y);
        const sight = e.type === 'lavalizard' ? 420 : 320;
        const inSight = dx < sight && dy < 120;
        const inRange = dx < 70 && dy < 60;

        if (e.state === 'attack') {
          e.attackTimer += dt; e.vx = 0;
          if (e.attackTimer > 0.5) { if (inRange && player.invincibleTimer <= 0) damagePlayer(); e.state = 'idle'; e.attackTimer = 0; }
        } else if (inSight && e.type !== 'lavalizard' && e.type !== 'scorpion') {
          if (inRange) { e.state = 'attack'; e.attackTimer = 0; e.facingRight = player.x > e.x; audio.playHit(); }
          else { e.state = 'run'; e.facingRight = player.x > e.x; e.vx = e.facingRight ? 150 : -150; }
        } else if (inSight && (e.type === 'lavalizard' || e.type === 'scorpion')) {
          e.state = 'run'; e.facingRight = player.x > e.x; e.shootTimer -= dt;
          const desired = e.type === 'scorpion' ? 220 : 280;
          if (dx > desired + 40) e.vx = e.facingRight ? 90 : -90;
          else if (dx < desired - 40) e.vx = e.facingRight ? -90 : 90;
          else e.vx *= 0.8;
          if (e.shootTimer <= 0) {
            e.shootTimer = e.type === 'scorpion' ? 1.6 : 2.2;
            const dir = e.facingRight ? 1 : -1;
            const ptype = e.type === 'scorpion' ? 'sting' : 'fireball';
            world.projectiles.push({ x: e.x + dir * e.w / 2, y: e.y + e.h / 2, vx: dir * 320, vy: -40, radius: 7, fromEnemy: true, life: 3, type: ptype });
          }
        } else {
          e.state = 'run';
          if (e.facingRight) { e.vx = 80; if (e.x > e.endX) e.facingRight = false; }
          else { e.vx = -80; if (e.x < e.startX) e.facingRight = true; }
        }
        e.x += e.vx * dt;
        if (e.x < e.startX) { e.x = e.startX; e.facingRight = true; }
        if (e.x > e.endX) { e.x = e.endX; e.facingRight = false; }

        for (let i = world.rocks.length - 1; i >= 0; i--) {
          const r = world.rocks[i];
          const cx = Math.max(e.x, Math.min(r.x, e.x + e.w));
          const cy = Math.max(e.y, Math.min(r.y, e.y + e.h));
          const ddx = r.x - cx, ddy = r.y - cy;
          if (ddx * ddx + ddy * ddy < r.radius * r.radius) {
            if (Math.abs(r.vx) > 50 || Math.abs(r.vy) > 50) {
              e.health -= 1; e.damageTimer = 0.2; audio.playEnemyHurt();
              if (e.health <= 0) { e.state = 'dead'; e.deadTimer = 1.2; spawnDeathBurst(e.x + e.w / 2, e.y + e.h / 2); }
              r.vy = -60; r.vx = r.vx > 0 ? -50 : 50;
            }
          }
        }
      }

      // ---- Projectiles ----
      for (let i = world.projectiles.length - 1; i >= 0; i--) {
        const prj = world.projectiles[i];
        prj.vy += GRAVITY * 0.25 * dt;
        prj.x += prj.vx * dt; prj.y += prj.vy * dt; prj.life -= dt;
        if (prj.fromEnemy && player.invincibleTimer <= 0) {
          const cx = Math.max(player.x - player.width / 2, Math.min(prj.x, player.x + player.width / 2));
          const cy = Math.max(player.y - player.height, Math.min(prj.y, player.y));
          if ((prj.x - cx) ** 2 + (prj.y - cy) ** 2 < prj.radius * prj.radius) { damagePlayer(); world.projectiles.splice(i, 1); continue; }
        }
        if (prj.life <= 0 || prj.y > CANVAS_HEIGHT + 100) world.projectiles.splice(i, 1);
      }

      // ---- Coins ----
      world.coins.forEach((c: Coin) => {
        c.bob += dt;
        if (!c.collected) {
          const dx = Math.abs(player.x - c.x), dy = Math.abs((player.y - 24) - c.y);
          if (dx < 26 && dy < 30) { c.collected = true; S.worldCoins++; audio.playCoin(); for (let k = 0; k < 6; k++) world.particles.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60, life: 0.4, maxLife: 0.4, size: 3, color: pal.accent, type: 'spark' }); }
        }
      });

      // ---- Power-ups ----
      world.powerups.forEach((pu: PowerUp) => {
        pu.bob += dt;
        if (!pu.collected) {
          const dx = Math.abs(player.x - pu.x), dy = Math.abs((player.y - 24) - pu.y);
          if (dx < 28 && dy < 34) {
            pu.collected = true;
            audio.playPowerup();
            if (pu.type === 'speed') player.speedTimer = POWERUP_DURATION;
            else if (pu.type === 'shield') player.shieldTimer = POWERUP_DURATION;
            else if (pu.type === 'triplejump') player.tripleJumpTimer = POWERUP_DURATION;
            const col = pu.type === 'speed' ? '#f59e0b' : pu.type === 'shield' ? '#38bdf8' : '#a78bfa';
            for (let k = 0; k < 18; k++) world.particles.push({ x: pu.x, y: pu.y, vx: (Math.random() - 0.5) * 200, vy: -80 - Math.random() * 120, life: 0.6, maxLife: 0.6, size: 4, color: col, type: 'spark' });
          }
        }
      });
      // tick down timers
      if (player.speedTimer > 0) player.speedTimer -= dt;
      if (player.tripleJumpTimer > 0) player.tripleJumpTimer -= dt;
      if (player.shieldTimer > 0) player.shieldTimer -= dt;
      if (player.speedTimer < 0) player.speedTimer = 0;
      if (player.tripleJumpTimer < 0) player.tripleJumpTimer = 0;
      if (player.shieldTimer < 0) player.shieldTimer = 0;

      // ---- Checkpoints ----
      world.checkpoints.forEach((cp: Checkpoint) => {
        if (!cp.activated && Math.abs(player.x - cp.x) < 40 && player.isGrounded) { cp.activated = true; audio.playCheckpoint(); def.spawnX = cp.x + 20; def.spawnY = cp.y - 48; }
      });

      // ---- Hazards ----
      for (const h of world.hazards) {
        if (isColliding(getPlayerRect(player), { x: h.x, y: h.y, w: h.w, h: h.h }) && player.invincibleTimer <= 0) { damagePlayer(true); }
      }

      // ---- Portal ----
      if (def.portal.active && def.portal.w > 0) {
        if (isColliding(getPlayerRect(player), { x: def.portal.x, y: def.portal.y, w: def.portal.w, h: def.portal.h })) {
          audio.playPortal();
          const nextIdx = worldIndex + 1;
          saveSave({ world: nextIdx, coins: S.totalCoins + S.worldCoins, deaths: S.deaths });
          setTotalCoins(S.totalCoins + S.worldCoins);
          if (nextIdx >= WORLD_BUILDERS.length) { clearSave(); setScreen('complete'); }
          else { setWorldIndex(nextIdx); setScreen('transition'); }
          return;
        }
      }
      if (def.id === 'volcano' && player.x > 4700 && player.isGrounded) {
        audio.playPortal();
        saveSave({ world: WORLD_BUILDERS.length, coins: S.totalCoins + S.worldCoins, deaths: S.deaths });
        setTotalCoins(S.totalCoins + S.worldCoins);
        clearSave(); setScreen('complete'); return;
      }

      // ---- Death/fall ----
      if (player.y > CANVAS_HEIGHT + 80) damagePlayer(true);

      if (player.invincibleTimer > 0) player.invincibleTimer -= dt;
      if (player.hitFlash > 0) player.hitFlash -= dt;

      // ---- Particles ----
      particleTimer -= dt;
      if (particleTimer <= 0) {
        particleTimer = 0.06;
        const t = def.particleType;
        if (t === 'snow') world.particles.push({ x: cameraX + Math.random() * CANVAS_WIDTH, y: cameraY - 10, vx: -20 + Math.random() * 10, vy: 40 + Math.random() * 30, life: 6, maxLife: 6, size: 2 + Math.random() * 2, color: pal.particle, type: 'snow' });
        if (t === 'sand') world.particles.push({ x: cameraX + Math.random() * CANVAS_WIDTH, y: cameraY + Math.random() * CANVAS_HEIGHT, vx: 120 + Math.random() * 60, vy: 10 + Math.random() * 20, life: 4, maxLife: 4, size: 1 + Math.random() * 2, color: pal.particle, type: 'sand' });
        if (t === 'ash') world.particles.push({ x: cameraX + Math.random() * CANVAS_WIDTH, y: cameraY - 10, vx: -30 + Math.random() * 20, vy: 30 + Math.random() * 40, life: 6, maxLife: 6, size: 2 + Math.random() * 3, color: pal.particle, type: 'ash' });
        if (t === 'leaves') world.particles.push({ x: cameraX + Math.random() * CANVAS_WIDTH, y: cameraY - 10, vx: -30 + Math.random() * 30, vy: 30 + Math.random() * 20, life: 7, maxLife: 7, size: 3 + Math.random() * 3, color: pal.particle, type: 'leaves' });
      }
      for (let i = world.particles.length - 1; i >= 0; i--) {
        const p = world.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.type === 'ash' || p.type === 'leaves') p.vx += Math.sin(p.life * 4) * 20 * dt;
        if (p.life <= 0) world.particles.splice(i, 1);
      }

      // ---- State/anim ----
      if (player.dashTimer <= 0) {
        if (!player.isGrounded) player.state = player.vy < 0 ? 'jump' : 'fall';
        else if (Math.abs(player.vx) > 10) { player.state = 'run'; const sr = Math.abs(player.vx) / MAX_SPEED; player.animTimer += dt * 15 * sr; player.stepTimer += dt * sr; if (player.stepTimer > 0.22) { audio.playStep(); player.stepTimer = 0; } }
        else { player.state = 'idle'; player.animTimer += dt; player.stepTimer = 0; }
      }

      // =================== RENDER ===================
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(ctx, cameraX, pal, def.id);
      drawParallax(ctx, cameraX, pal);

      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      for (const h of world.hazards) drawHazard(ctx, h, time);
      for (const p of world.platforms) { if (p.type === 'breakable' && p.broken && (p.breakTimer ?? 0) <= 0) continue; drawPlatform(ctx, p, pal); }
      for (const mp of movingPlats) { ctx.fillStyle = pal.accent; ctx.fillRect(Math.round(mp.x), Math.round(mp.y), mp.w, mp.h); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(Math.round(mp.x), Math.round(mp.y), mp.w, 4); }
      if (def.portal.active && def.portal.w > 0) drawPortal(ctx, def.portal, time, pal);
      for (const c of world.coins) { if (c.collected) continue; const by = c.y + Math.sin(c.bob * 3) * 4; ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(c.x, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.x - 2, by - 2, 3, 0, Math.PI * 2); ctx.fill(); }
      for (const pu of world.powerups) { if (pu.collected) continue; drawPowerup(ctx, pu, time); }
      for (const cp of world.checkpoints) drawCheckpoint(ctx, cp);
      for (const r of world.rocks) { ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.radius), 0, Math.PI * 2); ctx.fill(); const d = Math.hypot(r.x - player.x, r.y - player.y); if (d < 100 && player.rockCount < 4) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('E', Math.round(r.x), Math.round(r.y) - 15); } }
      for (const box of world.boxes) { ctx.fillStyle = '#b45309'; ctx.fillRect(Math.round(box.x), Math.round(box.y), box.w, box.h); ctx.fillStyle = '#d97706'; ctx.fillRect(Math.round(box.x + 4), Math.round(box.y + 4), box.w - 8, box.h - 8); }
      for (const hb of world.hangingBoxes) { if (!hb.hit) { ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hb.x + hb.w / 2, cameraY); ctx.lineTo(hb.x + hb.w / 2, hb.y); ctx.stroke(); ctx.fillStyle = '#b45309'; ctx.fillRect(Math.round(hb.x), Math.round(hb.y), hb.w, hb.h); } }
      for (const e of world.enemies) { if (e.state === 'dead' && e.deadTimer <= 0) continue; drawEnemy(ctx, e); }
      for (const prj of world.projectiles) drawProjectile(ctx, prj);
      drawPlayer(ctx, player, time);
      for (const p of world.particles) { const a = Math.max(0, p.life / p.maxLife); ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
      ctx.globalAlpha = 1;

      ctx.restore();

      drawHUD(ctx, def.name, player.health, S.worldCoins, S.deaths, pal, player.speedTimer, player.shieldTimer, player.tripleJumpTimer);

      raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cancelAnimationFrame(raf); };
  }, [screen, worldIndex]);

  // ============================================================
  // UI
  // ============================================================
  if (screen === 'menu') {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#0b3d2e] via-[#0f172a] to-[#020617] text-slate-200 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-2xl w-full text-center space-y-7 p-10 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
          <div className="space-y-3">
            <h1 className="text-5xl font-black tracking-tight text-white">عوالم <span className="text-amber-400">الهاوية</span></h1>
            <p className="text-slate-400 text-lg">أربع عوالم مفتوحة متصلة. استكشف، اقفز، اشقّ طريقك عبر الغابة والصحراء والجليد والبراكين.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[['غابة الفجر', 'bg-emerald-600'], ['صحراء الرمال', 'bg-amber-600'], ['كهوف الجليد', 'bg-sky-500'], ['جحيم البراكين', 'bg-red-600']].map(([n, c]) => (
              <div key={n} className={`${c} text-white rounded-xl py-3 font-bold shadow-lg`}>{n}</div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[['سرعة', '#f59e0b', '»'], ['درع', '#38bdf8', '◇'], ['قفز ثلاثي', '#a78bfa', '↑↑']].map(([n, c, g]) => (
              <div key={n} className="rounded-xl py-3 px-2 font-bold shadow-lg text-white flex items-center justify-center gap-2" style={{ background: `${c}22`, border: `1px solid ${c}` }}>
                <span style={{ color: c }} className="text-lg">{g}</span>{n}
              </div>
            ))}
          </div>
          <p className="text-amber-300/80 text-sm -mt-2">اجمع القدرات المنتشرة في كل عالم — تمنحك سرعة، درعاً يامتص الضربة، أو قفزة ثلاثية مؤقتة!</p>
          <div className="text-right text-sm text-slate-400 space-y-2 bg-slate-950/50 rounded-2xl p-5 border border-slate-800">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2">التحكم:</h3>
            <div className="grid grid-cols-2 gap-2">
              <span>الأسهم / A·D: الحركة</span>
              <span>المسافة / W: قفز (مزدوج!)</span>
              <span>Shift / L: انقضاض (Dash)</span>
              <span>E: التقاط حجر</span>
              <span>R: تصويب ورمي مقوس</span>
              <span>F: رمي سريع مستقيم</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => startGame(false)} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-xl rounded-full transition-all shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.5)]">رحلة جديدة</button>
            {hasSave && <button onClick={() => startGame(true)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-full transition-all border border-slate-700">استئناف التقدم</button>}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'transition') {
    const def = WORLD_BUILDERS[worldIndex]();
    const pal = def.palette;
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center font-sans" style={{ background: `linear-gradient(160deg, ${pal.skyTop}, ${pal.skyBottom})` }}>
        <div className="text-center space-y-4 animate-pulse">
          <p className="text-white/60 text-lg tracking-widest">{def.subtitle}</p>
          <h1 className="text-6xl font-black text-white drop-shadow-2xl">{def.name}</h1>
          <div className="mt-8 w-48 h-1 mx-auto bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-white" style={{ animation: 'loadbar 1.4s ease-in-out forwards' }} /></div>
        </div>
        <style>{`@keyframes loadbar{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
      </div>
    );
  }

  if (screen === 'complete') {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-b from-emerald-900 via-slate-900 to-[#020617] text-slate-200 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-xl text-center space-y-6 p-10 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-emerald-700/50 shadow-2xl">
          <h1 className="text-5xl font-black text-emerald-400">اجتزت العوالم!</h1>
          <p className="text-slate-300 text-lg">وصلت إلى محراب النهاية وعبرت الغابة والصحراء والجليد والبراكين.</p>
          <div className="text-2xl text-amber-400 font-bold">العملات: {totalCoins}</div>
          <button onClick={() => setScreen('menu')} className="mt-4 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl rounded-full transition-all">العودة للقائمة</button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#020617] flex flex-col items-center justify-center font-sans">
      <div className="relative rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)] ring-1 ring-slate-700">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block bg-[#0f172a]" style={{ touchAction: 'none' }} />
      </div>
      <div className="mt-3 text-slate-500 text-xs text-center px-4">الأسهم للحركة • مسافة للقفز (مرتان للقفز المزدوج) • Shift للانقضاض • E التقاط • R تصويب • F رمي سريع</div>
    </div>
  );
}
