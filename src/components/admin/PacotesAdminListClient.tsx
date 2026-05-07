'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PacoteStatusBadge } from '@/components/admin/PacoteStatusBadge';
import type { ListPacotesResult } from '@/lib/db/pacote-admin-list';

interface Props {
  data: ListPacotesResult;
}

const STATUS_OPTIONS = [
  { value: '__all__', label: 'Todos os status' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'pendente_identificacao', label: 'Pendente ID' },
  { value: 'aguardando_retirada', label: 'Aguardando retirada' },
  { value: 'retirado', label: 'Retirado' },
  { value: 'cancelado', label: 'Cancelado' },
];

function formatRelative(d: Date | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function PacotesAdminListClient({ data }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const initialQ = params.get('q') ?? '';
  const status = params.get('status') ?? '__all__';

  const [q, setQ] = useState(initialQ);

  // Debounce busca textual (300ms)
  useEffect(() => {
    if (q === initialQ) return;
    const t = setTimeout(() => updateParam('q', q || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '__all__' || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    startTransition(() => {
      router.replace(`/admin/pacotes?${next.toString()}`);
    });
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Pacotes</h1>
        <span className="text-sm text-text-secondary">
          {data.total} total{data.total === 1 ? '' : ''}
        </span>
      </header>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, unidade, código…"
            className="pl-8 pr-8"
            maxLength={100}
          />
          {q && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {data.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-background p-8 text-center text-sm text-text-secondary">
          Nenhum pacote encontrado{q && ` para "${q}"`}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Destinatário</th>
                <th className="px-3 py-2 font-medium">Unidade</th>
                <th className="px-3 py-2 font-medium">Recebido</th>
                <th className="px-3 py-2 font-medium">Setor</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">
                    <PacoteStatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/pacotes/${p.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {p.nome_destinatario_etiqueta || 'Sem destinatário'}
                    </Link>
                    {p.codigo_rastreio && (
                      <p className="text-xs text-text-secondary">
                        {p.codigo_rastreio}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.unidade
                      ? `${p.unidade.bloco ? `${p.unidade.bloco} · ` : ''}${p.unidade.identificador}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-text-secondary">
                    {formatRelative(p.recebido_em)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.setor?.nome ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            Página {data.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={data.page <= 1}
              onClick={() => updateParam('page', String(data.page - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={data.page >= totalPages}
              onClick={() => updateParam('page', String(data.page + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
