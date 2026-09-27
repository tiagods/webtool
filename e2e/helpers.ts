import { Page } from '@playwright/test';
import path from 'path';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function aceitarLgpd(page: Page): Promise<void> {
  const checkbox = page.getByRole('checkbox');
  await checkbox.waitFor({ state: 'visible', timeout: 15000 });
  // Aguarda o botão de aceite ficar interativo antes de clicar no checkbox
  await page.getByRole('button', { name: /Li e estou ciente/ }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
  await checkbox.check();

  // Clica em "Li e estou ciente" e espera a resposta da API
  const respPromise = page.waitForResponse(r => r.url().includes('/api/aceite-termo') && r.status() === 200, { timeout: 15000 });
  await page.getByRole('button', { name: /Li e estou ciente/ }).click();
  await respPromise;

  // Aguarda o StepperEngine montar e criar a sessao.
  // Mock do POST /api/draft: o Go valida todas as secoes do form
  // mesmo em modo draft, e defaults como socioVazio e capitalSocial
  // vazios causariam 400. Mockamos para o teste focar no fluxo
  // de navegacao e submit, nao na validacao incremental de draft.
  const sessionPromise = page.waitForResponse(r => r.url().includes('/api/session') && r.status() === 200, { timeout: 15000 });
  await page.route('**/api/draft', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    } else {
      await route.continue();
    }
  });

  await page.reload();
  await sessionPromise;
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

  // CEP (IMask) — dispara ViaCEP
  await page.getByPlaceholder('00000-000').fill('01310-100');
  await page.waitForTimeout(2500);

  // ViaCEP pode ja ter preenchido Logradouro/Bairro (disabled)
  // Usamos force:true para sobrescrever se necessario
  const forcar = { force: true };
  await page.getByPlaceholder(/Rua/).fill('Avenida Paulista', forcar);
  await page.getByPlaceholder('S/N').first().fill('1000', forcar);
  await page.getByPlaceholder('Obrigatório').first().fill('123456789', forcar);
  await page.getByPlaceholder('Bairro').fill('Bela Vista', forcar);

  // Cidade e UF (ViaCEP pode ja ter preenchido)
  await page.getByPlaceholder('Cidade').fill('Sao Paulo', forcar);
  await page.getByPlaceholder('SP').fill('SP', forcar);

  await page.waitForTimeout(300);
}

export async function preencherPasso3(page: Page, suffix: string): Promise<void> {
  await page.waitForURL(/\?step=3/, { timeout: 15000 });
  await page.getByText(/S.cios/).first().waitFor({ state: 'visible', timeout: 5000 });

  // Socio 1 — preenche campos + setValue via window para IMaskInput
  await page.getByRole('textbox', { name: /^Nome/ }).first().fill(`Joao Silva ${suffix}`);
  await page.getByRole('textbox', { name: /Profiss/ }).fill('Engenheiro');
  await page.getByRole('textbox', { name: /mail/ }).fill(`joao${suffix}@teste.com`);
  await page.getByText('Solteiro').first().click();

  // Garante valores via React Hook Form setValue (IMaskInput)
  await page.evaluate(() => {
    const sv = (window as unknown as { __prolink_setValue?: (name: string, value: unknown) => void }).__prolink_setValue;
    if (sv) {
      sv('dadosSocios.socios.0.pis', '532.12345.67-8');
      sv('dadosSocios.socios.0.proLabore', 5000);
      sv('dadosSocios.socios.0.telefoneCelular', '(11) 91234-5678');
      sv('dadosSocios.socios.0.telefoneFixo', '');
    }
  });

  // Adiciona Socio 2
  await page.getByRole('button', { name: /Adicionar/ }).click();
  await page.waitForTimeout(500);
  await page.getByText('Sócio 2').click();
  await page.waitForTimeout(300);

  await page.getByRole('textbox', { name: /^Nome/ }).last().fill(`Maria Souza ${suffix}`);
  await page.getByRole('textbox', { name: /Profiss/ }).last().fill('Administradora');
  await page.getByRole('textbox', { name: /mail/ }).last().fill(`maria${suffix}@teste.com`);

  await page.evaluate(() => {
    const sv = (window as unknown as { __prolink_setValue?: (name: string, value: unknown) => void }).__prolink_setValue;
    if (sv) {
      sv('dadosSocios.socios.1.pis', '123.45678.90-1');
      sv('dadosSocios.socios.1.proLabore', 3000);
      sv('dadosSocios.socios.1.telefoneCelular', '(11) 99876-5432');
      sv('dadosSocios.socios.1.telefoneFixo', '');
    }
  });

  await page.waitForTimeout(300);
}

export async function preencherPasso4(page: Page): Promise<void> {
  await page.waitForURL(/\?step=4/, { timeout: 15000 });
  await page.getByText(/Dados da Sociedade/).first().waitFor({ state: 'visible', timeout: 5000 });

  // Capital social (IMask R$)
  await page.getByPlaceholder(/R\$/).fill('10000');
  // Banco
  await page.getByPlaceholder(/Ita/).fill('Banco do Brasil');

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
  await page.getByRole('heading', { name: /Solicita/ }).waitFor({ state: 'visible', timeout: 10000 });

  // Protocolo — localiza o número após "Protocolo"
  const protocoloLocator = page.locator('text=Protocolo').locator('..').locator('strong, span, p, div').last();
  const protocolo = await protocoloLocator.textContent({ timeout: 5000 });
  return protocolo ?? '';
}