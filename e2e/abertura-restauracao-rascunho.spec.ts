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

    await page.getByRole('button', { name: /Sociedade Limitada/ }).first().click();
    await page.waitForTimeout(300);

    const nomeEmpresa = `Empresa Rascunho ${suffix}`;
    await page.getByPlaceholder(/Ex:/).first().fill(nomeEmpresa);
    await page.getByLabel('2').fill(`Segunda Opcao ${suffix}`);
    await page.getByLabel('3').filter({ hasText: /Op/ }).fill(`Terceira Opcao ${suffix}`);
    await page.getByPlaceholder(/Descreva/).fill('Atividade de teste para rascunho');

    await page.getByRole('button', { name: /Avan/ }).click();
    await page.waitForURL(/\?step=2/, { timeout: 15000 });
    await page.getByText('Endereco da Sede').first().waitFor({ state: 'visible', timeout: 5000 });

    await page.getByPlaceholder('00000-000').fill('01310-100');
    await page.waitForTimeout(2000);
    await page.getByPlaceholder(/Rua/).fill('Avenida Paulista');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.waitForURL(/\?step=1/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    const nomeInput = page.getByPlaceholder(/Ex:/).first();
    await expect(nomeInput).toHaveValue(nomeEmpresa, { timeout: 10000 });

    await page.getByRole('button', { name: /Avan/ }).click();
    await page.waitForURL(/\?step=2/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    const logradouroInput = page.getByPlaceholder(/Rua/);
    await expect(logradouroInput).toHaveValue('Avenida Paulista', { timeout: 5000 });
  });
});