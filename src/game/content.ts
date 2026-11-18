import type { WD, Plat, Enemy, EType, Mood } from './types';
const GY = 470;
export type PuzzleKind = 'symbol-match' | 'akomas-count' | 'equation' | 'sequence';
export interface LogicPuzzle {
  id: number;
  kind: PuzzleKind;
  // symbol-match: given a row of Amazigh symbols with one missing, pick the right one from 4 choices
  prompt: string; // Arabic prompt text
  symbols?: string[]; // the sequence shown (with '?' for missing)
  choices: string[]; // selectable answers
  answer: number; // index into choices
  hint?: string; clue?: string; piles?: number[];
}
// Each world gets a unique logic puzzle that must be solved before its lever activates.
export const PUZZLES: Record<number, LogicPuzzle> = {
  1: {
    id: 1, kind: 'symbol-match',
    prompt: 'أكمل النمط الأمازيغي — أي رمز يأتي بعد؟',
    symbols: ['ⴰ', 'ⴱ', 'ⴰ', '?'],
    choices: ['ⴱ', 'ⴰ', 'ⵎ', 'ⵉ'],
    answer: 0, clue: 'النقش القريب: ⴰ ⴱ | ⴰ ⴱ | ⴰ ؟ — نفس الزوج يتكرر.', hint: 'لاحظ الزوج المتكرر في النقش.',
  },
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
  4: {
    id: 4, kind: 'sequence',
    prompt: 'أكمل التسلسل: ١ ، ٤ ، ٩ ، ١٦ ، ؟',
    choices: ['٢٠', '٢٥', '٢٤', '٣٦'],
    answer: 1, hint: 'كل رقم هو مربع ترتيبه: ١² ، ٢² ، ٣² ، ٤² ...',
  },
  5: {
    id: 5, kind: 'symbol-match',
    prompt: 'أي شكل يختلف عن الأشكال الثلاثة الأخرى؟',
    symbols: ['ⵍ', 'ⵍ', 'ⵍ', 'ⴰ'],
    choices: ['ⵍ', 'ⵎ', 'ⵏ', 'ⴰ'],
    answer: 3, clue: 'ثلاث علامات متطابقة وعلامة واحدة مختلفة في الشكل.', hint: 'قارن الأشكال فقط؛ لا تحتاج معرفة أسماء الحروف.',
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

// ============================================================
//  WORLDS — 4 Middle Atlas environments (sheep placed on safe platforms)
// ============================================================
function wCedar(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 400, h: 900, type: 'ground' },
    { x: 500, y: 420, w: 64, h: 900, type: 'pillar' }, { x: 640, y: 360, w: 64, h: 900, type: 'pillar' }, { x: 780, y: 410, w: 64, h: 900, type: 'pillar' },
    { x: 920, y: 350, w: 80, h: 900, type: 'plateau' },
    { x: 1090, y: GY, w: 280, h: 900, type: 'ground' },
    { x: 1420, y: 400, w: 64, h: 900, type: 'pillar' }, { x: 1560, y: 330, w: 64, h: 900, type: 'pillar' }, { x: 1700, y: 390, w: 64, h: 900, type: 'pillar' },
    { x: 1850, y: GY, w: 260, h: 900, type: 'ground' },
    { x: 2120, y: 410, w: 56, h: 900, type: 'pillar' }, { x: 2150, y: 380, w: 64, h: 900, type: 'pillar' }, { x: 2300, y: 300, w: 64, h: 900, type: 'pillar' }, { x: 2450, y: 370, w: 70, h: 900, type: 'plateau' },
    { x: 2700, y: 410, w: 56, h: 900, type: 'pillar' },
    { x: 2620, y: GY, w: 460, h: 900, type: 'ground' },
    { x: 3140, y: 410, w: 64, h: 900, type: 'pillar' }, { x: 3280, y: 340, w: 64, h: 900, type: 'pillar' }, { x: 3420, y: 410, w: 64, h: 900, type: 'pillar' },
    { x: 3560, y: GY, w: 860, h: 900, type: 'ground' },
  ];
  return { id: 'cedar', tif: 'ⵜⵉⴳⵎⵉⵏⵜ', name: 'غابة الأرز', sub: 'العالم الأول', width: 4420, mood: 'cedar',
    pal: { skyTop: '#16342a', skyBot: '#2c5640', far: '#1d4636', mid: '#2a6346', near: '#3a7a54', ground: '#1f3326', groundTop: '#4d8060', accent: '#d4a857', fog: '#a8c0a0', particle: '#8fb878' },
    pType: 'leaf', spawnX: 70, spawnY: GY - 48, threat: 'wolfpack',
    platforms: P, mplatforms: [{ x: 3000, y: 360, w: 110, h: 16, sx: 3000, ex: 3140, vx: 95, axis: 'x' }], bridges: [], elevators: [],
    levers: [
      { id: 'lever-700', x: 700, y: 360, on: false, lid: 1, seq: 1, seqMax: 3 },
      { id: 'lever-1700', x: 1700, y: 390, on: false, lid: 2, seq: 2, seqMax: 3 },
      { id: 'lever-3140', x: 3140, y: 410, on: false, lid: 0, seq: 3, seqMax: 3, puzzleId: 1 }
    ],
    doors: [
      { id: 0, x: 4240, y: -500, w: 32, h: GY + 500, open: false },
      { id: 1, x: 1090, y: -500, w: 32, h: GY + 500, open: false },
      { id: 2, x: 2450, y: -500, w: 32, h: GY + 500, open: false }
    ],
    plates: [],
    enemies: [ mkE('macaque', 1200, GY - 40, 1110, 1360), mkE('boar', 2850, GY - 34, 2770, 3030), mkE('wolf', 3800, GY - 38, 3580, 4320), mkE('wolf', 4050, GY - 38, 3580, 4320) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 1110, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2640, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3580, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 2080, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3300, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4120, y: 110, w: 56, h: 56, hit: false }],
    hazards: [{ x: 1380, y: GY, w: 40, h: 50, type: 'spike' }], checkpoints: [{ x: 1090, y: GY, on: false }, { x: 2620, y: GY, on: false }],
    coins: [[180, 420], [660, 320], [1570, 290], [1890, 420], [2330, 260], [2640, 420], [4160, 420]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ id: 'sheep-960', x: 960, y: 300, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2490', x: 2490, y: 320, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4320, y: GY - 150, w: 64, h: 150 }, goalE: 4, goalS: 2, goalP: 1,
  };
}
function wPasture(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 420, h: 900, type: 'ground' },
    { x: 540, y: 430, w: 70, h: 900, type: 'plateau' }, { x: 700, y: 370, w: 70, h: 900, type: 'plateau' }, { x: 860, y: 430, w: 70, h: 900, type: 'plateau' },
    { x: 1020, y: GY, w: 300, h: 900, type: 'ground' },
    { x: 1160, y: 420, w: 56, h: 900, type: 'plateau' }, { x: 1380, y: 410, w: 64, h: 900, type: 'plateau' }, { x: 1530, y: 330, w: 64, h: 900, type: 'plateau' }, { x: 1680, y: 410, w: 64, h: 900, type: 'plateau' },
    { x: 1840, y: GY, w: 650, h: 900, type: 'ground' },
    { x: 2490, y: 260, w: 110, h: 18, type: 'plateau' }, // high ledge reachable via elevator
    { x: 2160, y: 390, w: 64, h: 900, type: 'plateau' }, { x: 2280, y: 390, w: 64, h: 18, type: 'plateau' }, { x: 2478, y: 400, w: 62, h: 18, type: 'plateau' },
    { x: 2620, y: GY, w: 440, h: 900, type: 'ground' },
    { x: 3100, y: 430, w: 56, h: 900, type: 'plateau' }, { x: 3160, y: 420, w: 64, h: 900, type: 'plateau' }, { x: 3300, y: 350, w: 64, h: 900, type: 'plateau' }, { x: 3440, y: 420, w: 64, h: 900, type: 'plateau' },
    { x: 3580, y: GY, w: 840, h: 900, type: 'ground' },
  ];
  return { id: 'pasture', tif: '', name: 'المرتفعات والمرعى', sub: 'العالم الثاني', width: 4420, mood: 'pasture',
    pal: { skyTop: '#34506e', skyBot: '#7ea8c4', far: '#446280', mid: '#648aa4', near: '#86a6b4', ground: '#3a4830', groundTop: '#7fa84a', accent: '#e0a040', fog: '#bcd0b0', particle: '#c8d8a0' },
    pType: 'mist', spawnX: 70, spawnY: GY - 48, threat: 'eagle',
    platforms: P, mplatforms: [{ x: 2080, y: 330, w: 100, h: 16, sx: 2080, ex: 2160, vx: 75, axis: 'y', sy: 290, ey: 390 }], bridges: [],
    elevators: [{ id: 0, x: 2380, y: GY, w: 90, h: 14, baseY: GY, topY: 260, speed: 60, plateId: 99 }],
    levers: [
      { id: 'lever-1560', x: 1560, y: 330, on: false, lid: 1, puzzleId: 3 },
      { id: 'lever-2760', x: 2760, y: GY - 30, on: false, lid: 0, puzzleId: 6 }
    ],
    doors: [
      { id: 0, x: 4320, y: -500, w: 32, h: GY + 500, open: false },
      { id: 1, x: 2120, y: -500, w: 28, h: GY + 500, open: false },
      { id: 2, x: 2600, y: -500, w: 28, h: GY + 500, open: false }
    ],
    plates: [{ x: 2030, y: GY, w: 56, h: 10, pressed: false, lid: 2 }, { id: 99, x: 1960, y: GY, w: 56, h: 10, pressed: false, lid: -1, elevatorId: 0 }],
    enemies: [ mkE('fox', 1100, GY - 32, 1030, 1310), mkE('fox', 1890, GY - 32, 1850, 2090), mkE('wolf', 2760, GY - 38, 2640, 3050), mkE('eagle', 3900, 190, 3600, 4200) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 1050, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2640, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3600, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 1900, y: GY - 56, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3304, y: 294, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4220, y: 110, w: 56, h: 56, hit: false }, { x: 2740, y: 130, w: 56, h: 56, hit: false }],
    hazards: [{ x: 1350, y: GY, w: 30, h: 50, type: 'spike' }], checkpoints: [{ x: 1020, y: GY, on: false }, { x: 2620, y: GY, on: false }],
    coins: [[200, 420], [720, 330], [1550, 280], [1890, 420], [2350, 270], [2660, 420], [4140, 420]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ id: 'sheep-920', x: 920, y: 380, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2540', x: 2540, y: 260, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4340, y: GY - 150, w: 64, h: 150 }, goalE: 4, goalS: 2, goalP: 3,
  };
}
function wGorge(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 380, h: 900, type: 'plateau' },
    { x: 500, y: 430, w: 70, h: 900, type: 'pillar' }, { x: 650, y: 370, w: 70, h: 900, type: 'pillar' }, { x: 800, y: 430, w: 70, h: 900, type: 'pillar' },
    { x: 950, y: GY, w: 260, h: 900, type: 'plateau' },
    { x: 1110, y: 410, w: 56, h: 220, type: 'pillar' }, { x: 1240, y: 380, w: 70, h: 220, type: 'pillar' }, { x: 1400, y: 320, w: 70, h: 220, type: 'pillar' }, { x: 1560, y: 380, w: 70, h: 220, type: 'pillar' },
    { x: 1720, y: GY, w: 300, h: 900, type: 'plateau' },
    { x: 1990, y: 410, w: 56, h: 900, type: 'pillar' }, { x: 2110, y: 400, w: 64, h: 900, type: 'pillar' }, { x: 2250, y: 320, w: 64, h: 900, type: 'pillar' }, { x: 2390, y: 400, w: 70, h: 900, type: 'pillar' },
    { x: 2540, y: GY, w: 420, h: 900, type: 'plateau' },
    { x: 2780, y: 440, w: 56, h: 900, type: 'pillar' }, { x: 2990, y: 430, w: 56, h: 900, type: 'pillar' }, { x: 3060, y: 420, w: 64, h: 900, type: 'pillar' }, { x: 3200, y: 350, w: 64, h: 900, type: 'pillar' }, { x: 3340, y: 420, w: 64, h: 900, type: 'pillar' },
    { x: 3480, y: GY, w: 940, h: 900, type: 'plateau' },
  ];
  P.push({ x: 1590, y: -450, w: 300, h: 540, type: 'wall' });
  return { id: 'gorge', tif: '', name: 'مضيق أم الربيع', sub: 'العالم الثالث', width: 4420, mood: 'gorge',
    pal: { skyTop: '#527c87', skyBot: '#c4d7cb', far: '#577e80', mid: '#7c9990', near: '#42695b', ground: '#303f3d', groundTop: '#bac2a1', accent: '#e0bc72', fog: '#c5e0d9', particle: '#d6e9e0' },
    pType: 'mist', spawnX: 70, spawnY: GY - 48, threat: 'flood',
    platforms: P, mplatforms: [{ x: 2020, y: 350, w: 100, h: 16, sx: 2020, ex: 2110, vx: 80, axis: 'y', sy: 310, ey: 410 }, { x: 3020, y: 390, w: 100, h: 16, sx: 3020, ex: 3060, vx: 90, axis: 'x' }],
    bridges: [{ id: 0, x: 1630, y: 410, w: 220, h: 14, down: false, progress: 0 }], elevators: [],
    levers: [
      { id: 'lever-1400', x: 1400, y: 320, on: false, lid: -1, bridgeId: 0, target: true },
      { id: 'lever-2250', x: 2250, y: 320, on: false, lid: 2, puzzleId: 2 },
      { id: 'lever-2680', x: 2680, y: GY - 30, on: false, lid: 0, puzzleId: 5 }
    ],
    doors: [
      { id: 0, x: 4300, y: -500, w: 32, h: GY + 500, open: false },
      { id: 1, x: 1760, y: -500, w: 28, h: GY + 500, open: false },
      { id: 2, x: 2540, y: -500, w: 28, h: GY + 500, open: false }
    ],
    plates: [{ x: 1560, y: 380, w: 56, h: 10, pressed: false, lid: 1 }],
    enemies: [ mkE('snake', 1000, GY - 18, 960, 1200), mkE('snake', 1800, GY - 18, 1730, 2010), mkE('fox', 2680, GY - 32, 2560, 2950), mkE('boar', 3850, GY - 34, 3500, 4320) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 960, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2560, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3500, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 1420, y: 264, w: 56, h: 56, vx: 0, vy: 0 }, { x: 3204, y: 294, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [{ x: 4180, y: 120, w: 56, h: 56, hit: false }, { x: 2660, y: 100, w: 56, h: 56, hit: false }],
    // Continuous basins occupy the gaps between banks. Existing pillars remain stepping stones.
    // Every basin starts below the banks and has the same fixed bed at y = 690.
    hazards: [
      { x: 380, y: GY + 30, w: 570, h: 190, type: 'water' },
      { x: 1210, y: GY + 30, w: 510, h: 190, type: 'water' },
      { x: 2046, y: GY + 30, w: 494, h: 190, type: 'water' },
      { x: 2960, y: GY + 30, w: 520, h: 190, type: 'water' }
    ],
    checkpoints: [{ x: 950, y: GY, on: false }, { x: 2540, y: GY, on: false }],
    coins: [[180, 420], [680, 330], [1420, 280], [1770, 420], [2270, 280], [2560, 420], [4140, 420]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ id: 'sheep-1000', x: 1000, y: 410, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2440', x: 2440, y: 350, vx: 0, vy: 0, rescued: false, bob: 1 }],
    portal: { x: 4340, y: GY - 150, w: 64, h: 150 }, goalE: 4, goalS: 2, goalP: 4,
  };
}
function wSnow(): WD {
  const P: Plat[] = [
    { x: 0, y: GY, w: 400, h: 900, type: 'ice' },
    { x: 520, y: 430, w: 70, h: 900, type: 'ice' }, { x: 680, y: 360, w: 70, h: 900, type: 'ice' }, { x: 840, y: 290, w: 70, h: 900, type: 'ice' }, { x: 1000, y: 360, w: 70, h: 900, type: 'ice' },
    { x: 1160, y: GY, w: 280, h: 900, type: 'ice' },
    { x: 1520, y: 400, w: 64, h: 900, type: 'ice' }, { x: 1660, y: 320, w: 64, h: 900, type: 'ice' }, { x: 1800, y: 400, w: 64, h: 900, type: 'ice' },
    { x: 1940, y: GY, w: 260, h: 900, type: 'ice' },
    { x: 2280, y: 380, w: 64, h: 900, type: 'ice' }, { x: 2430, y: 290, w: 64, h: 900, type: 'ice' }, { x: 2580, y: 380, w: 70, h: 900, type: 'ice' },
    { x: 2740, y: GY, w: 440, h: 900, type: 'ice' },
    { x: 3210, y: 440, w: 56, h: 900, type: 'ice' }, { x: 3300, y: 420, w: 64, h: 900, type: 'ice' }, { x: 3440, y: 350, w: 64, h: 900, type: 'ice' }, { x: 3580, y: 420, w: 64, h: 900, type: 'ice' },
    { x: 3720, y: GY, w: 320, h: 900, type: 'ice' },
    { x: 2820, y: 350, w: 220, h: 24, type: 'plateau' },
    { x: 3770, y: 350, w: 220, h: 24, type: 'plateau' },
    { x: 3900, y: 440, w: 56, h: 900, type: 'ice' }, { x: 4100, y: 430, w: 64, h: 900, type: 'ice' }, { x: 4250, y: 350, w: 64, h: 900, type: 'ice' }, { x: 4400, y: 270, w: 64, h: 900, type: 'ice' },
    { x: 4560, y: GY - 70, w: 360, h: 900, type: 'goal' },
  ];
  P.push({ x: 2030, y: -450, w: 380, h: 540, type: 'wall' });
  return { id: 'snow', tif: '', name: 'القمم الثلجية', sub: 'العالم الأخير', width: 4940, mood: 'snow',
    pal: { skyTop: '#0a2438', skyBot: '#4a7898', far: '#143a56', mid: '#2a5e7a', near: '#4a82a0', ground: '#143248', groundTop: '#dceaf2', accent: '#8ac0e0', fog: '#c0d8e8', particle: '#ffffff' },
    pType: 'snow', spawnX: 70, spawnY: GY - 48, threat: 'avalanche',
    platforms: P, mplatforms: [{ x: 2180, y: 340, w: 100, h: 16, sx: 2180, ex: 2280, vx: 100, axis: 'y', sy: 290, ey: 410 }, { x: 3220, y: 400, w: 100, h: 16, sx: 3220, ex: 3300, vx: 110, axis: 'x' }],
    bridges: [{ id: 0, x: 2070, y: 410, w: 300, h: 14, down: false, progress: 0 }], elevators: [],
    levers: [
      { id: 'lever-1660', x: 1660, y: 320, on: false, lid: -1, bridgeId: 0, target: true },
      { id: 'lever-2430', x: 2430, y: 290, on: false, lid: 2, timed: 8, puzzleId: 4 }
    ],
    doors: [
      { id: 1, x: 2100, y: -500, w: 28, h: GY + 500, open: false },
      { id: 2, x: 2740, y: -500, w: 28, h: GY + 500, open: false }
    ],
    plates: [{ x: 1800, y: 400, w: 56, h: 10, pressed: false, lid: 1 }],
    enemies: [ mkE('fox', 1200, GY - 32, 1170, 1430), mkE('fox', 2000, GY - 32, 1960, 2150), mkE('eagle', 2840, 160, 2760, 3170), mkE('fox', 3800, GY - 32, 3740, 3840) ],
    rocks: [{ id: 1, x: 200, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 2, x: 1170, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 3, x: 2760, y: GY - 28, vx: 0, vy: 0, r: 8 }, { id: 4, x: 3740, y: GY - 28, vx: 0, vy: 0, r: 8 }],
    boxes: [{ x: 1680, y: 264, w: 56, h: 56, vx: 0, vy: 0 }, { x: 4104, y: 374, w: 56, h: 56, vx: 0, vy: 0 }], hanging: [],
    hazards: [{ x: 2070, y: GY, w: 150, h: 50, type: 'ice' }, { x: 3640, y: GY, w: 80, h: 50, type: 'spike' }],
    checkpoints: [{ x: 1160, y: GY, on: false }, { x: 2740, y: GY, on: false }, { x: 3720, y: GY, on: false }],
    coins: [[180, 420], [700, 320], [860, 250], [1680, 280], [2020, 420], [2450, 250], [2780, 420], [4380, 300], [4580, 360]].map(([x, y], i) => ({ x, y, got: false, bob: i * 0.6 })),
    sheep: [{ id: 'sheep-1000', x: 1000, y: 310, vx: 0, vy: 0, rescued: false, bob: 0 }, { id: 'sheep-2580', x: 2580, y: 330, vx: 0, vy: 0, rescued: false, bob: 1 }, { id: 'sheep-3580', x: 3580, y: 370, vx: 0, vy: 0, rescued: false, bob: 2 }],
    portal: { x: 0, y: 0, w: 0, h: 0 }, goalE: 4, goalS: 3, goalP: 3,
  };
}
export const WORLDS = [wCedar, wPasture, wGorge, wSnow];
export const MOODS: Mood[] = ['cedar', 'pasture', 'gorge', 'snow'];
