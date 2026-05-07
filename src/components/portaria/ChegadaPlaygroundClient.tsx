'use client';

import { useState } from 'react';
import { PhotoCapture } from '@/components/portaria/PhotoCapture';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';
import { Button } from '@/components/ui/button';

/**
 * Playground temporário da story 3.2 — exercita PhotoCapture em browser real.
 *
 * Mostra a foto capturada inline + tamanho do Blob para validação manual.
 * Será substituído pela tela de chegada completa na story 3.6.
 */
export function ChegadaPlaygroundClient() {
  const [captured, setCaptured] = useState<{
    blob: Blob;
    dataUrl: string;
    sizeKb: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    pacote_id: string;
    foto_storage_path: string;
  } | null>(null);

  async function handleSubmit() {
    if (!captured) return;
    setSubmitting(true);
    setError(null);
    setSubmitResult(null);
    try {
      const formData = new FormData();
      formData.set('file', captured.blob, 'foto.jpg');
      if (codigo.trim()) formData.set('codigo_rastreio', codigo.trim());

      const res = await fetch('/api/pacotes', { method: 'POST', body: formData });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pacote_id?: string;
        foto_storage_path?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      if (!body.pacote_id || !body.foto_storage_path) {
        throw new Error('Resposta inesperada da API');
      }
      setSubmitResult({
        pacote_id: body.pacote_id,
        foto_storage_path: body.foto_storage_path,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no envio');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nova chegada</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Tire uma foto da etiqueta para começar. (Story 3.2 — playground; o
          formulário completo entra na story 3.6.)
        </p>
      </div>

      <PhotoCapture
        onCapture={(blob, dataUrl) => {
          setError(null);
          setCaptured({
            blob,
            dataUrl,
            sizeKb: Math.round(blob.size / 1024),
          });
        }}
        onError={(msg) => setError(msg)}
        debugDownload={process.env.NODE_ENV !== 'production'}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium">Código de barras (opcional)</label>
        <BarcodeScannerInput
          value={codigo}
          onChange={setCodigo}
          placeholder="Bipar ou digitar manualmente"
        />
        {codigo && (
          <p className="text-xs text-text-secondary">
            Código atual: <code className="rounded bg-muted px-1 py-0.5">{codigo}</code>
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {captured && (
        <div className="space-y-2 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">Foto confirmada</p>
          <p className="text-xs text-text-secondary">
            Tamanho: <strong>{captured.sizeKb} KB</strong> · Tipo:{' '}
            <strong>{captured.blob.type}</strong>
          </p>
          <p className="text-xs text-text-secondary">
            Próximo passo (story 3.4): upload via{' '}
            <code className="rounded bg-muted px-1 py-0.5">POST /api/pacotes</code> com a foto.
          </p>
          <button
            type="button"
            onClick={() => {
              setCaptured(null);
              setSubmitResult(null);
            }}
            className="text-xs text-primary underline"
          >
            Limpar e tirar outra
          </button>

          {!submitResult && (
            <div className="pt-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? 'Enviando...' : 'Enviar para API (POST /api/pacotes)'}
              </Button>
            </div>
          )}

          {submitResult && (
            <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">✅ Pacote criado em rascunho</p>
              <p className="mt-1 text-xs text-text-secondary">
                <code className="break-all">pacote_id: {submitResult.pacote_id}</code>
              </p>
              <p className="text-xs text-text-secondary">
                <code className="break-all">foto: {submitResult.foto_storage_path}</code>
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                Job <code>extractLabel</code> enfileirado. Worker IA roda na story 3.5.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
