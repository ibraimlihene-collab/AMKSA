export type Mood = 'menu' | 'cedar' | 'pasture' | 'gorge' | 'snow';
export interface Player { x: number; y: number; vx: number; vy: number; w: number; h: number; grounded: boolean; faceR: boolean; anim: number; stepT: number; prevX?: number; prevY?: number; attackHits?: string[]; state: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'dash' | 'punch' | 'calm' | 'push'; jumpBuf: number; coyote: number; jumps: number; squash: number; stretch: number; rockN: number; charging: boolean; power: number; aim: number; hp: number; invinc: number; hitFlash: number; dashT: number; dashCD: number; dashDir: number; punchT: number; punchCD: number; }
export interface Rock { id: number; x: number; y: number; vx: number; vy: number; r: number; landed?: boolean; }
export interface Box { id?: string; prevY?: number; x: number; y: number; w: number; h: number; vx: number; vy: number; impactVy?: number; }
export interface Hanging { x: number; y: number; w: number; h: number; hit: boolean; }
/** `crack` breaks shortly after a landing and regrows. `ledge` and `wall` are thin rock forms. */
export type PType = 'ground' | 'pillar' | 'wall' | 'ice' | 'goal' | 'break' | 'plateau' | 'crack' | 'ledge' | 'curb';
export interface Plat { x: number; y: number; w: number; h: number; type: PType; label?: string; broken?: boolean; breakT?: number; regrowT?: number; grad?: CanvasGradient; }
export interface MP { dx?: number; dy?: number; x: number; y: number; w: number; h: number; sx: number; ex: number; vx: number; axis: 'x' | 'y'; sy?: number; ey?: number; }
/** `bell` levers are struck by hand and sound one pitch (0 low, 1 mid, 2 high). */
export interface Lever { id: string; x: number; y: number; on: boolean; lid: number; seq?: number; seqMax?: number; bridgeId?: number; target?: boolean; timed?: number; solved?: boolean; puzzleId?: number; bell?: 0 | 1 | 2; face?: boolean; optional?: boolean; }
export interface Door { id: number; x: number; y: number; w: number; h: number; open: boolean; timer?: number; kind?: 'log' | 'ice' | 'gate'; }
/** `need` turns a plate into a stone scale: rocks weigh 1, boxes weigh 2 and the shepherd weighs nothing. */
export interface Plate { id?: number; key?: string; x: number; y: number; w: number; h: number; pressed: boolean; lid: number; solved?: boolean; elevatorId?: number; need?: number; weight?: number; }
/** `hinge: 'right'` lowers the deck to the left of the hinge. */
export interface Bridge { id: number; x: number; y: number; w: number; h: number; down: boolean; progress: number; hinge?: 'left' | 'right'; }
export interface Elevator { id: number; x: number; y: number; w: number; h: number; baseY: number; topY: number; speed: number; plateId: number; dx?: number; dy?: number; vx?: number; }
export interface Coin { x: number; y: number; got: boolean; bob: number; }
export interface Check { x: number; y: number; on: boolean; }
export interface Portal { x: number; y: number; w: number; h: number; }
export type SheepState = 'idle' | 'alert' | 'fear' | 'calming' | 'rescued' | 'gone';
export interface Sheep { id: string; x: number; y: number; vx: number; vy: number; rescued: boolean; bob: number; state?: SheepState; calm?: number; minX?: number; maxX?: number; homeX?: number; fade?: number; faceR?: boolean; bleatT?: number; }
export type EType = 'macaque' | 'boar' | 'wolf' | 'fox' | 'eagle' | 'snake' | 'lynx';
export type AnimalState = 'idle' | 'walk' | 'notice' | 'warn' | 'chase' | 'attack' | 'recover' | 'retreat' | 'flee' | 'distract' | 'dead';
export interface Enemy { id: string; homeY?: number; type: EType; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; maxHp: number; state: AnimalState; faceR: boolean; sx: number; ex: number; dmgT: number; atkT: number; onGround: boolean; anim: number; deadT: number; shootT: number; kbX: number; stateT?: number; focusX?: number; diveX?: number; diveY?: number; homeX?: number; struck?: boolean; }
export interface Proj { x: number; y: number; vx: number; vy: number; r: number; life: number; }
export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'snow' | 'leaf' | 'mist' | 'spark' | 'firefly' | 'dust' | 'splash' | 'chunk'; }
/** Water hazards may carry an id and two levels; the rendered surface is always the damage rectangle. */
export interface Haz { x: number; y: number; w: number; h: number; type: 'water' | 'spike' | 'ice'; baseY?: number; bottom?: number; id?: string; lowY?: number; highY?: number; targetY?: number; }
/** A sluice sends the source water into basin `a` or basin `b`. The other basin drains. */
export interface Sluice { id: string; x: number; y: number; toB: boolean; a: string; b: string; award?: string; }
/** A log rides the surface of its basin. It is a solid platform. */
export interface Floater { id: string; x: number; y: number; w: number; h: number; basin: string; dx?: number; dy?: number; vx?: number; }
export interface Shelter { x: number; y: number; w: number; h: number; }
/** Entering the rectangle grants a main or optional award. */
export interface Trigger { key: string; x: number; y: number; w: number; h: number; }
export type DecorKind = 'tracks' | 'scale' | 'tablet' | 'marks' | 'wool' | 'shelterSign' | 'cairn' | 'grass' | 'crackDemo' | 'fold';
export interface Decor { kind: DecorKind; x: number; y: number; dir?: number; n?: number; data?: number[]; }
/** A room owns one objective and three optional hint tiers. `done` lists award or sheep IDs. */
export interface Room { id: string; x0: number; x1: number; goal: string; done: string[]; hints: [string, string, string]; }
export interface FloodCfg { x: number; w: number; bottom: number; startY: number; endY: number; triggerX: number; warn: number; rise: number; }
export interface AvalancheCfg { triggerX: number; startX: number; warn: number; speed: number; }
export interface Threat { kind: 'wolfpack' | 'eagle' | 'flood' | 'avalanche'; timer: number; level: number; phase: 'calm' | 'warning' | 'active' | 'cleared'; frontX: number; }
export interface Pal { skyTop: string; skyBot: string; far: string; mid: string; near: string; ground: string; groundTop: string; accent: string; fog: string; particle: string; }
export interface WD {
  id: string; tif: string; name: string; sub: string; width: number; mood: Mood; pal: Pal; pType: Part['kind']; spawnX: number; spawnY: number; threat: Threat['kind'];
  platforms: Plat[]; mplatforms: MP[]; bridges: Bridge[]; elevators: Elevator[]; levers: Lever[]; doors: Door[]; plates: Plate[]; enemies: Enemy[]; rocks: Rock[]; boxes: Box[]; hanging: Hanging[]; hazards: Haz[]; checkpoints: Check[]; coins: Coin[]; sheep: Sheep[]; portal: Portal;
  sluices: Sluice[]; floaters: Floater[]; shelters: Shelter[]; triggers: Trigger[]; decor: Decor[]; rooms: Room[]; flood?: FloodCfg; avalanche?: AvalancheCfg;
  /** Award IDs that count as the world's main puzzles. */
  main: string[]; goalE: number; goalS: number; goalP: number; endX?: number;
}
