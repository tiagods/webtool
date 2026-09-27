import { Page } from '@playwright/test';
import path from 'path';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function aceitarLgpd(page: Page): Promise<void> {
  const checkbox = page.getByRole('checkbox');
  await checkbox.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(3500);
  await checkbox.check();

  // Clica em "Li e estou ciente" e espera a resposta da API
  const respPromise = page.waitForResponse(r => r.url().includes('/api/aceite-termo') && r.status() === 200, { timeout: 10000 });
  await page.getByRole('button', { name: /Li e estou ciente/ }).click();
  await respPromise;

  // Forca hard reload para garantir que o StepperEngine remonte com o cookie
  await page.reload();
  await page.waitForLoadState('networkidle');
}

export async function preencherPasso1(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/\?step=1/, { timeout: 10000 });
  await page.locator('h2').filter({ hasText: /Dados da Empresa/ }).waitFor({ state: 'visible', timeout: 5000 });

  await page.getByText('Sociedade Limitada').first().click();
  await page.waitForTimeout(300);

  // Preenche usando placeholders - todos os 3 começam com "Ex:"
  const nomes = page.getByPlaceholder(/Ex:/);
  await nomes.nth(0).fill(`Empresa Teste Ltda ${suffix}`);
  await nomes.nth(1).fill(`Segunda Opcao Ltda ${suffix}`);
  await nomes.nth(2).fill(`Terceira Opcao Ltda ${suffix}`);
  await page.getByPlaceholder(/Como/).fill(`Fantasia ${suffix}`);
  await page.getByPlaceholder(/Descreva/).fill('Prestacao de servicos de consultoria empresarial e financeira online');
  await page.waitForTimeout(300);
}

export async function preencherPasso2(page: Page): Promise<void> {
  await page.waitForURL(/\?step=2/, { timeout: 15000 });
  await page.getByText(/Endere/).first().waitFor({ state: 'visible', timeout: 5000 });

  // CEP (IMask)
  await page.getByPlaceholder('00000-000').fill('01310-100');
  await page.waitForTimeout(2000);

  // Logradouro, Numero, IPTU, Bairro
  await page.getByPlaceholder(/Rua/).fill('Avenida Paulista');
  await page.getByPlaceholder('N').first().fill('1000');
  await page.getByPlaceholder('Obrigatorio').first().fill('123456789');
  await page.getByPlaceholder('Bairro').fill('Bela Vista');

  // Cidade e UF (podem ja estar preenchidos pelo ViaCEP)
  const cidade = page.getByPlaceholder('Cidade');
  if (await cidade.isVisible().catch(() => false)) await cidade.fill('Sao Paulo');
  const uf = page.getByPlaceholder('SP');
  if (await uf.isVisible().catch(() => false)) await uf.fill('SP');

  await page.waitForTimeout(300);
}

export async function preencherPasso3(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/\?step=3/, { timeout: 15000 });
  await page.getByText(/Socios/).first().waitFor({ state: 'visible', timeout: 5000 });

  // Socio 1
  const nomes = page.getByPlaceholder('Nome do socio');
  await nomes.nth(0).fill(`Joao Silva ${suffix}`);
  const cpfs = page.getByPlaceholder(/^\d{3}\./);
  await cpfs.nth(0).fill('529.982.247-25');

  // Adiciona Socio 2
  await page.getByRole('button', { name: /Adicionar Socio/ }).click();
  await page.waitForTimeout(500);

  await nomes.nth(1).fill(`Maria Souza ${suffix}`);
  await cpfs.nth(1).fill('374.278.528-94');

  await page.waitForTimeout(300);
}

export async function preencherPasso4(page: Page): Promise<void> {
  await page.waitForURL(/\?step=4/, { timeout: 15000 });
  await page.getByText(/Dados da Sociedade/).first().waitFor({ state: 'visible', timeout: 5000 });

  // Capital social (IMask R$)
  await page.getByPlaceholder(/R\\$/).fill('10000');
  // Banco
  await page.getByPlaceholder(/Itau/).fill('Banco do Brasil');

  await page.waitForTimeout(300);
}

export async function preencherPasso5(page: Page): Promise<void> {
  await page.waitForURL(/\?step=5/, { timeout: 15000 });
  await page.getByText(/Documentos/).first().waitFor({ state: 'visible', timeout: 5000 });

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible()) {
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'documento-teste.pdf'));
    await page.waitForTimeout(3000);
  }
}

export async function preencherPasso6ESubmeter(page: Page): Promise<void> {
  await page.waitForURL(/\?step=6/, { timeout: 15000 });

  const checkbox = page.getByRole('checkbox');
  await checkbox.check();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /Concluir e Enviar/ }).click();
}

export async function verificarConfirmacao(page: Page): Promise<string> {
  await page.waitForURL(/confirmacao/, { timeout: 30000 });
  await page.getByText(/Solicitacao enviada/).waitFor({ state: 'visible', timeout: 10000 });
  const protocolo = await page.locator('text=Protocolo').locator('..').locator('p').last().textContent();
  return protocolo ?? '';
}