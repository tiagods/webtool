import { Page } from '@playwright/test';
import path from 'path';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Aceita o Termo de Ciencia LGPD */
export async function aceitarLgpd(page: Page): Promise<void> {
  const checkbox = page.getByRole('checkbox');
  await checkbox.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(3500);
  await checkbox.check();
  await page.getByRole('button', { name: /Li e estou ciente/ }).click();
  await page.waitForURL(/abertura/, { timeout: 15000 });
}

/** Preenche o Passo 1 - Dados da Empresa (Ltda) */
export async function preencherPasso1(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/\?step=1/, { timeout: 10000 });
  await page.locator('h2').filter({ hasText: /Dados da Empresa/ }).waitFor({ state: 'visible', timeout: 5000 });

  await page.getByRole('button', { name: /Sociedade Limitada/ }).first().click();
  await page.waitForTimeout(300);

  const inputs = page.locator('input');
  await inputs.nth(0).fill(`Empresa Teste Ltda ${suffix}`);
  await inputs.nth(1).fill(`Segunda Opcao Ltda ${suffix}`);
  await inputs.nth(2).fill(`Terceira Opcao Ltda ${suffix}`);
  await inputs.nth(3).fill(`Fantasia ${suffix}`);
  await page.locator('textarea').fill('Prestacao de servicos de consultoria empresarial e financeira');
  await page.waitForTimeout(500);
}

/** Preenche o Passo 2 - Endereco da Sede */
export async function preencherPasso2(page: Page): Promise<void> {
  await page.waitForURL(/\?step=2/, { timeout: 15000 });
  await page.getByText(/Endere/).first().waitFor({ state: 'visible', timeout: 5000 });

  await page.getByPlaceholder('00000-000').fill('01310-100');
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/Rua/).fill('Avenida Paulista');
  await page.getByPlaceholder('N').first().fill('1000');
  await page.getByPlaceholder('Obrigatorio').first().fill('123456789');
  await page.getByPlaceholder('Bairro').fill('Bela Vista');

  const cidadeInput = page.getByPlaceholder('Cidade');
  if (await cidadeInput.isVisible()) {
    await cidadeInput.fill('Sao Paulo');
  }
  const ufInput = page.getByPlaceholder(/SP|UF/);
  if (await ufInput.isVisible()) {
    await ufInput.fill('SP');
  }
}

/** Preenche o Passo 3 - Dados dos Socios (ao menos 2 para Ltda) */
export async function preencherPasso3(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/\?step=3/, { timeout: 15000 });
  await page.getByText(/Socios/).first().waitFor({ state: 'visible', timeout: 5000 });

  const inputs = page.locator('input');
  const primeiroNome = inputs.nth(0);
  await primeiroNome.fill(`Joao Silva ${suffix}`);

  const cpfInputs = page.getByPlaceholder(/^\d/);
  const cpfFirst = cpfInputs.first();
  if (await cpfFirst.isVisible()) {
    await cpfFirst.fill('529.982.247-25');
  }

  await page.getByRole('button', { name: /Adicionar Socio/ }).click();
  await page.waitForTimeout(500);

  const todosNomes = await page.getByPlaceholder('Nome do socio').all();
  if (todosNomes.length > 1) {
    await todosNomes[1].fill(`Maria Souza ${suffix}`);
  }
  const cpfAll = await page.getByPlaceholder(/^\d/).all();
  if (cpfAll.length > 1) {
    await cpfAll[1].fill('374.278.528-94');
  }
}

/** Preenche o Passo 4 - Dados da Sociedade (exclusivo Ltda) */
export async function preencherPasso4(page: Page): Promise<void> {
  await page.waitForURL(/\?step=4/, { timeout: 15000 });
  await page.getByText(/Dados da Sociedade/).first().waitFor({ state: 'visible', timeout: 5000 });

  const inputs = page.locator('input');
  if (await inputs.nth(0).isVisible()) {
    await inputs.nth(0).fill('10000');
  }

  await page.getByPlaceholder(/Itau/).fill('Banco do Brasil');
}

/** Preenche o Passo 5 - Envio de Documentos */
export async function preencherPasso5(page: Page): Promise<void> {
  await page.waitForURL(/\?step=5/, { timeout: 15000 });
  await page.getByText(/Documentos/).first().waitFor({ state: 'visible', timeout: 5000 });

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible()) {
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'documento-teste.pdf'));
    await page.waitForTimeout(3000);
  }
}

/** Preenche o Passo 6 - Revisao e Envio (Ltda) */
export async function preencherPasso6ESubmeter(page: Page): Promise<void> {
  await page.waitForURL(/\?step=6/, { timeout: 15000 });

  const checkbox = page.getByRole('checkbox');
  await checkbox.check();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /Concluir e Enviar/ }).click();
}

/** Verifica tela de confirmacao pos-submissao */
export async function verificarConfirmacao(page: Page): Promise<string> {
  await page.waitForURL(/confirmacao/, { timeout: 30000 });
  await page.getByText(/Solicitacao enviada/).waitFor({ state: 'visible', timeout: 10000 });
  const protocolo = await page.locator('text=Protocolo').locator('..').locator('p').last().textContent();
  return protocolo ?? '';
}