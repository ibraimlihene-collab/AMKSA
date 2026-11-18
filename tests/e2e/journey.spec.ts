import { test, expect } from '@playwright/test';

test('new journey, pause, reload and continue preserve the same chapter', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByTestId('new-game').click(); await page.getByTestId('skip-intro').click();
  await expect(page.getByTestId('playing-screen')).toBeVisible();
  await page.getByTestId('pause-game').click(); await expect(page.getByTestId('paused-screen')).toBeVisible();
  await page.reload(); await page.getByTestId('continue').click();
  await expect(page.getByTestId('playing-screen')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toBeVisible(); expect(errors).toEqual([]);
});
test('losing focus clears held movement and opens a pause', async ({ page }) => {
  await page.goto('/'); await page.getByTestId('new-game').click(); await page.getByTestId('skip-intro').click();
  await expect(page.getByTestId('playing-screen')).toBeVisible();
  await page.keyboard.down('ArrowRight'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('paused-screen')).toBeVisible(); await page.keyboard.up('ArrowRight');
});
test('mobile menus fit and new game requires explicit confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 }); await page.goto('/');
  await page.getByTestId('new-game').click(); await page.getByTestId('skip-intro').click(); await expect(page.getByTestId('touch-controls')).toBeVisible();
  await page.getByTestId('pause-game').click(); await page.getByRole('button', { name: 'حفظ والعودة للقائمة', exact: true }).click();
  await page.getByTestId('new-game').click(); await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

// Valid Save v4 fixtures place the shepherd at a real checkpoint. They exercise mechanisms, not a full journey.
const room = (checkpoint: number, awards: string[] = [], sheep: string[] = []) => ({ checkpoint, coins: [], completionAwarded: false, awards, sheep, killed: [], levers: [], doors: [], bridges: [], seqProgress: 0, seqSolved: false });
const fixture = (world: number, id: string, r: ReturnType<typeof room>) => JSON.stringify({ version: 4, world, coins: 0, deaths: 0, rooms: { [id]: r }, complete: false, unlocked: world });
async function continueFrom(page: import('@playwright/test').Page, save: string) {
  await page.goto('/'); await page.evaluate(s => { localStorage.setItem('amksa_v4', s); }, save); await page.reload();
  await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByTestId('continue').click();
  await expect(page.getByTestId('playing-screen')).toBeVisible(); await page.waitForTimeout(600);
}
async function walk(page: import('@playwright/test').Page, key: string, ms: number) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(150); }
const puzzles = (page: import('@playwright/test').Page) => page.locator('.hud span', { hasText: 'Puzzles' }).locator('b');
const sheepCount = (page: import('@playwright/test').Page) => page.locator('.hud span', { hasText: 'Sheep rescued' }).locator('b');

test('the illustrated prologue has four beats in the selected language only', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Français', exact: true }).click(); await page.getByTestId('new-game').click();
  await expect(page.getByTestId('intro-screen')).toContainText('Avant la tempête');
  for (let i = 0; i < 3; i++) await page.getByTestId('next-intro').click();
  await expect(page.getByTestId('intro-screen')).toContainText('huit moutons'); await expect(page.getByTestId('intro-screen')).not.toContainText('storm');
  await page.getByTestId('next-intro').click(); await expect(page.getByTestId('playing-screen')).toBeVisible();
  await expect(page.getByTestId('objective')).toContainText('Franchissez le ravin');
});
test('Arabic uses right-to-left menus and the language setting survives a reload', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.reload(); await expect(page.getByTestId('new-game')).toContainText('Start journey');
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl'); await expect(page.getByTestId('new-game')).toContainText('ابدأ الرحلة');
});
test('a quick throw spends a stone and the HUD reports it', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByTestId('new-game').click(); await page.getByTestId('skip-intro').click();
  await expect(page.getByTestId('stones')).toContainText('4'); await page.waitForTimeout(400);
  await page.keyboard.press('KeyF'); await expect(page.getByTestId('stones')).toContainText('3');
});
test('two stones on the pasture scale open the gate and count one puzzle', async ({ page }) => {
  await continueFrom(page, fixture(1, 'pasture', room(1)));
  await expect(puzzles(page)).toContainText('0'); await walk(page, 'ArrowRight', 260);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(120); await page.keyboard.press('KeyE');
  await expect(puzzles(page)).toContainText('1', { timeout: 3000 });
});
test('the gorge sluice routes the water and counts one puzzle', async ({ page }) => {
  await continueFrom(page, fixture(2, 'gorge', room(1)));
  await walk(page, 'ArrowRight', 330); await page.keyboard.press('KeyE');
  await expect(puzzles(page)).toContainText('1', { timeout: 3000 });
});
test('standing calmly beside a sheep rescues it, and the rescue survives a reload', async ({ page }) => {
  await continueFrom(page, fixture(2, 'gorge', room(2, ['sluice'])));
  await expect(sheepCount(page)).toContainText('1', { timeout: 6000 });
  await page.reload(); await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByTestId('continue').click();
  await expect(sheepCount(page)).toContainText('1', { timeout: 4000 });
});
test('hints are optional, tiered, and free', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByTestId('new-game').click(); await page.getByTestId('skip-intro').click();
  await page.getByTestId('pause-game').click(); await expect(page.getByText('Hints are optional and free.')).toBeVisible();
  await page.getByTestId('reveal-hint').click(); await expect(page.getByText('Look at the rope from the raised bridge')).toBeVisible();
  await page.getByTestId('reveal-hint').click(); await page.getByTestId('reveal-hint').click();
  await expect(page.getByText('quick throw at the peg')).toBeVisible(); await expect(page.getByTestId('reveal-hint')).toHaveCount(0);
});

const allRooms = (snowSheep: string[], others: boolean) => JSON.stringify({ version: 4, world: 3, coins: 20, deaths: 2, complete: false, unlocked: 3, rooms: {
  ...(others ? { cedar: room(3, ['target-bridge', 'target-gate'], ['sheep-960', 'sheep-2490']), pasture: room(3, ['scale', 'ledge'], ['sheep-920', 'sheep-2540']), gorge: room(3, ['sluice', 'target-gorge'], ['sheep-1000', 'sheep-2440']) } : {}),
  snow: room(4, ['ice-path', 'tracks', 'sequence'], snowSheep) } });
async function reachSummit(page: import('@playwright/test').Page) {
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2600); await page.keyboard.down('Space'); await page.waitForTimeout(300); await page.keyboard.up('Space'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
  await expect(page.getByTestId('journey-result')).toBeVisible({ timeout: 8000 });
}
test('the full ending shows all eight sheep home', async ({ page }) => {
  await continueFrom(page, allRooms(['sheep-1000', 'sheep-2580'], true)); await reachSummit(page);
  await expect(page.getByTestId('ending-message')).toContainText('whole flock is in the fold'); await expect(page.getByTestId('journey-result')).toContainText('8 / 8');
  await page.waitForTimeout(8500); await page.screenshot({ path: 'test-results/ending-all.png' });
});
test('a partial ending is honest about missing sheep', async ({ page }) => {
  await continueFrom(page, allRooms(['sheep-1000'], false)); await reachSummit(page);
  await expect(page.getByTestId('ending-message')).toContainText('Part of the flock'); await expect(page.getByTestId('journey-result')).toContainText('1 / 8');
  await page.waitForTimeout(8500); await page.screenshot({ path: 'test-results/ending-some.png' });
});
test('the pause menu shows one bell per sheep', async ({ page }) => {
  await continueFrom(page, allRooms(['sheep-1000'], true)); await page.getByTestId('pause-game').click();
  await expect(page.locator('.flock-bells i.home')).toHaveCount(7); await expect(page.locator('.flock-bells i')).toHaveCount(8);
});
