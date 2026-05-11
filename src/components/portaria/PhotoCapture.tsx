'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AlertCircle, Camera, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * `<PhotoCapture>` — captura de foto da etiqueta do pacote.
 *
 * **PR-3 redesign FAB Chegada:** controlled component.
 * - Não renderiza mais botões pra idle/streaming/captured — o FAB do BottomNav
 *   é o único driver de ação (`startCamera()`, `capture()`, `retake()`, `confirm()`).
 * - Expõe handlers via `ref` (useImperativeHandle).
 * - Notifica state changes via `onStateChange` pro parent dirigir o FAB.
 * - Estado `error` mantém botão interno "Tentar novamente" (terminal local).
 *
 * State machine de 5 estados (idle/requesting/streaming/captured/error),
 * captura via canvas com bound 1920px + JPEG quality 0.85, cleanup explícito
 * de MediaStream.
 */

export type PhotoCaptureKind =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'captured'
  | 'error';

export interface PhotoCaptureHandle {
  /** Inicia getUserMedia. Idempotente — no-op se já streaming. */
  startCamera: () => void;
  /** Captura frame atual via canvas. Só funciona em estado `streaming`. */
  capture: () => Promise<void>;
  /** Volta pra requesting (reinicia stream). Só funciona em `captured` ou `error`. */
  retake: () => void;
  /** Dispara onCapture com o blob/dataUrl atuais. Só funciona em `captured`. */
  confirm: () => void;
  /** Abre picker da galeria. Foto selecionada é processada igual à capturada. */
  openGallery: () => void;
}

interface PhotoCaptureProps {
  /** Callback chamado quando o parent confirma a foto via `.confirm()`. */
  onCapture: (blob: Blob, dataUrl: string) => void;
  /** Callback opcional pra erros (permissão, sem dispositivo). */
  onError?: (message: string) => void;
  /** Câmera preferida — `environment` (traseira, default) ou `user` (frontal). */
  preferredFacingMode?: 'environment' | 'user';
  /** Desabilita interação (ex: enquanto upload está rolando). */
  disabled?: boolean;
  /** Em dev, renderiza link "baixar foto" no estado captured pra inspeção visual. */
  debugDownload?: boolean;
  /** Notifica parent quando o state interno muda — pra dirigir o FAB. */
  onStateChange?: (kind: PhotoCaptureKind) => void;
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

export const PhotoCapture = forwardRef<PhotoCaptureHandle, PhotoCaptureProps>(
  function PhotoCapture(
    {
      onCapture,
      onError,
      preferredFacingMode = 'environment',
      disabled = false,
      debugDownload = false,
      onStateChange,
    },
    ref,
  ) {
    const [state, dispatch] = useReducer(reducer, { kind: 'idle' });
    const facingMode = preferredFacingMode;
    const [availableCameras, setAvailableCameras] = React.useState<MediaDeviceInfo[]>(
      [],
    );
    const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const flashRef = useRef<HTMLDivElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // Ref pra callbacks instáveis do parent — evita re-render loop que cancelava
    // getUserMedia repetidamente quando parent passava `onError={(msg)=>...}` inline.
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    // Notifica parent a cada mudança de state — driver do FAB.
    useEffect(() => {
      onStateChange?.(state.kind);
    }, [state.kind, onStateChange]);

    const videoConstraints = useMemo<MediaStreamConstraints>(
      () => ({
        video: selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      }),
      [facingMode, selectedDeviceId],
    );

    useEffect(() => {
      if (state.kind !== 'streaming') return;
      if (!navigator.mediaDevices?.enumerateDevices) return;

      let cancelled = false;
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (cancelled) return;
          const videos = devices.filter((d) => d.kind === 'videoinput');
          setAvailableCameras(videos);
          const currentTrack = state.stream.getVideoTracks()[0];
          const currentId = currentTrack?.getSettings?.().deviceId;
          if (currentId && !selectedDeviceId) {
            setSelectedDeviceId(currentId);
          }
        })
        .catch(() => {
          // ignora — listagem é nice-to-have
        });
      return () => {
        cancelled = true;
      };
    }, [state, selectedDeviceId]);

    function prettyLabel(d: MediaDeviceInfo, idx: number): string {
      const lbl = d.label.toLowerCase();
      if (!lbl) return `Câmera ${idx + 1}`;
      if (lbl.includes('front') || lbl.includes('user')) return `Frontal (${d.label})`;
      if (lbl.includes('ultra') || lbl.includes('wide') || lbl.includes('0.5'))
        return `Ultra-grande angular`;
      if (lbl.includes('tele') || lbl.includes('zoom') || lbl.includes('2x') || lbl.includes('3x'))
        return `Telefoto`;
      if (lbl.includes('back') || lbl.includes('environment') || lbl.includes('rear'))
        return `Traseira ${idx > 0 ? `(${idx + 1})` : 'principal'}`;
      return d.label || `Câmera ${idx + 1}`;
    }

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
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
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
          onErrorRef.current?.(message);
        }
      }

      requestCamera();

      return () => {
        cancelled = true;
      };
      // onError NÃO entra no deps — usamos onErrorRef.current pra não re-rodar
      // o efeito (e cancelar getUserMedia) toda vez que parent re-renderiza.
    }, [state.kind, videoConstraints]);

    useEffect(() => {
      if (state.kind !== 'streaming') return;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = state.stream;
    }, [state]);

    useEffect(() => {
      if (state.kind === 'streaming' || state.kind === 'requesting') return;
      stopStream(streamRef.current);
      streamRef.current = null;
    }, [state.kind]);

    useEffect(() => {
      return () => {
        stopStream(streamRef.current);
        streamRef.current = null;
      };
    }, []);

    // Handlers expostos via ref pro parent dirigir.
    const handleStart = useCallback(() => {
      if (disabled) return;
      if (state.kind === 'streaming' || state.kind === 'requesting') return;
      dispatch({ type: 'request' });
    }, [disabled, state.kind]);

    const handleCaptureClick = useCallback(async () => {
      if (state.kind !== 'streaming') return;
      const video = videoRef.current;
      if (!video) return;

      const track = state.stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() ?? {};
      const sw = settings.width ?? video.videoWidth;
      const sh = settings.height ?? video.videoHeight;
      if (!sw || !sh) {
        const message = 'Câmera ainda inicializando. Aguarde um instante e tente de novo.';
        dispatch({ type: 'error', message });
        onErrorRef.current?.(message);
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
        onErrorRef.current?.(message);
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);

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
        onErrorRef.current?.(message);
        return;
      }
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      dispatch({ type: 'capture_done', blob, dataUrl });
      // onError fora do deps — usa ref estável (igual ao useEffect do request)
    }, [state]);

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

    // Abre o picker nativo (iPhone mostra galeria + opção câmera).
    // Trigger sintético via .click() funciona em todos os browsers modernos
    // dentro do user gesture do FAB.
    const handleOpenGallery = useCallback(() => {
      if (disabled) return;
      fileInputRef.current?.click();
    }, [disabled]);

    // Processa arquivo escolhido na galeria — mesmo pipeline da câmera
    // (resize 1920px + JPEG 0.85) pra evitar upload de iPhone 12MP cru (5+MB).
    const handleFileSelected = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Limpa value pro onChange disparar de novo se user escolher mesmo arquivo
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          const message = 'Arquivo precisa ser uma imagem.';
          dispatch({ type: 'error', message });
          onErrorRef.current?.(message);
          return;
        }

        // Para qualquer stream ativo antes de processar (libera câmera se estava ligada)
        stopStream(streamRef.current);
        streamRef.current = null;

        try {
          const dataUrlOriginal = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
            reader.readAsDataURL(file);
          });

          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Falha ao decodificar imagem'));
            i.src = dataUrlOriginal;
          });

          const { w, h } = fitInBox(img.naturalWidth, img.naturalHeight, 1920);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas indisponível');
          ctx.drawImage(img, 0, 0, w, h);

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
          );
          if (!blob) throw new Error('Falha ao serializar a foto.');
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          dispatch({ type: 'capture_done', blob, dataUrl });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Falha ao processar imagem.';
          dispatch({ type: 'error', message });
          onErrorRef.current?.(message);
        }
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        startCamera: handleStart,
        capture: handleCaptureClick,
        retake: handleRetake,
        confirm: handleConfirm,
        openGallery: handleOpenGallery,
      }),
      [
        handleStart,
        handleCaptureClick,
        handleRetake,
        handleConfirm,
        handleOpenGallery,
      ],
    );

    return (
      <div className="space-y-3">
        {/* Input file invisível — galeria via openGallery() */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
          aria-hidden
        />
        {/* Visor 4:3 com placeholder/preview/captura sobrepostos */}
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-lg border border-border bg-muted',
            'aspect-[4/3]',
          )}
        >
          {state.kind === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-secondary">
              <Camera className="h-12 w-12" aria-hidden />
              <p className="text-sm">Posicione a etiqueta aqui</p>
            </div>
          )}

          {state.kind === 'requesting' && (
            <div className="absolute inset-0 flex items-center justify-center text-text-secondary">
              <p className="text-sm">Solicitando acesso à câmera…</p>
            </div>
          )}

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
              <div
                className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur"
                aria-live="polite"
              >
                <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span>Câmera ligada</span>
              </div>
            </>
          )}

          {state.kind === 'captured' && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={state.dataUrl}
              alt="Foto capturada da etiqueta"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {state.kind === 'error' && (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-danger"
            >
              <AlertCircle className="h-10 w-10" aria-hidden />
              <p className="text-sm">{state.message}</p>
            </div>
          )}

          <div
            ref={flashRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-white opacity-0 transition-opacity duration-100"
          />
        </div>

        {/* Selector de lente — só no estado streaming e quando há >1 câmera */}
        {state.kind === 'streaming' && availableCameras.length > 1 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs">
            <SwitchCamera className="size-4 shrink-0 text-text-secondary" aria-hidden />
            <select
              value={selectedDeviceId ?? ''}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value || null);
                dispatch({ type: 'request' });
              }}
              disabled={disabled}
              className="flex-1 cursor-pointer bg-transparent text-foreground outline-none"
              aria-label="Escolher lente da câmera"
            >
              {availableCameras.map((cam, i) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {prettyLabel(cam, i)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Estado terminal: erro mostra botão local "Tentar novamente".
            Outros estados (idle/streaming/captured) são dirigidos pelo FAB. */}
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
  },
);
