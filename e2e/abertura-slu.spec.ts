import { test, expect } from '@playwright/test';
import {
  uid,
  aceitarLgpd,
  preencherPasso2,
  verificarConfirmacao,
} from './helpers';

test.describe('Abertura - Fluxo SLU (Sociedade Unipessoal)', () => {
  const suffix = uid();

  test('deve preencher 5 passos (sem Dados da Sociedade) e exibir protocolo', async ({ page }) => {
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');
    await aceitarLgpd(page);

    await page.waitForURL(/\?step=1/, { timeout: 10000 });
    await page.locator('h2').filter({ hasText: 'Dados da Empresa' }).waitFor({ state: 'visible', timeout: 5000 });

    await page.getByRole('button', { name: /Sociedade Unipessoal/ }).first().click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder(/Ex:/).first().fill(`Empresa SLU ${suffix}`);
    await page.getByLabel('2').fill(`Segunda Opcao SLU ${suffix}`);
    await page.getByLabel('3').filter({ hasText: /Op/ }).fill(`Terceira Opcao SLU ${suffix}`);
    await page.getByPlaceholder(/Descreva/).fill('Servicos de consultoria em gestao empresarial');
    await page.getByRole('button', { name: /Avan/ }).click();

    await preencherPasso2(page);
    await page.getByRole('button', { name: /Avan/ }).click();

    await page.waitForURL(/\?step=3/, { timeout: 15000 });
    await page.getByText('Dados dos Socios').first().waitFor({ state: 'visible', timeout: 5000 });

    const nomeInput = await page.getByPlaceholder('Nome do socio');
    await nomeInput.fill(`Socio Unico ${suffix}`);
    await page.getByPlaceholder(/^\d{3}\./).fill('529.982.247-25');
    await page.getByRole('button', { name: /Avan/ }).click();

    await page.waitForURL(/\?step=4/, { timeout: 15000 });
    await page.getByText('Envio de Documentos').first().waitFor({ state: 'visible', timeout: 5000 });

    await expect(page.locator('h2').filter({ hasText: 'Dados da Sociedade' })).not.toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles('e2e/fixtures/documento-teste.pdf');
      await page.waitForTimeout(3000);
    }

    await page.getByRole('button', { name: /Avan/ }).click();

    await page.waitForURL(/\?step=5/, { timeout: 15000 });

    const checkbox = page.getByRole('checkbox');
    await checkbox.check();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Concluir e Enviar/ }).click();

    const protocolo = await verificarConfirmacao(page);
    expect(protocolo).toBeTruthy();
    expect(protocolo).toContain('PROT-');
  });
});