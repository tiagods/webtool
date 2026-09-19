import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import UploadField from '@/components/UploadField';
import { server } from '@/mocks/server';

type ProgressEvent = { lengthComputable: boolean; loaded: number; total: number };

class FakeXHR {
  static instances: FakeXHR[] = [];

  static get last() {
    return FakeXHR.instances[FakeXHR.instances.length - 1];
  }

  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();

  constructor() {
    FakeXHR.instances.push(this);
  }
}

function pegarInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function selecionarArquivo(container: HTMLElement, file: File) {
  fireEvent.change(pegarInput(container), { target: { files: [file] } });
}

describe('UploadField', () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renderiza o estado inicial com label, dica e badge de opcional', () => {
    render(
      <UploadField chave="doc" label="Documento" hint="PDF até 10MB" obrigatorio={false} onChange={vi.fn()} />
    );

    expect(screen.getByText('Documento')).toBeInTheDocument();
    expect(screen.getByText('PDF até 10MB')).toBeInTheDocument();
    expect(screen.getByText('Opcional')).toBeInTheDocument();
  });

  it('rejeita tipo de arquivo não suportado', async () => {
    const { container } = render(<UploadField chave="doc" label="Documento" onChange={vi.fn()} />);

    selecionarArquivo(container, new File(['x'], 'a.txt', { type: 'text/plain' }));

    expect(await screen.findByText('Tipo não suportado. Use PDF, JPG ou PNG.')).toBeInTheDocument();
  });

  it('rejeita arquivo acima de 10MB', async () => {
    const { container } = render(<UploadField chave="doc" label="Documento" onChange={vi.fn()} />);
    const grande = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 10 * 1024 * 1024 + 1 });

    selecionarArquivo(container, grande);

    expect(await screen.findByText('Arquivo muito grande. Máximo: 10MB.')).toBeInTheDocument();
  });

  it('faz o upload: progresso, PUT concluído e aviso ao pai', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <UploadField chave="doc_cpf" label="CPF" onChange={onChange} />
    );

    selecionarArquivo(container, new File(['x'], 'cpf.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(FakeXHR.last).toBeDefined());
    expect(FakeXHR.last.open).toHaveBeenCalledWith('PUT', 'https://s3.test/presigned');

    act(() => {
      FakeXHR.last.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    });
    expect(screen.getByText('50%')).toBeInTheDocument();

    act(() => {
      FakeXHR.last.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    });
    expect(screen.getByText('50%')).toBeInTheDocument();

    act(() => {
      FakeXHR.last.status = 200;
      FakeXHR.last.onload?.();
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('doc_cpf'));
    expect(screen.getByText('Enviado ✓')).toBeInTheDocument();
    expect(screen.getByText('cpf.pdf')).toBeInTheDocument();
  });

  it('mostra erro quando o PUT responde com status inválido', async () => {
    const onChange = vi.fn();
    const { container } = render(<UploadField chave="doc" label="Doc" onChange={onChange} />);

    selecionarArquivo(container, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(FakeXHR.last).toBeDefined());

    act(() => {
      FakeXHR.last.status = 500;
      FakeXHR.last.onload?.();
    });

    expect(await screen.findByText('Upload falhou: status 500')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('mostra erro de rede quando o PUT dispara onerror', async () => {
    const { container } = render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);

    selecionarArquivo(container, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(FakeXHR.last).toBeDefined());

    act(() => {
      FakeXHR.last.onerror?.();
    });

    expect(await screen.findByText('Erro de rede durante upload')).toBeInTheDocument();
  });

  it('mostra o erro devolvido por /api/upload-url', async () => {
    server.use(
      http.post('/api/upload-url', () => HttpResponse.json({ error: 'Campo inválido' }, { status: 400 }))
    );
    const { container } = render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);

    selecionarArquivo(container, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('Campo inválido')).toBeInTheDocument();
  });

  it('usa mensagem padrão quando /api/upload-url falha sem detalhe', async () => {
    server.use(http.post('/api/upload-url', () => HttpResponse.json({}, { status: 400 })));
    const { container } = render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);

    selecionarArquivo(container, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('Erro ao obter URL de upload')).toBeInTheDocument();
  });

  it('usa mensagem genérica quando o erro não é um Error', async () => {
    const { container } = render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('falha inesperada');

    selecionarArquivo(container, new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('Erro desconhecido')).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('começa no estado enviado quando recebe s3Key e permite remover', async () => {
    const onChange = vi.fn();
    render(<UploadField chave="doc" label="Doc" s3Key="s3-key" onChange={onChange} />);

    expect(screen.getByText('Enviado ✓')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remover arquivo' }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByText('Enviado ✓')).not.toBeInTheDocument();
    expect(screen.getByText('Selecionar')).toBeInTheDocument();
  });

  it('volta ao estado inicial no botão Tentar novamente', async () => {
    const { container } = render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);

    selecionarArquivo(container, new File(['x'], 'a.txt', { type: 'text/plain' }));
    await screen.findByText('Tipo não suportado. Use PDF, JPG ou PNG.');

    await userEvent.click(screen.getByText('Tentar novamente'));

    expect(screen.queryByText('Tipo não suportado. Use PDF, JPG ou PNG.')).not.toBeInTheDocument();
    expect(screen.getByText('Selecionar')).toBeInTheDocument();
  });

  it('reage a dragover/dragleave e envia o arquivo solto', async () => {
    render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);
    const dropzone = screen.getByRole('button');

    fireEvent.dragOver(dropzone);
    expect(screen.getByText('Solte aqui')).toBeInTheDocument();

    fireEvent.dragLeave(dropzone);
    expect(screen.queryByText('Solte aqui')).not.toBeInTheDocument();

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(FakeXHR.last).toBeDefined());
    expect(screen.queryByText('Solte aqui')).not.toBeInTheDocument();

    act(() => {
      FakeXHR.last.status = 200;
      FakeXHR.last.onload?.();
    });

    expect(await screen.findByText('Enviado ✓')).toBeInTheDocument();
  });

  it('mantém idle ao sair do dropzone sem estar em dragover', () => {
    render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);

    fireEvent.dragLeave(screen.getByRole('button'));

    expect(screen.getByText('Selecionar')).toBeInTheDocument();
  });

  it('abre o seletor de arquivo ao clicar e ao pressionar Enter/Espaço', () => {
    render(<UploadField chave="doc" label="Doc" onChange={vi.fn()} />);
    const dropzone = screen.getByRole('button');
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(dropzone);
    fireEvent.keyDown(dropzone, { key: 'Enter' });
    fireEvent.keyDown(dropzone, { key: ' ' });

    expect(clickSpy).toHaveBeenCalledTimes(3);
    clickSpy.mockRestore();
  });
});