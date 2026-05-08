'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoCapture } from '@/components/portaria/PhotoCapture';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';
import {
  capturaReducer,
  initialCapturaState,
  isCodigoValid,
  type CapturedPhoto,
} from '@/components/portaria/captura-page-reducer';

/**
 * `<CapturaPageClient>` — tela final de chegada de pacote (story 3.6).
 *
 * Fluxo simplificado (2026-05-08): porteiro tira foto → auto-submit imediato.
 * IA lê o código de rastreio da etiqueta — bipar é opcional (campo recolhido).
 *
 * State machine via useReducer — ver `captura-page-reducer.ts` para regras.
 */
export function CapturaPageClient() {
  const router = useRouter();
  const [state, dispatch] = useReducer(capturaReducer, initialCapturaState);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCodigoInput, setShowCodigoInput] = useState(false);

  const codigoInvalido = !isCodigoValid(state.codigo);
  const isSubmitting = state.kind === 'submitting';

  // Ref pra evitar duplo submit em strict mode dev (useEffect roda 2x)
  const submittedFor = useRef<Blob | null>(null);

  async function uploadPacote(photo: CapturedPhoto, codigo: string) {
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

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }

      router.push(`/chegada/confirmar/${body.pacote_id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha no envio';
      dispatch({ type: 'submit_failed', message });
    }
  }

  // Auto-submit: assim que o porteiro confirma a foto, sobe direto.
  // Sem step manual de "Registrar pacote" (UX 2026-05-08).
  useEffect(() => {
    if (state.kind !== 'photo_taken') return;
    if (codigoInvalido) return;
    if (submittedFor.current === state.photo.blob) return; // dedupe
    submittedFor.current = state.photo.blob;
    uploadPacote(state.photo, state.codigo.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  async function handleRetry() {
    if (state.kind !== 'error') return;
    submittedFor.current = null;
    await uploadPacote(state.photo, state.codigo.trim());
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
            Tire a foto da etiqueta — o código é lido pela IA automaticamente.
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

      {/* Bipar código — opcional, recolhido por padrão (IA extrai da foto) */}
      {!showCodigoInput ? (
        <button
          type="button"
          onClick={() => setShowCodigoInput(true)}
          disabled={isSubmitting}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-muted/40"
        >
          <span>Bipar código manualmente (opcional)</span>
          <ChevronDown className="size-4" aria-hidden />
        </button>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor="codigo-rastreio"
            className="text-sm font-medium text-foreground"
          >
            Código de rastreio (opcional — IA preenche da foto)
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
      )}

      {/* Status da foto + auto-upload feedback */}
      {(state.kind === 'photo_taken' ||
        state.kind === 'submitting' ||
        state.kind === 'error') && (
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                  <span>Enviando foto…</span>
                </>
              ) : state.kind === 'error' ? (
                <span className="text-danger">Falha no envio · {state.photo.sizeKb} KB</span>
              ) : (
                <span>Foto pronta · {state.photo.sizeKb} KB</span>
              )}
            </div>
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => {
                  submittedFor.current = null;
                  dispatch({ type: 'photo_cleared' });
                }}
                className="text-xs text-primary underline"
              >
                Tirar outra
              </button>
            )}
          </div>

          {state.kind === 'error' && (
            <>
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
              >
                <p className="font-medium">Falha ao enviar</p>
                <p className="mt-0.5 text-xs">{state.message}</p>
              </div>
              <Button
                onClick={handleRetry}
                disabled={isSubmitting || codigoInvalido}
                className="h-12 w-full text-base"
              >
                Tentar novamente
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

