import test from 'node:test';
import assert from 'node:assert/strict';
import { cairnsBalanced } from '../src/game/cairns';
import { PUZZLES } from '../src/game/content';
import { text, puzzleCopy } from '../src/game/i18n';

test('the cairn puzzle has one solution across every three-position selection', () => {
  const piles = PUZZLES[2].piles!, solutions: number[][] = [];
  for (let a = 0; a < piles.length; a++) for (let b = a + 1; b < piles.length; b++) for (let c = b + 1; c < piles.length; c++) {
    if (cairnsBalanced(piles, [a, b, c])) solutions.push([a, b, c]);
  }
  assert.deepEqual(solutions, [[0, 2, 4]]);
  assert.equal(cairnsBalanced(piles, [1, 2, 3]), false, 'sum alone is insufficient');
  assert.equal(cairnsBalanced(piles, [0, 1, 4]), false, 'left taller than right alone is insufficient');
});

test('physical positions determine the solution independently of click order', () => {
  const piles = PUZZLES[2].piles!;
  for (const selection of [[0, 2, 4], [0, 4, 2], [2, 0, 4], [2, 4, 0], [4, 0, 2], [4, 2, 0]]) {
    const original = [...selection];
    assert.equal(cairnsBalanced(piles, selection), true);
    assert.deepEqual(selection, original, 'validation must not reorder UI state');
  }
});

test('invalid sizes, repeated positions and invalid indices cannot solve the panel', () => {
  for (const selection of [[], [0], [0, 2], [0, 1, 2, 4], [0, 0, 2], [-1, 2, 4], [0, 2, 5], [0.5, 2, 4], [NaN, 2, 4], [Infinity, 2, 4]]) {
    assert.equal(cairnsBalanced(PUZZLES[2].piles!, selection), false);
  }
});

test('cairn rules, controls, retry and gradual hints exist in all interface languages', () => {
  for (const lang of ['ar', 'en', 'fr'] as const) {
    const copy = puzzleCopy(2, lang, PUZZLES[2]);
    assert.ok(copy.prompt.length > 20); assert.ok(copy.clue!.length > 40);
    for (const key of ['cairn', 'cairnStones', 'cairnMiddle', 'cairnRow', 'cairnHelp', 'cairnSelected', 'cairnWrong', 'cairnH1', 'cairnH2', 'cairnH3']) {
      assert.notEqual(text(lang, key), key);
    }
  }
});
