import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import TermoCienciaModal from '@/components/TermoCienciaModal';

function habilitarCheckbox() {
  act(() => {
    vi.advanceTimersByTime(3000);
  });
}

describe('TermoCienciaModal', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa com o checkbox desabilitado e libera após 3 segundos', () => {
    render(<TermoCienciaModal />);

    expect(screen.getByRole('checkbox')).toBeDisabled();

    habilitarCheckbox();

    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('registra o aceite e atualiza a página', async () => {
    render(<TermoCienciaModal />);
    habilitarCheckbox();
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Li e estou ciente' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('mostra erro quando o aceite falha', async () => {
    server.use(http.post('/api/aceite-termo', () => new HttpResponse(null, { status: 500 })));
    render(<TermoCienciaModal />);
    habilitarCheckbox();
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Li e estou ciente' }));

    expect(
      await screen.findByText('Não foi possível registrar seu aceite. Tente novamente.')
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('não fecha com Escape nem com clique fora do modal', async () => {
    vi.useRealTimers();
    render(<TermoCienciaModal />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(document.body);

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('alterna para a tela de recusa e volta', async () => {
    vi.useRealTimers();
    render(<TermoCienciaModal />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Recusar' }));

    expect(screen.getByText('Não é possível continuar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revisar e aceitar' }));

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});