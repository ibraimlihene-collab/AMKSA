export const SAVE_KEY = 'amksa_v4';
const LEGACY_KEY = 'amksa_v3';
export type RoomSave = {
  checkpoint: number; coins: number[]; completionAwarded: boolean; awards: string[]; sheep: string[]; killed: string[];
  levers: { id: string; on: boolean; solved: boolean }[];
  doors: { id: number; open: boolean }[];
  bridges: { id: number; down: boolean }[];
  seqProgress: number; seqSolved: boolean;
};
export type Save = { version: 4; world: number; coins: number; deaths: number; rooms: Record<string, RoomSave>; complete: boolean; unlocked: number };
export const emptySave = (): Save => ({ version: 4, world: 0, coins: 0, deaths: 0, rooms: {}, complete: false, unlocked: 0 });
const integer = (v: unknown, max: number): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= max;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100 && v.every(s => typeof s === 'string' && s.length < 100) && new Set(v).size === v.length;
const arrayOf = (v: unknown, test: (row: any) => boolean) => Array.isArray(v) && v.length <= 100 && v.every(row => row && typeof row === 'object' && test(row));
const validRoom = (r: any): r is RoomSave => r && integer(r.checkpoint, 10) && Array.isArray(r.coins) && r.coins.length <= 100 && r.coins.every((c: unknown) => integer(c, 100)) && new Set(r.coins).size === r.coins.length && typeof r.completionAwarded === 'boolean' && strings(r.awards) && strings(r.sheep) && strings(r.killed)
  && integer(r.seqProgress, 3) && typeof r.seqSolved === 'boolean'
  && arrayOf(r.levers, l => typeof l.id === 'string' && l.id.length < 100 && typeof l.on === 'boolean' && typeof l.solved === 'boolean')
  && arrayOf(r.doors, d => integer(d.id, 100) && typeof d.open === 'boolean')
  && arrayOf(r.bridges, b => integer(b.id, 100) && typeof b.down === 'boolean');
export function parseSave(raw: string | null): Save | null {
  if (!raw || raw.length > 100000) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.version !== 4 || !integer(s.world, 3) || !integer(s.coins, 1000000) || !integer(s.deaths, 1000000) || typeof s.complete !== 'boolean' || !integer(s.unlocked, 3)) return null;
    if (!s.rooms || typeof s.rooms !== 'object' || Array.isArray(s.rooms)) return null;
    if (Object.keys(s.rooms).some(k => !['cedar', 'pasture', 'gorge', 'snow'].includes(k)) || !Object.values(s.rooms).every(validRoom)) return null;
    return s;
  } catch { return null; }
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function loadSave(storage: Storage): { data: Save; recovered: boolean } {
  try {
    const raw = storage.getItem(SAVE_KEY), backup = storage.getItem(`${SAVE_KEY}_backup`);
    const current = parseSave(raw);
    if (current) return { data: current, recovered: false };
    const previous = parseSave(backup);
    if (previous) return { data: previous, recovered: true };
    const old = JSON.parse(storage.getItem(LEGACY_KEY) || 'null');
    if (old && integer(old.world, 4) && integer(old.coins, 1000000) && integer(old.deaths, 1000000)) {
      // The old format has no rescue records. Never invent rescued sheep during migration.
      return { data: { ...emptySave(), world: Math.min(old.world, 3), unlocked: Math.min(old.world, 3), coins: old.coins, deaths: old.deaths }, recovered: true };
    }
    return { data: emptySave(), recovered: raw !== null };
  } catch { return { data: emptySave(), recovered: true }; }
}
export function writeSave(storage: Storage, data: Save) {
  try {
    const encoded = JSON.stringify(data);
    if (!parseSave(encoded)) return false;
    const old = storage.getItem(SAVE_KEY);
    if (parseSave(old)) storage.setItem(`${SAVE_KEY}_backup`, old!);
    storage.setItem(SAVE_KEY, encoded); return true;
  } catch { return false; }
}
export function eraseSave(storage: Storage) {
  try { [SAVE_KEY, `${SAVE_KEY}_backup`, LEGACY_KEY].forEach(k => storage.removeItem(k)); return true; } catch { return false; }
}

// Access remains inside each operation, so denied browser storage becomes a handled save failure.
export const browserStorage: Storage = {
  getItem: key => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: key => globalThis.localStorage.removeItem(key),
};
