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
import { Layers } from 'lucide-react';
import { SetorForm, type SetorFormInitial } from './SetorForm';

export interface SetorRow {
  id: string;
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  ativo: boolean;
  _count: { pacotes: number };
}

interface Props {
  rows: SetorRow[];
  total: number;
  includeInativos: boolean;
}

export function SetoresListClient({ rows, total, includeInativos }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SetorFormInitial | null>(null);

  function toggleInativos() {
    const next = new URLSearchParams(params);
    if (includeInativos) next.delete('inativos');
    else next.set('inativos', 'true');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const res = await fetch(`/api/admin/setores/${id}`, {
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

  async function deleteSetor(id: string, nome: string) {
    if (!confirm(`Excluir o setor "${nome}"? Esta ação é irreversível.`)) return;
    const res = await fetch(`/api/admin/setores/${id}`, { method: 'DELETE' });
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
          <h1 className="text-2xl font-semibold text-foreground">Setores</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={toggleInativos}>
            {includeInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
          </Button>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Novo setor</Button>
            </SheetTrigger>
            <SheetContent>
              <SetorForm mode="create" onDone={() => setCreateOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-12 w-12" aria-hidden />}
          title="Nenhum setor cadastrado"
          description="Crie o primeiro setor (ex: Bloco A, Salão de Festas) para classificar onde os pacotes ficarão armazenados."
          action={
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger asChild>
                <Button>Criar primeiro setor</Button>
              </SheetTrigger>
              <SheetContent>
                <SetorForm mode="create" onDone={() => setCreateOpen(false)} />
              </SheetContent>
            </Sheet>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Capacidade</TableHead>
              <TableHead className="text-right">Pacotes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => {
              const semPacotes = s._count.pacotes === 0;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-text-secondary">{s.descricao ?? '—'}</TableCell>
                  <TableCell className="text-right">{s.capacidade ?? '—'}</TableCell>
                  <TableCell className="text-right">{s._count.pacotes}</TableCell>
                  <TableCell>
                    {s.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(s)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleAtivo(s.id, s.ativo)}>
                      {s.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    {semPacotes && (
                      <Button variant="ghost" size="sm" onClick={() => deleteSetor(s.id, s.nome)}>
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
            <SetorForm mode="edit" initial={editTarget} onDone={() => setEditTarget(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
