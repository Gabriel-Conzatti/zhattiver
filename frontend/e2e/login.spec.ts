import { test, expect } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const email = process.env.LYNK_E2E_ADMIN_EMAIL ?? `admin+${runId}@example.com`;
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';

test.describe('Login e roteamento por perfil', () => {
  test('exibe a identidade oficial do produto', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('Funil Sustentare');
    await expect(page.getByRole('heading', { name: 'Funil Sustentare' })).toBeVisible();
  });

  test('solicita recuperação sem revelar se a conta existe', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(page).toHaveURL(/\/recuperar-senha/);
    await page.getByLabel('Email').fill(`ausente+${runId}@example.com`);
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(
      page.getByText(/Se existir uma conta ativa para este e-mail/),
    ).toBeVisible();
  });

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
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('credenciais inválidas mostram erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill('senha-errada-xxx');
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page.getByText(/Credenciais inválidas/i)).toBeVisible();
  });
});
