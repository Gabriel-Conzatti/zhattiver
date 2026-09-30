import { test, expect } from '@playwright/test';

/**
 * Requer:
 *   - Admin criado (create-admin) e usuário SDR com produto Auto associado.
 *   - Variáveis LYNK_E2E_SDR_EMAIL e LYNK_E2E_SDR_PASSWORD.
 */

const email = process.env.LYNK_E2E_SDR_EMAIL ?? 'sdr@example.com';
const password = process.env.LYNK_E2E_SDR_PASSWORD ?? 'change-me-please';

test.describe('Fluxo SDR — cadastro + disponibilização', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page).toHaveURL(/\/sdr/);
  });

  test('cadastra novo lead e o disponibiliza', async ({ page }) => {
    await page.goto('/sdr/prospeccao');
    const uniqueName = `Teste E2E ${Date.now()}`;
    const phone = `5199${Date.now().toString().slice(-6)}0`;

    await page.getByLabel('Nome').fill(uniqueName);
    await page.getByLabel('Telefone(s)').fill(phone);
    await page.getByRole('button', { name: /Cadastrar lead/i }).click();
    await expect(page.getByText(/Lead cadastrado/i)).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(uniqueName) });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: /Disponibilizar/i }).click();
    await expect(page.getByText(/Lead disponibilizado/i)).toBeVisible();
  });

  test('duplicidade por telefone é detectada', async ({ page }) => {
    await page.goto('/sdr/prospeccao');
    const phone = '5199988877766';
    await page.getByLabel('Nome').fill('Duplicado A');
    await page.getByLabel('Telefone(s)').fill(phone);
    await page.getByRole('button', { name: /Cadastrar lead/i }).click();

    await page.getByLabel('Nome').fill('Duplicado B');
    await page.getByLabel('Telefone(s)').fill(phone);
    await page.getByRole('button', { name: /Cadastrar lead/i }).click();
    await expect(page.getByText(/Duplicado/i)).toBeVisible();
  });
});
