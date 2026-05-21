'use client';

import { useCallback, useEffect, useState } from 'react';
import { Key, Search, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PalavraChave {
  id: string;
  codigo: string;
  descricao: string | null;
  created_at: string;
  expira_em: string;
  morador_id: string;
  morador_nome: string;
  unidade_id: string;
  unidade_label: string;
}

const POLL_INTERVAL = 10_000; // 10s

function tempoAtras(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  return `${h}h atrás`;
}

export function PalavrasChaveClient() {
  const [palavras, setPalavras] = useState<PalavraChave[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchPalavras = useCallback(async () => {
    try {
      const url = search
        ? `/api/palavras-chave?q=${encodeURIComponent(search)}`
        : '/api/palavras-chave';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPalavras(data);
        setLastUpdate(new Date());
      }
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Initial fetch + polling
  useEffect(() => {
    fetchPalavras();
    const interval = setInterval(fetchPalavras, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPalavras]);

  async function marcarUsada(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/palavras-chave/${id}`, { method: 'PATCH' });
      if (res.ok) {
        setPalavras((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setMarkingId(null);
    }
  }

  const novasPalavras = palavras.filter((p) => {
    const age = Date.now() - new Date(p.created_at).getTime();
    return age < 5 * 60_000; // < 5 min
  });
  const antigasPalavras = palavras.filter((p) => {
    const age = Date.now() - new Date(p.created_at).getTime();
    return age >= 5 * 60_000;
  });

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden>
          <Key className="size-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">Palavras-chave</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Códigos enviados pelos moradores via WhatsApp. Atualiza a cada 10s.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchPalavras}
          className="rounded-md p-2 text-text-secondary hover:bg-muted/40"
          aria-label="Atualizar"
        >
          <RefreshCw className="size-4" />
        </button>
      </header>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por apto, morador ou código…"
          className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : palavras.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <Key className="mx-auto mb-2 size-8 text-text-secondary/50" />
          <p className="text-sm text-text-secondary">
            {search
              ? `Nenhuma palavra-chave encontrada para "${search}".`
              : 'Nenhuma palavra-chave pendente.'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Quando um morador enviar um código pelo WhatsApp, aparece aqui automaticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Novas (< 5 min) — destacadas */}
          {novasPalavras.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Recentes
              </p>
              {novasPalavras.map((p) => (
                <PalavraChaveCard
                  key={p.id}
                  palavra={p}
                  isNew
                  marking={markingId === p.id}
                  onMarcar={() => marcarUsada(p.id)}
                />
              ))}
            </div>
          )}

          {/* Anteriores */}
          {antigasPalavras.length > 0 && (
            <div className="space-y-2">
              {novasPalavras.length > 0 && (
                <p className="text-sm font-medium text-text-secondary">Anteriores</p>
              )}
              {antigasPalavras.map((p) => (
                <PalavraChaveCard
                  key={p.id}
                  palavra={p}
                  isNew={false}
                  marking={markingId === p.id}
                  onMarcar={() => marcarUsada(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-center text-xs text-text-secondary">
        Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
      </p>
    </div>
  );
}

function PalavraChaveCard({
  palavra,
  isNew,
  marking,
  onMarcar,
}: {
  palavra: PalavraChave;
  isNew: boolean;
  marking: boolean;
  onMarcar: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        isNew
          ? 'border-success/30 bg-success-light'
          : 'border-border bg-background'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              {palavra.unidade_label}
            </span>
            <span className="text-sm font-medium">{palavra.morador_nome}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <code className="rounded-md bg-primary/10 px-3 py-1.5 text-lg font-bold tracking-wider text-primary">
              {palavra.codigo}
            </code>
            {palavra.descricao && (
              <span className="text-xs text-text-secondary">{palavra.descricao}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-text-secondary">
            {tempoAtras(palavra.created_at)}
          </span>
          <Button
            size="sm"
            variant={isNew ? 'primary' : 'secondary'}
            onClick={onMarcar}
            disabled={marking}
            className="whitespace-nowrap"
          >
            {marking ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-3" />
            )}
            Usado
          </Button>
        </div>
      </div>
    </div>
  );
}
