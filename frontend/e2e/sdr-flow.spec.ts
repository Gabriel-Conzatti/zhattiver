import { test, expect } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const email = process.env.LYNK_E2E_SDR_EMAIL ?? `sdr+${runId}@example.com`;
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';
const phoneSuffix = runId.replace(/\D/g, '').slice(-7).padStart(7, '0');

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
    const uniqueName = `Teste E2E ${runId}`;
    const phone = `519${phoneSuffix}2`;

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
    const phone = `519${phoneSuffix}3`;
    await page.getByLabel('Nome').fill('Duplicado A');
    await page.getByLabel('Telefone(s)').fill(phone);
    await page.getByRole('button', { name: /Cadastrar lead/i }).click();
    await expect(page.getByText('Lead cadastrado', { exact: true })).toBeVisible();

    await page.getByLabel('Nome').fill('Duplicado B');
    await page.getByLabel('Telefone(s)').fill(phone);
    await page.getByRole('button', { name: /Cadastrar lead/i }).click();
    await expect(page.getByText(/Duplicado: já existe/i)).toBeVisible();
  });
});
