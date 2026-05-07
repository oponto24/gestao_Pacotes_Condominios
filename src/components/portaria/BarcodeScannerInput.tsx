'use client';

import { useCallback, useEffect, useId, useReducer, useRef } from 'react';
import { AlertCircle, ScanLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * `<BarcodeScannerInput>` — input texto + bipe de código de barras (story 3.3).
 *
 * Componente reusável: input editável (fallback manual) + botão "Bipar" que
 * abre modal fullscreen com html5-qrcode. Detecção bem-sucedida fecha modal
 * automaticamente e preenche o input. Erro de permissão NÃO bloqueia digitação.
 *
 * State machine via useReducer (mesmo pattern PhotoCapture 3.2).
 * Cleanup explícito do html5-qrcode em 2 passos: stop() + clear().
 */

interface BarcodeScannerInputProps {
  value: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Limite de caracteres no input texto (default 100). */
  maxLength?: number;
}

type State =
  | { kind: 'closed' }
  | { kind: 'requesting' }
  | { kind: 'scanning' }
  | { kind: 'closing' } // estado intermediário: modal visível, cleanup em curso
  | { kind: 'error'; message: string };

type Action =
  | { type: 'open' }
  | { type: 'scanner_started' }
  | { type: 'start_close' }
  | { type: 'close' }
  | { type: 'error'; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'open':
      return { kind: 'requesting' };
    case 'scanner_started':
      return { kind: 'scanning' };
    case 'start_close':
      return { kind: 'closing' };
    case 'close':
      return { kind: 'closed' };
    case 'error':
      return { kind: 'error', message: action.message };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Sem acesso à câmera. Vá em Configurações > Site > Permissões e libere a câmera.',
  NotFoundError: 'Câmera não disponível neste dispositivo.',
  NotReadableError: 'Câmera está sendo usada por outro aplicativo.',
  SecurityError: 'Acesso à câmera bloqueado. Verifique se está em conexão segura (HTTPS).',
};

export function BarcodeScannerInput({
  value,
  onChange,
  onError,
  placeholder = 'Código do pacote (opcional)',
  disabled = false,
  maxLength = 100,
}: BarcodeScannerInputProps) {
  const [state, dispatch] = useReducer(reducer, { kind: 'closed' });
  const scannerInstanceRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const alreadyDetectedRef = useRef(false);
  // Container vazio controlado por React. O div interno do scanner é criado
  // imperativamente (document.createElement) e anexado a este container —
  // assim React não tem ownership do <video> que html5-qrcode insere, e
  // não tenta `removeChild` de nós que html5-qrcode já manipulou.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerDivRef = useRef<HTMLDivElement | null>(null);
  const baseId = useId().replace(/:/g, '_');

  /**
   * Cleanup do html5-qrcode em 2 passos: stop() + clear().
   * + Remove o div imperativo do container (idempotente).
   */
  const cleanupScanner = useCallback(async () => {
    const instance = scannerInstanceRef.current;
    if (instance) {
      scannerInstanceRef.current = null;
      try {
        await instance.stop();
      } catch {
        // já parado — ignora
      }
      try {
        instance.clear();
      } catch {
        // ignora
      }
    }
    // Remove o div imperativo do container manualmente
    const div = scannerDivRef.current;
    if (div?.parentElement) {
      try {
        div.parentElement.removeChild(div);
      } catch {
        // já removido — ignora
      }
    }
    scannerDivRef.current = null;
  }, []);

  // Inicia scanner quando entra em 'requesting'
  useEffect(() => {
    if (state.kind !== 'requesting') return;
    let cancelled = false;
    alreadyDetectedRef.current = false;

    async function startScanner() {
      try {
        // Dynamic import: lib pesada, só carrega quando user clica "Bipar"
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          'html5-qrcode'
        );

        if (cancelled) return;

        const container = containerRef.current;
        if (!container) {
          throw new Error('Container do scanner não disponível');
        }

        // Cria div filho imperativo (não controlado pelo React)
        const scannerDiv = document.createElement('div');
        scannerDiv.id = `scanner-${baseId}-${Date.now()}`;
        scannerDiv.style.width = '100%';
        scannerDiv.style.height = '100%';
        // Limpa qualquer div órfão de uma chamada anterior antes de anexar
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        container.appendChild(scannerDiv);
        scannerDivRef.current = scannerDiv;

        const formats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
        ];

        const instance = new Html5Qrcode(scannerDiv.id, { formatsToSupport: formats, verbose: false });
        scannerInstanceRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            // Flag previne múltiplas detecções do mesmo código
            if (alreadyDetectedRef.current) return;
            alreadyDetectedRef.current = true;

            try {
              navigator.vibrate?.(50);
            } catch {
              // ignora
            }

            // Cleanup ANTES de fechar modal: estado 'closing' mantém modal
            // visível pra React não desmontar o div enquanto html5-qrcode limpa.
            dispatch({ type: 'start_close' });
            void cleanupScanner().then(() => {
              dispatch({ type: 'close' });
              onChange(decodedText);
            });
          },
          () => {
            // onScanFailure — silencioso (cada frame sem detecção dispara)
          },
        );

        if (cancelled) {
          await cleanupScanner();
          return;
        }
        dispatch({ type: 'scanner_started' });
      } catch (err) {
        if (cancelled) return;
        const fallback = 'Falha ao iniciar scanner. Tente digitar o código manualmente.';
        let message: string;
        if (err instanceof DOMException && err.name in ERROR_MESSAGES) {
          message = ERROR_MESSAGES[err.name] ?? fallback;
        } else if (err instanceof Error && err.message.includes('Permission')) {
          message = ERROR_MESSAGES.NotAllowedError ?? fallback;
        } else {
          message = fallback;
        }
        dispatch({ type: 'error', message });
        onError?.(message);
      }
    }

    startScanner();

    return () => {
      cancelled = true;
    };
  }, [state.kind, baseId, cleanupScanner, onChange, onError]);

  // Cleanup global no unmount
  useEffect(() => {
    return () => {
      void cleanupScanner();
    };
  }, [cleanupScanner]);

  const handleOpenScanner = useCallback(() => {
    if (disabled) return;
    dispatch({ type: 'open' });
  }, [disabled]);

  const handleCloseModal = useCallback(() => {
    // Mesmo pattern da detecção: estado 'closing' mantém modal renderizado
    // enquanto cleanup async roda, prevenindo race com React unmount.
    dispatch({ type: 'start_close' });
    void cleanupScanner().then(() => dispatch({ type: 'close' }));
  }, [cleanupScanner]);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'open' });
  }, []);

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) handleCloseModal();
    },
    [handleCloseModal],
  );

  // Modal permanece aberto durante 'closing' para evitar race React vs html5-qrcode
  const isModalOpen = state.kind !== 'closed';

  // Identifica estados onde o div do scanner ainda precisa estar renderizado
  const isScannerDivRendered =
    state.kind === 'requesting' || state.kind === 'scanning' || state.kind === 'closing';

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label="Código do pacote"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleOpenScanner}
          disabled={disabled}
          aria-label="Bipar código de barras"
          className="min-h-[44px]"
        >
          <ScanLine className="mr-2 h-4 w-4" aria-hidden />
          Bipar
        </Button>
      </div>

      <Sheet open={isModalOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="flex w-full max-w-full flex-col p-0 sm:max-w-lg">
          <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <SheetTitle className="text-base">Bipar código de barras</SheetTitle>
            <button
              type="button"
              onClick={handleCloseModal}
              aria-label="Fechar scanner"
              className="rounded-md p-1 hover:bg-muted"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 p-4">
            {!isScannerDivRendered && state.kind === 'error' ? (
              <div
                role="alert"
                className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-6 text-center"
              >
                <AlertCircle className="h-10 w-10 text-danger" aria-hidden />
                <p className="text-sm text-danger">{state.message}</p>
                <Button type="button" onClick={handleRetry} variant="secondary">
                  Tentar novamente
                </Button>
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Fechar e digitar manualmente
                </Button>
              </div>
            ) : (
              <>
                <div
                  className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black"
                  aria-label="Visor do scanner de código de barras"
                >
                  {/* Container puro — controlado imperativamente, sem children React */}
                  <div ref={containerRef} className="absolute inset-0" />
                  {state.kind === 'requesting' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-white/70">Solicitando acesso à câmera…</p>
                    </div>
                  )}
                </div>
                <p className="text-center text-sm text-text-secondary">
                  {state.kind === 'closing'
                    ? 'Fechando…'
                    : 'Aponte para o código de barras ou QR Code do pacote.'}
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
