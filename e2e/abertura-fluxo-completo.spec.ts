import { test, expect } from '@playwright/test';
import {
  uid,
  aceitarLgpd,
  preencherPasso1,
  preencherPasso2,
  preencherPasso3,
  preencherPasso4,
  preencherPasso5,
  preencherPasso6ESubmeter,
  verificarConfirmacao,
} from './helpers';

test.describe('Abertura — Fluxo Completo Ltda', () => {
  const suffix = uid();

  test('deve preencher todos os 6 passos e exibir protocolo na confirmação', async ({ page }) => {
    // Acessa a página inicial de abertura
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');

    // Aceita LGPD
    await aceitarLgpd(page);

    // Passo 1 — Dados da Empresa
    await preencherPasso1(page, suffix);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 2 — Endereço da Sede
    await preencherPasso2(page);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 3 — Dados dos Sócios
    await preencherPasso3(page, suffix);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 4 — Dados da Sociedade
    await preencherPasso4(page);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 5 — Envio de Documentos
    await preencherPasso5(page);
    await page.getByRole('button', { name: /Avançar/ }).click();

    // Passo 6 — Revisão e Envio
    await preencherPasso6ESubmeter(page);

    // Verifica confirmação
    const protocolo = await verificarConfirmacao(page);
    expect(protocolo).toBeTruthy();
    expect(protocolo).toContain('PROT-');
  });
});