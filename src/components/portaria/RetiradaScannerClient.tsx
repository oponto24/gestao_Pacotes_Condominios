'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Loader2 } from 'lucide-react';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';
import { Button } from '@/components/ui/button';
import { extractQrToken } from '@/lib/retirada/extract-qr-token';

/**
 * `<RetiradaScannerClient>` — tela de scan QR (story 5.1).
 *
 * Reusa BarcodeScannerInput (3.3) que já tem fallback de digitação.
 * Após scan/digitação, valida formato e redireciona para /retirada/confirmar/{token}.
 */
export function RetiradaScannerClient() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit() {
    setError(null);
    const token = extractQrToken(value);
    if (!token) {
      setError('Código inválido — escaneie o QR ou digite um código válido.');
      return;
    }
    setSubmitting(true);
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
            Escaneie o QR do morador ou digite o código.
          </p>
        </div>
      </header>

      <div className="space-y-2">
        <BarcodeScannerInput
          value={value}
          onChange={(v) => {
            setValue(v);
            setError(null);
          }}
          placeholder="Bipar QR ou digitar código"
          disabled={submitting}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/chegada')}
          disabled={submitting}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || submitting}
          aria-busy={submitting}
          className="h-12 flex-[2] text-base"
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
    </div>
  );
}
