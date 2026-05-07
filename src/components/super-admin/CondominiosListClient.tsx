'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { CondominioForm, type CondominioFormInitial } from './CondominioForm';

export interface CondominioRow {
  id: string;
  nome: string;
  cnpj: string | null;
  cidade: string;
  estado: string;
  ativo: boolean;
  deleted_at: string | null;
  endereco: string;
  cep: string;
  contato_nome: string;
  contato_telefone: string;
  contato_email: string | null;
  _count: { unidades: number; moradores: number };
}

interface Props {
  rows: CondominioRow[];
  total: number;
  page: number;
  pageSize: number;
  includeArquivados: boolean;
}

export function CondominiosListClient({ rows, total, page, pageSize, includeArquivados }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<CondominioFormInitial | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function toggleArquivados() {
    const next = new URLSearchParams(params);
    if (includeArquivados) next.delete('arquivados');
    else next.set('arquivados', 'true');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function archive(id: string) {
    if (!confirm('Arquivar este condomínio? Ele ficará oculto da lista mas histórico é preservado.')) return;
    const res = await fetch(`/api/admin/condominios/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Falha ao arquivar.');
      return;
    }
    router.refresh();
  }

  async function restore(id: string) {
    const res = await fetch(`/api/admin/condominios/${id}/restore`, { method: 'POST' });
    if (!res.ok) {
      alert('Falha ao restaurar.');
      return;
    }
    router.refresh();
  }

  async function impersonate(id: string) {
    const res = await fetch('/api/super-admin/impersonate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ condominio_id: id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Falha ao impersonar: ${body.message ?? res.status}`);
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Condomínios</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={toggleArquivados}>
            {includeArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
          </Button>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Novo condomínio</Button>
            </SheetTrigger>
            <SheetContent>
              <CondominioForm mode="create" onDone={() => setCreateOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-text-secondary">Nenhum condomínio cadastrado.</p>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button className="mt-4">Criar primeiro condomínio</Button>
            </SheetTrigger>
            <SheetContent>
              <CondominioForm mode="create" onDone={() => setCreateOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Moradores</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const arquivado = !!c.deleted_at;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-text-secondary">{c.cnpj ?? '—'}</TableCell>
                  <TableCell>
                    {c.cidade}/{c.estado}
                  </TableCell>
                  <TableCell className="text-right">{c._count.unidades}</TableCell>
                  <TableCell className="text-right">{c._count.moradores}</TableCell>
                  <TableCell>
                    {arquivado ? (
                      <Badge variant="muted">Arquivado</Badge>
                    ) : c.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="warning">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {!arquivado && c.ativo && (
                      <Button variant="ghost" size="sm" onClick={() => impersonate(c.id)}>
                        Impersonar
                      </Button>
                    )}
                    {!arquivado && (
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(c)}>
                        Editar
                      </Button>
                    )}
                    {arquivado ? (
                      <Button variant="ghost" size="sm" onClick={() => restore(c.id)}>
                        Restaurar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => archive(c.id)}>
                        Arquivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-text-secondary">
            Página {page} de {totalPages}
          </span>
          {page > 1 && (
            <Link href={`?page=${page - 1}${includeArquivados ? '&arquivados=true' : ''}`}>
              <Button variant="ghost" size="sm">
                Anterior
              </Button>
            </Link>
          )}
          {page < totalPages && (
            <Link href={`?page=${page + 1}${includeArquivados ? '&arquivados=true' : ''}`}>
              <Button variant="ghost" size="sm">
                Próxima
              </Button>
            </Link>
          )}
        </div>
      )}

      <Sheet open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <SheetContent>
          {editTarget && (
            <CondominioForm
              mode="edit"
              initial={editTarget}
              onDone={() => setEditTarget(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
