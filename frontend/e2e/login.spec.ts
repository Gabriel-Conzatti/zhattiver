import { test, expect } from '@playwright/test';

/**
 * Requer stack de produção/staging levantada e um administrador criado por:
 *   docker compose exec api flask lynk create-admin
 * Variáveis:
 *   LYNK_E2E_ADMIN_EMAIL, LYNK_E2E_ADMIN_PASSWORD
 */

const email = process.env.LYNK_E2E_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.LYNK_E2E_ADMIN_PASSWORD ?? 'change-me-please';

test.describe('Login e roteamento por perfil', () => {
  test('admin loga e vai para /admin', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page).toHaveURL(/\/admin(?:$|\/)/);
    await expect(page.getByRole('heading', { name: /Painel administrativo/i })).toBeVisible();
  });

  test('logout limpa sessão', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.getByRole('button', { name: /Sair/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('credenciais inválidas mostram erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill('senha-errada-xxx');
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page.getByText(/Credenciais inválidas/i)).toBeVisible();
  });
});
