'use client';

import React, { useRef, useState, useCallback, DragEvent } from 'react';
import { Upload, CheckSquare, X, AlertCircle, Loader2, File } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type UploadState = 'idle' | 'dragover' | 'uploading' | 'uploaded' | 'error';

interface UploadFieldProps {
  chave: string;
  label: string;
  hint?: string;
  obrigatorio?: boolean;
  s3Key?: string;
  onChange: (s3Key: string | null) => void;
}

export default function UploadField({
  chave,
  label,
  hint,
  obrigatorio = true,
  s3Key,
  onChange,
}: UploadFieldProps) {
  const [state, setState] = useState<UploadState>(s3Key ? 'uploaded' : 'idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setErrorMsg(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMsg('Tipo não suportado. Use PDF, JPG ou PNG.');
      setState('error');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg('Arquivo muito grande. Máximo: 10MB.');
      setState('error');
      return;
    }

    setFileName(file.name);
    setState('uploading');
    setProgress(0);

    try {
      // 1. Obter presigned URL (servidor valida campo e sessão)
      const res = await fetch('/api/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ campo: chave, contentType: file.type }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Erro ao obter URL de upload');
      }
      const { url } = await res.json() as { url: string };

      // 2. PUT direto no S3 via presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload falhou: status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Erro de rede durante upload'));
        xhr.send(file);
      });

      setState('uploaded');
      // Sinaliza com o próprio chave — a key S3 é persistida server-side (Spec 008)
      onChange(chave);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido');
      setState('error');
    }
  }, [chave, onChange]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setState('dragover'); };
  const onDragLeave = () => { setState((s) => s === 'dragover' ? 'idle' : s); };
  const onPickFile = () => fileRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    setState('idle');
    setFileName(null);
    setProgress(0);
    setErrorMsg(null);
    onChange(null);
  };

  // === Uploaded state ===
  if (state === 'uploaded') {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#dcfce7] flex-shrink-0">
          <CheckSquare className="w-5 h-5 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-success">{label}</p>
          {fileName && <p className="text-xs text-success/70 mt-0.5 truncate">{fileName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-white bg-success rounded-lg px-3 py-1.5">
            Enviado ✓
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="text-muted hover:text-error transition-colors p-1"
            aria-label="Remover arquivo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // === Uploading state ===
  if (state === 'uploading') {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent/10 flex-shrink-0">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">{label}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-muted">{progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  // === Error state ===
  if (state === 'error') {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-error/30 bg-error/5 px-4 py-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-error/10 flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-error" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-error">{label}</p>
          {errorMsg && <p className="text-xs text-error/70 mt-0.5">{errorMsg}</p>}
        </div>
        <button
          type="button"
          onClick={() => { setState('idle'); setErrorMsg(null); }}
          className="text-xs font-medium text-error border border-error/30 rounded-lg px-3 py-1.5 hover:bg-error/10 transition-colors flex-shrink-0"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // === Idle / Dragover state ===
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={onFileChange}
      />
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onPickFile}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPickFile(); }}
        className={cn(
          'flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-colors',
          state === 'dragover'
            ? 'border-accent bg-accent/5 border-dashed'
            : 'border-border bg-white hover:border-accent/40'
        )}
      >
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
          state === 'dragover' ? 'bg-accent/10' : 'bg-surface'
        )}>
          {state === 'dragover'
            ? <Upload className="w-5 h-5 text-accent" />
            : <File className="w-5 h-5 text-muted" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">
            {label}
            {!obrigatorio && (
              <span className="ml-1.5 text-[11px] font-normal text-muted bg-border/60 rounded px-1.5 py-0.5">
                Opcional
              </span>
            )}
          </p>
          {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
        </div>
        <div className="flex-shrink-0">
          {state === 'dragover' ? (
            <span className="text-xs font-medium text-accent">Solte aqui</span>
          ) : (
            <span className="text-xs font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Selecionar
            </span>
          )}
        </div>
      </div>
    </>
  );
}
