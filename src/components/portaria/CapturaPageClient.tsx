'use client';

import { useCallback, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  AlertCircle,
  Camera,
  Aperture,
  Check,
  Loader2,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import {
  PhotoCapture,
  type PhotoCaptureHandle,
  type PhotoCaptureKind,
} from '@/components/portaria/PhotoCapture';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';
import {
  capturaReducer,
  initialCapturaState,
  isCodigoValid,
  type CapturedPhoto,
} from '@/components/portaria/captura-page-reducer';
import { useBottomNavOverride } from '@/components/portaria/BottomNavContext';

/**
 * `<CapturaPageClient>` — tela de chegada de pacote.
 *
 * **PR-3 redesign FAB Chegada:** o FAB do BottomNav é o único driver de ação.
 * Esta página registra `useBottomNavOverride` em cada estado da state machine:
 *
 *   PhotoCapture.idle/requesting/error → FAB "Abrir câmera" (idle-page)
 *   PhotoCapture.streaming             → FAB shutter (streaming)
 *   parent.kind === 'photo_taken'      → FAB "Usar foto" (captured)
 *   parent.kind === 'submitting'       → FAB spinner disabled (submitting)
 *   parent.kind === 'error'            → FAB "Tentar novamente" (idle-page)
 *
 * Auto-submit removido (PR-3): user confirma explicitamente pelo FAB verde.
 * Refazer foto agora é link textual acima do visor (mais descoberta).
 */
export function CapturaPageClient() {
  const router = useRouter();
  const [state, dispatch] = useReducer(capturaReducer, initialCapturaState);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCodigoInput, setShowCodigoInput] = useState(false);
  const [photoCaptureKind, setPhotoCaptureKind] =
    useState<PhotoCaptureKind>('idle');

  const photoRef = useRef<PhotoCaptureHandle | null>(null);

  const codigoInvalido = !isCodigoValid(state.codigo);
  const isSubmitting = state.kind === 'submitting';

  const uploadPacote = useCallback(
    async (photo: CapturedPhoto, codigo: string) => {
      dispatch({ type: 'submit_started' });

      // Timeout de 60s pra evitar spinner infinito em rede móvel ruim.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      try {
        const formData = new FormData();
        formData.set('file', photo.blob, 'foto.jpg');
        if (codigo) formData.set('codigo_rastreio', codigo);

        const res = await fetch('/api/pacotes', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
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

        // Hard navigation: evita "Failed to find Server Action" com chunks velhos.
        if (typeof window !== 'undefined') {
          window.location.assign(`/chegada/confirmar/${body.pacote_id}`);
        } else {
          router.push(`/chegada/confirmar/${body.pacote_id}`);
        }
      } catch (e) {
        let message: string;
        if (e instanceof DOMException && e.name === 'AbortError') {
          message = 'Conexão lenta — upload demorou demais. Tente de novo.';
        } else if (e instanceof TypeError) {
          message = 'Sem conexão com o servidor. Verifique sua internet.';
        } else {
          message = e instanceof Error ? e.message : 'Falha no envio';
        }
        dispatch({ type: 'submit_failed', message });
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [router],
  );

  // Handlers do FAB — dirige PhotoCapture via ref.
  const handleOpenCamera = useCallback(() => {
    photoRef.current?.startCamera();
  }, []);
  const handleCapture = useCallback(() => {
    void photoRef.current?.capture();
  }, []);
  const handleUsePhoto = useCallback(() => {
    if (state.kind !== 'photo_taken' || codigoInvalido) return;
    void uploadPacote(state.photo, state.codigo.trim());
  }, [state, codigoInvalido, uploadPacote]);
  const handleRetryUpload = useCallback(() => {
    if (state.kind !== 'error' || codigoInvalido) return;
    void uploadPacote(state.photo, state.codigo.trim());
  }, [state, codigoInvalido, uploadPacote]);
  const handleRetakePhoto = useCallback(() => {
    if (state.kind === 'submitting') return;
    dispatch({ type: 'photo_cleared' });
    photoRef.current?.retake();
  }, [state.kind]);

  // Driver do FAB — registra override baseado no estado combinado.
  // Ordem de precedência: parent state primeiro (submitting/error/photo_taken)
  // sobrescrevem PhotoCapture state.
  const fabOverride = (() => {
    if (state.kind === 'submitting') {
      return {
        state: 'submitting' as const,
        label: 'Enviando…',
        icon: <Loader2 className="size-5 animate-spin" aria-hidden />,
        onClick: () => undefined,
        ariaLabel: 'Enviando foto',
        disabled: true,
      };
    }
    if (state.kind === 'error') {
      return {
        state: 'idle-page' as const,
        label: 'Tentar de novo',
        icon: <RotateCcw className="size-6" aria-hidden />,
        onClick: handleRetryUpload,
        ariaLabel: 'Tentar enviar novamente',
        disabled: codigoInvalido,
      };
    }
    if (state.kind === 'photo_taken') {
      return {
        state: 'captured' as const,
        label: 'Usar foto',
        icon: <Check className="size-6" aria-hidden />,
        onClick: handleUsePhoto,
        ariaLabel: 'Usar essa foto e enviar pacote',
        disabled: codigoInvalido,
      };
    }
    // Sem foto ainda — derive do PhotoCapture
    if (photoCaptureKind === 'streaming') {
      return {
        state: 'streaming' as const,
        label: '',
        icon: <Aperture className="size-7" aria-hidden />,
        onClick: handleCapture,
        ariaLabel: 'Capturar foto da etiqueta',
      };
    }
    // idle | requesting | error (câmera) → FAB pra abrir/reabrir câmera
    return {
      state: 'idle-page' as const,
      label: 'Abrir câmera',
      icon: <Camera className="size-6" aria-hidden />,
      onClick: handleOpenCamera,
      ariaLabel: 'Abrir câmera',
    };
  })();

  useBottomNavOverride(fabOverride);

  // Microcopy abaixo do visor, baseado no estado combinado.
  const microcopy = (() => {
    if (state.kind === 'submitting') return 'Enviando foto… · não feche o app';
    if (state.kind === 'error') return null; // erro mostrado em banner separado
    if (state.kind === 'photo_taken')
      return 'Toque em Usar foto pra enviar ↓';
    if (photoCaptureKind === 'streaming')
      return 'Enquadre a etiqueta e toque em capturar ↓';
    if (photoCaptureKind === 'error') return null;
    return 'Toque em Abrir câmera abaixo ↓';
  })();

  // "Refazer foto" link visível quando há foto ou após erro (não em streaming).
  const showRetakeLink =
    state.kind === 'photo_taken' ||
    state.kind === 'submitting' ||
    state.kind === 'error';

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

      {/* Link "Refazer foto" — descoberta clara antes do visor, conforme spec UX */}
      {showRetakeLink && (
        <button
          type="button"
          onClick={handleRetakePhoto}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
          aria-label="Refazer foto"
        >
          <RotateCcw className="size-4" aria-hidden />
          Refazer foto
        </button>
      )}

      <PhotoCapture
        ref={photoRef}
        onCapture={(blob, dataUrl) => {
          setCameraError(null);
          dispatch({
            type: 'photo_captured',
            photo: { blob, dataUrl, sizeKb: Math.round(blob.size / 1024) },
          });
        }}
        onError={(msg) => setCameraError(msg)}
        onStateChange={setPhotoCaptureKind}
        disabled={isSubmitting}
        debugDownload={process.env.NODE_ENV !== 'production'}
      />

      {/* Microcopy abaixo do visor — instruções contextuais por estado */}
      {microcopy && (
        <p
          className="text-center text-xs text-text-secondary"
          aria-live="polite"
        >
          {microcopy}
        </p>
      )}

      {/* Banner de erro de upload — preserva foto + código pra retry via FAB */}
      {state.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          <p className="font-medium">Falha ao enviar</p>
          <p className="mt-0.5 text-xs">{state.message}</p>
          <p className="mt-2 text-xs text-text-secondary">
            Foto preservada · {state.photo.sizeKb} KB
          </p>
        </div>
      )}

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
              Caracteres <code>&lt;</code> e <code>&gt;</code> não são permitidos
              (até 200 caracteres).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
