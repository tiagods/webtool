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

test.describe('Abertura - Fluxo Completo Ltda', () => {
  const suffix = uid();

  test('deve preencher todos os 6 passos e exibir protocolo na confirmacao', async ({ page }) => {
    await page.goto('/abertura');
    await page.waitForLoadState('networkidle');

    await aceitarLgpd(page);

    await preencherPasso1(page, suffix);
    await page.getByRole('button', { name: /Avan/ }).click();

    await preencherPasso2(page);
    await page.getByRole('button', { name: /Avan/ }).click();

    await preencherPasso3(page, suffix);
    await page.getByRole('button', { name: /Avan/ }).click();

    await preencherPasso4(page);
    await page.getByRole('button', { name: /Avan/ }).click();

    await preencherPasso5(page);
    await page.getByRole('button', { name: /Avan/ }).click();

    await preencherPasso6ESubmeter(page);

    const protocolo = await verificarConfirmacao(page);
    expect(protocolo).toBeTruthy();
    expect(protocolo).toContain('PRO-');
  });
});