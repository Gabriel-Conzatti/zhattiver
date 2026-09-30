import { test, expect } from '@playwright/test';

/**
 * Requer:
 *   - Um vendedor com produto Auto associado.
 *   - Pelo menos um lead disponibilizado para esse produto (rodar sdr-flow antes).
 *   - Variáveis LYNK_E2E_VENDEDOR_EMAIL / LYNK_E2E_VENDEDOR_PASSWORD.
 */

const email = process.env.LYNK_E2E_VENDEDOR_EMAIL ?? 'vendedor@example.com';
const password = process.env.LYNK_E2E_VENDEDOR_PASSWORD ?? 'change-me-please';

test.describe('Fluxo vendedor — copiar mensagem', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Senha').fill(password);
    await page.getByRole('button', { name: /Entrar/i }).click();
    await expect(page).toHaveURL(/^\/(?:$|prospeccao|funil|agendamentos)/);
  });

  test('abre prospecção, clica Enviar e registra primeiro contato', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/prospeccao');
    const firstEnviar = page.getByRole('button', { name: /Enviar/i }).first();
    await expect(firstEnviar).toBeVisible();
    await firstEnviar.click();

    // Modal preview
    await expect(page.getByRole('heading', { name: /Mensagem inicial/i })).toBeVisible();
    await page.getByRole('button', { name: /Copiar mensagem/i }).click();
    await expect(page.getByText(/Este contato conta para sua meta/i)).toBeVisible();
  });

  test('dashboard mostra metas do dia', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Minhas metas de hoje/i })).toBeVisible();
    await expect(page.getByText(/Prospecção/i)).toBeVisible();
    await expect(page.getByText(/Follow-ups/i)).toBeVisible();
  });
});
