import { test, expect } from '@playwright/test';
import { uid, aceitarLgpd } from './helpers';

test.describe('Abertura - Restauracao de Rascunho', () => {
  const suffix = uid();

  test('deve restaurar dados preenchidos apos refresh da pagina', async ({ page }) => {
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');
    await aceitarLgpd(page);

    await page.waitForURL(/\?step=1/, { timeout: 10000 });
    await page.locator('h2').filter({ hasText: 'Dados da Empresa' }).waitFor({ state: 'visible', timeout: 5000 });

    await page.getByText('Sociedade Limitada').first().click();
    await page.waitForTimeout(300);

    const nomeEmpresa = `Empresa Rascunho ${suffix}`;
    const nomes = page.getByPlaceholder(/Ex:/);
    await nomes.nth(0).fill(nomeEmpresa);
    await nomes.nth(1).fill(`Segunda Opcao ${suffix}`);
    await nomes.nth(2).fill(`Terceira Opcao ${suffix}`);
    await page.getByPlaceholder(/Como a empresa/).fill(`Fantasia ${suffix}`);
    await page.getByPlaceholder(/Descreva/).fill('Atividade de teste para rascunho');

    await page.getByRole('button', { name: /Avan/ }).click();
    await page.waitForURL(/\?step=2/, { timeout: 15000 });
    await page.getByText(/Endere/).first().waitFor({ state: 'visible', timeout: 5000 });

    await page.getByPlaceholder('00000-000').fill('01310-100');
    await page.waitForTimeout(2000);
    await page.getByPlaceholder(/Rua/).fill('Avenida Paulista');
    await page.getByRole('button', { name: /Avan/ }).click();

    // Refresh - simula fechar e reabrir
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.waitForURL(/\?step=1/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verifica se o nome empresarial 1 foi restaurado
    const n1 = page.getByPlaceholder(/Ex:/).nth(0);
    await expect(n1).toHaveValue(nomeEmpresa, { timeout: 10000 });
  });
});