import { test, expect } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const email = process.env.LYNK_E2E_ADMIN_EMAIL ?? `admin+${runId}@example.com`;
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';

test.describe('Login e roteamento por perfil', () => {
  test('exibe a identidade oficial do produto', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('Lynk');
    await expect(page.getByAltText('Lynk')).toBeVisible();
  });

  test('não oferece recuperação de senha nem seleção de perfil', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Esqueci minha senha')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vendedor' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'SDR' })).toHaveCount(0);
  });

  test('admin loga e vai para /admin', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Login').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: 'ACESSAR' }).click();
    await expect(page).toHaveURL(/\/admin(?:$|\/)/);
    await expect(page.getByRole('heading', { name: /Painel administrativo/i })).toBeVisible();
  });

  test('logout limpa sessão', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Login').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: 'ACESSAR' }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.getByRole('button', { name: /Sair/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel('Login')).toBeVisible();
  });

  test('credenciais inválidas mostram erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Login').fill(email);
    await page.getByLabel('Senha').fill('senha-errada-xxx');
    await page.getByRole('button', { name: 'ACESSAR' }).click();
    await expect(page.getByText(/E-mail ou senha incorretos/i)).toBeVisible();
  });
});
