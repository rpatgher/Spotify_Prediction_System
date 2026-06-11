// ============================================================
// Integration tests — HistoryPage (list, filter, sort, delete)
// ============================================================
const { test, expect } = require('@playwright/test');

async function loginAsUser(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('trackvision_session', JSON.stringify({ name: 'Tester', role: 'user' }));
  });
}

/** Run `n` YouTube analyses back-to-back, returning to the dashboard between each. */
async function analyzeSeveral(page, n) {
  await page.goto('/#/user');
  for (let i = 0; i < n; i++) {
    await page.getByPlaceholder('Pega aquí tu link de YouTube…').fill(`https://www.youtube.com/watch?v=video${i}`);
    await page.getByRole('main').getByRole('button', { name: 'Analizar canción' }).click();
    await expect(page).toHaveURL(/#\/results$/, { timeout: 5000 });
    await page.goto('/#/user');
  }
}

test.describe('History — empty state', () => {
  test('shows empty state when no analyses were saved', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/#/history');

    await expect(page.getByText('Aún no tienes análisis guardados')).toBeVisible();

    await page.getByRole('button', { name: 'Crear primer análisis' }).click();
    await expect(page).toHaveURL(/#\/user$/);
  });
});

test.describe('History — with saved analyses', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('a completed analysis is saved and listed', async ({ page }) => {
    await analyzeSeveral(page, 1);
    await page.goto('/#/history');

    await expect(page.getByText('Análisis desde YouTube')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible();
  });

  test('deleting the only entry restores the empty state', async ({ page }) => {
    await analyzeSeveral(page, 1);
    await page.goto('/#/history');

    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Aún no tienes análisis guardados')).toBeVisible();
  });

  test('source filter (YouTube / MP3) narrows the list', async ({ page }) => {
    await analyzeSeveral(page, 2);
    await page.goto('/#/history');

    await expect(page.locator('.card').filter({ hasText: 'Análisis desde YouTube' })).toHaveCount(2);

    await page.getByRole('button', { name: 'MP3' }).click();
    await expect(page.getByText('No hay análisis de este tipo.')).toBeVisible();

    await page.getByRole('button', { name: 'YouTube' }).click();
    await expect(page.locator('.card').filter({ hasText: 'Análisis desde YouTube' })).toHaveCount(2);

    await page.getByRole('button', { name: 'Todos' }).click();
    await expect(page.locator('.card').filter({ hasText: 'Análisis desde YouTube' })).toHaveCount(2);
  });

  test('"Ver resultado" reopens the analysis on the results page', async ({ page }) => {
    await analyzeSeveral(page, 1);
    await page.goto('/#/history');

    await page.getByRole('button', { name: /Ver resultado/ }).first().click();
    await expect(page).toHaveURL(/#\/results$/);
    await expect(page.getByText('Rating ML')).toBeVisible();
  });

  test('sort order can be switched between recent and best rating', async ({ page }) => {
    await analyzeSeveral(page, 2);
    await page.goto('/#/history');

    const sortSelect = page.locator('select');
    await expect(sortSelect).toHaveValue('recent');

    await sortSelect.selectOption('rating');
    await expect(sortSelect).toHaveValue('rating');

    // List still shows both entries after re-sorting.
    await expect(page.locator('.card').filter({ hasText: 'Análisis desde YouTube' })).toHaveCount(2);
  });
});
