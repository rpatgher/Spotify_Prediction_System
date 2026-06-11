// ============================================================
// Integration tests — analysis flows for both roles
// (UserDashboardPage / ProducerDashboardPage -> ResultsPage)
// ============================================================
const { test, expect } = require('@playwright/test');

async function loginAs(page, role) {
  await page.addInitScript((r) => {
    window.localStorage.clear();
    window.localStorage.setItem('trackvision_session', JSON.stringify({ name: 'Tester', role: r }));
  }, role);
}

test.describe('User dashboard — analyze from YouTube', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/#/user');
  });

  test('shows an error for a non-YouTube link', async ({ page }) => {
    await page.getByPlaceholder('Pega aquí tu link de YouTube…').fill('https://example.com/not-youtube');
    await page.getByRole('main').getByRole('button', { name: 'Analizar canción' }).click();

    await expect(page.getByText('Ingresa un link válido de YouTube.')).toBeVisible();
    await expect(page).toHaveURL(/#\/user$/);
  });

  test('clears the error once the user edits the input', async ({ page }) => {
    await page.getByRole('main').getByRole('button', { name: 'Analizar canción' }).click();
    await expect(page.getByText('Ingresa un link válido de YouTube.')).toBeVisible();

    await page.getByPlaceholder('Pega aquí tu link de YouTube…').fill('h');
    await expect(page.getByText('Ingresa un link válido de YouTube.')).toBeHidden();
  });

  test('a valid link runs the analysis and lands on /results', async ({ page }) => {
    await page.getByPlaceholder('Pega aquí tu link de YouTube…').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('main').getByRole('button', { name: 'Analizar canción' }).click();

    // Loading overlay shown while the (simulated) request is in flight.
    await expect(page.getByText('Analizando canción…')).toBeVisible();

    await expect(page).toHaveURL(/#\/results$/, { timeout: 5000 });
    await expect(page.getByText('Analizando canción…')).toBeHidden();

    await expect(page.getByText('Rating ML')).toBeVisible();
    await expect(page.getByText('Score predictivo')).toBeVisible();
    await expect(page.getByText('Mejor fecha sugerida para lanzar la canción')).toBeVisible();
    await expect(page.getByText('Recomendaciones principales')).toBeVisible();
  });
});

test.describe('Producer dashboard — MP3 upload', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'producer');
    await page.goto('/#/producer');
  });

  test('requires a file before analyzing', async ({ page }) => {
    await page.getByRole('button', { name: 'Analizar MP3' }).click();
    await expect(page.getByText('Selecciona un archivo .mp3 para analizar.')).toBeVisible();
  });

  test('rejects non-mp3 files', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cancion.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('fake-audio'),
    });

    await expect(page.getByText('Solo se permiten archivos .mp3')).toBeVisible();
  });

  test('accepts an mp3 file and runs the analysis', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'mi-cancion.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('fake-audio'),
    });
    await expect(page.getByText('mi-cancion.mp3')).toBeVisible();

    await page.getByRole('button', { name: 'Analizar MP3' }).click();

    await expect(page).toHaveURL(/#\/results$/, { timeout: 5000 });
    await expect(page.getByText('mi-cancion.mp3')).toBeVisible();
    await expect(page.getByText('Rating ML')).toBeVisible();
  });
});

test.describe('Producer dashboard — analyze from YouTube', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'producer');
    await page.goto('/#/producer');
  });

  test('shows an error for a non-YouTube link', async ({ page }) => {
    await page.getByPlaceholder('Pega aquí el link de YouTube de tu canción…').fill('not-a-link');
    await page.getByRole('button', { name: 'Analizar link' }).click();

    await expect(page.getByText('Ingresa un link válido de YouTube.')).toBeVisible();
  });

  test('a valid link runs the analysis and lands on /results', async ({ page }) => {
    await page.getByPlaceholder('Pega aquí el link de YouTube de tu canción…').fill('https://youtu.be/dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'Analizar link' }).click();

    await expect(page).toHaveURL(/#\/results$/, { timeout: 5000 });
    await expect(page.getByText('Rating ML')).toBeVisible();
  });
});

test.describe('Results page without an active analysis', () => {
  test('shows the empty state and can navigate back to analyze', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/#/results');

    await expect(page.getByText('No hay ningún análisis todavía')).toBeVisible();
    await page.getByRole('button', { name: 'Volver a analizar' }).click();
    await expect(page).toHaveURL(/#\/user$/);
  });
});
