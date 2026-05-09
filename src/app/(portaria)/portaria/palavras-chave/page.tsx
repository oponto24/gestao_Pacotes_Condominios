import { Key, Search } from 'lucide-react';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { listPalavrasChavePendentes } from '@/lib/db/palavra-chave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

function formatTs(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function diasParaExpirar(expira: Date): number {
  return Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * Story 7.x: tela porteiro lista palavras-chave pendentes.
 * Fluxo: entregador chega → pede palavra-chave → porteiro busca por apto → fala valor.
 */
export default async function PalavrasChavePage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const ctx = await requirePorteiro();
  const palavras = await listPalavrasChavePendentes(ctx, { q });

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <h1 className="mb-2 flex items-center gap-2 text-xl md:text-2xl font-semibold">
        <Key className="size-5 md:size-6 text-primary" aria-hidden />
        Palavras-chave
      </h1>
      <p className="mb-4 text-sm text-text-secondary">
        Códigos enviados pelos moradores via WhatsApp pra entrega de pacotes ML/Shopee/etc.
        Busque pelo apto ou nome quando o entregador pedir.
      </p>

      <form method="GET" className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Apto, bloco, morador ou código…"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </form>

      {palavras.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-text-secondary">
            {q ? `Nenhuma palavra-chave encontrada pra "${q}".` : 'Nenhuma palavra-chave pendente.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {palavras.map((p) => {
            const dias = diasParaExpirar(p.expira_em);
            return (
              <li
                key={p.id}
                className="rounded-md border border-border bg-background p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      {p.unidade_label}
                    </span>
                    <span className="ml-2 font-medium">{p.morador_nome}</span>
                  </div>
                  <span className="text-xs text-text-secondary">
                    Recebida {formatTs(p.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <code className="rounded-md bg-primary/10 px-3 py-1 text-lg font-bold tracking-wider text-primary">
                    {p.codigo}
                  </code>
                  {p.descricao && (
                    <span className="text-xs text-text-secondary">{p.descricao}</span>
                  )}
                  <span
                    className={`ml-auto text-xs ${
                      dias <= 3 ? 'text-warning' : 'text-text-secondary'
                    }`}
                  >
                    Expira em {dias} dia{dias === 1 ? '' : 's'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
