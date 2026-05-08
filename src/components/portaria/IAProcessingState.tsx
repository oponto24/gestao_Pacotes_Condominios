'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  /** Foto storage path pra confirmar visualmente que upload deu certo. */
  fotoPath?: string;
}

/**
 * `<IAProcessingState>` — tela exibida em /chegada/confirmar/{id} ENQUANTO
 * o worker BullMQ ainda não processou a etiqueta (ia_confianca === null).
 *
 * Faz auto-refresh server-side via `router.refresh()` a cada 2s. Quando o
 * worker termina e o pacote ganha `ia_confianca`, a próxima refresh re-renderiza
 * a página com `<IAExtractionForm>` no lugar.
 *
 * Tempo típico de extração: 1-3s. Limitamos a 30s — depois disso assumimos
 * falha do worker e habilitamos botão pra continuar manualmente.
 */
export function IAProcessingState({ fotoPath }: Props) {
  const router = useRouter();
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      router.refresh();
    }, 2000);
    const timerInterval = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(refreshInterval);
      clearInterval(timerInterval);
    };
  }, [router]);

  const slow = secondsElapsed > 10;
  const stuck = secondsElapsed > 30;

  return (
    <div className="space-y-4 pb-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Confirmar dados</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Aguarde — a IA está lendo a etiqueta.
        </p>
      </header>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-start gap-3">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="size-5 text-primary-dark" aria-hidden />
            <Loader2
              className="absolute size-10 animate-spin text-primary-dark/30"
              aria-hidden
            />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">
              IA processando etiqueta…
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {stuck
                ? 'Está demorando mais que o normal. A foto foi salva — você pode aguardar mais um pouco ou voltar e tentar de novo.'
                : slow
                  ? 'Quase lá… etiquetas com luz fraca ou texto manuscrito levam um pouco mais.'
                  : 'Identificando destinatário, apartamento e endereço. Costuma levar 1-3 segundos.'}
            </p>
            <p className="mt-2 text-xs text-text-secondary/70">
              {secondsElapsed}s ·{' '}
              <span className="text-text-secondary/50">atualiza sozinho</span>
            </p>
          </div>
        </div>
      </div>

      {fotoPath && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-text-secondary">
          <span className="font-semibold">Foto da etiqueta:</span>{' '}
          <span className="font-mono">{fotoPath}</span>
        </div>
      )}

      {stuck && (
        <button
          type="button"
          onClick={() => router.push('/chegada')}
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Voltar e tentar de novo
        </button>
      )}
    </div>
  );
}
