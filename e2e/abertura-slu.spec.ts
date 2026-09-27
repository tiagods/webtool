import { test, expect } from '@playwright/test';
import path from 'path';
import { uid, aceitarLgpd, preencherPasso2, verificarConfirmacao } from './helpers';

test.describe('Abertura - Fluxo SLU (Sociedade Unipessoal)', () => {
  const suffix = uid();

  test('deve preencher 5 passos (sem Dados da Sociedade) e exibir protocolo', async ({ page }) => {
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');
    await aceitarLgpd(page);

    await page.waitForURL(/\?step=1/, { timeout: 10000 });
    await page.locator('h2').filter({ hasText: 'Dados da Empresa' }).waitFor({ state: 'visible', timeout: 5000 });

    await page.getByText('Sociedade Unipessoal').first().click();
    await page.waitForTimeout(300);

    const nomes = page.getByPlaceholder(/Ex:/);
    await nomes.nth(0).fill(`Empresa SLU ${suffix}`);
    await nomes.nth(1).fill(`Segunda Opcao SLU ${suffix}`);
    await nomes.nth(2).fill(`Terceira Opcao SLU ${suffix}`);
    await page.getByPlaceholder(/Como a empresa/).fill(`Fantasia SLU ${suffix}`);
    await page.getByPlaceholder(/Descreva/).fill('Servicos de consultoria em gestao empresarial');
    await page.getByRole('button', { name: /Avan/ }).click();

    // Step 2 - Endereco
    await preencherPasso2(page);
    await page.getByRole('button', { name: /Avan/ }).click();

    // Step 3 - Socio unico
    await page.waitForURL(/\?step=3/, { timeout: 15000 });
    await page.getByText(/Socios/).first().waitFor({ state: 'visible', timeout: 5000 });

    await page.getByPlaceholder('Nome do socio').nth(0).fill(`Socio Unico ${suffix}`);
    await page.getByPlaceholder(/^\d{3}\./).nth(0).fill('529.982.247-25');
    await page.getByRole('button', { name: /Avan/ }).click();

    // Step 4 - SLU pula Sociedade, vai direto para Documentos
    await page.waitForURL(/\?step=4/, { timeout: 15000 });
    await page.getByText(/Documentos/).first().waitFor({ state: 'visible', timeout: 5000 });

    await expect(page.locator('h2').filter({ hasText: 'Dados da Sociedade' })).not.toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles('e2e/fixtures/documento-teste.pdf');
      await page.waitForTimeout(3000);
    }

    await page.getByRole('button', { name: /Avan/ }).click();

    // Step 5 - Revisao e envio
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