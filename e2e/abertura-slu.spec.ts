import { test, expect } from '@playwright/test';
import {
  uid,
  aceitarLgpd,
  preencherPasso1,
  preencherPasso2,
  preencherPasso3,
  preencherPasso5,
  verificarConfirmacao,
} from './helpers';

test.describe('Abertura — Fluxo SLU (Sociedade Unipessoal)', () => {
  const suffix = uid();

  test('deve preencher 5 passos (sem Dados da Sociedade) e exibir protocolo', async ({ page }) => {
    // Acessa e aceita LGPD
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');
    await aceitarLgpd(page);

    // Passo 1 — Dados da Empresa (SLU)
    await page.waitForURL(/abertura\?step=1/, { timeout: 10000 });
    await page.getByText('Dados da Empresa').waitFor({ state: 'visible', timeout: 5000 });

    // Seleciona "Sociedade Unipessoal" (SLU)
    await page.getByText('Sociedade Unipessoal').first().click();

    await page.getByPlaceholder(/João da Silva Serviços/).fill(`Empresa SLU ${suffix}`);
    await page.getByLabel('2ª Opção').fill(`Segunda Opção SLU ${suffix}`);
    await page.getByLabel('3ª Opção').fill(`Terceira Opção SLU ${suffix}`);
    await page.getByPlaceholder(/Descreva a atividade/).fill('Servicos de consultoria em gestã empresarial');
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 2 — Endereço da Sede
    await preencherPasso2(page);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 3 — Dados do Sócio (SLU: único sócio)
    await page.waitForURL(/abertura\?step=3/, { timeout: 10000 });
    await page.getByText('Dados dos Sócios').waitFor({ state: 'visible', timeout: 5000 });

    const nomeInput = await page.getByPlaceholder('Nome do sócio');
    await nomeInput.fill(`Sócio Único ${suffix}`);
    await page.getByPlaceholder('000.000.000-00').fill('529.982.247-25');
    await page.getByRole('button', { name: /Avançar/ }).click();

    // SLU PULA o Passo 4 (Dados da Sociedade) — deve ir direto para Documentos
    await page.waitForURL(/abertura\?step=4/, { timeout: 10000 });
    await page.getByText('Envio de Documentos').waitFor({ state: 'visible', timeout: 5000 });

    // Garante que DADOS DA SOCIEDADE NÃO aparece
    await expect(page.getByText('Dados da Sociedade')).not.toBeVisible();

    // Passo 5 (na verdade passo 4) — Envio de Documentos
    await preencherPasso5(page);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // SLU: Revisão é o passo 5 — verifica e submete
    await page.waitForURL(/abertura\?step=5/, { timeout: 10000 });

    // Checkbox de aceite
    const checkbox = page.getByRole('checkbox');
    await checkbox.check();
    await page.getByRole('button', { name: /Concluir e Enviar/ }).click();

    // Verifica confirmação
    const protocolo = await verificarConfirmacao(page);
    expect(protocolo).toBeTruthy();
    expect(protocolo).toContain('PROT-');
  });
});