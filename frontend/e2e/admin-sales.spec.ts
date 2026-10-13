import { test, expect } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const email = process.env.LYNK_E2E_ADMIN_EMAIL ?? `admin+${runId}@example.com`;
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';

test('admin valida venda pendente e ela passa a compor a produção oficial', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/producao');
  const pendingRow = page.getByRole('row', { name: /2000\.00/ });
  await expect(pendingRow).toContainText('Aguardando validação');
  await pendingRow.getByRole('button', { name: /Validar/i }).click();
  await expect(pendingRow).not.toBeVisible();

  await page.getByRole('button', { name: 'Validadas', exact: true }).click();
  const validatedRow = page.getByRole('row', { name: /2000\.00/ });
  await expect(validatedRow).toContainText('Validada');
  await expect(validatedRow).toContainText('300.00');

  await page.goto('/admin/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  await expect(page.getByText('R$ 2.000,00').first()).toBeVisible();
  await expect(page.getByText('R$ 300,00').first()).toBeVisible();
});
