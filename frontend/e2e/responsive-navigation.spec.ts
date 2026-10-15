import { expect, test, type Page } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';

async function login(page: Page, role: 'admin' | 'sdr' | 'vendedor') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${role}+${runId}@example.com`);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test.describe('Navegação responsiva', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('admin usa menu móvel sem conteúdo cortado', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/admin$/);
    await expectNoPageOverflow(page);

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação administrativa' })).toBeVisible();
    await page.getByRole('link', { name: 'Produção' }).click();

    await expect(page).toHaveURL(/\/admin\/producao$/);
    await expect(page.getByRole('heading', { name: 'Produção' })).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test('vendedor não recebe atalho de venda direta', async ({ page }) => {
    await login(page, 'vendedor');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Nova venda' })).toHaveCount(0);
    await expectNoPageOverflow(page);
  });

  test('SDR não recebe controle inerte', async ({ page }) => {
    await login(page, 'sdr');
    await expect(page).toHaveURL(/\/sdr$/);
    await expect(page.getByRole('button', { name: 'Nova venda' })).toHaveCount(0);
    await expectNoPageOverflow(page);
  });
});
