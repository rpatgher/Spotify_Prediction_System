// ============================================================
// Integration tests — Welcome / Login / Register flows
// ============================================================
const { test, expect } = require('@playwright/test');

test.describe('Welcome page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test('shows branding and navigates to login on "Empezar"', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Bienvenido a/ })).toBeVisible();

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test.describe('Login / Register form', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/#/login');
  });

  test('shows validation errors when submitting an empty login form', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar a la plataforma' }).click();
    await expect(page.getByText('Ingresa tu nombre o correo.')).toBeVisible();
    await expect(page.getByText('Ingresa tu contraseña.')).toBeVisible();
  });

  test('register requires selecting a user type', async ({ page }) => {
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await page.getByPlaceholder('usuario@trackwise.ai').fill('nuevo@trackwise.ai');
    await page.getByPlaceholder('••••••••').fill('secret123');
    await page.getByRole('button', { name: /Crear cuenta/ }).click();

    await expect(page.getByText('Selecciona un tipo de usuario.')).toBeVisible();
  });

  test('registering as a regular user lands on the user dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await page.getByPlaceholder('usuario@trackwise.ai').fill('usuario1');
    await page.getByPlaceholder('••••••••').fill('secret123');
    await page.getByText('Usuario normal', { exact: true }).click();
    await page.getByRole('button', { name: /Crear cuenta/ }).click();

    await expect(page).toHaveURL(/#\/user$/);
    await expect(page.getByRole('heading', { name: /Analiza una canción desde YouTube/ })).toBeVisible();
  });

  test('registering as a producer lands on the producer dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await page.getByPlaceholder('usuario@trackwise.ai').fill('productor1');
    await page.getByPlaceholder('••••••••').fill('secret123');
    await page.getByText('Productor', { exact: true }).click();
    await page.getByRole('button', { name: /Crear cuenta/ }).click();

    await expect(page).toHaveURL(/#\/producer$/);
    await expect(page.getByRole('heading', { name: /Panel para productores/ })).toBeVisible();
  });

  test('login with an unknown user defaults to the "user" role', async ({ page }) => {
    await page.getByPlaceholder('usuario@trackwise.ai').fill('desconocido');
    await page.getByPlaceholder('••••••••').fill('whatever');
    await page.getByRole('button', { name: 'Entrar a la plataforma' }).click();

    await expect(page).toHaveURL(/#\/user$/);
  });

  test('logging in again recalls the role chosen at registration', async ({ page }) => {
    // Register as producer.
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await page.getByPlaceholder('usuario@trackwise.ai').fill('productor2');
    await page.getByPlaceholder('••••••••').fill('secret123');
    await page.getByText('Productor', { exact: true }).click();
    await page.getByRole('button', { name: /Crear cuenta/ }).click();
    await expect(page).toHaveURL(/#\/producer$/);

    // Log out (the session guard sends a logged-out user to /welcome).
    await page.getByRole('button', { name: /Cerrar sesión/ }).click();
    await expect(page).toHaveURL(/#\/welcome$/);

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/login$/);

    // Log back in with the same name, no role selection needed.
    await page.getByPlaceholder('usuario@trackwise.ai').fill('productor2');
    await page.getByPlaceholder('••••••••').fill('whatever');
    await page.getByRole('button', { name: 'Entrar a la plataforma' }).click();

    await expect(page).toHaveURL(/#\/producer$/);
  });
});
