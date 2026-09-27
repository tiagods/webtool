import { test, expect } from '@playwright/test';
import { uid, aceitarLgpd } from './helpers';

test.describe('Abertura - Restauracao de Rascunho', () => {
  const suffix = uid();

  test('deve restaurar dados preenchidos apos refresh da pagina', async ({ page }) => {
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');
    await aceitarLgpd(page);

    // Substitui o mock "ok:true" por um mock com estado: guarda o payload
    // salvo e o devolve no GET — fiel ao ciclo draft salvar → restaurar.
    let draftGuardado: unknown = null;
    await page.unroute('**/api/draft');
    await page.route('**/api/draft', async route => {
      const req = route.request();
      if (req.method() === 'POST') {
        draftGuardado = await req.postDataJSON();
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      } else if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ payload: draftGuardado }),
        });
      } else {
        await route.continue();
      }
    });

    await page.waitForURL(/\?step=1/, { timeout: 10000 });
    await page.locator('h2').filter({ hasText: 'Dados da Empresa' }).waitFor({ state: 'visible', timeout: 5000 });

    await page.getByText('Sociedade Limitada').first().click();
    await page.waitForTimeout(300);

    const nomeEmpresa = `Empresa Rascunho ${suffix}`;
    const nomes = page.getByPlaceholder(/Ex:/);
    await nomes.nth(0).fill(nomeEmpresa);
    await nomes.nth(1).fill(`Segunda Opcao ${suffix}`);
    await nomes.nth(2).fill(`Terceira Opcao ${suffix}`);
    await page.getByPlaceholder(/Como/).fill(`Fantasia ${suffix}`);
    await page.getByPlaceholder(/Descreva/).fill('Atividade de teste para rascunho');

    await page.getByRole('button', { name: /Avan/ }).click();
    await page.waitForURL(/\?step=2/, { timeout: 15000 });
    await page.getByText(/Endere/).first().waitFor({ state: 'visible', timeout: 5000 });

    await page.getByPlaceholder('00000-000').fill('01310-100');
    await page.waitForTimeout(2000);
    // ViaCEP preenche e desabilita logradouro/bairro — usamos force:true
    const forcar = { force: true };
    await page.getByPlaceholder(/Rua/).fill('Avenida Paulista', forcar);

    // Refresh - simula fechar e reabrir (URL preserva o passo atual)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // O app restaura os dados do rascunho sem resetar o passo: volta ao passo 1
    await page.getByRole('button', { name: /Voltar/ }).click();
    await page.waitForURL(/\?step=1/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verifica se o nome empresarial 1 foi restaurado
    const n1 = page.getByPlaceholder(/Ex:/).nth(0);
    await expect(n1).toHaveValue(nomeEmpresa, { timeout: 10000 });
  });
});