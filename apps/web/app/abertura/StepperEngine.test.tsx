import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.params,
}));

import StepperEngine from '@/app/abertura/StepperEngine';
import { devSeed } from '@/app/abertura/devSeed';

function renderEngine(step: string) {
  nav.params = new URLSearchParams(step ? `step=${step}` : '');
  return render(<StepperEngine />);
}

async function preencherPasso1() {
  await userEvent.type(
    screen.getByPlaceholderText('Ex: João da Silva Serviços Ltda'),
    'Alpha Serviços Ltda'
  );
  await userEvent.type(
    screen.getByPlaceholderText('Ex: Silva & Associados Serviços Ltda'),
    'Beta Serviços Ltda'
  );
  await userEvent.type(
    screen.getByPlaceholderText('Ex: JS Consultoria e Serviços Ltda'),
    'Gama Serviços Ltda'
  );
  await userEvent.type(
    screen.getByPlaceholderText('Descreva a atividade com o máximo de detalhes...'),
    'Prestação de serviços de consultoria empresarial'
  );
}

describe('StepperEngine (abertura)', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.push.mockClear();
  });

  it('redireciona para o passo 1 quando o passo é inválido', async () => {
    renderEngine('99');

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('?step=1'));
  });

  it('renderiza o fluxo Ltda com o passo Sociedade no Stepper', () => {
    renderEngine('1');

    expect(screen.getByText('Tipo de Constituição')).toBeInTheDocument();
    expect(screen.getByText('Sociedade')).toBeInTheDocument();
  });

  it('bloqueia o avanço quando o passo 1 está inválido', async () => {
    renderEngine('1');

    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    expect(await screen.findByText('Informe a 1ª opção (mín. 3 caracteres)')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('salva o rascunho e avança quando o passo 1 é válido', async () => {
    const salvar = vi.fn();
    server.use(
      http.post('/api/draft', () => {
        salvar();
        return HttpResponse.json({ ok: true });
      })
    );
    renderEngine('1');

    await preencherPasso1();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=2'));
    expect(salvar).toHaveBeenCalled();
  });

  it('avisa e não avança quando o rascunho falha', async () => {
    server.use(http.post('/api/draft', () => new HttpResponse(null, { status: 500 })));
    renderEngine('1');

    await preencherPasso1();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    expect(
      await screen.findByText('Não foi possível salvar seu progresso. Tente novamente.')
    ).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('restaura um rascunho salvo no mount', async () => {
    server.use(
      http.get('/api/draft', () =>
        HttpResponse.json({
          payload: { dadosEmpresa: { nomeEmpresarial1: 'Restaurada Serviços Ltda' } },
        })
      )
    );
    renderEngine('1');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Restaurada Serviços Ltda')).toBeInTheDocument()
    );
  });

  it('usa o fluxo SLU (5 passos, sem Sociedade)', async () => {
    const { rerender } = renderEngine('1');

    await userEvent.click(screen.getByText('Sociedade Unipessoal'));
    expect(screen.queryByText('Sociedade')).not.toBeInTheDocument();

    nav.params = new URLSearchParams('step=4');
    rerender(<StepperEngine />);

    expect(screen.getByText('Envio de Documentos')).toBeInTheDocument();
  });

  it('volta um passo ao clicar em Voltar', async () => {
    renderEngine('3');

    await userEvent.click(screen.getByRole('button', { name: /Voltar/ }));

    expect(nav.push).toHaveBeenCalledWith('?step=2');
  });

  it('envia o formulário na última etapa e redireciona para a confirmação', async () => {
    const enviar = vi.fn();
    server.use(
      http.post('/api/submit', () => {
        enviar();
        return HttpResponse.json({ protocolo: 'PROT-2026-0001' });
      })
    );
    renderEngine('6');

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        '/abertura/confirmacao?protocolo=PROT-2026-0001'
      )
    );
    expect(enviar).toHaveBeenCalled();
  });

  it('não redireciona quando o submit falha', async () => {
    server.use(http.post('/api/submit', () => new HttpResponse(null, { status: 500 })));
    renderEngine('6');

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Concluir e Enviar/ })).toBeInTheDocument()
    );
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('trata erro de rede no submit', async () => {
    renderEngine('6');
    await screen.findByRole('checkbox');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(nav.push).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('redireciona para o passo 1 quando não há passo na URL', async () => {
    renderEngine('');

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('?step=1'));
  });

  it('não restaura quando a resposta do rascunho não é ok', async () => {
    server.use(http.get('/api/draft', () => new HttpResponse(null, { status: 500 })));
    renderEngine('1');

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ex: João da Silva Serviços Ltda')).toHaveValue('')
    );
  });

  it('não restaura quando o payload do rascunho está vazio', async () => {
    server.use(http.get('/api/draft', () => HttpResponse.json({ payload: {} })));
    renderEngine('1');

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ex: João da Silva Serviços Ltda')).toHaveValue('')
    );
  });

  it('trata erro de rede ao restaurar o rascunho', async () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    renderEngine('1');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    fetchSpy.mockRestore();
    erroConsole.mockRestore();
  });

  it('percorre os passos 2 a 5 do fluxo Ltda', async () => {
    server.use(http.get('/api/draft', () => HttpResponse.json({ payload: devSeed })));
    const { rerender } = renderEngine('2');
    const irPara = (step: string) => {
      nav.params = new URLSearchParams(`step=${step}`);
      rerender(<StepperEngine />);
    };

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ex: Rua Direita')).toHaveValue('Avenida Paulista')
    );
    expect(screen.getByText('Endereço da Sede')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=3'));

    irPara('3');
    expect(screen.getByText('Dados dos Sócios')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=4'));

    irPara('4');
    expect(screen.getByText('Dados da Sociedade')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=5'));

    irPara('5');
    expect(screen.getByText('Envio de Documentos')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=6'));
  });

  it('percorre o fluxo SLU até o envio e usa a view padrão fora do range', async () => {
    server.use(http.get('/api/draft', () => HttpResponse.json({ payload: devSeed })));
    const { rerender } = renderEngine('1');
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ex: João da Silva Serviços Ltda')).toHaveValue(
        'Alfa Servicos Ltda'
      )
    );
    await userEvent.click(screen.getByText('Sociedade Unipessoal'));

    const irPara = (step: string) => {
      nav.params = new URLSearchParams(`step=${step}`);
      rerender(<StepperEngine />);
    };

    irPara('2');
    expect(screen.getByText('Endereço da Sede')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=3'));

    irPara('3');
    expect(screen.getByText('Dados dos Sócios')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=4'));

    irPara('4');
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=5'));

    irPara('5');
    expect(screen.getByText('Revisão Final')).toBeInTheDocument();
    nav.push.mockClear();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith('/abertura/confirmacao?protocolo=PROT-2026-0001')
    );

    irPara('7');
    expect(screen.getByText('Tipo de Constituição')).toBeInTheDocument();
  });

  it('submete a partir de um passo fora do range (caso default)', async () => {
    renderEngine('99');

    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith('/abertura/confirmacao?protocolo=PROT-2026-0001')
    );
  });
});