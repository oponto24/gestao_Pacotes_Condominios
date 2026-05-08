'use client';

import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AlertCircle, Camera, RefreshCcw, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * `<PhotoCapture>` — captura de foto da etiqueta do pacote (story 3.2).
 *
 * Componente reusável: gerencia getUserMedia, state machine de 5 estados
 * (idle/requesting/streaming/captured/error), captura via canvas com bound
 * 1280px + JPEG quality 0.85, cleanup explícito de MediaStream.
 *
 * Consumido pela story 3.6 (CapturaPage) via `onCapture` callback.
 */

interface PhotoCaptureProps {
  /** Callback chamado quando o porteiro confirma a foto. */
  onCapture: (blob: Blob, dataUrl: string) => void;
  /** Callback opcional pra erros (permissão, sem dispositivo). */
  onError?: (message: string) => void;
  /** Câmera preferida — `environment` (traseira, default) ou `user` (frontal). */
  preferredFacingMode?: 'environment' | 'user';
  /** Desabilita interação (ex: enquanto upload está rolando). */
  disabled?: boolean;
  /** Em dev, renderiza link "baixar foto" no estado captured pra inspeção visual. */
  debugDownload?: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'streaming'; stream: MediaStream }
  | { kind: 'captured'; blob: Blob; dataUrl: string }
  | { kind: 'error'; message: string };

type Action =
  | { type: 'request' }
  | { type: 'stream_started'; stream: MediaStream }
  | { type: 'capture_done'; blob: Blob; dataUrl: string }
  | { type: 'retake' }
  | { type: 'error'; message: string }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'request':
      return { kind: 'requesting' };
    case 'stream_started':
      return { kind: 'streaming', stream: action.stream };
    case 'capture_done':
      return { kind: 'captured', blob: action.blob, dataUrl: action.dataUrl };
    case 'retake':
      return { kind: 'requesting' };
    case 'error':
      return { kind: 'error', message: action.message };
    case 'reset':
      return { kind: 'idle' };
  }
}

/** Para todas as tracks de um stream — crítico para liberar a câmera (LED off). */
function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

/** Calcula dimensões com bound de 1280px no maior lado, mantendo aspect ratio. */
function fitInBox(width: number, height: number, max = 1280): { w: number; h: number } {
  const ratio = Math.min(max / width, max / height, 1);
  return { w: Math.round(width * ratio), h: Math.round(height * ratio) };
}

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Sem acesso à câmera. Vá em Configurações > Site > Permissões e libere a câmera.',
  NotFoundError: 'Câmera não disponível neste dispositivo.',
  NotReadableError: 'Câmera está sendo usada por outro aplicativo. Feche e tente novamente.',
  OverconstrainedError: 'Câmera não suporta a configuração solicitada.',
  SecurityError: 'Acesso à câmera bloqueado. Verifique se está em conexão segura (HTTPS).',
};

export function PhotoCapture({
  onCapture,
  onError,
  preferredFacingMode = 'environment',
  disabled = false,
  debugDownload = false,
}: PhotoCaptureProps) {
  const [state, dispatch] = useReducer(reducer, { kind: 'idle' });
  // Câmera ativa — pode ser trocada via botão. `ideal` em vez de match estrito
  // pra fallback automático no celular que só tem 1 câmera.
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>(
    preferredFacingMode,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  // Mantém ref do stream pra cleanup confiável (evita stale closure)
  const streamRef = useRef<MediaStream | null>(null);

  // Resolução solicitada — pedimos alta (até 1920x1080) pra OCR de etiqueta.
  // O navegador entrega o que conseguir; getSettings() devolve o real depois.
  const videoConstraints = useMemo<MediaStreamConstraints>(
    () => ({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    }),
    [facingMode],
  );

  // Solicita câmera quando entra em 'requesting' (cancela se desmonta antes)
  useEffect(() => {
    if (state.kind !== 'requesting') return;
    let cancelled = false;

    async function requestCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('getUserMedia indisponível', 'NotFoundError');
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw err;
          }
        }

        if (cancelled) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;
        dispatch({ type: 'stream_started', stream });
      } catch (err) {
        if (cancelled) return;
        const errName = err instanceof DOMException ? err.name : 'UnknownError';
        const message = ERROR_MESSAGES[errName] ?? 'Falha ao acessar a câmera.';
        dispatch({ type: 'error', message });
        onError?.(message);
      }
    }

    requestCamera();

    return () => {
      cancelled = true;
    };
  }, [state.kind, videoConstraints, onError]);

  // Conecta stream ao <video> quando entra em 'streaming'
  useEffect(() => {
    if (state.kind !== 'streaming') return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = state.stream;
  }, [state]);

  // Para stream ao entrar em estados que não usam câmera (captured, error, idle)
  // — `requesting` e `streaming` mantêm; outros liberam.
  useEffect(() => {
    if (state.kind === 'streaming' || state.kind === 'requesting') return;
    stopStream(streamRef.current);
    streamRef.current = null;
  }, [state.kind]);

  // Cleanup global: ao desmontar, para qualquer stream ativo
  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    if (disabled) return;
    dispatch({ type: 'request' });
  }, [disabled]);

  const handleCaptureClick = useCallback(async () => {
    if (state.kind !== 'streaming') return;
    const video = videoRef.current;
    if (!video) return;

    // Resolução real do vídeo (fallback se getSettings não trouxer)
    const track = state.stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    const sw = settings.width ?? video.videoWidth;
    const sh = settings.height ?? video.videoHeight;
    if (!sw || !sh) {
      const message = 'Câmera ainda inicializando. Aguarde um instante e tente de novo.';
      dispatch({ type: 'error', message });
      onError?.(message);
      return;
    }

    const { w, h } = fitInBox(sw, sh, 1920);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const message = 'Falha ao capturar foto. Recarregue a página.';
      dispatch({ type: 'error', message });
      onError?.(message);
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);

    // Vibração + flash visual (microinteractions)
    try {
      navigator.vibrate?.(50);
    } catch {
      // ignora
    }
    if (flashRef.current) {
      flashRef.current.classList.remove('opacity-0');
      flashRef.current.classList.add('opacity-100');
      window.setTimeout(() => {
        flashRef.current?.classList.remove('opacity-100');
        flashRef.current?.classList.add('opacity-0');
      }, 100);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    );
    if (!blob) {
      const message = 'Falha ao serializar a foto.';
      dispatch({ type: 'error', message });
      onError?.(message);
      return;
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    dispatch({ type: 'capture_done', blob, dataUrl });
  }, [state, onError]);

  const handleRetake = useCallback(() => {
    dispatch({ type: 'retake' });
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.kind !== 'captured') return;
    onCapture(state.blob, state.dataUrl);
  }, [state, onCapture]);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return (
    <div className="space-y-3">
      {/* Visor 4:3 com placeholder/preview/captura sobrepostos */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-lg border border-border bg-muted',
          'aspect-[4/3]',
        )}
      >
        {/* Estado: idle */}
        {state.kind === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-secondary">
            <Camera className="h-12 w-12" aria-hidden />
            <p className="text-sm">Posicione a etiqueta aqui</p>
          </div>
        )}

        {/* Estado: requesting */}
        {state.kind === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center text-text-secondary">
            <p className="text-sm">Solicitando acesso à câmera…</p>
          </div>
        )}

        {/* Estado: streaming → preview ao vivo */}
        {state.kind === 'streaming' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Pré-visualização da câmera"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Indicador de privacidade (sugestão @po) */}
            <div
              className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur"
              aria-live="polite"
            >
              <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span>Câmera ligada</span>
            </div>
          </>
        )}

        {/* Estado: captured → preview da foto */}
        {state.kind === 'captured' && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={state.dataUrl}
            alt="Foto capturada da etiqueta"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Estado: error */}
        {state.kind === 'error' && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-danger"
          >
            <AlertCircle className="h-10 w-10" aria-hidden />
            <p className="text-sm">{state.message}</p>
          </div>
        )}

        {/* Flash overlay para captura */}
        <div
          ref={flashRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white opacity-0 transition-opacity duration-100"
        />
      </div>

      {/* Botões conforme estado */}
      {state.kind === 'idle' && (
        <Button
          type="button"
          onClick={handleStart}
          disabled={disabled}
          aria-label="Iniciar câmera"
          className="w-full min-h-[56px] text-base"
        >
          <Camera className="mr-2 h-5 w-5" aria-hidden />
          Iniciar câmera
        </Button>
      )}

      {state.kind === 'streaming' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={handleCaptureClick}
            disabled={disabled}
            aria-label="Tirar foto"
            className="min-h-[56px] text-base sm:flex-1"
          >
            <Camera className="mr-2 h-5 w-5" aria-hidden />
            Tirar foto
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
              dispatch({ type: 'request' });
            }}
            disabled={disabled}
            aria-label="Trocar câmera"
            title={facingMode === 'environment' ? 'Trocar pra frontal' : 'Trocar pra traseira'}
            className="min-h-[56px] sm:w-auto sm:px-4"
          >
            <SwitchCamera className="h-5 w-5" aria-hidden />
            <span className="ml-2 sm:hidden">
              Trocar câmera ({facingMode === 'environment' ? 'traseira' : 'frontal'})
            </span>
          </Button>
        </div>
      )}

      {state.kind === 'captured' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleRetake}
            disabled={disabled}
            aria-label="Refazer foto"
            className="min-h-[56px] sm:flex-1"
          >
            <RefreshCcw className="mr-2 h-5 w-5" aria-hidden />
            Refazer foto
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            aria-label="Usar essa foto"
            className="min-h-[56px] sm:flex-1"
          >
            Usar essa foto
          </Button>
        </div>
      )}

      {state.kind === 'error' && (
        <Button
          type="button"
          onClick={handleRetry}
          aria-label="Tentar novamente"
          className="w-full min-h-[56px] text-base"
        >
          Tentar novamente
        </Button>
      )}

      {/* Debug download (dev only) */}
      {debugDownload && state.kind === 'captured' && (
        <a
          href={state.dataUrl}
          download={`etiqueta-${Date.now()}.jpg`}
          className="block text-xs text-text-secondary underline"
        >
          [debug] Baixar foto
        </a>
      )}
    </div>
  );
}
