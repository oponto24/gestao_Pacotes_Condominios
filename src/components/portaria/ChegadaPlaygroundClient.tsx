'use client';

import { useState } from 'react';
import { PhotoCapture } from '@/components/portaria/PhotoCapture';

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
            onClick={() => setCaptured(null)}
            className="text-xs text-primary underline"
          >
            Limpar e tirar outra
          </button>
        </div>
      )}
    </div>
  );
}
