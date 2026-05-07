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
import { Star, Users } from 'lucide-react';
import {
  MoradorForm,
  type MoradorFormInitial,
  type UnidadeOption,
} from './MoradorForm';

export interface MoradorRow {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  unidade_id: string;
  is_principal: boolean;
  ativo: boolean;
  deleted_at: string | null;
  unidade: { identificador: string; bloco: string | null };
  _count: { pacotes_destinatario: number };
}

interface Props {
  rows: MoradorRow[];
  total: number;
  unidades: UnidadeOption[];
  includeInativos: boolean;
  includeArquivados: boolean;
}

function unidadeLabel(u: { identificador: string; bloco: string | null }): string {
  return u.bloco ? `${u.bloco} • ${u.identificador}` : u.identificador;
}

export function MoradoresListClient({
  rows,
  total,
  unidades,
  includeInativos,
  includeArquivados,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MoradorFormInitial | null>(null);

  function toggleParam(key: string, currentValue: boolean) {
    const next = new URLSearchParams(params);
    if (currentValue) next.delete(key);
    else next.set(key, 'true');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const res = await fetch(`/api/admin/moradores/${id}`, {
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

  async function marcarPrincipal(id: string, nome: string) {
    if (!confirm(`Marcar "${nome}" como principal? O atual principal da unidade será desmarcado.`)) return;
    const res = await fetch(`/api/admin/moradores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_principal: true }),
    });
    if (!res.ok) {
      alert('Falha ao marcar como principal.');
      return;
    }
    router.refresh();
  }

  async function archive(id: string, nome: string) {
    if (
      !confirm(
        `Arquivar "${nome}" conforme LGPD?\n\nO morador ficará oculto da lista mas o histórico de pacotes/notificações é preservado. Você pode restaurar depois.`,
      )
    )
      return;
    const res = await fetch(`/api/admin/moradores/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      alert(body.message ?? 'Falha ao arquivar.');
      return;
    }
    router.refresh();
  }

  async function restore(id: string) {
    const res = await fetch(`/api/admin/moradores/${id}/restore`, { method: 'POST' });
    if (!res.ok) {
      alert('Falha ao restaurar.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Moradores</h1>
          <p className="text-sm text-text-secondary">{total} no total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => toggleParam('inativos', includeInativos)}>
            {includeInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
          </Button>
          <Button variant="ghost" onClick={() => toggleParam('arquivados', includeArquivados)}>
            {includeArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
          </Button>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Novo morador</Button>
            </SheetTrigger>
            <SheetContent>
              <MoradorForm
                mode="create"
                unidades={unidades}
                onDone={() => setCreateOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" aria-hidden />}
          title="Nenhum morador cadastrado"
          description={
            unidades.length === 0
              ? 'Cadastre primeiro uma Unidade para depois adicionar moradores.'
              : 'Cadastre o morador principal de cada unidade. Eles vão receber notificações WhatsApp.'
          }
          action={
            unidades.length > 0 ? (
              <Sheet open={createOpen} onOpenChange={setCreateOpen}>
                <SheetTrigger asChild>
                  <Button>Cadastrar primeiro morador</Button>
                </SheetTrigger>
                <SheetContent>
                  <MoradorForm
                    mode="create"
                    unidades={unidades}
                    onDone={() => setCreateOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Pacotes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => {
              const arquivado = !!m.deleted_at;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-text-secondary">{unidadeLabel(m.unidade)}</TableCell>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{m.telefone}</TableCell>
                  <TableCell className="text-text-secondary">{m.email ?? '—'}</TableCell>
                  <TableCell>
                    {m.is_principal ? (
                      <Badge variant="success">
                        <Star className="mr-1 h-3 w-3" aria-hidden /> Principal
                      </Badge>
                    ) : (
                      <Badge variant="muted">Adicional</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{m._count.pacotes_destinatario}</TableCell>
                  <TableCell>
                    {arquivado ? (
                      <Badge variant="muted">Arquivado</Badge>
                    ) : m.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="warning">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {!arquivado && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditTarget(m)}>
                          Editar
                        </Button>
                        {!m.is_principal && (
                          <Button variant="ghost" size="sm" onClick={() => marcarPrincipal(m.id, m.nome)}>
                            Tornar principal
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => toggleAtivo(m.id, m.ativo)}>
                          {m.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => archive(m.id, m.nome)}>
                          Arquivar
                        </Button>
                      </>
                    )}
                    {arquivado && (
                      <Button variant="ghost" size="sm" onClick={() => restore(m.id)}>
                        Restaurar
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
            <MoradorForm
              mode="edit"
              initial={editTarget}
              unidades={unidades}
              onDone={() => setEditTarget(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
