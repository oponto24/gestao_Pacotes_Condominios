'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Loader2, Camera, ChevronDown } from 'lucide-react';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';
import { Button } from '@/components/ui/button';
import { extractQrToken } from '@/lib/retirada/extract-qr-token';

/**
 * `<RetiradaScannerClient>` — tela de scan QR (story 5.1).
 *
 * Scanner de câmera para ler QR Code do morador + fallback de digitação manual.
 */
export function RetiradaScannerClient() {
  const router = useRouter();
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const processedRef = useRef(false);

  const handleQrResult = useCallback(
    (decodedText: string) => {
      if (processedRef.current) return;
      const token = extractQrToken(decodedText);
      if (!token) return;
      processedRef.current = true;
      setSubmitting(true);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }

      // Stop scanner before navigating
      scannerRef.current?.stop().catch(() => {});
      router.push(`/retirada/confirmar/${token}`);
    },
    [router],
  );

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scannerRef.current) return;

    setCameraError(null);
    const scannerId = 'qr-reader';

    try {
      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        handleQrResult,
        () => {}, // ignore scan errors (no QR found yet)
      );

      setScanning(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível acessar a câmera';
      setCameraError(
        msg.includes('NotAllowed') || msg.includes('Permission')
          ? 'Permissão de câmera negada. Libere nas configurações do navegador.'
          : `Erro ao abrir câmera: ${msg}`,
      );
      scannerRef.current = null;
    }
  }, [handleQrResult]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // already stopped
      }
      scannerRef.current = null;
      setScanning(false);
    }
  }, []);

  // Auto-start camera on mount
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleManualSubmit() {
    setError(null);
    const token = extractQrToken(manualValue);
    if (!token) {
      setError('Código inválido — escaneie o QR ou digite um código válido.');
      return;
    }
    setSubmitting(true);
    stopScanner();
    router.push(`/retirada/confirmar/${token}`);
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden>
          <QrCode className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Retirar pacote</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Aponte a câmera para o QR Code do morador.
          </p>
        </div>
      </header>

      {/* Camera scanner */}
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <div
          id="qr-reader"
          ref={containerRef}
          className="relative mx-auto"
          style={{ minHeight: scanning ? undefined : 300 }}
        />
        {!scanning && !cameraError && (
          <div className="flex h-[300px] items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-white/60">
              <Camera className="size-8" />
              <span className="text-sm">Abrindo câmera…</span>
            </div>
          </div>
        )}
      </div>

      {cameraError && (
        <div
          role="alert"
          className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground"
        >
          {cameraError}
          <button
            type="button"
            onClick={() => {
              stopScanner();
              processedRef.current = false;
              startScanner();
            }}
            className="ml-2 font-medium underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {submitting && (
        <div className="flex items-center justify-center gap-2 py-4 text-primary">
          <Loader2 className="size-5 animate-spin" />
          <span className="font-medium">QR detectado — carregando…</span>
        </div>
      )}

      {/* Manual input fallback */}
      {!showManual ? (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          disabled={submitting}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-muted/40"
        >
          <span>Digitar código manualmente</span>
          <ChevronDown className="size-4" aria-hidden />
        </button>
      ) : (
        <div className="space-y-3">
          <BarcodeScannerInput
            value={manualValue}
            onChange={(v) => {
              setManualValue(v);
              setError(null);
            }}
            placeholder="Cole ou digite o código do QR"
            disabled={submitting}
          />

          {error && (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <Button
            type="button"
            onClick={handleManualSubmit}
            disabled={!manualValue.trim() || submitting}
            aria-busy={submitting}
            className="h-12 w-full text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Buscando…
              </>
            ) : (
              'Continuar'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
