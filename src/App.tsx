import React, { useEffect, useRef, useState } from 'react';

// --- Physics Constants (Tuned for balanced movement) ---
const GRAVITY = 1800;
const FALL_MULTIPLIER = 2.5;
const LOW_JUMP_MULTIPLIER = 2.5;
const JUMP_FORCE = 750;
const MAX_SPEED = 300;
const ACCELERATION = 1200;
const FRICTION_GROUND = 800;
const FRICTION_AIR = 400;

const ROCK_BOUNCE = 0.4;
const ROCK_FRICTION = 200;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

class AudioEngine {
  ctx: AudioContext | null = null;
  isMusicPlaying = false;
  platformOsc: OscillatorNode | null = null;
  platformGain: GainNode | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playRockImpact() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playWolfAttack() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playThrow() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  setPlatformMoving(isMoving: boolean) {
    if (!this.ctx) return;
    if (isMoving && !this.platformOsc) {
      this.platformOsc = this.ctx.createOscillator();
      this.platformGain = this.ctx.createGain();
      this.platformOsc.type = 'triangle';
      this.platformOsc.frequency.value = 60;
      this.platformGain.gain.value = 0.05;
      this.platformOsc.connect(this.platformGain);
      this.platformGain.connect(this.ctx.destination);
      this.platformOsc.start();
    } else if (!isMoving && this.platformOsc) {
      this.platformOsc.stop();
      this.platformOsc.disconnect();
      this.platformGain?.disconnect();
      this.platformOsc = null;
      this.platformGain = null;
    }
  }

  playStep() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  startMusic() {
    if (!this.ctx || this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    
    // 8-bit adventure style music loop
    const bassNotes = [130.81, 130.81, 98.00, 116.54]; // C3, C3, G2, A#2
    const melodyNotes = [
      261.63, 392.00, 349.23, 392.00, // C4, G4, F4, G4
      261.63, 392.00, 466.16, 392.00, // C4, G4, A#4, G4
    ];

    let beat = 0;

    const playBeat = () => {
      if (!this.isMusicPlaying || !this.ctx) return;
      const time = this.ctx.currentTime;

      // Play Bass (every 4 beats)
      if (beat % 4 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.value = bassNotes[(beat / 4) % bassNotes.length];
        bassGain.gain.setValueAtTime(0.04, time);
        bassGain.gain.linearRampToValueAtTime(0.03, time + 0.8);
        bassGain.gain.exponentialRampToValueAtTime(0.001, time + 1.0);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(time);
        bassOsc.stop(time + 1.0);
      }

      // Play Melody (every beat)
      const melOsc = this.ctx.createOscillator();
      const melGain = this.ctx.createGain();
      melOsc.type = 'square';
      melOsc.frequency.value = melodyNotes[beat % melodyNotes.length];
      melGain.gain.setValueAtTime(0.015, time);
      melGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      melOsc.connect(melGain);
      melGain.connect(this.ctx.destination);
      melOsc.start(time);
      melOsc.stop(time + 0.2);

      beat++;
      setTimeout(playBeat, 250); // 240 BPM (4 beats per second)
    };

    playBeat();
  }
}

const audio = new AudioEngine();

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isGrounded: boolean;
  facingRight: boolean;
  animTimer: number;
  stepTimer?: number;
  state: 'idle' | 'run' | 'jump' | 'fall';
  
  // Jump Mechanics
  jumpBuffer: number;
  coyoteTime: number;
  
  // Animation
  squash: number;
  stretch: number;
  
  // Rock Mechanics
  rockCount: number;
  isCharging: boolean;
  chargeLevel: number;
  chargeDir: number;
  relativeAimAngle: number;
}

interface Rock {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface HangingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  hit: boolean;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'normal' | 'pillar' | 'goal' | 'wall';
  label?: string;
  cachedGradient?: CanvasGradient;
}

interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
}

interface MovingPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  startX: number;
  endX: number;
  speed: number;
  active: boolean;
  vx: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Wolf {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  health: number;
  state: 'idle' | 'run' | 'dead' | 'attack';
  facingRight: boolean;
  startX: number;
  endX: number;
  damageTimer: number;
  attackTimer?: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [deathCount, setDeathCount] = useState(0);

  useEffect(() => {
    if (!gameStarted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    // --- Game State ---
    const player: PlayerState = {
      x: 100,
      y: 300,
      vx: 0,
      vy: 0,
      width: 24,
      height: 48,
      isGrounded: false,
      facingRight: true,
      animTimer: 0,
      state: 'idle',
      jumpBuffer: 0,
      coyoteTime: 0,
      squash: 1,
      stretch: 1,
      rockCount: 0,
      isCharging: false,
      chargeLevel: 0,
      chargeDir: 1,
      relativeAimAngle: -Math.PI / 4,
    };

    const initialRocks: Rock[] = [
      // Rocks for the button
      { id: 1, x: 2450, y: 380, vx: 0, vy: 0, radius: 8 },
      { id: 2, x: 2500, y: 380, vx: 0, vy: 0, radius: 8 },
      
      // Rocks for Obstacle A (wolves)
      { id: 4, x: 3200, y: 380, vx: 0, vy: 0, radius: 8 },
      { id: 5, x: 3250, y: 380, vx: 0, vy: 0, radius: 8 },
      { id: 6, x: 3300, y: 380, vx: 0, vy: 0, radius: 8 },
    ];
    let rocks: Rock[] = initialRocks.map(r => ({ ...r }));

    const initialBoxes: Box[] = [
      { x: 3400, y: 340, w: 60, h: 60, vx: 0, vy: 0 }
    ];
    let boxes: Box[] = initialBoxes.map(b => ({ ...b }));

    const initialHangingBoxes: HangingBox[] = [
      { x: 4900, y: 150, w: 60, h: 60, hit: false }
    ];
    let hangingBoxes: HangingBox[] = initialHangingBoxes.map(b => ({ ...b }));

    const initialWolves: Wolf[] = [
      {
        x: 3700, y: 370, w: 50, h: 30, vx: 0, vy: 0, health: 2, state: 'idle',
        facingRight: false, startX: 3150, endX: 4000, damageTimer: 0, attackTimer: 0
      },
      {
        x: 4800, y: 470, w: 50, h: 30, vx: 0, vy: 0, health: 2, state: 'idle',
        facingRight: false, startX: 4450, endX: 5200, damageTimer: 0, attackTimer: 0
      }
    ];
    let wolves: Wolf[] = initialWolves.map(w => ({ ...w }));

    const platforms: Platform[] = [
      // 1. Start Area
      { x: 0, y: 400, w: 300, h: 800, type: 'normal', label: 'نقطة البداية' },
      
      // 2. Obstacle 1: Balance Pillars
      { x: 420, y: 400, w: 40, h: 800, type: 'pillar' },
      { x: 580, y: 350, w: 40, h: 800, type: 'pillar' },
      { x: 760, y: 400, w: 40, h: 800, type: 'pillar' },
      { x: 960, y: 320, w: 40, h: 800, type: 'pillar' },
      
      // 3. Intermediate Pitfall Challenge
      { x: 1150, y: 400, w: 250, h: 800, type: 'normal' },
      // Precise jump gap (135px wide)
      { x: 1535, y: 400, w: 215, h: 800, type: 'normal' },
      
      // 3.5. Simple Stepping Stones
      { x: 1850, y: 320, w: 60, h: 800, type: 'pillar' },
      { x: 2030, y: 240, w: 60, h: 800, type: 'pillar' },
      { x: 2220, y: 360, w: 80, h: 800, type: 'normal' },
      
      // 4. Obstacle 2: Safe Area (Player throws rocks from here)
      { x: 2400, y: 400, w: 250, h: 800, type: 'normal', label: 'منطقة الأمان المؤقتة' },
      
      // Hanging wall holding the button (player passes under it)
      { x: 3050, y: -100, w: 40, h: 350, type: 'wall' },

      // 5. Obstacle A: Box and Wolves
      { x: 3150, y: 400, w: 900, h: 800, type: 'normal' }, // Long platform
      { x: 4050, y: 300, w: 50, h: 800, type: 'wall' }, // Wall to jump over using box

      // 6. Final Challenge Area (Hanging box)
      { x: 4250, y: 400, w: 200, h: 800, type: 'normal' }, // Arrival platform
      { x: 4450, y: 500, w: 800, h: 800, type: 'normal' }, // Lower floor for the hanging box puzzle
      { x: 5250, y: 300, w: 100, h: 800, type: 'wall' }, // High wall
      
      // 7. Final Crossing
      { x: 5350, y: 300, w: 400, h: 800, type: 'goal', label: 'بر الأمان (النهاية)' }
    ];

    // Button is on the LEFT face of the hanging wall
    const button: Button = { x: 3030, y: 180, w: 20, h: 60, active: false };
    
    // Moving platform starts at the far side (near button) and moves to the player
    const movingPlatform: MovingPlatform = { 
      x: 3030, y: 400, w: 120, h: 20, 
      startX: 2650, endX: 3030, 
      speed: 150, active: false, vx: 0 
    };

    const maxCameraX = 5800 - CANVAS_WIDTH;
    const goalX = 5350;

    const keys = {
      left: false,
      right: false,
      jump: false,
      jumpJustPressed: false,
      interact: false,
      interactJustPressed: false,
      aimThrow: false,
      aimThrowJustPressed: false,
      aimUp: false,
      aimDown: false,
      quickThrow: false,
      quickThrowJustPressed: false,
    };

    // --- Input Handling ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space' || e.code === 'KeyW') {
        if (!keys.jump) keys.jumpJustPressed = true;
        keys.jump = true;
        e.preventDefault();
      }
      if (e.code === 'KeyE' || e.code === 'Enter') {
        if (!keys.interact) keys.interactJustPressed = true;
        keys.interact = true;
      }
      if (e.code === 'KeyR') {
        if (!keys.aimThrow) keys.aimThrowJustPressed = true;
        keys.aimThrow = true;
      }
      if (e.code === 'KeyF') {
        if (!keys.quickThrow) keys.quickThrowJustPressed = true;
        keys.quickThrow = true;
      }
      if (e.code === 'ArrowUp') { keys.aimUp = true; e.preventDefault(); }
      if (e.code === 'ArrowDown') { keys.aimDown = true; e.preventDefault(); }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space' || e.code === 'KeyW') keys.jump = false;
      if (e.code === 'KeyE' || e.code === 'Enter') keys.interact = false;
      if (e.code === 'KeyR') keys.aimThrow = false;
      if (e.code === 'KeyF') keys.quickThrow = false;
      if (e.code === 'ArrowUp') keys.aimUp = false;
      if (e.code === 'ArrowDown') keys.aimDown = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    // --- Collision Helpers ---
    const getPlayerRect = (p: PlayerState) => ({
      x: p.x - p.width / 2,
      y: p.y - p.height,
      w: p.width,
      h: p.height
    });

    const isColliding = (r1: any, r2: any) => {
      return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
             r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    };

    // --- Rendering Helpers ---
    let cachedSkyGradient: CanvasGradient | null = null;
    
    const drawBackground = (ctx: CanvasRenderingContext2D, cameraX: number) => {
      if (!cachedSkyGradient) {
        cachedSkyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        cachedSkyGradient.addColorStop(0, '#0f172a');
        cachedSkyGradient.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = cachedSkyGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const x = i * 400 - (cameraX * 0.1) % 400;
        ctx.moveTo(x, CANVAS_HEIGHT);
        ctx.lineTo(x + 200, CANVAS_HEIGHT - 300 + Math.sin(i) * 50);
        ctx.lineTo(x + 400, CANVAS_HEIGHT);
      }
      ctx.fill();
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, p: PlayerState) => {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      
      // Apply squash and stretch
      let currentSquash = p.squash;
      let currentStretch = p.stretch;
      
      // Add rhythmic squash/stretch while running
      if (p.state === 'run' && p.isGrounded) {
        const runBounce = Math.sin(p.animTimer * 2); // Oscillates between -1 and 1
        currentSquash *= 1 - runBounce * 0.08;
        currentStretch *= 1 + runBounce * 0.08;
      }
      
      ctx.scale(currentSquash, currentStretch);
      
      // Draw Trajectory (Shortened to make aiming harder)
      if (p.isCharging) {
        const absoluteAimAngle = p.facingRight ? p.relativeAimAngle : Math.PI - p.relativeAimAngle;
        const power = 600 + p.chargeLevel * 800; // Fluctuating power
        
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.4 + p.chargeLevel * 0.6})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        // Only draw a short line indicating direction and power
        const lineLength = 20 + p.chargeLevel * 30;
        ctx.lineTo(Math.cos(absoluteAimAngle) * lineLength, -15 + Math.sin(absoluteAimAngle) * lineLength);
        ctx.stroke();
        
        // Draw Power Bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-20, -40, 40, 6);
        ctx.fillStyle = `rgb(${255 * (1 - p.chargeLevel)}, ${255 * p.chargeLevel}, 0)`;
        ctx.fillRect(-20, -40, 40 * p.chargeLevel, 6);
        
        // Draw Charging Aura
        ctx.save();
        const auraRadius = 20 + p.chargeLevel * 30;
        const r = 255;
        const g = Math.floor(255 * (1 - p.chargeLevel));
        const b = 0;
        
        ctx.beginPath();
        ctx.arc(0, -20, auraRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(0, -20, 5, 0, -20, auraRadius);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

      ctx.scale(p.facingRight ? 1 : -1, 1);

      ctx.fillStyle = '#000000';
      const t = p.animTimer;
      let legL = 0, legR = 0, bodyY = 0, bodyTilt = 0;

      if (p.state === 'run') {
        legL = Math.sin(t) * 15;
        legR = Math.sin(t + Math.PI) * 15;
        bodyY = Math.abs(Math.sin(t * 2)) * 3;
        bodyTilt = 0.1;
      } else if (p.state === 'jump') {
        legL = -10;
        legR = -5;
        bodyTilt = -0.1;
      } else if (p.state === 'fall') {
        legL = -5;
        legR = -10;
        bodyTilt = 0.1;
      } else {
        bodyY = Math.sin(t * 2) * 1;
      }

      // Legs
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -15 + bodyY); ctx.lineTo(legL, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -15 + bodyY); ctx.lineTo(legR, 0); ctx.stroke();

      // Torso
      ctx.save();
      ctx.translate(0, -15 + bodyY);
      ctx.rotate(bodyTilt);
      
      ctx.beginPath();
      ctx.moveTo(-8, -20); ctx.lineTo(8, -20); ctx.lineTo(12, 10); ctx.lineTo(-12, 10);
      ctx.fill();

      // Head
      ctx.beginPath(); ctx.arc(0, -25, 10, 0, Math.PI * 2); ctx.fill();

      // Glowing Eyes (Simulated with semi-transparent circles instead of shadowBlur)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath(); ctx.ellipse(3, -27, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-4, -27, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(3, -27, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-4, -27, 2, 3, 0, 0, Math.PI * 2); ctx.fill();

      // Arm holding rock
      if (p.rockCount > 0) {
        ctx.save();
        ctx.rotate(p.relativeAimAngle);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(14, -5); ctx.stroke();
        
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.arc(16, -5, 5, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(15, -6, 2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
      }

      ctx.restore();
      ctx.restore();
    };

    // --- Main Loop ---
    const update = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      let cameraX = player.x - Math.floor(CANVAS_WIDTH / 3);
      if (cameraX < 0) cameraX = 0;
      if (cameraX > maxCameraX) cameraX = maxCameraX;
      cameraX = Math.round(cameraX); // Prevent sub-pixel jitter

      // --- Rock Mechanics ---
      if (player.rockCount > 0) {
        if (keys.aimUp) player.relativeAimAngle -= 3 * dt;
        if (keys.aimDown) player.relativeAimAngle += 3 * dt;
        if (player.relativeAimAngle < -Math.PI / 2) player.relativeAimAngle = -Math.PI / 2;
        if (player.relativeAimAngle > 0) player.relativeAimAngle = 0; // Limit to upper level only
      }

      let pickedUp = false;
      if (keys.interactJustPressed) {
        let closestIdx = -1;
        let minDist = 100;
        rocks.forEach((r, idx) => {
          const dist = Math.hypot(r.x - player.x, r.y - player.y);
          if (dist < minDist) { minDist = dist; closestIdx = idx; }
        });
        if (closestIdx !== -1) {
          const r = rocks[closestIdx];
          if (player.rockCount < 4) {
            rocks.splice(closestIdx, 1);
            player.rockCount++;
            player.relativeAimAngle = 0;
            pickedUp = true;
          }
        }
      }

      if (keys.aimThrow && player.rockCount > 0) {
        player.isCharging = true;
        player.chargeLevel += player.chargeDir * dt * 2.0; // Fast fluctuation
        if (player.chargeLevel > 1) { player.chargeLevel = 1; player.chargeDir = -1; }
        else if (player.chargeLevel < 0) { player.chargeLevel = 0; player.chargeDir = 1; }
      } else if (!keys.aimThrow && player.isCharging) {
        player.isCharging = false;
        player.rockCount--;
        
        const absoluteAimAngle = player.facingRight ? player.relativeAimAngle : Math.PI - player.relativeAimAngle;
        const power = 600 + player.chargeLevel * 800; // Fluctuates between 600 and 1400
        
        audio.playThrow();
        rocks.push({
          id: Date.now(),
          x: player.x + (player.facingRight ? 4 : -4), // Spawn closer to center to avoid getting stuck in walls
          y: player.y - 15,
          vx: Math.cos(absoluteAimAngle) * power + player.vx * 0.5,
          vy: Math.sin(absoluteAimAngle) * power,
          radius: 5 + Math.random() * 2
        });
        player.chargeLevel = 0;
        player.chargeDir = 1;
      }
      keys.interactJustPressed = false;

      if (keys.quickThrowJustPressed && player.rockCount > 0 && !player.isCharging) {
        player.rockCount--;
        
        const absoluteAimAngle = player.facingRight ? 0 : Math.PI; // Straight throw
        const power = 1400; // Faster straight throw
        
        audio.playThrow();
        rocks.push({
          id: Date.now(),
          x: player.x + (player.facingRight ? 4 : -4), // Spawn closer to center to avoid getting stuck in walls
          y: player.y - 15,
          vx: Math.cos(absoluteAimAngle) * power + player.vx * 0.5,
          vy: -80, // Slight upward lift to counteract gravity initially
          radius: 5 + Math.random() * 2
        });
      }
      keys.quickThrowJustPressed = false;

      // --- Player Physics ---
      let moveDir = 0;
      if (keys.left) moveDir -= 1;
      if (keys.right) moveDir += 1;

      if (moveDir !== 0) {
        player.facingRight = moveDir > 0;
        player.vx += moveDir * ACCELERATION * dt;
        if (player.vx > MAX_SPEED) player.vx = MAX_SPEED;
        if (player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;
      } else {
        const friction = player.isGrounded ? FRICTION_GROUND : FRICTION_AIR;
        if (player.vx > 0) { player.vx -= friction * dt; if (player.vx < 0) player.vx = 0; }
        else if (player.vx < 0) { player.vx += friction * dt; if (player.vx > 0) player.vx = 0; }
      }

      // --- Jump Buffering & Coyote Time ---
      if (keys.jumpJustPressed) {
        player.jumpBuffer = 0.15; // 150ms jump buffer
      }
      if (player.jumpBuffer > 0) {
        player.jumpBuffer -= dt;
      }
      
      if (player.isGrounded) {
        player.coyoteTime = 0.15; // 150ms coyote time
      } else {
        if (player.coyoteTime > 0) player.coyoteTime -= dt;
      }

      if (player.jumpBuffer > 0 && player.coyoteTime > 0) {
        audio.playJump();
        player.vy = -JUMP_FORCE;
        player.isGrounded = false;
        player.jumpBuffer = 0;
        player.coyoteTime = 0;
        player.squash = 0.6;
        player.stretch = 1.4;
      }
      keys.jumpJustPressed = false;

      // Recover squash/stretch
      player.squash += (1 - player.squash) * 15 * dt;
      player.stretch += (1 - player.stretch) * 15 * dt;

      let currentGravity = GRAVITY;
      if (player.vy > 0) currentGravity *= FALL_MULTIPLIER;
      else if (player.vy < 0 && !keys.jump) currentGravity *= LOW_JUMP_MULTIPLIER;
      player.vy += currentGravity * dt;

      // --- Collision Detection ---
      const allPlatforms = [...platforms, movingPlatform];
      
      // 1. Player Horizontal
      player.x += player.vx * dt;
      let pRect = getPlayerRect(player);
      
      for (const p of allPlatforms) {
        if (isColliding(pRect, p)) {
          if (player.vx > 0) { player.x = p.x - player.width / 2; player.vx = 0; }
          else if (player.vx < 0) { player.x = p.x + p.w + player.width / 2; player.vx = 0; }
          pRect = getPlayerRect(player);
        }
      }
      
      // Player vs Boxes Horizontal
      for (const box of boxes) {
        let boxRect = { x: box.x, y: box.y, w: box.w, h: box.h };
        if (isColliding(pRect, boxRect)) {
          if (player.vx > 0) { 
            box.vx = player.vx; 
            player.x = box.x - player.width / 2; 
          }
          else if (player.vx < 0) { 
            box.vx = player.vx; 
            player.x = box.x + box.w + player.width / 2; 
          }
          pRect = getPlayerRect(player);
        }
      }

      // Boxes Horizontal
      for (const box of boxes) {
        box.vx *= 0.8; // Friction
        box.x += box.vx * dt;
        let boxRect = { x: box.x, y: box.y, w: box.w, h: box.h };
        
        for (const p of allPlatforms) {
          if (isColliding(boxRect, p)) {
            if (box.vx > 0) { box.x = p.x - box.w; box.vx = 0; }
            else if (box.vx < 0) { box.x = p.x + p.w; box.vx = 0; }
            boxRect.x = box.x;
          }
        }
      }

      // 3. Player Vertical
      player.y += player.vy * dt;
      pRect = getPlayerRect(player);
      player.isGrounded = false;
      let onMovingPlatform = false;

      for (const p of allPlatforms) {
        if (isColliding(pRect, p)) {
          if (player.vy > 0) { 
            player.y = p.y; 
            if (player.vy > 200) { player.squash = 1.4; player.stretch = 0.6; }
            player.vy = 0; 
            player.isGrounded = true; 
            if (p === movingPlatform) onMovingPlatform = true;
          }
          else if (player.vy < 0) { player.y = p.y + p.h + player.height; player.vy = 0; }
          pRect = getPlayerRect(player);
        }
      }
      
      // Player vs Boxes Vertical
      for (const box of boxes) {
        let boxRect = { x: box.x, y: box.y, w: box.w, h: box.h };
        if (isColliding(pRect, boxRect)) {
          if (player.vy > 0) {
            player.y = box.y; 
            if (player.vy > 200) { player.squash = 1.4; player.stretch = 0.6; }
            player.vy = 0; 
            player.isGrounded = true;
          } else if (player.vy < 0) {
            player.y = box.y + box.h + player.height; player.vy = 0;
          }
          pRect = getPlayerRect(player);
        }
      }

      // Boxes Vertical
      for (const box of boxes) {
        box.vy += GRAVITY * dt;
        box.y += box.vy * dt;
        let boxRect = { x: box.x, y: box.y, w: box.w, h: box.h };
        
        for (const p of allPlatforms) {
          if (isColliding(boxRect, p)) {
            if (box.vy > 0) { box.y = p.y - box.h; box.vy = 0; }
            else if (box.vy < 0) { box.y = p.y + p.h; box.vy = 0; }
            boxRect.y = box.y;
          }
        }
      }

      // --- Update Rocks ---
      const allPlatformsAndBoxes = [...allPlatforms, ...boxes];
      rocks.forEach(r => {
        r.vy += GRAVITY * dt;
        r.vx *= 0.99; // Air friction

        const rPrevX = r.x;
        const rPrevY = r.y;

        r.x += r.vx * dt;
        r.y += r.vy * dt;

        // Rock vs Platforms & Boxes
        for (const plat of allPlatformsAndBoxes) {
          if (r.x + r.radius > plat.x && r.x - r.radius < plat.x + plat.w &&
              r.y + r.radius > plat.y && r.y - r.radius < plat.y + plat.h) {
            if (rPrevY + r.radius <= plat.y && r.vy > 0) {
              r.y = plat.y - r.radius;
              if (r.vy > 100) audio.playRockImpact();
              r.vy *= -ROCK_BOUNCE;
              if (Math.abs(r.vx) > 0) {
                r.vx -= Math.sign(r.vx) * ROCK_FRICTION * dt;
                if (Math.abs(r.vx) < 10) r.vx = 0;
              }
              if (Math.abs(r.vy) < 50) r.vy = 0;
            } else if (rPrevY - r.radius >= plat.y + plat.h && r.vy < 0) {
              r.y = plat.y + plat.h + r.radius;
              if (r.vy < -100) audio.playRockImpact();
              r.vy *= -ROCK_BOUNCE;
            } else {
              if (rPrevX + r.radius <= plat.x && r.vx > 0) {
                r.x = plat.x - r.radius; 
                if (r.vx > 100) audio.playRockImpact();
                r.vx *= -ROCK_BOUNCE;
              } else if (rPrevX - r.radius >= plat.x + plat.w && r.vx < 0) {
                r.x = plat.x + plat.w + r.radius; 
                if (r.vx < -100) audio.playRockImpact();
                r.vx *= -ROCK_BOUNCE;
              }
            }
          }
        }

        // Rock vs Button
        if (!button.active) {
          const rockRect = { x: r.x - r.radius, y: r.y - r.radius, w: r.radius * 2, h: r.radius * 2 };
          const buttonRect = { x: button.x, y: button.y, w: button.w, h: button.h };
          if (isColliding(rockRect, buttonRect)) {
            button.active = true;
            button.x = 3040; // Press in visually (wall is at 3050)
            button.w = 10;
          }
        }

        // Rock vs Hanging Boxes
        let rockHitHangingBox = false;
        for (const hbox of hangingBoxes) {
          if (!hbox.hit) {
            const rockRect = { x: r.x - r.radius, y: r.y - r.radius, w: r.radius * 2, h: r.radius * 2 };
            const hboxRect = { x: hbox.x, y: hbox.y, w: hbox.w, h: hbox.h };
            if (isColliding(rockRect, hboxRect)) {
              hbox.hit = true;
              // Drop the box itself
              boxes.push({
                x: hbox.x,
                y: hbox.y,
                w: hbox.w,
                h: hbox.h,
                vx: 0,
                vy: 0
              });
              rockHitHangingBox = true;
              break;
            }
          }
        }
        if (rockHitHangingBox) {
          audio.playRockImpact();
          // Bounce the rock off the box instead of removing it
          r.vy = -50;
          r.vx = r.vx > 0 ? -40 : 40;
        }
      });

      // --- Moving Platform Logic ---
      if (button.active && !movingPlatform.active) {
        movingPlatform.active = true;
        movingPlatform.vx = -movingPlatform.speed; // Start moving towards player
      }

      audio.setPlatformMoving(movingPlatform.active);

      if (movingPlatform.active) {
        movingPlatform.x += movingPlatform.vx * dt;
        if (movingPlatform.vx > 0 && movingPlatform.x >= movingPlatform.endX) {
          movingPlatform.x = movingPlatform.endX;
          movingPlatform.vx *= -1;
        } else if (movingPlatform.vx < 0 && movingPlatform.x <= movingPlatform.startX) {
          movingPlatform.x = movingPlatform.startX;
          movingPlatform.vx *= -1;
        }
      }

      if (onMovingPlatform) {
        player.x += movingPlatform.vx * dt;
        pRect = getPlayerRect(player);
        for (const p of platforms) {
          if (isColliding(pRect, p)) {
            if (movingPlatform.vx > 0) player.x = p.x - player.width / 2;
            else if (movingPlatform.vx < 0) player.x = p.x + p.w + player.width / 2;
          }
        }
      }

      if (player.x < player.width / 2) { player.x = player.width / 2; player.vx = 0; }

      // --- Wolf Logic ---
      wolves.forEach(wolf => {
        if (wolf.health > 0 || wolf.state === 'dead') {
          // Gravity
          wolf.vy += GRAVITY * dt;
          wolf.y += wolf.vy * dt;

          // Collision with platforms
          let wolfRect = { x: wolf.x, y: wolf.y, w: wolf.w, h: wolf.h };
          for (const p of allPlatforms) {
            if (isColliding(wolfRect, p)) {
              if (wolf.vy > 0) { wolf.y = p.y - wolf.h; wolf.vy = 0; }
            }
          }
        }

        if (wolf.health > 0) {
          // AI
          if (wolf.damageTimer > 0) {
            wolf.damageTimer -= dt;
          }

          const distToPlayerX = Math.abs(player.x - wolf.x);
          const distToPlayerY = Math.abs(player.y - wolf.y);
          const playerInSight = distToPlayerX < 300 && distToPlayerY < 100;
          const playerInAttackRange = distToPlayerX < 60 && distToPlayerY < 50;

          if (wolf.state === 'attack') {
            wolf.vx = 0;
            wolf.attackTimer = (wolf.attackTimer || 0) + dt;
            if (wolf.attackTimer > 0.5) { // Attack duration
              // Deal damage if still in range
              if (playerInAttackRange) {
                player.y = CANVAS_HEIGHT + 100; // Trigger death
              }
              wolf.state = 'idle';
              wolf.attackTimer = 0;
            }
          } else if (playerInSight) {
            if (playerInAttackRange) {
              wolf.state = 'attack';
              audio.playWolfAttack();
              wolf.attackTimer = 0;
              wolf.vx = 0;
              wolf.facingRight = player.x > wolf.x;
            } else {
              // Chase player
              wolf.state = 'run';
              wolf.facingRight = player.x > wolf.x;
              wolf.vx = wolf.facingRight ? 150 : -150;
            }
          } else {
            // Patrol
            wolf.state = 'run';
            if (wolf.facingRight) {
              wolf.vx = 80;
              if (wolf.x > wolf.endX) wolf.facingRight = false;
            } else {
              wolf.vx = -80;
              if (wolf.x < wolf.startX) wolf.facingRight = true;
            }
          }

          wolf.x += wolf.vx * dt;

          // Wolf vs Rocks
          for (let i = rocks.length - 1; i >= 0; i--) {
            const r = rocks[i];
            const closestX = Math.max(wolf.x, Math.min(r.x, wolf.x + wolf.w));
            const closestY = Math.max(wolf.y, Math.min(r.y, wolf.y + wolf.h));
            const dx = r.x - closestX;
            const dy = r.y - closestY;
            if (dx * dx + dy * dy < r.radius * r.radius) {
              if (Math.abs(r.vx) > 50 || Math.abs(r.vy) > 50) {
                wolf.health -= 1;
                if (wolf.health <= 0) {
                  wolf.state = 'dead';
                } else {
                  wolf.damageTimer = 0.2;
                }
                audio.playRockImpact();
                // Bounce the rock instead of consuming it
                r.vy = -50;
                r.vx = r.vx > 0 ? -40 : 40;
              }
            }
          }
        }
      });

      // --- Death Logic ---
      if (player.y > CANVAS_HEIGHT + 50) {
        player.x = 100;
        player.y = 300;
        player.vx = 0;
        player.vy = 0;
        player.rockCount = 0;
        player.isCharging = false;
        
        button.active = false;
        button.x = 3030;
        button.w = 20;
        
        movingPlatform.active = false;
        movingPlatform.x = movingPlatform.endX; // Reset to far side
        movingPlatform.vx = 0;
        
        rocks = initialRocks.map(r => ({ ...r })); // Respawn rocks
        boxes = initialBoxes.map(b => ({ ...b })); // Reset boxes
        hangingBoxes = initialHangingBoxes.map(b => ({ ...b })); // Reset hanging boxes
        wolves = initialWolves.map(w => ({ ...w })); // Reset wolves

        setDeathCount(c => c + 1);
      }

      // State & Animation Sync
      if (!player.isGrounded) {
        player.state = player.vy < 0 ? 'jump' : 'fall';
      } else if (Math.abs(player.vx) > 10) {
        player.state = 'run';
        const speedRatio = Math.abs(player.vx) / MAX_SPEED;
        player.animTimer += dt * 15 * speedRatio; 
        
        player.stepTimer = (player.stepTimer || 0) + dt * speedRatio;
        if (player.stepTimer > 0.2) {
          audio.playStep();
          player.stepTimer = 0;
        }
      } else {
        player.state = 'idle';
        player.animTimer += dt;
        player.stepTimer = 0;
      }

      // --- Draw ---
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawBackground(ctx, cameraX);

      ctx.save();
      ctx.translate(-cameraX, 0);

      // Lava
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cameraX, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(cameraX, CANVAS_HEIGHT - 15, CANVAS_WIDTH, 15);
      
      // Platforms
      for (const p of platforms) {
        if (p.type === 'normal' || p.type === 'goal' || p.type === 'wall') {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#334155';
          ctx.fillRect(p.x, p.y, p.w, 8);
          
          if (p.label) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.label, p.x + p.w / 2, p.y + 40);
          }
        } else if (p.type === 'pillar') {
          // Main pillar body with 3D cylindrical gradient
          if (!p.cachedGradient) {
            p.cachedGradient = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
            p.cachedGradient.addColorStop(0, '#3f1616'); // Dark left edge
            p.cachedGradient.addColorStop(0.2, '#7f1d1d'); // Base color
            p.cachedGradient.addColorStop(0.5, '#991b1b'); // Center highlight
            p.cachedGradient.addColorStop(0.8, '#7f1d1d'); // Base color
            p.cachedGradient.addColorStop(1, '#270e0e'); // Dark right edge
          }
          
          ctx.fillStyle = p.cachedGradient;
          ctx.fillRect(p.x, p.y, p.w, p.h);

          // Vertical grooves (fluting) for classic pillar look
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          const grooveCount = Math.max(2, Math.floor(p.w / 12));
          const spacing = p.w / grooveCount;
          for (let i = 1; i < grooveCount; i++) {
            ctx.fillRect(p.x + i * spacing - 1, p.y, 2, p.h);
          }

          // Top Capital (wider decorative top)
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(p.x - 6, p.y, p.w + 12, 16);
          
          // Top highlight
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(p.x - 6, p.y, p.w + 12, 4);
          
          // Decorative horizontal bands
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(p.x - 4, p.y + 16, p.w + 8, 4);
          ctx.fillRect(p.x - 2, p.y + 40, p.w + 4, 6);
          ctx.fillRect(p.x - 2, p.y + 100, p.w + 4, 4);

          // Moss/Vines details for an ancient look
          ctx.fillStyle = '#15803d'; // Green moss
          ctx.beginPath();
          ctx.arc(p.x + 4, p.y + 16, 5, 0, Math.PI * 2);
          ctx.arc(p.x + 12, p.y + 20, 7, 0, Math.PI * 2);
          ctx.arc(p.x + p.w - 6, p.y + 18, 6, 0, Math.PI * 2);
          ctx.arc(p.x + p.w + 2, p.y + 24, 4, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#166534'; // Darker green detail
          ctx.beginPath();
          ctx.arc(p.x + 12, p.y + 22, 4, 0, Math.PI * 2);
          ctx.arc(p.x + p.w - 6, p.y + 20, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Button
      ctx.fillStyle = button.active ? '#7e22ce' : '#a855f7';
      ctx.fillRect(Math.round(button.x), Math.round(button.y), Math.round(button.w), Math.round(button.h));

      // Moving Platform
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(Math.round(movingPlatform.x), Math.round(movingPlatform.y), Math.round(movingPlatform.w), Math.round(movingPlatform.h));
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(Math.round(movingPlatform.x), Math.round(movingPlatform.y), Math.round(movingPlatform.w), 4);

      // Boxes
      for (const box of boxes) {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(Math.round(box.x), Math.round(box.y), Math.round(box.w), Math.round(box.h));
        ctx.fillStyle = '#d97706';
        ctx.fillRect(Math.round(box.x + 4), Math.round(box.y + 4), Math.round(box.w - 8), Math.round(box.h - 8));
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Math.round(box.x), Math.round(box.y));
        ctx.lineTo(Math.round(box.x + box.w), Math.round(box.y + box.h));
        ctx.moveTo(Math.round(box.x + box.w), Math.round(box.y));
        ctx.lineTo(Math.round(box.x), Math.round(box.y + box.h));
        ctx.stroke();
      }

      // Hanging Boxes
      for (const hbox of hangingBoxes) {
        if (!hbox.hit) {
          // Draw string
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hbox.x + hbox.w / 2, 0); // Hangs from top
          ctx.lineTo(hbox.x + hbox.w / 2, hbox.y);
          ctx.stroke();

          // Draw box (make it look like an orange pushable box)
          ctx.fillStyle = '#b45309';
          ctx.fillRect(Math.round(hbox.x), Math.round(hbox.y), Math.round(hbox.w), Math.round(hbox.h));
          ctx.fillStyle = '#d97706';
          ctx.fillRect(Math.round(hbox.x + 4), Math.round(hbox.y + 4), Math.round(hbox.w - 8), Math.round(hbox.h - 8));
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(Math.round(hbox.x), Math.round(hbox.y));
          ctx.lineTo(Math.round(hbox.x + hbox.w), Math.round(hbox.y + hbox.h));
          ctx.moveTo(Math.round(hbox.x + hbox.w), Math.round(hbox.y));
          ctx.lineTo(Math.round(hbox.x), Math.round(hbox.y + hbox.h));
          ctx.stroke();
        } else {
          // Draw broken string
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hbox.x + hbox.w / 2, 0);
          ctx.lineTo(hbox.x + hbox.w / 2, hbox.y - 20);
          ctx.stroke();
        }
      }

      // Wolves
      wolves.forEach(wolf => {
        if (wolf.health > 0 || wolf.state === 'dead') {
          ctx.save();
          ctx.translate(Math.round(wolf.x + wolf.w / 2), Math.round(wolf.y + wolf.h / 2));
          if (!wolf.facingRight) ctx.scale(-1, 1);
          
          // Attack animation logic
          let lungeOffset = 0;
          let jawOpen = 0;
          if (wolf.state === 'attack' && wolf.attackTimer !== undefined) {
            const t = wolf.attackTimer / 0.5; // 0 to 1
            if (t < 0.2) {
              // Wind up
              lungeOffset = -10 * (t / 0.2);
              ctx.rotate(-0.1);
            } else if (t < 0.5) {
              // Lunge
              const lungeT = (t - 0.2) / 0.3;
              lungeOffset = -10 + 30 * lungeT;
              jawOpen = 15 * lungeT;
              ctx.rotate(0.2 * lungeT);
            } else {
              // Hold and recover
              const recT = (t - 0.5) / 0.5;
              lungeOffset = 20 * (1 - recT);
              jawOpen = 15 * (1 - recT);
            }
            ctx.translate(lungeOffset, 0);

            // Attack indicator (Exclamation mark or red glow)
            if (t < 0.3) {
              ctx.save();
              ctx.scale(wolf.facingRight ? 1 : -1, 1); // Unflip for text
              ctx.fillStyle = '#ef4444';
              ctx.font = 'bold 24px sans-serif';
              ctx.fillText('!', -5, -40);
              ctx.restore();
            }
          }

          if (wolf.health > 0 && wolf.damageTimer > 0) {
            ctx.fillStyle = '#ef4444'; // Flashing red
          } else if (wolf.health <= 0) {
            ctx.fillStyle = '#4b5563'; // Dead gray
            ctx.rotate(Math.PI); // Upside down
          } else {
            ctx.fillStyle = '#1f2937'; // Dark gray wolf
          }
          
          // Body
          ctx.fillRect(-wolf.w / 2, -wolf.h / 2, wolf.w, wolf.h);
          
          // Legs (simple animation)
          if (wolf.state === 'run') {
            const legSwing = Math.sin(Date.now() / 50) * 10;
            ctx.fillRect(-wolf.w / 2 + 5 + legSwing, wolf.h / 2, 8, 10);
            ctx.fillRect(wolf.w / 2 - 15 - legSwing, wolf.h / 2, 8, 10);
          } else {
            ctx.fillRect(-wolf.w / 2 + 5, wolf.h / 2, 8, 10);
            ctx.fillRect(wolf.w / 2 - 15, wolf.h / 2, 8, 10);
          }
          
          // Head
          if (wolf.health > 0) {
            ctx.fillRect(wolf.w / 2 - 10, -wolf.h / 2 - 15, 25, 25);
            
            // Jaw (moves during attack)
            if (jawOpen > 0) {
              ctx.fillStyle = '#111827';
              ctx.fillRect(wolf.w / 2 + 5, -wolf.h / 2 + 5 + jawOpen, 15, 8);
              // Teeth
              ctx.fillStyle = 'white';
              ctx.fillRect(wolf.w / 2 + 8, -wolf.h / 2 + 5 + jawOpen - 3, 3, 3);
              ctx.fillRect(wolf.w / 2 + 14, -wolf.h / 2 + 5 + jawOpen - 3, 3, 3);
            }

            // Eye
            ctx.fillStyle = wolf.damageTimer > 0 ? 'white' : (wolf.state === 'attack' ? '#ef4444' : '#fca5a5');
            ctx.fillRect(wolf.w / 2, -wolf.h / 2 - 5, 6, 6);
            // Snout
            ctx.fillStyle = '#111827';
            ctx.fillRect(wolf.w / 2 + 15, -wolf.h / 2, 10, 10);
          }
          
          ctx.restore();
          
          // Health bar
          if (wolf.health > 0) {
            ctx.fillStyle = 'black';
            ctx.fillRect(wolf.x, wolf.y - 15, wolf.w, 6);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(wolf.x, wolf.y - 15, (wolf.w * wolf.health) / 3, 6);
          }
        }
      });

      // Rocks
      rocks.forEach(r => {
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.radius), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.arc(Math.round(r.x - 1), Math.round(r.y - 1), Math.round(r.radius / 2), 0, Math.PI * 2); ctx.fill();
        
        // Pickup indicator
        const dist = Math.hypot(r.x - player.x, r.y - player.y);
        if (dist < 100 && player.rockCount < 4) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('E', Math.round(r.x), Math.round(r.y - 15));
        }
      });

      drawPlayer(ctx, player);

      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`مرات السقوط: ${deathCount}`, 20, 30);

      ctx.textAlign = 'right';
      ctx.fillText(`الأحجار: ${player.rockCount} / 4`, CANVAS_WIDTH - 20, 30);

      if (player.x > goalX) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('لقد اجتزت المرحلة بنجاح!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameStarted, deathCount]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 flex flex-col items-center justify-center font-sans selection:bg-slate-800" dir="rtl">
      {!gameStarted ? (
        <div className="max-w-2xl text-center space-y-8 p-12 border border-slate-800/50 rounded-3xl bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tighter text-white drop-shadow-lg">
              تحدي <span className="text-red-500">الهاوية</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              لعبة منصات تتطلب دقة عالية. الأرضية مميتة، والتحكم ثقيل. هل يمكنك النجاة؟
            </p>
          </div>
          
          <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800/50 text-right space-y-4">
            <h3 className="font-bold text-slate-200 text-lg border-b border-slate-800 pb-2">القواعد الأساسية:</h3>
            <ul className="text-sm text-slate-400 space-y-3 list-disc list-inside">
              <li><strong className="text-red-400">الأرضية مميتة:</strong> أي سقوط للأسفل يعني الموت وإعادة المرحلة.</li>
              <li><strong className="text-slate-300">تحدي التحكم:</strong> حركة اللاعب ثقيلة وتتطلب دقة في التوقيت والقفز.</li>
              <li><strong className="text-purple-400">الزر والمنصة:</strong> التقط حجراً (<kbd className="bg-slate-800 px-1 rounded">E</kbd>)، ثم اضغط باستمرار على (<kbd className="bg-slate-800 px-1 rounded">R</kbd>) للتصويب (استخدم أسهم أعلى/أسفل لتغيير الزاوية). <span className="text-red-400 font-bold">انتبه: قوة الرمية تتغير باستمرار!</span> أفلت الزر في اللحظة المناسبة لرمي الحجر بالمسار المطلوب لضرب الزر في الجهة المقابلة.</li>
              <li><strong className="text-blue-400">الرمي السريع:</strong> اضغط (<kbd className="bg-slate-800 px-1 rounded">F</kbd>) لرمي الحجر بشكل مستقيم ومباشر. يمكنك حمل حتى 4 أحجار.</li>
              <li><strong className="text-orange-400">العقبات الأخيرة:</strong> ستواجه ذئاباً وصندوقاً يمكنك دفعه لتجاوز الجدار. بعد ذلك، ستجد جداراً عالياً جداً وصندوقاً معلقاً. اضرب الصندوق المعلق لإسقاطه، وادفعه لتتمكن من القفز، ثم اقضِ على الذئب الأخير!</li>
              <li><strong className="text-yellow-400">تحذير النسر:</strong> النسر يلاحقك باستمرار من الخلف! سرعته تزداد مع مرور الوقت. لا تتوقف أبداً ولا تتراجع للخلف، الأمان الوحيد هو الركض للأمام بأقصى سرعة!</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-slate-800 flex gap-4 text-sm text-slate-500 justify-center flex-wrap">
              <span>التحكم: الأسهم أو A/D للحركة</span>
              <span>•</span>
              <span>المسافة للقفز</span>
              <span>•</span>
              <span>E للالتقاط</span>
              <span>•</span>
              <span>R للتصويب والرمي المقوس</span>
              <span>•</span>
              <span>F للرمي السريع</span>
            </div>
          </div>

          <button 
            onClick={() => {
              setGameStarted(true);
              audio.init();
              audio.startMusic();
            }}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white transition-all rounded-full font-bold text-xl shadow-[0_0_40px_rgba(220,38,38,0.2)] hover:shadow-[0_0_60px_rgba(220,38,38,0.4)]"
          >
            ابدأ التحدي
          </button>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-slate-800">
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            className="block bg-[#0f172a]"
            style={{ touchAction: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
