import { test, expect } from '@playwright/test';
import { uid, aceitarLgpd } from './helpers';

test.describe('Abertura — Restauração de Rascunho', () => {
  const suffix = uid();

  test('deve restaurar dados preenchidos após refresh da página', async ({ page }) => {
    // Acessa e aceita LGPD
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');
    await aceitarLgpd(page);

    // Passo 1 — preenche dados da empresa
    await page.waitForURL(/abertura\?step=1/, { timeout: 10000 });
    await page.getByText('Dados da Empresa').waitFor({ state: 'visible', timeout: 5000 });

    // Seleciona Ltda e preenche nome empresarial
    await page.getByText('Sociedade Limitada').first().click();
    const nomeEmpresa = `Empresa Rascunho ${suffix}`;
    await page.getByPlaceholder(/João da Silva Serviços/).fill(nomeEmpresa);
    await page.getByLabel('2ª Opção').fill(`Segunda Opção ${suffix}`);
    await page.getByLabel('3ª Opção').fill(`Terceira Opção ${suffix}`);
    await page.getByPlaceholder(/Descreva a atividade/).fill('Atividade de teste para rascunho');

    // Navega para o passo 2 para forçar salvamento do draft
    await page.getByRole('button', { name: /Avançar/ }).click();
    await page.waitForURL(/abertura\?step=2/, { timeout: 10000 });
    await page.getByText('Endereço da Sede').waitFor({ state: 'visible', timeout: 5000 });

    // Preenche parcialmente o endereço
    await page.getByPlaceholder('00000-000').fill('01310-100');
    await page.waitForTimeout(2000);
    await page.getByPlaceholder(/Ex: Rua Direita|Rua, Avenida/).fill('Avenida Paulista');

    // Refresh forçado da página — simula fechar e reabrir o navegador
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Como o cookie de aceite persiste, o modal LGPD NÃO deve aparecer
    // O rascunho deve ser restaurado automaticamente via GET /api/draft

    // Verifica se os dados do passo 1 foram restaurados
    await page.waitForURL(/abertura\?step=1/, { timeout: 15000 });
    await page.waitForTimeout(2000); // aguarda o fetch de restauração

    // O nome da empresa deve ter sido restaurado
    const nomeInput = page.getByPlaceholder(/João da Silva Serviços/);
    await expect(nomeInput).toHaveValue(nomeEmpresa, { timeout: 10000 });

    // Agora navega para o passo 2 e verifica se o endereço foi restaurado
    await page.getByRole('button', { name: /Avançar/ }).click();
    await page.waitForURL(/abertura\?step=2/, { timeout: 10000 });
    await page.waitForTimeout(2000);

    const logradouroInput = page.getByPlaceholder(/Ex: Rua Direita|Rua, Avenida/);
    await expect(logradouroInput).toHaveValue('Avenida Paulista', { timeout: 5000 });
  });
});