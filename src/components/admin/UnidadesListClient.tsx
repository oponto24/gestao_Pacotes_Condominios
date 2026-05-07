'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Home } from 'lucide-react';
import { UnidadeForm, type UnidadeFormInitial } from './UnidadeForm';

export interface UnidadeRow {
  id: string;
  identificador: string;
  bloco: string | null;
  observacoes: string | null;
  ativo: boolean;
  _count: { moradores: number; pacotes: number };
}

interface Props {
  rows: UnidadeRow[];
  total: number;
  includeInativas: boolean;
}

export function UnidadesListClient({ rows, total, includeInativas }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UnidadeFormInitial | null>(null);

  function toggleInativas() {
    const next = new URLSearchParams(params);
    if (includeInativas) next.delete('inativas');
    else next.set('inativas', 'true');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function toggleAtiva(id: string, ativo: boolean) {
    const res = await fetch(`/api/admin/unidades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    });
    if (!res.ok) {
      alert(ativo ? 'Falha ao desativar.' : 'Falha ao ativar.');
      return;
    }
    router.refresh();
  }

  async function deleteUnidade(id: string, label: string) {
    if (!confirm(`Excluir a unidade "${label}"? Esta ação é irreversível.`)) return;
    const res = await fetch(`/api/admin/unidades/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      alert(body.message ?? 'Falha ao excluir.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Unidades</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={toggleInativas}>
            {includeInativas ? 'Ocultar inativas' : 'Mostrar inativas'}
          </Button>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Nova unidade</Button>
            </SheetTrigger>
            <SheetContent>
              <UnidadeForm mode="create" onDone={() => setCreateOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Home className="h-12 w-12" aria-hidden />}
          title="Nenhuma unidade cadastrada"
          description="Cadastre as unidades (apartamentos/casas) do condomínio. Os porteiros vão associar pacotes a elas."
          action={
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger asChild>
                <Button>Cadastrar primeira unidade</Button>
              </SheetTrigger>
              <SheetContent>
                <UnidadeForm mode="create" onDone={() => setCreateOpen(false)} />
              </SheetContent>
            </Sheet>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bloco</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="text-right">Moradores</TableHead>
              <TableHead className="text-right">Pacotes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => {
              const semVinculos = u._count.moradores === 0 && u._count.pacotes === 0;
              const label = u.bloco ? `${u.bloco} • ${u.identificador}` : u.identificador;
              return (
                <TableRow key={u.id}>
                  <TableCell className="text-text-secondary">{u.bloco ?? '—'}</TableCell>
                  <TableCell className="font-medium">{u.identificador}</TableCell>
                  <TableCell className="max-w-xs truncate text-text-secondary">
                    {u.observacoes ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">{u._count.moradores}</TableCell>
                  <TableCell className="text-right">{u._count.pacotes}</TableCell>
                  <TableCell>
                    {u.ativo ? (
                      <Badge variant="success">Ativa</Badge>
                    ) : (
                      <Badge variant="muted">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(u)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleAtiva(u.id, u.ativo)}>
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    {semVinculos && (
                      <Button variant="ghost" size="sm" onClick={() => deleteUnidade(u.id, label)}>
                        Excluir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <SheetContent>
          {editTarget && (
            <UnidadeForm mode="edit" initial={editTarget} onDone={() => setEditTarget(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
