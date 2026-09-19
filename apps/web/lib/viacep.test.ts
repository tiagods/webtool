import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { useViaCEP } from '@/lib/viacep';
import { server } from '@/mocks/server';

const VIACEP_URL = 'https://viacep.com.br/ws/:cep/json/';

describe('useViaCEP', () => {
  it('fica idle enquanto o CEP não tem 8 dígitos', () => {
    const { result } = renderHook(() => useViaCEP('01310'));

    expect(result.current).toEqual({ data: null, status: 'idle', error: null });
  });

  it('busca o endereço após o debounce e retorna sucesso', async () => {
    const { result } = renderHook(() => useViaCEP('01310-100'));

    expect(result.current.status).toBe('idle');

    await waitFor(() => expect(result.current.status).toBe('success'), { timeout: 3000 });
    expect(result.current.data).toEqual({
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });
    expect(result.current.error).toBeNull();
  });

  it('passa por loading enquanto a resposta do ViaCEP não chega', async () => {
    server.use(
      http.get(VIACEP_URL, async () => {
        await delay(150);
        return HttpResponse.json({ logradouro: 'Rua X', bairro: 'Centro', localidade: 'Rio', uf: 'RJ' });
      })
    );

    const { result } = renderHook(() => useViaCEP('20040-020'));

    await waitFor(() => expect(result.current.status).toBe('loading'), { timeout: 3000 });
    await waitFor(() => expect(result.current.status).toBe('success'), { timeout: 3000 });
  });

  it('usa strings vazias para os campos ausentes na resposta', async () => {
    server.use(http.get(VIACEP_URL, () => HttpResponse.json({})));

    const { result } = renderHook(() => useViaCEP('01310-100'));

    await waitFor(() => expect(result.current.status).toBe('success'), { timeout: 3000 });
    expect(result.current.data).toEqual({
      logradouro: '',
      bairro: '',
      localidade: '',
      uf: '',
    });
  });

  it('retorna erro quando o ViaCEP responde { erro: true }', async () => {
    server.use(http.get(VIACEP_URL, () => HttpResponse.json({ erro: true })));

    const { result } = renderHook(() => useViaCEP('99999-999'));

    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 3000 });
    expect(result.current.error).toBe('CEP não encontrado.');
    expect(result.current.data).toBeNull();
  });

  it('retorna erro de conexão quando a requisição falha', async () => {
    server.use(http.get(VIACEP_URL, () => HttpResponse.error()));

    const { result } = renderHook(() => useViaCEP('01310-100'));

    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 3000 });
    expect(result.current.error).toBe('Erro ao buscar o CEP. Verifique sua conexão.');
    expect(result.current.data).toBeNull();
  });

  it('volta para idle quando o CEP deixa de ter 8 dígitos, sem buscar', async () => {
    const { result, rerender } = renderHook(({ cep }) => useViaCEP(cep), {
      initialProps: { cep: '01310-100' },
    });

    rerender({ cep: '123' });

    expect(result.current).toEqual({ data: null, status: 'idle', error: null });

    await delay(700);
    expect(result.current.status).toBe('idle');
  });
});