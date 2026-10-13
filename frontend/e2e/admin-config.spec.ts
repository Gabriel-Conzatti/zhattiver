import { test, expect } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const email = process.env.LYNK_E2E_ADMIN_EMAIL ?? `admin+${runId}@example.com`;
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';

test('admin cria e arquiva produto preservando o cadastro', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/configuracoes');
  const products = page.getByRole('heading', { name: 'Produtos', exact: true }).locator('..');
  const productName = `Produto E2E ${runId}-${Date.now()}`;
  await products.getByLabel('Novo item em Produtos').fill(productName);
  await products.getByRole('button', { name: 'Adicionar' }).click();

  const itemName = products.locator(`input[value="${productName}"]`);
  await expect(itemName).toBeVisible();
  const item = itemName.locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  await item.getByRole('button', { name: 'Arquivar' }).click();
  await expect(item.getByRole('button', { name: 'Restaurar' })).toBeVisible();
});
