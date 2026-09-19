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

import StepperEngine from '@/app/alteracao/StepperEngine';

function renderEngine(step: string) {
  nav.params = new URLSearchParams(step ? `step=${step}` : '');
  return render(<StepperEngine />);
}

describe('StepperEngine (alteração)', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.push.mockClear();
  });

  it('redireciona para o passo 1 quando o passo é inválido ou ausente', async () => {
    renderEngine('9');

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('?step=1'));
  });

  it('renderiza o passo de identificação', () => {
    renderEngine('1');

    expect(screen.getByText('Identificação da Empresa')).toBeInTheDocument();
  });

  it('bloqueia o avanço com identificação inválida', async () => {
    renderEngine('1');

    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    expect(await screen.findByText('CNPJ inválido')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('bloqueia o passo 2 sem quadro selecionado', async () => {
    renderEngine('2');

    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    expect(await screen.findByText('Selecione pelo menos um quadro')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('seleciona um quadro, salva o rascunho e avança', async () => {
    const salvar = vi.fn();
    server.use(
      http.post('/api/alteracao/draft', () => {
        salvar();
        return HttpResponse.json({ ok: true });
      })
    );
    renderEngine('2');

    await userEvent.click(screen.getByText('Outras Alterações'));
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=3'));
    expect(salvar).toHaveBeenCalled();
  });

  it('avisa e não avança quando o rascunho falha', async () => {
    server.use(http.post('/api/alteracao/draft', () => new HttpResponse(null, { status: 500 })));
    renderEngine('2');

    await userEvent.click(screen.getByText('Outras Alterações'));
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    expect(
      await screen.findByText('Não foi possível salvar seu progresso. Tente novamente.')
    ).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('valida os quadros selecionados no passo 3 e avança', async () => {
    const { rerender } = renderEngine('2');

    await userEvent.click(screen.getByText('Outras Alterações'));

    nav.params = new URLSearchParams('step=3');
    rerender(<StepperEngine />);

    await userEvent.type(
      screen.getByPlaceholderText('Descreva a alteração desejada...'),
      'Alteração de cláusula contratual'
    );
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=4'));
  });

  it('avança do passo 3 sem quadros selecionados', async () => {
    renderEngine('3');

    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('?step=4'));
  });

  it('volta um passo', async () => {
    renderEngine('3');

    await userEvent.click(screen.getByRole('button', { name: /Voltar/ }));

    expect(nav.push).toHaveBeenCalledWith('?step=2');
  });

  it('restaura um rascunho salvo no mount', async () => {
    server.use(
      http.get('/api/alteracao/draft', () =>
        HttpResponse.json({
          payload: { identificacao: { razaoSocial: 'Restaurada Ltda' } },
        })
      )
    );
    renderEngine('1');

    await waitFor(() =>
      expect(screen.getByDisplayValue('Restaurada Ltda')).toBeInTheDocument()
    );
  });

  it('envia o formulário na última etapa', async () => {
    const enviar = vi.fn();
    server.use(
      http.post('/api/alteracao/submit', () => {
        enviar();
        return HttpResponse.json({ protocolo: 'ALT-2026-0001' });
      })
    );
    renderEngine('4');

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        '/alteracao/confirmacao?protocolo=ALT-2026-0001'
      )
    );
    expect(enviar).toHaveBeenCalled();
  });

  it('não redireciona quando o submit falha', async () => {
    server.use(http.post('/api/alteracao/submit', () => new HttpResponse(null, { status: 500 })));
    renderEngine('4');

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Concluir e Enviar/ })).toBeInTheDocument()
    );
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('usa a view padrão fora do range', () => {
    renderEngine('9');

    expect(screen.getByText('Identificação da Empresa')).toBeInTheDocument();
  });

  it('redireciona quando não há passo na URL', async () => {
    renderEngine('');

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('?step=1'));
  });

  it('não restaura quando a resposta do rascunho não é ok', async () => {
    server.use(
      http.get('/api/alteracao/draft', () => new HttpResponse(null, { status: 500 }))
    );
    renderEngine('1');

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Razão social atual')).toHaveValue('')
    );
  });

  it('não restaura quando o payload do rascunho está vazio', async () => {
    server.use(http.get('/api/alteracao/draft', () => HttpResponse.json({ payload: {} })));
    renderEngine('1');

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Razão social atual')).toHaveValue('')
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

  it('trata rascunho com quadros nulos como lista vazia', async () => {
    server.use(
      http.get('/api/alteracao/draft', () =>
        HttpResponse.json({
          payload: { identificacao: { razaoSocial: 'Zeta Ltda' }, quadros: null },
        })
      )
    );
    renderEngine('1');

    await waitFor(() => expect(screen.getByDisplayValue('Zeta Ltda')).toBeInTheDocument());
  });

  it('submete a partir de um passo fora do range (caso default)', async () => {
    renderEngine('9');

    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        '/alteracao/confirmacao?protocolo=ALT-2026-0001'
      )
    );
  });

  it('trata erro de rede no submit', async () => {
    renderEngine('4');
    await screen.findByRole('checkbox');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Concluir e Enviar/ }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(nav.push).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});