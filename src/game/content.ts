import type { WD, Plat, Enemy, EType, Mood, Room } from './types';
const GY = 470;
export type PuzzleKind = 'akomas-count' | 'equation';
export interface LogicPuzzle {
  id: number;
  kind: PuzzleKind;
  prompt: string; // Arabic prompt text
  choices: string[];
  answer: number;
  hint?: string; clue?: string; piles?: number[];
}
// Optional mechanism panels. Every clue is drawn in the panel. No alphabet or language knowledge is required.
export const PUZZLES: Record<number, LogicPuzzle> = {
  2: {
    id: 2, kind: 'akomas-count',
    prompt: 'عدّ أكوام الحجارة المرسومة. كم كومة؟', piles: [3, 2, 4, 3, 2],
    choices: ['٣', '٤', '٥', '٦'],
    answer: 2, hint: 'كل كومة عبارة عن مجموعة أحجار مرصوصة',
  },
  3: {
    id: 3, kind: 'equation',
    prompt: 'ثلاثة أثقال متماثلة توازن تسعة أحجار. اضبط وزن الثقل الواحد.',
    choices: ['٢', '٣', '٤', '٩'],
    answer: 1, clue: '٣ أثقال متماثلة = ٩ أحجار متساوية.', hint: 'وزّع الحجارة بالتساوي بين الأثقال.',
  },
  6: {
    id: 6, kind: 'equation',
    prompt: 'كل ثقل كبير يعادل حجرين. كم ثقلاً توازن ٨ أحجار؟',
    choices: ['٢', '٣', '٤', '٥'],
    answer: 2, clue: 'ثقل كبير واحد = حجرين صغيرين.', hint: 'كوّن أزواجاً من الأحجار الثمانية.',
  },
};

const mkE = (t: EType, x: number, y: number, sx: number, ex: number): Enemy => {
  const s: Record<EType, { w: number; h: number; hp: number }> = { macaque: { w: 32, h: 40, hp: 1 }, boar: { w: 50, h: 34, hp: 2 }, wolf: { w: 54, h: 38, hp: 2 }, fox: { w: 46, h: 32, hp: 1 }, eagle: { w: 50, h: 32, hp: 2 }, snake: { w: 44, h: 18, hp: 1 }, lynx: { w: 60, h: 40, hp: 3 } };
  const c = s[t]; return { id: `${t}-${x}-${y}`, type: t, x, y, w: c.w, h: c.h, vx: 0, vy: 0, hp: c.hp, maxHp: c.hp, state: 'idle', faceR: false, sx, ex, dmgT: 0, atkT: 0, onGround: false, anim: 0, deadT: 0, shootT: 1, kbX: 0 };
};
const ground = (x: number, w: number, y = GY, type: Plat['type'] = 'ground'): Plat => ({ x, y, w, h: 900, type });
const rock = (id: number, x: number, y = GY - 28) => ({ id, x, y, vx: 0, vy: 0, r: 8 });
const room = (id: string, x0: number, x1: number, key: string, done: string[]): Room => ({ id, x0, x1, goal: `${key}Goal`, done, hints: [`${key}H1`, `${key}H2`, `${key}H3`] });
const coins = (list: number[][]) => list.map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 }));
const none = { sluices: [], floaters: [], shelters: [], triggers: [], decor: [], elevators: [], bridges: [], plates: [], hanging: [], mplatforms: [] };

// ============================================================
//  WORLD 1 — Cedar forest. Curiosity and learning.
//  Rooms follow the blockout in docs/design: rope bridge, box step and throw slot, exit pass.
// ============================================================
function wCedar(): WD {
  const P: Plat[] = [
    ground(0, 420),
    { x: 500, y: 420, w: 64, h: 900, type: 'pillar' }, { x: 610, y: 370, w: 94, h: 900, type: 'plateau' },
    { x: 704, y: -450, w: 240, h: 650, type: 'wall' }, // cedar canopy over the chasm
    { x: 944, y: 370, w: 146, h: 900, type: 'plateau' },
    ground(1090, 280),
    { x: 1420, y: 400, w: 64, h: 900, type: 'pillar' }, { x: 1560, y: 330, w: 64, h: 900, type: 'pillar' }, { x: 1700, y: 390, w: 64, h: 900, type: 'pillar' },
    ground(1850, 274), { x: 1850, y: 452, w: 10, h: 18, type: 'curb' },
    { x: 1770, y: -450, w: 230, h: 750, type: 'wall' }, // low cedar boughs: the high ledge is reached from the crate, not from the pillars
    { x: 2040, y: 212, w: 56, h: 18, type: 'ledge' },
    { x: 2096, y: -450, w: 28, h: 640, type: 'wall' }, // rock slab above the log gate leaves a throwing slot
    { x: 2150, y: 380, w: 64, h: 900, type: 'pillar' }, { x: 2300, y: 300, w: 64, h: 900, type: 'pillar' },
    { x: 2450, y: 370, w: 110, h: 900, type: 'plateau' },
    ground(2620, 460),
    { x: 3140, y: 410, w: 64, h: 900, type: 'pillar' }, { x: 3280, y: 340, w: 64, h: 900, type: 'pillar' }, { x: 3420, y: 410, w: 64, h: 900, type: 'pillar' },
    ground(3560, 860),
    { x: 3900, y: 390, w: 80, h: 80, type: 'ledge' }, { x: 4150, y: 390, w: 80, h: 80, type: 'ledge' }, // perches wolves cannot climb
  ];
  return { ...none, id: 'cedar', tif: 'ⵜⵉⴳⵎⵉⵏⵜ', name: 'غابة الأرز', sub: 'العالم الأول', width: 4420, mood: 'cedar',
    pal: { skyTop: '#16342a', skyBot: '#2c5640', far: '#1d4636', mid: '#2a6346', near: '#3a7a54', ground: '#1f3326', groundTop: '#4d8060', accent: '#d4a857', fog: '#a8c0a0', particle: '#8fb878' },
    pType: 'leaf', spawnX: 70, spawnY: GY - 48, threat: 'wolfpack',
    platforms: P, mplatforms: [{ x: 3000, y: 360, w: 110, h: 16, sx: 3000, ex: 3140, vx: 95, axis: 'x' }],
    bridges: [{ id: 0, x: 944, y: 370, w: 234, h: 14, down: false, progress: 0, hinge: 'right' }],
    levers: [
      { id: 'practice', x: 380, y: 430, on: false, lid: -1, target: true, optional: true },
      { id: 'target-bridge', x: 936, y: 412, on: false, lid: -1, bridgeId: 0, target: true, face: true },
      { id: 'target-gate', x: 2190, y: 222, on: false, lid: 2, target: true },
      { id: 'cairn-count', x: 2980, y: GY, on: false, lid: -1, puzzleId: 2, optional: true },
    ],
    doors: [{ id: 2, x: 2096, y: 232, w: 28, h: 238, open: false, kind: 'log' }],
    enemies: [mkE('macaque', 1200, GY - 40, 1110, 1360), mkE('boar', 2980, GY - 34, 2900, 3060), mkE('wolf', 4010, GY - 38, 3860, 4320), mkE('wolf', 4250, GY - 38, 3860, 4320)],
    rocks: [rock(1, 200), rock(2, 1110), rock(3, 1960), rock(4, 2640), rock(5, 3580)],
    boxes: [{ x: 1880, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4000, y: 150, w: 56, h: 56, hit: false }],
    hazards: [], checkpoints: [{ x: 1150, y: GY, on: false }, { x: 2640, y: GY, on: false }, { x: 3620, y: GY, on: false }],
    coins: coins([[180, 420], [660, 330], [1570, 290], [1890, 420], [2330, 260], [2640, 420], [3310, 300], [4160, 350]]),
    sheep: [{ id: 'sheep-960', x: 1010, y: 366, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2490', x: 2510, y: 366, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4330, y: GY - 150, w: 64, h: 150 },
    decor: [
      { kind: 'tracks', x: 120, y: GY, dir: 1, n: 7 }, { kind: 'wool', x: 470, y: GY - 6 }, { kind: 'wool', x: 1990, y: GY - 4 },
      { kind: 'tracks', x: 3300, y: 340, dir: 1, n: 2 }, { kind: 'tracks', x: 3440, y: GY, dir: 1, n: 6 },
    ],
    rooms: [room('bridge', 0, 1090, 'cBridge', ['target-bridge', 'sheep-960']), room('gate', 1090, 2620, 'cGate', ['target-gate', 'sheep-2490']), room('exit', 2620, 4420, 'cExit', [])],
    main: ['target-bridge', 'target-gate'], goalE: 4, goalS: 2, goalP: 2,
  };
}

// ============================================================
//  WORLD 2 — Highland pasture. Confidence and planning.
//  Stone scale, weight lift, ledge step under the eagle's flight line.
// ============================================================
function wPasture(): WD {
  const P: Plat[] = [
    ground(0, 420),
    { x: 540, y: 430, w: 70, h: 900, type: 'plateau' }, { x: 700, y: 370, w: 70, h: 900, type: 'plateau' }, { x: 860, y: 430, w: 70, h: 900, type: 'plateau' },
    ground(1020, 300),
    { x: 1380, y: 410, w: 64, h: 900, type: 'pillar' }, { x: 1530, y: 330, w: 64, h: 900, type: 'pillar' }, { x: 1680, y: 410, w: 64, h: 900, type: 'pillar' },
    ground(1840, 1740), { x: 1840, y: 452, w: 10, h: 18, type: 'curb' },
    { x: 2490, y: 190, w: 130, h: 18, type: 'ledge' },
    { x: 3300, y: 220, w: 280, h: 30, type: 'ledge' }, // terrace; its underside is the eagle shelter
    { x: 3560, y: 250, w: 20, h: 220, type: 'wall' },
    ground(3580, 840),
  ];
  return { ...none, id: 'pasture', tif: '', name: 'المرتفعات والمرعى', sub: 'العالم الثاني', width: 4420, mood: 'pasture',
    pal: { skyTop: '#34506e', skyBot: '#7ea8c4', far: '#446280', mid: '#648aa4', near: '#86a6b4', ground: '#3a4830', groundTop: '#7fa84a', accent: '#e0a040', fog: '#bcd0b0', particle: '#c8d8a0' },
    pType: 'mist', spawnX: 70, spawnY: GY - 48, threat: 'eagle',
    platforms: P,
    elevators: [{ id: 0, x: 2380, y: GY, w: 90, h: 14, baseY: GY, topY: 190, speed: 70, plateId: 99 }],
    levers: [{ id: 'weights-panel', x: 3740, y: GY, on: false, lid: -1, puzzleId: 6, optional: true }],
    doors: [{ id: 1, x: 1292, y: -500, w: 28, h: GY + 500, open: false, kind: 'gate' }],
    plates: [{ key: 'scale', x: 1180, y: GY, w: 56, h: 10, pressed: false, lid: 1, need: 2 }, { id: 99, x: 2296, y: GY, w: 56, h: 10, pressed: false, lid: -1, elevatorId: 0 }],
    enemies: [mkE('fox', 1100, GY - 32, 1030, 1250), mkE('fox', 2050, GY - 32, 1990, 2250), mkE('eagle', 3200, 130, 2760, 3620)],
    rocks: [rock(1, 200), rock(2, 1060), rock(3, 1110), rock(4, 2660), rock(5, 3620)],
    boxes: [{ x: 1900, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3120, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }],
    hazards: [], checkpoints: [{ x: 1060, y: GY, on: false }, { x: 1880, y: GY, on: false }, { x: 2700, y: GY, on: false }],
    coins: coins([[200, 420], [720, 330], [1550, 280], [1890, 420], [2550, 150], [2660, 420], [3440, 170], [4140, 420]]),
    sheep: [{ id: 'sheep-920', x: 1562, y: 326, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2540', x: 2570, y: 186, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4340, y: GY - 150, w: 64, h: 150 },
    triggers: [{ key: 'ledge', x: 3300, y: 160, w: 280, h: 60 }],
    shelters: [{ x: 3300, y: 250, w: 260, h: 220 }],
    decor: [
      { kind: 'scale', x: 300, y: GY, data: [2, 1, 1] }, { kind: 'grass', x: 0, y: GY, n: 40 }, { kind: 'scale', x: 1250, y: GY, data: [2, 0, 0] },
      { kind: 'tracks', x: 1880, y: GY, dir: 1, n: 5 }, { kind: 'shelterSign', x: 3290, y: GY },
    ],
    rooms: [room('scale', 0, 1320, 'pScale', ['scale']), room('first', 1320, 1840, 'pFirst', ['sheep-920']), room('lift', 1840, 2700, 'pLift', ['sheep-2540']), room('ledge', 2700, 3580, 'pLedge', ['ledge']), room('exit', 3580, 4420, 'pExit', [])],
    main: ['scale', 'ledge'], goalE: 3, goalS: 2, goalP: 2,
  };
}

// ============================================================
//  WORLD 3 — Oum Er-Rbia watercourse. Anticipation and control.
//  Sluice routing, floating trunk, lob over a raised bridge, telegraphed flood.
// ============================================================
function wGorge(): WD {
  const P: Plat[] = [
    ground(0, 380, GY, 'plateau'),
    { x: 500, y: 430, w: 70, h: 900, type: 'pillar' }, { x: 650, y: 370, w: 70, h: 900, type: 'pillar' }, { x: 800, y: 430, w: 70, h: 900, type: 'pillar' },
    ground(950, 260, GY, 'plateau'),
    { x: 1290, y: 510, w: 60, h: 900, type: 'pillar' }, { x: 1400, y: 500, w: 60, h: 900, type: 'pillar' }, { x: 1520, y: 510, w: 60, h: 900, type: 'pillar' },
    ground(1650, 110, GY, 'plateau'),
    ground(2200, 260, GY, 'plateau'),
    ground(2740, 260, GY, 'plateau'),
    { x: 3060, y: 420, w: 64, h: 900, type: 'pillar' }, { x: 3200, y: 360, w: 64, h: 900, type: 'pillar' }, { x: 3340, y: 420, w: 64, h: 900, type: 'pillar' },
    ground(3480, 940, GY, 'plateau'),
    { x: 3700, y: 380, w: 160, h: 20, type: 'ledge' }, { x: 3950, y: 300, w: 160, h: 20, type: 'ledge' }, { x: 4180, y: 230, w: 240, h: 24, type: 'ledge' },
  ];
  return { ...none, id: 'gorge', tif: '', name: 'مضيق أم الربيع', sub: 'العالم الثالث', width: 4420, mood: 'gorge',
    pal: { skyTop: '#527c87', skyBot: '#c4d7cb', far: '#577e80', mid: '#7c9990', near: '#42695b', ground: '#303f3d', groundTop: '#bac2a1', accent: '#e0bc72', fog: '#c5e0d9', particle: '#d6e9e0' },
    pType: 'mist', spawnX: 70, spawnY: GY - 48, threat: 'flood',
    platforms: P, mplatforms: [{ x: 3000, y: 450, w: 100, h: 16, sx: 3000, ex: 3060, vx: 40, axis: 'x' }],
    bridges: [{ id: 0, x: 2460, y: GY, w: 280, h: 14, down: false, progress: 0 }],
    levers: [
      { id: 'target-gorge', x: 2752, y: 500, on: false, lid: -1, bridgeId: 0, target: true, face: true },
      { id: 'piles-panel', x: 2400, y: GY, on: false, lid: -1, puzzleId: 3, optional: true },
    ],
    doors: [],
    enemies: [mkE('fox', 2260, GY - 32, 2210, 2450), mkE('snake', 2900, GY - 18, 2760, 2990)],
    rocks: [rock(1, 200), rock(2, 980), rock(3, 2220), rock(4, 2860), rock(5, 3500)],
    boxes: [],
    // Every basin has a fixed bed at y = 700. Damage and drawing use the same rectangle.
    hazards: [
      { x: 380, y: GY + 30, w: 570, h: 200, type: 'water' },
      { id: 'b1', x: 1210, y: 480, w: 440, h: 220, type: 'water', lowY: 600, highY: 480 },
      { id: 'b2', x: 1760, y: 690, w: 440, h: 10, type: 'water', lowY: 690, highY: 488 },
      { x: 2460, y: GY + 30, w: 280, h: 200, type: 'water' },
      { x: 3000, y: GY + 30, w: 480, h: 200, type: 'water' },
    ],
    sluices: [{ id: 's1', x: 1150, y: GY, toB: false, a: 'b1', b: 'b2', award: 'sluice' }],
    floaters: [{ id: 'trunk', x: 1775, y: 680, w: 410, h: 14, basin: 'b2' }],
    flood: { x: 3480, w: 940, bottom: 720, startY: 560, endY: 425, triggerX: 3580, warn: 5, rise: 14 },
    checkpoints: [{ x: 990, y: GY, on: false }, { x: 2240, y: GY, on: false }, { x: 3500, y: GY, on: false }],
    coins: coins([[180, 420], [680, 330], [1420, 460], [1700, 420], [2300, 420], [2800, 420], [3220, 320], [4300, 190]]),
    sheep: [{ id: 'sheep-1000', x: 2330, y: GY - 4, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2440', x: 2880, y: GY - 4, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4300, y: 80, w: 64, h: 150 },
    decor: [
      { kind: 'marks', x: 1212, y: 480, data: [480, 600] }, { kind: 'marks', x: 2196, y: 488, data: [488, 690] }, { kind: 'tracks', x: 2210, y: GY, dir: 1, n: 4 },
    ],
    rooms: [room('sluice', 0, 2200, 'gSluice', ['sluice', 'sheep-1000']), room('bridge', 2200, 3000, 'gBridge', ['target-gorge', 'sheep-2440']), room('current', 3000, 3480, 'gCurrent', []), room('flood', 3480, 4420, 'gFlood', [])],
    main: ['sluice', 'target-gorge'], goalE: 3, goalS: 2, goalP: 2,
  };
}

// ============================================================
//  WORLD 4 — Snow peaks. Danger and courage.
//  Ice reading, hoofprint route, three bells, shelter route ahead of a telegraphed avalanche.
// ============================================================
function wSnow(): WD {
  const P: Plat[] = [
    ground(0, 200, GY, 'ice'), ground(200, 130, 520, 'ice'), ground(330, 70, GY, 'ice'),
    { x: 200, y: GY, w: 64, h: 12, type: 'ice' }, { x: 266, y: GY, w: 64, h: 12, type: 'crack' },
    { x: 520, y: 430, w: 70, h: 900, type: 'ice' }, { x: 680, y: 360, w: 70, h: 900, type: 'ice' }, { x: 840, y: 290, w: 70, h: 900, type: 'ice' }, { x: 1000, y: 360, w: 70, h: 900, type: 'ice' },
    { x: 610, y: 450, w: 50, h: 14, type: 'crack' }, { x: 770, y: 400, w: 50, h: 14, type: 'crack' }, { x: 930, y: 380, w: 50, h: 14, type: 'crack' },
    ground(1160, 280, GY, 'ice'),
    { x: 1520, y: 400, w: 64, h: 900, type: 'ice' }, { x: 1660, y: 320, w: 64, h: 900, type: 'ice' }, { x: 1800, y: 400, w: 64, h: 900, type: 'ice' },
    { x: 1590, y: 440, w: 50, h: 14, type: 'crack' }, { x: 1730, y: 440, w: 50, h: 14, type: 'crack' },
    ground(1940, 240, GY, 'ice'),
    ground(2440, 300, GY, 'ice'),
    ground(2740, 460, GY, 'ice'), { x: 2900, y: 370, w: 170, h: 24, type: 'ledge' },
    { x: 3260, y: 420, w: 70, h: 900, type: 'ice' }, { x: 3400, y: 350, w: 70, h: 900, type: 'ice' }, { x: 3540, y: 420, w: 70, h: 900, type: 'ice' },
    ground(3700, 860, GY, 'ice'), { x: 3880, y: 370, w: 170, h: 24, type: 'ledge' }, { x: 4260, y: 370, w: 170, h: 24, type: 'ledge' },
    { x: 4560, y: GY - 60, w: 380, h: 900, type: 'goal' },
  ];
  return { ...none, id: 'snow', tif: '', name: 'القمم الثلجية', sub: 'العالم الأخير', width: 4940, mood: 'snow',
    pal: { skyTop: '#0a2438', skyBot: '#4a7898', far: '#143a56', mid: '#2a5e7a', near: '#4a82a0', ground: '#143248', groundTop: '#dceaf2', accent: '#8ac0e0', fog: '#c0d8e8', particle: '#ffffff' },
    pType: 'snow', spawnX: 70, spawnY: GY - 48, threat: 'avalanche',
    platforms: P,
    // The ice bridge hinges on the far bank, so its raised deck seals the far side completely.
    bridges: [{ id: 0, x: 2440, y: GY, w: 260, h: 14, down: false, progress: 0, hinge: 'right' }],
    // Pattern on the tablet: low, high, mid. Bells stand in a different order on the ledge.
    levers: [
      { id: 'bell-high', x: 2060, y: GY, on: false, lid: -1, seq: 2, seqMax: 3, bell: 2 },
      { id: 'bell-low', x: 2110, y: GY, on: false, lid: -1, seq: 1, seqMax: 3, bell: 0 },
      { id: 'bell-mid', x: 2160, y: GY, on: false, lid: -1, seq: 3, seqMax: 3, bell: 1, bridgeId: 0 },
    ],
    doors: [],
    enemies: [mkE('fox', 1250, GY - 32, 1180, 1420), mkE('eagle', 3200, 150, 2800, 3620)],
    rocks: [rock(1, 120), rock(2, 1200), rock(3, 2460), rock(4, 2780), rock(5, 3720)],
    boxes: [],
    hazards: [],
    shelters: [{ x: 2900, y: 394, w: 170, h: 76 }, { x: 3880, y: 394, w: 170, h: 76 }, { x: 4260, y: 394, w: 170, h: 76 }],
    triggers: [{ key: 'ice-path', x: 1160, y: 400, w: 60, h: 70 }, { key: 'tracks', x: 1940, y: 400, w: 60, h: 70 }],
    avalanche: { triggerX: 3860, startX: 3440, warn: 6, speed: 190 },
    checkpoints: [{ x: 1240, y: GY, on: false }, { x: 1962, y: GY, on: false }, { x: 2780, y: GY, on: false }, { x: 3760, y: GY, on: false }],
    coins: coins([[180, 420], [700, 320], [860, 250], [1680, 280], [2020, 420], [2460, 420], [2980, 330], [3420, 310], [4600, 360]]),
    sheep: [{ id: 'sheep-1000', x: 1340, y: GY - 4, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2580', x: 2620, y: GY - 4, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 0, y: 0, w: 0, h: 0 }, endX: 4580,
    decor: [
      { kind: 'crackDemo', x: 120, y: GY }, { kind: 'tracks', x: 528, y: 430, dir: 1, n: 2 }, { kind: 'tracks', x: 688, y: 360, dir: 1, n: 2 }, { kind: 'tracks', x: 848, y: 290, dir: 1, n: 2 }, { kind: 'tracks', x: 1008, y: 360, dir: 1, n: 2 },
      { kind: 'tracks', x: 1528, y: 400, dir: 1, n: 2 }, { kind: 'tracks', x: 1668, y: 320, dir: 1, n: 2 }, { kind: 'tracks', x: 1808, y: 400, dir: 1, n: 2 },
      { kind: 'tablet', x: 2005, y: GY, data: [0, 2, 1] }, { kind: 'shelterSign', x: 2890, y: GY }, { kind: 'shelterSign', x: 3870, y: GY }, { kind: 'shelterSign', x: 4250, y: GY },
    ],
    rooms: [room('ice', 0, 1160, 'sIce', ['ice-path', 'sheep-1000']), room('tracks', 1160, 1940, 'sTracks', ['tracks']), room('bells', 1940, 2740, 'sBells', ['sequence', 'sheep-2580']), room('storm', 2740, 3700, 'sStorm', []), room('shelter', 3700, 4940, 'sShelter', [])],
    main: ['ice-path', 'tracks', 'sequence'], goalE: 2, goalS: 2, goalP: 3,
  };
}
export const WORLDS = [wCedar, wPasture, wGorge, wSnow];
export const MOODS: Mood[] = ['cedar', 'pasture', 'gorge', 'snow'];
