import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, ImageOff } from 'lucide-react';
import type { PendenteListItem } from '@/lib/db/pacote-pendentes';

interface Props {
  itens: PendenteListItem[];
}

function formatRelative(date: Date | null): string {
  if (!date) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function confiancaColor(c: number | null): string {
  if (c === null) return 'text-text-secondary';
  if (c >= 0.8) return 'text-success';
  if (c >= 0.5) return 'text-warning';
  return 'text-danger';
}

export function PendentesList({ itens }: Props) {
  if (itens.length === 0) {
    return (
      <div className="space-y-4 pb-8">
        <h1 className="text-2xl font-semibold text-foreground">Pendentes</h1>
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-8 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <p className="font-medium">Tudo resolvido!</p>
          <p className="text-sm text-text-secondary">
            Nenhum pacote pendente de identificação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Pendentes</h1>
        <span className="rounded-full bg-warning/10 px-3 py-1 text-sm font-medium text-warning">
          {itens.length} {itens.length === 1 ? 'pacote' : 'pacotes'}
        </span>
      </header>

      <p className="text-sm text-text-secondary">
        IA não conseguiu casar automaticamente. Toque para resolver manualmente.
      </p>

      <ul className="space-y-2">
        {itens.map((p) => {
          const nome = p.nome_destinatario_etiqueta?.trim() || 'Sem nome';
          const compl = p.complemento_etiqueta?.trim() || 'Sem complemento';
          const conf = p.ia_confianca === null ? null : Math.round(p.ia_confianca * 100);
          return (
            <li key={p.id}>
              <Link
                href={`/chegada/confirmar/${p.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-text-secondary">
                  {p.foto_storage_path ? (
                    <AlertTriangle className="size-5 text-warning" aria-hidden />
                  ) : (
                    <ImageOff className="size-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{nome}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {compl}
                    {p.cep_etiqueta && ` · ${p.cep_etiqueta}`}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="text-text-secondary">{formatRelative(p.recebido_em)}</span>
                    {conf !== null && (
                      <span className={confiancaColor(p.ia_confianca)}>
                        IA {conf}%
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-text-secondary" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
