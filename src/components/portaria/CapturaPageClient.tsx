'use client';

import { useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoCapture } from '@/components/portaria/PhotoCapture';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';
import {
  capturaReducer,
  initialCapturaState,
  isCodigoValid,
} from '@/components/portaria/captura-page-reducer';

/**
 * `<CapturaPageClient>` — tela final de chegada de pacote (story 3.6).
 *
 * Compõe PhotoCapture (3.2) + BarcodeScannerInput (3.3) + POST /api/pacotes (3.4).
 * Após sucesso, redireciona para /chegada/confirmar/{pacote_id} (3.8).
 *
 * State machine via useReducer — ver `captura-page-reducer.ts` para regras.
 */
export function CapturaPageClient() {
  const router = useRouter();
  const [state, dispatch] = useReducer(capturaReducer, initialCapturaState);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const codigoInvalido = !isCodigoValid(state.codigo);
  const isSubmitting = state.kind === 'submitting';

  async function handleSubmit() {
    if (state.kind !== 'photo_taken' && state.kind !== 'error') return;
    if (codigoInvalido) return;

    const photo = state.photo;
    const codigo = state.codigo.trim();

    dispatch({ type: 'submit_started' });

    try {
      const formData = new FormData();
      formData.set('file', photo.blob, 'foto.jpg');
      if (codigo) formData.set('codigo_rastreio', codigo);

      const res = await fetch('/api/pacotes', { method: 'POST', body: formData });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pacote_id?: string;
        message?: string;
      };

      if (!res.ok || !body.pacote_id) {
        throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      }

      // Vibração táctil em sucesso (mobile only)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }

      router.push(`/chegada/confirmar/${body.pacote_id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha no envio';
      dispatch({ type: 'submit_failed', message });
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden>
          <Package className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nova chegada</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Tire a foto da etiqueta. O bipe é opcional.
          </p>
        </div>
      </header>

      {cameraError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{cameraError}</span>
        </div>
      )}

      <PhotoCapture
        onCapture={(blob, dataUrl) => {
          setCameraError(null);
          dispatch({
            type: 'photo_captured',
            photo: { blob, dataUrl, sizeKb: Math.round(blob.size / 1024) },
          });
        }}
        onError={(msg) => setCameraError(msg)}
        disabled={isSubmitting}
        debugDownload={process.env.NODE_ENV !== 'production'}
      />

      <div className="space-y-2">
        <label
          htmlFor="codigo-rastreio"
          className="text-sm font-medium text-foreground"
        >
          Código de rastreio (opcional)
        </label>
        <BarcodeScannerInput
          value={state.codigo}
          onChange={(codigo) => dispatch({ type: 'codigo_changed', codigo })}
          placeholder="Bipar ou digitar"
          disabled={isSubmitting}
        />
        {codigoInvalido && (
          <p className="text-xs text-danger" role="alert">
            Caracteres <code>&lt;</code> e <code>&gt;</code> não são permitidos (até 200 caracteres).
          </p>
        )}
      </div>

      {state.kind === 'photo_taken' || state.kind === 'submitting' || state.kind === 'error' ? (
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-text-secondary">
              Foto pronta · <strong>{state.photo.sizeKb} KB</strong>
            </div>
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'photo_cleared' })}
                className="text-xs text-primary underline disabled:opacity-50"
              >
                Tirar outra
              </button>
            )}
          </div>

          {state.kind === 'error' && (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
            >
              <p className="font-medium">Falha ao enviar</p>
              <p className="mt-0.5 text-xs">{state.message}</p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || codigoInvalido}
            aria-busy={isSubmitting}
            className="h-12 w-full text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : state.kind === 'error' ? (
              'Tentar novamente'
            ) : (
              'Registrar pacote'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

