/** Positions refer to the physical row, from left to right, regardless of interface language. */
export function cairnsBalanced(piles: readonly number[], selected: readonly number[]) {
  if (selected.length !== 3 || new Set(selected).size !== 3) return false;
  if (selected.some(i => !Number.isInteger(i) || i < 0 || i >= piles.length)) return false;
  const [left, middle, right] = [...selected].sort((a, b) => a - b).map(i => piles[i]);
  return middle === left + right && left > right;
}
