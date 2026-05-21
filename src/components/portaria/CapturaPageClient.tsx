'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package,
  AlertCircle,
  Camera,
  Aperture,
  Check,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ImagePlus,
  ChevronDown,
  X,
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
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(capturaReducer, initialCapturaState);
  const [showAdminBanner, setShowAdminBanner] = useState(
    () => searchParams.get('msg') === 'enviado_administracao',
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCodigoInput, setShowCodigoInput] = useState(false);
  const [photoCaptureKind, setPhotoCaptureKind] =
    useState<PhotoCaptureKind>('idle');

  const photoRef = useRef<PhotoCaptureHandle | null>(null);
  // Dedupe pra evitar upload duplo do mesmo blob (strict mode dev roda effect 2x).
  const submittedFor = useRef<Blob | null>(null);

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

  // Callbacks pro PhotoCapture — useCallback estabiliza referência pra evitar
  // re-render loop que cancelava getUserMedia. Bug observado em prod: parent
  // re-renderiza → nova onError ref → useEffect[onError] re-roda → cancela
  // request em curso → "Solicitando câmera…" travado.
  const handlePhotoCaptured = useCallback(
    (blob: Blob, dataUrl: string) => {
      setCameraError(null);
      dispatch({
        type: 'photo_captured',
        photo: { blob, dataUrl, sizeKb: Math.round(blob.size / 1024) },
      });
    },
    [],
  );
  const handlePhotoError = useCallback((msg: string) => {
    setCameraError(msg);
  }, []);

  // Handlers do FAB — dirige PhotoCapture via ref.
  const handleOpenCamera = useCallback(() => {
    photoRef.current?.startCamera();
  }, []);
  const handleOpenGallery = useCallback(() => {
    photoRef.current?.openGallery();
  }, []);
  const handleCapture = useCallback(() => {
    void photoRef.current?.capture();
  }, []);
  // "Usar foto": dispara confirm() do PhotoCapture, que via onCapture →
  // handlePhotoCaptured → dispatch photo_captured. Upload automático segue
  // via useEffect[state.kind==='photo_taken'].
  const handleUsePhoto = useCallback(() => {
    if (codigoInvalido) return;
    photoRef.current?.confirm();
  }, [codigoInvalido]);
  const handleRetryUpload = useCallback(() => {
    if (state.kind !== 'error' || codigoInvalido) return;
    void uploadPacote(state.photo, state.codigo.trim());
  }, [state, codigoInvalido, uploadPacote]);
  const handleRetakePhoto = useCallback(() => {
    if (state.kind === 'submitting') return;
    submittedFor.current = null;
    dispatch({ type: 'photo_cleared' });
    photoRef.current?.retake();
  }, [state.kind]);

  // Auto-upload após o user confirmar explicitamente (FAB "Usar foto").
  // O confirm() dispara onCapture → handlePhotoCaptured → state.kind='photo_taken'.
  // Aqui detectamos a transição e disparamos uploadPacote 1x (dedupe via ref).
  // Diferente do auto-submit antigo (que rodava direto após capture sem confirm),
  // este só roda DEPOIS do gesto explícito do porteiro.
  useEffect(() => {
    if (state.kind !== 'photo_taken') return;
    if (codigoInvalido) return;
    if (submittedFor.current === state.photo.blob) return;
    submittedFor.current = state.photo.blob;
    void uploadPacote(state.photo, state.codigo.trim());
  }, [state, codigoInvalido, uploadPacote]);

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
      // Já confirmou + upload em curso (vai entrar em submitting na próxima render).
      // Mostrar "Usar foto" enquanto o effect dispara uploadPacote.
      return {
        state: 'captured' as const,
        label: 'Usar foto',
        icon: <Check className="size-6" aria-hidden />,
        onClick: () => undefined,
        ariaLabel: 'Foto confirmada',
        disabled: true,
      };
    }
    // PhotoCapture com foto pronta mas ainda sem confirm — FAB pra confirmar.
    if (photoCaptureKind === 'captured') {
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
    if (state.kind === 'photo_taken') return 'Enviando…';
    if (photoCaptureKind === 'captured')
      return 'Toque em Usar foto pra enviar ↓';
    if (photoCaptureKind === 'streaming')
      return 'Enquadre a etiqueta e toque em capturar ↓';
    if (photoCaptureKind === 'error') return null;
    return 'Toque em Abrir câmera abaixo ↓';
  })();

  // "Refazer foto" link visível quando há foto pronta (PhotoCapture captured),
  // após confirm (state photo_taken/submitting/error). Não em streaming/idle.
  const showRetakeLink =
    photoCaptureKind === 'captured' ||
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

      {showAdminBanner && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-success/30 bg-success-light p-3 text-sm text-foreground"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span className="flex-1">
            Pacote enviado para a <strong>administração</strong> organizar.
          </span>
          <button
            type="button"
            onClick={() => setShowAdminBanner(false)}
            className="shrink-0 text-success/70 hover:text-success"
            aria-label="Fechar aviso"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

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
        onCapture={handlePhotoCaptured}
        onError={handlePhotoError}
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

      {/* Anexar da galeria — alternativa à câmera. Visível apenas antes da
          captura (idle/requesting/error de câmera) — depois de tirar foto
          o user usa Refazer foto pra trocar. */}
      {(photoCaptureKind === 'idle' ||
        photoCaptureKind === 'requesting' ||
        photoCaptureKind === 'error') &&
        state.kind === 'idle' && (
          <button
            type="button"
            onClick={handleOpenGallery}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-muted/40"
            aria-label="Anexar foto da galeria"
          >
            <ImagePlus className="size-4" aria-hidden />
            Anexar da galeria
          </button>
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
