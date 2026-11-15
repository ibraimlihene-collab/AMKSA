import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySave, eraseSave, loadSave, parseSave, SAVE_KEY, writeSave } from '../src/game/save';
import { createWorld, snapshot } from '../src/game/world';
const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
test('round trip retains versioned room records', () => {
  const st = storage(), s = { ...emptySave(), rooms: { cedar: snapshot(createWorld(0)) } };
  assert.equal(writeSave(st, s), true); assert.deepEqual(loadSave(st).data, s);
});
test('corruption falls back to the previous valid snapshot', () => {
  const st = storage(), s = emptySave(); writeSave(st, s); writeSave(st, { ...s, coins: 4 }); st.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(st), { data: s, recovered: true });
});
test('invalid imports reject nonfinite fields, duplicate IDs, unknown rooms and oversized files', () => {
  assert.equal(parseSave(JSON.stringify({ ...emptySave(), world: 99 })), null);
  assert.equal(parseSave(JSON.stringify({ ...emptySave(), coins: null })), null);
  assert.equal(parseSave(JSON.stringify({ ...emptySave(), rooms: { unknown: snapshot(createWorld(0)) } })), null);
  const room = snapshot(createWorld(0)); room.sheep = ['same', 'same'];
  assert.equal(parseSave(JSON.stringify({ ...emptySave(), rooms: { cedar: room } })), null);
  assert.equal(parseSave(' '.repeat(100001)), null);
});
test('legacy migration never claims sheep were rescued', () => {
  const st = storage(); st.setItem('amksa_v3', JSON.stringify({ world: 2, coins: 12, deaths: 4 }));
  const { data } = loadSave(st); assert.equal(data.world, 2); assert.equal(data.coins, 12); assert.deepEqual(data.rooms, {});
  eraseSave(st); assert.deepEqual(loadSave(st).data, emptySave());
});
test('storage failures return a recoverable error', () => {
  const st = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(writeSave(st, emptySave()), false); assert.equal(loadSave(st).recovered, true); assert.equal(eraseSave(st), false);
});
