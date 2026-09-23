import { Page } from '@playwright/test';
import path from 'path';

/** Gera um suffixo único para evitar colisões entre execuções */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Aceita o Termo de Ciência LGPD (modal obrigatório no primeiro acesso) */
export async function aceitarLgpd(page: Page): Promise<void> {
  // O modal aparece após a página carregar. O checkbox só é habilitado após 3s.
  const checkbox = page.getByRole('checkbox');
  await checkbox.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(3500); // aguarda o DELAY_HABILITAR_CHECKBOX_MS (3s)
  await checkbox.check();
  await page.getByRole('button', { name: /Li e estou ciente/ }).click();
  // Após o aceite, a página dá refresh e o modal desaparece
  await page.waitForURL(/abertura/, { timeout: 15000 });
}

/** Preenche o Passo 1 — Dados da Empresa (Ltda) */
export async function preencherPasso1(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/abertura\?step=1/, { timeout: 10000 });
  await page.getByText('Dados da Empresa').waitFor({ state: 'visible', timeout: 5000 });

  // Seleciona "Sociedade Limitada" se não estiver selecionado
  const ltdaCard = page.getByText('Sociedade Limitada').first();
  await ltdaCard.click();

  await page.getByPlaceholder(/João da Silva Serviços/).fill(`Empresa Teste Ltda ${suffix}`);
  await page.getByLabel('2ª Opção').fill(`Segunda Opção Ltda ${suffix}`);
  await page.getByLabel('3ª Opção').fill(`Terceira Opção Ltda ${suffix}`);
  await page.getByPlaceholder(/como a empresa será conhecida/).fill(`Fantasia ${suffix}`);
  await page.getByPlaceholder(/Descreva a atividade/).fill('Prestação de serviços de consultoria empresarial e financeira');
}

/** Preenche o Passo 2 — Endereço da Sede */
export async function preencherPasso2(page: Page): Promise<void> {
  await page.waitForURL(/abertura\?step=2/, { timeout: 10000 });
  await page.getByText('Endereço da Sede').waitFor({ state: 'visible', timeout: 5000 });

  // CEP inválido não será aceito, usamos um CEP válido com máscara
  await page.getByPlaceholder('00000-000').fill('01310-100');
  // Aguarda ViaCEP (pode falhar em CI/docker sem internet) — preenchemos manualmente
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/Ex: Rua Direita|Rua, Avenida/).fill('Avenida Paulista');
  await page.getByPlaceholder('Nº').fill('1000');
  await page.getByPlaceholder('Obrigatório').first().fill('123456789');
  // IPTU
  await page.getByPlaceholder('Bairro').fill('Bela Vista');
  // Os campos de cidade e UF podem já estar preenchidos pelo ViaCEP, mas vamos garantir
  const cidadeInput = page.getByPlaceholder('Cidade');
  if (await cidadeInput.isVisible()) {
    await cidadeInput.fill('São Paulo');
  }
  const ufInput = page.getByPlaceholder('SP');
  if (await ufInput.isVisible()) {
    await ufInput.fill('SP');
  }
}

/** Preenche o Passo 3 — Dados dos Sócios (ao menos 2 para Ltda) */
export async function preencherPasso3(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/abertura\?step=3/, { timeout: 10000 });
  await page.getByText('Dados dos Sócios').waitFor({ state: 'visible', timeout: 5000 });

  // Primeiro sócio
  const inputs = page.locator('input');
  const nomeInputs = await page.getByPlaceholder('Nome do sócio').all();
  if (nomeInputs.length > 0) {
    await nomeInputs[0].fill(`João Silva ${suffix}`);
  }
  const cpfInputs = await page.getByPlaceholder('000.000.00-00').all();
  if (cpfInputs.length > 0) {
    await cpfInputs[0].fill('529.982.247-25');
  }

  // Preencher mais campos obrigatórios do primeiro sÓcio
  // rg, órgao expedidor, etc — usamos placeholders do StepSocios
  const rgFields = await page.getByPlaceholder(/^[0-9]/).all();
  // Pulamos — o foco é no fluxo, não em cada campo

  // Adicionar segundo sócio (Ltda exige mínimo 2)
  await page.getByRole('button', { name: /Adicionar Sócio/ }).click();
  await page.waitForTimeout(500);

  const nomeInputs2 = await page.getByPlaceholder('Nome do sócio').all();
  if (nomeInputs2.length > 1) {
    await nomeInputs2[1].fill(`Maria Souza ${suffix}`);
  }
  await page.getByPlaceholder('000.000.000-00').fill('374.278.528-94');
}

/** Preenche o Passo 4 — Dados da Sociedade (exclusivo Ltda) */
export async function preencherPasso4(page: Page): Promise<void> {
  await page.waitForURL(/abertura\?step=4/, { timeout: 10000 });
  await page.getByText('Dados da Sociedade').waitFor({ state: 'visible', timeout: 5000 });

  // Capital Social
  const capitalInput = page.getByPlaceholder('R$');
  if (await capitalInput.isVisible()) {
    await capitalInput.fill('10000');
  }

  // As quotas já são preenchidas automaticamente (50/50)
  // Administração — "isoladamente" é o padrão

  // Banco
  await page.getByPlaceholder('Ex: Itaú').fill('Banco do Brasil');
}

/** Preenche o Passo 5 — Envio de Documentos */
export async function preencherPasso5(page: Page): Promise<void> {
  await page.waitForURL(/abertura\?step=5/, { timeout: 10000 });
  await page.getByText('Envio de Documentos').waitFor({ state: 'visible', timeout: 5000 });

  // Upload de arquivo — o componente UploadField usa input[type=file]
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible()) {
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'documento-teste.pdf'));
    // Aguarda o upload (simula envio para S3 via presigned URL)
    await page.waitForTimeout(3000);
  }
}

/** Preenche o Passo 6 — Revisão e Envio (Ltda) */
export async function preencherPasso6ESubmeter(page: Page): Promise<void> {
  await page.waitForURL(/abertura\?step=6/, { timeout: 10000 });

  // Checkbox de aceite dos termos
  const checkbox = page.getByRole('checkbox');
  await checkbox.check();

  // Clica em "Concluir e Enviar"
  await page.getByRole('button', { name: /Concluir e Enviar/ }).click();
}

/** Verifica tela de confirmação pós-submissão */
export async function verificarConfirmacao(page: Page): Promise<string> {
  await page.waitForURL(/abertura\/confirmacao/, { timeout: 30000 });
  await page.getByText('Solicitação enviada!').waitFor({ state: 'visible', timeout: 10000 });
  const protocolo = await page.locator('text=Protocolo').locator('..').locator('p').last().textContent();
  return protocolo ?? '';
}