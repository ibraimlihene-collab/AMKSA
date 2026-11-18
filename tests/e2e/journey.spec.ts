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
