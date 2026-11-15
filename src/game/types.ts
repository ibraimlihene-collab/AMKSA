export type Mood = 'menu' | 'cedar' | 'pasture' | 'gorge' | 'snow';
export interface Player { x: number; y: number; vx: number; vy: number; w: number; h: number; grounded: boolean; faceR: boolean; anim: number; stepT: number; prevX?: number; prevY?: number; attackHits?: string[]; state: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'dash' | 'punch'; jumpBuf: number; coyote: number; jumps: number; squash: number; stretch: number; rockN: number; charging: boolean; power: number; aim: number; hp: number; invinc: number; hitFlash: number; dashT: number; dashCD: number; dashDir: number; punchT: number; punchCD: number; }
export interface Rock { id: number; x: number; y: number; vx: number; vy: number; r: number; }
export interface Box { id?: string; prevY?: number; x: number; y: number; w: number; h: number; vx: number; vy: number; impactVy?: number; }
export interface Hanging { x: number; y: number; w: number; h: number; hit: boolean; }
export type PType = 'ground' | 'pillar' | 'wall' | 'ice' | 'goal' | 'break' | 'plateau';
export interface Plat { x: number; y: number; w: number; h: number; type: PType; label?: string; broken?: boolean; breakT?: number; grad?: CanvasGradient; }
export interface MP { dx?: number; dy?: number; x: number; y: number; w: number; h: number; sx: number; ex: number; vx: number; axis: 'x' | 'y'; sy?: number; ey?: number; }
export interface Lever { id: string; x: number; y: number; on: boolean; lid: number; seq?: number; seqMax?: number; bridgeId?: number; target?: boolean; timed?: number; solved?: boolean; puzzleId?: number; } // may require solving a logic puzzle instead of just pressing
export interface Door { id: number; x: number; y: number; w: number; h: number; open: boolean; timer?: number; }
export interface Plate { id?: number; x: number; y: number; w: number; h: number; pressed: boolean; lid: number; solved?: boolean; elevatorId?: number; } // pressure plate; may control an elevator or a door
export interface Bridge { id: number; x: number; y: number; w: number; h: number; down: boolean; progress: number; }
export interface Elevator { id: number; x: number; y: number; w: number; h: number; baseY: number; topY: number; speed: number; plateId: number; } // rises while its linked plate is weighed down
export interface Coin { x: number; y: number; got: boolean; bob: number; }
export interface Check { x: number; y: number; on: boolean; }
export interface Portal { x: number; y: number; w: number; h: number; }
export interface Sheep { id: string; x: number; y: number; vx: number; vy: number; rescued: boolean; bob: number; }
export type EType = 'macaque' | 'boar' | 'wolf' | 'fox' | 'eagle' | 'snake' | 'lynx';
export interface Enemy { id: string; homeY?: number; type: EType; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; maxHp: number; state: 'idle' | 'walk' | 'attack' | 'dead'; faceR: boolean; sx: number; ex: number; dmgT: number; atkT: number; onGround: boolean; anim: number; deadT: number; shootT: number; kbX: number; }
export interface Proj { x: number; y: number; vx: number; vy: number; r: number; life: number; }
export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'snow' | 'leaf' | 'mist' | 'spark' | 'firefly'; }
export interface Haz { x: number; y: number; w: number; h: number; type: 'water' | 'spike' | 'ice'; baseY?: number; bottom?: number; }
export interface Threat { kind: 'wolfpack' | 'eagle' | 'flood' | 'avalanche'; timer: number; level: number; phase: 'calm' | 'warning' | 'active'; frontX: number; }
export interface Pal { skyTop: string; skyBot: string; far: string; mid: string; near: string; ground: string; groundTop: string; accent: string; fog: string; particle: string; }
export interface WD { id: string; tif: string; name: string; sub: string; width: number; mood: Mood; pal: Pal; pType: Part['kind']; spawnX: number; spawnY: number; threat: Threat['kind']; platforms: Plat[]; mplatforms: MP[]; bridges: Bridge[]; elevators: Elevator[]; levers: Lever[]; doors: Door[]; plates: Plate[]; enemies: Enemy[]; rocks: Rock[]; boxes: Box[]; hanging: Hanging[]; hazards: Haz[]; checkpoints: Check[]; coins: Coin[]; sheep: Sheep[]; portal: Portal; goalE: number; goalS: number; goalP: number; }
