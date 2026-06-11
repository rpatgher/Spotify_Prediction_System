// ============================================================
// Integration tests — hash router + session guards (app.jsx)
// ============================================================
const { test, expect } = require('@playwright/test');

/** Seed `localStorage` with a session before any app script runs. */
async function withSession(page, session) {
  await page.addInitScript((s) => {
    window.localStorage.clear();
    window.localStorage.setItem('trackvision_session', JSON.stringify(s));
  }, session);
}

test.describe('Route guards', () => {
  test('without a session, any route redirects to /welcome', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/#/producer');
    await expect(page).toHaveURL(/#\/welcome$/);
  });

  test('without a session, /history redirects to /welcome', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/#/history');
    await expect(page).toHaveURL(/#\/welcome$/);
  });

  test('a "user" session cannot access /producer', async ({ page }) => {
    await withSession(page, { name: 'Ana', role: 'user' });
    await page.goto('/#/producer');
    await expect(page).toHaveURL(/#\/user$/);
  });

  test('a "producer" session cannot access /user', async ({ page }) => {
    await withSession(page, { name: 'Beto', role: 'producer' });
    await page.goto('/#/user');
    await expect(page).toHaveURL(/#\/producer$/);
  });

  test('an active session redirects /login and /welcome to its dashboard', async ({ page }) => {
    await withSession(page, { name: 'Ana', role: 'user' });

    await page.goto('/#/login');
    await expect(page).toHaveURL(/#\/user$/);

    await page.goto('/#/welcome');
    await expect(page).toHaveURL(/#\/user$/);
  });

  test('an unknown hash falls back to the role dashboard', async ({ page }) => {
    await withSession(page, { name: 'Ana', role: 'user' });
    await page.goto('/#/something-unknown');
    await expect(page).toHaveURL(/#\/user$/);
  });

  test('logout clears the session and returns to a public page', async ({ page }) => {
    await withSession(page, { name: 'Ana', role: 'user' });
    await page.goto('/#/user');

    await page.getByRole('button', { name: /Cerrar sesión/ }).click();
    // The session guard sends a logged-out user to /welcome.
    await expect(page).toHaveURL(/#\/welcome$/);

    const session = await page.evaluate(() => window.localStorage.getItem('trackvision_session'));
    expect(session).toBeNull();
    await expect(page.getByRole('heading', { name: /Bienvenido a/ })).toBeVisible();
  });
});

test.describe('Sidebar navigation', () => {
  test('user can navigate between dashboard and history via the sidebar', async ({ page }) => {
    await withSession(page, { name: 'Ana', role: 'user' });
    await page.goto('/#/user');

    await page.getByRole('button', { name: 'Historial' }).first().click();
    await expect(page).toHaveURL(/#\/history$/);

    await page.getByRole('button', { name: 'Analizar canción' }).click();
    await expect(page).toHaveURL(/#\/user$/);
  });

  test('producer sidebar shows the producer-specific label', async ({ page }) => {
    await withSession(page, { name: 'Beto', role: 'producer' });
    await page.goto('/#/producer');

    await expect(page.getByRole('button', { name: 'Analizar producción' })).toBeVisible();
  });
});
