import { test, expect } from '@playwright/test';

const runId = process.env.LYNK_E2E_RUN_ID ?? 'local';
const email = process.env.LYNK_E2E_VENDEDOR_EMAIL ?? `vendedor+${runId}@example.com`;
const password = process.env.LYNK_E2E_PASSWORD ?? 'change-me-please';

test.describe('Fluxo vendedor — copiar mensagem', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page).toHaveURL(/\/(?:prospeccao|funil|agendamentos)?$/);
  });

  test('abre prospecção, clica Enviar e registra primeiro contato', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/prospeccao');
    const firstEnviar = page.getByRole('button', { name: /Enviar/i }).first();
    await expect(firstEnviar).toBeVisible();
    await firstEnviar.click();

    // Modal preview
    await expect(page.getByRole('heading', { name: /Mensagem inicial/i })).toBeVisible();
    await expect(page.getByText(/Este contato conta para sua meta/i)).toBeVisible();
    await page.getByRole('button', { name: /Copiar mensagem/i }).click();
    await expect(page.getByRole('button', { name: /Concluído/i })).toBeVisible();
  });

  test('dashboard mostra metas do dia', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Minhas metas de hoje/i })).toBeVisible();
    const goals = page.getByRole('complementary');
    await expect(goals).toContainText('Prospecção');
    await expect(goals).toContainText('Follow-ups');
  });
});
