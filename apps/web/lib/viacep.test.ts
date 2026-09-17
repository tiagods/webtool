import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useViaCEP } from '@/lib/viacep';
import { server } from '@/mocks/server';

describe('useViaCEP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fica idle enquanto o CEP não tem 8 dígitos', () => {
    const { result } = renderHook(() => useViaCEP('01310'));

    expect(result.current).toEqual({ data: null, status: 'idle', error: null });
  });

  it('busca o endereço 500ms depois e retorna sucesso', async () => {
    const { result } = renderHook(() => useViaCEP('01310-100'));
    expect(result.current.status).toBe('idle');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.status).toBe('loading');

    await act(async () => {
      await vi.waitFor(() => expect(result.current.status).toBe('success'));
    });
    expect(result.current.data).toEqual({
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });
    expect(result.current.error).toBeNull();
  });

  it('retorna erro quando o ViaCEP responde { erro: true }', async () => {
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.json({ erro: true }))
    );

    const { result } = renderHook(() => useViaCEP('99999-999'));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await vi.waitFor(() => expect(result.current.status).toBe('error'));
    });
    expect(result.current.error).toBe('CEP não encontrado.');
    expect(result.current.data).toBeNull();
  });

  it('retorna erro de conexão quando a requisição falha', async () => {
    server.use(http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.error()));

    const { result } = renderHook(() => useViaCEP('01310-100'));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await vi.waitFor(() => expect(result.current.status).toBe('error'));
    });
    expect(result.current.error).toBe('Erro ao buscar o CEP. Verifique sua conexão.');
  });

  it('volta para idle ao trocar para um CEP inválido e cancela o timer anterior', async () => {
    const { result, rerender } = renderHook(({ cep }) => useViaCEP(cep), {
      initialProps: { cep: '01310-100' },
    });

    rerender({ cep: '123' });

    expect(result.current).toEqual({ data: null, status: 'idle', error: null });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('idle');
  });
});